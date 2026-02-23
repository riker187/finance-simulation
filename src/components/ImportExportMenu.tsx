import { useRef, useState, useEffect } from "react";
import { useStore } from "../store";
import type { Situation, Scenario } from "../types";
import { useT, getLang } from "../utils/i18n";

interface ExportFile {
  version: number;
  exportedAt: string;
  situations: Situation[];
  scenarios: Scenario[];
}

function isValidData(data: unknown): data is ExportFile {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d.situations) && Array.isArray(d.scenarios);
}

export function ImportExportMenu() {
  const situations = useStore((s) => s.situations);
  const scenarios = useStore((s) => s.scenarios);
  const activeScenarioId = useStore((s) => s.activeScenarioId);
  const loadData = useStore((s) => s.loadData);
  const t = useT();

  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<ExportFile | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? null;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleExport = () => {
    const payload: ExportFile = {
      version: 1,
      exportedAt: new Date().toISOString(),
      situations,
      scenarios,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finanz-simulator-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  const handlePdfExport = async () => {
    if (!activeScenario) {
      setPdfError(t('Kein aktives Szenario gefunden.'));
      setOpen(false);
      return;
    }

    try {
      const { exportScenarioPdf } = await import("../utils/pdfExport");
      exportScenarioPdf(activeScenario, situations);
      setOpen(false);
    } catch {
      setPdfError(t('PDF-Export fehlgeschlagen. Bitte erneut versuchen.'));
      setOpen(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!isValidData(parsed)) throw new Error("Unbekanntes Format");
        setImportError(null);
        setPending(parsed);
      } catch {
        setImportError(t('Die Datei konnte nicht gelesen werden. Bitte eine gültige Export-Datei wählen.'));
      }
    };
    reader.readAsText(file);
    setOpen(false);
  };

  const confirmImport = () => {
    if (!pending) return;
    loadData({ situations: pending.situations, scenarios: pending.scenarios });
    setPending(null);
  };

  const lang = getLang();

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          onClick={() => setOpen((v) => !v)}
          title={t('Daten importieren oder exportieren')}
        >
          <span>⇅</span>
          <span>{t('Daten')}</span>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl overflow-hidden z-40">
            <button
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-left"
              onClick={handleExport}
            >
              <span className="text-base leading-none">↓</span>
              {t('Exportieren (JSON)')}
            </button>
            <button
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-left"
              onClick={handlePdfExport}
            >
              <span className="text-base leading-none">PDF</span>
              {t('Szenario als PDF')}
            </button>
            <div className="border-t border-slate-700" />
            <button
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-left"
              onClick={() => fileRef.current?.click()}
            >
              <span className="text-base leading-none">↑</span>
              {t('Importieren')}
            </button>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      {importError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h2 className="text-white font-semibold">{t('Import fehlgeschlagen')}</h2>
            <p className="text-sm text-slate-400">{importError}</p>
            <div className="flex justify-end">
              <button
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors"
                onClick={() => setImportError(null)}
              >
                {t('OK')}
              </button>
            </div>
          </div>
        </div>
      )}

      {pdfError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h2 className="text-white font-semibold">{t('PDF-Export fehlgeschlagen')}</h2>
            <p className="text-sm text-slate-400">{pdfError}</p>
            <div className="flex justify-end">
              <button
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm transition-colors"
                onClick={() => setPdfError(null)}
              >
                {t('OK')}
              </button>
            </div>
          </div>
        </div>
      )}

      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h2 className="text-white font-semibold">{t('Daten importieren?')}</h2>
            <p className="text-sm text-slate-400">
              {t('Die aktuellen Daten werden durch den Import überschrieben. Diese Aktion kann nicht rückgängig gemacht werden.')}
            </p>
            <div className="rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-xs text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>{t('Situationen')}</span>
                <span className="text-white font-medium">{pending.situations.length}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('Szenarien')}</span>
                <span className="text-white font-medium">{pending.scenarios.length}</span>
              </div>
              {pending.exportedAt && (
                <div className="flex justify-between">
                  <span>{t('Exportiert am')}</span>
                  <span className="text-white font-medium">
                    {new Date(pending.exportedAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'de-DE')}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-end pt-1">
              <button
                className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white transition-colors"
                onClick={() => setPending(null)}
              >
                {t('Abbrechen')}
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                onClick={confirmImport}
              >
                {t('Importieren')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
