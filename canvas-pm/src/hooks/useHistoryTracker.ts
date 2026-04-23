import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import type { Widget, Connection } from '../types';

const DEBOUNCE_MS = 1500;

function describeChange(prev: { widgets: Widget[]; connections: Connection[] }, next: { widgets: Widget[]; connections: Connection[] }): string | null {
  const wDiff = next.widgets.length - prev.widgets.length;
  const cDiff = next.connections.length - prev.connections.length;

  if (wDiff > 0) {
    const added = next.widgets.find((w) => !prev.widgets.some((p) => p.id === w.id));
    const typeLabel: Record<string, string> = { task: '작업', note: '메모', link: '링크', image: '이미지', group: '그룹', goal: '목표' };
    return `${typeLabel[added?.type ?? ''] ?? '위젯'} 추가`;
  }
  if (wDiff < 0) return '위젯 삭제';
  if (cDiff > 0) return '연결 추가';
  if (cDiff < 0) return '연결 삭제';

  // Check for structural changes (group membership, type)
  const groupChanged = next.widgets.some((w) => {
    const prev_ = prev.widgets.find((p) => p.id === w.id);
    return prev_ && prev_.groupId !== w.groupId;
  });
  if (groupChanged) return '그룹 변경';

  // Data changes
  const dataChanged = next.widgets.some((w) => {
    const prev_ = prev.widgets.find((p) => p.id === w.id);
    return prev_ && prev_.updatedAt !== w.updatedAt;
  });
  if (dataChanged) {
    const changed = next.widgets.find((w) => {
      const prev_ = prev.widgets.find((p) => p.id === w.id);
      return prev_ && prev_.updatedAt !== w.updatedAt;
    });
    const typeLabel: Record<string, string> = { task: '작업', note: '메모', link: '링크', image: '이미지', group: '그룹', goal: '목표' };
    return `${typeLabel[changed?.type ?? ''] ?? '위젯'} 수정`;
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
