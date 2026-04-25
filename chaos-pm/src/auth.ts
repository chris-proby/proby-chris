export interface AuthSession {
  userId: string;
  email: string;
  name: string;
  expiresAt: number;
}

interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: number;
}

const USERS_KEY   = 'chaospm-users';
const SESSION_KEY = 'chaospm-session';
const SESSION_DAYS = 30;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getUsers(): StoredUser[] {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]'); } catch { return []; }
}
function saveUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function makeSession(user: StoredUser): AuthSession {
  const session: AuthSession = {
    userId: user.id,
    email: user.email,
    name: user.name,
    expiresAt: Date.now() + SESSION_DAYS * 86_400_000,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getCurrentSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s: AuthSession = JSON.parse(raw);
    if (Date.now() > s.expiresAt) { localStorage.removeItem(SESSION_KEY); return null; }
    return s;
  } catch { return null; }
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const hash = await sha256(password);
  const user = getUsers().find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === hash,
  );
  if (!user) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다');
  return makeSession(user);
}

export async function register(email: string, password: string, name: string): Promise<AuthSession> {
  const users = getUsers();
  if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('이미 사용 중인 이메일입니다');
  }
  if (password.length < 6) throw new Error('비밀번호는 6자 이상이어야 합니다');

  const newUser: StoredUser = {
    id: crypto.randomUUID(),
    email: email.toLowerCase().trim(),
    name: name.trim() || email.split('@')[0],
    passwordHash: await sha256(password),
    createdAt: Date.now(),
  };
  saveUsers([...users, newUser]);
  return makeSession(newUser);
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}
