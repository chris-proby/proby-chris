const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SESSION_SECRET = process.env.SESSION_SECRET || 'proby_session_default_change_me';
const SESSION_EXPIRE_MS = 30 * 24 * 60 * 60 * 1000; // 30일
const COOKIE_NAME = 'proby_session';

function signToken(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64');
  return `${data}.${sig}`;
}

const sbHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, error: 'Server configuration error' });
  }

  const requestId = crypto.randomBytes(6).toString('hex');
  const log = (level, msg, extra = {}) =>
    console[level](`[auth/login][${requestId}] ${msg}`, JSON.stringify(extra));

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { email, password } = body;
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: '이메일과 비밀번호를 입력하세요.' });
    }

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/panel_users?email=eq.${encodeURIComponent(email)}&select=*&limit=1`,
      { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } }
    );
    if (!r.ok) {
      log('error', 'supabase fetch failed', { status: r.status });
      return res.status(500).json({ ok: false, error: '서버 오류가 발생했습니다.' });
    }

    const rows = await r.json();
    const user = rows[0];
    if (!user) {
      log('warn', 'unknown email', { email });
      return res.status(401).json({ ok: false, error: '등록되지 않은 이메일입니다.' });
    }

    const stored = user.password || '';
    let passwordMatch = false;

    if (stored.startsWith('$2')) {
      passwordMatch = await bcrypt.compare(password, stored);
    } else {
      // 평문 레거시 — 검증 후 bcrypt로 자동 마이그레이션
      passwordMatch = stored === password;
      if (passwordMatch) {
        const hash = await bcrypt.hash(password, 12);
        await fetch(
          `${SUPABASE_URL}/rest/v1/panel_users?email=eq.${encodeURIComponent(email)}`,
          { method: 'PATCH', headers: { ...sbHeaders, Prefer: 'return=minimal' }, body: JSON.stringify({ password: hash }) }
        );
        log('info', 'password migrated to bcrypt', { email });
      }
    }

    if (!passwordMatch) {
      log('warn', 'wrong password', { email });
      return res.status(401).json({ ok: false, error: '비밀번호가 일치하지 않습니다.' });
    }

    const expiresAt = new Date(Date.now() + SESSION_EXPIRE_MS);
    const token = signToken({ email: user.email, name: user.name || '', exp: expiresAt.getTime() });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // DB 세션 저장 (revoke 지원)
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
        method: 'POST',
        headers: { ...sbHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify({ token_hash: tokenHash, email: user.email, expires_at: expiresAt.toISOString() }),
      });
    } catch (e) {
      log('error', 'session insert failed', { email, error: e?.message });
    }

    // httpOnly 쿠키 발급 (D9)
    const cookieValue = [
      `${COOKIE_NAME}=${token}`,
      'HttpOnly',
      'Secure',
      'SameSite=Strict',
      `Max-Age=${SESSION_EXPIRE_MS / 1000}`,
      'Path=/',
    ].join('; ');
    res.setHeader('Set-Cookie', cookieValue);

    const userPublic = {
      email: user.email,
      name: user.name || '',
      phone: user.phone || '',
      bankName: user.bank_name || '',
      bankAccount: user.bank_account || '',
      birthdate: user.birthdate || '',
      gender: user.gender || '',
      job: user.job || '',
      createdAt: user.created_at || new Date().toISOString(),
      phoneVerified: Boolean(user.phone_verified),
      emailNoticeAgreed: Boolean(user.email_notice_agreed),
    };

    log('info', 'login success', { email });
    // token도 함께 반환 (app.js의 localStorage 캐시 지원)
    return res.status(200).json({ ok: true, token, user: userPublic });
  } catch (err) {
    log('error', 'unexpected error', { error: err?.message });
    return res.status(500).json({ ok: false, error: '서버 오류가 발생했습니다.' });
  }
};
