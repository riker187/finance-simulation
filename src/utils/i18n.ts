import { useEffect, useState } from 'react';

export type Lang = 'de' | 'en';

const LANG_KEY = 'finance-simulator-lang';

// ── Module-level state ────────────────────────────────────────────────────────

let currentLang: Lang = (() => {
  try {
    return (localStorage.getItem(LANG_KEY) as Lang) === 'en' ? 'en' : 'de';
  } catch {
    return 'de';
  }
})();

const subscribers = new Set<() => void>();

export function getLang(): Lang {
  return currentLang;
}

export function setLang(lang: Lang): void {
  currentLang = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // ignore
  }
  subscribers.forEach((fn) => fn());
}

// ── React hook ────────────────────────────────────────────────────────────────

export function useT() {
  const [, rerender] = useState(0);

  useEffect(() => {
    const update = () => rerender((n) => n + 1);
    subscribers.add(update);
    return () => { subscribers.delete(update); };
  }, []);

  return function t(key: string, vars?: Record<string, string | number>): string {
    let text: string;
    if (currentLang === 'de') {
      text = key;
    } else {
      text = (en[key] !== undefined ? en[key] : key);
    }
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return text;
  };
}

// ── Locale-aware EUR formatter ────────────────────────────────────────────────

export function formatEurLocalized(n: number): string {
  const locale = currentLang === 'en' ? 'en-US' : 'de-DE';
  return n.toLocaleString(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

// ── English translations ──────────────────────────────────────────────────────

const en: Record<string, string> = {
  // App
  'Finanz-Simulator': 'Financial Simulator',
  'Was-wäre-wenn Planung': 'What-if Planning',
  'Synchronisationsstatus': 'Sync status',
  'Neue UI-Version verfügbar. Bitte neu laden, um das Update zu sehen.': 'A new version is available. Please reload to update.',
  'Neu laden': 'Reload',
  'Szenariovergleich': 'Scenario Comparison',
  '{count} Szenarien im Vergleich': '{count} scenarios compared',
  'Szenario': 'Scenario',
  'Startkapital': 'Starting balance',
  'Dauer': 'Duration',
  'Situationen': 'Situations',
  'Mo.': 'mo.',
  'Zeitplan': 'Timeline',
  'Kontostandverlauf': 'Balance Chart',
  'Hoehe des Zeitplans anpassen': 'Adjust timeline height',
  'Breite der Situationsspalte anpassen': 'Adjust situation column width',
  '← Zurück': '← Back',
  '⇄ Vergleich': '⇄ Compare',
  '{name} ausblenden': 'Hide {name}',
  '{name} einblenden': 'Show {name}',
  'Änderungsprotokoll': 'Change Log',

  // Common actions
  'Speichern': 'Save',
  'Abbrechen': 'Cancel',
  'Löschen': 'Delete',
  'Bearbeiten': 'Edit',
  'Duplizieren': 'Duplicate',
  'Schließen': 'Close',
  'Zurück': 'Back',
  'Ja': 'Yes',
  'Nein': 'No',
  'Umbenennen': 'Rename',
  'Erstellen': 'Create',
  'OK': 'OK',

  // Situations sidebar
  'Finanzielle Bausteine': 'Financial Building Blocks',
  'Noch keine Situationen.': 'No situations yet.',
  'Erstelle deine erste!': 'Create your first one!',
  '+ Neue Situation': '+ New Situation',
  'Wirklich löschen?': 'Delete?',
  '(einmalig)': '(one-time)',
  '/Mo.': '/mo.',
  'Keine Auswirkungen': 'No effects',

  // Situation form
  'Situation bearbeiten': 'Edit Situation',
  'Neue Situation': 'New Situation',
  'Achtung: Diese Situation wird in {count} Szenarien verwendet ({names}).': 'Note: This situation is used in {count} scenarios ({names}).',
  'Änderungen wirken sich in allen betroffenen Szenarien aus.': 'Changes will apply to all affected scenarios.',
  'Name': 'Name',
  'z.B. Vollzeitjob': 'e.g. Full-time job',
  'Beschreibung (optional)': 'Description (optional)',
  'Kurze Beschreibung': 'Short description',
  'Kategorie': 'Category',
  'Vorhandene Kategorie wählen...': 'Choose existing category...',
  'Oder neue Kategorie eingeben': 'Or enter new category',
  'Farbe': 'Color',
  'Finanzielle Auswirkungen': 'Financial Effects',
  'Bezeichnung': 'Label',
  'monatlich': 'monthly',
  'einmalig': 'one-time',
  'Einnahme': 'Income',
  'Ausgabe': 'Expense',
  'EUR': 'EUR',
  'Streuung': 'Variance',
  '0 %': '0 %',
  'Streuung in % – für Sensitivitätsband im Chart': 'Variance in % – for sensitivity band in chart',
  'Nur aufwärts': 'Upward only',
  'Nur abwärts': 'Downward only',
  'Beide Richtungen': 'Both directions',
  '+ Auswirkung hinzufügen': '+ Add Effect',

  // Scenario tabs
  'Neues Szenario': 'New Scenario',
  'Szenario bearbeiten': 'Edit Scenario',
  'Startkapital (€)': 'Starting balance (€)',
  'Dauer (Monate)': 'Duration (months)',
  'Startmonat': 'Start month',
  'Kopie von {name}': 'Copy of {name}',
  '+ Szenario': '+ Scenario',
  'Szenario wirklich löschen?': 'Delete scenario?',

  // Scenario settings
  'Start:': 'Start:',
  'Ende:': 'End:',
  'Monate': 'months',
  'Endstand:': 'End balance:',
  'Veränderung:': 'Change:',
  'Ziel:': 'Goal:',
  'EUR (optional)': 'EUR (optional)',
  'Ziel entfernen': 'Remove goal',
  'Annotationen ({count})': 'Annotations ({count})',
  'IST Tagesgeld ({count})': 'Actual balance ({count})',
  'Monat-Annotationen': 'Month Annotations',
  'Szenario: {name}': 'Scenario: {name}',
  'Neue Annotation': 'New Annotation',
  'Kurztext (z.B. Kündigung)': 'Short text (e.g. Job termination)',
  'Noch keine Annotationen vorhanden.': 'No annotations yet.',
  'Annotation entfernen': 'Remove annotation',
  'IST Tagesgeld-Stand': 'Actual Balance',
  'Neuen IST-Punkt erfassen': 'Add actual balance point',
  'Betrag in EUR': 'Amount in EUR',
  'Noch keine IST-Punkte vorhanden.': 'No actual balance points yet.',
  'IST-Punkt entfernen': 'Remove balance point',

  // Timeline
  'Kein Szenario ausgewählt.': 'No scenario selected.',
  'Situation': 'Situation',
  'Erstelle zuerst Situationen in der linken Seitenleiste.': 'Create situations in the left sidebar first.',
  'individuell': 'custom',
  'Verschieben': 'Move',
  'Auswirkungen einklappen': 'Collapse effects',
  'Auswirkungen aufklappen': 'Expand effects',
  'In einzelnen Monaten deaktiviert': 'Disabled in specific months',
  'Folgt aktuell der Situation': 'Currently follows situation',
  'In diesem Monat gibt es individuelle Effekt-Anpassungen': 'This month has individual effect overrides',
  'Situationen: klicken & ziehen zum Aktivieren/Deaktivieren · ▸ Auswirkungen aufklappen und bei Bedarf einzeln steuern.':
    'Situations: click & drag to activate/deactivate · ▸ Expand effects to control individually.',

  // Balance chart
  'Keine Daten zur Anzeige.': 'No data to display.',
  'IST Tagesgeld': 'Actual balance',
  'Kontostand': 'Balance',
  'Kritischer Bereich: unter 0 EUR': 'Critical: below 0 EUR',
  'Einnahmen': 'Income',
  'Ausgaben': 'Expenses',
  'Tagesgeld-Transfer': 'Monthly transfer',
  'Nachhaltig': 'Sustainable',
  'Kritischer Bereich: Kontostand unter 0 EUR': 'Critical zone: balance below 0 EUR',
  'Grün = nachhaltig (ohne Einmal-Ereignisse)': 'Green = sustainable (excl. one-time events)',
  'Amber = Zielkontostand': 'Amber = goal balance',
  'Gestrichelt = Sensitivitätsband': 'Dashed = sensitivity band',
  'Balken = Monats-Transfer Tagesgeld': 'Bars = monthly transfer',
  'Ziel: {amount}': 'Goal: {amount}',

  // Profile switcher
  'PIN verwalten': 'Manage PIN',
  'PIN festlegen': 'Set PIN',
  'Profilname': 'Profile name',
  'Neues Profil': 'New Profile',
  'PIN eingeben': 'Enter PIN',
  'Profil: {name}': 'Profile: {name}',
  'PIN (4 Stellen)': 'PIN (4 digits)',
  'Falscher PIN. Bitte erneut versuchen.': 'Wrong PIN. Please try again.',
  'Entsperren': 'Unlock',
  'PIN {action}': 'PIN {action}',
  'verwalten': 'management',
  'PIN ist aktiv': 'PIN is active',
  'PIN entfernen': 'Remove PIN',
  'PIN ändern': 'Change PIN',
  'Neuer PIN (4 Ziffern)': 'New PIN (4 digits)',
  'PIN bestätigen': 'Confirm PIN',
  'PIN muss genau 4 Ziffern haben': 'PIN must be exactly 4 digits',
  'PINs stimmen nicht überein': 'PINs do not match',
  'Aktuellen PIN eingeben': 'Enter current PIN',
  'Falscher PIN': 'Wrong PIN',
  'Aktueller PIN falsch': 'Current PIN is wrong',
  'Neuer PIN muss 4 Ziffern haben': 'New PIN must be 4 digits',
  'Neue PINs stimmen nicht überein': 'New PINs do not match',
  'Aktueller PIN': 'Current PIN',
  'Neuen PIN bestätigen': 'Confirm new PIN',

  // Comparison chart
  'Keine Szenarien vorhanden.': 'No scenarios available.',

  // Audit log
  'Letzte 7 Tage · {count} Einträge': 'Last 7 days · {count} entries',
  'Leeren': 'Clear',
  'Noch keine Änderungen protokolliert.': 'No changes logged yet.',
  'Änderungen werden ab jetzt aufgezeichnet.': 'Changes will be recorded from now on.',
  'gerade eben': 'just now',
  'vor {diffMin} Min.': '{diffMin} min. ago',
  'heute {time}': 'today {time}',
  'gestern {time}': 'yesterday {time}',

  // Import / Export
  'Daten importieren oder exportieren': 'Import or export data',
  'Exportieren (JSON)': 'Export (JSON)',
  'Szenario als PDF': 'Scenario as PDF',
  'Importieren': 'Import',
  'Kein aktives Szenario gefunden.': 'No active scenario found.',
  'PDF-Export fehlgeschlagen. Bitte erneut versuchen.': 'PDF export failed. Please try again.',
  'Import fehlgeschlagen': 'Import failed',
  'Die Datei konnte nicht gelesen werden. Bitte eine gültige Export-Datei wählen.': 'The file could not be read. Please select a valid export file.',
  'Daten importieren?': 'Import data?',
  'Die aktuellen Daten werden durch den Import überschrieben. Diese Aktion kann nicht rückgängig gemacht werden.': 'The current data will be overwritten by the import. This action cannot be undone.',
  'Exportiert am': 'Exported on',

  // Misc
  'Auswirkung': 'Effect',

  // Category suggestions (displayed only, stored values stay German)
  'Einkommen': 'Income',
  'Fixkosten': 'Fixed Costs',
  'Variable Kosten': 'Variable Costs',
  'Sparen & Investieren': 'Savings & Investments',
  'Einmalige Ereignisse': 'One-time Events',
};
