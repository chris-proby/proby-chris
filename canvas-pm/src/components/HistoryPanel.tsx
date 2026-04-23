import { useStore } from '../store';

interface Props {
  onClose: () => void;
}

export default function HistoryPanel({ onClose }: Props) {
  const snapshots = useStore((s) => s.snapshots);
  const restoreSnapshot = useStore((s) => s.restoreSnapshot);
  const deleteSnapshot = useStore((s) => s.deleteSnapshot);
  const clearSnapshots = useStore((s) => s.clearSnapshots);

  const fmt = (ts: number) => {
    const d = new Date(ts);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (isToday) return time;
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) + ' ' + time;
  };

  const handleRestore = (id: string) => {
    if (confirm('이 시점으로 복원하시겠습니까? 현재 변경사항이 히스토리에 저장됩니다.')) {
      // Save current state before restoring
      useStore.getState().saveSnapshot('복원 전 상태');
      useStore.getState().restoreSnapshot(id);
    }
  };

  return (
    <aside className="history-panel">
      <div className="inspector-header">
        <div className="inspector-title">🕐 버전 히스토리</div>
        <button className="inspector-close" onClick={onClose}>×</button>
      </div>

      {snapshots.length === 0 ? (
        <div className="history-empty">
          <div className="history-empty-icon">🕐</div>
          <div>아직 저장된 버전이 없습니다</div>
          <div style={{ fontSize: 11, marginTop: 4, color: 'var(--panel-muted)' }}>
            변경사항이 생기면 자동으로 저장됩니다
          </div>
        </div>
      ) : (
        <>
          <div className="history-list">
            {snapshots.map((snap, i) => (
              <div key={snap.id} className={`history-item${i === 0 ? ' history-item-latest' : ''}`}>
                <div className="history-item-left">
                  <div className="history-item-label">{snap.label}</div>
                  <div className="history-item-time">{fmt(snap.timestamp)}</div>
                  <div className="history-item-meta">
                    위젯 {snap.widgets.length}개 · 연결 {snap.connections.length}개
                  </div>
                </div>
                <div className="history-item-actions">
                  {i !== 0 && (
                    <button
                      className="history-restore-btn"
                      onClick={() => handleRestore(snap.id)}
                      title="이 버전으로 복원"
                    >
                      복원
                    </button>
                  )}
                  {i === 0 && (
                    <span className="history-current-badge">현재</span>
                  )}
                  <button
                    className="history-delete-btn"
                    onClick={() => deleteSnapshot(snap.id)}
                    title="이 항목 삭제"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="inspector-footer">
            <button
              className="btn-danger"
              onClick={() => { if (confirm('모든 히스토리를 삭제하시겠습니까?')) clearSnapshots(); }}
            >
              🗑 히스토리 전체 삭제
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
