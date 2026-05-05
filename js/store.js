// ─── Storage Keys ───────────────────────────────────────────────────────────
export const KEYS = {
  USERS:    'jrn_users',
  SESSION:  'jrn_session',
  ENTRIES:  'jrn_entries_v3',
  PREFS:    'jrn_prefs_v2',
  PROFILES: 'jrn_profiles',
};

// ─── Password hashing via Web Crypto API (SHA-256 with static pepper) ────────
export async function hashPassword(pw) {
  const encoder = new TextEncoder();
  const data    = encoder.encode('jrn_pepper_v3:' + pw);
  const buf     = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Users ───────────────────────────────────────────────────────────────────
export function loadUsers() {
  try { return JSON.parse(localStorage.getItem(KEYS.USERS)) || []; } catch { return []; }
}
export function saveUsers(arr) { localStorage.setItem(KEYS.USERS, JSON.stringify(arr)); }

// ─── Session ─────────────────────────────────────────────────────────────────
export function getSession() {
  try { return JSON.parse(localStorage.getItem(KEYS.SESSION)); } catch { return null; }
}
export function setSession(u) { localStorage.setItem(KEYS.SESSION, JSON.stringify(u)); }
export function clearSession() { localStorage.removeItem(KEYS.SESSION); }

// ─── Entries ─────────────────────────────────────────────────────────────────
// Schema: { id, userId, content, mood, date, wordCount, tags[], isFavorite, prompt, updatedAt? }

export function loadAllEntries() {
  try {
    const p = JSON.parse(localStorage.getItem(KEYS.ENTRIES));
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}
export function saveAllEntries(arr) { localStorage.setItem(KEYS.ENTRIES, JSON.stringify(arr)); }

export function loadEntries(userId) {
  return loadAllEntries().filter(e => e && e.userId === userId);
}

export function upsertEntry(entry) {
  const all = loadAllEntries();
  const idx = all.findIndex(e => e.id === entry.id);
  if (idx >= 0) all[idx] = entry; else all.push(entry);
  saveAllEntries(all);
  return entry;
}

export function removeEntry(id) {
  saveAllEntries(loadAllEntries().filter(e => e.id !== id));
}

// ─── Profiles (per user) ─────────────────────────────────────────────────────
export function loadProfile(userId) {
  try {
    const all = JSON.parse(localStorage.getItem(KEYS.PROFILES)) || [];
    return all.find(p => p.userId === userId) || null;
  } catch { return null; }
}
export function saveProfile(profile) {
  try {
    const all = (JSON.parse(localStorage.getItem(KEYS.PROFILES)) || [])
      .filter(p => p.userId !== profile.userId);
    all.push(profile);
    localStorage.setItem(KEYS.PROFILES, JSON.stringify(all));
  } catch {}
}

// ─── Preferences (app-wide) ──────────────────────────────────────────────────
export function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(KEYS.PREFS)) || {}; } catch { return {}; }
}
export function savePrefs(p) { localStorage.setItem(KEYS.PREFS, JSON.stringify(p)); }

// ─── Daily Intention (per user, per calendar day) ────────────────────────────
export function loadIntention(userId) {
  try {
    const d = JSON.parse(localStorage.getItem('jrn_intention_' + userId));
    return (d && d.date === new Date().toDateString()) ? (d.text || '') : '';
  } catch { return ''; }
}
export function saveIntention(userId, text) {
  localStorage.setItem('jrn_intention_' + userId,
    JSON.stringify({ date: new Date().toDateString(), text }));
}

// ─── Migrate old v2 flat-text entries for a newly-registered user ─────────────
export function migrateOldEntries(userId) {
  const OLD_KEY = 'journal_entries_v2';
  try {
    const old = JSON.parse(localStorage.getItem(OLD_KEY));
    if (!Array.isArray(old) || old.length === 0) return 0;
    if (loadEntries(userId).length > 0) return 0; // already have data
    const migrated = old.map(e => ({
      id: String(typeof e.id === 'number' ? e.id : crypto.randomUUID()),
      userId,
      content: e.text || '',
      mood: e.mood || '📝',
      date: e.date || new Date().toISOString(),
      wordCount: e.text ? e.text.trim().split(/\s+/).filter(Boolean).length : 0,
      tags: [],
      isFavorite: !!e.favorite,
      prompt: e.prompt || '',
    }));
    saveAllEntries([...loadAllEntries(), ...migrated]);
    localStorage.removeItem(OLD_KEY);
    return migrated.length;
  } catch { return 0; }
}
