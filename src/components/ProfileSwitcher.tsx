import { useEffect, useRef, useState } from 'react';
import {
  getProfiles,
  getActiveProfileId,
  setActiveProfile,
  addProfile,
  updateProfile,
  deleteProfile,
  type Profile,
} from '../utils/profiles';

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

export function ProfileSwitcher() {
  const [open, setOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>(() => getProfiles());
  const activeId = getActiveProfileId();
  const activeProfile = profiles.find((p) => p.id === activeId) ?? profiles[0];

  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PROFILE_COLORS[0]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
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

  const handleSwitch = (id: string) => {
    if (id === activeId) {
      setOpen(false);
      return;
    }
    setActiveProfile(id); // triggers page reload
  };

  const handleCreateConfirm = () => {
    const name = newName.trim();
    if (!name) return;
    const profile = addProfile(name, newColor);
    setProfiles(getProfiles());
    setCreatingNew(false);
    setNewName('');
    setNewColor(PROFILE_COLORS[0]);
    // Switch to the new profile immediately
    setActiveProfile(profile.id);
  };

  const handleRenameConfirm = (id: string) => {
    const name = editingName.trim();
    if (name) {
      updateProfile(id, { name });
      setProfiles(getProfiles());
    }
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    deleteProfile(id);
    setProfiles(getProfiles());
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: activeProfile?.color ?? '#6366f1' }}
        />
        <span className="max-w-[96px] truncate">{activeProfile?.name ?? 'Standard'}</span>
        <svg
          className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Profile list */}
          <ul className="py-1">
            {profiles.map((profile) => (
              <li key={profile.id} className="group flex items-center gap-2 px-3 py-2 hover:bg-slate-800">
                {editingId === profile.id ? (
                  // Inline rename form
                  <form
                    className="flex-1 flex items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleRenameConfirm(profile.id);
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: profile.color }}
                    />
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => handleRenameConfirm(profile.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 bg-slate-700 text-white text-xs rounded px-1.5 py-0.5 outline-none min-w-0"
                    />
                  </form>
                ) : (
                  <>
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: profile.color }}
                    />
                    <button
                      className="flex-1 text-left text-xs text-slate-200 truncate"
                      onClick={() => handleSwitch(profile.id)}
                    >
                      {profile.name}
                    </button>
                    <div className="flex items-center gap-1">
                      {/* Rename button — visible on hover for all profiles */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingId(profile.id);
                            setEditingName(profile.name);
                          }}
                          className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                          title="Umbenennen"
                        >
                          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 2l3 3-8 8H3v-3L11 2z" strokeLinejoin="round" />
                          </svg>
                        </button>
                        {/* Delete (not default, not active) */}
                        {profile.id !== 'default' && profile.id !== activeId && (
                          <button
                            onClick={() => handleDelete(profile.id)}
                            className="text-slate-400 hover:text-rose-400 p-0.5 rounded transition-colors"
                            title="Löschen"
                          >
                            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" />
                            </svg>
                          </button>
                        )}
                      </div>
                      {/* Active checkmark */}
                      {profile.id === activeId && (
                        <svg
                          className="w-3.5 h-3.5 text-indigo-400 shrink-0"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>

          {/* Divider */}
          <div className="border-t border-slate-800" />

          {/* Create new profile */}
          {creatingNew ? (
            <div className="px-3 py-2 space-y-2">
              <input
                autoFocus
                placeholder="Profilname"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateConfirm();
                  if (e.key === 'Escape') {
                    setCreatingNew(false);
                    setNewName('');
                  }
                }}
                className="w-full bg-slate-800 border border-slate-600 text-white text-xs rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500"
              />
              {/* Color picker */}
              <div className="flex gap-1.5 flex-wrap">
                {PROFILE_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewColor(color)}
                    className={`w-5 h-5 rounded-full transition-transform ${
                      newColor === color ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-slate-900' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateConfirm}
                  disabled={!newName.trim()}
                  className="flex-1 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-1 transition-colors"
                >
                  Erstellen
                </button>
                <button
                  onClick={() => {
                    setCreatingNew(false);
                    setNewName('');
                  }}
                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreatingNew(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v10M3 8h10" strokeLinecap="round" />
              </svg>
              Neues Profil
            </button>
          )}
        </div>
      )}
    </div>
  );
}
