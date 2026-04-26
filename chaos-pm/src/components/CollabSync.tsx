import { useEffect, useRef, useState } from 'react';
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

  // useStorage returns null while loading, then the value once storage is ready.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const remoteCanvas = useStorage((root) => root.canvas) as CanvasData | null | undefined;
  const applyRemoteState = useStore((s) => s.applyRemoteState);
  const updatePresence = useUpdateMyPresence();

  const isApplyingRemote = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didInitialPush = useRef(false);

  // lbReady: true once Liveblocks storage has loaded (remoteCanvas != null).
  // All updateCanvas calls are gated on this to prevent "storage not loaded" errors.
  const lbReady = useRef(false);
  useEffect(() => {
    if (remoteCanvas != null) lbReady.current = true;
  }, [remoteCanvas]);

  // IDB hydration readiness
  const [idbReady, setIdbReady] = useState(() => useStore.persist.hasHydrated());
  useEffect(() => {
    if (idbReady) return;
    const unsub = useStore.persist.onFinishHydration(() => setIdbReady(true));
    return unsub;
  }, [idbReady]);

  // For owner: block applying remote state until after initial push
  const [readyToApplyRemote, setReadyToApplyRemote] = useState(!isOwner);

  // Presence setup
  useEffect(() => {
    updatePresence({ name: userName, color: userColor, cursor: null });
  }, [userName, userColor, updatePresence]);

  useEffect(() => {
    collabBridge.onCursorMove = (x, y) => updatePresence({ cursor: { x, y } });
    return () => { collabBridge.onCursorMove = null; };
  }, [updatePresence]);

  // Owner: push IDB state to Liveblocks once BOTH IDB and Liveblocks storage are ready.
  // remoteCanvas != null means Liveblocks storage has loaded and mutation is safe to call.
  useEffect(() => {
    if (!isOwner || !idbReady || remoteCanvas == null || didInitialPush.current) return;
    didInitialPush.current = true;
    const { widgets, connections, maxZIndex } = useStore.getState();
    updateCanvas({ widgets, connections, maxZIndex });
    setReadyToApplyRemote(true);
  }, [isOwner, idbReady, remoteCanvas, updateCanvas]);

  // Local Zustand changes → debounced push to Liveblocks.
  // Gated on lbReady ref to avoid calling mutation before storage loads.
  useEffect(() => {
    const unsub = useStore.subscribe((state, prevState) => {
      if (!lbReady.current) return;
      if (isApplyingRemote.current) return;
      if (state.widgets === prevState.widgets && state.connections === prevState.connections) return;
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        syncTimer.current = null;
        if (!lbReady.current) return; // double-check in case of race
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

  // Remote canvas → apply to local Zustand.
  // Owner: only after initial push. Guest: immediately.
  useEffect(() => {
    if (!remoteCanvas || !readyToApplyRemote) return;

    const w = [...(remoteCanvas.widgets ?? [])] as unknown as Widget[];
    const c = [...(remoteCanvas.connections ?? [])] as unknown as Connection[];
    const mz = remoteCanvas.maxZIndex ?? 0;

    const local = useStore.getState();
    const localMaxTs = local.widgets.reduce((m, x) => Math.max(m, x.updatedAt ?? 0), 0);
    const remoteMaxTs = w.reduce((m, x) => Math.max(m, x.updatedAt ?? 0), 0);

    if (remoteMaxTs <= localMaxTs && w.length === local.widgets.length && c.length === local.connections.length) return;

    if (syncTimer.current) { clearTimeout(syncTimer.current); syncTimer.current = null; }
    isApplyingRemote.current = true;
    applyRemoteState(w, c, mz);
    queueMicrotask(() => { isApplyingRemote.current = false; });
  }, [remoteCanvas, applyRemoteState, readyToApplyRemote]);

  return null;
}
