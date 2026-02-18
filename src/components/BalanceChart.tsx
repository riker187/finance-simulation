import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { useStore } from '../store';
import { simulateScenario } from '../simulation';
import { formatMonthShort, formatMonthLong, addMonths, monthsBetween } from '../utils/months';
import type { Scenario } from '../types';

interface Props {
  overlayScenarioIds: string[];
}

function formatEur(n: number): string {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function buildChartData(
  visibleScenarios: Scenario[],
  situations: ReturnType<typeof useStore.getState>['situations'],
) {
  type SimEntry = { scenario: Scenario; dataMap: Map<string, { balance: number; income: number; expenses: number; net: number }> };

  const sims: SimEntry[] = visibleScenarios.map((sc) => {
    const rows = simulateScenario(sc, situations);
    const dataMap = new Map(rows.map((r) => [r.month, r]));
    return { scenario: sc, dataMap };
  });

  // Union of all months across all visible scenarios
  const monthSet = new Set<string>();
  for (const { scenario } of sims) {
    const end = addMonths(scenario.startMonth, scenario.durationMonths - 1);
    for (const m of monthsBetween(scenario.startMonth, end)) monthSet.add(m);
  }
  const allMonths = [...monthSet].sort();

  const chartData = allMonths.map((month) => {
    const row: Record<string, string | number> = { month };
    for (const { scenario, dataMap } of sims) {
      const point = dataMap.get(month);
      if (point !== undefined) {
        row[scenario.id] = point.balance;
        // Store detail fields under active scenario key prefix
        row[`${scenario.id}__income`] = point.income;
        row[`${scenario.id}__expenses`] = point.expenses;
        row[`${scenario.id}__net`] = point.net;
      }
    }
    return row;
  });

  const allBalances = sims.flatMap(({ dataMap }) => [...dataMap.values()].map((d) => d.balance));
  const minBalance = allBalances.length ? Math.min(...allBalances) : 0;
  const maxBalance = allBalances.length ? Math.max(...allBalances) : 1000;
  const padding = Math.max((maxBalance - minBalance) * 0.1, 500);

  return { chartData, sims, minBalance, maxBalance, padding };
}

export function BalanceChart({ overlayScenarioIds }: Props) {
  const situations = useStore((s) => s.situations);
  const scenarios = useStore((s) => s.scenarios);
  const activeScenarioId = useStore((s) => s.activeScenarioId);

  const activeScenario = scenarios.find((s) => s.id === activeScenarioId);
  if (!activeScenario) return null;

  // Overlay scenarios that still exist (filter stale IDs)
  const overlayScenarios = overlayScenarioIds
    .filter((id) => id !== activeScenarioId)
    .map((id) => scenarios.find((s) => s.id === id))
    .filter((s): s is Scenario => s !== undefined);

  const visibleScenarios = [activeScenario, ...overlayScenarios];

  const { chartData, minBalance, maxBalance, padding } = buildChartData(visibleScenarios, situations);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-600 text-sm">
        Keine Daten zur Anzeige.
      </div>
    );
  }

  // Tooltip: full detail for active, balance-only for overlays
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

    // Sort: active scenario first
    const sorted = [...payload].sort((a) => (a.dataKey === activeScenarioId ? -1 : 1));
    const row = chartData.find((d) => d.month === label);

    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 shadow-2xl text-xs space-y-2 min-w-[180px]">
        <div className="text-slate-300 font-semibold text-sm">{formatMonthLong(label)}</div>
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
                  <span className="text-slate-400">Kontostand</span>
                  <span className={`font-semibold ${entry.value >= 0 ? 'text-white' : 'text-red-400'}`}>
                    {formatEur(entry.value)}
                  </span>
                </div>
                {isActive && row && (
                  <>
                    <div className="flex justify-between gap-4">
                      <span className="text-green-400">Einnahmen</span>
                      <span className="text-green-400">{formatEur(row[`${sc.id}__income`] as number)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-red-400">Ausgaben</span>
                      <span className="text-red-400">{formatEur(row[`${sc.id}__expenses`] as number)}</span>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-slate-700 pt-0.5">
                      <span className="text-slate-400">Netto</span>
                      {(() => {
                        const net = row[`${sc.id}__net`] as number;
                        return (
                          <span className={net >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {net >= 0 ? '+' : ''}{formatEur(net)}
                          </span>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>
              {overlayScenarios.length > 0 && !isActive && (
                <div className="border-t border-slate-700/50 mt-1" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 24, left: 16, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={formatMonthShort}
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={{ stroke: '#1e293b' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k€`}
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={52}
            domain={[minBalance - padding, maxBalance + padding]}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="#334155" strokeDasharray="4 4" />

          {/* Overlay scenarios — thinner, behind the active line */}
          {overlayScenarios.map((sc) => (
            <Line
              key={sc.id}
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

          {/* Active scenario — bold, on top */}
          <Line
            key={activeScenarioId}
            type="monotone"
            dataKey={activeScenarioId}
            stroke={activeScenario.color}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: activeScenario.color, strokeWidth: 0 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
