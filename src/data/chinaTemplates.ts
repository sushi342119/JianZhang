import type { ChinaSubTemplate } from '../types';

export const CHINA_SUB_TEMPLATES: ChinaSubTemplate[] = [
  // 电商生活
  {
    id: 'tb-88vip',
    name: '淘宝 88VIP',
    category: '电商生活',
    iconText: '88',
    brandColor: '#ff5000',
    tiers: [
      { label: '生活卡年卡', price: 88, cycle: 'yearly' },
      { label: '全能卡年卡', price: 168, cycle: 'yearly' },
    ],
  },
  {
    id: 'jd-plus',
    name: '京东 PLUS 会员',
    category: '电商生活',
    iconText: 'JD',
    brandColor: '#e11d48',
    tiers: [
      { label: '京典年卡', price: 99, cycle: 'yearly' },
      { label: '联名活动价', price: 79, cycle: 'yearly' },
    ],
  },
  {
    id: 'meituan',
    name: '美团神会员',
    category: '电商生活',
    iconText: '美',
    brandColor: '#eab308',
    tiers: [
      { label: '连续包月', price: 15, cycle: 'monthly' },
      { label: '特惠月卡', price: 9.9, cycle: 'monthly' },
    ],
  },
  {
    id: 'eleme',
    name: '饿了么超级吃货卡',
    category: '电商生活',
    iconText: '饿',
    brandColor: '#0284c7',
    tiers: [
      { label: '连续包月', price: 10, cycle: 'monthly' },
      { label: '季卡', price: 28, cycle: 'quarterly' },
    ],
  },
  {
    id: 'pdd',
    name: '拼多多省钱月卡',
    category: '电商生活',
    iconText: '拼',
    brandColor: '#dc2626',
    tiers: [
      { label: '月卡', price: 5.9, cycle: 'monthly' },
      { label: '季卡', price: 15.9, cycle: 'quarterly' },
    ],
  },
  {
    id: 'sams',
    name: '山姆会员商店',
    category: '电商生活',
    iconText: '山',
    brandColor: '#1d4ed8',
    tiers: [
      { label: '普通会员卡', price: 260, cycle: 'yearly' },
      { label: '卓越会员卡', price: 680, cycle: 'yearly' },
    ],
  },
  {
    id: 'hema',
    name: '盒马 X 会员',
    category: '电商生活',
    iconText: '盒',
    brandColor: '#0ea5e9',
    tiers: [{ label: '黄金年卡', price: 258, cycle: 'yearly' }],
  },

  // 视频娱乐
  {
    id: 'bilibili',
    name: '哔哩哔哩大会员',
    category: '视频娱乐',
    iconText: 'B',
    brandColor: '#fb7299',
    tiers: [
      { label: '大促年卡', price: 108, cycle: 'yearly' },
      { label: '连续包年', price: 148, cycle: 'yearly' },
      { label: '连续包月', price: 15, cycle: 'monthly' },
    ],
  },
  {
    id: 'tencent-video',
    name: '腾讯视频 VIP',
    category: '视频娱乐',
    iconText: '腾',
    brandColor: '#2563eb',
    tiers: [
      { label: '连续包年', price: 198, cycle: 'yearly' },
      { label: '连续包月', price: 25, cycle: 'monthly' },
      { label: 'SVIP年卡', price: 348, cycle: 'yearly' },
    ],
  },
  {
    id: 'iqiyi',
    name: '爱奇艺黄金 VIP',
    category: '视频娱乐',
    iconText: '爱',
    brandColor: '#16a34a',
    tiers: [
      { label: '连续包年', price: 218, cycle: 'yearly' },
      { label: '连续包月', price: 25, cycle: 'monthly' },
    ],
  },
  {
    id: 'youku',
    name: '优酷 VIP 会员',
    category: '视频娱乐',
    iconText: '优',
    brandColor: '#0ea5e9',
    tiers: [
      { label: '连续包年', price: 198, cycle: 'yearly' },
      { label: '88VIP赠送(0元记提醒)', price: 0, cycle: 'yearly' },
    ],
  },
  {
    id: 'mango',
    name: '芒果 TV 会员',
    category: '视频娱乐',
    iconText: '芒',
    brandColor: '#f97316',
    tiers: [
      { label: '大促年卡', price: 88, cycle: 'yearly' },
      { label: '连续包月', price: 22, cycle: 'monthly' },
    ],
  },
  {
    id: 'youtube',
    name: 'YouTube Premium',
    category: '视频娱乐',
    iconText: 'YT',
    brandColor: '#dc2626',
    currency: 'USD',
    tiers: [
      { label: '个人月付($)', price: 13.99, cycle: 'monthly' },
      { label: '合租分摊(¥)', price: 15, cycle: 'monthly' },
    ],
  },
  {
    id: 'netflix',
    name: 'Netflix 奈飞',
    category: '视频娱乐',
    iconText: 'N',
    brandColor: '#b91c1c',
    tiers: [
      { label: '4K合租车位(¥)', price: 22, cycle: 'monthly' },
      { label: '港服标准(HK$)', price: 78, cycle: 'monthly' },
    ],
  },

  // 音乐阅读
  {
    id: 'netease-music',
    name: '网易云音乐黑胶 VIP',
    category: '音乐阅读',
    iconText: '云',
    brandColor: '#e11d48',
    tiers: [
      { label: '连续包年', price: 158, cycle: 'yearly' },
      { label: '大促年卡', price: 88, cycle: 'yearly' },
      { label: '连续包月', price: 15, cycle: 'monthly' },
    ],
  },
  {
    id: 'qq-music',
    name: 'QQ 音乐豪华绿钻',
    category: '音乐阅读',
    iconText: 'Q音',
    brandColor: '#10b981',
    tiers: [
      { label: '连续包年', price: 158, cycle: 'yearly' },
      { label: '连续包月', price: 15, cycle: 'monthly' },
    ],
  },
  {
    id: 'apple-music',
    name: 'Apple Music',
    category: '音乐阅读',
    iconText: 'AM',
    brandColor: '#f43f5e',
    tiers: [
      { label: '个人月付', price: 11, cycle: 'monthly' },
      { label: '学生月付', price: 6, cycle: 'monthly' },
      { label: '家庭组月付', price: 17, cycle: 'monthly' },
    ],
  },
  {
    id: 'weread',
    name: '微信读书付费无限卡',
    category: '音乐阅读',
    iconText: '读',
    brandColor: '#0284c7',
    tiers: [
      { label: '年卡', price: 168, cycle: 'yearly' },
      { label: '连续包月', price: 19, cycle: 'monthly' },
    ],
  },
  {
    id: 'zhihu',
    name: '知乎盐选会员',
    category: '音乐阅读',
    iconText: '知',
    brandColor: '#2563eb',
    tiers: [
      { label: '连续包年', price: 198, cycle: 'yearly' },
      { label: '连续包月', price: 19, cycle: 'monthly' },
    ],
  },

  // 云盘效率
  {
    id: 'baidu-pan',
    name: '百度网盘 SVIP',
    category: '云盘效率',
    iconText: '度',
    brandColor: '#2563eb',
    tiers: [
      { label: '周年庆年卡', price: 178, cycle: 'yearly' },
      { label: '连续包年', price: 198, cycle: 'yearly' },
      { label: '连续包月', price: 25, cycle: 'monthly' },
    ],
  },
  {
    id: 'alipan',
    name: '阿里云盘 SVIP',
    category: '云盘效率',
    iconText: '阿',
    brandColor: '#6366f1',
    tiers: [
      { label: '8TB年卡', price: 198, cycle: 'yearly' },
      { label: '连续包月', price: 25, cycle: 'monthly' },
    ],
  },
  {
    id: 'quark',
    name: '夸克网盘 SVIP',
    category: '云盘效率',
    iconText: '夸',
    brandColor: '#4f46e5',
    tiers: [
      { label: '活动年卡', price: 88, cycle: 'yearly' },
      { label: '88VIP赠送', price: 0, cycle: 'yearly' },
    ],
  },
  {
    id: 'wps',
    name: 'WPS 超级会员',
    category: '云盘效率',
    iconText: 'W',
    brandColor: '#ea580c',
    tiers: [
      { label: '超级会员年卡', price: 118, cycle: 'yearly' },
      { label: '大会员年卡', price: 178, cycle: 'yearly' },
    ],
  },
  {
    id: 'icloud',
    name: 'iCloud+ 云存储',
    category: '云盘效率',
    iconText: '☁',
    brandColor: '#0284c7',
    tiers: [
      { label: '50GB', price: 6, cycle: 'monthly' },
      { label: '200GB', price: 21, cycle: 'monthly' },
      { label: '2TB', price: 68, cycle: 'monthly' },
    ],
  },
  {
    id: 'jianguoyun',
    name: '坚果云专业版',
    category: '云盘效率',
    iconText: '坚',
    brandColor: '#16a34a',
    tiers: [{ label: '专业版年付', price: 199.9, cycle: 'yearly' }],
  },

  // AI与开发
  {
    id: 'chatgpt',
    name: 'ChatGPT Plus',
    category: 'AI与开发',
    iconText: 'AI',
    brandColor: '#10b981',
    currency: 'USD',
    tiers: [{ label: 'Plus月付($)', price: 20, cycle: 'monthly' }],
  },
  {
    id: 'claude',
    name: 'Claude Pro',
    category: 'AI与开发',
    iconText: 'Cl',
    brandColor: '#d97706',
    currency: 'USD',
    tiers: [{ label: 'Pro月付($)', price: 20, cycle: 'monthly' }],
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    category: 'AI与开发',
    iconText: 'GH',
    brandColor: '#18181b',
    currency: 'USD',
    tiers: [
      { label: '个人月付($)', price: 10, cycle: 'monthly' },
      { label: '个人年付($)', price: 100, cycle: 'yearly' },
    ],
  },

  // 通讯账单
  {
    id: 'mobile-plan',
    name: '主力手机话费套餐',
    category: '通讯账单',
    iconText: '话',
    brandColor: '#059669',
    tiers: [
      { label: '流量卡月租', price: 29, cycle: 'monthly' },
      { label: '常规套餐', price: 59, cycle: 'monthly' },
      { label: '融合宽带套餐', price: 99, cycle: 'monthly' },
    ],
  },
  {
    id: 'keep-num',
    name: '副卡保号套餐',
    category: '通讯账单',
    iconText: '保',
    brandColor: '#0d9488',
    tiers: [
      { label: '联通/移动保号', price: 8, cycle: 'monthly' },
      { label: '电信无忧卡', price: 5, cycle: 'monthly' },
    ],
  },
  {
    id: 'broadband',
    name: '家庭宽带年费',
    category: '通讯账单',
    iconText: '网',
    brandColor: '#475569',
    tiers: [{ label: '单宽带包年', price: 360, cycle: 'yearly' }],
  },
];

export const EXPENSE_CATEGORIES = [
  { name: '餐饮', icon: '🍜', color: '#ea580c' },
  { name: '购物', icon: '🛍️', color: '#7c3aed' },
  { name: '日用', icon: '🧻', color: '#0284c7' },
  { name: '交通', icon: '🚇', color: '#0d9488' },
  { name: '饮品零食', icon: '☕', color: '#ca8a04' },
  { name: '居住水电', icon: '🏠', color: '#4f46e5' },
  { name: '休闲娱乐', icon: '🎮', color: '#ec4899' },
  { name: '会员扣费', icon: '💳', color: '#2563eb' },
  { name: '医疗健康', icon: '💊', color: '#dc2626' },
  { name: '人情其他', icon: '🎁', color: '#64748b' },
];

export const INCOME_CATEGORIES = [
  { name: '工时薪资', icon: '⏱️', color: '#16a34a' },
  { name: '工资奖金', icon: '💰', color: '#059669' },
  { name: '兼职副业', icon: '💼', color: '#0d9488' },
  { name: '报销退款', icon: '🧾', color: '#0284c7' },
  { name: '其他收入', icon: '✨', color: '#10b981' },
];
