export type EffectType = 'recurring' | 'one-time';
export type EffectCategory = 'income' | 'expense';

export interface FinancialEffect {
  id: string;
  label: string;
  type: EffectType;
  category: EffectCategory;
  amount: number; // always positive; category determines sign
}

export interface Situation {
  id: string;
  name: string;
  description: string;
  color: string;
  effects: FinancialEffect[];
}

export interface ScenarioEntry {
  id: string;
  situationId: string;
  startMonth: string; // 'YYYY-MM'
  endMonth: string;   // 'YYYY-MM' (inclusive)
}

export interface Scenario {
  id: string;
  name: string;
  color: string;
  initialBalance: number;
  startMonth: string;      // 'YYYY-MM'
  durationMonths: number;
  entries: ScenarioEntry[];
}

export interface MonthlyBalance {
  month: string;   // 'YYYY-MM'
  balance: number;
  income: number;
  expenses: number;
  net: number;
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
