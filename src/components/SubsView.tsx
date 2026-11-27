import React, { useEffect, useState } from 'react';
import { Calendar, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { CHINA_SUB_TEMPLATES } from '../data/chinaTemplates';
import {
  advanceRenewalDate,
  daysUntilDate,
  formatYmd,
  getCurrencySymbol,
  getCycleLabel,
  getSubscriptionMonthlyCny,
} from '../core/calculator';
import type {
  BillingCycle,
  ChinaSubTemplate,
  CurrencyCode,
  SubscriptionItem,
} from '../types';

interface Props {
  subscriptions: SubscriptionItem[];
  rates: Record<CurrencyCode, number>;
  defaultRemindDays: number[];
  onUpsertSub: (sub: SubscriptionItem, syncCalendarNow: boolean) => void;
  onDeleteSub: (id: string) => void;
  onRenewOneCycle: (sub: SubscriptionItem, recordExpense: boolean) => void;
  onToggleCalendar: (sub: SubscriptionItem) => void;
  registerChildBackHandler: (fn: (() => boolean) | null) => void;
}

const TEMPLATE_CATS = ['全部', '电商生活', '视频娱乐', '音乐阅读', '云盘效率', 'AI与开发', '通讯账单'] as const;

export const SubsView: React.FC<Props> = ({
  subscriptions,
  rates,
  defaultRemindDays,
  onUpsertSub,
  onDeleteSub,
  onRenewOneCycle,
  onToggleCalendar,
  registerChildBackHandler,
}) => {
  const [showTplDrawer, setShowTplDrawer] = useState(false);
  const [tplCat, setTplCat] = useState<string>('全部');
  const [tplSearch, setTplSearch] = useState('');
  const [editingSub, setEditingSub] = useState<SubscriptionItem | null>(null);
  const [selectedTpl, setSelectedTpl] = useState<ChinaSubTemplate | null>(null);

  useEffect(() => {
    if (editingSub) {
      registerChildBackHandler(() => {
        setEditingSub(null);
        return true;
      });
    } else if (showTplDrawer) {
      registerChildBackHandler(() => {
        setShowTplDrawer(false);
        return true;
      });
    } else {
      registerChildBackHandler(null);
    }
    return () => registerChildBackHandler(null);
  }, [editingSub, showTplDrawer, registerChildBackHandler]);

  const sortedSubs = [...subscriptions].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return daysUntilDate(a.nextRenewalDate) - daysUntilDate(b.nextRenewalDate);
  });

  const monthlyTotal = subscriptions.reduce(
    (acc, s) => acc + getSubscriptionMonthlyCny(s, rates),
    0
  );
  const activeCount = subscriptions.filter((s) => s.active).length;

  const filteredTemplates = CHINA_SUB_TEMPLATES.filter((t) => {
    const matchCat = tplCat === '全部' || t.category === tplCat;
    const matchKw =
      !tplSearch.trim() || t.name.toLowerCase().includes(tplSearch.trim().toLowerCase());
    return matchCat && matchKw;
  });

  const openFromTemplate = (tpl: ChinaSubTemplate, tierIdx = 0) => {
    const tier = tpl.tiers[tierIdx] || tpl.tiers[0];
    const nextDate = advanceRenewalDate(formatYmd(new Date()), tier.cycle, 1);
    setSelectedTpl(tpl);
    setEditingSub({
      id: `sub-${Date.now()}`,
      name: tpl.name,
      category: tpl.category,
      iconText: tpl.iconText,
      brandColor: tpl.brandColor,
      price: tier.price,
      currency: tpl.currency || 'CNY',
      sharedRefund: 0,
      cycle: tier.cycle,
      nextRenewalDate: nextDate,
      autoRenew: true,
      syncSystemCalendar: true,
      remindDays: [...defaultRemindDays],
      active: true,
    });
    setShowTplDrawer(false);
  };

  const openCustomNew = () => {
    setSelectedTpl(null);
    setEditingSub({
      id: `sub-${Date.now()}`,
      name: '',
      category: '视频娱乐',
      iconText: 'VIP',
      brandColor: '#2563eb',
      price: 99,
      currency: 'CNY',
      sharedRefund: 0,
      cycle: 'yearly',
      nextRenewalDate: advanceRenewalDate(formatYmd(new Date()), 'yearly', 1),
      autoRenew: true,
      syncSystemCalendar: true,
      remindDays: [...defaultRemindDays],
      active: true,
    });
    setShowTplDrawer(false);
  };

  const toggleRemindDayInEdit = (day: number) => {
    if (!editingSub) return;
    const exists = editingSub.remindDays.includes(day);
    const next = exists
      ? editingSub.remindDays.filter((d) => d !== day)
      : [...editingSub.remindDays, day].sort((a, b) => b - a);
    setEditingSub({ ...editingSub, remindDays: next });
  };

  return (
    <div className="space-y-3 pb-6">
      {/* Subscription Summary Hero */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>会员订阅月均固定成本</span>
          <button
            type="button"
            onClick={() => setShowTplDrawer(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] font-semibold"
          >
            <Plus className="w-3 h-3" /> 从国内模板添加
          </button>
        </div>

        <div className="mt-1.5 text-3xl font-bold tracking-tight font-mono text-zinc-900 dark:text-zinc-50">
          ¥{monthlyTotal.toFixed(2)}
          <span className="text-xs font-normal text-zinc-400 ml-1">/ 月</span>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4 pt-3.5 border-t border-zinc-100 dark:border-zinc-800/80">
          <div>
            <div className="text-[11px] text-zinc-400 dark:text-zinc-500">年度折合总计</div>
            <div className="text-sm font-semibold font-mono text-zinc-900 dark:text-zinc-100 mt-0.5">
              ¥{(monthlyTotal * 12).toFixed(0)}/年
            </div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-400 dark:text-zinc-500">生效中会员</div>
            <div className="text-sm font-semibold font-mono text-zinc-800 dark:text-zinc-200 mt-0.5">
              {activeCount} 项
            </div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-400 dark:text-zinc-500">多档到期提醒</div>
            <div className="text-sm font-semibold font-mono text-blue-600 dark:text-blue-400 mt-0.5">
              提前{defaultRemindDays.join('/')}天
            </div>
          </div>
        </div>
      </div>

      {/* Quick Top Domestic Template Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setShowTplDrawer(true)}
          className="shrink-0 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/70 dark:border-blue-900 text-xs font-medium"
        >
          📚 全部 30+ 模板库
        </button>
        {CHINA_SUB_TEMPLATES.slice(0, 6).map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => openFromTemplate(tpl)}
            className="shrink-0 px-3 py-1.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300"
          >
            + {tpl.name.replace(/\s*会员|\s*VIP/g, '')}
          </button>
        ))}
      </div>

      {/* Subscription Cards */}
      {sortedSubs.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-8 text-center">
          <div className="text-sm text-zinc-500 dark:text-zinc-400">还没有添加会员订阅</div>
          <button
            type="button"
            onClick={() => setShowTplDrawer(true)}
            className="mt-3 px-4 py-2 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold"
          >
            + 从主流会员模板一键添加
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl divide-y divide-zinc-100 dark:divide-zinc-800/70 overflow-hidden">
          {sortedSubs.map((sub) => {
            const left = daysUntilDate(sub.nextRenewalDate);
            const sym = getCurrencySymbol(sub.currency);
            const monCny = getSubscriptionMonthlyCny(sub, rates);

            return (
              <div
                key={sub.id}
                onClick={() => {
                  setSelectedTpl(CHINA_SUB_TEMPLATES.find((t) => t.name === sub.name) || null);
                  setEditingSub({ ...sub });
                }}
                className={`flex items-center justify-between px-4 py-3.5 cursor-pointer hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition ${
                  !sub.active ? 'opacity-45' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: sub.brandColor }}
                  >
                    {sub.iconText}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {sub.name} {!sub.active && <span className="text-[10px] text-zinc-400">(已暂停)</span>}
                    </div>
                    <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
                      {sym}
                      {sub.price}/{getCycleLabel(sub.cycle)} · 折 ¥{monCny.toFixed(1)}/月
                      {sub.sharedRefund ? ` (拼车回血¥${sub.sharedRefund})` : ''}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-2">
                  <div
                    className={`text-xs font-semibold ${
                      !sub.active
                        ? 'text-zinc-400'
                        : left <= 7
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    {!sub.active
                      ? '已停用'
                      : left === 0
                      ? '今天续费'
                      : left < 0
                      ? `已过期${Math.abs(left)}天`
                      : `${left}天后到期`}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleCalendar(sub);
                    }}
                    className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                      sub.syncSystemCalendar
                        ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900'
                        : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    <Calendar className="w-2.5 h-2.5" />
                    {sub.syncSystemCalendar ? '已写日历' : '+ 写日历'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Domestic Mainstream Templates Picker Modal */}
      {showTplDrawer && (
        <div className="fixed inset-0 z-40 bg-black/45 flex flex-col justify-end">
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl max-h-[82vh] flex flex-col border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  中国主流会员模板库
                </div>
                <div className="text-xs text-zinc-400">点选自动带出图标与常见档位，免手动输入</div>
              </div>
              <button
                type="button"
                onClick={() => setShowTplDrawer(false)}
                className="p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 pt-3 space-y-2.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tplSearch}
                  onChange={(e) => setTplSearch(e.target.value)}
                  placeholder="搜索 B站 / 88VIP / 京东 / 网盘 / 话费..."
                  className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={openCustomNew}
                  className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold shrink-0"
                >
                  + 自定义
                </button>
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {TEMPLATE_CATS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setTplCat(c)}
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium ${
                      tplCat === c
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-y-auto p-4 grid grid-cols-2 gap-2.5">
              {filteredTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => openFromTemplate(tpl)}
                  className="flex items-center gap-2.5 p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 text-left hover:border-blue-500 transition"
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: tpl.brandColor }}
                  >
                    {tpl.iconText}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {tpl.name}
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono truncate">
                      {tpl.currency === 'USD' ? '$' : '¥'}
                      {tpl.tiers[0].price}/{getCycleLabel(tpl.tiers[0].cycle)}起
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Subscription Edit / Confirm Sheet */}
      {editingSub && (
        <div className="fixed inset-0 z-50 bg-black/45 flex flex-col justify-end">
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl p-5 max-h-[88vh] overflow-y-auto border-t border-zinc-200 dark:border-zinc-800 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: editingSub.brandColor }}
                >
                  {editingSub.iconText}
                </div>
                <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {subscriptions.some((s) => s.id === editingSub.id) ? '编辑会员订阅' : '确认添加订阅'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingSub(null)}
                className="p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedTpl && selectedTpl.tiers.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs text-zinc-500">常见价格档位一键选：</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTpl.tiers.map((tier) => (
                    <button
                      key={tier.label}
                      type="button"
                      onClick={() =>
                        setEditingSub({
                          ...editingSub,
                          price: tier.price,
                          cycle: tier.cycle,
                          nextRenewalDate: advanceRenewalDate(formatYmd(new Date()), tier.cycle, 1),
                        })
                      }
                      className={`px-3 py-1.5 rounded-xl text-xs border ${
                        editingSub.price === tier.price && editingSub.cycle === tier.cycle
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold'
                          : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
                      }`}
                    >
                      {tier.label} · {selectedTpl.currency === 'USD' ? '$' : '¥'}
                      {tier.price}/{getCycleLabel(tier.cycle)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <div className="col-span-2">
                <label className="text-xs text-zinc-500">服务名称</label>
                <input
                  type="text"
                  value={editingSub.name}
                  onChange={(e) => setEditingSub({ ...editingSub, name: e.target.value })}
                  placeholder="例如：哔哩哔哩大会员"
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-500">续费金额</label>
                <div className="mt-1 flex gap-1">
                  <select
                    value={editingSub.currency}
                    onChange={(e) =>
                      setEditingSub({ ...editingSub, currency: e.target.value as CurrencyCode })
                    }
                    className="px-2 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs outline-none"
                  >
                    <option value="CNY">¥ CNY</option>
                    <option value="USD">$ USD</option>
                    <option value="HKD">HK$</option>
                    <option value="JPY">JP¥</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={editingSub.price}
                    onChange={(e) =>
                      setEditingSub({ ...editingSub, price: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm font-mono outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-500">计费周期</label>
                <select
                  value={editingSub.cycle}
                  onChange={(e) =>
                    setEditingSub({ ...editingSub, cycle: e.target.value as BillingCycle })
                  }
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm outline-none"
                >
                  <option value="monthly">按月 (包月)</option>
                  <option value="quarterly">按季 (每3个月)</option>
                  <option value="semiannual">半年付</option>
                  <option value="yearly">按年 (包年)</option>
                  <option value="weekly">按周</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-zinc-500">下次到期/续费日</label>
                <input
                  type="date"
                  value={editingSub.nextRenewalDate}
                  onChange={(e) =>
                    setEditingSub({ ...editingSub, nextRenewalDate: e.target.value })
                  }
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm font-mono outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-500">拼车/副卡回血 (¥/期)</label>
                <input
                  type="number"
                  step="0.1"
                  value={editingSub.sharedRefund || ''}
                  onChange={(e) =>
                    setEditingSub({
                      ...editingSub,
                      sharedRefund: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="选填，默认 0"
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm font-mono outline-none"
                />
              </div>
            </div>

            {/* Multi-stage Reminder, System Calendar & Active Status */}
            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  📅 写入安卓手机系统日历提醒
                </span>
                <input
                  type="checkbox"
                  checked={editingSub.syncSystemCalendar}
                  onChange={(e) =>
                    setEditingSub({ ...editingSub, syncSystemCalendar: e.target.checked })
                  }
                  className="w-4 h-4 accent-blue-600"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600 dark:text-zinc-300">
                  生效计费中 (关闭表示已退订/暂停)
                </span>
                <input
                  type="checkbox"
                  checked={editingSub.active}
                  onChange={(e) =>
                    setEditingSub({ ...editingSub, active: e.target.checked })
                  }
                  className="w-4 h-4 accent-emerald-600"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">提前提醒档位</span>
                <div className="flex gap-1.5">
                  {[14, 7, 3, 1].map((d) => {
                    const on = editingSub.remindDays.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleRemindDayInEdit(d)}
                        className={`px-2 py-0.5 rounded-md text-xs border ${
                          on
                            ? 'border-blue-600 bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 font-semibold'
                            : 'border-zinc-200 dark:border-zinc-700 text-zinc-400'
                        }`}
                      >
                        提前{d}天
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {subscriptions.some((s) => s.id === editingSub.id) && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onRenewOneCycle(editingSub, true);
                    setEditingSub(null);
                  }}
                  className="flex-1 py-2 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> 顺延一期并记入账本支出
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteSub(editingSub.id);
                    setEditingSub(null);
                  }}
                  className="px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 text-xs flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> 删除
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (!editingSub.name.trim()) return;
                onUpsertSub(editingSub, editingSub.syncSystemCalendar && editingSub.active);
                setEditingSub(null);
              }}
              className="w-full py-3 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold"
            >
              保存订阅设置
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
