<p align="center">
  <img src="./design/icon-a-obsidian.svg" width="96" height="96" alt="简账 App Icon" />
</p>

<h1 align="center">简账 (JianZhang)</h1>

<p align="center">极简三合一个人财务与工时订阅助手 · 日常记账 / 工时补贴算薪 / 国内主流会员提醒</p>

面向中国安卓用户的极简复合工具，将 **日常收支记账**、**工作工时与加班费计算**、**国内主流会员订阅提醒** 融合在同一套克制、干净的三栏界面中。

## 融合借鉴的开源项目

1. **账本与云备份参考**：[BeeCount (蜜蜂记账)](https://github.com/TNT-Likely/BeeCount) —— 本地离线优先存储架构、WebDAV 云盘同步备份与 AI 识账交互思路。
2. **安卓系统日历与多档提醒**：[订阅卫士 SubGuard](https://github.com/Ike-li/subscription-charge-guardian) & [RecurringExpenseTracker](https://github.com/DennisBauer/RecurringExpenseTracker) —— 本机日历账户 (`CalendarContract.ACCOUNT_TYPE_LOCAL`) 写入适配国产安卓系统，支持提前 7/3/1 天多档位提醒与周期月均成本归一化算法。
3. **工时与加班算薪模型**：[TinyTimeTracker](https://github.com/firebirdberlin/tinytimetracker) —— 每日出勤工时记录、实时打卡计时器与「纯时薪制 / 固定月薪+倍率加班费」双模式算薪联动。

## 核心特性

- **极简三栏 + 居中 AI 万能快记**：底栏仅保留 `账本 · ✦快记 · 工时 · 订阅`，一句话自动分流日常收支、加班工时或会员订阅。
- **内置 30+ 中国主流会员模板库**：涵盖 88VIP、京东 PLUS、哔哩哔哩大会员、爱优腾、网易云、WPS、百度/阿里/夸克网盘、iCloud+、话费保号套餐等常见档位一键填入。
- **安卓系统日历写入 + 多档位提醒**：支持一键写入手机原生系统日历并附带提前 7/3/1 天闹钟提醒，同时支持 `.ics` 导出。
- **双模式工时算薪**：支持「纯时薪 × 工时」与「固定月薪 + 平日1.5x / 周末2x / 节假3x 加班费」，保存自动同步账本收入不重记。
- **原生 WebDAV 云盘备份**：原生 HTTP 层直连坚果云、Alist、群晖 NAS 等 WebDAV 服务（无浏览器跨域限制），并支持本地 JSON 快照导入导出与 Excel (CSV) 导出。

## 本地开发与构建 APK

```bash
npm install
npx vitest run
npm run build
npx cap sync android
cd android && ./gradlew assembleRelease
```
