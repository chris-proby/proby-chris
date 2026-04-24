import { useState, useEffect } from 'react';
import { generateInviteCode, getMyInviteCodes, deleteInviteCode } from '../auth';
import { LIVEBLOCKS_KEY } from '../liveblocks';
import type { AuthSession, InviteCode } from '../auth';

interface Props {
  session: AuthSession;
  onClose: () => void;
  collabMode?: boolean;
  roomOwnerId?: string;
}

export default function InvitePanel({ session, onClose, collabMode, roomOwnerId }: Props) {
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [liveUrlCopied, setLiveUrlCopied] = useState(false);

  const liveUrl = `${window.location.origin}?room=${session.userId}`;
  const hasLiveblocksKey = !!LIVEBLOCKS_KEY;

  useEffect(() => {
    setInvites(getMyInviteCodes(session.userId));
  }, [session.userId]);

  const handleGenerate = () => {
    generateInviteCode(session.userId, session.name);
    setInvites(getMyInviteCodes(session.userId));
  };

  const handleDelete = (code: string) => {
    deleteInviteCode(code);
    setInvites(getMyInviteCodes(session.userId));
  };

  const handleCopy = (code: string) => {
    const url = `${window.location.origin}?invite=${code}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const handleCopyLiveUrl = () => {
    navigator.clipboard.writeText(liveUrl).then(() => {
      setLiveUrlCopied(true);
      setTimeout(() => setLiveUrlCopied(false), 2000);
    });
  };

  return (
    <aside className="inspector">
      <div className="inspector-header">
        <span>초대 관리</span>
        <button className="inspector-close" onClick={onClose}>✕</button>
      </div>

      {/* Live co-editing section */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>실시간 공동 편집</span>
          {collabMode && <span className="collab-live-badge">● Live</span>}
        </div>
        {!hasLiveblocksKey ? (
          <p style={{ fontSize: 12, color: 'var(--panel-muted)', lineHeight: 1.5, margin: 0 }}>
            실시간 협업을 사용하려면 <code>VITE_LIVEBLOCKS_PUBLIC_KEY</code> 환경 변수를 설정하세요.{' '}
            liveblocks.io에서 무료 공개 키를 발급받을 수 있습니다.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 12, color: 'var(--panel-muted)', lineHeight: 1.5, marginBottom: 10 }}>
              아래 링크를 동료에게 공유하면 같은 캔버스를 실시간으로 함께 편집할 수 있습니다.
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                readOnly
                value={liveUrl}
                style={{
                  flex: 1, fontSize: 11, padding: '5px 8px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 4, color: 'var(--text)', minWidth: 0,
                }}
              />
              <button
                className="tb-btn primary"
                style={{ fontSize: 11, whiteSpace: 'nowrap' }}
                onClick={handleCopyLiveUrl}
              >
                {liveUrlCopied ? '복사됨!' : '링크 복사'}
              </button>
            </div>
            {collabMode && roomOwnerId && roomOwnerId !== session.userId && (
              <p style={{ fontSize: 11, color: '#22c55e', margin: '6px 0 0' }}>
                현재 공동 편집 세션에 참여 중입니다.
              </p>
            )}
          </>
        )}
      </div>

      {/* Signup invite codes section */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: 12, color: 'var(--panel-muted)', marginBottom: 10, lineHeight: 1.5 }}>
          회원가입 초대 코드를 생성해서 동료에게 공유하세요.<br />
          코드는 1회 사용 후 자동으로 만료됩니다.
        </p>
        <button className="tb-btn primary" onClick={handleGenerate} style={{ width: '100%' }}>
          + 새 초대 코드 생성
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {invites.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--panel-muted)', fontSize: 13 }}>
            생성된 초대 코드가 없습니다
          </div>
        ) : (
          invites.map((inv) => (
            <div key={inv.code} className="invite-item">
              <div className="invite-code-display">{inv.code}</div>
              <div className="invite-meta">
                {inv.usedBy
                  ? <span className="invite-used">사용됨 · {inv.usedBy}</span>
                  : <span className="invite-active">미사용</span>}
              </div>
              <div className="invite-actions">
                {!inv.usedBy && (
                  <button
                    className="tb-btn"
                    style={{ fontSize: 11, padding: '3px 8px' }}
                    onClick={() => handleCopy(inv.code)}
                  >
                    {copied === inv.code ? '복사됨!' : '링크 복사'}
                  </button>
                )}
                <button
                  className="tb-btn danger"
                  style={{ fontSize: 11, padding: '3px 8px' }}
                  onClick={() => handleDelete(inv.code)}
                >
                  삭제
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
