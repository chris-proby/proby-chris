import { useState, useEffect } from 'react';
import { generateInviteCode, getMyInviteCodes, deleteInviteCode } from '../auth';
import type { AuthSession, InviteCode } from '../auth';

interface Props {
  session: AuthSession;
  onClose: () => void;
}

export default function InvitePanel({ session, onClose }: Props) {
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

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

  return (
    <aside className="inspector">
      <div className="inspector-header">
        <span>초대 코드 관리</span>
        <button className="inspector-close" onClick={onClose}>✕</button>
      </div>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: 12, color: 'var(--panel-muted)', marginBottom: 10, lineHeight: 1.5 }}>
          초대 코드를 생성해서 동료에게 공유하세요.<br />
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
