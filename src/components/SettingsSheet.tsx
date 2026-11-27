import React, { useRef, useState } from 'react';
import { Calendar, Cloud, Download, RotateCcw, Upload, X } from 'lucide-react';
import { exportDatabaseCsv } from '../core/storage';
import {
  APP_VERSION,
  backupToWebDav,
  checkGithubReleaseUpdate,
  exportAndShareFile,
  generateIcsForSubscriptions,
  GITHUB_REPO,
  openExternalLink,
  restoreFromWebDav,
} from '../core/nativeBridge';
import type { AppDatabase, AppSettings, SalaryMode } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  db: AppDatabase;
  onUpdateSettings: (next: AppSettings) => void;
  onImportDatabase: (next: AppDatabase) => void;
  onClearDemoData: () => void;
  onSyncAllCalendars: () => void;
  onToast: (msg: string) => void;
}

export const SettingsSheet: React.FC<Props> = ({
  open,
  onClose,
  db,
  onUpdateSettings,
  onImportDatabase,
  onClearDemoData,
  onSyncAllCalendars,
  onToast,
}) => {
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{
    hasUpdate: boolean;
    latestVersion: string;
    downloadUrl: string;
    notes: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const { settings } = db;

  const updateWork = (patch: Partial<AppSettings['work']>) => {
    onUpdateSettings({ ...settings, work: { ...settings.work, ...patch } });
  };

  const updateWebdav = (patch: Partial<AppSettings['webdav']>) => {
    onUpdateSettings({ ...settings, webdav: { ...settings.webdav, ...patch } });
  };

  const updateAi = (patch: Partial<AppSettings['ai']>) => {
    onUpdateSettings({ ...settings, ai: { ...settings.ai, ...patch } });
  };

  const handleWebDavUpload = async () => {
    setBusy(true);
    const res = await backupToWebDav(settings.webdav, db);
    if (res.ok) {
      updateWebdav({ lastSyncAt: new Date().toLocaleString('zh-CN') });
    }
    onToast(res.message);
    setBusy(false);
  };

  const handleWebDavRestore = async () => {
    setBusy(true);
    const res = await restoreFromWebDav(settings.webdav);
    if (res.ok && res.db) {
      onImportDatabase(res.db);
    }
    onToast(res.message);
    setBusy(false);
  };

  const handleJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as AppDatabase;
        if (Array.isArray(parsed.ledger) && Array.isArray(parsed.subscriptions)) {
          onImportDatabase(parsed);
          onToast('已成功从本地备份文件恢复数据');
        } else {
          onToast('请选择有效的简账 JSON 备份文件');
        }
      } catch {
        onToast('解析备份文件失败，请确认文件为 JSON 格式');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex flex-col justify-end">
      <div className="bg-zinc-50 dark:bg-zinc-950 rounded-t-3xl max-h-[88vh] flex flex-col border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between px-5 py-4 bg-white dark:bg-zinc-900 rounded-t-3xl border-b border-zinc-100 dark:border-zinc-800">
          <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            同步备份与计薪规则
          </span>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3.5">
          {/* 1. Salary, Meal & Housing Allowance Rules */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
            <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
              💰 工时、餐补与满勤房补规则
            </div>

            <div className="grid grid-cols-2 gap-1.5 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-semibold">
              {(
                [
                  ['hourly', '纯时薪 × 工时制'],
                  ['monthly_plus_ot', '固定月底薪 + 加班费'],
                ] as Array<[SalaryMode, string]>
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => updateWork({ salaryMode: m })}
                  className={`py-1.5 rounded-lg transition ${
                    settings.work.salaryMode === m
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                      : 'text-zinc-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {settings.work.salaryMode === 'hourly' ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">基础时薪 (¥/小时)</span>
                <input
                  type="number"
                  step="0.5"
                  value={settings.work.hourlyRate}
                  onChange={(e) => updateWork({ hourlyRate: parseFloat(e.target.value) || 0 })}
                  className="w-28 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm font-mono text-right outline-none"
                />
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">固定月底薪 (按21.75天折算加班基数)</span>
                <input
                  type="number"
                  step="100"
                  value={settings.work.monthlyBaseSalary}
                  onChange={(e) =>
                    updateWork({ monthlyBaseSalary: parseFloat(e.target.value) || 0 })
                  }
                  className="w-28 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm font-mono text-right outline-none"
                />
              </div>
            )}

            {/* Meal & Housing Subsidies */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <label className="text-[11px] text-zinc-500">每日出勤餐补 (¥/天)</label>
                <input
                  type="number"
                  step="1"
                  value={settings.work.dailyMealAllowance}
                  onChange={(e) =>
                    updateWork({ dailyMealAllowance: parseFloat(e.target.value) || 0 })
                  }
                  className="mt-1 w-full px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-mono outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-500">满勤住房补贴 (¥/月)</label>
                <input
                  type="number"
                  step="10"
                  value={settings.work.monthlyHousingAllowance}
                  onChange={(e) =>
                    updateWork({ monthlyHousingAllowance: parseFloat(e.target.value) || 0 })
                  }
                  className="mt-1 w-full px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-mono outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-400">
                房补缺勤日扣金额 (留空默认按 200÷当月工作日 扣)
              </span>
              <input
                type="number"
                step="0.5"
                value={settings.work.housingDailyDeductionOverride || ''}
                onChange={(e) =>
                  updateWork({
                    housingDailyDeductionOverride: parseFloat(e.target.value) || undefined,
                  })
                }
                placeholder="自动日均"
                className="w-24 px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-mono text-right outline-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <label className="text-[11px] text-zinc-400">平日加班倍率</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.work.weekdayMultiplier}
                  onChange={(e) =>
                    updateWork({ weekdayMultiplier: parseFloat(e.target.value) || 1 })
                  }
                  className="mt-1 w-full px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-mono outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-400">周末加班倍率</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.work.weekendMultiplier}
                  onChange={(e) =>
                    updateWork({ weekendMultiplier: parseFloat(e.target.value) || 1 })
                  }
                  className="mt-1 w-full px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-mono outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-zinc-400">节假日倍率</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.work.holidayMultiplier}
                  onChange={(e) =>
                    updateWork({ holidayMultiplier: parseFloat(e.target.value) || 1 })
                  }
                  className="mt-1 w-full px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-mono outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800">
              <span className="text-xs text-zinc-600 dark:text-zinc-300">
                每月发薪日 (当月工资默认计入次月几号)
              </span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-400">次月</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={settings.work.paydayOfMonth || 15}
                  onChange={(e) =>
                    updateWork({
                      paydayOfMonth: Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 15)),
                    })
                  }
                  className="w-14 px-2 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-mono text-center outline-none"
                />
                <span className="text-xs text-zinc-400">日</span>
              </div>
            </div>
          </div>

          {/* 2. WebDAV Cloud Sync & Local Backup */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-blue-600" /> WebDAV 云盘备份 (坚果云 / Alist / NAS)
              </span>
              {settings.webdav.lastSyncAt && (
                <span className="text-[10px] text-emerald-600">上次：{settings.webdav.lastSyncAt}</span>
              )}
            </div>

            <input
              type="text"
              value={settings.webdav.url}
              onChange={(e) => updateWebdav({ url: e.target.value })}
              placeholder="https://dav.jianguoyun.com/dav/"
              className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-mono outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={settings.webdav.username}
                onChange={(e) => updateWebdav({ username: e.target.value })}
                placeholder="云盘邮箱/账号"
                className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs outline-none"
              />
              <input
                type="password"
                value={settings.webdav.password}
                onChange={(e) => updateWebdav({ password: e.target.value })}
                placeholder="WebDAV 专用应用密码"
                className="px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs outline-none"
              />
            </div>

            <div className="flex items-center justify-between py-0.5">
              <span className="text-xs text-zinc-500">账目变动时自动静默备份至云盘</span>
              <input
                type="checkbox"
                checked={settings.webdav.autoBackup}
                onChange={(e) => updateWebdav({ autoBackup: e.target.checked })}
                className="w-4 h-4 accent-blue-600"
              />
            </div>

            <div className="flex gap-2 pt-0.5">
              <button
                type="button"
                disabled={busy}
                onClick={handleWebDavUpload}
                className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold flex items-center justify-center gap-1"
              >
                <Upload className="w-3.5 h-3.5" /> 备份至云盘
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleWebDavRestore}
                className="flex-1 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold flex items-center justify-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> 从云盘恢复
              </button>
            </div>

            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  const msg = await exportAndShareFile(
                    `简账备份-${new Date().toISOString().slice(0, 10)}.json`,
                    JSON.stringify(db, null, 2)
                  );
                  onToast(msg);
                }}
                className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs"
              >
                导出 JSON 快照
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs"
              >
                导入 JSON 恢复
              </button>
              <button
                type="button"
                onClick={async () => {
                  const msg = await exportAndShareFile(
                    `简账报表-${new Date().toISOString().slice(0, 10)}.csv`,
                    exportDatabaseCsv(db),
                    'text/csv'
                  );
                  onToast(msg);
                }}
                className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs"
              >
                导出 Excel(CSV)
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="*/*"
                onChange={handleJsonImport}
                className="hidden"
              />
            </div>
          </div>

          {/* 3. Calendar Batch Sync */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                📅 批量同步所有会员至系统日历
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5">
                一键写入本机日历或导出 .ics 日历订阅文件
              </div>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={onSyncAllCalendars}
                className="px-3 py-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold flex items-center gap-1"
              >
                <Calendar className="w-3.5 h-3.5" /> 一键同步
              </button>
              <button
                type="button"
                onClick={async () => {
                  const msg = await exportAndShareFile(
                    '简账会员续费提醒.ics',
                    generateIcsForSubscriptions(db.subscriptions),
                    'text/calendar'
                  );
                  onToast(msg);
                }}
                className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs"
              >
                .ics
              </button>
            </div>
          </div>

          {/* 4. Appearance, Cloud AI & Reset */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">🎨 界面外观主题</span>
              <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg text-xs">
                {(
                  [
                    ['system', '跟随系统'],
                    ['light', '浅色'],
                    ['dark', '深色'],
                  ] as Array<[AppSettings['theme'], string]>
                ).map(([t, label]) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, theme: t })}
                    className={`px-2.5 py-1 rounded-md transition ${
                      settings.theme === t
                        ? 'bg-white dark:bg-zinc-900 font-semibold shadow-2xs'
                        : 'text-zinc-500'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  🤖 云端大模型增强解析 (可选)
                </div>
                <div className="text-[11px] text-zinc-400">
                  内置离线语义引擎免配置即用；开启后支持复杂多笔长句拆解
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.ai.enabled}
                onChange={(e) => updateAi({ enabled: e.target.checked })}
                className="w-4 h-4 accent-blue-600"
              />
            </div>

            {settings.ai.enabled && (
              <div className="space-y-2 pt-1">
                <input
                  type="text"
                  value={settings.ai.baseUrl}
                  onChange={(e) => updateAi({ baseUrl: e.target.value })}
                  placeholder="https://api.deepseek.com/v1"
                  className="w-full px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-mono outline-none"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="password"
                    value={settings.ai.apiKey}
                    onChange={(e) => updateAi({ apiKey: e.target.value })}
                    placeholder="API Key (sk-...)"
                    className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-mono outline-none"
                  />
                  <input
                    type="text"
                    value={settings.ai.model}
                    onChange={(e) => updateAi({ model: e.target.value })}
                    placeholder="deepseek-chat"
                    className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs font-mono outline-none"
                  />
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-xs text-zinc-500">清空本地所有账目与记录</span>
              <button
                type="button"
                onClick={() => {
                  if (!confirmReset) {
                    setConfirmReset(true);
                    return;
                  }
                  setConfirmReset(false);
                  onClearDemoData();
                }}
                className={`px-3 py-1 rounded-lg border text-xs flex items-center gap-1 transition ${
                  confirmReset
                    ? 'bg-rose-600 text-white border-rose-600 font-semibold'
                    : 'border-rose-200 dark:border-rose-900 text-rose-600'
                }`}
              >
                <RotateCcw className="w-3 h-3" /> {confirmReset ? '再点确认清空' : '清空数据'}
              </button>
            </div>
          </div>

          {/* 5. GitHub Version & One-Click Update Checker */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-4 border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  📦 版本与 GitHub 更新
                </div>
                <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                  当前版本 v{APP_VERSION} · {GITHUB_REPO}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openExternalLink(`https://github.com/${GITHUB_REPO}/releases`)}
                  className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-300"
                >
                  发布页
                </button>
                <button
                  type="button"
                  disabled={checkingUpdate}
                  onClick={async () => {
                    setCheckingUpdate(true);
                    try {
                      const info = await checkGithubReleaseUpdate();
                      setUpdateInfo(info);
                      onToast(
                        info.hasUpdate
                          ? `发现新版本 v${info.latestVersion}！`
                          : `当前已是最新版本 (v${APP_VERSION})`
                      );
                    } catch (err: unknown) {
                      onToast(err instanceof Error ? err.message : '检查更新失败，请稍后重试');
                    } finally {
                      setCheckingUpdate(false);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold disabled:opacity-50"
                >
                  {checkingUpdate ? '检查中...' : '检查更新'}
                </button>
              </div>
            </div>

            {updateInfo && updateInfo.hasUpdate && (
              <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 space-y-2">
                <div className="text-xs font-bold text-blue-700 dark:text-blue-300">
                  发现 GitHub 新版 v{updateInfo.latestVersion}
                </div>
                {updateInfo.notes && (
                  <div className="text-[11px] text-zinc-600 dark:text-zinc-300 whitespace-pre-line line-clamp-4">
                    {updateInfo.notes}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => openExternalLink(updateInfo.downloadUrl)}
                  className="w-full py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold"
                >
                  下载新版 APK 并覆盖安装
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
