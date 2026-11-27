import { Preferences } from '@capacitor/preferences';
import type { AppDatabase, AppSettings, LedgerEntry } from '../types';
import {
  advanceRenewalDate,
  DEFAULT_EXCHANGE_RATES,
  formatYmd,
  getSubscriptionNetCycleCny,
  reconcileAutoPaydayLedger,
} from './calculator';

const DB_KEY = 'jianzhang_db_v1';
const LEGACY_DEMO_IDS = new Set([
  'l-1',
  'l-2',
  'l-3',
  'l-4',
  'w-today',
  'w-yest',
  's-bili',
  's-88vip',
  's-mobile',
]);

export function getDefaultSettings(): AppSettings {
  return {
    theme: 'system',
    monthlyBudget: 0,
    autoRecordSubExpense: true,
    defaultRemindDays: [7, 3, 1],
    exchangeRates: { ...DEFAULT_EXCHANGE_RATES },
    work: {
      salaryMode: 'hourly',
      hourlyRate: 25,
      monthlyBaseSalary: 6000,
      standardDaysPerMonth: 21.75,
      standardHoursPerDay: 8,
      weekdayMultiplier: 1.5,
      weekendMultiplier: 2.0,
      holidayMultiplier: 3.0,
      dailyMealAllowance: 15,
      monthlyHousingAllowance: 200,
      monthlyFixedDeduction: 0,
      monthlyTargetDaysOverride: {},
      paydayOfMonth: 15,
      autoMergePaydayToLedger: true,
    },
    webdav: {
      url: 'https://dav.jianguoyun.com/dav/',
      username: '',
      password: '',
      remoteFolder: 'JianZhangBackup',
      autoBackup: false,
    },
    ai: {
      enabled: false,
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: '',
      model: 'deepseek-chat',
    },
  };
}

export function createStarterDatabase(): AppDatabase {
  return {
    version: 3,
    ledger: [],
    workLogs: [],
    subscriptions: [],
    dismissedPaydays: [],
    settings: getDefaultSettings(),
  };
}

/**
 * Roll forward overdue auto-renew subscriptions AND automatically record renewal expenses into Ledger when due
 */
export function rollForwardOverdueSubscriptions(
  db: AppDatabase,
  todayYmd: string = formatYmd(new Date())
): AppDatabase {
  let changed = false;
  const nextLedger: LedgerEntry[] = [...db.ledger];
  const autoRecord = db.settings.autoRecordSubExpense !== false;

  const recordRenewalIfMissing = (sub: AppDatabase['subscriptions'][number], dueDate: string) => {
    if (!autoRecord) return;
    const linkKey = `sub-renew-${sub.id}-${dueDate}`;
    if (nextLedger.some((e) => e.linkedId === linkKey)) return;
    const netCny = getSubscriptionNetCycleCny(sub, db.settings.exchangeRates);
    if (netCny <= 0) return;

    nextLedger.unshift({
      id: `lsub-${sub.id}-${dueDate}`,
      date: dueDate,
      type: 'expense',
      category: '会员扣费',
      title: `${sub.name} 自动续费`,
      amount: Number(netCny.toFixed(2)),
      note: '到期自动记账',
      source: 'sub_sync',
      linkedId: linkKey,
      createdAt: Date.now(),
    });
    changed = true;
  };

  const updatedSubs = db.subscriptions.map((sub) => {
    if (!sub.active || !sub.autoRenew) return sub;

    // If today IS the renewal date, record today's expense once while keeping nextRenewalDate = today so UI shows "今天续费"
    if (sub.nextRenewalDate === todayYmd) {
      recordRenewalIfMissing(sub, todayYmd);
      return sub;
    }

    let nextDate = sub.nextRenewalDate;
    let guard = 0;
    while (nextDate < todayYmd && guard < 24) {
      recordRenewalIfMissing(sub, nextDate);
      nextDate = advanceRenewalDate(nextDate, sub.cycle, 1);
      guard++;
      changed = true;
    }
    if (nextDate === todayYmd) {
      recordRenewalIfMissing(sub, todayYmd);
    }
    return nextDate !== sub.nextRenewalDate ? { ...sub, nextRenewalDate: nextDate } : sub;
  });

  return changed ? { ...db, subscriptions: updatedSubs, ledger: nextLedger } : db;
}

export async function loadDatabase(): Promise<AppDatabase> {
  try {
    const { value } = await Preferences.get({ key: DB_KEY });
    const raw = value || localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppDatabase;
      const defaults = getDefaultSettings();
      const ver = parsed.version || 1;

      const workLogs = (Array.isArray(parsed.workLogs) ? parsed.workLogs : []).filter(
        (item) => !(ver < 2 && LEGACY_DEMO_IDS.has(item.id))
      );

      const ledger = (Array.isArray(parsed.ledger) ? parsed.ledger : []).filter((item) => {
        if (ver < 2 && LEGACY_DEMO_IDS.has(item.id)) return false;
        if (ver < 3 && item.source === 'work_sync' && !(item.linkedId || '').startsWith('payday-')) {
          return false;
        }
        return true;
      });

      const subscriptions = (Array.isArray(parsed.subscriptions) ? parsed.subscriptions : []).filter(
        (item) => !(ver < 2 && LEGACY_DEMO_IDS.has(item.id))
      );

      const merged: AppDatabase = {
        version: 3,
        ledger,
        workLogs,
        subscriptions,
        dismissedPaydays: Array.isArray(parsed.dismissedPaydays) ? parsed.dismissedPaydays : [],
        settings: {
          ...defaults,
          ...parsed.settings,
          work: { ...defaults.work, ...(parsed.settings?.work || {}) },
          webdav: { ...defaults.webdav, ...(parsed.settings?.webdav || {}) },
          ai: { ...defaults.ai, ...(parsed.settings?.ai || {}) },
        },
      };

      const subRolled = rollForwardOverdueSubscriptions(merged);
      const { db: paydayReconciled, newlySettledMonths } = reconcileAutoPaydayLedger(subRolled);
      if (ver < 3 || newlySettledMonths.length > 0 || paydayReconciled !== merged) {
        await saveDatabase(paydayReconciled);
      }
      return paydayReconciled;
    }
  } catch {
    // ignore corrupt cache
  }
  const cleanDb = createStarterDatabase();
  await saveDatabase(cleanDb);
  return cleanDb;
}

export async function saveDatabase(db: AppDatabase): Promise<void> {
  const json = JSON.stringify(db);
  try {
    localStorage.setItem(DB_KEY, json);
  } catch {
    // ignore quota error
  }
  try {
    await Preferences.set({ key: DB_KEY, value: json });
  } catch {
    // fallback in non-capacitor test environments
  }
}

export function exportDatabaseCsv(db: AppDatabase): string {
  const header = '\uFEFF日期,模块,类型,分类,名称,金额(CNY),备注\n';
  const ledgerRows = db.ledger.map(
    (e) =>
      `${e.date},账本,${e.type === 'income' ? '收入' : '支出'},"${e.category}","${e.title.replace(/"/g, '""')}",${
        e.type === 'income' ? e.amount : -e.amount
      },"${(e.note || '').replace(/"/g, '""')}"`
  );
  const workRows = db.workLogs.map(
    (w) =>
      `${w.date},工时,打卡,正班${w.regularHours}h/加班${w.overtimeHours}h,"工时记录",${w.calculatedPay || 0},"${(
        w.note || ''
      ).replace(/"/g, '""')}"`
  );
  const subRows = db.subscriptions.map(
    (s) =>
      `${s.nextRenewalDate},订阅,续费提醒,"${s.category}","${s.name.replace(/"/g, '""')}",${s.price},"${s.currency}/${
        s.cycle
      }"`
  );
  return header + [...ledgerRows, ...workRows, ...subRows].join('\n');
}
