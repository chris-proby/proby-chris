import { useEffect, useRef } from 'react';
import { useStorage, useMutation, useUpdateMyPresence, type CanvasData } from '../liveblocks';
import { useStore } from '../store';
import { collabBridge } from '../viewportBridge';
import type { Widget, Connection } from '../types';

interface Props {
  isOwner: boolean;
  userName: string;
  userColor: string;
}

export default function CollabSync({ isOwner, userName, userColor }: Props) {
  const updateCanvas = useMutation(
    ({ storage }, data: { widgets: Widget[]; connections: Connection[]; maxZIndex: number }) => {
      storage.get('canvas')?.update(data);
    },
    []
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const remoteCanvas = useStorage((root) => root.canvas) as CanvasData | null | undefined;
  const applyRemoteState = useStore((s) => s.applyRemoteState);
  const updatePresence = useUpdateMyPresence();

  const isApplyingRemote = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Set presence name + color on mount
  useEffect(() => {
    updatePresence({ name: userName, color: userColor, cursor: null });
  }, [userName, userColor, updatePresence]);

  // Wire cursor tracking
  useEffect(() => {
    collabBridge.onCursorMove = (x, y) => updatePresence({ cursor: { x, y } });
    return () => { collabBridge.onCursorMove = null; };
  }, [updatePresence]);

  // Owner: push current local state to the room on first connect
  const didInitialPush = useRef(false);
  useEffect(() => {
    if (!isOwner || didInitialPush.current) return;
    didInitialPush.current = true;
    const t = setTimeout(() => {
      const { widgets, connections, maxZIndex } = useStore.getState();
      updateCanvas({ widgets, connections, maxZIndex });
    }, 500);
    return () => clearTimeout(t);
  }, [isOwner, updateCanvas]);

  // Subscribe to local Zustand changes → debounced push to Liveblocks
  useEffect(() => {
    const unsub = useStore.subscribe((state, prevState) => {
      if (isApplyingRemote.current) return;
      if (state.widgets === prevState.widgets && state.connections === prevState.connections) return;
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        syncTimer.current = null;
        updateCanvas({
          widgets: state.widgets,
          connections: state.connections,
          maxZIndex: state.maxZIndex,
        });
      }, 300);
    });
    return () => {
      unsub();
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, [updateCanvas]);

  // When remote canvas changes → apply to local Zustand (skip self-echo)
  useEffect(() => {
    if (!remoteCanvas) return;

    const w = [...(remoteCanvas.widgets ?? [])] as unknown as Widget[];
    const c = [...(remoteCanvas.connections ?? [])] as unknown as Connection[];
    const mz = remoteCanvas.maxZIndex ?? 0;

    // Skip if this looks like our own update echoed back:
    // remote maxTs ≤ local maxTs AND same counts → no real new info
    const local = useStore.getState();
    const localMaxTs = local.widgets.reduce((m, x) => Math.max(m, x.updatedAt ?? 0), 0);
    const remoteMaxTs = w.reduce((m, x) => Math.max(m, x.updatedAt ?? 0), 0);
    if (
      remoteMaxTs <= localMaxTs &&
      w.length === local.widgets.length &&
      c.length === local.connections.length
    ) return;

    // Cancel pending local sync to avoid overwriting the remote state we're about to apply
    if (syncTimer.current) { clearTimeout(syncTimer.current); syncTimer.current = null; }

    isApplyingRemote.current = true;
    applyRemoteState(w, c, mz);
    queueMicrotask(() => { isApplyingRemote.current = false; });
  }, [remoteCanvas, applyRemoteState]);

  return null;
}
