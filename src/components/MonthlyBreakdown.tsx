import { useEffect, useState } from 'react';
import { useT, getLang, formatEurLocalized } from '../utils/i18n';
import { formatMonthLong, addMonths } from '../utils/months';
import { simulateScenario, getMonthBreakdown } from '../simulation';
import type { Scenario, Situation, SituationLine } from '../types';

interface Props {
  scenario: Scenario;
  situations: Situation[];
}

function SituationBlock({ line, side }: { line: SituationLine; side: 'income' | 'expense' }) {
  const t = useT();
  const effects = line.effects.filter((e) => e.category === side);
  if (effects.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: line.color }} />
        <span className="text-slate-200 text-sm font-medium">{line.name}</span>
      </div>
      <div className="space-y-1 pl-4">
        {effects.map((effect) => (
          <div key={effect.effectId} className="flex items-center justify-between gap-3">
            <span className="text-slate-400 text-xs flex items-center gap-1.5">
              {effect.label}
              {effect.isOneTime && (
                <span className="px-1 py-0.5 rounded text-slate-500 bg-slate-800 text-xs leading-none">
                  {t('(einmalig)')}
                </span>
              )}
            </span>
            <span
              className="text-xs font-mono tabular-nums shrink-0"
              style={{ color: side === 'income' ? '#22c55e' : '#fb7185' }}
            >
              {formatEurLocalized(effect.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MonthlyBreakdown({ scenario, situations }: Props) {
  const t = useT();
  const lang = getLang();
  const endMonth = addMonths(scenario.startMonth, scenario.durationMonths - 1);

  const [selectedMonth, setSelectedMonth] = useState(scenario.startMonth);

  useEffect(() => {
    setSelectedMonth(scenario.startMonth);
  }, [scenario.id, scenario.startMonth]);

  const breakdown = getMonthBreakdown(scenario, situations, selectedMonth);
  const simData = simulateScenario(scenario, situations);
  const monthData = simData.find((d) => d.month === selectedMonth);
  const balance = monthData?.balance ?? scenario.initialBalance;

  const canPrev = selectedMonth > scenario.startMonth;
  const canNext = selectedMonth < endMonth;

  const incomeLines = breakdown.situations.filter((s) => s.totalIncome > 0);
  const expenseLines = breakdown.situations.filter((s) => s.totalExpense > 0);

  const maxTotal = Math.max(breakdown.totalIncome, breakdown.totalExpense, 1);
  const incomeBarPct = (breakdown.totalIncome / maxTotal) * 100;
  const expenseBarPct = (breakdown.totalExpense / maxTotal) * 100;

  return (
    <div className="flex flex-col h-full overflow-auto bg-slate-950 text-xs">
      {/* Month navigator */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button
            className="w-7 h-7 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={() => canPrev && setSelectedMonth(addMonths(selectedMonth, -1))}
            disabled={!canPrev}
            title="←"
          >
            ←
          </button>
          <span className="text-white font-semibold text-sm w-36 text-center">
            {formatMonthLong(selectedMonth, lang)}
          </span>
          <button
            className="w-7 h-7 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={() => canNext && setSelectedMonth(addMonths(selectedMonth, 1))}
            disabled={!canNext}
            title="→"
          >
            →
          </button>
        </div>

        <div className="flex items-center gap-2 text-slate-400">
          <span>{t('Bilanz:')}</span>
          <span
            className="font-semibold text-sm"
            style={{ color: balance >= 0 ? '#22c55e' : '#fb7185' }}
          >
            {formatEurLocalized(balance)}
          </span>
        </div>
      </div>

      {breakdown.situations.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-500">
          {t('Keine aktiven Situationen in diesem Monat.')}
        </div>
      ) : (
        <>
          {/* Two-column breakdown */}
          <div className="grid grid-cols-2 gap-0 flex-1 min-h-0">
            {/* Income column */}
            <div className="border-r border-slate-800 px-6 py-5 overflow-auto">
              <div className="text-xs font-semibold text-green-500 tracking-widest mb-4">
                {t('EINNAHMEN')}
              </div>
              {incomeLines.length === 0 ? (
                <p className="text-slate-600 italic">—</p>
              ) : (
                incomeLines.map((line) => (
                  <SituationBlock key={line.situationId} line={line} side="income" />
                ))
              )}
              <div className="mt-auto pt-4 border-t border-slate-800 flex justify-between items-center">
                <span className="text-slate-500">{t('Gesamt')}</span>
                <span className="text-green-400 font-semibold text-sm">
                  {formatEurLocalized(breakdown.totalIncome)}
                </span>
              </div>
            </div>

            {/* Expense column */}
            <div className="px-6 py-5 overflow-auto">
              <div className="text-xs font-semibold text-rose-500 tracking-widest mb-4">
                {t('AUSGABEN')}
              </div>
              {expenseLines.length === 0 ? (
                <p className="text-slate-600 italic">—</p>
              ) : (
                expenseLines.map((line) => (
                  <SituationBlock key={line.situationId} line={line} side="expense" />
                ))
              )}
              <div className="mt-auto pt-4 border-t border-slate-800 flex justify-between items-center">
                <span className="text-slate-500">{t('Gesamt')}</span>
                <span className="text-rose-400 font-semibold text-sm">
                  {formatEurLocalized(breakdown.totalExpense)}
                </span>
              </div>
            </div>
          </div>

          {/* Proportion bar + Net footer */}
          <div className="border-t border-slate-800 px-6 py-4 space-y-3">
            {/* Proportional bars */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <span className="w-20 text-right text-slate-500 shrink-0">{t('EINNAHMEN')}</span>
                <div className="flex-1 h-3 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all duration-300"
                    style={{ width: `${incomeBarPct}%` }}
                  />
                </div>
                <span className="w-24 text-green-400 text-right shrink-0">
                  {formatEurLocalized(breakdown.totalIncome)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-20 text-right text-slate-500 shrink-0">{t('AUSGABEN')}</span>
                <div className="flex-1 h-3 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-rose-500 transition-all duration-300"
                    style={{ width: `${expenseBarPct}%` }}
                  />
                </div>
                <span className="w-24 text-rose-400 text-right shrink-0">
                  {formatEurLocalized(breakdown.totalExpense)}
                </span>
              </div>
            </div>

            {/* Net */}
            <div className="flex items-center justify-center gap-3 pt-1">
              <span className="text-slate-500 font-medium">{t('Netto')}:</span>
              <span
                className="text-base font-bold"
                style={{ color: breakdown.net >= 0 ? '#22c55e' : '#fb7185' }}
              >
                {breakdown.net >= 0 ? '+' : ''}
                {formatEurLocalized(breakdown.net)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
