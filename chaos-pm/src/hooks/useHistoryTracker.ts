import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import type { Widget, Connection } from '../types';

const DEBOUNCE_MS = 4000;

function describeChange(prev: { widgets: Widget[]; connections: Connection[] }, next: { widgets: Widget[]; connections: Connection[] }): string | null {
  const wDiff = next.widgets.length - prev.widgets.length;
  const cDiff = next.connections.length - prev.connections.length;

  if (wDiff > 0) {
    const prevIds = new Set(prev.widgets.map((w) => w.id));
    const added = next.widgets.find((w) => !prevIds.has(w.id));
    const typeLabel: Record<string, string> = { task: '작업', note: '메모', link: '링크', image: '이미지', group: '그룹', goal: '목표' };
    return `${typeLabel[added?.type ?? ''] ?? '위젯'} 추가`;
  }
  if (wDiff < 0) return '위젯 삭제';
  if (cDiff > 0) return '연결 추가';
  if (cDiff < 0) return '연결 삭제';

  // O(n) lookup via map — was O(n²) with nested find/some
  const prevMap = new Map(prev.widgets.map((w) => [w.id, w]));

  const groupChanged = next.widgets.some((w) => {
    const p = prevMap.get(w.id);
    return p && p.groupId !== w.groupId;
  });
  if (groupChanged) return '그룹 변경';

  let changedWidget: Widget | undefined;
  const dataChanged = next.widgets.some((w) => {
    const p = prevMap.get(w.id);
    if (p && p.updatedAt !== w.updatedAt) { changedWidget = w; return true; }
    return false;
  });
  if (dataChanged) {
    const typeLabel: Record<string, string> = { task: '작업', note: '메모', link: '링크', image: '이미지', group: '그룹', goal: '목표' };
    return `${typeLabel[changedWidget?.type ?? ''] ?? '위젯'} 수정`;
  }

  return null;
}

export function useHistoryTracker() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevRef = useRef<{ widgets: Widget[]; connections: Connection[] } | null>(null);
  const isRestoringRef = useRef(false);

  useEffect(() => {
    const unsub = useStore.subscribe((state) => {
      if (isRestoringRef.current) return;

      const current = { widgets: state.widgets, connections: state.connections };

      if (!prevRef.current) {
        prevRef.current = current;
        return;
      }

      const prev = prevRef.current;
      // Quick reference equality check — only proceed if something changed
      if (prev.widgets === current.widgets && prev.connections === current.connections) return;

      const label = describeChange(prev, current);
      if (!label) {
        prevRef.current = current;
        return;
      }

      if (timerRef.current) clearTimeout(timerRef.current);

      const capturedPrev = prev;
      timerRef.current = setTimeout(() => {
        // Only save if we're not in the middle of a restore
        if (isRestoringRef.current) return;

        // Re-check: snapshot the state from *before* this batch of changes
        useStore.getState().saveSnapshot(label);
        prevRef.current = useStore.getState();
      }, DEBOUNCE_MS);

      prevRef.current = current;
      void capturedPrev;
    });

    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
