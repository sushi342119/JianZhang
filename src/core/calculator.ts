import type {
  AppDatabase,
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

/**
 * Compute scheduled next-month payday YYYY-MM-DD for a given work month YYYY-MM
 */
export function getNextMonthPayday(monthYm: string, paydayOfMonth: number): string {
  const [y, m] = monthYm.split('-').map(Number);
  const nextMonthFirst = new Date(y, m, 1); // m is 1-based, so JS month index m is M+1
  const ny = nextMonthFirst.getFullYear();
  const nm = nextMonthFirst.getMonth() + 1;
  const maxDay = new Date(ny, nm, 0).getDate();
  const clampedDay = Math.min(Math.max(1, paydayOfMonth || 15), maxDay);
  return `${ny}-${String(nm).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

/**
 * Automatically merge accrued monthly salaries into the Ledger once today >= scheduled payday
 */
export function reconcileAutoPaydayLedger(
  db: AppDatabase,
  todayYmd: string = formatYmd(new Date())
): { db: AppDatabase; newlySettledMonths: string[] } {
  const ws = db.settings.work;
  const autoEnabled = ws.autoMergePaydayToLedger !== false;
  const paydayDay = ws.paydayOfMonth || 15;
  const dismissed = new Set(db.dismissedPaydays || []);

  const distinctMonths = Array.from(new Set(db.workLogs.map((w) => w.date.slice(0, 7)))).sort();
  let nextLedger = [...db.ledger];
  let changed = false;
  const newlySettledMonths: string[] = [];

  // Also check any existing work_sync payday-* entries whose payday was moved into the future
  for (const entry of db.ledger) {
    if (entry.source === 'work_sync' && entry.linkedId?.startsWith('payday-')) {
      const srcYm = entry.linkedId.slice('payday-'.length);
      const dueYmd = getNextMonthPayday(srcYm, paydayDay);
      if (!autoEnabled || todayYmd < dueYmd) {
        nextLedger = nextLedger.filter((e) => e.id !== entry.id);
        changed = true;
      }
    }
  }

  if (autoEnabled) {
    for (const ym of distinctMonths) {
      const dueYmd = getNextMonthPayday(ym, paydayDay);
      if (todayYmd < dueYmd) continue; // Not payday yet! Keep strictly in Work tab.
      if (dismissed.has(ym)) continue; // User explicitly deleted this month's salary entry.

      const summary = calcMonthWorkSummary(ym, db.workLogs, ws);
      const linkKey = `payday-${ym}`;
      const existing = nextLedger.find((e) => e.linkedId === linkKey);
      const srcMonthNum = parseInt(ym.split('-')[1] || '1', 10);
      const amt = Number(summary.totalEstimatedPay.toFixed(2));
      const note = `${srcMonthNum}月出勤${summary.workDays}天 (含餐补¥${summary.mealPay.toFixed(
        0
      )}/房补¥${summary.housingAllowance.toFixed(0)})`;

      if (amt <= 0) {
        if (existing && existing.source === 'work_sync') {
          nextLedger = nextLedger.filter((e) => e.id !== existing.id);
          changed = true;
        }
        continue;
      }

      if (!existing) {
        nextLedger.unshift({
          id: `lw-${linkKey}`,
          date: dueYmd,
          type: 'income',
          category: '工资奖金',
          title: `${srcMonthNum}月工资到账`,
          amount: amt,
          note,
          source: 'work_sync',
          linkedId: linkKey,
          createdAt: Date.now(),
        });
        newlySettledMonths.push(ym);
        changed = true;
      } else if (existing.source === 'work_sync') {
        // Keep auto-synced entry up to date if user adjusted past work logs or payday date
        if (existing.amount !== amt || existing.date !== dueYmd || existing.note !== note) {
          nextLedger = nextLedger.map((e) =>
            e.id === existing.id ? { ...e, amount: amt, date: dueYmd, note } : e
          );
          changed = true;
        }
      }
      // If existing.source === 'manual', user manually edited post-tax amount in Ledger -> preserve!
    }
  }

  return {
    db: changed ? { ...db, ledger: nextLedger } : db,
    newlySettledMonths,
  };
}
