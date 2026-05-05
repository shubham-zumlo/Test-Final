import { signUp, logIn, logOut, getCurrentUser } from './auth.js';
import {
  loadEntries, loadAllEntries, saveAllEntries,
  upsertEntry, removeEntry,
  loadProfile, saveProfile,
  loadPrefs, savePrefs,
  loadIntention, saveIntention,
  migrateOldEntries,
} from './store.js';
import {
  nav, showScreen, showToast,
  showAuthScreen, hideAuthScreen, switchAuthTab, showAuthError, clearAuthErrors,
  applyDarkMode, renderSkeleton, pulse, formatDate, escHtml,
} from './ui.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const AVATARS = ['🧑', '👩', '🧔', '👧', '🦋', '🌙', '🌟', '🐱', '🦊', '🐻'];

const MOOD_COLORS = {
  '😄': '#4caf81', '🙂': '#8bc34a', '😐': '#ffc107',
  '😔': '#ff9800', '😤': '#f44336', '📝': '#b0b8b0',
};

const PROMPTS = [
  'What quietly took care of you today?',
  'What are you grateful for right now?',
  'What made you smile today?',
  'What would you like to let go of today?',
  'What is something you learned today?',
  'What moment do you want to remember?',
  'How did you show kindness today?',
  'What challenged you and how did you grow?',
  'What brought you peace today?',
  'What are you looking forward to tomorrow?',
];

const STARTERS = [
  'Today I noticed…',
  'Something that surprised me was…',
  'I felt grateful when…',
  'A small joy today was…',
  'I\'m thinking about…',
  'What I want to remember is…',
];

// ─── App State ────────────────────────────────────────────────────────────────
const state = {
  user: null,
  activeFilter: 'all',
  selectedWriteMood: '',
  currentPromptIdx: 0,
  detailEntryId: null,
  editingEntryId: null,
  selectedSignupAvatar: AVATARS[0],
  selectedModalAvatar: AVATARS[0],
};

// ─── Utilities ────────────────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function wordCount(text) {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

function parseTags(str) {
  return str.split(',')
    .map(t => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''))
    .filter(Boolean)
    .slice(0, 5);
}

function renderTagPills(tags) {
  if (!tags || !tags.length) return '';
  return tags.map(t => `<span class="tag-pill">#${escHtml(t)}</span>`).join('');
}

// ─── Clock ────────────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  let h = now.getHours(), m = now.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const el = document.getElementById('status-time');
  if (el) el.textContent = `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// ─── Wrapped showScreen (triggers data refresh) ───────────────────────────────
function appNav(name, skipHistory) {
  showScreen(name, skipHistory);
  if (name === 'home')     refreshHome();
  if (name === 'entries')  renderEntriesList();
  if (name === 'settings') refreshSettingsProfile();
}

// Expose globally so HTML onclick attrs work
window.showScreen = appNav;

// ─── Auth handlers ────────────────────────────────────────────────────────────
function handleSignUp(e) {
  e.preventDefault();
  const email    = document.getElementById('signup-email')?.value.trim() || '';
  const password = document.getElementById('signup-password')?.value || '';
  const name     = document.getElementById('signup-name')?.value.trim() || 'Friend';

  const result = signUp(email, password);
  if (!result.ok) { showAuthError('auth-signup', result.error); return; }

  saveProfile({ userId: result.user.id, name, avatar: state.selectedSignupAvatar });
  state.user = result.user;
  migrateOldEntries(state.user.id);
  hideAuthScreen();
  afterLogin();
  showToast(`Welcome, ${name}! 🎉`);
}

function handleLogIn(e) {
  e.preventDefault();
  const email    = document.getElementById('login-email')?.value.trim() || '';
  const password = document.getElementById('login-password')?.value || '';

  const result = logIn(email, password);
  if (!result.ok) { showAuthError('auth-login', result.error); return; }

  state.user = result.user;
  migrateOldEntries(state.user.id);
  hideAuthScreen();
  afterLogin();
  const profile = loadProfile(state.user.id);
  showToast(`Welcome back, ${profile?.name || state.user.email.split('@')[0]}! 👋`);
}

function afterLogin() {
  const prefs = loadPrefs();
  applyDarkMode(!!prefs.darkMode);
  refreshHome();
  showScreen('home');
  refreshSettingsProfile();
}

window.handleLogOut = function() {
  if (!confirm('Log out of your account?')) return;
  logOut();
  state.user = null;
  state.detailEntryId = null;
  state.editingEntryId = null;
  // Reset visual state
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-home')?.classList.add('active');
  nav.current = 'home';
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-home')?.classList.add('active');
  showAuthScreen('login');
  showToast('Logged out. See you soon! 👋');
};

// Expose auth tab switch for HTML onclick
window.switchAuthTab = switchAuthTab;

// ─── Navigation helpers ───────────────────────────────────────────────────────
window.goHome  = function() { state.editingEntryId = null; appNav('home'); };
window.goWrite = function() { state.editingEntryId = null; appNav('write'); };

// ─── Write Screen ─────────────────────────────────────────────────────────────
window.onInput = function() {
  const val = document.getElementById('entry-input')?.value.trim() || '';
  document.getElementById('save-btn').disabled = val === '';
  const wc = wordCount(val);
  document.getElementById('word-count').textContent = `${wc} word${wc !== 1 ? 's' : ''}`;
};

window.nextPrompt = function() {
  state.currentPromptIdx = (state.currentPromptIdx + 1) % PROMPTS.length;
  document.getElementById('prompt-text').textContent = PROMPTS[state.currentPromptIdx];
};

window.helpWrite = function() {
  const ta = document.getElementById('entry-input');
  if (!ta?.value.trim()) {
    ta.value = STARTERS[Math.floor(Math.random() * STARTERS.length)];
    window.onInput();
  }
  ta?.focus();
};

window.editPrompt = function() {
  const el = document.getElementById('prompt-text');
  const custom = window.prompt('Enter your own prompt:', el?.textContent);
  if (custom?.trim()) el.textContent = custom.trim();
};

window.setWriteMood = function(mood, btn) {
  state.selectedWriteMood = mood;
  document.querySelectorAll('.write-mood-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  pulse(btn);
};

window.saveEntry = function() {
  if (!state.user) return;
  const ta      = document.getElementById('entry-input');
  const text    = ta?.value.trim();
  if (!text) return;
  const tagsRaw = document.getElementById('tags-input')?.value || '';
  const tags    = parseTags(tagsRaw);

  if (state.editingEntryId !== null) {
    // Update existing entry
    const all = loadAllEntries();
    const idx = all.findIndex(e => e.id === state.editingEntryId);
    if (idx >= 0) {
      all[idx] = {
        ...all[idx],
        content:   text,
        mood:      state.selectedWriteMood || all[idx].mood || '📝',
        tags,
        wordCount: wordCount(text),
        prompt:    document.getElementById('prompt-text')?.textContent || '',
        updatedAt: new Date().toISOString(),
      };
      saveAllEntries(all);
    }
    state.editingEntryId = null;
    showToast('Entry updated! ✓');
  } else {
    upsertEntry({
      id:        uid(),
      userId:    state.user.id,
      content:   text,
      mood:      state.selectedWriteMood || '📝',
      date:      new Date().toISOString(),
      wordCount: wordCount(text),
      tags,
      isFavorite: false,
      prompt:    document.getElementById('prompt-text')?.textContent || '',
    });
    showToast('Entry saved! 🎉');
  }

  // Reset write form
  if (ta) ta.value = '';
  const ti = document.getElementById('tags-input');
  if (ti) ti.value = '';
  state.selectedWriteMood = '';
  document.querySelectorAll('.write-mood-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('save-btn').disabled = true;
  document.getElementById('word-count').textContent = '0 words';
  appNav('home');
};

// ─── Home Screen ──────────────────────────────────────────────────────────────
function refreshHome() {
  if (!state.user) return;
  const profile = loadProfile(state.user.id);
  const name    = profile?.name || state.user.email.split('@')[0];
  const avatar  = profile?.avatar ? ' ' + profile.avatar : '';
  const now     = new Date();
  const hour    = now.getHours();
  const greet   = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const greetEl = document.getElementById('home-greeting');
  const dateEl  = document.getElementById('home-date');
  if (greetEl) greetEl.textContent = `${greet}, ${name}!${avatar}`;
  if (dateEl)  dateEl.textContent  = now.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const entries    = loadEntries(state.user.id);
  const totalWords = entries.reduce((s, e) => s + (e.wordCount || 0), 0);
  const weekAgo    = new Date(now - 7 * 86400000);

  document.getElementById('total-entries').textContent = entries.length;
  document.getElementById('total-words').textContent   =
    totalWords > 999 ? (totalWords / 1000).toFixed(1) + 'k' : totalWords;
  document.getElementById('this-week').textContent     =
    entries.filter(e => new Date(e.date) >= weekAgo).length;

  const streak = calcStreak(entries);
  document.getElementById('streak-count').textContent = streak.current;
  document.getElementById('best-streak').textContent  = streak.best;

  // Restore today's mood selection
  const prefs = loadPrefs();
  if (prefs.todayMoodDate === now.toDateString() && prefs.todayMood) {
    document.querySelectorAll('#home-mood-row .mood-btn').forEach(b =>
      b.classList.toggle('selected', b.dataset.mood === prefs.todayMood));
  } else {
    document.querySelectorAll('#home-mood-row .mood-btn').forEach(b =>
      b.classList.remove('selected'));
  }

  // Restore intention
  const intEl = document.getElementById('intention-input');
  if (intEl) intEl.value = loadIntention(state.user.id);

  // Mood chart
  renderMoodChart(entries, now);

  // Recent entries
  const recentEl = document.getElementById('home-recent');
  if (!recentEl) return;
  const recent = entries.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);
  if (recent.length === 0) {
    recentEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✍️</div>
        <div class="empty-state-text">No entries yet — start writing!</div>
      </div>`;
    return;
  }
  recentEl.innerHTML = recent.map(e => `
    <div class="entry-card" onclick="openDetail('${e.id}')">
      <div class="entry-card-date">${formatDate(e.date)}</div>
      <div class="entry-card-preview">${escHtml(e.content)}</div>
      ${e.tags?.length ? `<div class="entry-tags">${renderTagPills(e.tags)}</div>` : ''}
      <div class="entry-card-mood">${e.mood || '📝'}</div>
    </div>
  `).join('');
}

window.setHomeMood = function(mood, btn) {
  document.querySelectorAll('#home-mood-row .mood-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  pulse(btn);
  const prefs = loadPrefs();
  prefs.todayMood = mood;
  prefs.todayMoodDate = new Date().toDateString();
  savePrefs(prefs);
};

window.saveIntention = function() {
  if (!state.user) return;
  const text = document.getElementById('intention-input')?.value || '';
  saveIntention(state.user.id, text);
};

function calcStreak(entries) {
  if (!entries.length) return { current: 0, best: 0 };
  const days   = new Set(entries.map(e => new Date(e.date).toDateString()));
  const dayArr = Array.from(days).map(d => new Date(d)).sort((a, b) => b - a);
  const today  = new Date().toDateString();
  const yest   = new Date(Date.now() - 86400000).toDateString();
  let current  = 0;
  if (dayArr[0].toDateString() === today || dayArr[0].toDateString() === yest) {
    current = 1;
    for (let i = 1; i < dayArr.length; i++) {
      if ((dayArr[i - 1] - dayArr[i]) / 86400000 === 1) current++;
      else break;
    }
  }
  let streak = 1, best = current;
  for (let i = 1; i < dayArr.length; i++) {
    if ((dayArr[i - 1] - dayArr[i]) / 86400000 === 1) { streak++; best = Math.max(best, streak); }
    else streak = 1;
  }
  return { current, best };
}

function renderMoodChart(entries, now) {
  const bars = document.getElementById('mood-chart-bars');
  if (!bars) return;
  const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now); d.setDate(d.getDate() - (6 - i)); return d;
  });
  bars.innerHTML = days.map(day => {
    const ds  = day.toDateString();
    const de  = entries.filter(e => new Date(e.date).toDateString() === ds);
    let mood  = null;
    if (de.length) {
      const c = {};
      de.forEach(e => { const m = e.mood || '📝'; c[m] = (c[m] || 0) + 1; });
      mood = Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
    }
    const color   = mood ? (MOOD_COLORS[mood] || '#b0b8b0') : 'rgba(200,200,200,0.3)';
    const barH    = mood ? 34 : 5;
    const isToday = ds === now.toDateString();
    return `<div class="mood-chart-bar-col">
      ${mood ? `<div class="mood-chart-emoji">${mood}</div>` : '<div style="height:14px"></div>'}
      <div class="mood-chart-bar" style="height:${barH}px;background:${color};opacity:${isToday ? 1 : 0.72}"></div>
      <div class="mood-chart-day" style="${isToday ? 'color:var(--accent-dark);font-weight:800' : ''}">
        ${DAY_NAMES[day.getDay()]}
      </div>
    </div>`;
  }).join('');
}

// ─── Entries Screen ───────────────────────────────────────────────────────────
window.setFilter = function(f, btn) {
  state.activeFilter = f;
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  renderEntriesList();
};

function renderEntriesList() {
  if (!state.user) return;
  const el = document.getElementById('entries-list-area');
  if (!el) return;
  renderSkeleton(el, 3);

  // Small delay so skeleton is visible (realistic feel)
  setTimeout(() => {
    const query = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
    let entries = loadEntries(state.user.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (state.activeFilter === 'starred')      entries = entries.filter(e => e.isFavorite);
    else if (state.activeFilter !== 'all')     entries = entries.filter(e => e.mood === state.activeFilter);

    if (query) {
      const isTagSearch = query.startsWith('#');
      const term = isTagSearch ? query.slice(1) : query;
      entries = entries.filter(e =>
        isTagSearch
          ? e.tags?.some(t => t.includes(term))
          : e.content.toLowerCase().includes(term) ||
            e.tags?.some(t => t.includes(term))
      );
    }

    if (!entries.length) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${state.activeFilter === 'starred' ? '⭐' : '📖'}</div>
          <div class="empty-state-text">No entries found.</div>
        </div>`;
      return;
    }

    el.innerHTML = entries.map(e => `
      <div class="full-entry-card${e.isFavorite ? ' favorited' : ''}" onclick="openDetail('${e.id}')">
        <div class="full-entry-card-top">
          <span class="full-entry-card-mood">${e.mood || '📝'}</span>
          <span class="full-entry-card-date">${formatDate(e.date)}</span>
        </div>
        <div class="full-entry-card-text">${escHtml(e.content)}</div>
        ${e.tags?.length ? `<div class="entry-tags">${renderTagPills(e.tags)}</div>` : ''}
        <button class="fav-btn${e.isFavorite ? ' active' : ''}"
          onclick="event.stopPropagation();toggleFavorite('${e.id}',this)" title="Favorite">⭐</button>
        <button class="entry-delete-btn"
          onclick="event.stopPropagation();deleteEntryUI('${e.id}')">✕</button>
      </div>
    `).join('');
  }, 220);
}
window.renderEntriesList = renderEntriesList;

window.deleteEntryUI = function(id) {
  if (!confirm('Delete this entry?')) return;
  removeEntry(id);
  renderEntriesList();
  refreshHome();
  showToast('Entry deleted');
};

// ─── Detail View ──────────────────────────────────────────────────────────────
window.openDetail = function(id) {
  if (!state.user) return;
  const entry = loadEntries(state.user.id).find(e => e.id == id);
  if (!entry) return;
  state.detailEntryId = id;

  document.getElementById('detail-date').textContent  = formatDate(entry.date);
  document.getElementById('detail-mood').textContent  = entry.mood || '📝';
  document.getElementById('detail-text').textContent  = entry.content;

  const tagsEl = document.getElementById('detail-tags');
  if (tagsEl) tagsEl.innerHTML = entry.tags?.length ? renderTagPills(entry.tags) : '';

  const wcEl = document.getElementById('detail-wordcount');
  if (wcEl) wcEl.textContent = `${entry.wordCount || 0} words`;

  nav.prev = nav.current;
  showScreen('detail', true);
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
};

window.closeDetail = function() { appNav(nav.prev || 'home'); };

window.deleteCurrentDetail = function() {
  if (!state.detailEntryId) return;
  if (!confirm('Delete this entry?')) return;
  removeEntry(state.detailEntryId);
  state.detailEntryId = null;
  window.closeDetail();
  showToast('Entry deleted');
};

window.editCurrentDetail = function() {
  if (!state.detailEntryId || !state.user) return;
  const entry = loadEntries(state.user.id).find(e => e.id == state.detailEntryId);
  if (!entry) return;
  state.editingEntryId = state.detailEntryId;

  const ta = document.getElementById('entry-input');
  if (ta) ta.value = entry.content;
  document.getElementById('prompt-text').textContent =
    entry.prompt || PROMPTS[state.currentPromptIdx];

  const ti = document.getElementById('tags-input');
  if (ti) ti.value = (entry.tags || []).join(', ');

  state.selectedWriteMood = entry.mood || '';
  document.querySelectorAll('.write-mood-btn').forEach(b =>
    b.classList.toggle('selected', b.dataset.mood === state.selectedWriteMood));

  window.onInput();
  appNav('write');
};

// ─── Favorites ────────────────────────────────────────────────────────────────
window.toggleFavorite = function(id, btn) {
  if (!state.user) return;
  const all   = loadAllEntries();
  const entry = all.find(e => e.id == id);
  if (!entry) return;
  entry.isFavorite = !entry.isFavorite;
  saveAllEntries(all);
  btn?.classList.toggle('active', entry.isFavorite);
  btn?.closest('.full-entry-card')?.classList.toggle('favorited', entry.isFavorite);
  showToast(entry.isFavorite ? 'Added to favorites ⭐' : 'Removed from favorites');
};

// ─── Settings ─────────────────────────────────────────────────────────────────
function refreshSettingsProfile() {
  if (!state.user) return;
  const profile = loadProfile(state.user.id);
  const avatarEl = document.getElementById('settings-avatar');
  const nameEl   = document.getElementById('settings-name');
  const emailEl  = document.getElementById('settings-email');
  if (avatarEl) avatarEl.textContent = profile?.avatar || '🧑';
  if (nameEl)   nameEl.textContent   = profile?.name || state.user.email.split('@')[0];
  if (emailEl)  emailEl.textContent  = state.user.email;
}

window.toggleReminders = function() {
  const btn = document.getElementById('toggle-reminders');
  btn?.classList.toggle('on');
  showToast(btn?.classList.contains('on') ? '🔔 Daily reminders on' : 'Reminders off');
};

window.toggleDarkMode = function() {
  const btn = document.getElementById('toggle-dark');
  const on  = !btn?.classList.contains('on');
  applyDarkMode(on);
  const prefs = loadPrefs(); prefs.darkMode = on; savePrefs(prefs);
  showToast(on ? '🌙 Dark mode on' : '☀️ Light mode on');
};

// Export modal
window.openExportModal  = function() { document.getElementById('export-modal')?.classList.add('show'); };
window.closeExportModal = function() { document.getElementById('export-modal')?.classList.remove('show'); };

window.exportAsTxt = function() {
  if (!state.user) return;
  const entries = loadEntries(state.user.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!entries.length) { showToast('No entries to export'); return; }
  const txt = entries.map(e =>
    `[${formatDate(e.date)}] ${e.mood || ''} ${e.tags?.length ? '#' + e.tags.join(' #') : ''}\n${e.content}`
  ).join('\n\n─────\n\n');
  _download('my-journal.txt', 'text/plain', txt);
  window.closeExportModal();
};

window.exportAsJson = function() {
  if (!state.user) return;
  const entries = loadEntries(state.user.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!entries.length) { showToast('No entries to export'); return; }
  _download('my-journal.json', 'application/json', JSON.stringify(entries, null, 2));
  window.closeExportModal();
};

function _download(name, type, content) {
  const a = document.createElement('a');
  a.href     = `data:${type};charset=utf-8,${encodeURIComponent(content)}`;
  a.download = name;
  a.click();
  showToast('Exported! 📤');
}

window.clearData = function() {
  if (!state.user) return;
  if (!confirm('Clear ALL your entries? This cannot be undone.')) return;
  saveAllEntries(loadAllEntries().filter(e => e.userId !== state.user.id));
  showToast('All data cleared');
  refreshHome();
  renderEntriesList();
};

// ─── Profile Modal ────────────────────────────────────────────────────────────
function renderAvatarGrid(containerId, current, fnName) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  grid.innerHTML = AVATARS.map(a =>
    `<button class="avatar-btn${a === current ? ' selected' : ''}"
      onclick="${fnName}(this,'${a}')">${a}</button>`
  ).join('');
}

window.openProfileModal = function() {
  if (!state.user) return;
  const profile = loadProfile(state.user.id) || { name: '', avatar: AVATARS[0] };
  state.selectedModalAvatar = profile.avatar || AVATARS[0];
  renderAvatarGrid('modal-avatar-grid', state.selectedModalAvatar, 'pickModalAvatar');
  const input = document.getElementById('modal-name-input');
  if (input) input.value = profile.name || '';
  document.getElementById('profile-modal')?.classList.add('show');
};

window.closeProfileModal = function() {
  document.getElementById('profile-modal')?.classList.remove('show');
};

window.saveProfileModal = function() {
  if (!state.user) return;
  const name = document.getElementById('modal-name-input')?.value.trim() || 'Friend';
  saveProfile({ userId: state.user.id, name, avatar: state.selectedModalAvatar });
  refreshSettingsProfile();
  refreshHome();
  window.closeProfileModal();
  showToast('Profile updated ✓');
};

window.pickSignupAvatar = function(btn, av) {
  state.selectedSignupAvatar = av;
  document.querySelectorAll('#signup-avatar-grid .avatar-btn')
    .forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
};

window.pickModalAvatar = function(btn, av) {
  state.selectedModalAvatar = av;
  document.querySelectorAll('#modal-avatar-grid .avatar-btn')
    .forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
};

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  updateClock();
  setInterval(updateClock, 30000);

  // Wire auth form submissions
  document.getElementById('login-form')?.addEventListener('submit', handleLogIn);
  document.getElementById('signup-form')?.addEventListener('submit', handleSignUp);

  // Populate avatar grid for signup form
  renderAvatarGrid('signup-avatar-grid', state.selectedSignupAvatar, 'pickSignupAvatar');

  // Check session
  const user = getCurrentUser();
  if (!user) {
    showAuthScreen('login');
    return;
  }
  state.user = user;
  afterLogin();
}

init();
