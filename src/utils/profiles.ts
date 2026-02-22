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

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode('finance-sim-v1:' + pin);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function profileHasPin(id: string): boolean {
  return Boolean(getProfiles().find((p) => p.id === id)?.pinHash);
}

export async function setProfilePin(id: string, pin: string): Promise<void> {
  const hash = await hashPin(pin);
  const profiles = getProfiles();
  const idx = profiles.findIndex((p) => p.id === id);
  if (idx === -1) return;
  profiles[idx] = { ...profiles[idx], pinHash: hash };
  saveProfiles(profiles);
}

export async function verifyProfilePin(id: string, pin: string): Promise<boolean> {
  const profile = getProfiles().find((p) => p.id === id);
  if (!profile?.pinHash) return true;
  const hash = await hashPin(pin);
  return hash === profile.pinHash;
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
