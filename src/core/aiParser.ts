import { CHINA_SUB_TEMPLATES } from '../data/chinaTemplates';
import type {
  AiApiConfig,
  BillingCycle,
  CurrencyCode,
  OvertimeTier,
  WorkSettings,
} from '../types';
import { advanceRenewalDate, calcDailyWorkPay, formatYmd } from './calculator';

export type ParsedIntent =
  | {
      kind: 'ledger';
      ledgerType: 'expense' | 'income';
      category: string;
      title: string;
      amount: number;
      date: string;
      summary: string;
    }
  | {
      kind: 'work';
      date: string;
      regularHours: number;
      overtimeHours: number;
      overtimeTier: OvertimeTier;
      includeMeal: boolean;
      customBonus: number;
      estimatedPay: number;
      note: string;
      summary: string;
    }
  | {
      kind: 'sub';
      name: string;
      category: string;
      iconText: string;
      brandColor: string;
      price: number;
      currency: CurrencyCode;
      cycle: BillingCycle;
      nextRenewalDate: string;
      summary: string;
    };

function resolveDateWord(text: string, baseDate = new Date()): string {
  const d = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  if (text.includes('前天')) {
    d.setDate(d.getDate() - 2);
    return formatYmd(d);
  }
  if (text.includes('昨天') || text.includes('昨日')) {
    d.setDate(d.getDate() - 1);
    return formatYmd(d);
  }
  const mdMatch = text.match(/(\d{1,2})月(\d{1,2})[日号]?/);
  if (mdMatch) {
    const m = parseInt(mdMatch[1], 10);
    const day = parseInt(mdMatch[2], 10);
    if (m >= 1 && m <= 12 && day >= 1 && day <= 31) {
      return formatYmd(new Date(d.getFullYear(), m - 1, day));
    }
  }
  return formatYmd(d);
}

function resolveNextRenewalDate(text: string, cycle: BillingCycle, baseDate = new Date()): string {
  const today = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());

  const mdMatch = text.match(/(\d{1,2})月(\d{1,2})[日号]?/);
  if (mdMatch) {
    const m = parseInt(mdMatch[1], 10);
    const day = parseInt(mdMatch[2], 10);
    if (m >= 1 && m <= 12 && day >= 1 && day <= 31) {
      const candidate = new Date(today.getFullYear(), m - 1, day);
      if (candidate.getTime() < today.getTime()) {
        candidate.setFullYear(candidate.getFullYear() + 1);
      }
      return formatYmd(candidate);
    }
  }

  const domMatch = text.match(/(?:每月\s*(\d{1,2})\s*[日号]?|(\d{1,2})\s*[日号]\s*(?:扣费|扣款|续费|到期))/);
  if (domMatch) {
    const dayOfMonth = parseInt(domMatch[1] || domMatch[2], 10);
    if (dayOfMonth >= 1 && dayOfMonth <= 31) {
      const candidate = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
      if (candidate.getTime() < today.getTime()) {
        candidate.setMonth(candidate.getMonth() + 1);
      }
      return formatYmd(candidate);
    }
  }

  return advanceRenewalDate(formatYmd(today), cycle, 1);
}

function guessExpenseCategory(text: string): string {
  if (/早饭|早餐|午饭|午餐|晚饭|晚餐|外卖|火锅|烧烤|面|饭|粉|食堂|吃|餐厅|肯德基|麦当劳/.test(text)) {
    return '餐饮';
  }
  if (/奶茶|咖啡|瑞幸|星巴克|喜茶|霸王茶姬|蜜雪|零食|水果|饮料|可乐/.test(text)) {
    return '饮品零食';
  }
  if (/打车|滴滴|地铁|公交|高铁|火车|机票|加油|停车|过路费/.test(text)) {
    return '交通';
  }
  if (/房租|水费|电费|燃气|物业|宽带/.test(text)) {
    return '居住水电';
  }
  if (/超市|纸巾|洗衣液|牙膏|日用|菜市场|买菜/.test(text)) {
    return '日用';
  }
  if (/药|医院|挂号|体检|看病/.test(text)) {
    return '医疗健康';
  }
  if (/电影|游戏|Steam|旅游|门票|KTV|演出/.test(text)) {
    return '休闲娱乐';
  }
  if (/红包|请客|礼物|礼金|孝敬/.test(text)) {
    return '人情其他';
  }
  return '购物';
}

export function parseNaturalLanguageLocal(
  raw: string,
  workSettings: WorkSettings,
  today = new Date()
): ParsedIntent {
  const text = raw.trim();
  const date = resolveDateWord(text, today);

  // 1. Work Hours / Overtime / Leave intent
  const isLeaveDay = /^(?:今天|昨天|前天|\d{1,2}月\d{1,2}[日号]?)?\s*(?:请假|调休休息|旷工|没上班|休息)\s*$/.test(text);
  const isWorkIntent =
    isLeaveDay ||
    (/(正班|白班|夜班|上班|工时|加班|打卡|干了\s*\d+(\.\d+)?\s*(个)?小时)/.test(text) &&
      !/会员|VIP|vip|包年|包月/.test(text));

  if (isWorkIntent) {
    if (isLeaveDay) {
      return {
        kind: 'work',
        date,
        regularHours: 0,
        overtimeHours: 0,
        overtimeTier: 'weekday',
        includeMeal: false,
        customBonus: 0,
        estimatedPay: 0,
        note: '请假/休息',
        summary: `记录 ${date} 请假/未出勤 (0h，无餐补，满勤房补将按缺勤天数自动扣减)`,
      };
    }

    let regularHours = 0;
    let overtimeHours = 0;

    const regMatch = text.match(/(?:正班|白班|夜班|上班|工作|干了)\s*(\d+(?:\.\d+)?)\s*(?:个)?(?:小时|h|H)?/);
    const otMatch = text.match(/加班\s*(\d+(?:\.\d+)?)\s*(?:个)?(?:小时|h|H)?/);
    const bonusMatch = text.match(/(?:额外补贴|夜班费|奖金)\s*(\d+(?:\.\d+)?)/);

    if (regMatch) regularHours = parseFloat(regMatch[1]);
    if (otMatch) overtimeHours = parseFloat(otMatch[1]);

    if (!otMatch && regMatch && regularHours > workSettings.standardHoursPerDay && /含加班|连加班/.test(text)) {
      overtimeHours = regularHours - workSettings.standardHoursPerDay;
      regularHours = workSettings.standardHoursPerDay;
    }
    if (!regMatch && !otMatch) {
      const anyNum = text.match(/(\d+(?:\.\d+)?)/);
      if (text.includes('加班')) {
        overtimeHours = anyNum ? parseFloat(anyNum[1]) : 2;
      } else {
        regularHours = anyNum ? parseFloat(anyNum[1]) : 8;
      }
    }

    let overtimeTier: OvertimeTier = 'weekday';
    if (/节假|法定|三倍|3倍|3x/i.test(text)) {
      overtimeTier = 'holiday';
    } else if (/周末|周六|周日|休息日|两倍|双倍|2倍|2x/i.test(text)) {
      overtimeTier = 'weekend';
    }

    const noMeal = /无餐补|不含餐补|没餐补/.test(text);
    const includeMeal = !noMeal && (regularHours > 0 || overtimeHours > 0);
    const customBonus = bonusMatch ? parseFloat(bonusMatch[1]) : 0;

    const payObj = calcDailyWorkPay(
      {
        id: 'preview',
        date,
        regularHours,
        overtimeHours,
        overtimeTier,
        includeMeal,
        customBonus,
      },
      workSettings
    );

    const tierLabel =
      overtimeTier === 'holiday'
        ? `节假日${workSettings.holidayMultiplier}x`
        : overtimeTier === 'weekend'
        ? `周末${workSettings.weekendMultiplier}x`
        : `平日${workSettings.weekdayMultiplier}x`;

    return {
      kind: 'work',
      date,
      regularHours,
      overtimeHours,
      overtimeTier,
      includeMeal,
      customBonus,
      estimatedPay: payObj.totalDailyPay,
      note: text,
      summary: `记录 ${date} 正班 ${regularHours}h + 加班 ${overtimeHours}h (${tierLabel})${
        payObj.mealPay > 0 ? ` + 餐补¥${payObj.mealPay}` : ''
      }，当日 ¥${payObj.totalDailyPay.toFixed(2)}`,
    };
  }

  // 2. Subscription intent
  const matchedTemplate = CHINA_SUB_TEMPLATES.find((tpl) => {
    const keywords = [tpl.name, tpl.name.replace(/\s+/g, '')];
    if (tpl.id === 'bilibili') keywords.push('B站', 'b站', '哔哩', '大会员');
    if (tpl.id === 'tb-88vip') keywords.push('88vip', '88VIP', '淘宝会员');
    if (tpl.id === 'jd-plus') keywords.push('京东plus', '京东Plus', '京东会员', 'plus会员');
    if (tpl.id === 'netease-music') keywords.push('网易云', '黑胶');
    if (tpl.id === 'qq-music') keywords.push('QQ音乐', '绿钻');
    if (tpl.id === 'tencent-video') keywords.push('腾讯视频');
    if (tpl.id === 'iqiyi') keywords.push('爱奇艺');
    if (tpl.id === 'baidu-pan') keywords.push('百度网盘', '度盘');
    if (tpl.id === 'alipan') keywords.push('阿里云盘');
    if (tpl.id === 'quark') keywords.push('夸克');
    if (tpl.id === 'icloud') keywords.push('icloud', 'iCloud');
    if (tpl.id === 'wps') keywords.push('wps', 'WPS');
    if (tpl.id === 'meituan') keywords.push('美团会员', '神会员');
    if (tpl.id === 'mobile-plan') keywords.push('话费套餐', '月租', '扣话费');
    return keywords.some((k) => text.toLowerCase().includes(k.toLowerCase()));
  });

  const isSubIntent =
    Boolean(matchedTemplate) ||
    /(会员|VIP|vip|SVIP|包年|包月|包季|连续包|续费|年卡|月卡|季卡|订阅|每月\s*\d+\s*[日号])/.test(text);

  if (isSubIntent) {
    let cycle: BillingCycle = 'yearly';
    if (/包月|每月|一个月|\/月|月卡|月租/.test(text)) cycle = 'monthly';
    else if (/包季|每季|季度|季卡/.test(text)) cycle = 'quarterly';
    else if (/半年/.test(text)) cycle = 'semiannual';
    else if (/包年|每年|一年|\/年|年卡|年费/.test(text)) cycle = 'yearly';
    else if (matchedTemplate) cycle = matchedTemplate.tiers[0].cycle;

    const cleanedForPrice = text
      .replace(/88\s*vip/gi, 'VIP')
      .replace(/115/g, '')
      .replace(/\d+(?:\.\d+)?\s*(?:GB|G|TB|T|MB|M)\b/gi, '')
      .replace(/\d{1,2}\s*月\s*\d{1,2}\s*[日号]?/g, '')
      .replace(/每月\s*\d{1,2}\s*[日号]?/g, '')
      .replace(/\d{1,2}\s*[日号]\s*(?:扣费|扣款|续费|到期)/g, '');

    const priceMatches = cleanedForPrice.match(/(\d+(?:\.\d+)?)/g);
    const parsedPrice =
      priceMatches && priceMatches.length > 0
        ? parseFloat(priceMatches[priceMatches.length - 1])
        : matchedTemplate
        ? matchedTemplate.tiers[0].price
        : 99;

    const currency: CurrencyCode = /美元|刀|\$|usd/i.test(text)
      ? 'USD'
      : /港币|hk\$|hkd/i.test(text)
      ? 'HKD'
      : matchedTemplate?.currency || 'CNY';

    const name = matchedTemplate
      ? matchedTemplate.name
      : text
          .replace(/刚开了|开通了|续费了|买了|充了|一年|一个月|一季|每年|每月\d*[日号]?|包年|包月|扣费|续费|到期/g, '')
          .replace(/(\d+(?:\.\d+)?)\s*(元|块|块钱|刀|美元|日|号)?/g, '')
          .trim() || '自定义会员';

    const nextRenewalDate = resolveNextRenewalDate(text, cycle, today);

    return {
      kind: 'sub',
      name,
      category: matchedTemplate?.category || '视频娱乐',
      iconText: matchedTemplate?.iconText || name.slice(0, 1).toUpperCase(),
      brandColor: matchedTemplate?.brandColor || '#2563eb',
      price: parsedPrice,
      currency,
      cycle,
      nextRenewalDate,
      summary: `添加订阅「${name}」(${parsedPrice} ${currency}/${
        cycle === 'yearly' ? '年' : cycle === 'monthly' ? '月' : '期'
      })，下次续费 ${nextRenewalDate}，同步系统日历提醒`,
    };
  }

  // 3. Daily Ledger
  const isIncome = /(工资|发薪|奖金|兼职|挣了|赚了|入账|报销|退款|红包收入|转入|回血)/.test(text);
  const cleanedAmountText = text.replace(/\d{1,2}\s*月\s*\d{1,2}\s*[日号]?/g, '');
  const amountMatches = cleanedAmountText.match(/(\d+(?:\.\d+)?)/g);
  const amount = amountMatches ? parseFloat(amountMatches[amountMatches.length - 1]) : 0;

  const cleanTitle =
    text
      .replace(/今天|昨天|前天|刚刚|花了|消费|支出|收入|挣了|赚了|买了|吃了个|吃了/g, '')
      .replace(/\d{1,2}\s*月\s*\d{1,2}\s*[日号]?/g, '')
      .replace(/(\d+(?:\.\d+)?)\s*(块钱|块|元|毛|rmb)?/gi, '')
      .replace(/[，,。.\s]+/g, ' ')
      .trim() || (isIncome ? '日常收入' : '日常消费');

  const category = isIncome
    ? /兼职|副业|外快/.test(text)
      ? '兼职副业'
      : /报销|退款/.test(text)
      ? '报销退款'
      : '工资奖金'
    : guessExpenseCategory(text);

  return {
    kind: 'ledger',
    ledgerType: isIncome ? 'income' : 'expense',
    category,
    title: cleanTitle,
    amount,
    date,
    summary: `${date} · ${isIncome ? '收入' : '支出'} [${category}] ${cleanTitle} ¥${amount.toFixed(2)}`,
  };
}

export async function parseWithAiOrLocal(
  raw: string,
  aiConfig: AiApiConfig,
  workSettings: WorkSettings
): Promise<ParsedIntent[]> {
  if (!aiConfig.enabled || !aiConfig.apiKey.trim()) {
    const parts = raw
      .split(/[；;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return (parts.length > 0 ? parts : [raw]).map((p) => parseNaturalLanguageLocal(p, workSettings));
  }

  try {
    const todayStr = formatYmd(new Date());
    const endpoint = `${aiConfig.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${aiConfig.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: aiConfig.model || 'deepseek-chat',
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content: `你是极简个人账本「简账」的解析助手。今天是 ${todayStr}。请把用户输入拆解为 JSON 数组 {"items":[...]}，每项包含 text 字段（标准化单条短句，如 "昨天午饭猪脚饭 22" 或 "今天上班8小时 加班2小时" 或 "B站大会员 108一年"）。只输出纯 JSON。`,
          },
          { role: 'user', content: raw },
        ],
      }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        return parsed.items.map((it: { text?: string }) =>
          parseNaturalLanguageLocal(it.text || raw, workSettings)
        );
      }
    }
  } catch {
    // Graceful fallback
  }
  return [parseNaturalLanguageLocal(raw, workSettings)];
}
