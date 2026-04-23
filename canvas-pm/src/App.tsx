import { useEffect, useState } from 'react';
import Canvas from './components/Canvas';
import Toolbar from './components/Toolbar';
import WidgetSidebar from './components/WidgetSidebar';
import InspectorPanel from './components/InspectorPanel';
import HistoryPanel from './components/HistoryPanel';
import GroupChangeToast from './components/GroupChangeToast';
import { useHistoryTracker } from './hooks/useHistoryTracker';
import { useClipboardPaste } from './hooks/useClipboardPaste';
import { useTheme } from './hooks/useTheme';
import { useStore } from './store';

export default function App() {
  const selectedWidgetId = useStore((s) => s.selectedWidgetId);
  const selectedConnectionId = useStore((s) => s.selectedConnectionId);
  const deleteSelected = useStore((s) => s.deleteSelected);
  const clearSelection = useStore((s) => s.clearSelection);
  const groupSelected = useStore((s) => s.groupSelected);
  const multiSelectedIds = useStore((s) => s.multiSelectedIds);
  const [showHistory, setShowHistory] = useState(false);

  useHistoryTracker();
  useClipboardPaste();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      if (e.key === 'Escape') { clearSelection(); setShowHistory(false); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault();
        if (multiSelectedIds.length >= 2) groupSelected();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [deleteSelected, clearSelection, groupSelected, multiSelectedIds]);

  const hasSelection = selectedWidgetId || selectedConnectionId;

  return (
    <div className="app">
      <Toolbar onToggleHistory={() => setShowHistory((v) => !v)} showHistory={showHistory} theme={theme} onToggleTheme={toggleTheme} />
      <div className="workspace">
        <WidgetSidebar />
        <Canvas />
        {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} />}
        {!showHistory && hasSelection && <InspectorPanel />}
      </div>
      <GroupChangeToast />
    </div>
  );
}
