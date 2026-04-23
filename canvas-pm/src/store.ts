import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';
import type {
  Widget, Connection, Viewport, PendingConnection, PendingGroupChange, Snapshot,
  WidgetType, ConnectionType, TaskData, NoteData, LinkData, ImageData, GroupData, GoalData, LeadData, FunnelData, TextboxData, HtmlData,
} from './types';

function defaultData(type: WidgetType): TaskData | NoteData | LinkData | ImageData | GroupData | GoalData | LeadData | FunnelData | TextboxData | HtmlData {
  switch (type) {
    case 'task': return {
      title: '새 작업', description: '', status: 'todo',
      priority: 'medium', dueDate: '', tags: [], attachments: [],
    };
    case 'note': return { content: '메모를 입력하세요...', color: '#fef9c3' };
    case 'link': return { url: '', title: '새 링크', description: '' };
    case 'image': return { src: '', caption: '', name: '' };
    case 'group': return { title: '새 그룹', collapsed: false, color: '#6366f1', expandedWidth: 400, expandedHeight: 300 };
    case 'goal': return { title: '새 목표', description: '', status: 'on-track', progress: 0, targetDate: '', keyResults: [] };
    case 'lead':   return { name: '새 리드', company: '', value: 0, currency: 'KRW', stage: 'prospect', probability: 10, contactEmail: '', contactPhone: '', notes: '', nextAction: '', nextActionDate: '', tags: [], source: '' };
    case 'funnel': return { title: '세일즈 퍼널' };
    case 'textbox': return { content: '텍스트를 입력하세요', fontSize: 16, align: 'left', bold: false, italic: false, color: '#1e293b' };
    case 'html': return { html: '', name: '' };
  }
}

function defaultSize(type: WidgetType): { width: number; height: number } {
  switch (type) {
    case 'task':  return { width: 280, height: 180 };
    case 'note':  return { width: 220, height: 160 };
    case 'link':  return { width: 280, height: 110 };
    case 'image': return { width: 280, height: 220 };
    case 'group': return { width: 400, height: 300 };
    case 'goal':  return { width: 300, height: 190 };
    case 'lead':   return { width: 320, height: 210 };
    case 'funnel': return { width: 340, height: 320 };
    case 'textbox': return { width: 280, height: 80 };
    case 'html': return { width: 360, height: 280 };
  }
}

interface Store {
  widgets: Widget[];
  connections: Connection[];
  viewport: Viewport;
  selectedWidgetId: string | null;
  selectedConnectionId: string | null;
  multiSelectedIds: string[];
  pendingConnection: PendingConnection | null;
  maxZIndex: number;

  setViewport: (v: Viewport) => void;
  addWidget: (type: WidgetType, x: number, y: number) => string;
  updateWidget: (id: string, changes: Partial<Widget>) => void;
  updateWidgetData: (id: string, data: Record<string, unknown>) => void;
  deleteWidget: (id: string) => void;
  bringToFront: (id: string) => void;
  addConnection: (fromId: string, toId: string, type?: ConnectionType) => void;
  updateConnection: (id: string, changes: Partial<Connection>) => void;
  deleteConnection: (id: string) => void;
  deleteSelected: () => void;
  setSelectedWidget: (id: string | null) => void;
  setSelectedConnection: (id: string | null) => void;
  setMultiSelected: (ids: string[]) => void;
  addToMultiSelect: (id: string) => void;
  clearSelection: () => void;
  setPendingConnection: (p: PendingConnection | null) => void;
  setWidgetGroup: (widgetId: string, groupId: string | undefined) => void;
  stageGroupChange: (change: PendingGroupChange) => void;
  confirmGroupChange: () => void;
  revertGroupChange: () => void;
  pendingGroupChange: PendingGroupChange | null;
  dropTargetGroupId: string | null;
  setDropTargetGroupId: (id: string | null) => void;
  groupSelected: () => void;
  ungroupWidget: (groupId: string) => void;
  toggleGroupCollapse: (groupId: string) => void;
  fitToView: () => void;

  snapshots: Snapshot[];
  saveSnapshot: (label: string) => void;
  restoreSnapshot: (id: string) => void;
  deleteSnapshot: (id: string) => void;
  clearSnapshots: () => void;
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      widgets: [],
      connections: [],
      viewport: { x: 0, y: 0, scale: 1 },
      selectedWidgetId: null,
      selectedConnectionId: null,
      multiSelectedIds: [],
      pendingConnection: null,
      pendingGroupChange: null,
      dropTargetGroupId: null,
      maxZIndex: 0,
      snapshots: [],

      setViewport: (v) => set({ viewport: v }),

      addWidget: (type, x, y) => {
        const id = uuid();
        const newZ = get().maxZIndex + 1;
        const widget: Widget = {
          id, type, x, y,
          ...defaultSize(type),
          data: defaultData(type),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          zIndex: newZ,
        };
        set((s) => ({ widgets: [...s.widgets, widget], maxZIndex: newZ }));
        return id;
      },

      updateWidget: (id, changes) => set((s) => ({
        widgets: s.widgets.map((w) =>
          w.id === id ? { ...w, ...changes, updatedAt: Date.now() } : w
        ),
      })),

      updateWidgetData: (id, dataChanges) => set((s) => ({
        widgets: s.widgets.map((w) =>
          w.id === id
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? { ...w, data: { ...(w.data as any), ...dataChanges } as Widget['data'], updatedAt: Date.now() }
            : w
        ),
      })),

      deleteWidget: (id) => {
        const { widgets } = get();
        const w = widgets.find((x) => x.id === id);
        set((s) => {
          let updated = s.widgets.filter((x) => x.id !== id);
          // If deleting a group, also release its children
          if (w?.type === 'group') {
            updated = updated.map((x) => x.groupId === id ? { ...x, groupId: undefined } : x);
          }
          return {
            widgets: updated,
            connections: s.connections.filter((c) => c.fromId !== id && c.toId !== id),
            selectedWidgetId: s.selectedWidgetId === id ? null : s.selectedWidgetId,
            multiSelectedIds: s.multiSelectedIds.filter((x) => x !== id),
          };
        });
      },

      bringToFront: (id) => {
        const newZ = get().maxZIndex + 1;
        set((s) => ({
          widgets: s.widgets.map((w) => w.id === id ? { ...w, zIndex: newZ } : w),
          maxZIndex: newZ,
        }));
      },

      addConnection: (fromId, toId, type = 'relates-to') => {
        if (fromId === toId) return;
        if (get().connections.some((c) => c.fromId === fromId && c.toId === toId)) return;
        set((s) => ({
          connections: [...s.connections, {
            id: uuid(), fromId, toId, label: '', type,
          }],
        }));
      },

      updateConnection: (id, changes) => set((s) => ({
        connections: s.connections.map((c) => c.id === id ? { ...c, ...changes } : c),
      })),

      deleteConnection: (id) => set((s) => ({
        connections: s.connections.filter((c) => c.id !== id),
        selectedConnectionId: s.selectedConnectionId === id ? null : s.selectedConnectionId,
      })),

      deleteSelected: () => {
        const { selectedWidgetId, selectedConnectionId, multiSelectedIds } = get();
        if (multiSelectedIds.length > 1) {
          multiSelectedIds.forEach((id) => get().deleteWidget(id));
        } else if (selectedWidgetId) {
          get().deleteWidget(selectedWidgetId);
        }
        if (selectedConnectionId) get().deleteConnection(selectedConnectionId);
      },

      setSelectedWidget: (id) => set({
        selectedWidgetId: id,
        selectedConnectionId: null,
        multiSelectedIds: id ? [id] : [],
      }),

      setSelectedConnection: (id) => set({ selectedConnectionId: id, selectedWidgetId: null, multiSelectedIds: [] }),

      setMultiSelected: (ids) => set({
        multiSelectedIds: ids,
        selectedWidgetId: ids[ids.length - 1] ?? null,
        selectedConnectionId: null,
      }),

      addToMultiSelect: (id) => {
        const { multiSelectedIds } = get();
        const next = multiSelectedIds.includes(id)
          ? multiSelectedIds.filter((x) => x !== id)
          : [...multiSelectedIds, id];
        set({ multiSelectedIds: next, selectedWidgetId: id, selectedConnectionId: null });
      },

      clearSelection: () => set({ selectedWidgetId: null, selectedConnectionId: null, multiSelectedIds: [] }),

      setPendingConnection: (p) => set({ pendingConnection: p }),

      setWidgetGroup: (widgetId, groupId) => set((s) => ({
        widgets: s.widgets.map((w) => w.id === widgetId ? { ...w, groupId } : w),
      })),

      stageGroupChange: (change) => set((s) => ({
        widgets: s.widgets.map((w) => w.id === change.widgetId ? { ...w, groupId: change.newGroupId } : w),
        pendingGroupChange: change,
      })),

      confirmGroupChange: () => set({ pendingGroupChange: null }),

      revertGroupChange: () => {
        const { pendingGroupChange: c } = get();
        if (!c) return;
        set((s) => ({
          widgets: s.widgets.map((w) =>
            w.id === c.widgetId ? { ...w, groupId: c.prevGroupId, x: c.prevX, y: c.prevY } : w
          ),
          pendingGroupChange: null,
        }));
      },

      setDropTargetGroupId: (id) => set({ dropTargetGroupId: id }),

      groupSelected: () => {
        const { multiSelectedIds, widgets } = get();
        const selected = widgets.filter((w) => multiSelectedIds.includes(w.id));
        if (selected.length < 2) return;

        const PAD = 28;
        const TITLE_H = 44;
        const minX = Math.min(...selected.map((w) => w.x)) - PAD;
        const minY = Math.min(...selected.map((w) => w.y)) - TITLE_H;
        const maxX = Math.max(...selected.map((w) => w.x + w.width)) + PAD;
        const maxY = Math.max(...selected.map((w) => w.y + w.height)) + PAD;
        const w = maxX - minX;
        const h = maxY - minY;

        const groupId = uuid();
        const minZ = Math.min(...selected.map((x) => x.zIndex));

        const groupWidget: Widget = {
          id: groupId,
          type: 'group',
          x: minX,
          y: minY,
          width: w,
          height: h,
          data: { title: '새 그룹', collapsed: false, color: '#6366f1', expandedWidth: w, expandedHeight: h },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          zIndex: Math.max(0, minZ - 1),
        };

        set((s) => ({
          widgets: [
            groupWidget,
            ...s.widgets.map((x) =>
              multiSelectedIds.includes(x.id)
                ? { ...x, groupId }
                : x
            ),
          ],
          selectedWidgetId: groupId,
          multiSelectedIds: [groupId],
        }));
      },

      ungroupWidget: (groupId) => {
        set((s) => ({
          widgets: s.widgets
            .filter((w) => w.id !== groupId)
            .map((w) => w.groupId === groupId ? { ...w, groupId: undefined } : w),
          selectedWidgetId: null,
          multiSelectedIds: [],
        }));
      },

      toggleGroupCollapse: (groupId) => {
        const { widgets } = get();
        const group = widgets.find((w) => w.id === groupId);
        if (!group || group.type !== 'group') return;
        const data = group.data as GroupData;
        const willCollapse = !data.collapsed;

        set((s) => ({
          widgets: s.widgets.map((w) => {
            if (w.id !== groupId) return w;
            if (willCollapse) {
              return {
                ...w,
                width: 220,
                height: 52,
                data: { ...data, collapsed: true, expandedWidth: w.width, expandedHeight: w.height },
              };
            }
            return {
              ...w,
              width: data.expandedWidth,
              height: data.expandedHeight,
              data: { ...data, collapsed: false },
            };
          }),
        }));
      },

      fitToView: () => {
        const { widgets } = get();
        if (widgets.length === 0) { set({ viewport: { x: 100, y: 100, scale: 1 } }); return; }
        const pad = 100;
        const vw = window.innerWidth - 320;
        const vh = window.innerHeight - 52;
        const minX = Math.min(...widgets.map((w) => w.x)) - pad;
        const minY = Math.min(...widgets.map((w) => w.y)) - pad;
        const maxX = Math.max(...widgets.map((w) => w.x + w.width)) + pad;
        const maxY = Math.max(...widgets.map((w) => w.y + w.height)) + pad;
        const scale = Math.min(vw / (maxX - minX), vh / (maxY - minY), 1.5);
        const x = (vw - (maxX - minX) * scale) / 2 - minX * scale;
        const y = (vh - (maxY - minY) * scale) / 2 - minY * scale;
        set({ viewport: { x, y, scale } });
      },

      saveSnapshot: (label) => {
        const { widgets, connections, snapshots } = get();
        const snapshot: Snapshot = {
          id: uuid(),
          timestamp: Date.now(),
          label,
          widgets: JSON.parse(JSON.stringify(widgets)),
          connections: JSON.parse(JSON.stringify(connections)),
        };
        const MAX = 40;
        const next = [snapshot, ...snapshots].slice(0, MAX);
        set({ snapshots: next });
      },

      restoreSnapshot: (id) => {
        const { snapshots } = get();
        const snap = snapshots.find((s) => s.id === id);
        if (!snap) return;
        set({
          widgets: JSON.parse(JSON.stringify(snap.widgets)),
          connections: JSON.parse(JSON.stringify(snap.connections)),
          selectedWidgetId: null,
          selectedConnectionId: null,
          multiSelectedIds: [],
        });
      },

      deleteSnapshot: (id) => set((s) => ({
        snapshots: s.snapshots.filter((x) => x.id !== id),
      })),

      clearSnapshots: () => set({ snapshots: [] }),
    }),
    {
      name: 'canvas-pm-v2',
      partialize: (s) => ({
        widgets: s.widgets,
        connections: s.connections,
        viewport: s.viewport,
        maxZIndex: s.maxZIndex,
        snapshots: s.snapshots,
      }),
    }
  )
);
