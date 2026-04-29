import { useCallback, useEffect, useState } from 'react';
import { LIVEBLOCKS_KEY } from '../liveblocks';
import { track } from '../analytics';
import type { AuthSession } from '../auth';
import { authedFetch, SUPABASE_CONFIGURED } from '../supabase';

interface Props {
  session: AuthSession;
  onClose: () => void;
  collabMode?: boolean;
  roomOwnerId?: string;
}

type Role = 'owner' | 'editor' | 'viewer';
type ShareRole = 'editor' | 'viewer';

interface Member {
  user_id: string;
  email: string;
  name: string;
  role: Role;
  invited_at: string;
}
interface Pending {
  id: string;
  email: string;
  role: ShareRole;
  created_at: string;
}

const ROLE_LABEL: Record<Role, string> = {
  owner: '소유자',
  editor: '편집자',
  viewer: '뷰어',
};

export default function InvitePanel({ session, onClose, collabMode, roomOwnerId }: Props) {
  const [copied, setCopied] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareRole, setShareRole] = useState<ShareRole>('editor');
  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<ShareRole>('editor');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const hasLiveblocksKey = !!LIVEBLOCKS_KEY;
  const room = `chaospm-${roomOwnerId ?? session.userId}`;
  const isOwner = !roomOwnerId || roomOwnerId === session.userId;

  const refresh = useCallback(async () => {
    if (!SUPABASE_CONFIGURED) return;
    const [shareRes, membersRes] = await Promise.all([
      authedFetch(`/api/canvas/share?room_id=${encodeURIComponent(room)}`),
      authedFetch(`/api/canvas/members?room_id=${encodeURIComponent(room)}`),
    ]);
    if (shareRes.ok) {
      const json = await shareRes.json();
      setShareToken(json.share_token ?? null);
      setShareRole((json.share_role as ShareRole) ?? 'editor');
    }
    if (membersRes.ok) {
      const json = await membersRes.json();
      setMembers((json.members as Member[]) ?? []);
      setPending((json.pending as Pending[]) ?? []);
    }
  }, [room]);

  useEffect(() => { void refresh(); }, [refresh]);

  const flash = (msg: string, kind: 'info' | 'error' = 'info') => {
    if (kind === 'info') { setInfo(msg); setTimeout(() => setInfo(null), 2500); }
    else { setError(msg); setTimeout(() => setError(null), 3500); }
  };

  const liveUrl = shareToken
    ? `${window.location.origin}?room=${roomOwnerId ?? session.userId}&t=${shareToken}`
    : `${window.location.origin}?room=${roomOwnerId ?? session.userId}`;

  const handleCopyLiveUrl = () => {
    navigator.clipboard.writeText(liveUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      track('InvitePanel_LiveShareLink_Copy', { has_token: !!shareToken, share_role: shareRole });
    });
  };

  const updateShare = async (patch: { rotate?: boolean; revoke?: boolean; share_role?: ShareRole }) => {
    if (!SUPABASE_CONFIGURED) return;
    if (patch.revoke && !confirm('공유를 해제하면 현재 접속 중인 게스트도 모두 즉시 차단됩니다. 계속하시겠어요?')) return;
    setBusy(true);
    try {
      const r = await authedFetch('/api/canvas/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: room, ...patch }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) { flash(json.error ?? '실패', 'error'); return; }
      setShareToken(json.share_token ?? null);
      setShareRole((json.share_role as ShareRole) ?? 'editor');
      if (patch.revoke) {
        flash(json.evicted > 0 ? `${json.evicted}명의 게스트를 차단했습니다.` : '공유 링크가 해제되었습니다.');
        await refresh();
      } else if (patch.rotate) {
        flash('새 링크가 생성되었습니다.');
      } else if (patch.share_role) {
        flash(`기본 역할이 ${ROLE_LABEL[patch.share_role]}(으)로 변경되었습니다.`);
      }
    } finally {
      setBusy(false);
    }
  };

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!SUPABASE_CONFIGURED) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setBusy(true);
    try {
      const r = await authedFetch('/api/canvas/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: room, email, role: inviteRole }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) { flash(json.error ?? '초대 실패', 'error'); return; }
      setInviteEmail('');
      flash(json.status === 'pending' ? `${email} 은 가입 후 자동으로 추가됩니다.` : `${email} 을 ${ROLE_LABEL[inviteRole]}(으)로 추가했습니다.`);
      track('InvitePanel_EmailInvite', { role: inviteRole, status: json.status });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (userId: string, role: ShareRole) => {
    setBusy(true);
    try {
      const r = await authedFetch('/api/canvas/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: room, user_id: userId, role }),
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); flash(j.error ?? '변경 실패', 'error'); return; }
      await refresh();
    } finally { setBusy(false); }
  };

  const removeMember = async (userId: string, email: string) => {
    if (!confirm(`${email} 을 캔버스에서 제거할까요?`)) return;
    setBusy(true);
    try {
      const r = await authedFetch('/api/canvas/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: room, user_id: userId }),
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); flash(j.error ?? '제거 실패', 'error'); return; }
      await refresh();
    } finally { setBusy(false); }
  };

  const removePending = async (id: string) => {
    setBusy(true);
    try {
      const r = await authedFetch('/api/canvas/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: room, pending_id: id }),
      });
      if (!r.ok) { const j = await r.json().catch(() => ({})); flash(j.error ?? '취소 실패', 'error'); return; }
      await refresh();
    } finally { setBusy(false); }
  };

  return (
    <aside className="inspector">
      <div className="inspector-header">
        <span>공유 및 멤버</span>
        <button className="inspector-close" onClick={onClose}>✕</button>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {collabMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="collab-live-badge">● Live</span>
            <span style={{ fontSize: 12, color: 'var(--panel-muted)' }}>공동 편집 세션 진행 중</span>
          </div>
        )}

        {!hasLiveblocksKey ? (
          <p style={{ fontSize: 12, color: 'var(--panel-muted)', margin: 0 }}>
            실시간 협업이 설정되지 않았습니다. 관리자에게 문의해주세요.
          </p>
        ) : !SUPABASE_CONFIGURED ? (
          <p style={{ fontSize: 12, color: 'var(--panel-muted)', margin: 0 }}>
            Supabase 미연결 상태입니다. 멤버 관리는 사용할 수 없습니다.
          </p>
        ) : (
          <>
            {/* ── Email invite (owner only) ── */}
            {isOwner && (
              <section>
                <h4 style={{ fontSize: 12, fontWeight: 600, margin: '0 0 8px', color: 'var(--text)' }}>
                  이메일로 초대
                </h4>
                <form onSubmit={submitInvite} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="email"
                      required
                      placeholder="email@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      style={{
                        flex: 1, fontSize: 12, padding: '6px 8px',
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 4, color: 'var(--text)', minWidth: 0,
                      }}
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as ShareRole)}
                      style={{
                        fontSize: 12, padding: '6px 6px',
                        background: 'var(--surface)', border: '1px solid var(--border)',
                        borderRadius: 4, color: 'var(--text)',
                      }}
                    >
                      <option value="editor">편집자</option>
                      <option value="viewer">뷰어</option>
                    </select>
                  </div>
                  <button type="submit" className="tb-btn primary" style={{ fontSize: 11 }} disabled={busy}>
                    초대하기
                  </button>
                  <p style={{ fontSize: 11, color: 'var(--panel-muted)', margin: '2px 0 0' }}>
                    가입한 사용자는 즉시 추가됩니다. 미가입자는 가입 시 자동 합류합니다.
                  </p>
                </form>
              </section>
            )}

            {/* ── Members list ── */}
            <section>
              <h4 style={{ fontSize: 12, fontWeight: 600, margin: '0 0 8px', color: 'var(--text)' }}>
                멤버 ({members.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {members.map((m) => (
                  <div key={m.user_id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 8px', background: 'var(--surface)',
                    border: '1px solid var(--border)', borderRadius: 4,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.name || m.email.split('@')[0]}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--panel-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.email}
                      </div>
                    </div>
                    {m.role === 'owner' || !isOwner || m.user_id === session.userId ? (
                      <span style={{ fontSize: 11, color: 'var(--panel-muted)' }}>
                        {ROLE_LABEL[m.role]}
                      </span>
                    ) : (
                      <>
                        <select
                          value={m.role}
                          onChange={(e) => changeRole(m.user_id, e.target.value as ShareRole)}
                          disabled={busy}
                          style={{
                            fontSize: 11, padding: '3px 4px',
                            background: 'var(--bg)', border: '1px solid var(--border)',
                            borderRadius: 4, color: 'var(--text)',
                          }}
                        >
                          <option value="editor">편집자</option>
                          <option value="viewer">뷰어</option>
                        </select>
                        <button
                          onClick={() => removeMember(m.user_id, m.email)}
                          disabled={busy}
                          title="제거"
                          style={{
                            fontSize: 11, padding: '3px 6px', cursor: 'pointer',
                            background: 'transparent', border: '1px solid var(--border)',
                            borderRadius: 4, color: '#ef4444',
                          }}
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* ── Pending invites ── */}
            {pending.length > 0 && (
              <section>
                <h4 style={{ fontSize: 12, fontWeight: 600, margin: '0 0 8px', color: 'var(--text)' }}>
                  대기 중인 초대 ({pending.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {pending.map((p) => (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 8px', background: 'var(--surface)',
                      border: '1px dashed var(--border)', borderRadius: 4,
                    }}>
                      <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.email}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--panel-muted)' }}>{ROLE_LABEL[p.role]}</span>
                      {isOwner && (
                        <button
                          onClick={() => removePending(p.id)}
                          disabled={busy}
                          style={{
                            fontSize: 11, padding: '3px 6px', cursor: 'pointer',
                            background: 'transparent', border: '1px solid var(--border)',
                            borderRadius: 4, color: '#ef4444',
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Share link ── */}
            <section>
              <h4 style={{ fontSize: 12, fontWeight: 600, margin: '0 0 8px', color: 'var(--text)' }}>
                공유 링크
              </h4>
              {!shareToken && isOwner ? (
                <div style={{ padding: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6 }}>
                  <p style={{ fontSize: 12, color: '#ef4444', margin: '0 0 8px' }}>
                    공유 링크가 비활성화되어 있습니다.
                  </p>
                  <button
                    className="tb-btn primary"
                    style={{ fontSize: 11 }}
                    disabled={busy}
                    onClick={() => updateShare({ rotate: true })}
                  >
                    공유 링크 활성화
                  </button>
                </div>
              ) : (
                <>
                  {isOwner && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--panel-muted)' }}>링크로 들어오면 기본 역할:</span>
                      <select
                        value={shareRole}
                        onChange={(e) => updateShare({ share_role: e.target.value as ShareRole })}
                        disabled={busy}
                        style={{
                          fontSize: 11, padding: '3px 4px',
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: 4, color: 'var(--text)',
                        }}
                      >
                        <option value="editor">편집자</option>
                        <option value="viewer">뷰어</option>
                      </select>
                    </div>
                  )}
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
                  {isOwner && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button
                        className="tb-btn"
                        style={{ fontSize: 11, flex: 1 }}
                        disabled={busy}
                        onClick={() => updateShare({ rotate: true })}
                        title="기존 링크는 즉시 무효화됩니다"
                      >
                        새 링크 생성
                      </button>
                      <button
                        className="tb-btn"
                        style={{ fontSize: 11, flex: 1, color: '#ef4444' }}
                        disabled={busy}
                        onClick={() => updateShare({ revoke: true })}
                        title="공유 링크를 즉시 무효화하고 모든 게스트를 차단합니다"
                      >
                        공유 해제
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>

            {(info || error) && (
              <div style={{
                fontSize: 11,
                padding: '6px 8px',
                borderRadius: 4,
                background: error ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                color: error ? '#ef4444' : '#22c55e',
              }}>
                {error ?? info}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
