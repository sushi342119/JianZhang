import { describe, expect, it } from 'vitest';
import {
  advanceRenewalDate,
  calcDailyWorkPay,
  calcMonthWorkSummary,
  countWeekdaysInMonth,
  getSubscriptionMonthlyCny,
} from '../calculator';
import { parseNaturalLanguageLocal } from '../aiParser';
import { generateIcsForSubscriptions } from '../nativeBridge';
import { getDefaultSettings } from '../storage';
import type { WorkLog } from '../../types';

describe('JianZhang Core Engines & Allowance Rules', () => {
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
    // 8 * 25 (200) + 2 * 25 * 1.5 (75) + 15 (meal) = 290
    expect(workDay.mealPay).toBe(15);
    expect(workDay.totalDailyPay).toBe(290);

    const restDay = calcDailyWorkPay(
      {
        id: '2',
        date: '2026-11-28',
        regularHours: 0,
        overtimeHours: 0,
        overtimeTier: 'weekend',
      },
      defaultWork
    );
    expect(restDay.mealPay).toBe(0);
    expect(restDay.totalDailyPay).toBe(0);
  });

  it('grants full 200 CNY housing allowance when all normal workdays attended, and deducts per absent day otherwise', () => {
    // Nov 2026 has 21 weekdays (Mon-Fri)
    expect(countWeekdaysInMonth('2026-11')).toBe(21);

    const ws = {
      ...defaultWork,
      monthlyTargetDaysOverride: { '2026-11': 20 }, // 20 normal workdays -> 10 CNY/day housing deduction
    };

    // Case A: Attended 18 normal days (2 days absent) -> 200 - 2 * 10 = 180 housing; 18 * 15 = 270 meal
    const logs18: WorkLog[] = Array.from({ length: 18 }).map((_, i) => ({
      id: `w-${i}`,
      date: `2026-11-${String(i + 1).padStart(2, '0')}`,
      regularHours: 8,
      overtimeHours: 0,
      overtimeTier: 'weekday',
    }));

    const sum18 = calcMonthWorkSummary('2026-11', logs18, ws);
    expect(sum18.attendedNormalDays).toBe(18);
    expect(sum18.shortfallDays).toBe(2);
    expect(sum18.mealPay).toBe(18 * 15);
    expect(sum18.housingDeduction).toBeCloseTo(20);
    expect(sum18.housingAllowance).toBeCloseTo(180);

    // Case B: Attended all 20 normal days -> full 200 housing allowance, 0 deduction
    const logs20: WorkLog[] = Array.from({ length: 20 }).map((_, i) => ({
      id: `w-${i}`,
      date: `2026-11-${String(i + 1).padStart(2, '0')}`,
      regularHours: 8,
      overtimeHours: 0,
      overtimeTier: 'weekday',
    }));

    const sum20 = calcMonthWorkSummary('2026-11', logs20, ws);
    expect(sum20.shortfallDays).toBe(0);
    expect(sum20.housingDeduction).toBe(0);
    expect(sum20.housingAllowance).toBe(200);
  });

  it('normalizes subscription monthly cost with carpool refund and paused state', () => {
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
  });

  it('routes AI natural language including meal allowance and leave days', () => {
    const baseDate = new Date(2026, 10, 27);

    const work = parseNaturalLanguageLocal('今天上班8小时 加班2小时', defaultWork, baseDate);
    expect(work.kind).toBe('work');
    if (work.kind === 'work') {
      expect(work.includeMeal).toBe(true);
      // 8*25 + 2*25*1.5 + 15 = 290
      expect(work.estimatedPay).toBe(290);
    }

    const leave = parseNaturalLanguageLocal('今天请假', defaultWork, baseDate);
    expect(leave.kind).toBe('work');
    if (leave.kind === 'work') {
      expect(leave.regularHours).toBe(0);
      expect(leave.includeMeal).toBe(false);
      expect(leave.estimatedPay).toBe(0);
    }

    const icloud = parseNaturalLanguageLocal('刚开了iCloud 21元 200GB 每月', defaultWork, baseDate);
    expect(icloud.kind).toBe('sub');
    if (icloud.kind === 'sub') {
      expect(icloud.price).toBe(21);
    }
  });

  it('generates standard ICS with multi-stage 7/3/1 day VALARM triggers', () => {
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
    expect(ics).toContain('TRIGGER:-P3D');
    expect(ics).toContain('TRIGGER:-P1D');
  });
});
