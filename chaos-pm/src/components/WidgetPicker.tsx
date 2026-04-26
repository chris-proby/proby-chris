import { useEffect, useRef } from 'react';
import type { WidgetType } from '../types';
import { WIDGET_GROUPS } from '../widgetGroups';
import { track } from '../analytics';

interface Props {
  x: number;
  y: number;
  onSelect: (type: WidgetType) => void;
  onDismiss: () => void;
}

export default function WidgetPicker({ x, y, onSelect, onDismiss }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const PICKER_W = 280;
  const PICKER_H = 400;
  const left = Math.min(x, window.innerWidth - PICKER_W - 12);
  const top  = Math.min(y, window.innerHeight - PICKER_H - 12);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  return (
    <>
      <div className="picker-backdrop" onMouseDown={onDismiss} />
      <div
        ref={ref}
        className="widget-picker"
        style={{ left, top, width: PICKER_W }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="picker-header">위젯 추가</div>
        <div className="picker-body">
          {WIDGET_GROUPS.map((group, gi) => (
            <div key={group.label} className={`picker-group${gi > 0 ? ' picker-group-divider' : ''}`}>
              <div className="picker-group-label">{group.label}</div>
              <div className="picker-grid">
                {group.items.map(({ type, icon, label }) => (
                  <button
                    key={type}
                    className="picker-item"
                    onClick={() => { track(`WidgetPicker_Select_${type}`); onSelect(type); }}
                  >
                    <span className="picker-item-icon">{icon}</span>
                    <span className="picker-item-label">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
