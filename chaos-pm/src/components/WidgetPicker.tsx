import { useEffect, useRef } from 'react';
import type { WidgetType } from '../types';

const ITEMS: { type: WidgetType; icon: string; label: string }[] = [
  { type: 'task',    icon: '✓',    label: '작업'      },
  { type: 'note',    icon: '📝',   label: '메모'      },
  { type: 'link',    icon: '🔗',   label: '링크'      },
  { type: 'image',   icon: '🖼️',  label: '이미지'    },
  { type: 'goal',    icon: '🎯',   label: '목표'      },
  { type: 'lead',    icon: '💼',   label: '리드'      },
  { type: 'funnel',  icon: '📊',   label: '퍼널'      },
  { type: 'textbox', icon: 'T',    label: '텍스트'    },
  { type: 'html',    icon: '⟨/⟩', label: 'HTML'      },
  { type: 'fileupload', icon: '📁', label: '파일'     },
];

interface Props {
  x: number;
  y: number;
  onSelect: (type: WidgetType) => void;
  onDismiss: () => void;
}

export default function WidgetPicker({ x, y, onSelect, onDismiss }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Adjust position so picker stays on screen
  const PICKER_W = 260;
  const PICKER_H = 320;
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
        style={{ left, top }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="picker-header">위젯 추가</div>
        <div className="picker-grid">
          {ITEMS.map(({ type, icon, label }) => (
            <button
              key={type}
              className="picker-item"
              onClick={() => onSelect(type)}
            >
              <span className="picker-item-icon">{icon}</span>
              <span className="picker-item-label">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
