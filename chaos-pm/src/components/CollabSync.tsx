import { useEffect, useRef, useState } from 'react';
import { useStorage, useMutation, useUpdateMyPresence, type CanvasData } from '../liveblocks';
import { useStore } from '../store';
import { collabBridge } from '../viewportBridge';
import type { Widget, Connection } from '../types';
import { pushSnapshot } from '../snapshotBackup';
import { SUPABASE_CONFIGURED } from '../supabase';

interface Props {
  isOwner: boolean;
  userName: string;
  userColor: string;
  roomId: string;
}

const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;     // backup every 5 minutes
const SNAPSHOT_DEBOUNCE_MS = 15 * 1000;          // also backup 15s after last change

export default function CollabSync({ isOwner, userName, userColor, roomId }: Props) {
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

  // ── Server snapshot backup ─────────────────────────────────────────
  // Periodically POST canvas state to /api/canvas/snapshot so we can
  // recover if Liveblocks data is ever lost. Owner only — guests don't
  // own the canvas. Skipped entirely when Supabase isn't configured.
  useEffect(() => {
    if (!SUPABASE_CONFIGURED || !isOwner || !idbReady) return;

    let lastPushed = 0;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let intervalTimer: ReturnType<typeof setInterval> | null = null;

    const doPush = async () => {
      const { widgets, connections, maxZIndex } = useStore.getState();
      if (widgets.length === 0 && connections.length === 0) return;
      const ok = await pushSnapshot(roomId, { widgets, connections, maxZIndex });
      if (ok) lastPushed = Date.now();
    };

    // Debounced push on store changes (15s after last edit)
    const unsub = useStore.subscribe((state, prev) => {
      if (state.widgets === prev.widgets && state.connections === prev.connections) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { void doPush(); }, SNAPSHOT_DEBOUNCE_MS);
    });

    // Heartbeat every 5 min as a safety net
    intervalTimer = setInterval(() => {
      if (Date.now() - lastPushed > SNAPSHOT_INTERVAL_MS) void doPush();
    }, SNAPSHOT_INTERVAL_MS);

    // Final push on tab close
    const onHide = () => {
      if (document.visibilityState === 'hidden') void doPush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', () => { void doPush(); });

    return () => {
      unsub();
      if (debounceTimer) clearTimeout(debounceTimer);
      if (intervalTimer) clearInterval(intervalTimer);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [isOwner, idbReady, roomId]);

  return null;
}
