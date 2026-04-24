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
import { getCurrentSession, logout } from './auth';
import { RoomProvider, LiveObject, getUserColor, LIVEBLOCKS_KEY } from './liveblocks';

export default function App() {
  const [session] = useState(() => getCurrentSession());

  const handleAuth = () => { window.location.reload(); };
  const handleLogout = () => { logout(); window.location.reload(); };

  if (!session) return <AuthScreen onAuth={handleAuth} />;

  // When Liveblocks key is configured, the owner is ALWAYS connected to their own room
  // so guests can join at any time and get the latest canvas state.
  const roomParam = new URLSearchParams(window.location.search).get('room');
  const isGuest = !!roomParam && roomParam !== session.userId;
  // Owner uses their own userId as room; guest joins the owner's room.
  const targetRoomId = isGuest ? roomParam! : session.userId;

  if (LIVEBLOCKS_KEY) {
    const initState = useStore.getState();
    return (
      <RoomProvider
        id={`messynotion-${targetRoomId}`}
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
  const [showHistory, setShowHistory] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  useHistoryTracker();
  useClipboardPaste();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      if (e.key === 'Escape') { clearSelection(); setShowHistory(false); setShowInvite(false); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault();
        if (multiSelectedIds.length >= 2) groupSelected();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [deleteSelected, clearSelection, groupSelected, multiSelectedIds]);

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
