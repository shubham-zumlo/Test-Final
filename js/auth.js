import { loadUsers, saveUsers, hashPassword, getSession, setSession, clearSession } from './store.js';

// ─── Sign Up ─────────────────────────────────────────────────────────────────
export function signUp(email, password) {
  email = email.toLowerCase().trim();
  if (!email || !password)          return { ok: false, error: 'Please fill in all fields.' };
  if (!email.includes('@') || !email.includes('.'))
                                    return { ok: false, error: 'Please enter a valid email address.' };
  if (password.length < 6)          return { ok: false, error: 'Password must be at least 6 characters.' };

  const users = loadUsers();
  if (users.find(u => u.email === email))
    return { ok: false, error: 'An account with this email already exists.' };

  const user = {
    id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    email,
    passwordHash: hashPassword(password),
  };
  users.push(user);
  saveUsers(users);

  const session = { id: user.id, email: user.email };
  setSession(session);
  return { ok: true, user: session };
}

// ─── Log In ──────────────────────────────────────────────────────────────────
export function logIn(email, password) {
  email = email.toLowerCase().trim();
  if (!email || !password) return { ok: false, error: 'Please fill in all fields.' };

  const user = loadUsers().find(u => u.email === email);
  if (!user)                return { ok: false, error: 'No account found with this email.' };
  if (user.passwordHash !== hashPassword(password))
                            return { ok: false, error: 'Incorrect password. Please try again.' };

  const session = { id: user.id, email: user.email };
  setSession(session);
  return { ok: true, user: session };
}

// ─── Log Out ─────────────────────────────────────────────────────────────────
export function logOut() { clearSession(); }

// ─── Current User ────────────────────────────────────────────────────────────
export function getCurrentUser() { return getSession(); }
