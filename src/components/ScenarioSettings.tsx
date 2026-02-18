import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { formatMonthLong, formatMonthShort, addMonths } from '../utils/months';
import { simulateScenario } from '../simulation';
import { uid } from '../utils/uid';

function formatEur(n: number): string {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export function ScenarioSettings() {
  const situations = useStore((s) => s.situations);
  const scenarios = useStore((s) => s.scenarios);
  const activeScenarioId = useStore((s) => s.activeScenarioId);
  const updateScenario = useStore((s) => s.updateScenario);

  const scenario = scenarios.find((s) => s.id === activeScenarioId);
  if (!scenario) return null;

  const data = simulateScenario(scenario, situations);
  const lastPoint = data.at(-1);
  const endMonth = addMonths(scenario.startMonth, scenario.durationMonths - 1);

  const delta = lastPoint ? lastPoint.balance - scenario.initialBalance : 0;

  const [showSavingsManager, setShowSavingsManager] = useState(false);
  const [newPointMonth, setNewPointMonth] = useState(scenario.startMonth);
  const [newPointBalance, setNewPointBalance] = useState<number>(0);

  useEffect(() => {
    setNewPointMonth(scenario.startMonth);
    setNewPointBalance(0);
    setShowSavingsManager(false);
  }, [scenario.id, scenario.startMonth]);

  const points = useMemo(
    () => [...scenario.savingsBalancePoints].sort((a, b) => a.month.localeCompare(b.month)),
    [scenario.savingsBalancePoints],
  );

  const upsertPoint = (month: string, balance: number) => {
    const existing = scenario.savingsBalancePoints.find((p) => p.month === month);
    const nextPoints = existing
      ? scenario.savingsBalancePoints.map((p) => (p.id === existing.id ? { ...p, month, balance } : p))
      : [...scenario.savingsBalancePoints, { id: uid(), month, balance }];

    updateScenario(scenario.id, {
      savingsBalancePoints: nextPoints.sort((a, b) => a.month.localeCompare(b.month)),
    });
  };

  const removePoint = (id: string) => {
    updateScenario(scenario.id, {
      savingsBalancePoints: scenario.savingsBalancePoints.filter((p) => p.id !== id),
    });
  };

  const addPoint = () => {
    if (!newPointMonth) return;
    upsertPoint(newPointMonth, newPointBalance || 0);
  };

  return (
    <>
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
              <span className="font-semibold" style={{ color: lastPoint.balance >= 0 ? '#22c55e' : '#fb7185' }}>
                {formatEur(lastPoint.balance)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500">
              <span>Veränderung:</span>
              <span className="font-semibold" style={{ color: delta >= 0 ? '#22c55e' : '#fb7185' }}>
                {delta >= 0 ? '+' : ''}
                {formatEur(delta)}
              </span>
            </div>
          </>
        )}

        <div className="ml-auto">
          <button
            className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors"
            onClick={() => setShowSavingsManager(true)}
          >
            IST Tagesgeld verwalten ({points.length})
          </button>
        </div>
      </div>

      {showSavingsManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-slate-800 border border-slate-700 shadow-2xl p-6 space-y-4 max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">IST Tagesgeld-Stand</h2>
                <p className="text-xs text-slate-400 mt-0.5">Szenario: {scenario.name}</p>
              </div>
              <button
                className="px-3 py-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                onClick={() => setShowSavingsManager(false)}
              >
                Schließen
              </button>
            </div>

            <div className="rounded-xl bg-slate-900 border border-slate-700 p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-300 text-sm font-medium">Neuen IST-Punkt erfassen</span>
                <input
                  type="month"
                  className="rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-slate-200"
                  value={newPointMonth}
                  min={scenario.startMonth}
                  max={endMonth}
                  onChange={(e) => setNewPointMonth(e.target.value)}
                />
                <input
                  type="number"
                  className="w-40 rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-slate-200"
                  value={newPointBalance}
                  onChange={(e) => setNewPointBalance(parseFloat(e.target.value) || 0)}
                  placeholder="Betrag in EUR"
                />
                <button
                  className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  onClick={addPoint}
                >
                  Speichern
                </button>
              </div>

              {points.length === 0 ? (
                <p className="text-slate-500 text-sm">Noch keine IST-Punkte vorhanden.</p>
              ) : (
                <div className="space-y-2">
                  {points.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-md bg-slate-950 border border-slate-700 px-3 py-2"
                    >
                      <span className="text-slate-300 min-w-20">{formatMonthShort(p.month)}</span>
                      <input
                        type="number"
                        className="w-44 rounded bg-slate-900 border border-slate-700 px-2 py-1 text-slate-200"
                        value={p.balance}
                        onChange={(e) =>
                          updateScenario(scenario.id, {
                            savingsBalancePoints: scenario.savingsBalancePoints
                              .map((x) => (x.id === p.id ? { ...x, balance: parseFloat(e.target.value) || 0 } : x))
                              .sort((a, b) => a.month.localeCompare(b.month)),
                          })
                        }
                      />
                      <span className="text-slate-500 text-xs">EUR</span>
                      <button
                        className="ml-auto text-red-400 hover:text-red-300"
                        title="IST-Punkt entfernen"
                        onClick={() => removePoint(p.id)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
