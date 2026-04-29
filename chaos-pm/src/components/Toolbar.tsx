import { useRef } from 'react';
import { useStore } from '../store';
import type { GroupData } from '../types';
import type { Theme } from '../hooks/useTheme';
import type { AuthSession } from '../auth';
import { track } from '../analytics';
import type { CanvasOwnership } from '../AuthedApp';

interface ToolbarProps {
  onToggleHistory: () => void;
  showHistory: boolean;
  theme: Theme;
  onToggleTheme: () => void;
  session: AuthSession;
  onLogout: () => void;
  onToggleInvite: () => void;
  showInvite: boolean;
  collabMode?: boolean;
  ownership?: CanvasOwnership;
}

export default function Toolbar({ onToggleHistory, showHistory, theme, onToggleTheme, session, onLogout, onToggleInvite, showInvite, collabMode, ownership }: ToolbarProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const viewport = useStore((s) => s.viewport);
  const setViewport = useStore((s) => s.setViewport);
  const fitToView = useStore((s) => s.fitToView);
  const deleteSelected = useStore((s) => s.deleteSelected);
  const selectedWidgetId = useStore((s) => s.selectedWidgetId);
  const selectedConnectionId = useStore((s) => s.selectedConnectionId);
  const multiSelectedIds = useStore((s) => s.multiSelectedIds);
  const widgets = useStore((s) => s.widgets);
  const groupSelected = useStore((s) => s.groupSelected);
  const ungroupWidget = useStore((s) => s.ungroupWidget);
  const exportCanvas = useStore((s) => s.exportCanvas);
  const importCanvas = useStore((s) => s.importCanvas);

  const hasSelection = selectedWidgetId || selectedConnectionId;
  const snapshotCount = useStore((s) => s.snapshots.length);
  const canGroup = multiSelectedIds.length >= 2;
  const selectedWidget = widgets.find((w) => w.id === selectedWidgetId);
  const isGroupSelected = selectedWidget?.type === 'group';
  const isGroupCollapsed = isGroupSelected && (selectedWidget?.data as GroupData)?.collapsed;

  const zoom = (delta: number) => {
    const vw = window.innerWidth / 2;
    const vh = (window.innerHeight - 52) / 2;
    const newScale = Math.max(0.08, Math.min(4, viewport.scale * (1 + delta)));
    const ratio = newScale / viewport.scale;
    setViewport({
      x: vw - (vw - viewport.x) * ratio,
      y: vh - (vh - viewport.y) * ratio,
      scale: newScale,
    });
  };

  const resetZoom = () => {
    const vw = window.innerWidth / 2;
    const vh = (window.innerHeight - 52) / 2;
    setViewport({ x: vw, y: vh, scale: 1 });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importCanvas(file);
    } catch (err) {
      alert(err instanceof Error ? err.message : '가져오기 실패');
    }
    e.target.value = '';
  };

  return (
    <header className="toolbar">
      <div className="toolbar-logo">chaos<span>PM</span></div>
      <div className="toolbar-divider" />
      <CanvasBadge ownership={ownership} />
      <div className="toolbar-divider" />

      <button className="tb-btn" onClick={() => { zoom(0.2); track('Toolbar_ZoomIn_Click', { scale: Math.round(viewport.scale * 120) }); }} title="Zoom in">
        <span className="icon">＋</span>
      </button>
      <span className="zoom-display" onDoubleClick={() => { resetZoom(); track('Toolbar_ZoomReset_DoubleClick'); }} title="Double-click to reset zoom">
        {Math.round(viewport.scale * 100)}%
      </span>
      <button className="tb-btn" onClick={() => { zoom(-0.167); track('Toolbar_ZoomOut_Click', { scale: Math.round(viewport.scale * 83) }); }} title="Zoom out">
        <span className="icon">－</span>
      </button>
      <button className="tb-btn" onClick={() => { fitToView(); track('Toolbar_FitToView_Click', { widget_count: widgets.length }); }} title="전체 보기">
        ⊙ 전체 보기
      </button>

      <div className="toolbar-right">
        <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        <button className="tb-btn" onClick={() => { exportCanvas(); track('Toolbar_Export_Click'); }} title="캔버스 내보내기 (JSON 백업)">
          ↓ 내보내기
        </button>
        <button className="tb-btn" onClick={() => { importRef.current?.click(); track('Toolbar_Import_Click'); }} title="캔버스 가져오기 (JSON 복원)">
          ↑ 가져오기
        </button>
        <div className="toolbar-divider" />
        <button
          className="tb-btn"
          onClick={() => { onToggleTheme(); track('Toolbar_ThemeToggle_Click', { new_theme: theme === 'dark' ? 'light' : 'dark' }); }}
          title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
        >
          {theme === 'dark' ? '☀' : '🌙'}
        </button>
        <button
          className={`tb-btn${showHistory ? ' active' : ''}`}
          onClick={() => { onToggleHistory(); track(showHistory ? 'Toolbar_HistoryPanel_Close' : 'Toolbar_HistoryPanel_Open'); }}
          title="버전 히스토리"
          style={{ position: 'relative' }}
        >
          🕐 히스토리
          {snapshotCount > 0 && (
            <span className="history-badge">{snapshotCount}</span>
          )}
        </button>
        {canGroup && (
          <button className="tb-btn primary" onClick={() => { groupSelected(); track('Toolbar_GroupWidgets_Click', { widget_count: multiSelectedIds.length }); }} title="선택한 위젯을 그룹으로 묶기 (⌘G)">
            ⬡ 그룹 만들기
          </button>
        )}
        {isGroupSelected && !isGroupCollapsed && (
          <button className="tb-btn" onClick={() => { ungroupWidget(selectedWidgetId!); track('Toolbar_UngroupWidget_Click'); }} title="그룹 해제">
            ↗ 그룹 해제
          </button>
        )}
        {hasSelection && (
          <button className="tb-btn danger" onClick={() => { deleteSelected(); track('Toolbar_DeleteWidget_Click', { widget_type: selectedWidget?.type }); }} title="삭제 (Del)">
            🗑 삭제
          </button>
        )}
        <div className="toolbar-divider" />
        <button
          className={`tb-btn${showInvite ? ' active' : ''}`}
          onClick={() => { onToggleInvite(); track(showInvite ? 'Toolbar_InvitePanel_Close' : 'Toolbar_InvitePanel_Open'); }}
          title="초대 관리"
        >
          {collabMode ? <><span className="collab-live-dot" />공동편집</> : '✉ 초대'}
        </button>
        <div className="toolbar-user">
          <span className="toolbar-user-name" title={session.email}>{session.name}</span>
          <button className="tb-btn" onClick={onLogout} title="로그아웃">
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}

function CanvasBadge({ ownership }: { ownership?: CanvasOwnership }) {
  if (!ownership) return null;
  const { isGuest, ownerName, myRole } = ownership;

  if (!isGuest) {
    return (
      <span
        title="당신이 소유한 캔버스입니다"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', fontSize: 12, fontWeight: 500,
          background: 'rgba(34,197,94,0.12)', color: '#16a34a',
          border: '1px solid rgba(34,197,94,0.3)', borderRadius: 999,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a' }} />
        내 캔버스
      </span>
    );
  }

  const isViewer = myRole === 'viewer';
  const isEditor = myRole === 'editor' || myRole === 'owner';
  const roleLabel = isViewer ? '보기 전용' : isEditor ? '편집 가능' : '권한 확인 중';
  const tone = isViewer ? '#f59e0b' : '#3b82f6';
  const bg = isViewer ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.12)';
  const border = isViewer ? 'rgba(245,158,11,0.35)' : 'rgba(59,130,246,0.35)';
  return (
    <span
      title={isViewer ? '읽기 전용 모드 — 편집 권한이 없습니다' : '편집 권한이 부여된 다른 사람의 캔버스입니다'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', fontSize: 12, fontWeight: 500,
        background: bg, color: tone, border: `1px solid ${border}`, borderRadius: 999,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: tone }} />
      {ownerName ? `${ownerName}님의 캔버스` : '공유받은 캔버스'} · {roleLabel}
    </span>
  );
}
