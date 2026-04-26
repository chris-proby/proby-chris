import { useState } from 'react';
import { login, register, requestPasswordReset, signInWithGoogle } from '../auth';
import { analyticsIdentify, track } from '../analytics';
import { SUPABASE_CONFIGURED } from '../supabase';

interface Props {
  onAuth: () => void;
}

export default function AuthScreen({ onAuth }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [info, setInfo] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    track(mode === 'login' ? 'AuthScreen_Login_Submit' : 'AuthScreen_Register_Submit', { email });
    try {
      if (mode === 'login') {
        await login(email, password);
        analyticsIdentify(email);
        track('AuthScreen_Login_Success', { email });
        onAuth();
      } else {
        await register(email, password, name);
        analyticsIdentify(email, { name });
        track('AuthScreen_Register_Success', { email, name });
        // Strip any ?room param so the new user lands on their own fresh canvas
        window.location.href = window.location.origin;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '오류가 발생했습니다';
      track(mode === 'login' ? 'AuthScreen_Login_Error' : 'AuthScreen_Register_Error', { email, error: msg });
      // Email-confirmation message is informational, not an error
      if (msg.includes('인증을 완료')) setInfo(msg);
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(''); setInfo('');
    try {
      track('AuthScreen_Google_Click');
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    }
  };

  const handleResetPassword = async () => {
    if (!email) { setError('이메일을 먼저 입력해주세요'); return; }
    setError(''); setInfo('');
    try {
      await requestPasswordReset(email);
      setInfo('비밀번호 재설정 메일을 보냈습니다. 받은편지함을 확인해주세요.');
      track('AuthScreen_PasswordReset_Sent', { email });
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <div className="auth-logo">
          chaos<span>PM</span>
        </div>
        <p className="auth-subtitle">팀의 모든 세일즈를 한 곳에</p>

        <div className="auth-tabs">
          <button
            className={`auth-tab${mode === 'login' ? ' active' : ''}`}
            onClick={() => { setMode('login'); setError(''); track('AuthScreen_LoginTab_Click'); }}
          >
            로그인
          </button>
          <button
            className={`auth-tab${mode === 'register' ? ' active' : ''}`}
            onClick={() => { setMode('register'); setError(''); track('AuthScreen_RegisterTab_Click'); }}
          >
            회원가입
          </button>
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={!SUPABASE_CONFIGURED}
          style={{
            width: '100%',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: '#fff',
            color: '#1f1f1f',
            border: '1px solid #dadce0',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            cursor: SUPABASE_CONFIGURED ? 'pointer' : 'not-allowed',
            marginBottom: 12,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Google로 계속하기
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--panel-muted, #94a3b8)', fontSize: 11, margin: '4px 0 12px' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border, #e2e8f0)' }} />
          <span>또는</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border, #e2e8f0)' }} />
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="auth-field">
              <label>이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                autoComplete="name"
              />
            </div>
          )}

          <div className="auth-field">
            <label>이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-field">
            <label>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? '6자 이상' : '비밀번호 입력'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </div>

          {error && <div className="auth-error">{error}</div>}
          {info && <div className="auth-error" style={{ background: 'rgba(34,197,94,0.12)', color: '#16a34a' }}>{info}</div>}

          <button type="submit" className="auth-submit" disabled={loading || !SUPABASE_CONFIGURED}>
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '가입하기'}
          </button>

          {mode === 'login' && (
            <button
              type="button"
              onClick={handleResetPassword}
              style={{
                background: 'none', border: 'none', color: 'var(--accent, #6366f1)',
                fontSize: 12, marginTop: 8, cursor: 'pointer', alignSelf: 'flex-end',
              }}
            >
              비밀번호를 잊으셨나요?
            </button>
          )}

          {!SUPABASE_CONFIGURED && (
            <div className="auth-error" style={{ marginTop: 12 }}>
              인증 서비스가 설정되지 않았습니다. 관리자에게 문의해주세요.
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
