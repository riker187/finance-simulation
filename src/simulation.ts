import type { Scenario, Situation, MonthlyBalance } from './types';
import { addMonths, monthsBetween } from './utils/months';

export function simulateScenario(
  scenario: Scenario,
  situations: Situation[],
): MonthlyBalance[] {
  const situationMap = new Map(situations.map((s) => [s.id, s]));

  // Build the list of months to simulate
  const endMonth = addMonths(scenario.startMonth, scenario.durationMonths - 1);
  const months = monthsBetween(scenario.startMonth, endMonth);

  let balance = scenario.initialBalance;
  const result: MonthlyBalance[] = [];

  for (const month of months) {
    let income = 0;
    let expenses = 0;

    for (const entry of scenario.entries) {
      // Is this entry active this month?
      if (month < entry.startMonth || month > entry.endMonth) continue;

      const situation = situationMap.get(entry.situationId);
      if (!situation) continue;

      for (const effect of situation.effects) {
        const isFirstMonth = month === entry.startMonth;

        if (effect.type === 'one-time' && !isFirstMonth) continue;

        if (effect.category === 'income') {
          income += effect.amount;
        } else {
          expenses += effect.amount;
        }
      }
    }

    const net = income - expenses;
    balance += net;

    result.push({ month, balance, income, expenses, net });
  }

  return result;
}

/** Simulate all scenarios and return a map of scenarioId → MonthlyBalance[] */
export function simulateAll(
  scenarios: Scenario[],
  situations: Situation[],
): Map<string, MonthlyBalance[]> {
  const result = new Map<string, MonthlyBalance[]>();
  for (const scenario of scenarios) {
    result.set(scenario.id, simulateScenario(scenario, situations));
  }
  return result;
}
