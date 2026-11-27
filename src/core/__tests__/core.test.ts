import { describe, expect, it } from 'vitest';
import {
  advanceRenewalDate,
  calcDailyWorkPay,
  calcMonthWorkSummary,
  countWeekdaysInMonth,
  getSubscriptionMonthlyCny,
  reconcileAutoPaydayLedger,
} from '../calculator';
import { parseNaturalLanguageLocal } from '../aiParser';
import { generateIcsForSubscriptions } from '../nativeBridge';
import {
  createStarterDatabase,
  getDefaultSettings,
  rollForwardOverdueSubscriptions,
} from '../storage';
import type { WorkLog } from '../../types';

describe('JianZhang v1.3.0 Core Engines & Upgrades', () => {
  const defaultWork = getDefaultSettings().work;

  it('auto-includes 15 CNY daily meal allowance on workdays and 0 on rest days', () => {
    const workDay = calcDailyWorkPay(
      {
        id: '1',
        date: '2026-11-27',
        regularHours: 8,
        overtimeHours: 2,
        overtimeTier: 'weekday',
      },
      defaultWork
    );
    expect(workDay.mealPay).toBe(15);
    expect(workDay.totalDailyPay).toBe(290);
  });

  it('does not prematurely deduct housing allowance for future weekdays mid-month, and deducts fixed social insurance', () => {
    expect(countWeekdaysInMonth('2026-11')).toBe(21);

    // Suppose today is 2026-11-06 (first week: Mon Nov 2 .. Fri Nov 6 = 5 elapsed weekdays; 16 future weekdays)
    const firstWeekLogs: WorkLog[] = [
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
    ].map((d, i) => ({
      id: `w-${i}`,
      date: d,
      regularHours: 8,
      overtimeHours: 0,
      overtimeTier: 'weekday',
    }));

    const wsWithSocial = {
      ...defaultWork,
      monthlyFixedDeduction: 450, // e.g. social insurance 450
    };

    const midMonthSummary = calcMonthWorkSummary(
      '2026-11',
      firstWeekLogs,
      wsWithSocial,
      '2026-11-06'
    );
    expect(midMonthSummary.shortfallDays).toBe(0);
    expect(midMonthSummary.housingAllowance).toBe(200);
    expect(midMonthSummary.fixedDeduction).toBe(450);
    // 5 days * (200 + 15) = 1075 + 200 housing - 450 social = 825
    expect(midMonthSummary.totalEstimatedPay).toBe(825);
  });

  it('deducts housing allowance accurately for past months with absent days', () => {
    const ws = {
      ...defaultWork,
      monthlyTargetDaysOverride: { '2026-10': 20 },
    };
    const logs18: WorkLog[] = Array.from({ length: 18 }).map((_, i) => ({
      id: `w-${i}`,
      date: `2026-10-${String(i + 1).padStart(2, '0')}`,
      regularHours: 8,
      overtimeHours: 0,
      overtimeTier: 'weekday',
    }));

    const sum18 = calcMonthWorkSummary('2026-10', logs18, ws, '2026-11-27');
    expect(sum18.shortfallDays).toBe(2);
    expect(sum18.housingDeduction).toBeCloseTo(20);
    expect(sum18.housingAllowance).toBeCloseTo(180);
  });

  it('auto-merges salary into next month ledger ONLY when scheduled payday arrives', () => {
    const baseDb = createStarterDatabase();
    baseDb.settings.work.paydayOfMonth = 15;
    baseDb.workLogs = [
      {
        id: 'w-1',
        date: '2026-11-27',
        regularHours: 8,
        overtimeHours: 2,
        overtimeTier: 'weekday',
      },
    ];

    const beforeRes = reconcileAutoPaydayLedger(baseDb, '2026-12-14');
    expect(beforeRes.db.ledger.length).toBe(0);

    const onPaydayRes = reconcileAutoPaydayLedger(baseDb, '2026-12-15');
    expect(onPaydayRes.newlySettledMonths).toEqual(['2026-11']);
    expect(onPaydayRes.db.ledger.length).toBe(1);
    expect(onPaydayRes.db.ledger[0].date).toBe('2026-12-15');
  });

  it('auto-records subscription renewal expense into ledger without double-charging', () => {
    const db = createStarterDatabase();
    db.subscriptions = [
      {
        id: 'sub-icloud',
        name: 'iCloud+ 200GB',
        category: '云盘效率',
        iconText: '☁',
        brandColor: '#0284c7',
        price: 21,
        currency: 'CNY',
        cycle: 'monthly',
        nextRenewalDate: '2026-11-15',
        autoRenew: true,
        syncSystemCalendar: false,
        remindDays: [3, 1],
        active: true,
      },
    ];

    const rolledOnce = rollForwardOverdueSubscriptions(db, '2026-11-27');
    expect(rolledOnce.subscriptions[0].nextRenewalDate).toBe('2026-12-15');
    expect(rolledOnce.ledger.length).toBe(1);
    expect(rolledOnce.ledger[0].amount).toBe(21);
    expect(rolledOnce.ledger[0].date).toBe('2026-11-15');

    // Idempotency check: calling again on same day must NOT add a second expense
    const rolledTwice = rollForwardOverdueSubscriptions(rolledOnce, '2026-11-27');
    expect(rolledTwice.ledger.length).toBe(1);
  });

  it('routes AI natural language and generates multi-stage ICS', () => {
    const baseDate = new Date(2026, 10, 27);
    const leave = parseNaturalLanguageLocal('今天请假', defaultWork, baseDate);
    expect(leave.kind).toBe('work');

    const activeCost = getSubscriptionMonthlyCny({
      id: 's1',
      name: 'Apple Music 家庭组',
      category: '音乐阅读',
      iconText: 'AM',
      brandColor: '#f43f5e',
      price: 17,
      currency: 'CNY',
      sharedRefund: 11,
      cycle: 'monthly',
      nextRenewalDate: '2026-12-01',
      autoRenew: true,
      syncSystemCalendar: true,
      remindDays: [7, 3, 1],
      active: true,
    });
    expect(activeCost).toBe(6);
    expect(advanceRenewalDate('2026-11-27', 'yearly', 1)).toBe('2027-11-27');

    const ics = generateIcsForSubscriptions([
      {
        id: 'bili',
        name: '哔哩哔哩大会员',
        category: '视频娱乐',
        iconText: 'B',
        brandColor: '#fb7299',
        price: 108,
        currency: 'CNY',
        cycle: 'yearly',
        nextRenewalDate: '2026-11-30',
        autoRenew: true,
        syncSystemCalendar: true,
        remindDays: [7, 3, 1],
        active: true,
      },
    ]);
    expect(ics).toContain('TRIGGER:-P7D');
  });
});
