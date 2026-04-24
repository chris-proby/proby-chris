import { useRef } from 'react';
import { useStore } from '../store';
import type { GroupData } from '../types';
import type { Theme } from '../hooks/useTheme';
import type { AuthSession } from '../auth';

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
}

export default function Toolbar({ onToggleHistory, showHistory, theme, onToggleTheme, session, onLogout, onToggleInvite, showInvite, collabMode }: ToolbarProps) {
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
      <div className="toolbar-logo">messy<span>notion</span></div>
      <div className="toolbar-divider" />

      <button className="tb-btn" onClick={() => zoom(0.2)} title="Zoom in">
        <span className="icon">＋</span>
      </button>
      <span className="zoom-display" onDoubleClick={resetZoom} title="Double-click to reset zoom">
        {Math.round(viewport.scale * 100)}%
      </span>
      <button className="tb-btn" onClick={() => zoom(-0.167)} title="Zoom out">
        <span className="icon">－</span>
      </button>
      <button className="tb-btn" onClick={fitToView} title="전체 보기">
        ⊙ 전체 보기
      </button>

      <div className="toolbar-right">
        <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        <button className="tb-btn" onClick={exportCanvas} title="캔버스 내보내기 (JSON 백업)">
          ↓ 내보내기
        </button>
        <button className="tb-btn" onClick={() => importRef.current?.click()} title="캔버스 가져오기 (JSON 복원)">
          ↑ 가져오기
        </button>
        <div className="toolbar-divider" />
        <button
          className="tb-btn"
          onClick={onToggleTheme}
          title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
        >
          {theme === 'dark' ? '☀' : '🌙'}
        </button>
        <button
          className={`tb-btn${showHistory ? ' active' : ''}`}
          onClick={onToggleHistory}
          title="버전 히스토리"
          style={{ position: 'relative' }}
        >
          🕐 히스토리
          {snapshotCount > 0 && (
            <span className="history-badge">{snapshotCount}</span>
          )}
        </button>
        {canGroup && (
          <button className="tb-btn primary" onClick={groupSelected} title="선택한 위젯을 그룹으로 묶기 (⌘G)">
            ⬡ 그룹 만들기
          </button>
        )}
        {isGroupSelected && !isGroupCollapsed && (
          <button className="tb-btn" onClick={() => ungroupWidget(selectedWidgetId!)} title="그룹 해제">
            ↗ 그룹 해제
          </button>
        )}
        {hasSelection && (
          <button className="tb-btn danger" onClick={deleteSelected} title="삭제 (Del)">
            🗑 삭제
          </button>
        )}
        <div className="toolbar-divider" />
        <button
          className={`tb-btn${showInvite ? ' active' : ''}`}
          onClick={onToggleInvite}
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
