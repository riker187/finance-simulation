import { useEffect, useRef, useState } from 'react';
import {
  getProfiles,
  getActiveProfileId,
  setActiveProfile,
  addProfile,
  updateProfile,
  deleteProfile,
  profileHasPin,
  setProfilePin,
  verifyProfilePin,
  clearProfilePin,
  type Profile,
} from '../utils/profiles';
import { useT } from '../utils/i18n';

const PROFILE_COLORS = [
  '#6366f1', // indigo
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // rose
  '#a855f7', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
];

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="7" width="10" height="8" rx="1.5" />
      {locked ? (
        <path d="M5 7V5a3 3 0 016 0v2" strokeLinecap="round" />
      ) : (
        <path d="M5 7V5.5A3 3 0 0111 5.5" strokeLinecap="round" />
      )}
    </svg>
  );
}

function PinInput({
  label,
  value,
  onChange,
  onEnter,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-slate-400">{label}</label>
      <input
        type="password"
        inputMode="numeric"
        maxLength={4}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
        onKeyDown={(e) => { if (e.key === 'Enter') onEnter?.(); }}
        placeholder="••••"
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm text-center tracking-[0.5em] focus:outline-none focus:border-indigo-500 placeholder-slate-600"
      />
    </div>
  );
}

export function ProfileSwitcher() {
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>(() => getProfiles());
  const activeId = getActiveProfileId();
  const activeProfile = profiles.find((p) => p.id === activeId) ?? profiles[0];
  const t = useT();

  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PROFILE_COLORS[0]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // PIN unlock (switching to a protected profile)
  const [pinUnlockId, setPinUnlockId] = useState<string | null>(null);
  const [pinUnlockEntry, setPinUnlockEntry] = useState('');
  const [pinUnlockError, setPinUnlockError] = useState(false);

  // PIN management (set / change / remove)
  const [pinManageId, setPinManageId] = useState<string | null>(null);
  const [pinManageStep, setPinManageStep] = useState<'main' | 'remove' | 'change'>('main');
  const [pinCurrent, setPinCurrent] = useState('');
  const [pinNew, setPinNew] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinManageError, setPinManageError] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreatingNew(false);
        setEditingId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const refreshProfiles = () => setProfiles(getProfiles());

  const handleSwitch = (id: string) => {
    if (id === activeId) { setOpen(false); return; }
    if (profileHasPin(id)) {
      setPinUnlockId(id);
      setPinUnlockEntry('');
      setPinUnlockError(false);
      setOpen(false);
    } else {
      setActiveProfile(id);
    }
  };

  const handlePinUnlock = () => {
    if (!pinUnlockId) return;
    const ok = verifyProfilePin(pinUnlockId, pinUnlockEntry);
    if (ok) {
      setActiveProfile(pinUnlockId);
    } else {
      setPinUnlockError(true);
      setPinUnlockEntry('');
    }
  };

  const openPinManage = (id: string) => {
    setPinManageId(id);
    setPinManageStep('main');
    setPinCurrent('');
    setPinNew('');
    setPinConfirm('');
    setPinManageError('');
    setOpen(false);
  };

  const handleSetPin = () => {
    if (!pinManageId) return;
    if (pinNew.length !== 4) { setPinManageError(t('PIN muss genau 4 Ziffern haben')); return; }
    if (pinNew !== pinConfirm) { setPinManageError(t('PINs stimmen nicht überein')); return; }
    setProfilePin(pinManageId, pinNew);
    refreshProfiles();
    setPinManageId(null);
  };

  const handleRemovePin = () => {
    if (!pinManageId) return;
    const ok = verifyProfilePin(pinManageId, pinCurrent);
    if (!ok) { setPinManageError(t('Falscher PIN')); setPinCurrent(''); return; }
    clearProfilePin(pinManageId);
    refreshProfiles();
    setPinManageId(null);
  };

  const handleChangePin = () => {
    if (!pinManageId) return;
    const ok = verifyProfilePin(pinManageId, pinCurrent);
    if (!ok) { setPinManageError(t('Aktueller PIN falsch')); setPinCurrent(''); return; }
    if (pinNew.length !== 4) { setPinManageError(t('Neuer PIN muss 4 Ziffern haben')); return; }
    if (pinNew !== pinConfirm) { setPinManageError(t('Neue PINs stimmen nicht überein')); return; }
    setProfilePin(pinManageId, pinNew);
    refreshProfiles();
    setPinManageId(null);
  };

  const handleCreateConfirm = () => {
    const name = newName.trim();
    if (!name) return;
    const profile = addProfile(name, newColor);
    refreshProfiles();
    setCreatingNew(false);
    setNewName('');
    setNewColor(PROFILE_COLORS[0]);
    setActiveProfile(profile.id);
  };

  const handleRenameConfirm = (id: string) => {
    const name = editingName.trim();
    if (name) { updateProfile(id, { name }); refreshProfiles(); }
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    deleteProfile(id);
    refreshProfiles();
  };

  const pinManageProfile = profiles.find((p) => p.id === pinManageId);
  const pinManageHasPin = pinManageId ? profileHasPin(pinManageId) : false;

  return (
    <>
      <div ref={containerRef} className="relative">
        {/* Trigger */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
        >
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: activeProfile?.color ?? '#6366f1' }} />
          <span className="max-w-[96px] truncate">{activeProfile?.name ?? 'Standard'}</span>
          {profileHasPin(activeId) && <LockIcon locked={true} />}
          <svg className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute left-0 top-full mt-1 w-60 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
            <ul className="py-1">
              {profiles.map((profile) => (
                <li key={profile.id} className="group flex items-center gap-2 px-3 py-2 hover:bg-slate-800">
                  {editingId === profile.id ? (
                    <form className="flex-1 flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); handleRenameConfirm(profile.id); }}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: profile.color }} />
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => handleRenameConfirm(profile.id)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setEditingId(null); }}
                        className="flex-1 bg-slate-700 text-white text-xs rounded px-1.5 py-0.5 outline-none min-w-0"
                      />
                    </form>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: profile.color }} />
                      <button className="flex-1 text-left text-xs text-slate-200 truncate" onClick={() => handleSwitch(profile.id)}>
                        {profile.name}
                      </button>
                      <div className="flex items-center gap-1">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Rename */}
                          <button
                            onClick={() => { setEditingId(profile.id); setEditingName(profile.name); }}
                            className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                            title={t('Umbenennen')}
                          >
                            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 2l3 3-8 8H3v-3L11 2z" strokeLinejoin="round" />
                            </svg>
                          </button>
                          {/* PIN */}
                          <button
                            onClick={() => openPinManage(profile.id)}
                            className={`p-0.5 rounded transition-colors ${profile.pinHash ? 'text-indigo-400 hover:text-indigo-300' : 'text-slate-400 hover:text-white'}`}
                            title={profile.pinHash ? t('PIN verwalten') : t('PIN festlegen')}
                          >
                            <LockIcon locked={Boolean(profile.pinHash)} />
                          </button>
                          {/* Delete */}
                          {profile.id !== 'default' && profile.id !== activeId && (
                            <button
                              onClick={() => handleDelete(profile.id)}
                              className="text-slate-400 hover:text-rose-400 p-0.5 rounded transition-colors"
                              title={t('Löschen')}
                            >
                              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {/* Active checkmark */}
                        {profile.id === activeId && (
                          <svg className="w-3.5 h-3.5 text-indigo-400 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>

            <div className="border-t border-slate-800" />

            {creatingNew ? (
              <div className="px-3 py-2 space-y-2">
                <input
                  autoFocus
                  placeholder={t('Profilname')}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateConfirm(); if (e.key === 'Escape') { setCreatingNew(false); setNewName(''); } }}
                  className="w-full bg-slate-800 border border-slate-600 text-white text-xs rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {PROFILE_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewColor(color)}
                      className={`w-5 h-5 rounded-full transition-transform ${newColor === color ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-slate-900' : 'hover:scale-110'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCreateConfirm} disabled={!newName.trim()} className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-1 transition-colors">
                    {t('Erstellen')}
                  </button>
                  <button onClick={() => { setCreatingNew(false); setNewName(''); }} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg transition-colors">
                    {t('Abbrechen')}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setCreatingNew(true)} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3v10M3 8h10" strokeLinecap="round" />
                </svg>
                {t('Neues Profil')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* PIN unlock modal */}
      {pinUnlockId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-72 rounded-2xl bg-slate-800 border border-slate-700 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-indigo-400"><LockIcon locked={true} /></span>
              <h3 className="text-white font-semibold text-sm">{t('PIN eingeben')}</h3>
            </div>
            <p className="text-slate-400 text-xs">
              {t('Profil: {name}', { name: profiles.find((p) => p.id === pinUnlockId)?.name ?? '' })}
            </p>
            <PinInput
              label={t('PIN (4 Stellen)')}
              value={pinUnlockEntry}
              onChange={setPinUnlockEntry}
              onEnter={handlePinUnlock}
              autoFocus
            />
            {pinUnlockError && (
              <p className="text-red-400 text-xs text-center">{t('Falscher PIN. Bitte erneut versuchen.')}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setPinUnlockId(null)}
                className="flex-1 px-3 py-2 text-sm text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                {t('Abbrechen')}
              </button>
              <button
                onClick={handlePinUnlock}
                disabled={pinUnlockEntry.length !== 4}
                className="flex-1 px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                {t('Entsperren')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN management modal */}
      {pinManageId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-80 rounded-2xl bg-slate-800 border border-slate-700 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">
                {pinManageHasPin ? t('PIN verwalten') : t('PIN festlegen')}
              </h3>
              <button onClick={() => setPinManageId(null)} className="text-slate-400 hover:text-white text-lg leading-none">✕</button>
            </div>
            <p className="text-slate-400 text-xs">
              {t('Profil: {name}', { name: pinManageProfile?.name ?? '' })}
            </p>

            {pinManageStep === 'main' && (
              <>
                {pinManageHasPin ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-950/50 border border-indigo-500/30">
                      <span className="text-indigo-400 text-xs"><LockIcon locked={true} /></span>
                      <span className="text-indigo-300 text-xs">{t('PIN ist aktiv')}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setPinManageStep('remove'); setPinCurrent(''); setPinManageError(''); }}
                        className="flex-1 px-3 py-2 text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
                      >
                        {t('PIN entfernen')}
                      </button>
                      <button
                        onClick={() => { setPinManageStep('change'); setPinCurrent(''); setPinNew(''); setPinConfirm(''); setPinManageError(''); }}
                        className="flex-1 px-3 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                      >
                        {t('PIN ändern')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <PinInput label={t('Neuer PIN (4 Ziffern)')} value={pinNew} onChange={setPinNew} autoFocus />
                    <PinInput label={t('PIN bestätigen')} value={pinConfirm} onChange={setPinConfirm} onEnter={handleSetPin} />
                    {pinManageError && <p className="text-red-400 text-xs">{pinManageError}</p>}
                    <button
                      onClick={handleSetPin}
                      disabled={pinNew.length !== 4 || pinConfirm.length !== 4}
                      className="w-full px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                    >
                      {t('PIN festlegen')}
                    </button>
                  </div>
                )}
              </>
            )}

            {pinManageStep === 'remove' && (
              <div className="space-y-3">
                <PinInput label={t('Aktuellen PIN eingeben')} value={pinCurrent} onChange={setPinCurrent} onEnter={handleRemovePin} autoFocus />
                {pinManageError && <p className="text-red-400 text-xs">{pinManageError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setPinManageStep('main')} className="flex-1 px-3 py-2 text-sm text-slate-400 hover:text-white rounded-lg transition-colors">
                    {t('Zurück')}
                  </button>
                  <button
                    onClick={handleRemovePin}
                    disabled={pinCurrent.length !== 4}
                    className="flex-1 px-3 py-2 text-sm bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                  >
                    {t('PIN entfernen')}
                  </button>
                </div>
              </div>
            )}

            {pinManageStep === 'change' && (
              <div className="space-y-3">
                <PinInput label={t('Aktueller PIN')} value={pinCurrent} onChange={setPinCurrent} autoFocus />
                <PinInput label={t('Neuer PIN (4 Ziffern)')} value={pinNew} onChange={setPinNew} />
                <PinInput label={t('Neuen PIN bestätigen')} value={pinConfirm} onChange={setPinConfirm} onEnter={handleChangePin} />
                {pinManageError && <p className="text-red-400 text-xs">{pinManageError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setPinManageStep('main')} className="flex-1 px-3 py-2 text-sm text-slate-400 hover:text-white rounded-lg transition-colors">
                    {t('Zurück')}
                  </button>
                  <button
                    onClick={handleChangePin}
                    disabled={pinCurrent.length !== 4 || pinNew.length !== 4 || pinConfirm.length !== 4}
                    className="flex-1 px-3 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                  >
                    {t('PIN ändern')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
