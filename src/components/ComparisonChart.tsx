import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts';
import { useStore } from '../store';
import { simulateScenario } from '../simulation';
import { formatMonthShort, formatMonthLong, monthsBetween, addMonths } from '../utils/months';
import { useT, formatEurLocalized, getLang } from '../utils/i18n';

export function ComparisonChart() {
  const situations = useStore((s) => s.situations);
  const scenarios = useStore((s) => s.scenarios);
  const t = useT();
  const lang = getLang();

  if (scenarios.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-600 text-sm">
        {t('Keine Szenarien vorhanden.')}
      </div>
    );
  }

  // Find global time range
  const allStarts = scenarios.map((s) => s.startMonth);
  const allEnds = scenarios.map((s) => addMonths(s.startMonth, s.durationMonths - 1));
  const globalStart = allStarts.sort()[0];
  const globalEnd = allEnds.sort().at(-1)!;
  const allMonths = monthsBetween(globalStart, globalEnd);

  // Simulate each scenario
  const simulations = scenarios.map((sc) => ({
    scenario: sc,
    data: simulateScenario(sc, situations),
  }));

  // Build unified chart data: one row per month
  const chartData = allMonths.map((month) => {
    const row: Record<string, string | number> = { month };
    for (const { scenario, data } of simulations) {
      const point = data.find((d) => d.month === month);
      row[scenario.id] = point?.balance ?? (undefined as unknown as number);
    }
    return row;
  });

  const allBalances = simulations.flatMap(({ data }) => data.map((d) => d.balance));
  const minBalance = Math.min(...allBalances);
  const maxBalance = Math.max(...allBalances);
  const padding = Math.max((maxBalance - minBalance) * 0.1, 500);
  const negativeFloor = Math.min(0, minBalance - padding);

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
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 shadow-2xl text-xs space-y-1.5 min-w-[180px]">
        <div className="text-slate-300 font-semibold text-sm">{formatMonthLong(label, lang)}</div>
        <div className="border-t border-slate-700 pt-1.5 space-y-1">
          {payload.map((entry) => {
            const sc = scenarios.find((s) => s.id === entry.dataKey);
            if (!sc || entry.value == null) return null;
            return (
              <div key={entry.dataKey} className="flex justify-between gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="text-slate-400">{sc.name}</span>
                </span>
                <span className="font-semibold" style={{ color: entry.value >= 0 ? 'white' : '#fb7185' }}>
                  {formatEurLocalized(entry.value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const CustomLegend = () => (
    <div className="flex gap-6 justify-center flex-wrap mt-2">
      {scenarios.map((sc) => {
        const lastPoint = simulations.find((s) => s.scenario.id === sc.id)?.data.at(-1);
        return (
          <div key={sc.id} className="flex items-center gap-2 text-xs">
            <div className="w-6 h-0.5 rounded" style={{ backgroundColor: sc.color }} />
            <span className="text-slate-400">{sc.name}</span>
            {lastPoint && (
              <span className="font-semibold" style={{ color: lastPoint.balance >= 0 ? sc.color : '#fb7185' }}>
                {formatEurLocalized(lastPoint.balance)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col relative">
      <div className="absolute right-2 top-0 z-10 pointer-events-none">
        <span className="text-[11px] px-2 py-1 rounded-md bg-red-950/80 border border-red-500/60 text-red-200">
          {t('Kritischer Bereich: Kontostand unter 0 EUR')}
        </span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 16, right: 24, left: 16, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={(m) => formatMonthShort(m, lang)}
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
          <ReferenceArea
            y1={negativeFloor}
            y2={0}
            fill="#ef4444"
            fillOpacity={0.12}
            ifOverflow="extendDomain"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
          <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="6 4" strokeWidth={2} />
          {scenarios.map((sc) => (
            <Line
              key={sc.id}
              type="monotone"
              dataKey={sc.id}
              stroke={sc.color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: sc.color, strokeWidth: 0 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
