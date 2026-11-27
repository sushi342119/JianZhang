import React, { useState } from 'react';
import { Bell, ChevronRight, Filter, Trash2, X } from 'lucide-react';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../data/chinaTemplates';
import {
  calcMonthLedgerSummary,
  daysUntilDate,
  getCurrencySymbol,
  getCycleLabel,
  getSubscriptionMonthlyCny,
} from '../core/calculator';
import type { CurrencyCode, LedgerEntry, SubscriptionItem } from '../types';

interface Props {
  monthYm: string;
  entries: LedgerEntry[];
  subscriptions: SubscriptionItem[];
  rates: Record<CurrencyCode, number>;
  onUpdateEntry: (updated: LedgerEntry) => void;
  onDeleteEntry: (id: string) => void;
  onJumpToSubs: () => void;
  onOpenQuickAdd: () => void;
}

export const LedgerView: React.FC<Props> = ({
  monthYm,
  entries,
  subscriptions,
  rates,
  onUpdateEntry,
  onDeleteEntry,
  onJumpToSubs,
  onOpenQuickAdd,
}) => {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const summary = calcMonthLedgerSummary(monthYm, entries);
  const subMonthlyTotal = subscriptions.reduce(
    (acc, s) => acc + getSubscriptionMonthlyCny(s, rates),
    0
  );

  const urgentSubs = subscriptions
    .filter((s) => s.active)
    .map((s) => ({ sub: s, days: daysUntilDate(s.nextRenewalDate) }))
    .filter((x) => x.days >= 0 && x.days <= 7)
    .sort((a, b) => a.days - b.days);

  const filteredEntries = categoryFilter
    ? summary.monthEntries.filter((e) => e.category === categoryFilter)
    : summary.monthEntries;

  const grouped: Array<{ date: string; dayIn: number; dayOut: number; list: LedgerEntry[] }> = [];
  for (const item of filteredEntries) {
    let grp = grouped.find((g) => g.date === item.date);
    if (!grp) {
      grp = { date: item.date, dayIn: 0, dayOut: 0, list: [] };
      grouped.push(grp);
    }
    if (item.type === 'income') grp.dayIn += item.amount;
    else grp.dayOut += item.amount;
    grp.list.push(item);
  }

  const allCats = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
  const findCatMeta = (catName: string, type: 'expense' | 'income') => {
    const found = allCats.find((c) => c.name === catName);
    if (found) return found;
    return type === 'income'
      ? { name: catName, icon: '💰', color: '#16a34a' }
      : { name: catName, icon: '🧾', color: '#64748b' };
  };

  const breakdownList = Object.entries(summary.expenseByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const monthLabel = `${parseInt(monthYm.split('-')[1] || '1', 10)}月`;

  return (
    <div className="space-y-3 pb-6">
      {/* Unified Minimalist Hero Card */}
      <div
        onClick={() => setShowBreakdown((v) => !v)}
        className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-5 shadow-xs transition active:scale-[0.995] cursor-pointer"
      >
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>{monthLabel}实际收支结余 (元)</span>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
            {showBreakdown ? '收起构成 ▲' : '点此看支出构成 ▼'}
          </span>
        </div>

        <div className="mt-1.5 text-3xl font-bold tracking-tight font-mono text-zinc-900 dark:text-zinc-50">
          {summary.netBalance >= 0 ? '+ ' : '- '}¥{Math.abs(summary.netBalance).toFixed(2)}
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4 pt-3.5 border-t border-zinc-100 dark:border-zinc-800/80">
          <div>
            <div className="text-[11px] text-zinc-400 dark:text-zinc-500">已到账收入</div>
            <div className="text-sm font-semibold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
              +¥{summary.totalIncome.toFixed(0)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-400 dark:text-zinc-500">本月总支出</div>
            <div className="text-sm font-semibold font-mono text-zinc-800 dark:text-zinc-200 mt-0.5">
              -¥{summary.totalExpense.toFixed(0)}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-zinc-400 dark:text-zinc-500">会员月均固定</div>
            <div className="text-sm font-semibold font-mono text-zinc-600 dark:text-zinc-300 mt-0.5">
              ¥{subMonthlyTotal.toFixed(1)}
            </div>
          </div>
        </div>

        {showBreakdown && breakdownList.length > 0 && (
          <div className="mt-4 pt-3.5 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2">
            {breakdownList.map(([cat, val]) => {
              const pct = summary.totalExpense > 0 ? Math.round((val / summary.totalExpense) * 100) : 0;
              const meta = findCatMeta(cat, 'expense');
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-600 dark:text-zinc-300">
                      {meta.icon} {cat}
                    </span>
                    <span className="font-mono text-zinc-500 dark:text-zinc-400">
                      ¥{val.toFixed(1)} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(4, pct)}%`, backgroundColor: meta.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quiet Renewal Banner — ONLY visible when an active subscription renews within 7 days */}
      {urgentSubs.length > 0 && (
        <button
          type="button"
          onClick={onJumpToSubs}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/50 text-blue-700 dark:text-blue-300 text-xs"
        >
          <span className="flex items-center gap-2 truncate">
            <Bell className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              <b>{urgentSubs[0].days === 0 ? '今天' : `${urgentSubs[0].days}天后`}</b> ·{' '}
              {urgentSubs[0].sub.name} 续费 {getCurrencySymbol(urgentSubs[0].sub.currency)}
              {urgentSubs[0].sub.price}/{getCycleLabel(urgentSubs[0].sub.cycle)}
              {urgentSubs.length > 1 ? ` 等 ${urgentSubs.length} 项` : ''}
            </span>
          </span>
          <span className="flex items-center font-medium shrink-0 ml-2">
            查看 <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </button>
      )}

      {/* Minimal Section Bar */}
      <div className="flex items-center justify-between px-1 pt-1">
        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          收支明细{categoryFilter ? ` · ${categoryFilter}` : ''}
        </span>
        <button
          type="button"
          onClick={() => {
            if (categoryFilter) setCategoryFilter(null);
            setShowFilterBar((v) => !v);
          }}
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition ${
            categoryFilter || showFilterBar
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
              : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
          }`}
        >
          <Filter className="w-3 h-3" />
          <span>{categoryFilter ? '清除筛选' : '分类筛选'}</span>
        </button>
      </div>

      {showFilterBar && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setCategoryFilter(null)}
            className={`shrink-0 px-2.5 py-1 rounded-full text-xs border ${
              !categoryFilter
                ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900'
                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
            }`}
          >
            全部
          </button>
          {Array.from(new Set(summary.monthEntries.map((e) => e.category))).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-xs border ${
                categoryFilter === cat
                  ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Daily Grouped List */}
      {grouped.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-8 text-center">
          <div className="text-sm text-zinc-500 dark:text-zinc-400">本月还没有账目记录</div>
          <button
            type="button"
            onClick={onOpenQuickAdd}
            className="mt-3 px-4 py-2 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold"
          >
            ✦ 点此记第一笔账
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {grouped.map((grp) => (
            <div
              key={grp.date}
              className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-2 bg-zinc-50/70 dark:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800/70 text-[11px] text-zinc-500 dark:text-zinc-400">
                <span className="font-medium">{grp.date.slice(5)}</span>
                <span className="font-mono space-x-2">
                  {grp.dayIn > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400">收 +¥{grp.dayIn.toFixed(1)}</span>
                  )}
                  {grp.dayOut > 0 && <span>支 -¥{grp.dayOut.toFixed(1)}</span>}
                </span>
              </div>

              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                {grp.list.map((item) => {
                  const meta = findCatMeta(item.category, item.type);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setConfirmDelete(false);
                        setEditingEntry({ ...item });
                      }}
                      className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 active:bg-zinc-100/70 dark:active:bg-zinc-800/70 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                          style={{ backgroundColor: `${meta.color}18`, color: meta.color }}
                        >
                          {meta.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                            {item.category}
                            {item.note ? ` · ${item.note}` : ''}
                            {item.source === 'ai' ? ' · AI快记' : ''}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-sm font-semibold font-mono shrink-0 ml-2 ${
                          item.type === 'income'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-zinc-900 dark:text-zinc-100'
                        }`}
                      >
                        {item.type === 'income' ? '+' : '-'}¥{item.amount.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit / Safe Delete Entry Bottom Sheet */}
      {editingEntry && (
        <div className="fixed inset-0 z-50 bg-black/45 flex flex-col justify-end">
          <div className="bg-white dark:bg-zinc-900 rounded-t-3xl p-5 border-t border-zinc-200 dark:border-zinc-800 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">编辑账单条目</span>
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs text-zinc-500">收支类型</label>
                <select
                  value={editingEntry.type}
                  onChange={(e) => {
                    const nextType = e.target.value as 'expense' | 'income';
                    setEditingEntry({
                      ...editingEntry,
                      type: nextType,
                      category: nextType === 'income' ? '工资奖金' : '餐饮',
                    });
                  }}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm outline-none"
                >
                  <option value="expense">支出</option>
                  <option value="income">收入</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-zinc-500">所属分类</label>
                <select
                  value={editingEntry.category}
                  onChange={(e) => setEditingEntry({ ...editingEntry, category: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm outline-none"
                >
                  {(editingEntry.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-zinc-500">金额 (¥)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingEntry.amount}
                  onChange={(e) =>
                    setEditingEntry({ ...editingEntry, amount: parseFloat(e.target.value) || 0 })
                  }
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm font-mono outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-500">账单日期</label>
                <input
                  type="date"
                  value={editingEntry.date}
                  onChange={(e) => setEditingEntry({ ...editingEntry, date: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm font-mono outline-none"
                />
              </div>

              <div className="col-span-2">
                <label className="text-xs text-zinc-500">名称 / 说明</label>
                <input
                  type="text"
                  value={editingEntry.title}
                  onChange={(e) => setEditingEntry({ ...editingEntry, title: e.target.value })}
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (editingEntry.amount <= 0) return;
                  onUpdateEntry(editingEntry);
                  setEditingEntry(null);
                }}
                className="flex-1 py-2.5 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold"
              >
                保存修改
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!confirmDelete) {
                    setConfirmDelete(true);
                    return;
                  }
                  onDeleteEntry(editingEntry.id);
                  setEditingEntry(null);
                }}
                className={`px-4 py-2.5 rounded-2xl border text-xs font-semibold flex items-center gap-1 transition ${
                  confirmDelete
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'border-rose-200 dark:border-rose-900 text-rose-600'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {confirmDelete ? '再点确认删除' : '删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
