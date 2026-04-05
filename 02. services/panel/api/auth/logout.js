/**
 * POST /api/auth/logout
 * 세션 토큰을 DB에서 revoke하고 httpOnly 쿠키 삭제.
 */
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const COOKIE_NAME = 'proby_session';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => c.trim().split('=').map(decodeURIComponent))
  );
  const token = cookies[COOKIE_NAME];

  if (token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/sessions?token_hash=eq.${tokenHash}`,
        {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ revoked: true }),
        }
      );
    } catch (e) {
      console.error('[auth/logout] session revoke failed:', e?.message);
    }
  }

  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/`);
  return res.status(200).json({ ok: true });
};
