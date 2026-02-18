import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Situation, Scenario, ScenarioEntry, ScenarioEffectEntry } from './types';
import { DEFAULT_SITUATION_CATEGORY } from './types';
import { currentMonth, addMonths, monthsToRanges, rangeToMonths } from './utils/months';
import { uid } from './utils/uid';
import { logAuditEntry, logDebounced } from './utils/auditLog';

function normalizeSituation(s: Situation): Situation {
  const category = typeof s.category === 'string' ? s.category.trim() : '';
  return {
    ...s,
    category: category || DEFAULT_SITUATION_CATEGORY,
  };
}

function normalizeSituations(situations: Situation[]): Situation[] {
  return situations.map((s) => normalizeSituation(s));
}

function normalizeScenario(sc: Scenario): Scenario {
  return {
    ...sc,
    effectEntries: Array.isArray(sc.effectEntries) ? sc.effectEntries : [],
    savingsBalancePoints: Array.isArray(sc.savingsBalancePoints) ? sc.savingsBalancePoints : [],
  };
}

function normalizeScenarios(scenarios: Scenario[]): Scenario[] {
  return scenarios.map((s) => normalizeScenario(s));
}

function normalizeData(data: { situations: Situation[]; scenarios: Scenario[] }) {
  return {
    situations: normalizeSituations(data.situations),
    scenarios: normalizeScenarios(data.scenarios),
  };
}


function convertLegacyEffectEntriesToDisabled(scenarios: Scenario[]): Scenario[] {
  return scenarios.map((scenario) => {
    if (!Array.isArray(scenario.effectEntries) || scenario.effectEntries.length === 0) {
      return scenario;
    }

    const situationActiveMonths = new Map<string, Set<string>>();
    for (const entry of scenario.entries) {
      let set = situationActiveMonths.get(entry.situationId);
      if (!set) {
        set = new Set<string>();
        situationActiveMonths.set(entry.situationId, set);
      }
      for (const month of rangeToMonths(entry.startMonth, entry.endMonth)) {
        set.add(month);
      }
    }

    const grouped = new Map<string, ScenarioEffectEntry[]>();
    for (const entry of scenario.effectEntries) {
      const key = `${entry.situationId}::${entry.effectId}`;
      const list = grouped.get(key);
      if (list) {
        list.push(entry);
      } else {
        grouped.set(key, [entry]);
      }
    }

    const disabledEntries: ScenarioEffectEntry[] = [];

    for (const [key, entries] of grouped.entries()) {
      const [situationId, effectId] = key.split('::');
      const activeSituation = situationActiveMonths.get(situationId) ?? new Set<string>();
      const legacyActiveOverride = activeMonthsFromEntries(entries);

      const disabledMonths = new Set<string>();
      for (const month of activeSituation) {
        if (!legacyActiveOverride.has(month)) {
          disabledMonths.add(month);
        }
      }

      disabledEntries.push(...toScenarioEffectEntries(situationId, effectId, disabledMonths));
    }

    return {
      ...scenario,
      effectEntries: disabledEntries,
    };
  });
}
function activeMonthsFromEntries(entries: { startMonth: string; endMonth: string }[]): Set<string> {
  const set = new Set<string>();
  for (const entry of entries) {
    for (const month of rangeToMonths(entry.startMonth, entry.endMonth)) {
      set.add(month);
    }
  }
  return set;
}

function toScenarioEntries(situationId: string, months: Set<string>): ScenarioEntry[] {
  const ranges = monthsToRanges([...months]);
  return ranges.map((range) => ({
    id: uid(),
    situationId,
    startMonth: range.startMonth,
    endMonth: range.endMonth,
  }));
}

function toScenarioEffectEntries(
  situationId: string,
  effectId: string,
  months: Set<string>,
): ScenarioEffectEntry[] {
  const ranges = monthsToRanges([...months]);
  return ranges.map((range) => ({
    id: uid(),
    situationId,
    effectId,
    startMonth: range.startMonth,
    endMonth: range.endMonth,
  }));
}

// ── Sample data ───────────────────────────────────────────────────────────────

function buildSampleData(): { situations: Situation[]; scenarios: Scenario[] } {
  const start = currentMonth();

  const sit1: Situation = {
    id: 'sit-vollzeit',
    name: 'Vollzeitjob',
    description: 'Monatliches Gehalt aus Vollzeitanstellung',
    category: 'Einkommen',
    color: '#4f8aff',
    effects: [{ id: uid(), label: 'Gehalt', type: 'recurring', category: 'income', amount: 3200 }],
  };
  const sit2: Situation = {
    id: 'sit-miete',
    name: 'Miete',
    description: 'Monatliche Kaltmiete inkl. Nebenkosten',
    category: 'Fixkosten',
    color: '#fb7185',
    effects: [{ id: uid(), label: 'Miete', type: 'recurring', category: 'expense', amount: 900 }],
  };
  const sit3: Situation = {
    id: 'sit-leben',
    name: 'Lebenshaltung',
    description: 'Lebensmittel, Freizeit, Kleidung etc.',
    category: 'Variable Kosten',
    color: '#f97316',
    effects: [{ id: uid(), label: 'Lebenshaltung', type: 'recurring', category: 'expense', amount: 600 }],
  };
  const sit4: Situation = {
    id: 'sit-teilzeit',
    name: 'Teilzeitjob',
    description: 'Einkommen aus Teilzeitarbeit',
    category: 'Einkommen',
    color: '#06b6d4',
    effects: [{ id: uid(), label: 'Gehalt (Teilzeit)', type: 'recurring', category: 'income', amount: 1400 }],
  };
  const sit5: Situation = {
    id: 'sit-auto',
    name: 'Autokauf',
    description: 'Einmaliger Fahrzeugkauf',
    category: 'Einmalige Ereignisse',
    color: '#f59e0b',
    effects: [{ id: uid(), label: 'Kaufpreis', type: 'one-time', category: 'expense', amount: 12000 }],
  };
  const sit6: Situation = {
    id: 'sit-steuer',
    name: 'Steuerrückzahlung',
    description: 'Jährliche Steuererstattung',
    category: 'Einmalige Ereignisse',
    color: '#22c55e',
    effects: [{ id: uid(), label: 'Erstattung', type: 'one-time', category: 'income', amount: 1500 }],
  };

  const end24 = addMonths(start, 23);

  const scen1: Scenario = {
    id: 'scen-status-quo',
    name: 'Status Quo',
    color: '#4f8aff',
    initialBalance: 8000,
    startMonth: start,
    durationMonths: 24,
    entries: [
      { id: uid(), situationId: sit1.id, startMonth: start, endMonth: end24 },
      { id: uid(), situationId: sit2.id, startMonth: start, endMonth: end24 },
      { id: uid(), situationId: sit3.id, startMonth: start, endMonth: end24 },
    ],
    effectEntries: [],
    savingsBalancePoints: [],
  };

  const switchMonth = addMonths(start, 6);
  const scen2: Scenario = {
    id: 'scen-jobwechsel',
    name: 'Jobwechsel',
    color: '#22c55e',
    initialBalance: 8000,
    startMonth: start,
    durationMonths: 24,
    entries: [
      { id: uid(), situationId: sit1.id, startMonth: start, endMonth: addMonths(start, 5) },
      { id: uid(), situationId: sit4.id, startMonth: switchMonth, endMonth: end24 },
      { id: uid(), situationId: sit2.id, startMonth: start, endMonth: end24 },
      { id: uid(), situationId: sit3.id, startMonth: start, endMonth: end24 },
    ],
    effectEntries: [],
    savingsBalancePoints: [],
  };

  const steuerMonth = addMonths(start, 2);
  const autoMonth = addMonths(start, 5);
  const scen3: Scenario = {
    id: 'scen-auszeit',
    name: 'Auszeit',
    color: '#a78bfa',
    initialBalance: 8000,
    startMonth: start,
    durationMonths: 24,
    entries: [
      { id: uid(), situationId: sit2.id, startMonth: start, endMonth: end24 },
      { id: uid(), situationId: sit3.id, startMonth: start, endMonth: end24 },
      { id: uid(), situationId: sit6.id, startMonth: steuerMonth, endMonth: steuerMonth },
      { id: uid(), situationId: sit5.id, startMonth: autoMonth, endMonth: autoMonth },
    ],
    effectEntries: [],
    savingsBalancePoints: [],
  };

  return {
    situations: [sit1, sit2, sit3, sit4, sit5, sit6],
    scenarios: [scen1, scen2, scen3],
  };
}

// ── Store types ───────────────────────────────────────────────────────────────

interface AppState {
  situations: Situation[];
  scenarios: Scenario[];
  activeScenarioId: string;
  compareMode: boolean;

  // Situation actions
  addSituation: (s: Situation) => void;
  duplicateSituation: (id: string) => void;
  updateSituation: (id: string, updates: Partial<Situation>) => void;
  deleteSituation: (id: string) => void;
  reorderSituations: (fromIndex: number, toIndex: number) => void;

  // Scenario actions
  addScenario: (s: Scenario) => void;
  updateScenario: (id: string, updates: Partial<Scenario>) => void;
  deleteScenario: (id: string) => void;
  setActiveScenario: (id: string) => void;

  // Entry painting
  paintEntries: (situationId: string, months: string[], mode: 'add' | 'remove') => void;
  paintEffectEntries: (
    situationId: string,
    effectId: string,
    months: string[],
    mode: 'add' | 'remove',
  ) => void;

  // Data import/export
  loadData: (data: { situations: Situation[]; scenarios: Scenario[] }) => void;
  replaceData: (data: { situations: Situation[]; scenarios: Scenario[] }) => void;

  // UI
  setCompareMode: (v: boolean) => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const sample = buildSampleData();

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      situations: sample.situations,
      scenarios: sample.scenarios,
      activeScenarioId: sample.scenarios[0].id,
      compareMode: false,

      addSituation: (s) => {
        logAuditEntry(`Situation "${s.name}" hinzugefügt`);
        set((state) => ({ situations: [...state.situations, normalizeSituation(s)] }));
      },
      duplicateSituation: (id) =>
        set((state) => {
          const index = state.situations.findIndex((s) => s.id === id);
          if (index < 0) return {};

          const source = state.situations[index];
          const duplicate: Situation = normalizeSituation({
            ...source,
            id: uid(),
            name: `${source.name} (Kopie)`,
            effects: source.effects.map((effect) => ({ ...effect, id: uid() })),
          });

          logAuditEntry(`Situation "${source.name}" dupliziert`, `Kopie: "${duplicate.name}"`);
          const situations = [...state.situations];
          situations.splice(index + 1, 0, duplicate);
          return { situations };
        }),
      updateSituation: (id, updates) =>
        set((state) => {
          const old = state.situations.find((s) => s.id === id);
          if (old) {
            const changed: string[] = [];
            if (updates.name !== undefined && updates.name !== old.name)
              changed.push(`Name: "${old.name}" → "${updates.name}"`);
            if (updates.category !== undefined && updates.category !== old.category)
              changed.push('Kategorie geändert');
            if (updates.description !== undefined && updates.description !== old.description)
              changed.push('Beschreibung geändert');
            if (updates.effects !== undefined && updates.effects !== old.effects)
              changed.push('Effekte geändert');
            if (updates.color !== undefined && updates.color !== old.color)
              changed.push('Farbe geändert');
            if (changed.length > 0)
              logAuditEntry(`Situation "${updates.name ?? old.name}" bearbeitet`, changed.join(' · '));
          }
          return {
            situations: state.situations.map((s) =>
              s.id === id ? normalizeSituation({ ...s, ...updates } as Situation) : s,
            ),
          };
        }),
      reorderSituations: (fromIndex, toIndex) =>
        set((state) => {
          const situations = [...state.situations];
          const [moved] = situations.splice(fromIndex, 1);
          situations.splice(toIndex, 0, moved);
          return { situations };
        }),
      deleteSituation: (id) =>
        set((state) => {
          const sit = state.situations.find((s) => s.id === id);
          if (sit) logAuditEntry(`Situation "${sit.name}" gelöscht`);
          return {
            situations: state.situations.filter((s) => s.id !== id),
            scenarios: state.scenarios.map((sc) => ({
              ...sc,
              entries: sc.entries.filter((e) => e.situationId !== id),
              effectEntries: sc.effectEntries.filter((e) => e.situationId !== id),
            })),
          };
        }),

      addScenario: (s) => {
        logAuditEntry(`Szenario "${s.name}" hinzugefügt`);
        set((state) => ({ scenarios: [...state.scenarios, normalizeScenario(s)], activeScenarioId: s.id }));
      },
      updateScenario: (id, updates) =>
        set((state) => {
          const old = state.scenarios.find((s) => s.id === id);
          if (old) {
            const changed: string[] = [];
            if (updates.name !== undefined && updates.name !== old.name)
              changed.push(`Name: "${old.name}" → "${updates.name}"`);
            if (updates.initialBalance !== undefined && updates.initialBalance !== old.initialBalance)
              changed.push(`Startkapital: ${old.initialBalance} → ${updates.initialBalance} €`);
            if (updates.durationMonths !== undefined && updates.durationMonths !== old.durationMonths)
              changed.push(`Dauer: ${old.durationMonths} → ${updates.durationMonths} Monate`);
            if (updates.startMonth !== undefined && updates.startMonth !== old.startMonth)
              changed.push('Startmonat geändert');
            if (changed.length > 0)
              logAuditEntry(`Szenario "${updates.name ?? old.name}" bearbeitet`, changed.join(' · '));
          }
          return {
            scenarios: state.scenarios.map((s) =>
              s.id === id ? normalizeScenario({ ...s, ...updates } as Scenario) : s,
            ),
          };
        }),
      deleteScenario: (id) =>
        set((state) => {
          const sc = state.scenarios.find((s) => s.id === id);
          if (sc) logAuditEntry(`Szenario "${sc.name}" gelöscht`);
          const remaining = state.scenarios.filter((s) => s.id !== id);
          const newActive = state.activeScenarioId === id ? (remaining[0]?.id ?? '') : state.activeScenarioId;
          return { scenarios: remaining, activeScenarioId: newActive };
        }),
      setActiveScenario: (id) => set({ activeScenarioId: id }),

      paintEntries: (situationId, paintedMonths, mode) =>
        set((state) => {
          const scenario = state.scenarios.find((s) => s.id === state.activeScenarioId);
          const sit = state.situations.find((s) => s.id === situationId);
          if (scenario && sit) {
            const verb = mode === 'add' ? 'eingetragen' : 'entfernt';
            logDebounced(
              `paint-entries-${state.activeScenarioId}-${situationId}`,
              `Zeitplan geändert – "${sit.name}" ${verb}`,
              `Szenario: "${scenario.name}", ${paintedMonths.length} Monat(e)`,
            );
          }
          if (!scenario) return {};

          const situationActive = activeMonthsFromEntries(
            scenario.entries.filter((entry) => entry.situationId === situationId),
          );

          if (mode === 'add') {
            for (const month of paintedMonths) situationActive.add(month);
          } else {
            for (const month of paintedMonths) situationActive.delete(month);
          }

          const scenarioEnd = addMonths(scenario.startMonth, scenario.durationMonths - 1);
          for (const month of [...situationActive]) {
            if (month < scenario.startMonth || month > scenarioEnd) {
              situationActive.delete(month);
            }
          }

          const otherSituationEntries = scenario.entries.filter((entry) => entry.situationId !== situationId);
          const newSituationEntries = toScenarioEntries(situationId, situationActive);

          const effectEntriesForOtherSituations = scenario.effectEntries.filter(
            (entry) => entry.situationId !== situationId,
          );

          const prunedEffectEntriesForSituation: ScenarioEffectEntry[] = [];
          const effectGroups = new Map<string, ScenarioEffectEntry[]>();
          for (const entry of scenario.effectEntries) {
            if (entry.situationId !== situationId) continue;
            const group = effectGroups.get(entry.effectId);
            if (group) {
              group.push(entry);
            } else {
              effectGroups.set(entry.effectId, [entry]);
            }
          }

          for (const [effectId, entries] of effectGroups.entries()) {
            const effectMonths = activeMonthsFromEntries(entries);
            const kept = new Set<string>();
            for (const month of effectMonths) {
              if (situationActive.has(month)) kept.add(month);
            }
            prunedEffectEntriesForSituation.push(...toScenarioEffectEntries(situationId, effectId, kept));
          }

          return {
            scenarios: state.scenarios.map((s) =>
              s.id === state.activeScenarioId
                ? {
                    ...s,
                    entries: [...otherSituationEntries, ...newSituationEntries],
                    effectEntries: [...effectEntriesForOtherSituations, ...prunedEffectEntriesForSituation],
                  }
                : s,
            ),
          };
        }),

      paintEffectEntries: (situationId, effectId, paintedMonths, mode) =>
        set((state) => {
          const scenario = state.scenarios.find((s) => s.id === state.activeScenarioId);
          const sit = state.situations.find((s) => s.id === situationId);
          const effect = sit?.effects.find((e) => e.id === effectId);
          if (scenario && sit) {
            const verb = mode === 'add' ? 'aktiviert' : 'deaktiviert';
            const effectName = effect?.label ?? sit.name;
            logDebounced(
              `paint-effect-${state.activeScenarioId}-${situationId}-${effectId}`,
              `Effekt "${effectName}" ${verb}`,
              `Szenario: "${scenario.name}"`,
            );
          }
          if (!scenario) return {};

          const scenarioEnd = addMonths(scenario.startMonth, scenario.durationMonths - 1);
          const situationActive = activeMonthsFromEntries(
            scenario.entries.filter((entry) => entry.situationId === situationId),
          );
          if (situationActive.size === 0) return {};

          const currentDisabledEntries = scenario.effectEntries.filter(
            (entry) => entry.situationId === situationId && entry.effectId === effectId,
          );
          const disabledMonths = activeMonthsFromEntries(currentDisabledEntries);

          if (mode === 'add') {
            for (const month of paintedMonths) {
              disabledMonths.delete(month);
            }
          } else {
            for (const month of paintedMonths) {
              if (situationActive.has(month)) disabledMonths.add(month);
            }
          }

          for (const month of [...disabledMonths]) {
            const outsideScenario = month < scenario.startMonth || month > scenarioEnd;
            if (outsideScenario || !situationActive.has(month)) {
              disabledMonths.delete(month);
            }
          }

          const otherEffectEntries = scenario.effectEntries.filter(
            (entry) => !(entry.situationId === situationId && entry.effectId === effectId),
          );
          const nextEffectEntries = toScenarioEffectEntries(situationId, effectId, disabledMonths);

          return {
            scenarios: state.scenarios.map((s) =>
              s.id === state.activeScenarioId
                ? {
                    ...s,
                    effectEntries: [...otherEffectEntries, ...nextEffectEntries],
                  }
                : s,
            ),
          };
        }),

      loadData: (data) => {
        const normalized = normalizeData(data);
        logAuditEntry(
          'Daten importiert (JSON)',
          `${normalized.situations.length} Situationen, ${normalized.scenarios.length} Szenarien`,
        );
        set({
          situations: normalized.situations,
          scenarios: normalized.scenarios,
          activeScenarioId: normalized.scenarios[0]?.id ?? '',
          compareMode: false,
        });
      },

      replaceData: (data) => {
        const normalized = normalizeData(data);
        set((state) => {
          const activeStillExists = normalized.scenarios.some((sc) => sc.id === state.activeScenarioId);
          return {
            situations: normalized.situations,
            scenarios: normalized.scenarios,
            activeScenarioId: activeStillExists
              ? state.activeScenarioId
              : (normalized.scenarios[0]?.id ?? ''),
          };
        });
      },

      setCompareMode: (v) => set({ compareMode: v }),
    }),
    {
      name: 'finance-simulator-v1',
      version: 5,
      migrate: (persistedState, fromVersion) => {
        const state = (persistedState ?? {}) as Partial<AppState>;
        const situations = normalizeSituations((state.situations ?? sample.situations) as Situation[]);
        const normalizedScenarios = normalizeScenarios((state.scenarios ?? sample.scenarios) as Scenario[]);
        const scenarios = fromVersion < 5
          ? convertLegacyEffectEntriesToDisabled(normalizedScenarios)
          : normalizedScenarios;

        return {
          ...state,
          situations,
          scenarios,
        };
      },
    },
  ),
);
