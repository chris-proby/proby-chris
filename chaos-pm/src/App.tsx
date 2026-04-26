import { useEffect, useState } from 'react';
import Canvas from './components/Canvas';
import Toolbar from './components/Toolbar';
import WidgetSidebar from './components/WidgetSidebar';
import InspectorPanel from './components/InspectorPanel';
import HistoryPanel from './components/HistoryPanel';
import GroupChangeToast from './components/GroupChangeToast';
import AuthScreen from './components/AuthScreen';
import InvitePanel from './components/InvitePanel';
import CollabSync from './components/CollabSync';
import CollabCursors from './components/CollabCursors';
import { useHistoryTracker } from './hooks/useHistoryTracker';
import { useClipboardPaste } from './hooks/useClipboardPaste';
import { useTheme } from './hooks/useTheme';
import { useStore } from './store';
import { getCurrentSession, hydrateSession, onAuthChange, logout, type AuthSession } from './auth';
import { RoomProvider, LiveObject, getUserColor, LIVEBLOCKS_KEY } from './liveblocks';
import { analyticsIdentify, analyticsReset, track } from './analytics';
import { SUPABASE_CONFIGURED } from './supabase';
import { roomBridge } from './viewportBridge';

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authReady, setAuthReady] = useState(!SUPABASE_CONFIGURED);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      setSession(getCurrentSession());
      setAuthReady(true);
      return;
    }
    let mounted = true;
    hydrateSession().then((s) => {
      if (!mounted) return;
      setSession(s);
      setAuthReady(true);
    });
    const unsub = onAuthChange((s) => { if (mounted) setSession(s); });
    return () => { mounted = false; unsub(); };
  }, []);

  const handleAuth = () => { /* state updates via onAuthChange */ };
  const handleLogout = async () => {
    track('Toolbar_Logout_Click');
    analyticsReset();
    await logout();
    window.location.reload();
  };

  if (!authReady) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted, #94a3b8)' }}>
        loading...
      </div>
    );
  }

  if (!session) return <AuthScreen onAuth={handleAuth} />;

  // Identify user on every session load
  analyticsIdentify(session.email, { name: session.name });
  track('App_Session_Start', { collab_enabled: !!LIVEBLOCKS_KEY });

  // When Liveblocks key is configured, the owner is ALWAYS connected to their own room
  // so guests can join at any time and get the latest canvas state.
  const roomParam = new URLSearchParams(window.location.search).get('room');
  const isGuest = !!roomParam && roomParam !== session.userId;
  // Owner uses their own userId as room; guest joins the owner's room.
  const targetRoomId = isGuest ? roomParam! : session.userId;
  roomBridge.current = `chaospm-${targetRoomId}`;

  if (LIVEBLOCKS_KEY) {
    const initState = useStore.getState();
    return (
      <RoomProvider
        id={`chaospm-${targetRoomId}`}
        initialPresence={{ cursor: null, name: session.name, color: getUserColor(session.userId) }}
        initialStorage={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          canvas: new LiveObject({
            widgets: !isGuest ? initState.widgets : [],
            connections: !isGuest ? initState.connections : [],
            maxZIndex: !isGuest ? initState.maxZIndex : 0,
          } as any),
        }}
      >
        <CollabSync
          isOwner={!isGuest}
          userName={session.name}
          userColor={getUserColor(session.userId)}
          roomId={`chaospm-${targetRoomId}`}
        />
        <AppInner session={session} onLogout={handleLogout} collabMode roomOwnerId={targetRoomId} />
      </RoomProvider>
    );
  }

  return <AppInner session={session} onLogout={handleLogout} />;
}

function AppInner({ session, onLogout, collabMode, roomOwnerId }: {
  session: NonNullable<ReturnType<typeof getCurrentSession>>;
  onLogout: () => void;
  collabMode?: boolean;
  roomOwnerId?: string;
}) {
  const selectedWidgetId = useStore((s) => s.selectedWidgetId);
  const selectedConnectionId = useStore((s) => s.selectedConnectionId);
  const deleteSelected = useStore((s) => s.deleteSelected);
  const clearSelection = useStore((s) => s.clearSelection);
  const groupSelected = useStore((s) => s.groupSelected);
  const multiSelectedIds = useStore((s) => s.multiSelectedIds);
  const undo = useStore((s) => s.undo);
  const [showHistory, setShowHistory] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  useHistoryTracker();
  useClipboardPaste();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      if (e.key === 'Escape') { clearSelection(); setShowHistory(false); setShowInvite(false); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault();
        if (multiSelectedIds.length >= 2) groupSelected();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [deleteSelected, clearSelection, groupSelected, multiSelectedIds, undo]);

  const hasSelection = selectedWidgetId || selectedConnectionId;
  const showRight = showHistory || showInvite || (!showHistory && !showInvite && hasSelection);

  return (
    <div className="app">
      <Toolbar
        onToggleHistory={() => { setShowHistory((v) => !v); setShowInvite(false); }}
        showHistory={showHistory}
        theme={theme}
        onToggleTheme={toggleTheme}
        session={session}
        onLogout={onLogout}
        onToggleInvite={() => { setShowInvite((v) => !v); setShowHistory(false); }}
        showInvite={showInvite}
        collabMode={collabMode}
      />
      <div className="workspace">
        <WidgetSidebar />
        <Canvas collabMode={collabMode} />
        {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} />}
        {showInvite && <InvitePanel session={session} onClose={() => setShowInvite(false)} collabMode={collabMode} roomOwnerId={roomOwnerId} />}
        {!showHistory && !showInvite && hasSelection && <InspectorPanel />}
      </div>
      <GroupChangeToast />
      {!showRight && null}
    </div>
  );
}
