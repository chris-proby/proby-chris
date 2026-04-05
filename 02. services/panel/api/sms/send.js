const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NCP_ACCESS_KEY = process.env.NCP_ACCESS_KEY;
const NCP_SECRET_KEY = process.env.NCP_SECRET_KEY;
const NCP_SENS_SERVICE_ID = process.env.NCP_SENS_SERVICE_ID;
const NCP_CALLING_NUMBER = process.env.NCP_CALLING_NUMBER;
const SMS_CODE_SALT = process.env.SMS_CODE_SALT || 'proby_sms_salt';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

const COOLDOWN_SECONDS = 60;
const CODE_EXPIRE_SECONDS = 5 * 60;

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function hashCode(code) {
  return crypto.createHash('sha256').update(`${code}:${SMS_CODE_SALT}`).digest('hex');
}

function makeSignature(method, uri, timestamp) {
  const message = `${method} ${uri}\n${timestamp}\n${NCP_ACCESS_KEY}`;
  return crypto.createHmac('sha256', NCP_SECRET_KEY).update(message).digest('base64');
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

// NCP 에러 코드 → 사용자 메시지 매핑
function ncpErrorMessage(code, body) {
  const map = {
    '400': '요청 형식 오류입니다.',
    '401': 'NCP 인증 실패입니다.',
    '403': '발신번호가 인증되지 않았습니다. NCP SENS에서 발신번호를 등록해 주세요.',
    '404': 'NCP 서비스를 찾을 수 없습니다.',
    '429': '발송 한도 초과입니다. 잠시 후 다시 시도해 주세요.',
    '500': 'NCP 서버 오류입니다.',
  };
  return map[String(body?.statusCode || code)] || `SMS 발송 실패 (${code})`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const requestId = crypto.randomBytes(6).toString('hex');
  const log = (level, msg, extra = {}) =>
    console[level](`[sms/send][${requestId}] ${msg}`, JSON.stringify(extra));

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    log('error', 'missing supabase env');
    return res.status(500).json({ ok: false, error: 'Server configuration error' });
  }
  if (!NCP_ACCESS_KEY || !NCP_SECRET_KEY || !NCP_SENS_SERVICE_ID || !NCP_CALLING_NUMBER) {
    log('error', 'missing NCP env');
    return res.status(500).json({ ok: false, error: 'SMS service is not configured' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const phone = normalizePhone(body.phone);
    if (phone.length < 10 || phone.length > 11) {
      return res.status(400).json({ ok: false, error: '올바른 전화번호를 입력하세요.' });
    }

    // 재전송 쿨다운 확인 (60초)
    const cooldownSince = new Date(Date.now() - COOLDOWN_SECONDS * 1000).toISOString();
    const recentRes = await fetch(
      `${SUPABASE_URL}/rest/v1/phone_verifications?phone=eq.${phone}&created_at=gte.${cooldownSince}&order=created_at.desc&limit=1`,
      { headers: sbHeaders() }
    );
    if (recentRes.ok) {
      const recent = await recentRes.json();
      if (recent?.length > 0) {
        log('warn', 'cooldown active', { phone });
        return res.status(429).json({ ok: false, error: `${COOLDOWN_SECONDS}초 후 재전송 가능합니다.` });
      }
    }

    // 기존 pending 코드 만료 처리
    await fetch(
      `${SUPABASE_URL}/rest/v1/phone_verifications?phone=eq.${phone}&status=eq.pending`,
      { method: 'PATCH', headers: { ...sbHeaders(), Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'expired' }) }
    );

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + CODE_EXPIRE_SECONDS * 1000).toISOString();

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/phone_verifications`, {
      method: 'POST',
      headers: { ...sbHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify([{ phone, code_hash: hashCode(code), status: 'pending', attempt_count: 0, expires_at: expiresAt }]),
    });
    if (!insertRes.ok) {
      const text = await insertRes.text();
      log('error', 'insert failed', { phone, status: insertRes.status, body: text });
      return res.status(500).json({ ok: false, error: '인증정보 저장 실패' });
    }

    const uri = `/sms/v2/services/${NCP_SENS_SERVICE_ID}/messages`;
    const timestamp = Date.now().toString();
    const signature = makeSignature('POST', uri, timestamp);

    const smsRes = await fetch(`https://sens.apigw.ntruss.com${uri}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'x-ncp-apigw-timestamp': timestamp,
        'x-ncp-iam-access-key': NCP_ACCESS_KEY,
        'x-ncp-apigw-signature-v2': signature,
      },
      body: JSON.stringify({
        type: 'SMS',
        contentType: 'COMM',
        countryCode: '82',
        from: String(NCP_CALLING_NUMBER).replace(/\D/g, ''),
        content: `[Proby] 인증번호는 [${code}] 입니다. 5분 내 입력해 주세요.`,
        messages: [{ to: phone }],
      }),
    });

    const smsData = await smsRes.json().catch(() => ({}));
    if (!smsRes.ok || smsData.statusCode !== '202') {
      const userMsg = ncpErrorMessage(smsRes.status, smsData);
      log('error', 'NCP SMS failed', { phone, httpStatus: smsRes.status, ncpCode: smsData?.statusCode, ncpBody: smsData });
      await notifySlack(`🚨 [sms/send] SMS 발송 실패 | phone: ${phone.slice(-4).padStart(phone.length, '*')} | NCP: ${smsData?.statusCode} | ${smsData?.statusName || ''}`);
      return res.status(500).json({ ok: false, error: userMsg });
    }

    log('info', 'SMS sent', { phone: phone.slice(0, 3) + '****' + phone.slice(-4) });
    return res.status(200).json({ ok: true });
  } catch (err) {
    log('error', 'unexpected error', { error: err?.message, stack: err?.stack });
    await notifySlack(`🚨 [sms/send] 예외 발생 | ${err?.message}`);
    return res.status(500).json({ ok: false, error: '서버 오류가 발생했습니다.' });
  }
};
