import { useState } from 'react';
import { useStore } from '../store';
import type { Situation } from '../types';
import { DEFAULT_SITUATION_CATEGORY } from '../types';
import { SituationForm } from './SituationForm';

interface Props {
  width: number;
}

export function SituationsSidebar({ width }: Props) {
  const situations = useStore((s) => s.situations);
  const addSituation = useStore((s) => s.addSituation);
  const duplicateSituation = useStore((s) => s.duplicateSituation);
  const updateSituation = useStore((s) => s.updateSituation);
  const deleteSituation = useStore((s) => s.deleteSituation);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Situation | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const groupedSituations = (() => {
    const map = new Map<string, Situation[]>();
    for (const sit of situations) {
      const category = sit.category?.trim() || DEFAULT_SITUATION_CATEGORY;
      const group = map.get(category);
      if (group) {
        group.push(sit);
      } else {
        map.set(category, [sit]);
      }
    }
    return [...map.entries()];
  })();

  return (
    <aside
      className="flex flex-col h-full bg-slate-900 border-r border-slate-800 shrink-0"
      style={{ width }}
    >
      {/* Header */}
      <div className="px-4 py-4 border-b border-slate-800">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Situationen</h2>
        <p className="text-xs text-slate-600 mt-0.5">Finanzielle Bausteine</p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2 space-y-3 px-2">
        {situations.length === 0 && (
          <div className="text-center py-8 text-slate-600 text-sm">
            Noch keine Situationen.<br />Erstelle deine erste!
          </div>
        )}

        {groupedSituations.map(([category, items]) => (
          <div key={category} className="space-y-1">
            <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {category}
            </div>
            {items.map((sit) => (
              <div
                key={sit.id}
                className="group relative rounded-lg p-3 hover:bg-slate-800 transition-colors cursor-default"
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className="w-3 h-3 rounded-full mt-0.5 shrink-0"
                    style={{ backgroundColor: sit.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{sit.name}</div>
                    {sit.description && (
                      <div className="text-xs text-slate-500 truncate mt-0.5">{sit.description}</div>
                    )}
                    <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                      {sit.effects.map((e) => (
                        <div key={e.id} className="flex items-center gap-1">
                          <span
                            className="font-medium"
                            style={{ color: e.category === 'income' ? '#22c55e' : '#fb7185' }}
                          >
                            {e.category === 'income' ? '+' : '-'}
                            {e.amount.toLocaleString('de')} EUR
                          </span>
                          <span className="text-slate-600">
                            {e.type === 'one-time' ? '(einmalig)' : '/Mo.'}
                          </span>
                        </div>
                      ))}
                      {sit.effects.length === 0 && (
                        <span className="text-slate-600 italic">Keine Auswirkungen</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action buttons (visible on hover) */}
                <div className="absolute right-2 top-2 hidden group-hover:flex gap-1">
                  <button
                    className="p-1 rounded text-slate-500 hover:text-emerald-400 hover:bg-slate-700 transition-colors text-xs"
                    onClick={() => duplicateSituation(sit.id)}
                    title="Duplizieren"
                  >
                    ⧉
                  </button>
                  <button
                    className="p-1 rounded text-slate-500 hover:text-blue-400 hover:bg-slate-700 transition-colors text-xs"
                    onClick={() => setEditing(sit)}
                    title="Bearbeiten"
                  >
                    ✎
                  </button>
                  <button
                    className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors text-xs"
                    onClick={() => setConfirmDelete(sit.id)}
                    title="Löschen"
                  >
                    ✕
                  </button>
                </div>

                {/* Inline delete confirm */}
                {confirmDelete === sit.id && (
                  <div className="mt-2 flex gap-2 items-center text-xs">
                    <span className="text-slate-400">Wirklich löschen?</span>
                    <button
                      className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white"
                      onClick={() => {
                        deleteSituation(sit.id);
                        setConfirmDelete(null);
                      }}
                    >
                      Ja
                    </button>
                    <button
                      className="px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
                      onClick={() => setConfirmDelete(null)}
                    >
                      Nein
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Add button */}
      <div className="p-3 border-t border-slate-800">
        <button
          className="w-full py-2 rounded-lg border border-dashed border-slate-700 text-slate-500 hover:border-blue-500 hover:text-blue-400 text-sm transition-colors"
          onClick={() => setShowForm(true)}
        >
          + Neue Situation
        </button>
      </div>

      {/* Modals */}
      {showForm && (
        <SituationForm
          onSave={(s) => {
            addSituation(s);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
      {editing && (
        <SituationForm
          initial={editing}
          onSave={(s) => {
            updateSituation(s.id, s);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </aside>
  );
}
