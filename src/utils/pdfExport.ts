import { jsPDF } from "jspdf";
import { simulateScenario } from "../simulation";
import type { Scenario, Situation } from "../types";
import { formatMonthLong, monthsToRanges, rangeToMonths } from "./months";

// ── Page geometry (A4 = 595 × 842 pt) ────────────────────────────────────────
const ML = 40; // margin left
const MT = 40; // margin top
const MB = 40; // margin bottom
const CONTENT_W = 515; // 595 - 2×40

// ── Table column definitions ──────────────────────────────────────────────────
const COLS = [
  { label: "Monat", w: 130, align: "left" as const },
  { label: "Einnahmen", w: 90, align: "right" as const },
  { label: "Ausgaben", w: 90, align: "right" as const },
  { label: "Netto", w: 80, align: "right" as const },
  { label: "Kontostand", w: 125, align: "right" as const },
] as const;
const TABLE_W = COLS.reduce((s, c) => s + c.w, 0); // 515

// ── Formatting ────────────────────────────────────────────────────────────────
function formatCurrency(value: number): string {
  return value.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function sanitizeFilename(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "szenario";
}

// ── Main export ───────────────────────────────────────────────────────────────
export function exportScenarioPdf(scenario: Scenario, situations: Situation[]): void {
  const simulation = simulateScenario(scenario, situations);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight(); // 842

  let y = MT;

  // ── Page management ──────────────────────────────────────────────────────
  const newPage = () => {
    doc.addPage();
    y = MT;
  };
  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - MB) newPage();
  };

  // ── Drawing helpers ──────────────────────────────────────────────────────
  const addLine = (
    str: string,
    opts?: {
      size?: number;
      bold?: boolean;
      indent?: number;
      color?: [number, number, number];
    },
  ) => {
    const sz = opts?.size ?? 10;
    ensureSpace(sz + 6);
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(sz);
    const [r, g, b] = opts?.color ?? [20, 20, 20];
    doc.setTextColor(r, g, b);
    doc.text(str, ML + (opts?.indent ?? 0), y);
    y += sz + 5;
  };

  const divider = (gapBefore = 4, gapAfter = 8) => {
    y += gapBefore;
    ensureSpace(8);
    doc.setDrawColor(200, 200, 210);
    doc.setLineWidth(0.5);
    doc.line(ML, y, ML + CONTENT_W, y);
    y += gapAfter;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // 1. HEADER
  // ══════════════════════════════════════════════════════════════════════════
  addLine("Finanz-Simulator – Szenario-Export", { size: 18, bold: true });
  addLine(`Szenario: ${scenario.name}`, { size: 13, bold: true });
  addLine(`Exportiert: ${new Date().toLocaleString("de-DE")}`, {
    size: 9,
    color: [100, 100, 110],
  });
  divider(6, 10);

  // ══════════════════════════════════════════════════════════════════════════
  // 2. ÜBERSICHT
  // ══════════════════════════════════════════════════════════════════════════
  const finalBalance = simulation[simulation.length - 1]?.balance ?? scenario.initialBalance;
  const minBalance = simulation.reduce(
    (m, r) => Math.min(m, r.balance),
    scenario.initialBalance,
  );

  addLine("Übersicht", { size: 13, bold: true });
  y += 3;

  // Key–value pairs with label in grey, value in black
  const overviewItems: [string, string][] = [
    ["Startmonat", formatMonthLong(scenario.startMonth)],
    ["Dauer", `${scenario.durationMonths} Monate`],
    ["Anfangskontostand", formatCurrency(scenario.initialBalance)],
    ["Endkontostand", formatCurrency(finalBalance)],
    ["Niedrigster Stand", formatCurrency(minBalance)],
  ];
  for (const [label, value] of overviewItems) {
    ensureSpace(15);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(110, 110, 120);
    doc.text(`${label}:`, ML + 8, y);
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.text(value, ML + 155, y);
    y += 14;
  }
  divider(8, 10);

  // ══════════════════════════════════════════════════════════════════════════
  // 3. KONTOVERLAUF-CHART
  // ══════════════════════════════════════════════════════════════════════════
  addLine("Kontoverlauf", { size: 13, bold: true });
  y += 4;

  const CHART_H = 150; // height of chart area
  const TICK_H = 16; // height below chart for x-axis labels
  const Y_LABEL_W = 72; // width reserved for y-axis labels

  ensureSpace(CHART_H + TICK_H + 10);

  const chartTop = y;
  const chartBottom = y + CHART_H;
  const chartLeft = ML + Y_LABEL_W;
  const chartRight = ML + CONTENT_W;
  const chartContentH = CHART_H;
  const chartContentW = chartRight - chartLeft;

  const n = simulation.length;
  const balances = simulation.map((r) => r.balance);
  const allValues = [scenario.initialBalance, ...balances];
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  // Add 8% padding so min/max markers aren't clipped
  const pad = (rawMax - rawMin) * 0.1 || Math.abs(rawMax) * 0.08 || 500;
  const scaleMin = rawMin - pad;
  const scaleMax = rawMax + pad;
  const valueRange = scaleMax - scaleMin;

  const valToChartY = (v: number) =>
    chartBottom - ((v - scaleMin) / valueRange) * chartContentH;
  const idxToChartX = (i: number) =>
    chartLeft + (i / Math.max(n - 1, 1)) * chartContentW;

  // Chart background
  doc.setFillColor(248, 249, 252);
  doc.setDrawColor(190, 195, 215);
  doc.setLineWidth(0.5);
  doc.rect(chartLeft, chartTop, chartContentW, chartContentH, "FD");

  // Gridlines + Y-axis labels (5 levels)
  const GRID_LEVELS = 5;
  for (let i = 0; i <= GRID_LEVELS; i++) {
    const v = scaleMin + (valueRange * i) / GRID_LEVELS;
    const py = valToChartY(v);
    // gridline
    doc.setDrawColor(215, 217, 228);
    doc.setLineWidth(0.3);
    doc.line(chartLeft, py, chartRight, py);
    // y-label (right-aligned to chartLeft - 4)
    const label = formatCurrency(Math.round(v));
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(110, 112, 125);
    doc.text(label, chartLeft - 4, py + 2.5, { align: "right" });
  }

  // Zero line (dashed red) if scale crosses zero
  if (rawMin < 0 && rawMax >= 0) {
    const zeroY = valToChartY(0);
    doc.setDrawColor(210, 65, 65);
    doc.setLineWidth(0.7);
    for (let lx = chartLeft; lx < chartRight; lx += 7) {
      doc.line(lx, zeroY, Math.min(lx + 4, chartRight), zeroY);
    }
  }

  // X-axis tick labels
  const maxXLabels = 12;
  const xStep = Math.max(1, Math.ceil(n / maxXLabels));
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(90, 92, 105);
  for (let i = 0; i < n; i += xStep) {
    const px = idxToChartX(i);
    const d = new Date(simulation[i].month + "-01");
    const shortLabel = d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
    doc.text(shortLabel, px, chartBottom + 11, { align: "center" });
    // tick mark
    doc.setDrawColor(170, 173, 190);
    doc.setLineWidth(0.4);
    doc.line(px, chartBottom, px, chartBottom + 3);
  }

  // Balance line – segment color reflects direction (green up, red down)
  doc.setLineWidth(1.5);
  for (let i = 1; i < n; i++) {
    const x1 = idxToChartX(i - 1);
    const y1 = valToChartY(balances[i - 1]);
    const x2 = idxToChartX(i);
    const y2 = valToChartY(balances[i]);
    if (balances[i] >= balances[i - 1]) {
      doc.setDrawColor(38, 155, 95);
    } else {
      doc.setDrawColor(195, 65, 60);
    }
    doc.line(x1, y1, x2, y2);
  }

  // Min/Max markers
  const minIdx = balances.indexOf(Math.min(...balances));
  const maxIdx = balances.indexOf(Math.max(...balances));
  type Marker = { idx: number; r: number; g: number; b: number; label: string };
  const markers: Marker[] = [
    { idx: minIdx, r: 195, g: 65, b: 60, label: `Min: ${formatCurrency(balances[minIdx])}` },
    { idx: maxIdx, r: 38, g: 155, b: 95, label: `Max: ${formatCurrency(balances[maxIdx])}` },
  ];
  for (const m of markers) {
    const px = idxToChartX(m.idx);
    const py = valToChartY(balances[m.idx]);
    doc.setFillColor(m.r, m.g, m.b);
    doc.circle(px, py, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(m.r, m.g, m.b);
    // Place label above or below depending on proximity to chart top
    const labelY = py < chartTop + 18 ? py + 13 : py - 5;
    const labelX = px + 5;
    doc.text(m.label, labelX, labelY);
  }

  y = chartBottom + TICK_H;
  divider(4, 10);

  // ══════════════════════════════════════════════════════════════════════════
  // 4. AKTIVE SITUATIONEN
  // ══════════════════════════════════════════════════════════════════════════
  const situationMap = new Map(situations.map((s) => [s.id, s]));
  const usedSituations = Array.from(new Set(scenario.entries.map((e) => e.situationId)))
    .map((id) => situationMap.get(id))
    .filter((s): s is Situation => Boolean(s))
    .sort((a, b) => a.name.localeCompare(b.name, "de-DE"));

  // Group entries by situationId so we can show all active intervals per situation
  const entriesBySituation = new Map<string, typeof scenario.entries>();
  for (const entry of scenario.entries) {
    const list = entriesBySituation.get(entry.situationId) ?? [];
    list.push(entry);
    entriesBySituation.set(entry.situationId, list);
  }

  // Build disabled months per effect from effectEntries (key: "situationId::effectId")
  const disabledByEffect = new Map<string, string[]>();
  for (const ee of scenario.effectEntries) {
    const key = `${ee.situationId}::${ee.effectId}`;
    const months = disabledByEffect.get(key) ?? [];
    for (const m of rangeToMonths(ee.startMonth, ee.endMonth)) {
      months.push(m);
    }
    disabledByEffect.set(key, months);
  }

  addLine("Aktive Situationen", { size: 13, bold: true });
  y += 3;

  if (usedSituations.length === 0) {
    addLine("Keine Situationen im Szenario hinterlegt.", {
      indent: 8,
      color: [110, 110, 120],
    });
  } else {
    for (const sit of usedSituations) {
      addLine(`${sit.name}${sit.category ? `  [${sit.category}]` : ""}`, {
        indent: 8,
        bold: true,
      });

      // Time intervals
      const entries = (entriesBySituation.get(sit.id) ?? []).sort((a, b) =>
        a.startMonth.localeCompare(b.startMonth),
      );
      const onlyOneTime = sit.effects.every((e) => e.type === "one-time");
      if (onlyOneTime) {
        // One-time effects only fire in startMonth – list months, not ranges
        const months = entries.map((e) => formatMonthLong(e.startMonth)).join(", ");
        addLine(`Aktiv in:  ${months}`, { indent: 20, size: 9, color: [80, 90, 130] });
      } else {
        for (const entry of entries) {
          const interval = `${formatMonthLong(entry.startMonth)} – ${formatMonthLong(entry.endMonth)}`;
          addLine(`Zeitraum:  ${interval}`, { indent: 20, size: 9, color: [80, 90, 130] });
        }
      }

      // Effects
      for (const effect of sit.effects) {
        const direction = effect.category === "income" ? "+" : "−";
        const cadence = effect.type === "one-time" ? "einmalig" : "monatlich";
        const color: [number, number, number] =
          effect.category === "income" ? [38, 130, 75] : [175, 58, 58];
        addLine(
          `${effect.label || "Effekt"}:  ${direction}${formatCurrency(effect.amount)}  (${cadence})`,
          { indent: 20, size: 9, color },
        );

        // Show months where this effect is disabled via effectEntries
        const disabledMonths = disabledByEffect.get(`${sit.id}::${effect.id}`);
        if (disabledMonths && disabledMonths.length > 0) {
          const ranges = monthsToRanges(disabledMonths);
          const rangeLabels = ranges.map(({ startMonth, endMonth }) =>
            startMonth === endMonth
              ? formatMonthLong(startMonth)
              : `${formatMonthLong(startMonth)} – ${formatMonthLong(endMonth)}`,
          );
          addLine(`Ausgesetzt:  ${rangeLabels.join(", ")}`, {
            indent: 30,
            size: 8,
            color: [160, 100, 40],
          });
        }
      }
      y += 2;
    }
  }
  divider(6, 10);

  // ══════════════════════════════════════════════════════════════════════════
  // 5. MONATLICHE TABELLE
  // ══════════════════════════════════════════════════════════════════════════
  addLine("Monatliche Entwicklung", { size: 13, bold: true });
  y += 6;

  // Column x-positions (precomputed)
  const colX: number[] = [ML];
  for (let i = 1; i < COLS.length; i++) {
    colX.push(colX[i - 1] + COLS[i - 1].w);
  }

  const ROW_H = 14;
  const HEADER_H = 16;

  const drawTableHeader = () => {
    ensureSpace(HEADER_H + ROW_H);
    doc.setFillColor(45, 55, 90);
    doc.rect(ML, y, TABLE_W, HEADER_H, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    for (let c = 0; c < COLS.length; c++) {
      const col = COLS[c];
      if (col.align === "right") {
        doc.text(col.label, colX[c] + col.w - 5, y + 11, { align: "right" });
      } else {
        doc.text(col.label, colX[c] + 5, y + 11);
      }
    }
    y += HEADER_H;
  };

  drawTableHeader();

  simulation.forEach((row, idx) => {
    // Page break: redraw header on new page
    if (y + ROW_H > pageH - MB) {
      newPage();
      drawTableHeader();
    }

    // Alternating row background
    const isOdd = idx % 2 === 1;
    doc.setFillColor(isOdd ? 244 : 255, isOdd ? 245 : 255, isOdd ? 250 : 255);
    doc.rect(ML, y, TABLE_W, ROW_H, "F");

    // Thin bottom border
    doc.setDrawColor(215, 217, 228);
    doc.setLineWidth(0.25);
    doc.line(ML, y + ROW_H, ML + TABLE_W, y + ROW_H);

    // Cell values
    doc.setFontSize(9);
    const netColor: [number, number, number] =
      row.net > 0 ? [38, 140, 75] : row.net < 0 ? [185, 58, 58] : [100, 100, 110];
    const netSign = row.net > 0 ? "+" : "";

    type Cell = {
      val: string;
      c: number;
      color?: [number, number, number];
      bold?: boolean;
    };
    const cells: Cell[] = [
      { val: formatMonthLong(row.month), c: 0 },
      { val: row.income > 0 ? formatCurrency(row.income) : "–", c: 1 },
      { val: row.expenses > 0 ? formatCurrency(row.expenses) : "–", c: 2 },
      { val: `${netSign}${formatCurrency(row.net)}`, c: 3, color: netColor, bold: true },
      { val: formatCurrency(row.balance), c: 4 },
    ];

    for (const cell of cells) {
      const col = COLS[cell.c];
      const [r, g, b] = cell.color ?? [25, 25, 30];
      doc.setTextColor(r, g, b);
      doc.setFont("helvetica", cell.bold ? "bold" : "normal");
      if (col.align === "right") {
        doc.text(cell.val, colX[cell.c] + col.w - 5, y + 10, { align: "right" });
      } else {
        doc.text(cell.val, colX[cell.c] + 5, y + 10);
      }
    }

    y += ROW_H;
  });

  // Table closing border
  doc.setDrawColor(160, 165, 185);
  doc.setLineWidth(0.7);
  doc.line(ML, y, ML + TABLE_W, y);

  // ══════════════════════════════════════════════════════════════════════════
  // 6. IST-KONTOSTANDPUNKTE (optional)
  // ══════════════════════════════════════════════════════════════════════════
  if (scenario.savingsBalancePoints.length > 0) {
    divider(10, 8);
    addLine("IST-Kontostandpunkte Tagesgeld", { size: 13, bold: true });
    y += 3;
    const sorted = [...scenario.savingsBalancePoints].sort((a, b) =>
      a.month.localeCompare(b.month),
    );
    for (const point of sorted) {
      addLine(`${formatMonthLong(point.month)}: ${formatCurrency(point.balance)}`, {
        indent: 8,
        size: 9,
      });
    }
  }

  // ── Save ────────────────────────────────────────────────────────────────
  const dateLabel = new Date().toISOString().slice(0, 10);
  const fileName = `finanz-szenario-${sanitizeFilename(scenario.name)}-${dateLabel}.pdf`;
  doc.save(fileName);
}
