import { useEffect, useRef, useState, useMemo } from 'react';
import { useStore } from '../store';
import WidgetNode from './WidgetNode';
import ConnectionLayer from './ConnectionLayer';
import WidgetPicker from './WidgetPicker';
import type { RubberBand, Viewport, WidgetType } from '../types';
import { vpBridge, keyBridge } from '../viewportBridge';

const MIN_SCALE = 0.08;
const MAX_SCALE = 4;

export default function Canvas() {
  const viewport = useStore((s) => s.viewport);
  const setViewport = useStore((s) => s.setViewport);
  const widgets = useStore((s) => s.widgets);
  const pendingConnection = useStore((s) => s.pendingConnection);
  const setPendingConnection = useStore((s) => s.setPendingConnection);
  const clearSelection = useStore((s) => s.clearSelection);
  const setMultiSelected = useStore((s) => s.setMultiSelected);
  const addWidget = useStore((s) => s.addWidget);
  const setSelectedWidget = useStore((s) => s.setSelectedWidget);

  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef(viewport);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);

  const pendingRef = useRef(pendingConnection);
  useEffect(() => { pendingRef.current = pendingConnection; }, [pendingConnection]);

  const zoomTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply viewport directly to DOM — one DOM write, zero React re-renders during pan/zoom.
  const applyViewport = (vp: Viewport) => {
    Object.assign(vpBridge, vp);
    if (worldRef.current) {
      worldRef.current.style.transform = `translate(${vp.x}px,${vp.y}px) scale(${vp.scale})`;
    }
    if (containerRef.current) {
      const gs = 32 * vp.scale;
      const gx = ((vp.x % gs) + gs) % gs;
      const gy = ((vp.y % gs) + gs) % gs;
      containerRef.current.style.backgroundSize = `${gs}px ${gs}px`;
      containerRef.current.style.backgroundPosition = `${gx}px ${gy}px`;
    }
  };

  // Sync DOM when viewport changes via Zustand (zoom, fitToView, initial load)
  useEffect(() => { applyViewport(viewport); }, [viewport]); // eslint-disable-line react-hooks/exhaustive-deps

  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const [rubberBand, setRubberBand] = useState<RubberBand | null>(null);
  const [picker, setPicker] = useState<{ sx: number; sy: number; wx: number; wy: number } | null>(null);
  const rubberBandRef = useRef<RubberBand | null>(null);
  const isRubberBanding = useRef(false);

  // Space key → pan mode (Figma-style)
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = (el as HTMLElement).tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !isTyping()) {
        e.preventDefault();
        keyBridge.space = true;
        containerRef.current?.classList.add('space-pan');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        keyBridge.space = false;
        containerRef.current?.classList.remove('space-pan');
        if (isPanning.current) {
          setViewport(viewportRef.current);
          isPanning.current = false;
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [setViewport]);

  // Document-level mouse tracking
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isPanning.current) {
        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        const vp = viewportRef.current;
        const next = { ...vp, x: vp.x + dx, y: vp.y + dy };
        viewportRef.current = next;
        // Direct DOM update — no React re-render during pan
        applyViewport(next);
      }
      if (pendingRef.current) {
        setPendingConnection({ ...pendingRef.current, toX: e.clientX, toY: e.clientY });
      }
      if (isRubberBanding.current && rubberBandRef.current) {
        const next = { ...rubberBandRef.current, endX: e.clientX, endY: e.clientY };
        rubberBandRef.current = next;
        setRubberBand({ ...next });
      }
    };
    const onUp = (e: MouseEvent) => {
      if (isRubberBanding.current) {
        isRubberBanding.current = false;
        const rb = rubberBandRef.current;
        if (rb) {
          finishRubberBand(rb, e.shiftKey);
        }
        rubberBandRef.current = null;
        setRubberBand(null);
      }
      if (isPanning.current) {
        // Commit pan to Zustand once per gesture
        setViewport(viewportRef.current);
      }
      isPanning.current = false;
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [setViewport, setPendingConnection]);

  const finishRubberBand = (rb: RubberBand, _additive: boolean) => {
    const el = containerRef.current;
    if (!el) return;
    const cr = el.getBoundingClientRect();
    const vp = viewportRef.current;

    const sx = Math.min(rb.startX, rb.endX);
    const sy = Math.min(rb.startY, rb.endY);
    const ex = Math.max(rb.startX, rb.endX);
    const ey = Math.max(rb.startY, rb.endY);

    if (ex - sx < 4 && ey - sy < 4) return;

    // Convert rubber band screen coords to world coords
    const toWorld = (px: number, py: number) => ({
      x: (px - cr.left - vp.x) / vp.scale,
      y: (py - cr.top - vp.y) / vp.scale,
    });
    const wMin = toWorld(sx, sy);
    const wMax = toWorld(ex, ey);

    // Find all widgets whose bounding box intersects the selection rect
    // Exclude group background widgets from rubber band (select children instead)
    const selected = useStore.getState().widgets.filter((w) => {
      if (w.type === 'group') return false;
      return (
        w.x < wMax.x && w.x + w.width > wMin.x &&
        w.y < wMax.y && w.y + w.height > wMin.y
      );
    });

    if (selected.length > 0) {
      setMultiSelected(selected.map((w) => w.id));
    } else {
      clearSelection();
    }
  };

  // Wheel zoom toward cursor
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 0.9091;
      const vp = viewportRef.current;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, vp.scale * factor));
      const ratio = newScale / vp.scale;
      const next = { x: mx - (mx - vp.x) * ratio, y: my - (my - vp.y) * ratio, scale: newScale };
      viewportRef.current = next;
      applyViewport(next); // Direct DOM — no React re-render during rapid zoom
      // Debounce Zustand commit: one re-render after scroll wheel stops
      if (zoomTimer.current) clearTimeout(zoomTimer.current);
      zoomTimer.current = setTimeout(() => {
        setViewport(viewportRef.current);
        zoomTimer.current = null;
      }, 120);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setViewport]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;

    // Space held → pan the canvas regardless of what's under the cursor
    if (keyBridge.space) {
      isPanning.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      containerRef.current?.classList.add('space-pan');
      e.preventDefault();
      return;
    }

    const target = e.target as HTMLElement;
    if (target.closest('[data-widget]')) return;

    if (e.altKey || e.metaKey) {
      // Alt/Cmd + drag = pan
      clearSelection();
      isPanning.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    } else if (e.shiftKey) {
      // Shift + drag = additive rubber band (not used differently here)
      isRubberBanding.current = true;
      const rb = { startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY };
      rubberBandRef.current = rb;
      setRubberBand(rb);
    } else {
      // Plain drag: pan
      clearSelection();
      isPanning.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
    e.preventDefault();
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (pendingRef.current) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-widget]')) setPendingConnection(null);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-widget]')) return;
    const vp = viewportRef.current;
    const cr = containerRef.current?.getBoundingClientRect();
    const wx = (e.clientX - (cr?.left ?? 0) - vp.x) / vp.scale - 140;
    const wy = (e.clientY - (cr?.top ?? 0) - vp.y) / vp.scale - 90;
    setPicker({ sx: e.clientX, sy: e.clientY, wx, wy });
  };

  const handlePickerSelect = (type: WidgetType) => {
    if (!picker) return;
    const id = addWidget(type, picker.wx, picker.wy);
    setSelectedWidget(id);
    setPicker(null);
  };

  const collapsedGroupIds = useMemo(
    () => new Set(
      widgets
        .filter((w) => w.type === 'group' && (w.data as { collapsed: boolean }).collapsed)
        .map((w) => w.id)
    ),
    [widgets]
  );

  const visibleWidgets = useMemo(() => {
    const sorted = [...widgets].sort((a, b) => a.zIndex - b.zIndex);
    return sorted.filter((w) => !w.groupId || !collapsedGroupIds.has(w.groupId));
  }, [widgets, collapsedGroupIds]);

  // Rubber band rect in screen space
  const rb = rubberBand;
  const rbRect = rb
    ? {
        left: Math.min(rb.startX, rb.endX),
        top: Math.min(rb.startY, rb.endY),
        width: Math.abs(rb.endX - rb.startX),
        height: Math.abs(rb.endY - rb.startY),
      }
    : null;

  // Get canvas container offset for rubber band display
  const cr = containerRef.current?.getBoundingClientRect();

  return (
    <div
      ref={containerRef}
      className={`canvas-container${pendingConnection ? ' connecting' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      <div ref={worldRef} className="world">
        {visibleWidgets.map((w) => (
          <WidgetNode key={w.id} widget={w} />
        ))}
        <ConnectionLayer />
      </div>

      {/* Rubber band selection overlay */}
      {rbRect && cr && (
        <div
          style={{
            position: 'absolute',
            left: rbRect.left - cr.left,
            top: rbRect.top - cr.top,
            width: rbRect.width,
            height: rbRect.height,
            border: '1px solid #6366f1',
            background: 'rgba(99,102,241,0.08)',
            pointerEvents: 'none',
            borderRadius: 3,
          }}
        />
      )}

      {picker && (
        <WidgetPicker
          x={picker.sx}
          y={picker.sy}
          onSelect={handlePickerSelect}
          onDismiss={() => setPicker(null)}
        />
      )}
    </div>
  );
}
