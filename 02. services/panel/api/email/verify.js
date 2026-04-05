/**
 * POST /api/email/verify
 * 이메일 인증코드 확인
 */
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SMS_CODE_SALT = process.env.SMS_CODE_SALT || 'proby_sms_salt';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const MAX_ATTEMPTS = 5;

function hashCode(code) {
  return crypto.createHash('sha256').update(`${code}:${SMS_CODE_SALT}`).digest('hex');
}

function sbHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function notifySlack(msg) {
  if (!SLACK_WEBHOOK_URL) return;
  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: msg }),
    });
  } catch (_) {}
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const requestId = crypto.randomBytes(6).toString('hex');
  const log = (level, msg, extra = {}) =>
    console[level](`[email/verify][${requestId}] ${msg}`, JSON.stringify(extra));

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '').trim();

    if (!email || !code) {
      return res.status(400).json({ ok: false, error: '이메일과 인증번호를 입력하세요.' });
    }

    const rowRes = await fetch(
      `${SUPABASE_URL}/rest/v1/email_verifications?email=eq.${encodeURIComponent(email)}&status=eq.pending&order=created_at.desc&limit=1`,
      { headers: sbHeaders() }
    );
    if (!rowRes.ok) {
      log('error', 'fetch row failed', { status: rowRes.status });
      return res.status(500).json({ ok: false, error: '서버 오류가 발생했습니다.' });
    }
    const rows = await rowRes.json();
    if (!rows || rows.length === 0) {
      return res.status(400).json({ ok: false, error: '인증번호가 없거나 만료되었습니다. 다시 요청해 주세요.' });
    }

    const row = rows[0];
    const expiresAt = new Date(row.expires_at).getTime();

    if (Date.now() > expiresAt) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/email_verifications?id=eq.${row.id}`,
        { method: 'PATCH', headers: { ...sbHeaders(), Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'expired' }) }
      );
      return res.status(400).json({ ok: false, error: '인증번호가 만료되었습니다. 다시 요청해 주세요.' });
    }

    const attempts = (row.attempt_count || 0) + 1;
    if (attempts > MAX_ATTEMPTS) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/email_verifications?id=eq.${row.id}`,
        { method: 'PATCH', headers: { ...sbHeaders(), Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'expired', attempt_count: attempts }) }
      );
      await notifySlack(`⚠️ [email/verify] MAX_ATTEMPTS exceeded: ${email}`);
      return res.status(400).json({ ok: false, error: '인증 시도 횟수를 초과했습니다. 인증번호를 다시 요청해 주세요.' });
    }

    await fetch(
      `${SUPABASE_URL}/rest/v1/email_verifications?id=eq.${row.id}`,
      { method: 'PATCH', headers: { ...sbHeaders(), Prefer: 'return=minimal' }, body: JSON.stringify({ attempt_count: attempts }) }
    );

    if (row.code_hash !== hashCode(code)) {
      log('warn', 'wrong code', { email, attempts });
      return res.status(400).json({ ok: false, error: '인증번호가 일치하지 않습니다.' });
    }

    await fetch(
      `${SUPABASE_URL}/rest/v1/email_verifications?id=eq.${row.id}`,
      { method: 'PATCH', headers: { ...sbHeaders(), Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'verified' }) }
    );

    log('info', 'verified', { email });
    return res.status(200).json({ ok: true });
  } catch (err) {
    log('error', 'unexpected error', { error: err?.message });
    return res.status(500).json({ ok: false, error: '서버 오류가 발생했습니다.' });
  }
};
