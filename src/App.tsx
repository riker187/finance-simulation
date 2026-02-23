import { useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import { useRealtimeSync } from './realtime';
import { SituationsSidebar } from './components/SituationsSidebar';
import { ScenarioTabs } from './components/ScenarioTabs';
import { ScenarioSettings } from './components/ScenarioSettings';
import { TimelineEditor } from './components/TimelineEditor';
import { BalanceChart } from './components/BalanceChart';
import { ComparisonChart } from './components/ComparisonChart';
import { ImportExportMenu } from './components/ImportExportMenu';
import { AuditLogPanel } from './components/AuditLogPanel';
import { ProfileSwitcher } from './components/ProfileSwitcher';
import { MonthlyBreakdown } from './components/MonthlyBreakdown';
import { useT, getLang, setLang, formatEurLocalized } from './utils/i18n';

const SIDEBAR_MIN_W = 220;
const SIDEBAR_MAX_W = 520;
const TIMELINE_MIN_H = 180;
const TIMELINE_MAX_H = 520;
const LAYOUT_SIDEBAR_KEY = 'finance-simulator-layout.sidebar-width';
const LAYOUT_TIMELINE_KEY = 'finance-simulator-layout.timeline-height';
const TIMELINE_LABEL_W = 210;
const TIMELINE_CELL_W = 56;

function readPersistedNumber(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  } catch {
    return fallback;
  }
}

function getCurrentBundlePath(): string | null {
  const script = document.querySelector('script[src*="/assets/index-"]') as HTMLScriptElement | null;
  if (!script?.src) return null;
  try {
    return new URL(script.src, window.location.origin).pathname;
  } catch {
    return null;
  }
}

function extractLatestBundlePath(indexHtml: string): string | null {
  const match = indexHtml.match(/<script[^>]+src="([^\"]*\/assets\/index-[^\"]+\.js)"/i);
  return match?.[1] ?? null;
}

export function App() {
  const compareMode = useStore((s) => s.compareMode);
  const setCompareMode = useStore((s) => s.setCompareMode);
  const scenarios = useStore((s) => s.scenarios);
  const situations = useStore((s) => s.situations);
  const activeScenarioId = useStore((s) => s.activeScenarioId);
  const syncStatus = useRealtimeSync();
  const t = useT();

  const activeScenario = scenarios.find((s) => s.id === activeScenarioId);

  const [overlayIds, setOverlayIds] = useState<string[]>([]);
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    readPersistedNumber(LAYOUT_SIDEBAR_KEY, 256, SIDEBAR_MIN_W, SIDEBAR_MAX_W),
  );
  const [timelineHeight, setTimelineHeight] = useState(() =>
    readPersistedNumber(LAYOUT_TIMELINE_KEY, 288, TIMELINE_MIN_H, TIMELINE_MAX_H),
  );
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [viewMode, setViewMode] = useState<'timeline' | 'monthly'>('timeline');

  useEffect(() => {
    setViewMode('timeline');
  }, [activeScenarioId]);

  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const chartScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef<'timeline' | 'chart' | null>(null);

  const monthCount = Math.max(1, activeScenario?.durationMonths ?? 1);
  const timelineContentWidth = TIMELINE_LABEL_W + monthCount * TIMELINE_CELL_W;
  const chartPlotWidth = monthCount * TIMELINE_CELL_W;

  useEffect(() => {
    try {
      window.localStorage.setItem(LAYOUT_SIDEBAR_KEY, String(sidebarWidth));
    } catch {
      // ignore storage errors
    }
  }, [sidebarWidth]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LAYOUT_TIMELINE_KEY, String(timelineHeight));
    } catch {
      // ignore storage errors
    }
  }, [timelineHeight]);

  useEffect(() => {
    const currentBundle = getCurrentBundlePath();
    if (!currentBundle) return;

    let cancelled = false;

    const checkForUpdate = async () => {
      try {
        const response = await fetch(`/index.html?t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return;
        const html = await response.text();
        const latestBundle = extractLatestBundlePath(html);
        if (!latestBundle) return;
        if (latestBundle !== currentBundle && !cancelled) {
          setUpdateAvailable(true);
        }
      } catch {
        // ignore transient network errors
      }
    };

    const timer = window.setInterval(checkForUpdate, 45000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const toggleOverlay = (id: string) =>
    setOverlayIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const syncHorizontalScroll = (source: 'timeline' | 'chart', left: number) => {
    if (syncingRef.current && syncingRef.current !== source) return;
    syncingRef.current = source;

    const target = source === 'timeline' ? chartScrollRef.current : timelineScrollRef.current;
    if (target && Math.abs(target.scrollLeft - left) > 1) {
      target.scrollLeft = left;
    }

    requestAnimationFrame(() => {
      syncingRef.current = null;
    });
  };

  const startSidebarResize = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const body = document.body;
    const prevCursor = body.style.cursor;
    const prevUserSelect = body.style.userSelect;
    body.style.cursor = 'col-resize';
    body.style.userSelect = 'none';

    const onMove = (moveEvent: MouseEvent) => {
      const next = startWidth + (moveEvent.clientX - startX);
      setSidebarWidth(Math.min(SIDEBAR_MAX_W, Math.max(SIDEBAR_MIN_W, next)));
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      body.style.cursor = prevCursor;
      body.style.userSelect = prevUserSelect;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startTimelineResize = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = timelineHeight;

    const body = document.body;
    const prevCursor = body.style.cursor;
    const prevUserSelect = body.style.userSelect;
    body.style.cursor = 'row-resize';
    body.style.userSelect = 'none';

    const onMove = (moveEvent: MouseEvent) => {
      const next = startHeight + (moveEvent.clientY - startY);
      setTimelineHeight(Math.min(TIMELINE_MAX_H, Math.max(TIMELINE_MIN_H, next)));
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      body.style.cursor = prevCursor;
      body.style.userSelect = prevUserSelect;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const cleanOverlayIds = overlayIds.filter(
    (id) => id !== activeScenarioId && scenarios.some((s) => s.id === id),
  );

  const otherScenarios = scenarios.filter((s) => s.id !== activeScenarioId);

  const syncDotClass =
    syncStatus === 'online'
      ? 'bg-emerald-500'
      : syncStatus === 'connecting'
      ? 'bg-amber-400'
      : 'bg-rose-500';

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white overflow-hidden">
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-sm">📈</div>
          <div>
            <h1 className="text-sm font-semibold text-white leading-none">{t('Finanz-Simulator')}</h1>
            <p className="text-xs text-slate-500 leading-none mt-0.5">{t('Was-wäre-wenn Planung')}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400" title={t('Synchronisationsstatus')}>
            <span className={`w-2 h-2 rounded-full ${syncDotClass}`} />
            <span>Sync {syncStatus}</span>
          </div>
          <ProfileSwitcher />
          <button
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 transition-colors font-mono"
            onClick={() => setLang(getLang() === 'de' ? 'en' : 'de')}
            title="Language / Sprache"
          >
            <span className={getLang() === 'de' ? 'text-white font-semibold' : 'text-slate-500'}>DE</span>
            <span className="text-slate-600 mx-0.5">|</span>
            <span className={getLang() === 'en' ? 'text-white font-semibold' : 'text-slate-500'}>EN</span>
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            onClick={() => setShowAuditLog(true)}
            title={t('Änderungsprotokoll')}
          >
            📋
          </button>
          <ImportExportMenu />
          {scenarios.length > 1 && (
            <button
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                compareMode
                  ? 'bg-blue-600 text-white hover:bg-blue-500'
                  : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              onClick={() => setCompareMode(!compareMode)}
            >
              <span>{compareMode ? t('← Zurück') : t('⇄ Vergleich')}</span>
            </button>
          )}
        </div>
      </header>

      {updateAvailable && (
        <div className="shrink-0 bg-amber-950/80 border-b border-amber-700/70 px-6 py-2 flex items-center justify-between gap-3">
          <span className="text-xs text-amber-200">
            {t('Neue UI-Version verfügbar. Bitte neu laden, um das Update zu sehen.')}
          </span>
          <button
            className="px-2.5 py-1 rounded-md text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
            onClick={() => window.location.reload()}
          >
            {t('Neu laden')}
          </button>
        </div>
      )}

      {compareMode ? (
        <div className="flex-1 flex flex-col min-h-0 p-4">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-white">{t('Szenariovergleich')}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{t('{count} Szenarien im Vergleich', { count: scenarios.length })}</p>
          </div>
          <div className="flex-1 min-h-0 rounded-xl bg-slate-900 border border-slate-800 p-4">
            <ComparisonChart />
          </div>

          <div className="mt-4 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-2.5 text-slate-500 font-medium">{t('Szenario')}</th>
                  <th className="text-right px-4 py-2.5 text-slate-500 font-medium">{t('Startkapital')}</th>
                  <th className="text-right px-4 py-2.5 text-slate-500 font-medium">{t('Dauer')}</th>
                  <th className="text-right px-4 py-2.5 text-slate-500 font-medium">{t('Situationen')}</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((sc) => (
                  <tr key={sc.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sc.color }} />
                        <span className="text-white font-medium">{sc.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-300">
                      {formatEurLocalized(sc.initialBalance)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-300">{sc.durationMonths} {t('Mo.')}</td>
                    <td className="px-4 py-2.5 text-right text-slate-300">
                      {new Set(sc.entries.map((e) => e.situationId)).size}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          <SituationsSidebar width={sidebarWidth} />

          <div
            className="w-1.5 shrink-0 cursor-col-resize bg-slate-900 hover:bg-blue-500/60 active:bg-blue-500/80 transition-colors"
            onMouseDown={startSidebarResize}
            title={t('Breite der Situationsspalte anpassen')}
          />

          <div className="flex flex-col flex-1 min-w-0 min-h-0">
            <ScenarioTabs />
            <ScenarioSettings />

            {/* View mode toggle */}
            <div className="flex border-b border-slate-800 px-4 gap-1 py-1.5 shrink-0">
              <button
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  viewMode === 'timeline'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                onClick={() => setViewMode('timeline')}
              >
                {t('Zeitplan')}
              </button>
              <button
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  viewMode === 'monthly'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                onClick={() => setViewMode('monthly')}
              >
                {t('Monatsansicht')}
              </button>
            </div>

            {viewMode === 'monthly' && activeScenario ? (
              <div className="flex-1 min-h-0">
                <MonthlyBreakdown scenario={activeScenario} situations={situations} />
              </div>
            ) : (
              <div className="flex flex-col flex-1 min-h-0">
                <div
                  ref={timelineScrollRef}
                  onScroll={(e) => syncHorizontalScroll('timeline', e.currentTarget.scrollLeft)}
                  className="overflow-auto border-b border-slate-800 shrink-0"
                  style={{ height: timelineHeight }}
                >
                  <div className="min-w-0">
                    <TimelineEditor />
                  </div>
                </div>

                <div
                  className="h-1.5 shrink-0 cursor-row-resize bg-slate-900 hover:bg-blue-500/60 active:bg-blue-500/80 transition-colors"
                  onMouseDown={startTimelineResize}
                  title={t('Hoehe des Zeitplans anpassen')}
                />

                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="mb-2 px-4 pt-4 flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wide shrink-0">
                      {t('Kontostandverlauf')}
                    </span>
                    {otherScenarios.map((sc) => {
                      const active = cleanOverlayIds.includes(sc.id);
                      return (
                        <button
                          key={sc.id}
                          onClick={() => toggleOverlay(sc.id)}
                          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs border transition-colors"
                          style={
                            active
                              ? {
                                  borderColor: sc.color + 'aa',
                                  backgroundColor: sc.color + '22',
                                  color: 'white',
                                }
                              : { borderColor: '#334155', color: '#64748b' }
                          }
                          title={active ? t('{name} ausblenden', { name: sc.name }) : t('{name} einblenden', { name: sc.name })}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: sc.color, opacity: active ? 1 : 0.5 }}
                          />
                          {sc.name}
                        </button>
                      );
                    })}
                  </div>

                  <div
                    ref={chartScrollRef}
                    onScroll={(e) => syncHorizontalScroll('chart', e.currentTarget.scrollLeft)}
                    className="flex-1 min-h-0 overflow-x-auto pb-4"
                  >
                    <div style={{ width: timelineContentWidth, height: '100%' }}>
                      <div style={{ width: chartPlotWidth, height: '100%', marginLeft: TIMELINE_LABEL_W }}>
                        <BalanceChart overlayScenarioIds={cleanOverlayIds} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showAuditLog && <AuditLogPanel onClose={() => setShowAuditLog(false)} />}
    </div>
  );
}
