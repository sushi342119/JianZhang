import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Share } from '@capacitor/share';
import type { AppDatabase, SubscriptionItem, WebDavConfig } from '../types';
import { getCurrencySymbol, getCycleLabel, parseLocalDate } from './calculator';

export interface JianzhangNativePlugin {
  upsertCalendarReminder(options: {
    subId: string;
    existingEventId?: string;
    title: string;
    description: string;
    startTimeMillis: number;
    rrule: string;
    remindMinutes: number[];
  }): Promise<{ eventId: string; calendarName?: string }>;

  removeCalendarReminder(options: { eventId: string }): Promise<{ removed: boolean }>;

  webdavUpload(options: {
    url: string;
    username: string;
    password: string;
    remoteFolder: string;
    fileName: string;
    content: string;
  }): Promise<{ ok: boolean; status: number; message?: string }>;

  webdavDownload(options: {
    url: string;
    username: string;
    password: string;
    remoteFolder: string;
    fileName: string;
  }): Promise<{ ok: boolean; status: number; content?: string; message?: string }>;

  checkLatestRelease(options: { repo: string }): Promise<{
    tagName: string;
    htmlUrl: string;
    downloadUrl: string;
    notes: string;
  }>;

  openExternalUrl(options: { url: string }): Promise<void>;
}

export const APP_VERSION = '1.2.4';
export const GITHUB_REPO = 'sushi342119/JianZhang';

const JianzhangNative = registerPlugin<JianzhangNativePlugin>('JianzhangNative');

function buildRrule(cycle: SubscriptionItem['cycle']): string {
  switch (cycle) {
    case 'weekly':
      return 'FREQ=WEEKLY;INTERVAL=1';
    case 'monthly':
      return 'FREQ=MONTHLY;INTERVAL=1';
    case 'quarterly':
      return 'FREQ=MONTHLY;INTERVAL=3';
    case 'semiannual':
      return 'FREQ=MONTHLY;INTERVAL=6';
    case 'yearly':
    default:
      return 'FREQ=YEARLY;INTERVAL=1';
  }
}

export function generateIcsForSubscriptions(subs: SubscriptionItem[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//JianZhang//Subscription Reminders//CN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:简账·会员续费提醒',
  ];

  for (const s of subs.filter((x) => x.active)) {
    const dt = s.nextRenewalDate.replace(/-/g, '');
    const sym = getCurrencySymbol(s.currency);
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:jianzhang-${s.id}@local`);
    lines.push(`DTSTART;VALUE=DATE:${dt}`);
    lines.push(`SUMMARY:【续费提醒】${s.name} (${sym}${s.price}/${getCycleLabel(s.cycle)})`);
    lines.push(`DESCRIPTION:会员续费提醒：${s.name}，金额 ${sym}${s.price}/${getCycleLabel(s.cycle)}`);
    if (s.autoRenew) {
      lines.push(`RRULE:${buildRrule(s.cycle)}`);
    }
    for (const dayOffset of s.remindDays) {
      lines.push('BEGIN:VALARM');
      lines.push(`TRIGGER:-P${dayOffset}D`);
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:${s.name} 将在 ${dayOffset} 天后续费 (${sym}${s.price})`);
      lines.push('END:VALARM');
    }
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Sync subscription to Android System Calendar via native CalendarContract plugin
 * (falls back to .ics download on web browser preview)
 */
export async function syncSubscriptionToSystemCalendar(
  sub: SubscriptionItem
): Promise<{ synced: boolean; eventId?: string; message: string }> {
  const startDate = parseLocalDate(sub.nextRenewalDate);
  startDate.setHours(9, 30, 0, 0);
  const sym = getCurrencySymbol(sub.currency);
  const title = `【会员续费】${sub.name} ${sym}${sub.price}/${getCycleLabel(sub.cycle)}`;
  const description = `简账自动提醒：${sub.name} 到期/续费日 (${sym}${sub.price})。如不继续使用请提前关闭自动扣费。`;
  const remindMinutes = (sub.remindDays.length ? sub.remindDays : [7, 3, 1]).map((d) => d * 24 * 60);

  if (Capacitor.isNativePlatform()) {
    const res = await JianzhangNative.upsertCalendarReminder({
      subId: sub.id,
      existingEventId: sub.calendarEventId,
      title,
      description,
      startTimeMillis: startDate.getTime(),
      rrule: sub.autoRenew ? buildRrule(sub.cycle) : '',
      remindMinutes,
    });
    return {
      synced: true,
      eventId: res.eventId,
      message: `已写入手机系统日历（提前 ${sub.remindDays.join('/')} 天提醒）`,
    };
  } else {
    // Browser preview fallback: trigger .ics calendar file download
    const ics = generateIcsForSubscriptions([sub]);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sub.name}-续费提醒.ics`;
    a.click();
    URL.revokeObjectURL(url);
    return {
      synced: true,
      eventId: `ics-${sub.id}`,
      message: '已导出日历提醒文件 (.ics)',
    };
  }
}

export async function removeSubscriptionFromSystemCalendar(eventId?: string): Promise<void> {
  if (!eventId || !Capacitor.isNativePlatform()) return;
  try {
    await JianzhangNative.removeCalendarReminder({ eventId });
  } catch {
    // ignore if user already deleted event in system calendar app
  }
}

/**
 * Rebuild multi-stage local notifications (e.g. 7 days, 3 days, 1 day, and renewal morning 09:30)
 */
export async function rescheduleAllSubscriptionNotifications(subs: SubscriptionItem[]): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const req = await LocalNotifications.requestPermissions();
      if (req.display !== 'granted') return;
    }

    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }

    const now = Date.now();
    const notifications: Array<{
      id: number;
      title: string;
      body: string;
      schedule: { at: Date; allowWhileIdle: boolean };
    }> = [];

    let idSeq = 1001;
    for (const sub of subs.filter((s) => s.active)) {
      const renewDate = parseLocalDate(sub.nextRenewalDate);
      renewDate.setHours(9, 30, 0, 0);
      const sym = getCurrencySymbol(sub.currency);

      const offsets = Array.from(new Set([...sub.remindDays, 0])).sort((a, b) => b - a);
      for (const daysBefore of offsets) {
        const triggerTime = new Date(renewDate.getTime() - daysBefore * 86400_000);
        if (triggerTime.getTime() > now + 5_000) {
          notifications.push({
            id: idSeq++,
            title: daysBefore === 0 ? `今日续费提醒：${sub.name}` : `${sub.name} 还有 ${daysBefore} 天续费`,
            body: `本期金额 ${sym}${sub.price}/${getCycleLabel(sub.cycle)}，如无需续订请及时检查自动扣款。`,
            schedule: { at: triggerTime, allowWhileIdle: true },
          });
        }
      }
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  } catch {
    // ignore notification scheduling errors on restricted environments
  }
}

/**
 * WebDAV Cloud Backup & Restore (Jianguoyun / Alist / Nextcloud / Synology)
 */
export async function backupToWebDav(
  cfg: WebDavConfig,
  db: AppDatabase
): Promise<{ ok: boolean; message: string }> {
  if (!cfg.url.trim() || !cfg.username.trim() || !cfg.password.trim()) {
    return { ok: false, message: '请先填写完整的 WebDAV 服务器地址、账号与应用密码' };
  }
  const payload = JSON.stringify(db, null, 2);
  const fileName = 'jianzhang-latest.json';

  if (Capacitor.isNativePlatform()) {
    try {
      const res = await JianzhangNative.webdavUpload({
        url: cfg.url.trim(),
        username: cfg.username.trim(),
        password: cfg.password,
        remoteFolder: cfg.remoteFolder.trim() || 'JianZhangBackup',
        fileName,
        content: payload,
      });
      return {
        ok: res.ok,
        message: res.ok ? '已成功备份至 WebDAV 云盘' : res.message || `备份失败 (HTTP ${res.status})`,
      };
    } catch (err: unknown) {
      return { ok: false, message: err instanceof Error ? err.message : '原生 WebDAV 请求异常' };
    }
  }

  // Browser fallback
  try {
    const base = cfg.url.trim().replace(/\/+$/, '');
    const folder = (cfg.remoteFolder.trim() || 'JianZhangBackup').replace(/^\/+|\/+$/g, '');
    const auth = 'Basic ' + btoa(`${cfg.username.trim()}:${cfg.password}`);
    await fetch(`${base}/${folder}/`, { method: 'MKCOL', headers: { Authorization: auth } }).catch(() => null);
    const resp = await fetch(`${base}/${folder}/${fileName}`, {
      method: 'PUT',
      headers: { Authorization: auth, 'Content-Type': 'application/json; charset=utf-8' },
      body: payload,
    });
    if (resp.ok || resp.status === 201 || resp.status === 204) {
      return { ok: true, message: '已成功备份至 WebDAV 云盘' };
    }
    return { ok: false, message: `云盘返回状态码 ${resp.status}，请检查应用密码与路径` };
  } catch {
    return { ok: false, message: '浏览器环境受跨域限制，安装安卓 APK 后即可直连坚果云等 WebDAV 云盘' };
  }
}

export async function restoreFromWebDav(
  cfg: WebDavConfig
): Promise<{ ok: boolean; db?: AppDatabase; message: string }> {
  if (!cfg.url.trim() || !cfg.username.trim() || !cfg.password.trim()) {
    return { ok: false, message: '请先填写完整的 WebDAV 服务器地址、账号与应用密码' };
  }
  const fileName = 'jianzhang-latest.json';

  if (Capacitor.isNativePlatform()) {
    try {
      const res = await JianzhangNative.webdavDownload({
        url: cfg.url.trim(),
        username: cfg.username.trim(),
        password: cfg.password,
        remoteFolder: cfg.remoteFolder.trim() || 'JianZhangBackup',
        fileName,
      });
      if (res.ok && res.content) {
        const parsed = JSON.parse(res.content) as AppDatabase;
        return { ok: true, db: parsed, message: '已从 WebDAV 云盘恢复全部数据' };
      }
      return { ok: false, message: res.message || `未找到云端备份文件 (HTTP ${res.status})` };
    } catch (err: unknown) {
      return { ok: false, message: err instanceof Error ? err.message : '恢复失败' };
    }
  }

  return { ok: false, message: '请在安卓客户端中使用 WebDAV 云端直连恢复，或使用下方本地 JSON 文件恢复' };
}

export async function exportAndShareFile(
  fileName: string,
  content: string,
  mimeType = 'application/json'
): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const written = await Filesystem.writeFile({
      path: fileName,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: fileName,
      text: '简账数据导出备份',
      url: written.uri,
      dialogTitle: '保存或发送到微信/云盘',
    });
    return '已调起安卓系统保存/分享面板';
  } else {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    return `已下载备份文件 ${fileName}`;
  }
}

function compareSemver(latestTag: string, currentVer: string): number {
  const clean = (s: string) => s.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const a = clean(latestTag);
  const b = clean(currentVer);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return 1;
    if ((a[i] || 0) < (b[i] || 0)) return -1;
  }
  return 0;
}

export async function checkGithubReleaseUpdate(): Promise<{
  hasUpdate: boolean;
  latestVersion: string;
  downloadUrl: string;
  htmlUrl: string;
  notes: string;
}> {
  if (Capacitor.isNativePlatform()) {
    const res = await JianzhangNative.checkLatestRelease({ repo: GITHUB_REPO });
    return {
      hasUpdate: compareSemver(res.tagName, APP_VERSION) > 0,
      latestVersion: res.tagName.replace(/^v/i, ''),
      downloadUrl: res.downloadUrl,
      htmlUrl: res.htmlUrl,
      notes: res.notes,
    };
  }

  const resp = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  const tagName: string = data.tag_name || APP_VERSION;
  const apkAsset = (data.assets || []).find((a: { name?: string }) => a.name?.endsWith('.apk'));
  return {
    hasUpdate: compareSemver(tagName, APP_VERSION) > 0,
    latestVersion: tagName.replace(/^v/i, ''),
    downloadUrl: apkAsset?.browser_download_url || data.html_url,
    htmlUrl: data.html_url,
    notes: data.body || '',
  };
}

export async function openExternalLink(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await JianzhangNative.openExternalUrl({ url });
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
