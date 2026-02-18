import { useStore } from '../store';
import { formatMonthLong, addMonths } from '../utils/months';
import { simulateScenario } from '../simulation';

function formatEur(n: number): string {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export function ScenarioSettings() {
  const situations = useStore((s) => s.situations);
  const scenarios = useStore((s) => s.scenarios);
  const activeScenarioId = useStore((s) => s.activeScenarioId);

  const scenario = scenarios.find((s) => s.id === activeScenarioId);
  if (!scenario) return null;

  const data = simulateScenario(scenario, situations);
  const lastPoint = data.at(-1);
  const endMonth = addMonths(scenario.startMonth, scenario.durationMonths - 1);

  const delta = lastPoint ? lastPoint.balance - scenario.initialBalance : 0;

  return (
    <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-6 text-xs flex-wrap">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: scenario.color }} />
        <span className="text-slate-300 font-medium">{scenario.name}</span>
      </div>

      <div className="flex items-center gap-1.5 text-slate-500">
        <span>Start:</span>
        <span className="text-slate-300">{formatMonthLong(scenario.startMonth)}</span>
      </div>
      <div className="flex items-center gap-1.5 text-slate-500">
        <span>Ende:</span>
        <span className="text-slate-300">{formatMonthLong(endMonth)}</span>
      </div>
      <div className="flex items-center gap-1.5 text-slate-500">
        <span>{scenario.durationMonths} Monate</span>
      </div>

      <div className="flex items-center gap-1.5 text-slate-500">
        <span>Startkapital:</span>
        <span className="text-slate-300">{formatEur(scenario.initialBalance)}</span>
      </div>

      {lastPoint && (
        <>
          <div className="flex items-center gap-1.5 text-slate-500">
            <span>Endstand:</span>
            <span
              className="font-semibold"
              style={{ color: lastPoint.balance >= 0 ? '#22c55e' : '#fb7185' }}
            >
              {formatEur(lastPoint.balance)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500">
            <span>Veränderung:</span>
            <span
              className="font-semibold"
              style={{ color: delta >= 0 ? '#22c55e' : '#fb7185' }}
            >
              {delta >= 0 ? '+' : ''}{formatEur(delta)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
