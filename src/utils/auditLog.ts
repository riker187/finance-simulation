import { uid } from './uid';

export interface AuditEntry {
  id: string;
  timestamp: string; // ISO 8601
  label: string;
  detail?: string;
}

const STORAGE_KEY = 'finance-simulator-audit';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function pruneOld(entries: AuditEntry[]): AuditEntry[] {
  const cutoff = Date.now() - MAX_AGE_MS;
  return entries.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
}

function load(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return pruneOld(JSON.parse(raw) as AuditEntry[]);
  } catch {
    return [];
  }
}

function save(entries: AuditEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore quota errors
  }
}

// Never throws — logging must never block store actions
export function logAuditEntry(label: string, detail?: string): void {
  try {
    const entries = load();
    entries.push({ id: uid(), timestamp: new Date().toISOString(), label, detail });
    save(entries);
  } catch {
    // silently ignore
  }
}

export function getAuditEntries(): AuditEntry[] {
  return load().reverse(); // newest first
}

export function clearAuditLog(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Debounced logging for high-frequency actions (e.g. timeline painting).
// Multiple calls with the same key within delayMs are collapsed into one entry.
const _debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function logDebounced(
  key: string,
  label: string,
  detail?: string,
  delayMs = 1500,
): void {
  const existing = _debounceTimers.get(key);
  if (existing !== undefined) clearTimeout(existing);
  _debounceTimers.set(
    key,
    setTimeout(() => {
      logAuditEntry(label, detail);
      _debounceTimers.delete(key);
    }, delayMs),
  );
}
