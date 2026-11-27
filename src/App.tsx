import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Settings,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { LedgerView } from './components/LedgerView';
import { QuickAddSheet } from './components/QuickAddSheet';
import { SettingsSheet } from './components/SettingsSheet';
import { SubsView } from './components/SubsView';
import { WorkView } from './components/WorkView';
import type { ParsedIntent } from './core/aiParser';
import {
  advanceRenewalDate,
  calcDailyWorkPay,
  formatYmd,
  getSubscriptionNetCycleCny,
} from './core/calculator';
import {
  backupToWebDav,
  removeSubscriptionFromSystemCalendar,
  rescheduleAllSubscriptionNotifications,
  syncSubscriptionToSystemCalendar,
} from './core/nativeBridge';
import { getDefaultSettings, loadDatabase, saveDatabase } from './core/storage';
import type {
  AppDatabase,
  AppSettings,
  LedgerEntry,
  SubscriptionItem,
  TabKey,
  WorkLog,
} from './types';

export function App() {
  const [db, setDb] = useState<AppDatabase | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('ledger');
  const [monthYm, setMonthYm] = useState(() => formatYmd(new Date()).slice(0, 7));
  const [quickOpen, setQuickOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 2600);
  };

  useEffect(() => {
    loadDatabase().then((loaded) => {
      setDb(loaded);
      rescheduleAllSubscriptionNotifications(loaded.subscriptions);
    });
  }, []);

  useEffect(() => {
    if (!db) return;
    const applyTheme = () => {
      const prefDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark =
        db.settings.theme === 'dark' || (db.settings.theme === 'system' && prefDark);
      document.documentElement.classList.toggle('dark', isDark);
    };
    applyTheme();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', applyTheme);
    return () => mq.removeEventListener('change', applyTheme);
  }, [db]);

  const persist = (next: AppDatabase) => {
    setDb(next);
    saveDatabase(next);
    if (next.settings.webdav.autoBackup && next.settings.webdav.username) {
      backupToWebDav(next.settings.webdav, next).catch(() => null);
    }
  };

  const shiftMonth = (delta: number) => {
    const [y, m] = monthYm.split('-').map(Number);
    const d = new Date(y, (m || 1) - 1 + delta, 1);
    setMonthYm(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  if (!db) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center text-sm text-zinc-400">
        正在加载简账...
      </div>
    );
  }

  const handleUpdateSettings = (nextSettings: AppSettings) => {
    const recomputedLogs = db.workLogs.map((w) => {
      const pay = calcDailyWorkPay(w, nextSettings.work).totalDailyPay;
      return { ...w, calculatedPay: pay };
    });

    persist({
      ...db,
      settings: nextSettings,
      workLogs: recomputedLogs,
    });
  };

  const handleUpdateMonthTargetDays = (ym: string, days: number) => {
    const nextSettings: AppSettings = {
      ...db.settings,
      work: {
        ...db.settings.work,
        monthlyTargetDaysOverride: {
          ...(db.settings.work.monthlyTargetDaysOverride || {}),
          [ym]: days,
        },
      },
    };
    persist({ ...db, settings: nextSettings });
  };

  // Work logs ONLY accumulate in WorkView as pending salary for next month; never auto-added to current month's Ledger
  const handleSaveWorkLog = (input: Omit<WorkLog, 'id'>) => {
    const existing = db.workLogs.find((w) => w.date === input.date);
    const id = existing?.id || `w-${input.date}`;
    const pay = calcDailyWorkPay({ ...input, id }, db.settings.work).totalDailyPay;

    const updatedLog: WorkLog = {
      ...input,
      id,
      calculatedPay: pay,
    };

    const nextWorkLogs = [updatedLog, ...db.workLogs.filter((w) => w.date !== input.date)];
    persist({ ...db, workLogs: nextWorkLogs });
  };

  // Triggered on actual payday (typically next month): records real received salary into payday month's Ledger
  const handleRecordPaydaySalary = (
    sourceMonthYm: string,
    actualAmount: number,
    paydayDate: string,
    note: string
  ) => {
    const linkKey = `payday-${sourceMonthYm}`;
    const cleanedLedger = db.ledger.filter((e) => e.linkedId !== linkKey);
    const srcMonthNum = parseInt(sourceMonthYm.split('-')[1] || '1', 10);

    cleanedLedger.unshift({
      id: `lw-${linkKey}`,
      date: paydayDate,
      type: 'income',
      category: '工资奖金',
      title: `${srcMonthNum}月工资到账`,
      amount: Number(actualAmount.toFixed(2)),
      note,
      source: 'work_sync',
      linkedId: linkKey,
      createdAt: Date.now(),
    });

    persist({ ...db, ledger: cleanedLedger });
    showToast(`已将 ${srcMonthNum} 月工资记入 ${paydayDate.slice(5)} 账本收入`);
  };

  const handleDeleteWorkLog = (date: string) => {
    const nextWorkLogs = db.workLogs.filter((w) => w.date !== date);
    persist({ ...db, workLogs: nextWorkLogs });
    showToast('已清除该日工时记录');
  };

  const handleUpsertSub = async (sub: SubscriptionItem, syncCalendarNow: boolean) => {
    let finalSub = { ...sub };
    if (syncCalendarNow && sub.active) {
      try {
        const res = await syncSubscriptionToSystemCalendar(sub);
        finalSub = { ...finalSub, syncSystemCalendar: true, calendarEventId: res.eventId };
        showToast(res.message);
      } catch {
        showToast('日历权限未授予或暂不可用，已开启应用内通知提醒');
      }
    } else if (sub.calendarEventId) {
      await removeSubscriptionFromSystemCalendar(sub.calendarEventId);
      finalSub = { ...finalSub, syncSystemCalendar: false, calendarEventId: undefined };
    }

    const exists = db.subscriptions.some((s) => s.id === finalSub.id);
    const nextSubs = exists
      ? db.subscriptions.map((s) => (s.id === finalSub.id ? finalSub : s))
      : [finalSub, ...db.subscriptions];

    persist({ ...db, subscriptions: nextSubs });
    rescheduleAllSubscriptionNotifications(nextSubs);
  };

  const handleDeleteSub = async (id: string) => {
    const target = db.subscriptions.find((s) => s.id === id);
    if (target?.calendarEventId) {
      await removeSubscriptionFromSystemCalendar(target.calendarEventId);
    }
    const nextSubs = db.subscriptions.filter((s) => s.id !== id);
    persist({ ...db, subscriptions: nextSubs });
    rescheduleAllSubscriptionNotifications(nextSubs);
    showToast('已删除订阅项');
  };

  const handleRenewOneCycle = async (sub: SubscriptionItem, recordExpense: boolean) => {
    const nextDate = advanceRenewalDate(sub.nextRenewalDate, sub.cycle, 1);
    const updated: SubscriptionItem = { ...sub, nextRenewalDate: nextDate };
    const nextSubs = db.subscriptions.map((s) => (s.id === sub.id ? updated : s));
    const nextLedger = [...db.ledger];
    if (recordExpense) {
      const netCny = getSubscriptionNetCycleCny(sub, db.settings.exchangeRates);
      if (netCny > 0) {
        nextLedger.unshift({
          id: `lsub-${Date.now()}`,
          date: formatYmd(new Date()),
          type: 'expense',
          category: '会员扣费',
          title: `${sub.name} 续期`,
          amount: Number(netCny.toFixed(2)),
          note: `到期日已顺延至 ${nextDate}`,
          source: 'sub_sync',
          linkedId: sub.id,
          createdAt: Date.now(),
        });
      }
    }
    persist({ ...db, subscriptions: nextSubs, ledger: nextLedger });
    if (updated.syncSystemCalendar && updated.active) {
      syncSubscriptionToSystemCalendar(updated).catch(() => null);
    }
    rescheduleAllSubscriptionNotifications(nextSubs);
    showToast(`已顺延一期至 ${nextDate}`);
  };

  const handleCommitParsed = async (items: ParsedIntent[]) => {
    let nextLedger = [...db.ledger];
    let nextWork = [...db.workLogs];
    let nextSubs = [...db.subscriptions];

    for (const item of items) {
      if (item.kind === 'ledger') {
        nextLedger.unshift({
          id: `l-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          date: item.date,
          type: item.ledgerType,
          category: item.category,
          title: item.title,
          amount: item.amount,
          source: 'ai',
          createdAt: Date.now(),
        });
        setActiveTab('ledger');
      } else if (item.kind === 'work') {
        const wLog: WorkLog = {
          id: `w-${item.date}`,
          date: item.date,
          regularHours: item.regularHours,
          overtimeHours: item.overtimeHours,
          overtimeTier: item.overtimeTier,
          includeMeal: item.includeMeal,
          customBonus: item.customBonus || undefined,
          calculatedPay: item.estimatedPay,
        };
        nextWork = [wLog, ...nextWork.filter((w) => w.date !== item.date)];
        setActiveTab('work');
      } else if (item.kind === 'sub') {
        const newSub: SubscriptionItem = {
          id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          name: item.name,
          category: item.category,
          iconText: item.iconText,
          brandColor: item.brandColor,
          price: item.price,
          currency: item.currency,
          cycle: item.cycle,
          nextRenewalDate: item.nextRenewalDate,
          autoRenew: true,
          syncSystemCalendar: true,
          remindDays: [...db.settings.defaultRemindDays],
          active: true,
        };
        try {
          const calRes = await syncSubscriptionToSystemCalendar(newSub);
          newSub.calendarEventId = calRes.eventId;
        } catch {
          // keep local notification active
        }
        nextSubs = [newSub, ...nextSubs];
        setActiveTab('subs');
      }
    }

    persist({ ...db, ledger: nextLedger, workLogs: nextWork, subscriptions: nextSubs });
    rescheduleAllSubscriptionNotifications(nextSubs);
    showToast(`✦ 已自动记入 ${items.length} 条记录`);
  };

  const handleSyncAllCalendars = async () => {
    let okCount = 0;
    const updatedSubs: SubscriptionItem[] = [];
    for (const s of db.subscriptions) {
      if (!s.active) {
        updatedSubs.push(s);
        continue;
      }
      try {
        const res = await syncSubscriptionToSystemCalendar(s);
        updatedSubs.push({ ...s, syncSystemCalendar: true, calendarEventId: res.eventId });
        okCount++;
      } catch {
        updatedSubs.push(s);
      }
    }
    persist({ ...db, subscriptions: updatedSubs });
    rescheduleAllSubscriptionNotifications(updatedSubs);
    showToast(okCount > 0 ? `已同步 ${okCount} 项订阅至系统日历` : '请先允许日历读写权限');
  };

  const [yearStr, monStr] = monthYm.split('-');
  const settledForMonth = db.ledger.find((e) => e.linkedId === `payday-${monthYm}`);

  return (
    <div className="min-h-screen bg-zinc-100/80 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col items-center">
      <div className="w-full max-w-md min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 relative">
        <header className="sticky top-0 z-20 bg-zinc-50/90 dark:bg-zinc-950/90 backdrop-blur-md px-4 pt-3 pb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-base font-bold tracking-tight px-1">
              {yearStr}年{parseInt(monStr, 10)}月
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            aria-label="设置"
            onClick={() => setSettingsOpen(true)}
            className="w-9 h-9 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 shadow-2xs active:scale-95 transition"
          >
            <Settings className="w-[18px] h-[18px]" />
          </button>
        </header>

        <main className="flex-1 px-4 pt-1 pb-24">
          {activeTab === 'ledger' && (
            <LedgerView
              monthYm={monthYm}
              entries={db.ledger}
              subscriptions={db.subscriptions}
              rates={db.settings.exchangeRates}
              onUpdateEntry={(updated: LedgerEntry) => {
                persist({
                  ...db,
                  ledger: db.ledger.map((e) => (e.id === updated.id ? updated : e)),
                });
                showToast('已更新账单条目');
              }}
              onDeleteEntry={(id) => {
                persist({ ...db, ledger: db.ledger.filter((e) => e.id !== id) });
                showToast('已删除该条账单');
              }}
              onJumpToSubs={() => setActiveTab('subs')}
              onOpenQuickAdd={() => setQuickOpen(true)}
            />
          )}

          {activeTab === 'work' && (
            <WorkView
              monthYm={monthYm}
              workLogs={db.workLogs}
              workSettings={db.settings.work}
              settledEntry={settledForMonth}
              onSaveWorkLog={handleSaveWorkLog}
              onDeleteWorkLog={handleDeleteWorkLog}
              onUpdateMonthTargetDays={handleUpdateMonthTargetDays}
              onRecordPaydaySalary={handleRecordPaydaySalary}
              onOpenWorkSettings={() => setSettingsOpen(true)}
            />
          )}

          {activeTab === 'subs' && (
            <SubsView
              subscriptions={db.subscriptions}
              rates={db.settings.exchangeRates}
              defaultRemindDays={db.settings.defaultRemindDays}
              onUpsertSub={handleUpsertSub}
              onDeleteSub={handleDeleteSub}
              onRenewOneCycle={handleRenewOneCycle}
              onToggleCalendar={(sub) => handleUpsertSub(sub, !sub.syncSystemCalendar)}
            />
          )}
        </main>

        {toast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-zinc-900/95 dark:bg-zinc-100/95 text-white dark:text-zinc-900 text-xs font-medium shadow-lg whitespace-nowrap">
            {toast}
          </div>
        )}

        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200/80 dark:border-zinc-800 px-3 pt-2 pb-2.5 grid grid-cols-4 items-center">
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`flex flex-col items-center gap-0.5 py-1 text-[11px] transition ${
              activeTab === 'ledger'
                ? 'text-zinc-900 dark:text-white font-bold'
                : 'text-zinc-400 dark:text-zinc-500 font-medium'
            }`}
          >
            <Wallet className="w-5 h-5" />
            <span>账本</span>
          </button>

          <button
            type="button"
            onClick={() => setQuickOpen(true)}
            className="mx-1 py-2 px-3 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold flex items-center justify-center gap-1 shadow-sm active:scale-95 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>快记</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('work')}
            className={`flex flex-col items-center gap-0.5 py-1 text-[11px] transition ${
              activeTab === 'work'
                ? 'text-zinc-900 dark:text-white font-bold'
                : 'text-zinc-400 dark:text-zinc-500 font-medium'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span>工时</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('subs')}
            className={`flex flex-col items-center gap-0.5 py-1 text-[11px] transition ${
              activeTab === 'subs'
                ? 'text-zinc-900 dark:text-white font-bold'
                : 'text-zinc-400 dark:text-zinc-500 font-medium'
            }`}
          >
            <CreditCard className="w-5 h-5" />
            <span>订阅</span>
          </button>
        </nav>

        <QuickAddSheet
          open={quickOpen}
          onClose={() => setQuickOpen(false)}
          workSettings={db.settings.work}
          aiConfig={db.settings.ai}
          onCommitParsed={handleCommitParsed}
          onCommitManualLedger={(item) => {
            persist({
              ...db,
              ledger: [
                {
                  id: `l-${Date.now()}`,
                  ...item,
                  source: 'manual',
                  createdAt: Date.now(),
                },
                ...db.ledger,
              ],
            });
            setActiveTab('ledger');
            showToast('已记入账本');
          }}
        />

        <SettingsSheet
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          db={db}
          onUpdateSettings={handleUpdateSettings}
          onImportDatabase={(imported) => {
            const safeDb: AppDatabase = {
              version: 3,
              ledger: imported.ledger || [],
              workLogs: imported.workLogs || [],
              subscriptions: imported.subscriptions || [],
              settings: { ...getDefaultSettings(), ...(imported.settings || {}) },
            };
            persist(safeDb);
            rescheduleAllSubscriptionNotifications(safeDb.subscriptions);
          }}
          onClearDemoData={() => {
            persist({
              ...db,
              version: 3,
              ledger: [],
              workLogs: [],
              subscriptions: [],
            });
            setSettingsOpen(false);
            showToast('已清空本地全部记录');
          }}
          onSyncAllCalendars={handleSyncAllCalendars}
          onToast={showToast}
        />
      </div>
    </div>
  );
}

export default App;
