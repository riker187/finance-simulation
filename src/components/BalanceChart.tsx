import {
  ComposedChart,
  Line,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts';
import { useStore } from '../store';
import { simulateScenario } from '../simulation';
import { formatMonthShort, formatMonthLong, addMonths, monthsBetween } from '../utils/months';
import type { Scenario } from '../types';
import { useT, formatEurLocalized, getLang } from '../utils/i18n';

interface Props {
  overlayScenarioIds: string[];
}

function buildChartData(
  activeScenario: Scenario,
  overlayScenarios: Scenario[],
  situations: ReturnType<typeof useStore.getState>['situations'],
) {
  const end = addMonths(activeScenario.startMonth, activeScenario.durationMonths - 1);
  const axisMonths = monthsBetween(activeScenario.startMonth, end);

  const visibleScenarios = [activeScenario, ...overlayScenarios];

  type SimEntry = {
    scenario: Scenario;
    dataMap: Map<string, { balance: number; income: number; expenses: number; net: number; recurringNet: number; balanceMin: number; balanceMax: number }>;
  };

  const sims: SimEntry[] = visibleScenarios.map((sc) => {
    const rows = simulateScenario(sc, situations);
    const dataMap = new Map(rows.map((r) => [r.month, r]));
    return { scenario: sc, dataMap };
  });

  const actualMap = new Map(activeScenario.savingsBalancePoints.map((p) => [p.month, p.balance]));

  // IMPORTANT: use exactly the active scenario's month axis so Timeline and Chart are aligned.
  const chartData = axisMonths.map((month) => {
    const row: Record<string, string | number | undefined> = { month };
    for (const { scenario, dataMap } of sims) {
      const point = dataMap.get(month);
      if (point !== undefined) {
        row[scenario.id] = point.balance;
        row[`${scenario.id}__income`] = point.income;
        row[`${scenario.id}__expenses`] = point.expenses;
        row[`${scenario.id}__net`] = point.net;
        row[`${scenario.id}__recurringNet`] = point.recurringNet;
        row[`${scenario.id}__balanceMin`] = point.balanceMin;
        row[`${scenario.id}__balanceMax`] = point.balanceMax;
      }
    }
    const actual = actualMap.get(month);
    if (actual !== undefined) row.__actual = actual;
    return row;
  });

  const allBalanceValues = chartData.flatMap((row) =>
    visibleScenarios
      .map((s) => row[s.id])
      .filter((v): v is number => typeof v === 'number'),
  );

  const minBalance = allBalanceValues.length ? Math.min(...allBalanceValues) : 0;
  const maxBalance = allBalanceValues.length ? Math.max(...allBalanceValues) : 1000;
  const padding = Math.max((maxBalance - minBalance) * 0.1, 500);

  const activeNetValues = chartData
    .map((row) => row[`${activeScenario.id}__net`])
    .filter((v): v is number => typeof v === 'number');

  const maxAbsTransfer = Math.max(500, ...activeNetValues.map((n) => Math.abs(n)));

  return { chartData, minBalance, maxBalance, padding, maxAbsTransfer, visibleScenarios };
}

export function BalanceChart({ overlayScenarioIds }: Props) {
  const situations = useStore((s) => s.situations);
  const scenarios = useStore((s) => s.scenarios);
  const activeScenarioId = useStore((s) => s.activeScenarioId);
  const t = useT();

  const activeScenario = scenarios.find((s) => s.id === activeScenarioId);
  if (!activeScenario) return null;

  const lang = getLang();

  const overlayScenarios = overlayScenarioIds
    .filter((id) => id !== activeScenarioId)
    .map((id) => scenarios.find((s) => s.id === id))
    .filter((s): s is Scenario => s !== undefined);

  const { chartData, minBalance, maxBalance, padding, maxAbsTransfer, visibleScenarios } = buildChartData(
    activeScenario,
    overlayScenarios,
    situations,
  );

  const negativeFloor = Math.min(0, minBalance - padding);

  // Consecutive phases with recurringNet >= 0 (sustainable)
  const sustainableRanges: { x1: string; x2: string }[] = [];
  {
    const key = `${activeScenarioId}__recurringNet`;
    let rangeStart: string | null = null;
    for (let i = 0; i < chartData.length; i++) {
      const val = chartData[i][key];
      const sustainable = typeof val === 'number' && val >= 0;
      if (sustainable && rangeStart === null) rangeStart = chartData[i].month as string;
      if (!sustainable && rangeStart !== null) {
        sustainableRanges.push({ x1: rangeStart, x2: chartData[i - 1].month as string });
        rangeStart = null;
      }
    }
    if (rangeStart !== null) {
      sustainableRanges.push({ x1: rangeStart, x2: chartData[chartData.length - 1].month as string });
    }
  }

  // Sensitivity band: visible when balanceMin !== balanceMax somewhere
  const hasVariance = chartData.some((row) => {
    const lo = row[`${activeScenarioId}__balanceMin`];
    const hi = row[`${activeScenarioId}__balanceMax`];
    return typeof lo === 'number' && typeof hi === 'number' && lo !== hi;
  });

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
        {t('Keine Daten zur Anzeige.')}
      </div>
    );
  }

  const CustomTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: { dataKey: string; value: number; color: string }[];
    label?: string;
  }) => {
    if (!active || !payload?.length || !label) return null;

    const filtered = payload.filter((p) => !String(p.dataKey).endsWith('__net'));
    const sorted = [...filtered].sort((a) => (a.dataKey === activeScenarioId ? -1 : 1));
    const row = chartData.find((d) => d.month === label);

    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 shadow-2xl text-xs space-y-2 min-w-[220px]">
        <div className="text-slate-300 font-semibold text-sm">{formatMonthLong(label, lang)}</div>

        {row && typeof row.__actual === 'number' && (
          <div className="flex justify-between gap-4 border-b border-slate-700 pb-1">
            <span className="text-cyan-300">{t('IST Tagesgeld')}</span>
            <span className="text-cyan-300 font-semibold">{formatEurLocalized(row.__actual)}</span>
          </div>
        )}

        {sorted.map((entry) => {
          const sc = visibleScenarios.find((s) => s.id === entry.dataKey);
          if (!sc || entry.value == null) return null;
          const isActive = sc.id === activeScenarioId;
          return (
            <div key={entry.dataKey} className={`space-y-0.5 ${isActive ? '' : 'opacity-80'}`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sc.color }} />
                <span className="text-slate-400 font-medium">{sc.name}</span>
              </div>
              <div className="pl-3.5 space-y-0.5">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-400">{t('Kontostand')}</span>
                  <span className={`font-semibold ${entry.value >= 0 ? 'text-white' : 'text-red-400'}`}>
                    {formatEurLocalized(entry.value)}
                  </span>
                </div>
                {entry.value < 0 && (
                  <div className="text-red-300 text-[11px] font-medium">{t('Kritischer Bereich: unter 0 EUR')}</div>
                )}
                {isActive && row && (
                  <>
                    <div className="flex justify-between gap-4">
                      <span className="text-green-400">{t('Einnahmen')}</span>
                      <span className="text-green-400">{formatEurLocalized(row[`${sc.id}__income`] as number)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-red-400">{t('Ausgaben')}</span>
                      <span className="text-red-400">{formatEurLocalized(row[`${sc.id}__expenses`] as number)}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-slate-700 pt-0.5">
                      <span className="text-slate-300">{t('Tagesgeld-Transfer')}</span>
                      {(() => {
                        const net = row[`${sc.id}__net`] as number;
                        const positive = net >= 0;
                        return (
                          <span className={positive ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                            {positive ? '↗ + ' : '↘ - '}
                            {formatEurLocalized(Math.abs(net))}
                          </span>
                        );
                      })()}
                    </div>
                    {(() => {
                      const rn = row[`${sc.id}__recurringNet`] as number;
                      const ok = rn >= 0;
                      return (
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-400">{t('Nachhaltig')}</span>
                          <span className={ok ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                            {ok ? t('Ja') : t('Nein')} ({ok ? '+' : ''}{formatEurLocalized(rn)})
                          </span>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
              {overlayScenarios.length > 0 && !isActive && <div className="border-t border-slate-700/50 mt-1" />}
            </div>
          );
        })}
      </div>
    );
  };

  const transferKey = `${activeScenarioId}__net`;

  return (
    <div className="w-full h-full relative">
      <div className="absolute right-2 top-1 z-10 pointer-events-none flex flex-col items-end gap-1">
        <span className="text-[11px] px-2 py-1 rounded-md bg-red-950/80 border border-red-500/60 text-red-200">
          {t('Kritischer Bereich: Kontostand unter 0 EUR')}
        </span>
        <span className="text-[11px] px-2 py-1 rounded-md bg-green-950/80 border border-green-500/60 text-green-200">
          {t('Grün = nachhaltig (ohne Einmal-Ereignisse)')}
        </span>
        {typeof activeScenario.goalBalance === 'number' && (
          <span className="text-[11px] px-2 py-1 rounded-md bg-amber-950/80 border border-amber-500/60 text-amber-200">
            {t('Amber = Zielkontostand')}
          </span>
        )}
        {hasVariance && (
          <span className="text-[11px] px-2 py-1 rounded-md bg-slate-900/90 border border-slate-600 text-slate-400">
            {t('Gestrichelt = Sensitivitätsband')}
          </span>
        )}
        <span className="text-[11px] px-2 py-1 rounded-md bg-slate-900/90 border border-slate-700 text-slate-300">
          {t('Balken = Monats-Transfer Tagesgeld')}
        </span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 24, left: 16, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={(m) => formatMonthShort(m, lang)}
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={{ stroke: '#1e293b' }}
            tickLine={false}
            interval={0}
          />
          <YAxis
            yAxisId="balance"
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k€`}
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={52}
            domain={[minBalance - padding, maxBalance + padding]}
          />
          <YAxis
            yAxisId="transfer"
            orientation="right"
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={42}
            domain={[-maxAbsTransfer, maxAbsTransfer]}
          />
          {sustainableRanges.map((r, i) => (
            <ReferenceArea
              key={`sustainable-${i}`}
              yAxisId="balance"
              x1={r.x1}
              x2={r.x2}
              fill="#22c55e"
              fillOpacity={0.07}
              ifOverflow="hidden"
            />
          ))}
          <ReferenceArea
            yAxisId="balance"
            y1={negativeFloor}
            y2={0}
            fill="#ef4444"
            fillOpacity={0.12}
            ifOverflow="extendDomain"
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine yAxisId="balance" y={0} stroke="#ef4444" strokeDasharray="6 4" strokeWidth={2} />
          {typeof activeScenario.goalBalance === 'number' && (
            <ReferenceLine
              yAxisId="balance"
              y={activeScenario.goalBalance}
              stroke="#f59e0b"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{ value: t('Ziel: {amount}', { amount: formatEurLocalized(activeScenario.goalBalance) }), position: 'insideTopRight', fontSize: 10, fill: '#f59e0b' }}
            />
          )}
          {(activeScenario.annotations ?? []).map((ann) => (
            <ReferenceLine
              key={ann.id}
              yAxisId="balance"
              x={ann.month}
              stroke="#94a3b8"
              strokeDasharray="3 3"
              strokeWidth={1}
              label={(props: { viewBox?: { x?: number; y?: number } }) => {
                const x = (props.viewBox?.x ?? 0) + 4;
                const y = (props.viewBox?.y ?? 0) + 14;
                return (
                  <text x={x} y={y} fill="#94a3b8" fontSize={10} textAnchor="start">
                    {ann.text}
                  </text>
                );
              }}
            />
          ))}

          <Bar yAxisId="transfer" dataKey={transferKey} barSize={10} maxBarSize={12} radius={[2, 2, 2, 2]}>
            {chartData.map((entry, index) => {
              const value = entry[transferKey];
              const positive = typeof value === 'number' ? value >= 0 : true;
              return <Cell key={`cell-${index}`} fill={positive ? '#22c55e' : '#ef4444'} fillOpacity={0.65} />;
            })}
          </Bar>

          {overlayScenarios.map((sc) => (
            <Line
              key={sc.id}
              yAxisId="balance"
              type="monotone"
              dataKey={sc.id}
              stroke={sc.color}
              strokeWidth={1.5}
              strokeOpacity={0.6}
              dot={false}
              activeDot={{ r: 4, fill: sc.color, strokeWidth: 0 }}
              connectNulls={false}
            />
          ))}

          <Line
            yAxisId="balance"
            key={activeScenarioId}
            type="monotone"
            dataKey={activeScenarioId}
            stroke={activeScenario.color}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: activeScenario.color, strokeWidth: 0 }}
            connectNulls={false}
          />
          {hasVariance && (
            <>
              <Line
                yAxisId="balance"
                type="monotone"
                dataKey={`${activeScenarioId}__balanceMin`}
                stroke={activeScenario.color}
                strokeWidth={1}
                strokeDasharray="3 3"
                strokeOpacity={0.4}
                dot={false}
                connectNulls={false}
              />
              <Line
                yAxisId="balance"
                type="monotone"
                dataKey={`${activeScenarioId}__balanceMax`}
                stroke={activeScenario.color}
                strokeWidth={1}
                strokeDasharray="3 3"
                strokeOpacity={0.4}
                dot={false}
                connectNulls={false}
              />
            </>
          )}

          <Line
            yAxisId="balance"
            type="linear"
            dataKey="__actual"
            stroke="#67e8f9"
            strokeDasharray="4 4"
            strokeWidth={2}
            dot={{ r: 4, fill: '#67e8f9', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#67e8f9', strokeWidth: 0 }}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
