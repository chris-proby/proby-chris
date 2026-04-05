/**
 * GET /api/auth/session
 * httpOnly 쿠키의 세션 토큰을 검증하고 유저 정보 반환.
 * 클라이언트는 이 API만 호출하면 되고 토큰 원문을 알 필요 없음.
 */
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SESSION_SECRET = process.env.SESSION_SECRET || 'proby_session_default_change_me';
const COOKIE_NAME = 'proby_session';

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map(c => c.trim().split('=').map(decodeURIComponent))
  );
}

function verifyToken(token) {
  try {
    const [dataB64, sig] = token.split('.');
    if (!dataB64 || !sig) return null;
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(dataB64).digest('base64');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(dataB64, 'base64').toString());
    if (!payload.email || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ ok: false, error: '세션이 없습니다.' });

  const payload = verifyToken(token);
  if (!payload) {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/`);
    return res.status(401).json({ ok: false, error: '세션이 만료되었습니다.' });
  }

  // Supabase에서 세션 revoke 여부 확인
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?token_hash=eq.${tokenHash}&select=revoked,expires_at&limit=1`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    if (r.ok) {
      const rows = await r.json();
      if (rows[0]?.revoked || (rows[0] && new Date(rows[0].expires_at) < new Date())) {
        res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/`);
        return res.status(401).json({ ok: false, error: '세션이 만료되었습니다.' });
      }
    }
  } catch {
    // DB 확인 실패 시 토큰 서명만으로 허용 (가용성 우선)
  }

  return res.status(200).json({ ok: true, email: payload.email, name: payload.name });
};
