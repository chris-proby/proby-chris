import { forwardRef, useMemo } from 'react';
import { useStore } from '../store';
import type { PortSide, Point, Widget } from '../types';

const CONN_COLORS: Record<string, string> = {
  'relates-to': '#6366f1',
  'blocks': '#ef4444',
  'depends-on': '#3b82f6',
  'goal-parent': '#10b981',
};

function getPortWorldPos(w: Widget, port: PortSide): Point {
  switch (port) {
    case 'top':    return { x: w.x + w.width / 2, y: w.y };
    case 'right':  return { x: w.x + w.width,     y: w.y + w.height / 2 };
    case 'bottom': return { x: w.x + w.width / 2, y: w.y + w.height };
    case 'left':   return { x: w.x,               y: w.y + w.height / 2 };
  }
}

function getBestPorts(from: Widget, to: Widget): { fromPort: PortSide; toPort: PortSide } {
  const fcx = from.x + from.width / 2;
  const fcy = from.y + from.height / 2;
  const tcx = to.x + to.width / 2;
  const tcy = to.y + to.height / 2;
  const dx = tcx - fcx;
  const dy = tcy - fcy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { fromPort: 'right', toPort: 'left' }
      : { fromPort: 'left', toPort: 'right' };
  }
  return dy >= 0
    ? { fromPort: 'bottom', toPort: 'top' }
    : { fromPort: 'top', toPort: 'bottom' };
}

function bezierPath(from: Point, to: Point, fromPort: PortSide): string {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);

  let cp1: Point, cp2: Point;
  const h = Math.max(50, (fromPort === 'right' || fromPort === 'left') ? dx * 0.45 : dy * 0.45);

  switch (fromPort) {
    case 'right':  cp1 = { x: from.x + h, y: from.y }; cp2 = { x: to.x - h, y: to.y }; break;
    case 'left':   cp1 = { x: from.x - h, y: from.y }; cp2 = { x: to.x + h, y: to.y }; break;
    case 'bottom': cp1 = { x: from.x, y: from.y + h }; cp2 = { x: to.x, y: to.y - h }; break;
    case 'top':    cp1 = { x: from.x, y: from.y - h }; cp2 = { x: to.x, y: to.y + h }; break;
  }

  return `M ${from.x} ${from.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${to.x} ${to.y}`;
}

function midPoint(from: Point, to: Point): Point {
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

const ConnectionLayer = forwardRef<SVGSVGElement>((_, ref) => {
  const connections = useStore((s) => s.connections);
  const widgets = useStore((s) => s.widgets);
  const pendingConnection = useStore((s) => s.pendingConnection);
  const selectedConnectionId = useStore((s) => s.selectedConnectionId);
  const setSelectedConnection = useStore((s) => s.setSelectedConnection);

  const widgetMap = useMemo(() => new Map(widgets.map((w) => [w.id, w])), [widgets]);

  // Pending connection path rendered in world coordinates
  let pendingPath: string | null = null;
  if (pendingConnection) {
    const fromWidget = widgetMap.get(pendingConnection.fromId);
    if (fromWidget) {
      const vp = useStore.getState().viewport;
      const from = getPortWorldPos(fromWidget, pendingConnection.fromPort);
      const to = {
        x: (pendingConnection.toX - vp.x) / vp.scale,
        y: (pendingConnection.toY - vp.y) / vp.scale,
      };
      pendingPath = bezierPath(from, to, pendingConnection.fromPort);
    }
  }

  return (
    <svg ref={ref} className="connection-layer">
      <defs>
        {Object.entries(CONN_COLORS).map(([type, color]) => (
          <marker
            key={type}
            id={`arrow-${type}`}
            markerWidth="10" markerHeight="7"
            refX="9" refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill={color} />
          </marker>
        ))}
        <marker id="arrow-selected" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" />
        </marker>
        <marker id="arrow-pending" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
        </marker>
      </defs>

      {connections.map((conn) => {
        const from = widgetMap.get(conn.fromId);
        const to = widgetMap.get(conn.toId);
        if (!from || !to) return null;

        const { fromPort, toPort } = getBestPorts(from, to);
        // World coordinates — transform applied by CSS on the SVG element
        const fromPos = getPortWorldPos(from, fromPort);
        const toPos = getPortWorldPos(to, toPort);
        const path = bezierPath(fromPos, toPos, fromPort);
        const mid = midPoint(fromPos, toPos);

        const isSelected = selectedConnectionId === conn.id;
        const color = isSelected ? '#f59e0b' : (CONN_COLORS[conn.type] ?? '#6366f1');
        const markerId = isSelected ? 'arrow-selected' : `arrow-${conn.type}`;
        const isDashed = conn.type === 'depends-on';
        const isGoalParent = conn.type === 'goal-parent';
        const displayLabel = conn.label || (isGoalParent ? '하위 목표' : '');

        return (
          <g key={conn.id}>
            {/* Wide invisible hit target */}
            <path
              d={path}
              stroke="transparent"
              strokeWidth={14}
              fill="none"
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onClick={() => setSelectedConnection(isSelected ? null : conn.id)}
            />
            <path
              d={path}
              stroke={color}
              strokeWidth={isSelected ? 2.5 : isGoalParent ? 2.2 : 1.8}
              fill="none"
              strokeDasharray={isDashed ? '7 4' : undefined}
              markerEnd={`url(#${markerId})`}
              style={{ pointerEvents: 'none' }}
            />
            {displayLabel && (
              <>
                <rect
                  x={mid.x - 24}
                  y={mid.y - 18}
                  width={48}
                  height={16}
                  rx={8}
                  fill={color}
                  opacity={isSelected ? 1 : 0.85}
                  style={{ pointerEvents: 'none' }}
                />
                <text
                  x={mid.x}
                  y={mid.y - 7}
                  textAnchor="middle"
                  fill="white"
                  fontSize={10}
                  fontWeight="700"
                  fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                  style={{ pointerEvents: 'none' }}
                >
                  {displayLabel}
                </text>
              </>
            )}
          </g>
        );
      })}

      {pendingPath && (
        <path
          d={pendingPath}
          stroke="#6366f1"
          strokeWidth={2}
          fill="none"
          strokeDasharray="6 4"
          opacity={0.75}
          markerEnd="url(#arrow-pending)"
          style={{ pointerEvents: 'none' }}
        />
      )}
    </svg>
  );
});

ConnectionLayer.displayName = 'ConnectionLayer';

export default ConnectionLayer;
