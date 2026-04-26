import { useEffect, useState } from 'react';
import { LIVEBLOCKS_KEY } from '../liveblocks';
import { track } from '../analytics';
import type { AuthSession } from '../auth';
import { getAccessToken, SUPABASE_CONFIGURED } from '../supabase';

interface Props {
  session: AuthSession;
  onClose: () => void;
  collabMode?: boolean;
  roomOwnerId?: string;
}

export default function InvitePanel({ session, onClose, collabMode, roomOwnerId }: Props) {
  const [copied, setCopied] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hasLiveblocksKey = !!LIVEBLOCKS_KEY;

  // Resolve the room we're inviting to (owner's own room when not a guest)
  const room = `chaospm-${roomOwnerId ?? session.userId}`;

  // Fetch the canvas share_token on mount
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) return;
    let mounted = true;
    (async () => {
      const token = await getAccessToken();
      if (!token) return;
      const r = await fetch(`/api/canvas/share?room_id=${encodeURIComponent(room)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const json = await r.json();
      if (mounted) setShareToken(json.share_token ?? null);
    })();
    return () => { mounted = false; };
  }, [room]);

  const liveUrl = shareToken
    ? `${window.location.origin}?room=${session.userId}&t=${shareToken}`
    : `${window.location.origin}?room=${session.userId}`;

  const handleCopyLiveUrl = () => {
    navigator.clipboard.writeText(liveUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      track('InvitePanel_LiveShareLink_Copy', { room_id: session.userId, has_token: !!shareToken });
    });
  };

  const rotateToken = async (revoke = false) => {
    if (!SUPABASE_CONFIGURED) return;
    if (revoke && !confirm('공유를 해제하면 현재 접속 중인 게스트도 모두 즉시 차단됩니다. 계속하시겠어요?')) return;
    setBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const r = await fetch('/api/canvas/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ room_id: room, revoke }),
      });
      if (r.ok) {
        const json = await r.json();
        setShareToken(json.share_token ?? null);
        track(revoke ? 'InvitePanel_ShareToken_Revoke' : 'InvitePanel_ShareToken_Rotate', {
          evicted: json.evicted ?? 0,
        });
        if (revoke && (json.evicted ?? 0) > 0) {
          alert(`${json.evicted}명의 게스트를 차단했습니다.`);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  // Owner-only action visibility
  const isOwner = !roomOwnerId || roomOwnerId === session.userId;

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
            실시간 협업이 설정되지 않았습니다. 관리자에게 문의해주세요.
          </p>
        ) : isOwner && SUPABASE_CONFIGURED && !shareToken ? (
          <div style={{ padding: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6 }}>
            <p style={{ fontSize: 12, color: '#ef4444', margin: '0 0 8px' }}>
              공유 링크가 비활성화되어 있습니다.
            </p>
            <button
              className="tb-btn primary"
              style={{ fontSize: 11 }}
              disabled={busy}
              onClick={() => rotateToken(false)}
            >
              {busy ? '생성 중…' : '공유 링크 활성화'}
            </button>
          </div>
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

            {isOwner && SUPABASE_CONFIGURED && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button
                  className="tb-btn"
                  style={{ fontSize: 11, flex: 1 }}
                  disabled={busy}
                  onClick={() => rotateToken(false)}
                  title="기존 링크는 즉시 무효화됩니다"
                >
                  새 링크 생성
                </button>
                <button
                  className="tb-btn"
                  style={{ fontSize: 11, flex: 1, color: '#ef4444' }}
                  disabled={busy}
                  onClick={() => rotateToken(true)}
                  title="공유 링크를 즉시 무효화합니다"
                >
                  공유 해제
                </button>
              </div>
            )}

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
