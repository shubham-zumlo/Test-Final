// ─── Screen Navigation ───────────────────────────────────────────────────────
export const nav = { current: 'home', prev: 'home' };

export function showScreen(name, skipHistory = false) {
  if (name === nav.current && name !== 'detail') return;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const el = document.getElementById('screen-' + name);
  if (el) { el.classList.add('active'); el.scrollTop = 0; }
  const tab = document.getElementById('tab-' + name);
  if (tab) tab.classList.add('active');
  if (!skipHistory) nav.prev = nav.current;
  nav.current = name;
}

// ─── Auth Overlay ────────────────────────────────────────────────────────────
export function showAuthScreen(tab) {
  document.getElementById('auth-overlay')?.classList.remove('hidden');
  document.getElementById('bottom-nav')?.setAttribute('style', 'display:none');
  switchAuthTab(tab || 'login');
}

export function hideAuthScreen() {
  document.getElementById('auth-overlay')?.classList.add('hidden');
  document.getElementById('bottom-nav')?.removeAttribute('style');
}

export function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.auth-form').forEach(f =>
    f.classList.toggle('active', f.id === 'auth-' + tab));
  clearAuthErrors();
}

export function showAuthError(formId, msg) {
  const el = document.getElementById(formId + '-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

export function clearAuthErrors() {
  document.querySelectorAll('.auth-error').forEach(e => {
    e.textContent = ''; e.style.display = 'none';
  });
}

// ─── Toast ───────────────────────────────────────────────────────────────────
export function showToast(msg, duration = 2400) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

// ─── Dark Mode ───────────────────────────────────────────────────────────────
export function applyDarkMode(on) {
  document.getElementById('phone')?.classList.toggle('dark', on);
  document.body.classList.toggle('dark', on);
  const btn = document.getElementById('toggle-dark');
  if (btn) btn.classList.toggle('on', on);
}

// ─── Loading Skeletons ───────────────────────────────────────────────────────
export function renderSkeleton(container, count = 3) {
  if (!container) return;
  container.innerHTML = Array.from({ length: count }, (_, i) => `
    <div class="skeleton-card">
      <div class="skeleton-line short" style="animation-delay:${i * 0.08}s"></div>
      <div class="skeleton-line" style="animation-delay:${i * 0.08 + 0.04}s"></div>
      <div class="skeleton-line medium" style="animation-delay:${i * 0.08 + 0.08}s"></div>
    </div>
  `).join('');
}

// ─── Haptic-style press animation ────────────────────────────────────────────
export function pulse(el) {
  if (!el) return;
  el.style.transform = 'scale(0.92)';
  setTimeout(() => { el.style.transform = ''; }, 180);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
