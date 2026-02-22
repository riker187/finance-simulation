export type EffectType = 'recurring' | 'one-time';
export type EffectCategory = 'income' | 'expense';

export interface FinancialEffect {
  id: string;
  label: string;
  type: EffectType;
  category: EffectCategory;
  amount: number; // always positive; category determines sign
  variancePercent?: number; // 0–100, optionale Streuung für Sensitivitätsanalyse
  varianceDirection?: '+' | '-' | '±'; // Richtung der Streuung, default '±'
}

export interface Annotation {
  id: string;
  month: string; // 'YYYY-MM'
  text: string;
}

export const DEFAULT_SITUATION_CATEGORY = 'Ohne Kategorie';
export const SITUATION_CATEGORY_SUGGESTIONS = [
  'Einkommen',
  'Fixkosten',
  'Variable Kosten',
  'Sparen & Investieren',
  'Einmalige Ereignisse',
  DEFAULT_SITUATION_CATEGORY,
] as const;

export interface Situation {
  id: string;
  name: string;
  description: string;
  category: string;
  color: string;
  effects: FinancialEffect[];
}

export interface ScenarioEntry {
  id: string;
  situationId: string;
  startMonth: string; // 'YYYY-MM'
  endMonth: string; // 'YYYY-MM' (inclusive)
}

export interface ScenarioEffectEntry {
  id: string;
  situationId: string;
  effectId: string;
  startMonth: string; // 'YYYY-MM'
  endMonth: string; // 'YYYY-MM' (inclusive)
}

export interface SavingsBalancePoint {
  id: string;
  month: string; // 'YYYY-MM'
  balance: number;
}

export interface Scenario {
  id: string;
  name: string;
  color: string;
  initialBalance: number;
  startMonth: string; // 'YYYY-MM'
  durationMonths: number;
  entries: ScenarioEntry[];
  effectEntries: ScenarioEffectEntry[];
  savingsBalancePoints: SavingsBalancePoint[];
  goalBalance?: number; // optionaler Ziel-Kontostand
  annotations: Annotation[]; // Monat-Notizen
}

export interface MonthlyBalance {
  month: string; // 'YYYY-MM'
  balance: number;
  income: number;
  expenses: number;
  net: number;
  recurringNet: number; // net ohne Einmal-Ereignisse
  balanceMin: number; // pessimistischer Kontostand (Sensitivität)
  balanceMax: number; // optimistischer Kontostand (Sensitivität)
}

export const SITUATION_COLORS = [
  '#4f8aff', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ec4899', // pink
  '#a78bfa', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#fb7185', // rose
  '#84cc16', // lime
] as const;
