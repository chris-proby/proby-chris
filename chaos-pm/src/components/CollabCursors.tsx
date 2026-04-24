import { useOthers } from '../liveblocks';
import { vpBridge } from '../viewportBridge';

export default function CollabCursors() {
  const others = useOthers();

  return (
    <>
      {others.map((other) => {
        const cursor = other.presence?.cursor;
        if (!cursor) return null;
        const { x: vx, y: vy, scale } = vpBridge;
        const sx = cursor.x * scale + vx;
        const sy = cursor.y * scale + vy;
        const color = other.presence?.color ?? '#6366f1';
        const name = other.presence?.name ?? '사용자';
        return (
          <div
            key={other.connectionId}
            className="collab-cursor"
            style={{ left: sx, top: sy }}
          >
            <svg width="14" height="20" viewBox="0 0 14 20" style={{ display: 'block' }}>
              <path d="M0 0L10 12H5.5L3.5 20L0 0Z" fill={color} stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span className="collab-cursor-name" style={{ background: color }}>{name}</span>
          </div>
        );
      })}
    </>
  );
}
