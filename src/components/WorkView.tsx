import React, { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import {
  calcDailyWorkPay,
  calcMonthWorkSummary,
  formatYmd,
  getEffectiveHourlyBase,
  getNextMonthPayday,
  isMealIncluded,
} from '../core/calculator';
import type { LedgerEntry, OvertimeTier, WorkLog, WorkSettings } from '../types';

interface Props {
  monthYm: string;
  workLogs: WorkLog[];
  workSettings: WorkSettings;
  settledEntry?: LedgerEntry;
  onSaveWorkLog: (log: Omit<WorkLog, 'id'>) => void;
  onDeleteWorkLog: (date: string) => void;
  onUpdateMonthTargetDays: (monthYm: string, days: number) => void;
  onOpenWorkSettings: () => void;
}

export const WorkView: React.FC<Props> = ({
  monthYm,
  workLogs,
  workSettings,
  settledEntry,
  onSaveWorkLog,
  onDeleteWorkLog,
  onUpdateMonthTargetDays,
  onOpenWorkSettings,
}) => {
  const todayStr = formatYmd(new Date());
  const defaultSelected = todayStr.startsWith(monthYm) ? todayStr : `${monthYm}-01`;
  const [selectedDate, setSelectedDate] = useState(defaultSelected);

  useEffect(() => {
    setSelectedDate(todayStr.startsWith(monthYm) ? todayStr : `${monthYm}-01`);
  }, [monthYm, todayStr]);

  const existingLog = useMemo(
    () => workLogs.find((w) => w.date === selectedDate),
    [workLogs, selectedDate]
  );

  const [regHours, setRegHours] = useState<number>(existingLog?.regularHours ?? 8);
  const [otHours, setOtHours] = useState<number>(existingLog?.overtimeHours ?? 0);
  const [otTier, setOtTier] = useState<OvertimeTier>(existingLog?.overtimeTier ?? 'weekday');
  const [mealOn, setMealOn] = useState<boolean>(
    existingLog ? isMealIncluded(existingLog) : true
  );
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    if (existingLog) {
      setRegHours(existingLog.regularHours);
      setOtHours(existingLog.overtimeHours);
      setOtTier(existingLog.overtimeTier);
      setMealOn(isMealIncluded(existingLog));
    } else {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dow = new Date(y, (m || 1) - 1, d || 1).getDay();
      const isWeekend = dow === 0 || dow === 6;
      const defaultReg = isWeekend ? 0 : workSettings.standardHoursPerDay;
      setRegHours(defaultReg);
      setOtHours(0);
      setOtTier(isWeekend ? 'weekend' : 'weekday');
      setMealOn(defaultReg > 0);
    }
  }, [selectedDate, existingLog, workSettings.standardHoursPerDay]);

  const summary = calcMonthWorkSummary(monthYm, workLogs, workSettings);
  const previewPay = calcDailyWorkPay(
    {
      id: 'preview',
      date: selectedDate,
      regularHours: regHours,
      overtimeHours: otHours,
      overtimeTier: otTier,
      includeMeal: mealOn,
    },
    workSettings
  );

  const [yearNum, monthNum] = monthYm.split('-').map(Number);
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const firstDayDow = (new Date(yearNum, monthNum - 1, 1).getDay() + 6) % 7;
  const scheduledPayday = getNextMonthPayday(monthYm, workSettings.paydayOfMonth || 15);

  const logMap = useMemo(() => {
    const map: Record<string, WorkLog> = {};
    for (const l of summary.monthLogs) map[l.date] = l;
    return map;
  }, [summary.monthLogs]);

  const handleSave = () => {
    onSaveWorkLog({
      date: selectedDate,
      regularHours: regHours,
      overtimeHours: otHours,
      overtimeTier: otTier,
      includeMeal: mealOn,
      calculatedPay: previewPay.totalDailyPay,
    });
    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 1500);
  };

  const effHourly = getEffectiveHourlyBase(workSettings);

  return (
    <div className="space-y-3 pb-6">
      {/* Work Salary Summary Hero */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            {settledEntry
              ? `${monthNum}月工资 (已于 ${settledEntry.date.slice(5)} 自动并入账本)`
              : workSettings.autoMergePaydayToLedger !== false
              ? `${monthNum}月预计工资 (${scheduledPayday.slice(5)} 自动并入账本)`
              : `${monthNum}月预计总工资`}
          </span>
          <button
            type="button"
            onClick={onOpenWorkSettings}
            className="text-[11px] text-blue-600 dark:text-blue-400 font-medium shrink-0 ml-2"
          >
            规则 ›
          </button>
        </div>

        <div className="mt-1.5 flex items-baseline justify-between">
          <span className="text-3xl font-bold tracking-tight font-mono text-emerald-600 dark:text-emerald-400">
            ¥{summary.totalEstimatedPay.toFixed(2)}
          </span>
          <span className="text-xs font-mono text-zinc-400">
            总工时 {summary.totalHours.toFixed(1)}h
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4 pt-3.5 border-t border-zinc-100 dark:border-zinc-800/80">
          <div>
            <div className="text-[11px] text-zinc-400 dark:text-zinc-500">正班 + 加班费</div>
            <div className="text-sm font-semibold font-mono text-zinc-900 dark:text-zinc-100 mt-0.5">
              ¥{(summary.basePay + summary.overtimePay).toFixed(0)}
            </div>
            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
              加班 {summary.overtimeHours.toFixed(1)}h
            </div>
          </div>

          <div>
            <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
              餐补 (¥{workSettings.dailyMealAllowance}/天)
            </div>
            <div className="text-sm font-semibold font-mono text-zinc-800 dark:text-zinc-200 mt-0.5">
              ¥{summary.mealPay.toFixed(0)}
            </div>
            <div className="text-[10px] text-zinc-400 font-mono">{summary.mealDays} 天计餐补</div>
          </div>

          <div>
            <div className="text-[11px] text-zinc-400 dark:text-zinc-500">
              房补 (满勤¥{summary.housingMax})
            </div>
            <div className="text-sm font-semibold font-mono text-zinc-800 dark:text-zinc-200 mt-0.5">
              ¥{summary.housingAllowance.toFixed(1)}
            </div>
            <div className="text-[10px] text-zinc-400 font-mono">
              {summary.workDays === 0
                ? '待出勤'
                : summary.shortfallDays <= 0
                ? '已满勤拿满'
                : `差${summary.shortfallDays}天扣¥${summary.housingDeduction.toFixed(0)}`}
            </div>
          </div>
        </div>

        {/* Normal Workday Attendance Bar */}
        <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs">
          <span className="text-zinc-500 dark:text-zinc-400">
            正常工作日出勤：<b className="text-zinc-800 dark:text-zinc-200 font-mono">{summary.attendedNormalDays}</b> /{' '}
            <b className="text-zinc-800 dark:text-zinc-200 font-mono">{summary.targetWorkdays}</b> 天
          </span>
          <div className="flex items-center gap-1 text-[11px] text-zinc-500">
            <span>应出勤</span>
            <button
              type="button"
              onClick={() =>
                onUpdateMonthTargetDays(monthYm, Math.max(1, summary.targetWorkdays - 1))
              }
              className="w-5 h-5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono font-bold"
            >
              -
            </button>
            <span className="font-mono px-1">{summary.targetWorkdays}天</span>
            <button
              type="button"
              onClick={() =>
                onUpdateMonthTargetDays(monthYm, Math.min(31, summary.targetWorkdays + 1))
              }
              className="w-5 h-5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono font-bold"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Compact Monthly Calendar Grid */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-3.5">
        <div className="grid grid-cols-7 text-center text-[11px] text-zinc-400 dark:text-zinc-500 mb-2">
          {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayDow }).map((_, idx) => (
            <div key={`pad-${idx}`} className="h-11" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const day = idx + 1;
            const ymd = `${monthYm}-${String(day).padStart(2, '0')}`;
            const log = logMap[ymd];
            const isSel = ymd === selectedDate;
            const isToday = ymd === todayStr;
            const totalH = log ? log.regularHours + log.overtimeHours : 0;

            return (
              <button
                key={ymd}
                type="button"
                onClick={() => setSelectedDate(ymd)}
                className={`h-11 rounded-xl flex flex-col items-center justify-center transition relative border ${
                  isSel
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/50 dark:border-blue-500'
                    : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                }`}
              >
                <span
                  className={`text-xs leading-none ${
                    isSel
                      ? 'font-bold text-blue-600 dark:text-blue-400'
                      : isToday
                      ? 'font-bold text-zinc-900 dark:text-white underline'
                      : 'text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {day}
                </span>
                {log ? (
                  <span
                    className={`text-[10px] font-mono mt-1 leading-none ${
                      log.overtimeHours > 0
                        ? 'text-amber-600 dark:text-amber-400 font-semibold'
                        : totalH > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-zinc-400'
                    }`}
                  >
                    {totalH > 0 ? `${totalH}h` : '休'}
                  </span>
                ) : (
                  <span className="text-[10px] text-transparent mt-1 leading-none">·</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Quick Punch Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {selectedDate.slice(5)} 工时记录
            </span>
            {existingLog && (
              <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                已记录
              </span>
            )}
          </div>
          <div className="text-right">
            <span className="text-xs text-zinc-400 mr-1">
              {workSettings.salaryMode === 'hourly' ? '当日计薪' : '当日加班+餐补'}
            </span>
            <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
              ¥{previewPay.totalDailyPay.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Regular Hours Quick Pills */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">正班时长</span>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {[8, 4, 0].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => {
                  setRegHours(h);
                  setMealOn(h > 0 || otHours > 0);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                  regHours === h
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                {h === 0 ? '请假/休 0h' : `${h}h`}
              </button>
            ))}
            <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => {
                  const next = Math.max(0, regHours - 0.5);
                  setRegHours(next);
                  setMealOn(next > 0 || otHours > 0);
                }}
                className="px-2 py-1 bg-zinc-50 dark:bg-zinc-800"
              >
                -
              </button>
              <span className="px-2 font-mono">{regHours}h</span>
              <button
                type="button"
                onClick={() => {
                  const next = Math.min(24, regHours + 0.5);
                  setRegHours(next);
                  setMealOn(true);
                }}
                className="px-2 py-1 bg-zinc-50 dark:bg-zinc-800"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Overtime Hours Quick Pills */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">加班时长</span>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {[0, 1, 2, 3, 4].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => {
                  setOtHours(h);
                  if (h > 0) setMealOn(true);
                  else if (regHours === 0) setMealOn(false);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                  otHours === h
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                {h === 0 ? '无' : `+${h}h`}
              </button>
            ))}
            <div className="flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setOtHours((v) => Math.max(0, v - 0.5))}
                className="px-2 py-1 bg-zinc-50 dark:bg-zinc-800"
              >
                -
              </button>
              <span className="px-2 font-mono text-amber-600 dark:text-amber-400">{otHours}h</span>
              <button
                type="button"
                onClick={() => {
                  setOtHours((v) => Math.min(24, v + 0.5));
                  setMealOn(true);
                }}
                className="px-2 py-1 bg-zinc-50 dark:bg-zinc-800"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Overtime Multiplier & Daily Meal Toggle */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
          <button
            type="button"
            onClick={() => setMealOn((v) => !v)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
              mealOn
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/80 dark:bg-emerald-950/50 dark:text-emerald-400'
                : 'border-zinc-200 dark:border-zinc-700 text-zinc-400'
            }`}
          >
            {mealOn ? `✓ 含餐补 ¥${workSettings.dailyMealAllowance}` : `无餐补 (¥0)`}
          </button>

          <div className="flex gap-1">
            {(
              [
                ['weekday', `平日${workSettings.weekdayMultiplier}x`],
                ['weekend', `周末${workSettings.weekendMultiplier}x`],
                ['holiday', `节假${workSettings.holidayMultiplier}x`],
              ] as Array<[OvertimeTier, string]>
            ).map(([tier, label]) => (
              <button
                key={tier}
                type="button"
                onClick={() => setOtTier(tier)}
                title={`基数 ¥${effHourly.toFixed(1)}/h`}
                className={`px-2 py-1 rounded-full text-[11px] font-medium border transition ${
                  otTier === tier
                    ? 'border-blue-600 text-blue-600 bg-blue-50/80 dark:bg-blue-950/50 dark:text-blue-400'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.99] transition"
          >
            {savedToast ? (
              <>
                <Check className="w-3.5 h-3.5" /> 已计入本月工时累计
              </>
            ) : (
              <span>保存当日工时</span>
            )}
          </button>
          {existingLog && (
            <button
              type="button"
              onClick={() => onDeleteWorkLog(selectedDate)}
              className="px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500 hover:text-rose-500"
            >
              清除
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
