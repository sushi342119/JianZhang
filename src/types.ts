export type TabKey = 'ledger' | 'work' | 'subs';

export type LedgerType = 'expense' | 'income';

export interface LedgerEntry {
  id: string;
  date: string; // YYYY-MM-DD
  type: LedgerType;
  category: string;
  title: string;
  amount: number; // positive number in CNY
  note?: string;
  source?: 'manual' | 'ai' | 'work_sync' | 'sub_sync';
  linkedId?: string;
  createdAt: number;
}

export type OvertimeTier = 'weekday' | 'weekend' | 'holiday';

export interface WorkLog {
  id: string;
  date: string; // YYYY-MM-DD
  regularHours: number;
  overtimeHours: number;
  overtimeTier: OvertimeTier;
  includeMeal?: boolean;
  customBonus?: number;
  note?: string;
  calculatedPay?: number;
}

export type BillingCycle = 'monthly' | 'quarterly' | 'semiannual' | 'yearly' | 'weekly';
export type CurrencyCode = 'CNY' | 'USD' | 'HKD' | 'JPY' | 'EUR';

export interface SubscriptionItem {
  id: string;
  name: string;
  category: string;
  iconText: string;
  brandColor: string;
  price: number;
  currency: CurrencyCode;
  sharedRefund?: number;
  cycle: BillingCycle;
  nextRenewalDate: string; // YYYY-MM-DD
  autoRenew: boolean;
  syncSystemCalendar: boolean;
  calendarEventId?: string;
  remindDays: number[];
  note?: string;
  active: boolean;
}

export type SalaryMode = 'hourly' | 'monthly_plus_ot';

export interface WorkSettings {
  salaryMode: SalaryMode;
  hourlyRate: number;
  monthlyBaseSalary: number;
  standardDaysPerMonth: number; // 21.75
  standardHoursPerDay: number; // default 8
  weekdayMultiplier: number; // default 1.5
  weekendMultiplier: number; // default 2.0
  holidayMultiplier: number; // default 3.0
  dailyMealAllowance: number; // default 15 CNY/day
  monthlyHousingAllowance: number; // default 200 CNY/month
  housingDailyDeductionOverride?: number;
  monthlyFixedDeduction?: number; // e.g. social insurance / dorm utilities deducted monthly
  monthlyTargetDaysOverride?: Record<string, number>;
  paydayOfMonth: number; // default 15
  autoMergePaydayToLedger?: boolean; // default true
}

export interface WebDavConfig {
  url: string;
  username: string;
  password: string;
  remoteFolder: string;
  autoBackup: boolean;
  lastSyncAt?: string;
}

export interface AiApiConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  monthlyBudget?: number; // 0 or undefined = hidden
  autoRecordSubExpense?: boolean; // default true: auto-record autoRenew subscriptions into ledger on renewal date
  defaultRemindDays: number[];
  exchangeRates: Record<CurrencyCode, number>;
  work: WorkSettings;
  webdav: WebDavConfig;
  ai: AiApiConfig;
}

export interface AppDatabase {
  version: number;
  ledger: LedgerEntry[];
  workLogs: WorkLog[];
  subscriptions: SubscriptionItem[];
  settings: AppSettings;
  dismissedPaydays?: string[];
}

export interface ChinaTemplateTier {
  label: string;
  price: number;
  cycle: BillingCycle;
}

export interface ChinaSubTemplate {
  id: string;
  name: string;
  category: '电商生活' | '视频娱乐' | '音乐阅读' | '云盘效率' | 'AI与开发' | '通讯账单';
  iconText: string;
  brandColor: string;
  currency?: CurrencyCode;
  tiers: ChinaTemplateTier[];
}
