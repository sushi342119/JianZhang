import { Preferences } from '@capacitor/preferences';
import type { AppDatabase, AppSettings, LedgerEntry, SubscriptionItem, WorkLog } from '../types';
import { advanceRenewalDate, DEFAULT_EXCHANGE_RATES, formatYmd } from './calculator';

const DB_KEY = 'jianzhang_db_v1';

export function getDefaultSettings(): AppSettings {
  return {
    theme: 'system',
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
      monthlyTargetDaysOverride: {},
      autoSyncWorkToLedger: true,
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

export function createStarterDatabase(today = new Date()): AppDatabase {
  const todayStr = formatYmd(today);
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const yestStr = formatYmd(yest);

  const in3Days = new Date(today);
  in3Days.setDate(in3Days.getDate() + 3);

  const in18Days = new Date(today);
  in18Days.setDate(in18Days.getDate() + 18);

  const in120Days = new Date(today);
  in120Days.setDate(in120Days.getDate() + 120);

  // 8h * 25 + 2h * 25 * 1.5 + 15(餐补) = 290
  // 8h * 25 + 1h * 25 * 1.5 + 15(餐补) = 252.5
  const workLogs: WorkLog[] = [
    {
      id: 'w-today',
      date: todayStr,
      regularHours: 8,
      overtimeHours: 2,
      overtimeTier: 'weekday',
      includeMeal: true,
      note: '日常出勤 + 晚间加班',
      syncedToLedger: true,
      calculatedPay: 290,
    },
    {
      id: 'w-yest',
      date: yestStr,
      regularHours: 8,
      overtimeHours: 1,
      overtimeTier: 'weekday',
      includeMeal: true,
      note: '常规班次',
      syncedToLedger: true,
      calculatedPay: 252.5,
    },
  ];

  const ledger: LedgerEntry[] = [
    {
      id: 'l-1',
      date: todayStr,
      type: 'income',
      category: '工时薪资',
      title: '今日工时核算',
      amount: 290,
      note: '正班 8h + 加班 2h + 餐补¥15',
      source: 'work_sync',
      linkedId: todayStr,
      createdAt: today.getTime() - 3600_000,
    },
    {
      id: 'l-2',
      date: todayStr,
      type: 'expense',
      category: '餐饮',
      title: '午餐 · 隆江猪脚饭',
      amount: 22,
      source: 'ai',
      createdAt: today.getTime() - 7200_000,
    },
    {
      id: 'l-3',
      date: yestStr,
      type: 'income',
      category: '工时薪资',
      title: '工时薪资核算',
      amount: 252.5,
      note: '正班 8h + 加班 1h + 餐补¥15',
      source: 'work_sync',
      linkedId: yestStr,
      createdAt: yest.getTime(),
    },
    {
      id: 'l-4',
      date: yestStr,
      type: 'expense',
      category: '日用',
      title: '超市采购水果与纸巾',
      amount: 56.8,
      source: 'manual',
      createdAt: yest.getTime() - 3600_000,
    },
  ];

  const subscriptions: SubscriptionItem[] = [
    {
      id: 's-bili',
      name: '哔哩哔哩大会员',
      category: '视频娱乐',
      iconText: 'B',
      brandColor: '#fb7299',
      price: 108,
      currency: 'CNY',
      cycle: 'yearly',
      nextRenewalDate: formatYmd(in3Days),
      autoRenew: true,
      syncSystemCalendar: false,
      remindDays: [7, 3, 1],
      active: true,
    },
    {
      id: 's-88vip',
      name: '淘宝 88VIP',
      category: '电商生活',
      iconText: '88',
      brandColor: '#ff5000',
      price: 88,
      currency: 'CNY',
      cycle: 'yearly',
      nextRenewalDate: formatYmd(in120Days),
      autoRenew: true,
      syncSystemCalendar: false,
      remindDays: [7, 3, 1],
      active: true,
    },
    {
      id: 's-mobile',
      name: '主力手机话费套餐',
      category: '通讯账单',
      iconText: '话',
      brandColor: '#059669',
      price: 29,
      currency: 'CNY',
      cycle: 'monthly',
      nextRenewalDate: formatYmd(in18Days),
      autoRenew: true,
      syncSystemCalendar: false,
      remindDays: [3, 1],
      active: true,
    },
  ];

  return {
    version: 1,
    ledger,
    workLogs,
    subscriptions,
    settings: getDefaultSettings(),
  };
}

export function rollForwardOverdueSubscriptions(db: AppDatabase): AppDatabase {
  const todayStr = formatYmd(new Date());
  let changed = false;
  const updatedSubs = db.subscriptions.map((sub) => {
    if (!sub.active || !sub.autoRenew) return sub;
    let nextDate = sub.nextRenewalDate;
    let guard = 0;
    while (nextDate < todayStr && guard < 24) {
      nextDate = advanceRenewalDate(nextDate, sub.cycle, 1);
      guard++;
      changed = true;
    }
    return nextDate !== sub.nextRenewalDate ? { ...sub, nextRenewalDate: nextDate } : sub;
  });
  return changed ? { ...db, subscriptions: updatedSubs } : db;
}

export async function loadDatabase(): Promise<AppDatabase> {
  try {
    const { value } = await Preferences.get({ key: DB_KEY });
    const raw = value || localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppDatabase;
      const defaults = getDefaultSettings();
      const merged: AppDatabase = {
        version: 1,
        ledger: Array.isArray(parsed.ledger) ? parsed.ledger : [],
        workLogs: Array.isArray(parsed.workLogs) ? parsed.workLogs : [],
        subscriptions: Array.isArray(parsed.subscriptions) ? parsed.subscriptions : [],
        settings: {
          ...defaults,
          ...parsed.settings,
          work: { ...defaults.work, ...(parsed.settings?.work || {}) },
          webdav: { ...defaults.webdav, ...(parsed.settings?.webdav || {}) },
          ai: { ...defaults.ai, ...(parsed.settings?.ai || {}) },
        },
      };
      return rollForwardOverdueSubscriptions(merged);
    }
  } catch {
    // ignore corrupt cache
  }
  const starter = createStarterDatabase();
  await saveDatabase(starter);
  return starter;
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
