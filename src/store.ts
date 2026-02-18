import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Situation, Scenario, ScenarioEntry } from './types';
import { DEFAULT_SITUATION_CATEGORY } from './types';
import { currentMonth, addMonths, monthsToRanges, rangeToMonths, sortMonths } from './utils/months';
import { uid } from './utils/uid';

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
  updateSituation: (id: string, updates: Partial<Situation>) => void;
  deleteSituation: (id: string) => void;
  reorderSituations: (fromIndex: number, toIndex: number) => void;

  // Scenario actions
  addScenario: (s: Scenario) => void;
  updateScenario: (id: string, updates: Partial<Scenario>) => void;
  deleteScenario: (id: string) => void;
  setActiveScenario: (id: string) => void;

  // Entry painting (batch update of entries for a situation in active scenario)
  paintEntries: (situationId: string, months: string[], mode: 'add' | 'remove') => void;

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

      // ── Situations ──
      addSituation: (s) =>
        set((state) => ({ situations: [...state.situations, normalizeSituation(s)] })),
      updateSituation: (id, updates) =>
        set((state) => ({
          situations: state.situations.map((s) =>
            s.id === id ? normalizeSituation({ ...s, ...updates } as Situation) : s,
          ),
        })),
      reorderSituations: (fromIndex, toIndex) =>
        set((state) => {
          const situations = [...state.situations];
          const [moved] = situations.splice(fromIndex, 1);
          situations.splice(toIndex, 0, moved);
          return { situations };
        }),
      deleteSituation: (id) =>
        set((state) => ({
          situations: state.situations.filter((s) => s.id !== id),
          scenarios: state.scenarios.map((sc) => ({
            ...sc,
            entries: sc.entries.filter((e) => e.situationId !== id),
          })),
        })),

      // ── Scenarios ──
      addScenario: (s) =>
        set((state) => ({ scenarios: [...state.scenarios, normalizeScenario(s)], activeScenarioId: s.id })),
      updateScenario: (id, updates) =>
        set((state) => ({
          scenarios: state.scenarios.map((s) =>
            s.id === id ? normalizeScenario({ ...s, ...updates } as Scenario) : s,
          ),
        })),
      deleteScenario: (id) =>
        set((state) => {
          const remaining = state.scenarios.filter((s) => s.id !== id);
          const newActive = state.activeScenarioId === id ? (remaining[0]?.id ?? '') : state.activeScenarioId;
          return { scenarios: remaining, activeScenarioId: newActive };
        }),
      setActiveScenario: (id) => set({ activeScenarioId: id }),

      // ── Timeline painting ──
      paintEntries: (situationId, paintedMonths, mode) =>
        set((state) => {
          const scenario = state.scenarios.find((s) => s.id === state.activeScenarioId);
          if (!scenario) return {};

          // Collect currently active months for this situation
          const activeSet = new Set<string>();
          for (const entry of scenario.entries) {
            if (entry.situationId !== situationId) continue;
            for (const m of rangeToMonths(entry.startMonth, entry.endMonth)) {
              activeSet.add(m);
            }
          }

          // Apply paint operation
          if (mode === 'add') {
            for (const m of paintedMonths) activeSet.add(m);
          } else {
            for (const m of paintedMonths) activeSet.delete(m);
          }

          // Keep only months within the scenario's time range
          const scenarioEnd = addMonths(scenario.startMonth, scenario.durationMonths - 1);
          for (const m of [...activeSet]) {
            if (m < scenario.startMonth || m > scenarioEnd) activeSet.delete(m);
          }

          // Build new entries for this situation
          const newRanges = monthsToRanges([...activeSet]);
          const newEntries: ScenarioEntry[] = newRanges.map((r) => ({
            id: uid(),
            situationId,
            startMonth: r.startMonth,
            endMonth: r.endMonth,
          }));

          // Merge with entries from other situations
          const otherEntries = scenario.entries.filter((e) => e.situationId !== situationId);

          return {
            scenarios: state.scenarios.map((s) =>
              s.id === state.activeScenarioId ? { ...s, entries: [...otherEntries, ...newEntries] } : s,
            ),
          };
        }),

      loadData: (data) => {
        const normalized = normalizeData(data);
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
      version: 3,
      migrate: (persistedState) => {
        const state = (persistedState ?? {}) as Partial<AppState>;
        return {
          ...state,
          situations: normalizeSituations((state.situations ?? sample.situations) as Situation[]),
          scenarios: normalizeScenarios((state.scenarios ?? sample.scenarios) as Scenario[]),
        };
      },
    },
  ),
);

// ── Selectors ─────────────────────────────────────────────────────────────────

export function getActiveScenario(state: AppState): Scenario | undefined {
  return state.scenarios.find((s) => s.id === state.activeScenarioId);
}

export { sortMonths };
