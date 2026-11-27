import type {
  BillingCycle,
  CurrencyCode,
  LedgerEntry,
  OvertimeTier,
  SubscriptionItem,
  WorkLog,
  WorkSettings,
} from '../types';

export const DEFAULT_EXCHANGE_RATES: Record<CurrencyCode, number> = {
  CNY: 1,
  USD: 7.22,
  HKD: 0.93,
  JPY: 0.048,
  EUR: 7.85,
};

export function toCny(
  amount: number,
  currency: CurrencyCode,
  rates: Record<CurrencyCode, number> = DEFAULT_EXCHANGE_RATES
): number {
  return amount * (rates[currency] ?? 1);
}

export function getSubscriptionNetCycleCny(
  sub: SubscriptionItem,
  rates: Record<CurrencyCode, number> = DEFAULT_EXCHANGE_RATES
): number {
  const gross = toCny(sub.price, sub.currency, rates);
  return Math.max(0, gross - (sub.sharedRefund || 0));
}

export function getSubscriptionMonthlyCny(
  sub: SubscriptionItem,
  rates: Record<CurrencyCode, number> = DEFAULT_EXCHANGE_RATES
): number {
  if (!sub.active) return 0;
  const net = getSubscriptionNetCycleCny(sub, rates);
  switch (sub.cycle) {
    case 'weekly':
      return (net * 52.1429) / 12;
    case 'monthly':
      return net;
    case 'quarterly':
      return net / 3;
    case 'semiannual':
      return net / 6;
    case 'yearly':
      return net / 12;
    default:
      return net;
  }
}

export function getCycleLabel(cycle: BillingCycle): string {
  switch (cycle) {
    case 'weekly':
      return '周';
    case 'monthly':
      return '月';
    case 'quarterly':
      return '季';
    case 'semiannual':
      return '半年';
    case 'yearly':
      return '年';
  }
}

export function getCurrencySymbol(c: CurrencyCode): string {
  switch (c) {
    case 'CNY':
      return '¥';
    case 'USD':
      return '$';
    case 'HKD':
      return 'HK$';
    case 'JPY':
      return 'JP¥';
    case 'EUR':
      return '€';
  }
}

export function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 9, 30, 0, 0);
}

export function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function advanceRenewalDate(ymd: string, cycle: BillingCycle, count = 1): string {
  const d = parseLocalDate(ymd);
  switch (cycle) {
    case 'weekly':
      d.setDate(d.getDate() + 7 * count);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1 * count);
      break;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3 * count);
      break;
    case 'semiannual':
      d.setMonth(d.getMonth() + 6 * count);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1 * count);
      break;
  }
  return formatYmd(d);
}

export function daysUntilDate(targetYmd: string, todayYmd: string = formatYmd(new Date())): number {
  const t = parseLocalDate(targetYmd);
  const now = parseLocalDate(todayYmd);
  t.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - now.getTime()) / 86400000);
}

/**
 * Count Monday-Friday normal workdays in a given YYYY-MM month
 */
export function countWeekdaysInMonth(monthYm: string): number {
  const [y, m] = monthYm.split('-').map(Number);
  if (!y || !m) return 22;
  const totalDays = new Date(y, m, 0).getDate();
  let count = 0;
  for (let d = 1; d <= totalDays; d++) {
    const dow = new Date(y, m - 1, d).getDay();
    if (dow >= 1 && dow <= 5) count++;
  }
  return count;
}

export function getTargetWorkdaysForMonth(monthYm: string, ws: WorkSettings): number {
  const override = ws.monthlyTargetDaysOverride?.[monthYm];
  if (override && override > 0) return override;
  return countWeekdaysInMonth(monthYm);
}

export function getEffectiveHourlyBase(ws: WorkSettings): number {
  if (ws.salaryMode === 'hourly') {
    return ws.hourlyRate;
  }
  const denom = (ws.standardDaysPerMonth || 21.75) * (ws.standardHoursPerDay || 8);
  return denom > 0 ? ws.monthlyBaseSalary / denom : ws.hourlyRate;
}

export function getOvertimeMultiplier(tier: OvertimeTier, ws: WorkSettings): number {
  switch (tier) {
    case 'weekday':
      return ws.weekdayMultiplier;
    case 'weekend':
      return ws.weekendMultiplier;
    case 'holiday':
      return ws.holidayMultiplier;
  }
}

export function isMealIncluded(log: Pick<WorkLog, 'regularHours' | 'overtimeHours' | 'includeMeal'>): boolean {
  if (typeof log.includeMeal === 'boolean') return log.includeMeal;
  return log.regularHours > 0 || log.overtimeHours > 0;
}

export function calcDailyWorkPay(log: WorkLog, ws: WorkSettings): {
  regularPay: number;
  overtimePay: number;
  mealPay: number;
  bonus: number;
  totalDailyPay: number;
} {
  const baseHourly = getEffectiveHourlyBase(ws);
  const mult = getOvertimeMultiplier(log.overtimeTier, ws);
  const overtimePay = log.overtimeHours * baseHourly * mult;
  const mealPay = isMealIncluded(log) ? (ws.dailyMealAllowance ?? 15) : 0;
  const bonus = log.customBonus || 0;

  if (ws.salaryMode === 'hourly') {
    const regularPay = log.regularHours * ws.hourlyRate;
    return {
      regularPay,
      overtimePay,
      mealPay,
      bonus,
      totalDailyPay: regularPay + overtimePay + mealPay + bonus,
    };
  } else {
    return {
      regularPay: 0,
      overtimePay,
      mealPay,
      bonus,
      totalDailyPay: overtimePay + mealPay + bonus,
    };
  }
}

/**
 * Monthly summary including:
 * - Daily meal allowance (15 CNY/day worked)
 * - Monthly housing allowance (200 CNY full normal workday attendance; deducted per absent day otherwise)
 */
export function calcMonthWorkSummary(monthYm: string, logs: WorkLog[], ws: WorkSettings) {
  const monthLogs = logs.filter((l) => l.date.startsWith(monthYm));
  const stdHours = ws.standardHoursPerDay || 8;
  const targetWorkdays = getTargetWorkdaysForMonth(monthYm, ws);

  let regularHours = 0;
  let overtimeHours = 0;
  let overtimePay = 0;
  let regularPay = 0;
  let mealPay = 0;
  let mealDays = 0;
  let bonusPay = 0;
  let workDays = 0;
  let attendedNormalDays = 0;

  for (const log of monthLogs) {
    if (log.regularHours > 0 || log.overtimeHours > 0) {
      workDays += 1;
    }
    if (log.regularHours > 0) {
      // Full normal shift = 1 day; half-day shift (e.g. 4h/8h) = 0.5 day
      attendedNormalDays += Math.min(1, log.regularHours / stdHours);
    }
    regularHours += log.regularHours;
    overtimeHours += log.overtimeHours;

    const d = calcDailyWorkPay(log, ws);
    regularPay += d.regularPay;
    overtimePay += d.overtimePay;
    if (d.mealPay > 0) {
      mealPay += d.mealPay;
      mealDays += 1;
    }
    bonusPay += d.bonus;
  }

  // Housing allowance calculation:
  // Full monthlyHousingAllowance (200) if attendedNormalDays >= targetWorkdays;
  // Otherwise deduct per shortfall day!
  const housingMax = ws.monthlyHousingAllowance ?? 200;
  let housingAllowance = 0;
  let housingDeduction = 0;
  const shortfallDays = Math.max(0, Number((targetWorkdays - attendedNormalDays).toFixed(2)));

  if (workDays > 0 && housingMax > 0 && targetWorkdays > 0) {
    if (shortfallDays <= 0) {
      housingAllowance = housingMax;
      housingDeduction = 0;
    } else {
      const perDayDeduct =
        ws.housingDailyDeductionOverride && ws.housingDailyDeductionOverride > 0
          ? ws.housingDailyDeductionOverride
          : housingMax / targetWorkdays;
      housingDeduction = Math.min(housingMax, shortfallDays * perDayDeduct);
      housingAllowance = Math.max(0, housingMax - housingDeduction);
    }
  }

  const basePay =
    ws.salaryMode === 'monthly_plus_ot'
      ? workDays > 0
        ? ws.monthlyBaseSalary
        : 0
      : regularPay;

  const totalEstimatedPay = basePay + overtimePay + mealPay + housingAllowance + bonusPay;

  return {
    workDays,
    attendedNormalDays: Number(attendedNormalDays.toFixed(2)),
    targetWorkdays,
    shortfallDays,
    regularHours,
    overtimeHours,
    totalHours: regularHours + overtimeHours,
    basePay,
    overtimePay,
    mealDays,
    mealPay,
    housingMax,
    housingAllowance,
    housingDeduction,
    bonusPay,
    totalEstimatedPay,
    monthLogs,
  };
}

export function calcMonthLedgerSummary(monthYm: string, entries: LedgerEntry[]) {
  const monthEntries = entries
    .filter((e) => e.date.startsWith(monthYm))
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : b.date.localeCompare(a.date)));

  let totalIncome = 0;
  let totalExpense = 0;
  const expenseByCategory: Record<string, number> = {};

  for (const e of monthEntries) {
    if (e.type === 'income') {
      totalIncome += e.amount;
    } else {
      totalExpense += e.amount;
      expenseByCategory[e.category] = (expenseByCategory[e.category] || 0) + e.amount;
    }
  }

  return {
    totalIncome,
    totalExpense,
    netBalance: totalIncome - totalExpense,
    expenseByCategory,
    monthEntries,
  };
}
