import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store';
import type { Situation, FinancialEffect, EffectType, EffectCategory } from '../types';
import { SITUATION_COLORS, DEFAULT_SITUATION_CATEGORY, SITUATION_CATEGORY_SUGGESTIONS } from '../types';
import { uid } from '../utils/uid';

interface Props {
  initial?: Situation;
  onSave: (s: Situation) => void;
  onCancel: () => void;
}

function emptyEffect(base?: Pick<FinancialEffect, 'type' | 'category'>): FinancialEffect {
  return {
    id: uid(),
    label: '',
    type: base?.type ?? 'recurring',
    category: base?.category ?? 'income',
    amount: 0,
  };
}

export function SituationForm({ initial, onSave, onCancel }: Props) {
  const situations = useStore((s) => s.situations);

  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState(initial?.category ?? DEFAULT_SITUATION_CATEGORY);
  const [color, setColor] = useState(initial?.color ?? SITUATION_COLORS[0]);
  const [effects, setEffects] = useState<FinancialEffect[]>(
    initial?.effects.length ? initial.effects : [emptyEffect()],
  );

  const categorySuggestions = useMemo(() => {
    const existing = situations
      .map((s) => s.category?.trim())
      .filter((c): c is string => Boolean(c));

    const merged = [
      ...existing,
      ...SITUATION_CATEGORY_SUGGESTIONS,
      category.trim() || DEFAULT_SITUATION_CATEGORY,
    ];

    const seen = new Set<string>();
    const unique: string[] = [];
    for (const entry of merged) {
      const key = entry.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(entry);
    }
    return unique;
  }, [situations, category]);

  const existingCategories = useMemo(
    () => categorySuggestions.filter((c) => c !== DEFAULT_SITUATION_CATEGORY),
    [categorySuggestions],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  const updateEffect = (id: string, patch: Partial<FinancialEffect>) => {
    setEffects((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const removeEffect = (id: string) => {
    setEffects((prev) => prev.filter((e) => e.id !== id));
  };

  const addEffect = () => {
    setEffects((prev) => {
      const last = prev.at(-1);
      const base = last ? { type: last.type, category: last.category } : undefined;
      return [...prev, emptyEffect(base)];
    });
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const validEffects = effects
      .filter((e) => e.amount > 0)
      .map((e) => ({
        ...e,
        label: e.label.trim() || (e.category === 'income' ? 'Einnahme' : 'Ausgabe'),
      }));
    onSave({
      id: initial?.id ?? uid(),
      name: name.trim(),
      description: description.trim(),
      category: category.trim() || DEFAULT_SITUATION_CATEGORY,
      color,
      effects: validEffects,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-slate-800 border border-slate-700 shadow-2xl p-6 space-y-5">
        <h2 className="text-lg font-semibold text-white">
          {initial ? 'Situation bearbeiten' : 'Neue Situation'}
        </h2>

        {/* Name */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Name</label>
          <input
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Vollzeitjob"
            autoFocus
          />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Beschreibung (optional)</label>
          <input
            className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Kurze Beschreibung"
          />
        </div>

        {/* Category */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Kategorie</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              value=""
              onChange={(e) => {
                if (e.target.value) setCategory(e.target.value);
              }}
            >
              <option value="">Vorhandene Kategorie wählen...</option>
              {existingCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <input
              list="situation-categories"
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Oder neue Kategorie eingeben"
            />
          </div>
          <datalist id="situation-categories">
            {categorySuggestions.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        {/* Color */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Farbe</label>
          <div className="flex gap-2 flex-wrap">
            {SITUATION_COLORS.map((c) => (
              <button
                key={c}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${
                  color === c ? 'border-white scale-110' : 'border-transparent scale-100'
                }`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        {/* Effects */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Finanzielle Auswirkungen</label>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {effects.map((effect) => (
              <div key={effect.id} className="flex gap-2 items-center rounded-lg bg-slate-900 border border-slate-700 p-2">
                <input
                  className="flex-1 min-w-0 bg-transparent text-white text-sm focus:outline-none placeholder-slate-500"
                  value={effect.label}
                  onChange={(e) => updateEffect(effect.id, { label: e.target.value })}
                  placeholder="Bezeichnung"
                />
                <select
                  className="bg-slate-800 border border-slate-600 rounded text-xs text-slate-300 px-1 py-1 focus:outline-none"
                  value={effect.type}
                  onChange={(e) => updateEffect(effect.id, { type: e.target.value as EffectType })}
                >
                  <option value="recurring">monatlich</option>
                  <option value="one-time">einmalig</option>
                </select>
                <select
                  className="bg-slate-800 border border-slate-600 rounded text-xs px-1 py-1 focus:outline-none"
                  value={effect.category}
                  style={{ color: effect.category === 'income' ? '#22c55e' : '#fb7185' }}
                  onChange={(e) => updateEffect(effect.id, { category: e.target.value as EffectCategory })}
                >
                  <option value="income">Einnahme</option>
                  <option value="expense">Ausgabe</option>
                </select>
                <input
                  type="number"
                  className="w-24 bg-transparent text-white text-sm text-right focus:outline-none placeholder-slate-500"
                  value={effect.amount || ''}
                  onChange={(e) => updateEffect(effect.id, { amount: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  min="0"
                />
                <span className="text-slate-500 text-xs">EUR</span>
                <button
                  className="text-slate-600 hover:text-red-400 transition-colors"
                  onClick={() => removeEffect(effect.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            onClick={addEffect}
          >
            + Auswirkung hinzufuegen
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-2">
          <button
            className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition-colors"
            onClick={onCancel}
          >
            Abbrechen
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-40"
            onClick={handleSave}
            disabled={!name.trim()}
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
