/**
 * Month utilities using 'YYYY-MM' strings.
 * These strings are lexicographically sortable, so < > === comparisons work directly.
 */

/** Return current month as 'YYYY-MM' */
export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Add n months to a 'YYYY-MM' string */
export function addMonths(month: string, n: number): string {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(year, m - 1 + n, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Return all months from start (inclusive) to end (inclusive) */
export function monthsBetween(start: string, end: string): string[] {
  const result: string[] = [];
  let cur = start;
  while (cur <= end) {
    result.push(cur);
    cur = addMonths(cur, 1);
  }
  return result;
}

/** Format 'YYYY-MM' to short display like 'Jan 25' */
export function formatMonthShort(month: string): string {
  const [year, m] = month.split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  return `${names[m - 1]} ${String(year).slice(2)}`;
}

/** Format 'YYYY-MM' to long display like 'Januar 2025' */
export function formatMonthLong(month: string): string {
  const [year, m] = month.split('-').map(Number);
  const names = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  return `${names[m - 1]} ${year}`;
}

/**
 * Given a set of month strings, merge consecutive ones into
 * { startMonth, endMonth } ranges.
 */
export function monthsToRanges(months: string[]): { startMonth: string; endMonth: string }[] {
  if (months.length === 0) return [];
  const sorted = [...months].sort();
  const ranges: { startMonth: string; endMonth: string }[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (addMonths(prev, 1) === sorted[i]) {
      prev = sorted[i];
    } else {
      ranges.push({ startMonth: start, endMonth: prev });
      start = sorted[i];
      prev = sorted[i];
    }
  }
  ranges.push({ startMonth: start, endMonth: prev });
  return ranges;
}

/** Expand a { startMonth, endMonth } range to individual months */
export function rangeToMonths(start: string, end: string): string[] {
  return monthsBetween(start, end);
}

/** Sort a pair of months so [min, max] is returned */
export function sortMonths(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}
