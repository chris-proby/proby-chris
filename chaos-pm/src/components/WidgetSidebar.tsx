import { useState } from 'react';
import { useStore } from '../store';
import type { WidgetType } from '../types';
import { WIDGET_GROUPS } from '../widgetGroups';

export default function WidgetSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    () => Object.fromEntries(WIDGET_GROUPS.map((g) => [g.label, true]))
  );
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

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));

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
        {WIDGET_GROUPS.map((group, gi) => {
          const isOpen = openGroups[group.label] ?? true;
          return (
            <div key={group.label} className={`sidebar-group${gi > 0 ? ' sidebar-group-divider' : ''}`}>
              {!collapsed && (
                <button
                  className="sidebar-group-header"
                  onClick={() => toggleGroup(group.label)}
                  title={isOpen ? '접기' : '펼치기'}
                >
                  <span className="sidebar-group-label">{group.label}</span>
                  <span className={`sidebar-group-chevron${isOpen ? ' open' : ''}`}>›</span>
                </button>
              )}
              {(collapsed || isOpen) && group.items.map(({ type, icon, label, desc }) => (
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
          );
        })}
      </div>

      {!collapsed && (
        <div className="sidebar-hint">더블클릭으로도 위젯 추가</div>
      )}
    </aside>
  );
}
