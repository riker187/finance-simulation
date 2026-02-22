import { uid } from './uid';

export interface Profile {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  pinHash?: string;
}

const PROFILES_KEY = 'finance-simulator-profiles';
const ACTIVE_KEY = 'finance-simulator-active-profile';

const DEFAULT_PROFILE: Profile = {
  id: 'default',
  name: 'Standard',
  color: '#6366f1',
  createdAt: '2024-01-01T00:00:00.000Z',
};

export function getProfiles(): Profile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [DEFAULT_PROFILE];
    const parsed = JSON.parse(raw) as Profile[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [DEFAULT_PROFILE];
    // Ensure default profile is always present
    const hasDefault = parsed.some((p) => p.id === 'default');
    return hasDefault ? parsed : [DEFAULT_PROFILE, ...parsed];
  } catch {
    return [DEFAULT_PROFILE];
  }
}

function saveProfiles(profiles: Profile[]): void {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  } catch {
    // ignore quota errors
  }
}

export function getActiveProfileId(): string {
  try {
    return localStorage.getItem(ACTIVE_KEY) || 'default';
  } catch {
    return 'default';
  }
}

export function getActiveProfile(): Profile {
  const id = getActiveProfileId();
  return getProfiles().find((p) => p.id === id) ?? DEFAULT_PROFILE;
}

export function setActiveProfile(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // ignore
  }
  window.location.reload();
}

export function addProfile(name: string, color: string): Profile {
  const profile: Profile = {
    id: uid(),
    name: name.trim() || 'Neues Profil',
    color,
    createdAt: new Date().toISOString(),
  };
  const profiles = getProfiles();
  profiles.push(profile);
  saveProfiles(profiles);
  return profile;
}

export function updateProfile(id: string, patch: Partial<Pick<Profile, 'name' | 'color'>>): void {
  const profiles = getProfiles();
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx === -1) return;
  profiles[idx] = { ...profiles[idx], ...patch };
  saveProfiles(profiles);
}

// ── PIN protection ────────────────────────────────────────────────────────────

// FNV-1a 32-bit hash — synchronous, works in all browser contexts (no secure context required)
function hashPin(pin: string): string {
  const input = 'finance-sim-v1:' + pin;
  let h1 = 0x811c9dc5;
  let h2 = 0x9747b28c;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= input.charCodeAt(input.length - 1 - i);
    h2 = Math.imul(h2, 0x5bd1e995);
  }
  return ((h1 >>> 0).toString(16).padStart(8, '0')) + ((h2 >>> 0).toString(16).padStart(8, '0'));
}

export function profileHasPin(id: string): boolean {
  return Boolean(getProfiles().find((p) => p.id === id)?.pinHash);
}

export function setProfilePin(id: string, pin: string): void {
  const hash = hashPin(pin);
  const profiles = getProfiles();
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx === -1) return;
  profiles[idx] = { ...profiles[idx], pinHash: hash };
  saveProfiles(profiles);
}

export function verifyProfilePin(id: string, pin: string): boolean {
  const profile = getProfiles().find((p) => p.id === id);
  if (!profile?.pinHash) return true;
  return hashPin(pin) === profile.pinHash;
}

export function clearProfilePin(id: string): void {
  const profiles = getProfiles();
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx === -1) return;
  const updated = { ...profiles[idx] };
  delete updated.pinHash;
  profiles[idx] = updated;
  saveProfiles(profiles);
}

export function deleteProfile(id: string): void {
  if (id === 'default') return; // never delete the default profile
  const profiles = getProfiles().filter((p) => p.id !== id);
  saveProfiles(profiles);
  // Also remove the profile's Zustand store data
  try {
    localStorage.removeItem(`finance-simulator-v1:${id}`);
  } catch {
    // ignore
  }
  // Also remove the profile's audit log
  try {
    localStorage.removeItem(`finance-simulator-audit:${id}`);
  } catch {
    // ignore
  }
}
