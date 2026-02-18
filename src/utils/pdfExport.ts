import { jsPDF } from "jspdf";
import { simulateScenario } from "../simulation";
import type { Scenario, Situation } from "../types";
import { formatMonthLong } from "./months";

const PAGE_MARGIN_X = 40;
const PAGE_MARGIN_TOP = 40;
const PAGE_MARGIN_BOTTOM = 40;

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

export function exportScenarioPdf(scenario: Scenario, situations: Situation[]): void {
  const simulation = simulateScenario(scenario, situations);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageHeight = doc.internal.pageSize.getHeight();

  const situationMap = new Map(situations.map((s) => [s.id, s]));
  const usedSituations = Array.from(new Set(scenario.entries.map((e) => e.situationId)))
    .map((id) => situationMap.get(id))
    .filter((s): s is Situation => Boolean(s))
    .sort((a, b) => a.name.localeCompare(b.name, "de-DE"));

  const finalBalance = simulation[simulation.length - 1]?.balance ?? scenario.initialBalance;
  const minBalance = simulation.reduce(
    (min, row) => Math.min(min, row.balance),
    scenario.initialBalance,
  );

  let y = PAGE_MARGIN_TOP;

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageHeight - PAGE_MARGIN_BOTTOM) return;
    doc.addPage();
    y = PAGE_MARGIN_TOP;
  };

  const addLine = (text: string, options?: { bold?: boolean; size?: number; indent?: number }) => {
    ensureSpace((options?.size ?? 11) + 8);
    doc.setFont("helvetica", options?.bold ? "bold" : "normal");
    doc.setFontSize(options?.size ?? 11);
    doc.text(text, PAGE_MARGIN_X + (options?.indent ?? 0), y);
    y += (options?.size ?? 11) + 6;
  };

  addLine("Finanz-Simulator - Szenario Export", { bold: true, size: 18 });
  addLine(`Szenario: ${scenario.name}`, { bold: true, size: 13 });
  addLine(`Exportiert: ${new Date().toLocaleString("de-DE")}`);
  y += 4;

  addLine("Uebersicht", { bold: true, size: 13 });
  addLine(`Startmonat: ${formatMonthLong(scenario.startMonth)}`, { indent: 8 });
  addLine(`Dauer: ${scenario.durationMonths} Monate`, { indent: 8 });
  addLine(`Startkontostand: ${formatCurrency(scenario.initialBalance)}`, { indent: 8 });
  addLine(`Endkontostand: ${formatCurrency(finalBalance)}`, { indent: 8 });
  addLine(`Niedrigster Kontostand: ${formatCurrency(minBalance)}`, { indent: 8 });
  y += 6;

  addLine("Aktive Situationen", { bold: true, size: 13 });
  if (usedSituations.length === 0) {
    addLine("Keine Situationen im Szenario hinterlegt.", { indent: 8 });
  } else {
    for (const situation of usedSituations) {
      const effectSummary = situation.effects
        .map((effect) => {
          const direction = effect.category === "income" ? "+" : "-";
          const cadence = effect.type === "one-time" ? "einmalig" : "monatlich";
          return `${effect.label || "Effekt"} (${direction}${formatCurrency(effect.amount)}, ${cadence})`;
        })
        .join(", ");
      addLine(`${situation.name}${situation.category ? ` [${situation.category}]` : ""}`, {
        indent: 8,
        bold: true,
      });
      if (effectSummary) {
        addLine(effectSummary, { indent: 16, size: 10 });
      }
    }
  }

  y += 6;
  addLine("Monatliche Tagesgeldbewegung", { bold: true, size: 13 });
  addLine("Monat | Netto | Aktion | Kontostand", { indent: 8, bold: true, size: 10 });

  for (const row of simulation) {
    const action =
      row.net > 0 ? "Auf Tagesgeld ueberweisen" : row.net < 0 ? "Vom Tagesgeld entnehmen" : "Keine Bewegung";
    const netLabel = `${row.net >= 0 ? "+" : ""}${formatCurrency(row.net)}`;
    addLine(`${formatMonthLong(row.month)} | ${netLabel} | ${action} | ${formatCurrency(row.balance)}`, {
      indent: 8,
      size: 10,
    });
  }

  if (scenario.savingsBalancePoints.length > 0) {
    y += 6;
    addLine("IST-Kontostandpunkte Tagesgeld", { bold: true, size: 13 });
    const sortedPoints = [...scenario.savingsBalancePoints].sort((a, b) => a.month.localeCompare(b.month));
    for (const point of sortedPoints) {
      addLine(`${formatMonthLong(point.month)}: ${formatCurrency(point.balance)}`, { indent: 8, size: 10 });
    }
  }

  const dateLabel = new Date().toISOString().slice(0, 10);
  const fileName = `finanz-szenario-${sanitizeFilename(scenario.name)}-${dateLabel}.pdf`;
  doc.save(fileName);
}
