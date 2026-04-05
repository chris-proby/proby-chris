/**
 * POST /api/email/send
 * 이메일로 6자리 인증코드 발송
 * 환경변수:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   RESEND_API_KEY  (https://resend.com — 무료: 3,000건/월)
 *   EMAIL_FROM      (예: noreply@proby.io — Resend에 등록된 도메인)
 */
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
/** Resend: 도메인 미인증 시 테스트용 발신 (수신은 대시보드에 등록한 본인 이메일만 가능). 운영은 반드시 도메인 인증 후 EMAIL_FROM 설정 */
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const SMS_CODE_SALT = process.env.SMS_CODE_SALT || 'proby_sms_salt';

const COOLDOWN_SECONDS = 60;
const CODE_EXPIRE_SECONDS = 10 * 60; // 10분

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

/** Resend 4xx 응답 본문 → 사용자용 한글 메시지 */
function messageFromResendBody(body) {
  if (!body || typeof body !== 'object') return null;
  const raw = body.message || body.error?.message || (typeof body.error === 'string' ? body.error : '');
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const lower = raw.toLowerCase();
  if (lower.includes('domain') && (lower.includes('verif') || lower.includes('invalid'))) {
    return '발신 주소(EMAIL_FROM) 도메인이 Resend에서 인증되지 않았습니다. Resend에서 도메인을 추가·인증한 뒤 Vercel 환경변수 EMAIL_FROM을 그 주소로 설정하세요.';
  }
  if (lower.includes('api') && lower.includes('key')) {
    return 'Resend API 키(RESEND_API_KEY)가 올바르지 않습니다. Vercel 환경변수를 확인하세요.';
  }
  if (lower.includes('only send testing emails') || lower.includes('testing emails to your own')) {
    return 'Resend 테스트 모드입니다. Resend 대시보드에 등록한 본인 이메일로만 테스트 발송이 가능합니다. 또는 도메인 인증 후 운영 발송을 설정하세요.';
  }
  return `이메일 발송 오류: ${raw}`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const requestId = crypto.randomBytes(6).toString('hex');
  const log = (level, msg, extra = {}) =>
    console[level](`[email/send][${requestId}] ${msg}`, JSON.stringify(extra));

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    log('error', 'missing supabase env');
    return res.status(500).json({ ok: false, error: 'Server configuration error' });
  }
  if (!RESEND_API_KEY) {
    log('error', 'missing RESEND_API_KEY');
    return res.status(500).json({ ok: false, error: '이메일 발송 서비스가 설정되지 않았습니다.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ ok: false, error: '올바른 이메일 주소를 입력하세요.' });
    }

    // 쿨다운 확인 (60초) — ISO 날짜는 쿼리스트링으로 인코딩
    const cooldownSince = new Date(Date.now() - COOLDOWN_SECONDS * 1000).toISOString();
    const recentRes = await fetch(
      `${SUPABASE_URL}/rest/v1/email_verifications?email=eq.${encodeURIComponent(email)}&created_at=gte.${encodeURIComponent(cooldownSince)}&order=created_at.desc&limit=1`,
      { headers: sbHeaders() }
    );
    if (recentRes.ok) {
      const recent = await recentRes.json();
      if (recent?.length > 0) {
        log('warn', 'cooldown active', { email });
        return res.status(429).json({ ok: false, error: `${COOLDOWN_SECONDS}초 후 재전송 가능합니다.` });
      }
    }

    // 기존 pending 코드 만료 처리
    await fetch(
      `${SUPABASE_URL}/rest/v1/email_verifications?email=eq.${encodeURIComponent(email)}&status=eq.pending`,
      {
        method: 'PATCH',
        headers: { ...sbHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'expired' }),
      }
    );

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + CODE_EXPIRE_SECONDS * 1000).toISOString();

    // DB 저장
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/email_verifications`, {
      method: 'POST',
      headers: { ...sbHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify([{
        email,
        code_hash: hashCode(code),
        status: 'pending',
        attempt_count: 0,
        expires_at: expiresAt,
      }]),
    });
    if (!insertRes.ok) {
      const text = await insertRes.text();
      log('error', 'insert failed', { email, status: insertRes.status, body: text });
      if (/email_verifications|does not exist|42P01/i.test(text)) {
        return res.status(500).json({
          ok: false,
          error:
            'DB에 email_verifications 테이블이 없습니다. Supabase SQL Editor에서 SUPABASE_SETUP.sql의 해당 섹션을 실행한 뒤 다시 시도하세요.',
          code: 'DB_MISSING_TABLE',
        });
      }
      return res.status(500).json({ ok: false, error: '인증정보 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.', code: 'DB_INSERT_FAILED' });
    }

    // Resend로 이메일 발송
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [email],
        subject: '[Proby] 이메일 인증번호',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0e0f14;color:#e8e9f0;border-radius:12px;">
            <h2 style="margin:0 0 8px;font-size:20px;">Proby 이메일 인증</h2>
            <p style="color:#9ea3b0;font-size:14px;margin:0 0 24px;">아래 인증번호를 10분 이내에 입력해 주세요.</p>
            <div style="background:#1a1b23;border-radius:8px;padding:20px 24px;text-align:center;margin-bottom:24px;">
              <span style="font-size:36px;font-weight:900;letter-spacing:0.15em;color:#fff;">${code}</span>
            </div>
            <p style="color:#6b7280;font-size:12px;margin:0;">본 인증번호는 10분 후 만료됩니다. 본인이 요청하지 않았다면 이 메일을 무시하세요.</p>
          </div>
        `,
      }),
    });

    const emailData = await emailRes.json().catch(() => ({}));
    if (!emailRes.ok) {
      log('error', 'Resend failed', { email, status: emailRes.status, body: emailData });
      const userMsg =
        messageFromResendBody(emailData) ||
        '인증 이메일 발송에 실패했습니다. RESEND_API_KEY·EMAIL_FROM·도메인 인증을 확인해 주세요.';
      return res.status(502).json({ ok: false, error: userMsg, code: 'RESEND_FAILED' });
    }

    log('info', 'email sent', { email });
    return res.status(200).json({ ok: true });
  } catch (err) {
    log('error', 'unexpected error', { error: err?.message });
    return res.status(500).json({ ok: false, error: '서버 오류가 발생했습니다.' });
  }
};
