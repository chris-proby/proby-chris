import { useEffect, useState } from 'react';
import Canvas from './components/Canvas';
import Toolbar from './components/Toolbar';
import WidgetSidebar from './components/WidgetSidebar';
import InspectorPanel from './components/InspectorPanel';
import HistoryPanel from './components/HistoryPanel';
import GroupChangeToast from './components/GroupChangeToast';
import InvitePanel from './components/InvitePanel';
import CollabSync from './components/CollabSync';
import { useHistoryTracker } from './hooks/useHistoryTracker';
import { useClipboardPaste } from './hooks/useClipboardPaste';
import { useTheme } from './hooks/useTheme';
import { useStore } from './store';
import type { AuthSession } from './auth';
import { RoomProvider, LiveObject, getUserColor, LIVEBLOCKS_KEY } from './liveblocks';
import { track } from './analytics';
import { roomBridge } from './viewportBridge';

interface Props {
  session: AuthSession;
  onLogout: () => void;
}

// Everything that requires authentication. This module is lazy-loaded
// from App.tsx so the AuthScreen can render without pulling in
// Liveblocks / Canvas / Inspector / etc.
export default function AuthedApp({ session, onLogout }: Props) {
  track('App_Session_Start', { collab_enabled: !!LIVEBLOCKS_KEY });

  const roomParam = new URLSearchParams(window.location.search).get('room');
  const isGuest = !!roomParam && roomParam !== session.userId;
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
        <AppInner session={session} onLogout={onLogout} collabMode roomOwnerId={targetRoomId} />
      </RoomProvider>
    );
  }

  return <AppInner session={session} onLogout={onLogout} />;
}

function AppInner({ session, onLogout, collabMode, roomOwnerId }: {
  session: AuthSession;
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
