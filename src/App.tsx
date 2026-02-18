import { useState } from 'react';
import { useStore } from './store';
import { SituationsSidebar } from './components/SituationsSidebar';
import { ScenarioTabs } from './components/ScenarioTabs';
import { ScenarioSettings } from './components/ScenarioSettings';
import { TimelineEditor } from './components/TimelineEditor';
import { BalanceChart } from './components/BalanceChart';
import { ComparisonChart } from './components/ComparisonChart';
import { ImportExportMenu } from './components/ImportExportMenu';

export function App() {
  const compareMode = useStore((s) => s.compareMode);
  const setCompareMode = useStore((s) => s.setCompareMode);
  const scenarios = useStore((s) => s.scenarios);
  const activeScenarioId = useStore((s) => s.activeScenarioId);

  // Overlay: additional scenario IDs rendered on top of the active chart
  const [overlayIds, setOverlayIds] = useState<string[]>([]);
  const toggleOverlay = (id: string) =>
    setOverlayIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Filter out stale IDs (scenario deleted or is now the active one)
  const cleanOverlayIds = overlayIds.filter(
    (id) => id !== activeScenarioId && scenarios.some((s) => s.id === id),
  );

  // Other scenarios that can be overlaid
  const otherScenarios = scenarios.filter((s) => s.id !== activeScenarioId);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-sm">
            📈
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white leading-none">Finanz-Simulator</h1>
            <p className="text-xs text-slate-500 leading-none mt-0.5">Was-wäre-wenn Planung</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ImportExportMenu />
          {scenarios.length > 1 && (
          <button
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              compareMode
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
            onClick={() => setCompareMode(!compareMode)}
          >
            <span>{compareMode ? '← Zurück' : '⇄ Vergleich'}</span>
          </button>
          )}
        </div>
      </header>

      {compareMode ? (
        /* ── Comparison View ── */
        <div className="flex-1 flex flex-col min-h-0 p-4">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-white">Szenariovergleich</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {scenarios.length} Szenarien im Vergleich
            </p>
          </div>
          <div className="flex-1 min-h-0 rounded-xl bg-slate-900 border border-slate-800 p-4">
            <ComparisonChart />
          </div>

          {/* Summary table */}
          <div className="mt-4 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Szenario</th>
                  <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Startkapital</th>
                  <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Dauer</th>
                  <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Situationen</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((sc) => (
                  <tr key={sc.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sc.color }} />
                        <span className="text-white font-medium">{sc.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-300">
                      {sc.initialBalance.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-300">
                      {sc.durationMonths} Mo.
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-300">
                      {new Set(sc.entries.map((e) => e.situationId)).size}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── Editor View ── */
        <div className="flex flex-1 min-h-0">
          {/* Left sidebar */}
          <SituationsSidebar />

          {/* Main panel */}
          <div className="flex flex-col flex-1 min-w-0 min-h-0">
            {/* Scenario tabs */}
            <ScenarioTabs />

            {/* Scenario summary bar */}
            <ScenarioSettings />

            {/* Timeline + Chart split */}
            <div className="flex flex-col flex-1 min-h-0">
              {/* Timeline */}
              <div className="overflow-auto border-b border-slate-800 shrink-0 max-h-72">
                <div className="min-w-0">
                  <div className="px-4 py-2 flex items-center gap-2 border-b border-slate-800/50">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Zeitplan
                    </span>
                  </div>
                  <TimelineEditor />
                </div>
              </div>

              {/* Balance chart */}
              <div className="flex-1 min-h-0 flex flex-col p-4">
                {/* Chart header: label + overlay toggles */}
                <div className="mb-2 flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide shrink-0">
                    Kontostandverlauf
                  </span>
                  {otherScenarios.map((sc) => {
                    const active = cleanOverlayIds.includes(sc.id);
                    return (
                      <button
                        key={sc.id}
                        onClick={() => toggleOverlay(sc.id)}
                        className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs border transition-colors"
                        style={
                          active
                            ? { borderColor: sc.color + 'aa', backgroundColor: sc.color + '22', color: 'white' }
                            : { borderColor: '#334155', color: '#64748b' }
                        }
                        title={active ? `${sc.name} ausblenden` : `${sc.name} einblenden`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: sc.color, opacity: active ? 1 : 0.5 }}
                        />
                        {sc.name}
                      </button>
                    );
                  })}
                </div>

                <div className="flex-1 min-h-0">
                  <BalanceChart overlayScenarioIds={cleanOverlayIds} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
