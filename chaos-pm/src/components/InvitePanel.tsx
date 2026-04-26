import { useState } from 'react';
import { LIVEBLOCKS_KEY } from '../liveblocks';
import { track } from '../analytics';
import type { AuthSession } from '../auth';

interface Props {
  session: AuthSession;
  onClose: () => void;
  collabMode?: boolean;
  roomOwnerId?: string;
}

export default function InvitePanel({ session, onClose, collabMode, roomOwnerId }: Props) {
  const [copied, setCopied] = useState(false);

  const liveUrl = `${window.location.origin}?room=${session.userId}`;
  const hasLiveblocksKey = !!LIVEBLOCKS_KEY;

  const handleCopyLiveUrl = () => {
    navigator.clipboard.writeText(liveUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      track('InvitePanel_LiveShareLink_Copy', { room_id: session.userId });
    });
  };

  return (
    <aside className="inspector">
      <div className="inspector-header">
        <span>실시간 공동 편집</span>
        <button className="inspector-close" onClick={onClose}>✕</button>
      </div>

      <div style={{ padding: '16px' }}>
        {collabMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <span className="collab-live-badge">● Live</span>
            <span style={{ fontSize: 12, color: 'var(--panel-muted)' }}>공동 편집 세션 진행 중</span>
          </div>
        )}

        {!hasLiveblocksKey ? (
          <p style={{ fontSize: 12, color: 'var(--panel-muted)', lineHeight: 1.6, margin: 0 }}>
            실시간 협업을 사용하려면 <code>VITE_LIVEBLOCKS_PUBLIC_KEY</code> 환경 변수를 설정하세요.
            {' '}liveblocks.io에서 무료 공개 키를 발급받을 수 있습니다.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 12, color: 'var(--panel-muted)', lineHeight: 1.6, marginBottom: 12 }}>
              아래 링크를 동료에게 공유하면 같은 캔버스를 실시간으로 함께 편집할 수 있습니다.
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                readOnly
                value={liveUrl}
                style={{
                  flex: 1, fontSize: 11, padding: '6px 8px',
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 4, color: 'var(--text)', minWidth: 0,
                }}
              />
              <button
                className="tb-btn primary"
                style={{ fontSize: 11, whiteSpace: 'nowrap' }}
                onClick={handleCopyLiveUrl}
              >
                {copied ? '복사됨!' : '링크 복사'}
              </button>
            </div>
            {collabMode && roomOwnerId && roomOwnerId !== session.userId && (
              <p style={{ fontSize: 11, color: '#22c55e', margin: '8px 0 0' }}>
                현재 공동 편집 세션에 참여 중입니다.
              </p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
