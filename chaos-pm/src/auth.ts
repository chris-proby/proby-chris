export interface AuthSession {
  userId: string;
  email: string;
  name: string;
  expiresAt: number;
}

export interface InviteCode {
  code: string;
  createdBy: string;
  createdByName: string;
  createdAt: number;
  usedBy?: string;
}

interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: number;
  invitedBy?: string;
}

const USERS_KEY    = 'messynotion-users';
const SESSION_KEY  = 'messynotion-session';
const INVITES_KEY  = 'messynotion-invites';
const SESSION_DAYS = 30;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function getUsers(): StoredUser[] {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]'); } catch { return []; }
}
function saveUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getInvites(): InviteCode[] {
  try { return JSON.parse(localStorage.getItem(INVITES_KEY) ?? '[]'); } catch { return []; }
}
function saveInvites(invites: InviteCode[]): void {
  localStorage.setItem(INVITES_KEY, JSON.stringify(invites));
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

export function isFirstUser(): boolean {
  return getUsers().length === 0;
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const hash = await sha256(password);
  const user = getUsers().find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.passwordHash === hash,
  );
  if (!user) throw new Error('이메일 또는 비밀번호가 올바르지 않습니다');
  return makeSession(user);
}

export async function register(
  email: string,
  password: string,
  name: string,
  inviteCode?: string,
): Promise<AuthSession> {
  const users = getUsers();

  if (users.length > 0) {
    if (!inviteCode) throw new Error('초대 코드가 필요합니다');
    const invites = getInvites();
    const invite = invites.find((i) => i.code === inviteCode.toUpperCase().trim() && !i.usedBy);
    if (!invite) throw new Error('유효하지 않거나 이미 사용된 초대 코드입니다');
    invite.usedBy = email;
    saveInvites(invites);
  }

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
    invitedBy: inviteCode,
  };
  saveUsers([...users, newUser]);
  return makeSession(newUser);
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function generateInviteCode(userId: string, userName: string): InviteCode {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const code = Array.from(bytes).map((b) => alphabet[b % alphabet.length]).join('');
  const invite: InviteCode = { code, createdBy: userId, createdByName: userName, createdAt: Date.now() };
  saveInvites([...getInvites(), invite]);
  return invite;
}

export function getMyInviteCodes(userId: string): InviteCode[] {
  return getInvites().filter((i) => i.createdBy === userId);
}

export function deleteInviteCode(code: string): void {
  saveInvites(getInvites().filter((i) => i.code !== code));
}
