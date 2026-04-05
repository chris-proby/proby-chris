const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL_VERIFY_WINDOW_MS = 10 * 60 * 1000; // 인증 유효 시간 10분

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, error: 'Server configuration error' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { name, email, password, phone } = body;

    if (!name || !email || !password) {
      return res.status(400).json({ ok: false, error: '이름, 이메일, 비밀번호를 입력하세요.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ ok: false, error: '비밀번호는 6자 이상이어야 합니다.' });
    }

    const normalizedPhone = normalizePhone(phone || '');
    const normalizedEmail = email.trim().toLowerCase();
    const headers = {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    };

    // 이메일 인증 확인 — 임시 비활성화 (Resend 도메인 설정 후 활성화)
    // const verifyRes = await fetch(...)

    // 이메일 중복 확인
    const emailRes = await fetch(
      `${SUPABASE_URL}/rest/v1/panel_users?email=eq.${encodeURIComponent(normalizedEmail)}&select=email&limit=1`,
      { headers }
    );
    const emailRows = await emailRes.json().catch(() => []);
    if (Array.isArray(emailRows) && emailRows.length > 0) {
      return res.status(409).json({ ok: false, error: '이미 가입된 이메일입니다.' });
    }

    // 전화번호 중복 확인 (번호가 있을 때만)
    if (normalizedPhone.length >= 10) {
      const phoneRes = await fetch(
        `${SUPABASE_URL}/rest/v1/panel_users?phone=eq.${normalizedPhone}&select=phone&limit=1`,
        { headers }
      );
      const phoneRows = await phoneRes.json().catch(() => []);
      if (Array.isArray(phoneRows) && phoneRows.length > 0) {
        return res.status(409).json({ ok: false, error: '이미 가입된 전화번호입니다.' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/panel_users`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=minimal' },
      body: JSON.stringify([{
        email: normalizedEmail,
        name,
        password: passwordHash,
        phone: normalizedPhone || crypto.randomUUID().replace(/-/g, ''),
        email_verified: true,
        bank_name: '',
        bank_account: '',
        birthdate: '',
        gender: '',
        job: '',
      }]),
    });

    if (!insertRes.ok) {
      const text = await insertRes.text();
      console.error('[auth/register] insert failed:', text);
      return res.status(500).json({ ok: false, error: '회원가입 처리 중 오류가 발생했습니다.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[auth/register]', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Unknown error' });
  }
};
