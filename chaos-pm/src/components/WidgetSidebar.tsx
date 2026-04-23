import { useState } from 'react';
import { useStore } from '../store';
import type { WidgetType } from '../types';

const WIDGET_ITEMS: { type: WidgetType; icon: string; label: string; desc: string }[] = [
  { type: 'task',    icon: '✓',    label: '작업',      desc: '할 일 & 태스크' },
  { type: 'note',    icon: '📝',   label: '메모',      desc: '자유 텍스트 메모' },
  { type: 'link',    icon: '🔗',   label: '링크',      desc: 'URL 북마크' },
  { type: 'image',   icon: '🖼️',  label: '이미지',    desc: '이미지 & 사진' },
  { type: 'goal',    icon: '🎯',   label: '목표',      desc: 'OKR & 핵심 결과' },
  { type: 'lead',    icon: '💼',   label: '리드',      desc: '세일즈 파이프라인' },
  { type: 'funnel',  icon: '📊',   label: '퍼널',      desc: '리드 집계 차트' },
  { type: 'textbox', icon: 'T',    label: '텍스트박스', desc: '자유 텍스트 배치' },
  { type: 'html',    icon: '⟨/⟩', label: 'HTML',      desc: 'HTML 미리보기' },
  { type: 'fileupload', icon: '📁', label: '파일',       desc: '파일 업로드 & 보관' },
  { type: 'directory', icon: '👥', label: '디렉토리',   desc: '인원 & 연락처 목록' },
  { type: 'worklog',   icon: '📋', label: '작업로그',   desc: '팀 작업 기록 & 로그' },
];

export default function WidgetSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const addWidget = useStore((s) => s.addWidget);
  const setSelectedWidget = useStore((s) => s.setSelectedWidget);
  const viewport = useStore((s) => s.viewport);

  const handleAdd = (type: WidgetType) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight - 52;
    const cx = (vw / 2 - viewport.x) / viewport.scale;
    const cy = (vh / 2 - viewport.y) / viewport.scale;
    const offset = () => (Math.random() - 0.5) * 100;
    const id = addWidget(type, cx - 140 + offset(), cy - 90 + offset());
    setSelectedWidget(id);
  };

  return (
    <aside className={`widget-sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-header">
        {!collapsed && <span className="sidebar-title">위젯</span>}
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? '사이드바 열기' : '사이드바 닫기'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      <div className="sidebar-items">
        {WIDGET_ITEMS.map(({ type, icon, label, desc }) => (
          <button
            key={type}
            className="sidebar-btn"
            onClick={() => handleAdd(type)}
            title={collapsed ? `${label} — ${desc}` : desc}
          >
            <span className="sidebar-icon">{icon}</span>
            {!collapsed && (
              <span className="sidebar-btn-text">
                <span className="sidebar-label">{label}</span>
                <span className="sidebar-desc">{desc}</span>
              </span>
            )}
          </button>
        ))}
      </div>

      {!collapsed && (
        <div className="sidebar-hint">
          더블클릭으로도 작업 추가
        </div>
      )}
    </aside>
  );
}
