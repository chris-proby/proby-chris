const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SMS_CODE_SALT = process.env.SMS_CODE_SALT || 'proby_sms_salt';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const MAX_ATTEMPTS = 5;

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

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

async function notifySlack(message) {
  if (!SLACK_WEBHOOK_URL) return;
  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    });
  } catch {}
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const requestId = crypto.randomBytes(6).toString('hex');
  const log = (level, msg, extra = {}) =>
    console[level](`[sms/verify][${requestId}] ${msg}`, JSON.stringify(extra));

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    log('error', 'missing supabase env');
    return res.status(500).json({ ok: false, error: 'Server configuration error' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const phone = normalizePhone(body.phone);
    const code = String(body.code || '').trim();
    if (!phone || !code) return res.status(400).json({ ok: false, error: '전화번호와 인증번호를 입력하세요.' });

    const findRes = await fetch(
      `${SUPABASE_URL}/rest/v1/phone_verifications?phone=eq.${phone}&status=eq.pending&select=id,code_hash,attempt_count,expires_at&order=created_at.desc&limit=1`,
      { headers: sbHeaders() }
    );
    if (!findRes.ok) {
      log('error', 'db fetch failed', { status: findRes.status });
      return res.status(500).json({ ok: false, error: '서버 오류가 발생했습니다.' });
    }

    const rows = await findRes.json();
    const row = rows?.[0];
    if (!row) {
      log('warn', 'no pending verification', { phone });
      return res.status(400).json({ ok: false, error: '인증 대기 정보가 없습니다. 인증번호를 다시 요청해 주세요.' });
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      await fetch(`${SUPABASE_URL}/rest/v1/phone_verifications?id=eq.${row.id}`, {
        method: 'PATCH',
        headers: { ...sbHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'expired' }),
      });
      log('warn', 'code expired', { phone });
      return res.status(400).json({ ok: false, error: '인증번호가 만료되었습니다. 다시 요청해 주세요.' });
    }

    const matched = hashCode(code) === row.code_hash;
    if (!matched) {
      const nextAttempt = Number(row.attempt_count || 0) + 1;
      const isExhausted = nextAttempt >= MAX_ATTEMPTS;
      await fetch(`${SUPABASE_URL}/rest/v1/phone_verifications?id=eq.${row.id}`, {
        method: 'PATCH',
        headers: { ...sbHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify(isExhausted ? { attempt_count: nextAttempt, status: 'failed' } : { attempt_count: nextAttempt }),
      });
      log('warn', 'wrong code', { phone, attempt: nextAttempt, exhausted: isExhausted });
      if (isExhausted) {
        await notifySlack(`⚠️ [sms/verify] 인증 ${MAX_ATTEMPTS}회 실패 — phone: ${phone.slice(-4).padStart(phone.length, '*')}`);
        return res.status(400).json({ ok: false, error: `인증번호 ${MAX_ATTEMPTS}회 오류로 만료되었습니다. 다시 요청해 주세요.` });
      }
      return res.status(400).json({ ok: false, error: `인증번호가 일치하지 않습니다. (${nextAttempt}/${MAX_ATTEMPTS})` });
    }

    await fetch(`${SUPABASE_URL}/rest/v1/phone_verifications?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: { ...sbHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'verified', verified_at: new Date().toISOString() }),
    });

    log('info', 'verification success', { phone: phone.slice(0, 3) + '****' + phone.slice(-4) });
    return res.status(200).json({ ok: true });
  } catch (err) {
    log('error', 'unexpected error', { error: err?.message });
    return res.status(500).json({ ok: false, error: '서버 오류가 발생했습니다.' });
  }
};
