import React, { useMemo, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../data/chinaTemplates';
import {
  parseNaturalLanguageLocal,
  parseWithAiOrLocal,
  type ParsedIntent,
} from '../core/aiParser';
import { formatYmd } from '../core/calculator';
import type { AiApiConfig, LedgerType, WorkSettings } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  workSettings: WorkSettings;
  aiConfig: AiApiConfig;
  onCommitParsed: (items: ParsedIntent[]) => void;
  onCommitManualLedger: (entry: {
    date: string;
    type: LedgerType;
    category: string;
    title: string;
    amount: number;
  }) => void;
}

const SAMPLE_PROMPTS = [
  '晚饭吃隆江猪脚饭 22',
  '今天上班8小时 加班2.5小时',
  '刚开了京东Plus 99一年',
  '发兼职设计费 600',
];

export const QuickAddSheet: React.FC<Props> = ({
  open,
  onClose,
  workSettings,
  aiConfig,
  onCommitParsed,
  onCommitManualLedger,
}) => {
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [aiInput, setAiInput] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  // Manual ledger states
  const [ledgerType, setLedgerType] = useState<LedgerType>('expense');
  const [category, setCategory] = useState('餐饮');
  const [amountStr, setAmountStr] = useState('');
  const [titleStr, setTitleStr] = useState('');
  const [dateStr, setDateStr] = useState(formatYmd(new Date()));

  const livePreview = useMemo(() => {
    if (!aiInput.trim()) return null;
    return parseNaturalLanguageLocal(aiInput, workSettings);
  }, [aiInput, workSettings]);

  if (!open) return null;

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim()) return;
    setLoadingAi(true);
    try {
      const items = await parseWithAiOrLocal(aiInput, aiConfig, workSettings);
      onCommitParsed(items);
      setAiInput('');
      onClose();
    } finally {
      setLoadingAi(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amountStr);
    if (!amt || amt <= 0) return;
    onCommitManualLedger({
      date: dateStr,
      type: ledgerType,
      category,
      title: titleStr.trim() || category,
      amount: amt,
    });
    setAmountStr('');
    setTitleStr('');
    onClose();
  };

  const cats = ledgerType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex flex-col justify-end">
      <div className="bg-white dark:bg-zinc-900 rounded-t-3xl p-5 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode('ai')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1 transition ${
                mode === 'ai'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                  : 'text-zinc-500'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> AI 一句话快记
            </button>
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`px-3 py-1.5 rounded-lg transition ${
                mode === 'manual'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                  : 'text-zinc-500'
              }`}
            >
              分类手记收支
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {mode === 'ai' ? (
          <form onSubmit={handleAiSubmit} className="space-y-3">
            <textarea
              rows={2}
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="直接输入或用手机语音说：&#10;例如「午饭牛肉面18」「今天上班8小时加班2小时」「B站大会员108一年」"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-sm outline-none resize-none"
            />

            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_PROMPTS.map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => setAiInput(sp)}
                  className="px-2.5 py-1 rounded-full bg-zinc-50 dark:bg-zinc-800/70 border border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-600 dark:text-zinc-300"
                >
                  {sp}
                </button>
              ))}
            </div>

            {livePreview && (
              <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-900/60 space-y-1">
                <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                  实时智能分流 →{' '}
                  {livePreview.kind === 'work'
                    ? '【工时与加班算薪】'
                    : livePreview.kind === 'sub'
                    ? '【会员订阅 & 日历提醒】'
                    : livePreview.ledgerType === 'income'
                    ? '【日常账本 · 收入】'
                    : '【日常账本 · 支出】'}
                </div>
                <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  {livePreview.summary}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!aiInput.trim() || loadingAi}
              className="w-full py-3 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold disabled:opacity-40"
            >
              {loadingAi ? '正在识别...' : '确认记入'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setLedgerType('expense');
                    setCategory('餐饮');
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    ledgerType === 'expense'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                  }`}
                >
                  支出
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLedgerType('income');
                    setCategory('工资奖金');
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    ledgerType === 'income'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                  }`}
                >
                  收入
                </button>
              </div>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-mono outline-none"
              />
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {cats.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setCategory(c.name)}
                  className={`py-2 rounded-xl flex flex-col items-center gap-0.5 border text-[11px] ${
                    category === c.name
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/50 font-semibold text-blue-600 dark:text-blue-400'
                      : 'border-zinc-200/70 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <span className="text-base">{c.icon}</span>
                  <span>{c.name}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.01"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="金额 (¥)"
                className="px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm font-mono outline-none"
              />
              <input
                type="text"
                value={titleStr}
                onChange={(e) => setTitleStr(e.target.value)}
                placeholder="备注说明 (选填)"
                className="px-3.5 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={!amountStr}
              className="w-full py-3 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-semibold disabled:opacity-40"
            >
              保存账单
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
