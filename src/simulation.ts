import type { Scenario, Situation, MonthlyBalance } from './types';
import { addMonths, monthsBetween, rangeToMonths } from './utils/months';

export function simulateScenario(
  scenario: Scenario,
  situations: Situation[],
): MonthlyBalance[] {
  const situationMap = new Map(situations.map((s) => [s.id, s]));

  const endMonth = addMonths(scenario.startMonth, scenario.durationMonths - 1);
  const months = monthsBetween(scenario.startMonth, endMonth);

  const activeMonthsByEffect = new Map<string, Set<string>>();
  for (const entry of scenario.effectEntries) {
    const key = `${entry.situationId}::${entry.effectId}`;
    let set = activeMonthsByEffect.get(key);
    if (!set) {
      set = new Set<string>();
      activeMonthsByEffect.set(key, set);
    }
    for (const month of rangeToMonths(entry.startMonth, entry.endMonth)) {
      if (month >= scenario.startMonth && month <= endMonth) set.add(month);
    }
  }

  let balance = scenario.initialBalance;
  const result: MonthlyBalance[] = [];

  for (const month of months) {
    let income = 0;
    let expenses = 0;

    for (const entry of scenario.entries) {
      if (month < entry.startMonth || month > entry.endMonth) continue;

      const situation = situationMap.get(entry.situationId);
      if (!situation) continue;

      for (const effect of situation.effects) {
        const effectKey = `${entry.situationId}::${effect.id}`;
        const disabledMonths = activeMonthsByEffect.get(effectKey);
        const effectIsActive = !disabledMonths || !disabledMonths.has(month);
        if (!effectIsActive) continue;

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
