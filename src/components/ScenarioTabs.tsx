import { useState } from 'react';
import { useStore } from '../store';
import type { Scenario } from '../types';
import { currentMonth } from '../utils/months';
import { SITUATION_COLORS } from '../types';

function ScenarioFormModal({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Scenario;
  onSave: (s: Scenario) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? 'Neues Szenario');
  const [color, setColor] = useState(initial?.color ?? SITUATION_COLORS[1]);
  const [initialBalance, setInitialBalance] = useState(initial?.initialBalance ?? 0);
  const [startMonth, setStartMonth] = useState(initial?.startMonth ?? currentMonth());
  const [durationMonths, setDurationMonths] = useState(initial?.durationMonths ?? 24);

  const handleSave = () => {
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim() || 'Szenario',
      color,
      initialBalance,
      startMonth,
      durationMonths: Math.max(1, durationMonths),
      entries: initial?.entries ?? [],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-slate-800 border border-slate-700 shadow-2xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">
          {initial ? 'Szenario bearbeiten' : 'Neues Szenario'}
        </h2>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Name</label>
          <input
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Farbe</label>
          <div className="flex gap-2 flex-wrap">
            {SITUATION_COLORS.map((c) => (
              <button
                key={c}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${
                  color === c ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Startkapital (€)
            </label>
            <input
              type="number"
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              value={initialBalance}
              onChange={(e) => setInitialBalance(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Dauer (Monate)
            </label>
            <input
              type="number"
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              value={durationMonths}
              onChange={(e) => setDurationMonths(parseInt(e.target.value) || 12)}
              min="1"
              max="120"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            Startmonat
          </label>
          <input
            type="month"
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
          />
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button
            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition-colors"
            onClick={onCancel}
          >
            Abbrechen
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
            onClick={handleSave}
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

export function ScenarioTabs() {
  const scenarios = useStore((s) => s.scenarios);
  const activeScenarioId = useStore((s) => s.activeScenarioId);
  const setActiveScenario = useStore((s) => s.setActiveScenario);
  const addScenario = useStore((s) => s.addScenario);
  const updateScenario = useStore((s) => s.updateScenario);
  const deleteScenario = useStore((s) => s.deleteScenario);

  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Scenario | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const duplicateScenario = (sc: Scenario) => {
    const copy: Scenario = {
      ...sc,
      id: crypto.randomUUID(),
      name: `Kopie von ${sc.name}`,
      entries: sc.entries.map((e) => ({ ...e, id: crypto.randomUUID() })),
    };
    addScenario(copy);
  };

  return (
    <div className="flex items-center gap-1 px-4 py-3 border-b border-slate-800 overflow-x-auto">
      {scenarios.map((sc) => (
        <div key={sc.id} className="relative group">
          <button
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              sc.id === activeScenarioId
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            onClick={() => setActiveScenario(sc.id)}
            onDoubleClick={() => setEditing(sc)}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: sc.color }}
            />
            {sc.name}
          </button>

          {/* Context actions on hover */}
          {sc.id === activeScenarioId && (
            <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5">
              <button
                className="w-4 h-4 rounded-full bg-slate-600 hover:bg-blue-600 text-white text-xs flex items-center justify-center transition-colors leading-none"
                onClick={() => setEditing(sc)}
                title="Bearbeiten"
              >
                ✎
              </button>
              <button
                className="w-4 h-4 rounded-full bg-slate-600 hover:bg-emerald-600 text-white text-xs flex items-center justify-center transition-colors leading-none"
                onClick={() => duplicateScenario(sc)}
                title="Duplizieren"
              >
                ⧉
              </button>
              {scenarios.length > 1 && (
                <button
                  className="w-4 h-4 rounded-full bg-slate-600 hover:bg-red-600 text-white text-xs flex items-center justify-center transition-colors leading-none"
                  onClick={() => setConfirmDelete(sc.id)}
                  title="Löschen"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      <button
        className="px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:text-blue-400 hover:bg-slate-800 transition-colors whitespace-nowrap"
        onClick={() => setShowNew(true)}
      >
        + Szenario
      </button>

      {/* Delete confirm dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4 max-w-sm w-full mx-4">
            <p className="text-white text-sm">Szenario wirklich löschen?</p>
            <div className="flex gap-3 justify-end">
              <button
                className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white"
                onClick={() => setConfirmDelete(null)}
              >
                Abbrechen
              </button>
              <button
                className="px-3 py-1.5 rounded-lg text-sm bg-red-600 hover:bg-red-500 text-white"
                onClick={() => {
                  deleteScenario(confirmDelete);
                  setConfirmDelete(null);
                }}
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {showNew && (
        <ScenarioFormModal
          onSave={(s) => {
            addScenario(s);
            setShowNew(false);
          }}
          onCancel={() => setShowNew(false)}
        />
      )}

      {editing && (
        <ScenarioFormModal
          initial={editing}
          onSave={(s) => {
            updateScenario(s.id, s);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
