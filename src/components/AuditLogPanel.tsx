import { useEffect, useState } from 'react';
import { getAuditEntries, clearAuditLog, type AuditEntry } from '../utils/auditLog';
import { useT, getLang } from '../utils/i18n';

function formatTimestamp(
  iso: string,
  t: (key: string, vars?: Record<string, string | number>) => string,
  lang: string,
): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return t('gerade eben');
  if (diffMin < 60) return t('vor {diffMin} Min.', { diffMin });

  const locale = lang === 'en' ? 'en-US' : 'de-DE';
  const time = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  if (now.toDateString() === date.toDateString()) return t('heute {time}', { time });

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (yesterday.toDateString() === date.toDateString()) return t('gestern {time}', { time });

  const day = date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
  return `${day} ${time}`;
}

// Icon/color detection depends on German keywords stored in audit log entries — keep as-is
function entryIcon(label: string): string {
  if (label.includes('hinzugefügt')) return '＋';
  if (label.includes('gelöscht')) return '✕';
  if (label.includes('dupliziert')) return '⧉';
  if (label.includes('importiert')) return '↓';
  if (label.includes('Zeitplan')) return '▦';
  if (label.includes('Effekt')) return '◎';
  return '✎';
}

function iconColor(label: string): string {
  if (label.includes('hinzugefügt')) return 'text-emerald-400';
  if (label.includes('gelöscht')) return 'text-rose-400';
  if (label.includes('dupliziert')) return 'text-sky-400';
  if (label.includes('importiert')) return 'text-violet-400';
  return 'text-slate-400';
}

interface Props {
  onClose: () => void;
}

export function AuditLogPanel({ onClose }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const t = useT();

  useEffect(() => {
    setEntries(getAuditEntries());
  }, []);

  const handleClear = () => {
    clearAuditLog();
    setEntries([]);
  };

  const lang = getLang();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg mx-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col"
        style={{ maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">{t('Änderungsprotokoll')}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{t('Letzte 7 Tage · {count} Einträge', { count: entries.length })}</p>
          </div>
          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <button
                className="text-xs text-slate-400 hover:text-rose-400 px-2 py-1 rounded transition-colors"
                onClick={handleClear}
              >
                {t('Leeren')}
              </button>
            )}
            <button
              className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm transition-colors"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <span className="text-3xl mb-3">📋</span>
              <p className="text-sm">{t('Noch keine Änderungen protokolliert.')}</p>
              <p className="text-xs mt-1 text-slate-600">
                {t('Änderungen werden ab jetzt aufgezeichnet.')}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-800/60">
              {entries.map((entry) => (
                <li key={entry.id} className="px-5 py-3 hover:bg-slate-800/40">
                  <div className="flex items-start gap-3">
                    <span
                      className={`text-xs font-mono mt-0.5 w-4 shrink-0 text-center ${iconColor(entry.label)}`}
                    >
                      {entryIcon(entry.label)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm text-slate-200 leading-snug">{entry.label}</span>
                        <span className="text-xs text-slate-500 whitespace-nowrap shrink-0 mt-0.5">
                          {formatTimestamp(entry.timestamp, t, lang)}
                        </span>
                      </div>
                      {entry.detail && (
                        <p className="text-xs text-slate-400 mt-0.5 leading-snug">{entry.detail}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
