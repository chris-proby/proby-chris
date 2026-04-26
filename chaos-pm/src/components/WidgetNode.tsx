import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useStore, defaultSize } from '../store';
import { track } from '../analytics';
import { saveFile, loadFile } from '../fileStorage';
import { uploadFileToCloud } from '../cloudFiles';
import { SUPABASE_CONFIGURED } from '../supabase';
import { roomBridge } from '../viewportBridge';
import { vpBridge, keyBridge } from '../viewportBridge';
import { getCurrentSession } from '../auth';
import { v4 as uuidv4 } from 'uuid';
import type { Widget, PortSide, TaskData, NoteData, LinkData, ImageData, GroupData, GoalData, GoalStatus, LeadData, LeadStage, FunnelData, TextboxData, HtmlData, FileUploadData, FileItem, DirectoryData, DirectoryColumn, WorklogData, FinanceData, InvoiceEntry, InvoiceStatus, CalendarData, CalendarEvent, EmbedData } from '../types';

const GOAL_GRADIENTS: Record<GoalStatus, string> = {
  'on-track': 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
  'at-risk':  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  'achieved': 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
  'paused':   'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
};
const GOAL_COLORS: Record<GoalStatus, string> = {
  'on-track': '#22c55e',
  'at-risk':  '#f59e0b',
  'achieved': '#6366f1',
  'paused':   '#94a3b8',
};
const GOAL_STATUS_KO: Record<GoalStatus, string> = {
  'on-track': '순조로움',
  'at-risk':  '위험',
  'achieved': '달성',
  'paused':   '중단',
};

function buildChildrenMap(allWidgets: Widget[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const w of allWidgets) {
    if (!w.groupId) continue;
    const list = map.get(w.groupId);
    if (list) list.push(w.id);
    else map.set(w.groupId, [w.id]);
  }
  return map;
}

function getAllDescendantIds(groupId: string, allWidgets: Widget[]): Set<string> {
  const childrenMap = buildChildrenMap(allWidgets);
  const ids = new Set<string>();
  const queue = [groupId];
  while (queue.length) {
    const id = queue.pop()!;
    if (ids.has(id)) continue; // cycle guard
    ids.add(id);
    const children = childrenMap.get(id);
    if (children) children.forEach((c) => queue.push(c));
  }
  return ids;
}

function findGroupForWidget(widget: Widget, allWidgets: Widget[]): string | undefined {
  const cx = widget.x + widget.width / 2;
  const cy = widget.y + widget.height / 2;
  // Collect all descendant IDs to prevent circular nesting
  const descendants = widget.type === 'group' ? getAllDescendantIds(widget.id, allWidgets) : new Set<string>();
  const groups = allWidgets.filter(
    (w) => w.type === 'group' && !(w.data as GroupData).collapsed && w.id !== widget.id && !descendants.has(w.id)
  );
  const containing = groups.filter(
    (g) => cx > g.x && cx < g.x + g.width && cy > g.y && cy < g.y + g.height
  );
  if (!containing.length) return undefined;
  return containing.sort((a, b) => a.width * a.height - b.width * b.height)[0].id;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

type ResizeDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const RESIZE_DIRS: ResizeDir[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

interface Props { widget: Widget }

function WidgetNode({ widget }: Props) {
  const [isTextboxEditing, setIsTextboxEditing] = useState(false);
  const updateWidget = useStore((s) => s.updateWidget);
  const batchMoveWidgets = useStore((s) => s.batchMoveWidgets);
  const setSelectedWidget = useStore((s) => s.setSelectedWidget);
  const addToMultiSelect = useStore((s) => s.addToMultiSelect);
  const isSelected = useStore((s) => s.multiSelectedIds.includes(widget.id));
  const isMulti = useStore((s) => s.multiSelectedIds.length > 1 && s.multiSelectedIds.includes(widget.id));
  const bringToFront = useStore((s) => s.bringToFront);
  const isConnecting = useStore((s) => !!s.pendingConnection);
  const isSource = useStore((s) => s.pendingConnection?.fromId === widget.id);
  const isDropTarget = useStore((s) => s.dropTargetGroupId === widget.id);
  const setPendingConnection = useStore((s) => s.setPendingConnection);
  const addConnection = useStore((s) => s.addConnection);
  const toggleGroupCollapse = useStore((s) => s.toggleGroupCollapse);
  const stageGroupChange = useStore((s) => s.stageGroupChange);
  const setDropTargetGroupId = useStore((s) => s.setDropTargetGroupId);

  const isGroup = widget.type === 'group';

  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = nodeRef.current;
    if (!el || isGroup || widget.userResized) return;
    const ro = new ResizeObserver(([entry]) => {
      const h = entry.contentRect.height;
      if (Math.abs(h - widget.height) > 2) updateWidget(widget.id, { height: h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [widget.id, widget.height, widget.userResized, updateWidget, isGroup]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Space held → let event bubble to canvas for pan
    if (keyBridge.space) return;
    if ((e.target as HTMLElement).closest('.port')) return;
    if ((e.target as HTMLElement).closest('.group-collapse-btn')) return;
    if ((e.target as HTMLElement).closest('.resize-handle')) return;
    if (widget.type === 'textbox' && isTextboxEditing) return;
    if ((e.target as HTMLElement).closest('[data-dir-cell]')) {
      if (!isSelected) setSelectedWidget(widget.id);
      return;
    }
    if ((e.target as HTMLElement).closest('[data-worklog-input]')) {
      if (!isSelected) setSelectedWidget(widget.id);
      return;
    }
    e.stopPropagation();

    if (e.shiftKey) { addToMultiSelect(widget.id); return; }

    if (!isSelected) setSelectedWidget(widget.id);
    bringToFront(widget.id);

    track(`WidgetNode_DragStart_${widget.type}`);

    const startMouse = { x: e.clientX, y: e.clientY };
    const startPos = { x: widget.x, y: widget.y };

    const currentMulti = useStore.getState().multiSelectedIds;
    const isMultiDrag = currentMulti.length > 1 && currentMulti.includes(widget.id);

    // Cache DOM elements and positions once at mousedown — avoids O(n) querySelector per frame
    const allW = useStore.getState().widgets;
    const widgetMap = new Map(allW.map((w) => [w.id, w]));

    const multiStart = isMultiDrag
      ? currentMulti.map((id) => {
          const w = widgetMap.get(id);
          const el = document.querySelector<HTMLDivElement>(`[data-widget="${id}"]`);
          return { id, x: w?.x ?? 0, y: w?.y ?? 0, el };
        })
      : null;

    const childStart = isGroup
      ? (() => {
          const descIds = getAllDescendantIds(widget.id, allW);
          descIds.delete(widget.id);
          return Array.from(descIds).map((id) => {
            const w = widgetMap.get(id);
            const el = document.querySelector<HTMLDivElement>(`[data-widget="${id}"]`);
            return { id, x: w?.x ?? 0, y: w?.y ?? 0, el };
          });
        })()
      : null;

    let lastDx = 0, lastDy = 0;

    const onMove = (ev: MouseEvent) => {
      const vp = vpBridge;
      lastDx = (ev.clientX - startMouse.x) / vp.scale;
      lastDy = (ev.clientY - startMouse.y) / vp.scale;
      const dx = lastDx, dy = lastDy;

      if (multiStart) {
        // left/top instead of transform — avoids GPU compositor layer creation per element
        multiStart.forEach((sp) => {
          if (sp.el) { sp.el.style.left = (sp.x + dx) + 'px'; sp.el.style.top = (sp.y + dy) + 'px'; }
        });
        if (!isGroup) {
          const state = useStore.getState();
          const targetId = findGroupForWidget({ ...widget, x: startPos.x + dx, y: startPos.y + dy }, state.widgets) ?? null;
          if (targetId !== state.dropTargetGroupId) setDropTargetGroupId(targetId);
        }
      } else {
        if (nodeRef.current) { nodeRef.current.style.left = (startPos.x + dx) + 'px'; nodeRef.current.style.top = (startPos.y + dy) + 'px'; }
        if (childStart) {
          childStart.forEach((cp) => {
            if (cp.el) { cp.el.style.left = (cp.x + dx) + 'px'; cp.el.style.top = (cp.y + dy) + 'px'; }
          });
        }
        // Drop-target detection works for both regular widgets AND groups (enables nested groups)
        const state = useStore.getState();
        const targetId = findGroupForWidget({ ...widget, x: startPos.x + dx, y: startPos.y + dy }, state.widgets) ?? null;
        if (targetId !== state.dropTargetGroupId) setDropTargetGroupId(targetId);
      }
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      const dx = lastDx, dy = lastDy;

      if (multiStart) {
        // Final position already set by last onMove; just commit to store in one batch
        multiStart.forEach((sp) => {
          if (sp.el) { sp.el.style.left = (sp.x + dx) + 'px'; sp.el.style.top = (sp.y + dy) + 'px'; }
        });
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) useStore.getState().pushUndo();
        batchMoveWidgets(multiStart.map((sp) => ({ id: sp.id, x: sp.x + dx, y: sp.y + dy })));
        const state = useStore.getState();
        const selectedIds = new Set(multiStart.map((sp) => sp.id));
        multiStart.forEach((sp) => {
          const w = state.widgets.find((x) => x.id === sp.id);
          if (!w) return;
          // Skip widgets whose ancestor group is also in this selection —
          // bringToFront on the ancestor group covers the whole subtree.
          let gid = w.groupId;
          while (gid) {
            if (selectedIds.has(gid)) return;
            gid = state.widgets.find((x) => x.id === gid)?.groupId;
          }
          const targetGroupId = findGroupForWidget(w, state.widgets);
          if (targetGroupId !== w.groupId) {
            useStore.getState().setWidgetGroup(sp.id, targetGroupId);
          }
          useStore.getState().bringToFront(sp.id);
        });
      } else {
        const newX = startPos.x + dx;
        const newY = startPos.y + dy;
        if (nodeRef.current) {
          nodeRef.current.style.left = newX + 'px';
          nodeRef.current.style.top = newY + 'px';
        }
        const moves: { id: string; x: number; y: number }[] = [{ id: widget.id, x: newX, y: newY }];
        if (childStart) {
          childStart.forEach((cp) => {
            if (cp.el) { cp.el.style.left = (cp.x + dx) + 'px'; cp.el.style.top = (cp.y + dy) + 'px'; }
            moves.push({ id: cp.id, x: cp.x + dx, y: cp.y + dy });
          });
        }
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) useStore.getState().pushUndo();
        batchMoveWidgets(moves);
        {
          const state = useStore.getState();
          const targetGroupId = findGroupForWidget({ ...widget, x: newX, y: newY }, state.widgets);
          const prevGroupId = state.widgets.find((w) => w.id === widget.id)?.groupId;
          const moved = Math.abs(dx) > 2 || Math.abs(dy) > 2;
          if (moved) track(`WidgetNode_DragEnd_${widget.type}`, { dx: Math.round(dx), dy: Math.round(dy) });
          if (targetGroupId !== prevGroupId) {
            const targetGroup = targetGroupId
              ? state.widgets.find((w) => w.id === targetGroupId)
              : state.widgets.find((w) => w.id === prevGroupId);
            const groupName = (targetGroup?.data as GroupData)?.title || '그룹';
            if (targetGroupId) track(`WidgetNode_DropIntoGroup_${widget.type}`, { group_name: groupName });
            else track(`WidgetNode_RemoveFromGroup_${widget.type}`, { group_name: groupName });
            stageGroupChange({
              widgetId: widget.id,
              prevGroupId,
              prevX: startPos.x,
              prevY: startPos.y,
              newGroupId: targetGroupId,
              groupName,
              action: targetGroupId ? 'added' : 'removed',
            });
          }
          bringToFront(widget.id);
        }
      }
      setDropTargetGroupId(null);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handlePortMouseDown = (e: React.MouseEvent, port: PortSide) => {
    e.stopPropagation();
    e.preventDefault();
    const cr = (e.target as HTMLElement).closest('.canvas-container')?.getBoundingClientRect() ?? { left: 0, top: 0 };
    setPendingConnection({ fromId: widget.id, fromPort: port, toX: e.clientX - cr.left, toY: e.clientY - cr.top });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const pc = useStore.getState().pendingConnection;
    if (pc && pc.fromId !== widget.id) {
      addConnection(pc.fromId, widget.id);
      setPendingConnection(null);
      e.stopPropagation();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isGroup) {
      e.stopPropagation();
      const data = widget.data as GroupData;
      track(data.collapsed ? 'WidgetNode_Group_Expand' : 'WidgetNode_Group_Collapse', { group_title: data.title });
      toggleGroupCollapse(widget.id);
      return;
    }
    if (widget.type === 'textbox') { e.stopPropagation(); setIsTextboxEditing(true); return; }
  };

  // Group color as inline styles
  const groupData = isGroup ? (widget.data as GroupData) : null;
  const groupColor = groupData?.color ?? '#6366f1';

  const cls = [
    'widget',
    `widget-${widget.type}`,
    isSelected ? 'selected' : '',
    isMulti ? 'multi-selected' : '',
    isConnecting && !isSource && !isGroup ? 'connecting-target' : '',
    isDropTarget ? 'drop-target' : '',
  ].filter(Boolean).join(' ');

  const groupStyle = isGroup
    ? {
        background: hexToRgba(groupColor, 0.06),
        borderColor: hexToRgba(groupColor, 0.38),
        '--group-accent': groupColor,
      } as React.CSSProperties
    : undefined;

  // Scale content proportionally to widget width when user has resized
  const defaultW = isGroup ? widget.width : defaultSize(widget.type).width;
  const zoomScale = (!isGroup && widget.userResized) ? widget.width / defaultW : 1;
  const zoomHeight = widget.userResized ? widget.height / zoomScale : undefined;

  return (
    <div
      ref={nodeRef}
      data-widget={widget.id}
      className={cls}
      style={{
        left: widget.x,
        top: widget.y,
        width: widget.width,
        height: (isGroup || widget.userResized) ? widget.height : undefined,
        zIndex: widget.zIndex,
        ...groupStyle,
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
      onDragStart={(e) => e.preventDefault()}
    >
      {!isGroup && (['top', 'right', 'bottom', 'left'] as PortSide[]).map((port) => (
        <div key={port} className={`port port-${port}`} onMouseDown={(e) => handlePortMouseDown(e, port)} />
      ))}

      {isSelected && (isGroup ? !(groupData?.collapsed) : true) && (
        <ResizeHandles widget={widget} isGroup={isGroup} />
      )}

      <div style={{
        zoom: zoomScale,
        width: defaultW,
        height: zoomHeight,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 'var(--radius)',
      }}>
        <WidgetContent
          widget={widget}
          isTextboxEditing={isTextboxEditing}
          onTextboxEditEnd={() => setIsTextboxEditing(false)}
        />
      </div>
    </div>
  );
}

export default React.memo(WidgetNode);

/* ── Resize Handles ── */
function ResizeHandles({ widget, isGroup }: { widget: Widget; isGroup: boolean }) {
  const updateWidget = useStore((s) => s.updateWidget);

  const startResize = (e: React.MouseEvent, dir: ResizeDir) => {
    e.stopPropagation();
    e.preventDefault();

    useStore.getState().pushUndo();

    const startMouse = { x: e.clientX, y: e.clientY };
    const start = { x: widget.x, y: widget.y, w: widget.width, h: widget.height };
    let firstMove = true;

    const onMove = (ev: MouseEvent) => {
      if (firstMove) {
        firstMove = false;
        updateWidget(widget.id, { userResized: true });
      }
      const vp = vpBridge;
      const dx = (ev.clientX - startMouse.x) / vp.scale;
      const dy = (ev.clientY - startMouse.y) / vp.scale;

      let { x, y, w, h } = start;
      const MIN_W = 120, MIN_H = 80;

      if (dir.includes('e')) w = Math.max(MIN_W, start.w + dx);
      if (dir.includes('s')) h = Math.max(MIN_H, start.h + dy);
      if (dir.includes('w')) {
        const nw = Math.max(MIN_W, start.w - dx);
        x = start.x + (start.w - nw);
        w = nw;
      }
      if (dir.includes('n')) {
        const nh = Math.max(MIN_H, start.h - dy);
        y = start.y + (start.h - nh);
        h = nh;
      }

      updateWidget(widget.id, { x, y, width: w, height: h });
    };

    const onUp = () => {
      const current = useStore.getState().widgets.find((w) => w.id === widget.id);
      if (current) {
        track(`WidgetNode_Resize_${widget.type}`, { dir, new_w: Math.round(current.width), new_h: Math.round(current.height) });
        if (isGroup) {
          updateWidget(widget.id, {
            data: { ...current.data, expandedWidth: current.width, expandedHeight: current.height },
          });
        } else {
          updateWidget(widget.id, { userResized: true });
        }
      }
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <>
      {RESIZE_DIRS.map((dir) => (
        <div
          key={dir}
          className={`resize-handle resize-handle-${dir}`}
          onMouseDown={(e) => startResize(e, dir)}
        />
      ))}
    </>
  );
}

/* ── Widget content switcher ── */
function WidgetContent({ widget, isTextboxEditing, onTextboxEditEnd }: {
  widget: Widget;
  isTextboxEditing?: boolean;
  onTextboxEditEnd?: () => void;
}) {
  const updateWidgetData = useStore((s) => s.updateWidgetData);
  switch (widget.type) {
    case 'task':  return <TaskContent data={widget.data as TaskData} />;
    case 'note':  return <NoteContent data={widget.data as NoteData} />;
    case 'link':  return <LinkContent data={widget.data as LinkData} />;
    case 'image': return <ImageContent data={widget.data as ImageData} />;
    case 'group': return <GroupContent widgetId={widget.id} data={widget.data as GroupData} height={widget.height} />;
    case 'goal':  return <GoalContent widgetId={widget.id} data={widget.data as GoalData} />;
    case 'lead':   return <LeadContent data={widget.data as LeadData} />;
    case 'funnel': return <FunnelContent data={widget.data as FunnelData} />;
    case 'textbox': return (
      <TextboxContent
        data={widget.data as TextboxData}
        isEditing={isTextboxEditing ?? false}
        onEditEnd={onTextboxEditEnd ?? (() => {})}
        onChange={(d) => updateWidgetData(widget.id, d)}
      />
    );
    case 'html': return <HtmlContent data={widget.data as HtmlData} />;
    case 'fileupload': return (
      <FileUploadContent
        data={widget.data as FileUploadData}
        onChange={(d) => updateWidgetData(widget.id, d)}
      />
    );
    case 'directory': return (
      <DirectoryContent
        data={widget.data as DirectoryData}
        onChange={(d) => updateWidgetData(widget.id, d)}
      />
    );
    case 'worklog': return (
      <WorklogContent
        data={widget.data as WorklogData}
        onChange={(d) => updateWidgetData(widget.id, d)}
      />
    );
    case 'finance': return <FinanceContent data={widget.data as FinanceData} />;
    case 'calendar': return (
      <CalendarContent
        data={widget.data as CalendarData}
        onChange={(d) => updateWidgetData(widget.id, d)}
      />
    );
    case 'embed': return <EmbedContent data={widget.data as EmbedData} />;
  }
}

function GroupContent({ widgetId, data, height }: { widgetId: string; data: GroupData; height: number }) {
  const toggleGroupCollapse = useStore((s) => s.toggleGroupCollapse);
  const childCount = useStore((s) => s.widgets.filter((w) => w.groupId === widgetId).length);

  if (data.collapsed) {
    return (
      <div className="group-collapsed">
        <span className="group-icon">▶</span>
        <span className="group-title">{data.title || '그룹'}</span>
        <span className="group-count">{childCount}개 항목</span>
        <button
          className="group-collapse-btn"
          onClick={(e) => { e.stopPropagation(); toggleGroupCollapse(widgetId); }}
        >
          펼치기
        </button>
      </div>
    );
  }

  return (
    <div className="group-expanded" style={{ height }}>
      <div className="group-title-bar">
        <div className="group-title-left">
          <span className="group-icon">⬡</span>
          <span className="group-title">{data.title || '그룹'}</span>
          <span className="group-count">{childCount}개 항목</span>
        </div>
        <button
          className="group-collapse-btn"
          onClick={(e) => { e.stopPropagation(); toggleGroupCollapse(widgetId); }}
        >
          접기
        </button>
      </div>
    </div>
  );
}

function TaskContent({ data }: { data: TaskData }) {
  const isOverdue = data.dueDate && new Date(data.dueDate) < new Date() && data.status !== 'done';
  const statusLabel = data.status === 'in-progress' ? '진행 중' : data.status === 'todo' ? '할 일' : '완료';
  const priorityLabel = data.priority === 'low' ? '낮음' : data.priority === 'medium' ? '보통' : '높음';

  return (
    <div className={`status-${data.status}`}>
      <div className="task-header">
        <div className="task-status-dot" />
        <div className="task-title">{data.title || '제목 없는 작업'}</div>
      </div>
      <div className="task-body">
        {data.description && <div className="task-desc">{data.description}</div>}

        <div className="task-badges-row">
          <span className={`badge badge-${data.status}`}>{statusLabel}</span>
          <span className={`badge badge-${data.priority}`}>{priorityLabel}</span>
          {data.dueDate && (
            <span className={`task-due${isOverdue ? ' overdue' : ''}`}>
              📅 {new Date(data.dueDate).toLocaleDateString('ko-KR')}
            </span>
          )}
        </div>

        {data.tags.length > 0 && (
          <div className="task-tags-row">
            {data.tags.map((t) => <span key={t} className="tag">{t}</span>)}
          </div>
        )}

        {data.attachments.length > 0 && (
          <div className="task-attach-row">
            <span className="attachment-count">📎 첨부파일 {data.attachments.length}개</span>
          </div>
        )}
      </div>
    </div>
  );
}

function NoteContent({ data }: { data: NoteData }) {
  return (
    <div className="note-body" style={{ background: data.color, borderRadius: 'var(--radius)' }}>
      {data.content || '빈 메모'}
    </div>
  );
}

function LinkContent({ data }: { data: LinkData }) {
  let host = '';
  try { host = new URL(data.url).hostname; } catch {}
  return (
    <div>
      <div className="link-header">
        <div className="link-favicon">🔗</div>
        <div className="link-title">{data.title || '제목 없는 링크'}</div>
      </div>
      {data.url && <div className="link-url">{host || data.url}</div>}
      {data.description && <div className="link-desc">{data.description}</div>}
      {!data.description && !data.url && <div style={{ height: 12 }} />}
    </div>
  );
}

function ImageContent({ data }: { data: ImageData }) {
  return (
    <div className="image-content">
      {data.src
        ? <img
            className="image-thumb"
            src={data.src}
            alt={data.caption || data.name}
            draggable={false}
          />
        : <div className="image-placeholder">🖼️</div>
      }
      {data.caption && <div className="image-caption">{data.caption}</div>}
    </div>
  );
}

function GoalContent({ widgetId, data }: { widgetId: string; data: GoalData }) {
  const connections = useStore((s) => s.connections);
  const widgets = useStore((s) => s.widgets);

  const { childGoals, parentGoal, autoProgress } = useMemo(() => {
    const childConns = connections.filter((c) => c.type === 'goal-parent' && c.fromId === widgetId);
    const childGoals = childConns
      .map((c) => widgets.find((w) => w.id === c.toId))
      .filter((w): w is Widget => !!w && w.type === 'goal');

    const parentConn = connections.find((c) => c.type === 'goal-parent' && c.toId === widgetId);
    const parentGoal = parentConn
      ? (widgets.find((w) => w.id === parentConn.fromId && w.type === 'goal') ?? null)
      : null;

    const autoProgress = childGoals.length > 0
      ? Math.round(childGoals.reduce((sum, w) => sum + (w.data as GoalData).progress, 0) / childGoals.length)
      : null;

    return { childGoals, parentGoal, autoProgress };
  }, [connections, widgets, widgetId]);

  const displayProgress = autoProgress ?? data.progress;
  const doneKR = data.keyResults.filter((k) => k.done).length;
  const totalKR = data.keyResults.length;
  const color = GOAL_COLORS[data.status];
  const gradient = GOAL_GRADIENTS[data.status];

  return (
    <div className="goal-card">
      <div className="goal-header" style={{ background: gradient }}>
        <div className="goal-header-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className="goal-icon">🎯</span>
            {parentGoal && (
              <span className="goal-parent-chip" title={(parentGoal.data as GoalData).title}>
                ↑ {(parentGoal.data as GoalData).title || '상위 목표'}
              </span>
            )}
          </div>
          <span className="goal-status-badge">{GOAL_STATUS_KO[data.status]}</span>
        </div>
        <div className="goal-header-title">{data.title || '새 목표'}</div>
      </div>

      <div className="goal-body">
        {data.description && <div className="goal-description">{data.description}</div>}

        <div className="goal-progress-row">
          <div className="goal-progress-track">
            <div className="goal-progress-fill" style={{ width: `${displayProgress}%`, background: color }} />
          </div>
          <span className="goal-progress-pct" style={{ color }}>{displayProgress}%</span>
          {autoProgress !== null && (
            <span className="goal-auto-chip" title="하위 목표 평균으로 자동 계산">자동</span>
          )}
        </div>

        <div className="goal-meta">
          {totalKR > 0 && (
            <span className="goal-kr-summary">
              <span className="goal-kr-done">{doneKR}</span>
              <span className="goal-kr-sep">/{totalKR}</span>
              <span className="goal-kr-label"> 핵심 결과</span>
            </span>
          )}
          {childGoals.length > 0 && (
            <span className="goal-child-count-chip">하위 {childGoals.length}개</span>
          )}
          {data.targetDate && (
            <span className="goal-due">
              🗓 {new Date(data.targetDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>

        {/* Child goal mini-bars */}
        {childGoals.length > 0 && (
          <div className="goal-children-list">
            {childGoals.slice(0, 3).map((cw) => {
              const cd = cw.data as GoalData;
              return (
                <div key={cw.id} className="goal-child-row">
                  <span className="goal-child-name">{cd.title || '하위 목표'}</span>
                  <div className="goal-child-track">
                    <div className="goal-child-fill" style={{ width: `${cd.progress}%`, background: GOAL_COLORS[cd.status] }} />
                  </div>
                  <span className="goal-child-pct" style={{ color: GOAL_COLORS[cd.status] }}>{cd.progress}%</span>
                </div>
              );
            })}
            {childGoals.length > 3 && (
              <div className="goal-kr-more">+{childGoals.length - 3}개 더</div>
            )}
          </div>
        )}

        {/* KR mini-list when no child goals */}
        {childGoals.length === 0 && data.keyResults.length > 0 && (
          <ul className="goal-kr-list">
            {data.keyResults.slice(0, 3).map((kr) => (
              <li key={kr.id} className={`goal-kr-item${kr.done ? ' done' : ''}`}>
                <span className="goal-kr-check">{kr.done ? '✓' : '○'}</span>
                <span className="goal-kr-text">{kr.text}</span>
              </li>
            ))}
            {data.keyResults.length > 3 && (
              <li className="goal-kr-more">+{data.keyResults.length - 3}개 더</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ── Lead Content ── */
const LEAD_STAGES: LeadStage[] = ['prospect', 'qualified', 'proposal', 'negotiation', 'won'];

const LEAD_STAGE_KO: Record<LeadStage, string> = {
  prospect:    '잠재',
  qualified:   '검증',
  proposal:    '제안',
  negotiation: '협상',
  won:         '성사',
  lost:        '손실',
};

const LEAD_STAGE_COLOR: Record<LeadStage, string> = {
  prospect:    '#3b82f6',
  qualified:   '#8b5cf6',
  proposal:    '#f59e0b',
  negotiation: '#f97316',
  won:         '#22c55e',
  lost:        '#64748b',
};

function LeadContent({ data }: { data: LeadData }) {
  const isLost = data.stage === 'lost';
  const activeIdx = LEAD_STAGES.indexOf(data.stage);
  const stageColor = LEAD_STAGE_COLOR[data.stage];

  const formatValue = (v: number, currency: string) => {
    if (!v) return null;
    if (currency === 'KRW') {
      if (v >= 100_000_000) return `₩${(v / 100_000_000).toFixed(1)}억`;
      if (v >= 10_000) return `₩${(v / 10_000).toFixed(0)}만`;
      return `₩${v.toLocaleString()}`;
    }
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v.toLocaleString()}`;
  };

  return (
    <div className="lead-card">
      {/* Header */}
      <div className="lead-header" style={{ borderLeftColor: stageColor }}>
        <div className="lead-header-main">
          <div className="lead-company">{data.company || '회사명 미입력'}</div>
          <div className="lead-name">{data.name}</div>
        </div>
        <div className="lead-header-right">
          {formatValue(data.value, data.currency) && (
            <div className="lead-value" style={{ color: stageColor }}>
              {formatValue(data.value, data.currency)}
            </div>
          )}
          {data.probability > 0 && (
            <div className="lead-prob">{data.probability}%</div>
          )}
          {data.source && (
            <div className="lead-source-badge">{data.source}</div>
          )}
        </div>
      </div>

      {/* Pipeline stages */}
      <div className="lead-pipeline-wrap">
        {isLost ? (
          <div className="lead-lost-bar">
            <span className="lead-lost-icon">✕</span>
            <span>손실</span>
          </div>
        ) : (
          <>
            <div className="lead-pipeline">
              {LEAD_STAGES.map((stage, i) => {
                const isPast = i < activeIdx;
                const isActive = i === activeIdx;
                const color = isActive ? stageColor : isPast ? '#94a3b8' : '#e2e8f0';
                return (
                  <div key={stage} className="lead-stage-slot">
                    <div
                      className={`lead-dot${isActive ? ' active' : ''}${isPast ? ' past' : ''}`}
                      style={{ background: color, boxShadow: isActive ? `0 0 0 3px ${stageColor}33` : 'none' }}
                    />
                    {i < LEAD_STAGES.length - 1 && (
                      <div
                        className="lead-line"
                        style={{ background: isPast ? '#94a3b8' : '#e2e8f0' }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="lead-stage-labels">
              {LEAD_STAGES.map((stage, i) => (
                <span
                  key={stage}
                  className={`lead-stage-label${i === activeIdx ? ' active' : ''}`}
                  style={i === activeIdx ? { color: stageColor, fontWeight: 700 } : {}}
                >
                  {LEAD_STAGE_KO[stage]}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Next action */}
      {data.nextAction && (
        <div className="lead-next">
          <span className="lead-next-icon">📌</span>
          <span className="lead-next-text">{data.nextAction}</span>
          {data.nextActionDate && (
            <span className="lead-next-date">
              {new Date(data.nextActionDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Textbox Content ── */
function TextboxContent({
  data,
  isEditing,
  onEditEnd,
  onChange,
}: {
  data: TextboxData;
  isEditing: boolean;
  onEditEnd: () => void;
  onChange: (d: Partial<TextboxData>) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const style: React.CSSProperties = {
    fontSize: data.fontSize,
    textAlign: data.align,
    fontWeight: data.bold ? 700 : 400,
    fontStyle: data.italic ? 'italic' : 'normal',
    color: data.color,
  };

  if (isEditing) {
    return (
      <textarea
        ref={textareaRef}
        className="textbox-textarea"
        value={data.content}
        style={style}
        onChange={(e) => onChange({ content: e.target.value })}
        onBlur={onEditEnd}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); onEditEnd(); }
        }}
      />
    );
  }

  return (
    <div className="textbox-display" style={style}>
      {data.content || <span style={{ opacity: 0.35 }}>텍스트를 입력하세요</span>}
    </div>
  );
}

/* ── HTML Content ── */
function HtmlContent({ data }: { data: HtmlData }) {
  const openInNewTab = () => {
    if (!data.html) return;
    const blob = new Blob([data.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <div className="html-card">
      <div className="html-header">
        <span className="html-icon">⟨/⟩</span>
        <span className="html-filename">{data.name || 'HTML 파일'}</span>
        {data.html && (
          <button
            className="html-open-btn"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); openInNewTab(); }}
          >
            새 탭 ↗
          </button>
        )}
      </div>
      {data.html ? (
        <div className="html-iframe-wrap">
          <iframe
            className="html-iframe"
            srcDoc={data.html}
            sandbox="allow-scripts"
            title={data.name || 'HTML 미리보기'}
          />
        </div>
      ) : (
        <div className="html-empty">
          <div style={{ fontSize: 24 }}>⟨/⟩</div>
          <div>인스펙터에서 HTML 파일 업로드</div>
        </div>
      )}
    </div>
  );
}

/* ── Funnel Content ── */
const FUNNEL_STAGES: LeadStage[] = ['prospect', 'qualified', 'proposal', 'negotiation', 'won'];
const ALL_STAGES: LeadStage[]    = ['prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

function fmtValue(v: number, currency: string): string {
  if (currency === 'KRW') {
    if (v >= 100_000_000) return `₩${(v / 100_000_000).toFixed(1)}억`;
    if (v >= 10_000) return `₩${(v / 10_000).toFixed(0)}만`;
    return `₩${v.toLocaleString()}`;
  }
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
}

const SOURCE_COLORS = ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#f97316', '#8b5cf6', '#ec4899', '#14b8a6'];

type FunnelTab2 = 'funnel' | 'source' | 'cross' | 'pipeline';

function FunnelContent({ data }: { data: FunnelData }) {
  const [tab, setTab] = useState<FunnelTab2>('funnel');
  const [pipeSort, setPipeSort] = useState<'expected' | 'value' | 'prob' | 'date'>('expected');
  const widgets = useStore((s) => s.widgets);

  // All hooks before any conditional return
  const leads = useMemo(
    () => widgets.filter((w) => w.type === 'lead').map((w) => w.data as LeadData),
    [widgets]
  );

  const currency = leads[0]?.currency ?? 'KRW';
  const fmt = (n: number) => fmtValue(n, currency);

  // Stage aggregation
  const stageData = useMemo(() =>
    ALL_STAGES.map((stage) => {
      const items = leads.filter((l) => l.stage === stage);
      const value = items.reduce((s, l) => s + (l.value || 0), 0);
      const expected = items.reduce((s, l) => s + (l.value || 0) * (l.probability || 0) / 100, 0);
      const avgProb = items.length > 0 ? Math.round(items.reduce((s, l) => s + (l.probability || 0), 0) / items.length) : 0;
      return { stage, count: items.length, value, expected, avgProb };
    }), [leads]
  );

  // Source aggregation
  const sourceData = useMemo(() => {
    const map = new Map<string, { count: number; value: number; won: number; lost: number }>();
    leads.forEach((l) => {
      const src = l.source?.trim() || '미입력';
      const e = map.get(src) ?? { count: 0, value: 0, won: 0, lost: 0 };
      map.set(src, {
        count: e.count + 1,
        value: e.value + (l.value || 0),
        won:  e.won  + (l.stage === 'won'  ? 1 : 0),
        lost: e.lost + (l.stage === 'lost' ? 1 : 0),
      });
    });
    return [...map.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([src, v], i) => ({
        src,
        ...v,
        winRate: (v.won + v.lost) > 0 ? Math.round(v.won / (v.won + v.lost) * 100) : null,
        avgDeal: v.won > 0 ? v.value / v.count : 0,
        color: SOURCE_COLORS[i % SOURCE_COLORS.length],
      }));
  }, [leads]);

  // Cross matrix: source × stage
  const sources = useMemo(() => [...new Set(leads.map((l) => l.source?.trim() || '미입력'))], [leads]);
  const crossData = useMemo(() => {
    const matrix: Record<string, Record<LeadStage, number>> = {};
    sources.forEach((src) => {
      matrix[src] = { prospect: 0, qualified: 0, proposal: 0, negotiation: 0, won: 0, lost: 0 };
    });
    leads.forEach((l) => {
      const src = l.source?.trim() || '미입력';
      if (matrix[src]) matrix[src][l.stage] = (matrix[src][l.stage] || 0) + 1;
    });
    return matrix;
  }, [leads, sources]);
  const crossMax = useMemo(() => {
    let m = 1;
    sources.forEach((src) => ALL_STAGES.forEach((st) => { if ((crossData[src]?.[st] ?? 0) > m) m = crossData[src][st]; }));
    return m;
  }, [crossData, sources]);

  // Pipeline list (active deals)
  const pipelineData = useMemo(() => {
    const active = leads.filter((l) => l.stage !== 'won' && l.stage !== 'lost');
    const sorted = [...active].sort((a, b) => {
      if (pipeSort === 'expected') return (b.value * b.probability / 100) - (a.value * a.probability / 100);
      if (pipeSort === 'value')    return (b.value || 0) - (a.value || 0);
      if (pipeSort === 'prob')     return (b.probability || 0) - (a.probability || 0);
      if (pipeSort === 'date')     return (a.nextActionDate || 'z').localeCompare(b.nextActionDate || 'z');
      return 0;
    });
    return sorted;
  }, [leads, pipeSort]);

  // KPI
  const activeLeads = leads.filter((l) => l.stage !== 'won' && l.stage !== 'lost');
  const wonLeads    = leads.filter((l) => l.stage === 'won');
  const lostLeads   = leads.filter((l) => l.stage === 'lost');
  const pipeline    = activeLeads.reduce((s, l) => s + (l.value || 0), 0);
  const expectedRev = activeLeads.reduce((s, l) => s + (l.value || 0) * (l.probability || 0) / 100, 0);
  const winRate     = (wonLeads.length + lostLeads.length) > 0
    ? Math.round(wonLeads.length / (wonLeads.length + lostLeads.length) * 100) : 0;
  const avgDeal     = wonLeads.length > 0
    ? wonLeads.reduce((s, l) => s + (l.value || 0), 0) / wonLeads.length : 0;

  const activeStages = stageData.filter((d) => d.stage !== 'won' && d.stage !== 'lost');
  const maxActive    = Math.max(...activeStages.map((d) => d.count), 1);

  const tabBtn = (t: FunnelTab2, label: string) => (
    <button
      key={t}
      className={`funnel-tab${tab === t ? ' active' : ''}`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); setTab(t); }}
    >{label}</button>
  );

  return (
    <div className="funnel-card">
      {/* Header */}
      <div className="funnel-header">
        <span className="funnel-title-text">{data.title || '세일즈 퍼널'}</span>
        <span className="funnel-total-badge">{leads.length}개 리드</span>
      </div>

      {leads.length === 0 ? (
        <div className="funnel-empty">
          <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
          <div style={{ fontWeight: 600 }}>리드 위젯을 추가하면</div>
          <div style={{ fontSize: 12, color: '#8b949e', marginTop: 4 }}>고급 세일즈 분석이 자동으로 집계됩니다</div>
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="funnel-kpi-row">
            <div className="funnel-kpi">
              <div className="funnel-kpi-label">파이프라인</div>
              <div className="funnel-kpi-val">{fmt(pipeline)}</div>
            </div>
            <div className="funnel-kpi">
              <div className="funnel-kpi-label">예상 매출</div>
              <div className="funnel-kpi-val funnel-kpi-green">{fmt(expectedRev)}</div>
            </div>
            <div className="funnel-kpi">
              <div className="funnel-kpi-label">수주율</div>
              <div className="funnel-kpi-val">{winRate}%</div>
            </div>
            <div className="funnel-kpi">
              <div className="funnel-kpi-label">평균 계약</div>
              <div className="funnel-kpi-val">{avgDeal > 0 ? fmt(avgDeal) : '-'}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="funnel-tabs">
            {tabBtn('funnel', '퍼널')}
            {tabBtn('source', '소스')}
            {tabBtn('cross', '교차분석')}
            {tabBtn('pipeline', '기회목록')}
          </div>

          <div className="funnel-body">
            {/* ── 퍼널 탭 ── */}
            {tab === 'funnel' && (
              <div className="funnel-viz-tab">
                {/* SVG Trapezoid Funnel */}
                <FunnelShape stages={activeStages} maxCount={maxActive} />
                {/* Stage Detail Table */}
                <div className="funnel-stage-table">
                  <div className="funnel-stage-thead">
                    <span>스테이지</span><span>건수</span><span>전환율</span><span>금액</span><span>예상매출</span><span>평균확률</span>
                  </div>
                  {stageData.map((d, i) => {
                    const prev = i > 0 ? stageData[i - 1].count : null;
                    const conv = prev !== null && prev > 0 ? Math.round(d.count / prev * 100) : null;
                    const isWon = d.stage === 'won'; const isLost = d.stage === 'lost';
                    return (
                      <div key={d.stage} className={`funnel-stage-row${isWon ? ' won' : isLost ? ' lost' : ''}`}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: LEAD_STAGE_COLOR[d.stage], flexShrink: 0 }} />
                          {LEAD_STAGE_KO[d.stage]}
                        </span>
                        <span style={{ color: LEAD_STAGE_COLOR[d.stage], fontWeight: 700 }}>{d.count}</span>
                        <span style={{ color: conv !== null && conv < 50 ? '#ef4444' : '#22c55e' }}>
                          {conv !== null ? `${conv}%` : '—'}
                        </span>
                        <span>{d.value > 0 ? fmt(d.value) : '—'}</span>
                        <span style={{ color: '#22c55e' }}>{d.expected > 0 ? fmt(d.expected) : '—'}</span>
                        <span style={{ color: '#8b949e' }}>{d.avgProb > 0 ? `${d.avgProb}%` : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── 소스 탭 ── */}
            {tab === 'source' && (
              <div className="funnel-source-tab">
                <div className="funnel-source-bars">
                  {sourceData.map((s) => (
                    <div key={s.src} className="funnel-source-bar-row">
                      <div className="funnel-source-label" title={s.src}>{s.src}</div>
                      <div className="funnel-source-track">
                        <div className="funnel-source-fill" style={{ width: `${(s.count / (sourceData[0]?.count || 1)) * 100}%`, background: s.color }} />
                        <span className="funnel-source-cnt">{s.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="funnel-source-table">
                  <div className="funnel-source-thead">
                    <span>소스</span><span>건수</span><span>수주율</span><span>평균금액</span><span>W/L</span>
                  </div>
                  {sourceData.map((s) => (
                    <div key={s.src} className="funnel-source-row">
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                        <span className="funnel-source-name" title={s.src}>{s.src}</span>
                      </span>
                      <span style={{ fontWeight: 700 }}>{s.count}</span>
                      <span style={{ color: s.winRate !== null ? (s.winRate >= 50 ? '#22c55e' : '#f59e0b') : '#8b949e' }}>
                        {s.winRate !== null ? `${s.winRate}%` : '—'}
                      </span>
                      <span>{s.avgDeal > 0 ? fmt(s.avgDeal) : '—'}</span>
                      <span style={{ color: '#8b949e', fontSize: 10 }}>{s.won}W / {s.lost}L</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── 교차분석 탭 ── */}
            {tab === 'cross' && (
              <div className="funnel-cross-tab">
                <div className="funnel-cross-wrap" style={{ overflowX: 'auto' }}>
                  <table className="funnel-cross-table">
                    <thead>
                      <tr>
                        <th>소스</th>
                        {ALL_STAGES.map((st) => (
                          <th key={st} style={{ color: LEAD_STAGE_COLOR[st] }}>{LEAD_STAGE_KO[st]}</th>
                        ))}
                        <th style={{ color: '#8b949e' }}>합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sources.map((src) => {
                        const row = crossData[src] ?? {} as Record<LeadStage, number>;
                        const rowTotal = ALL_STAGES.reduce((s, st) => s + (row[st] || 0), 0);
                        return (
                          <tr key={src}>
                            <td className="funnel-cross-src">{src}</td>
                            {ALL_STAGES.map((st) => {
                              const v = row[st] || 0;
                              const intensity = v > 0 ? Math.max(0.12, v / crossMax) : 0;
                              return (
                                <td key={st} className="funnel-cross-cell"
                                  style={{ background: v > 0 ? `rgba(99,102,241,${intensity})` : 'transparent' }}>
                                  {v > 0 ? v : <span style={{ color: '#374151', opacity: 0.2 }}>·</span>}
                                </td>
                              );
                            })}
                            <td className="funnel-cross-total">{rowTotal}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="funnel-cross-src" style={{ fontWeight: 700 }}>합계</td>
                        {ALL_STAGES.map((st) => (
                          <td key={st} className="funnel-cross-total">{stageData.find((d) => d.stage === st)?.count ?? 0}</td>
                        ))}
                        <td className="funnel-cross-total" style={{ fontWeight: 700 }}>{leads.length}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* ── 기회 목록 탭 ── */}
            {tab === 'pipeline' && (
              <div className="funnel-pipeline-tab">
                <div className="funnel-pipeline-sorts">
                  {(['expected', 'value', 'prob', 'date'] as const).map((k) => {
                    const labels = { expected: '예상매출', value: '금액', prob: '확률', date: '다음연락' };
                    return (
                      <button
                        key={k}
                        className={`funnel-sort-btn${pipeSort === k ? ' active' : ''}`}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); setPipeSort(k); }}
                      >{labels[k]}</button>
                    );
                  })}
                </div>
                <div className="funnel-pipeline-list">
                  <div className="funnel-pipeline-thead">
                    <span>리드</span><span>스테이지</span><span>금액</span><span>확률</span><span>예상</span><span>다음연락</span>
                  </div>
                  {pipelineData.map((l, i) => {
                    const overdue = l.nextActionDate && l.nextActionDate < new Date().toISOString().slice(0, 10);
                    return (
                      <div key={i} className="funnel-pipeline-row">
                        <span className="funnel-pipe-name" title={`${l.name} (${l.company})`}>
                          <span>{l.name}</span>
                          {l.company && <span className="funnel-pipe-co">{l.company}</span>}
                        </span>
                        <span>
                          <span className="funnel-pipe-stage" style={{ background: LEAD_STAGE_COLOR[l.stage] + '22', color: LEAD_STAGE_COLOR[l.stage] }}>
                            {LEAD_STAGE_KO[l.stage]}
                          </span>
                        </span>
                        <span>{l.value > 0 ? fmt(l.value) : '—'}</span>
                        <span style={{ color: l.probability >= 70 ? '#22c55e' : l.probability >= 40 ? '#f59e0b' : '#ef4444' }}>
                          {l.probability}%
                        </span>
                        <span style={{ color: '#22c55e', fontWeight: 600 }}>
                          {l.value > 0 ? fmt(l.value * l.probability / 100) : '—'}
                        </span>
                        <span style={{ color: overdue ? '#ef4444' : '#8b949e', fontSize: 10 }}>
                          {l.nextActionDate ? l.nextActionDate.slice(5) : '—'}
                        </span>
                      </div>
                    );
                  })}
                  {pipelineData.length === 0 && (
                    <div style={{ padding: 16, textAlign: 'center', color: '#8b949e', fontSize: 12 }}>진행 중인 기회가 없습니다</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FunnelShape({ stages, maxCount }: { stages: { stage: LeadStage; count: number; value: number }[]; maxCount: number }) {
  const W = 260; const H_PER = 34; const PAD = 20;
  const totalH = stages.length * H_PER;
  const maxW = W - PAD * 2;
  const minW = 14;

  return (
    <svg viewBox={`0 0 ${W} ${totalH}`} style={{ width: '100%', maxWidth: W, height: totalH, display: 'block', margin: '0 auto' }}>
      {stages.map((d, i) => {
        const topW = maxCount > 0 ? Math.max(minW, (d.count / maxCount) * maxW) : minW;
        const nextCount = stages[i + 1]?.count ?? 0;
        const botW = maxCount > 0 ? Math.max(minW, (nextCount / maxCount) * maxW) : minW;
        const cx = W / 2;
        const y = i * H_PER;
        const color = LEAD_STAGE_COLOR[d.stage];
        const pts = `${cx - topW/2},${y} ${cx + topW/2},${y} ${cx + botW/2},${y + H_PER - 2} ${cx - botW/2},${y + H_PER - 2}`;
        const conv = i > 0 && stages[i-1].count > 0 ? Math.round(d.count / stages[i-1].count * 100) : null;
        return (
          <g key={d.stage}>
            <polygon points={pts} fill={color} opacity={0.85} />
            <text x={cx} y={y + H_PER / 2 + 4} textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">
              {LEAD_STAGE_KO[d.stage]}  {d.count}건
            </text>
            {conv !== null && (
              <text x={cx + topW/2 + 6} y={y + 10} fontSize="8" fill={conv < 50 ? '#f59e0b' : '#94a3b8'}>↓{conv}%</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ── File Upload Content ── */
function fileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) return '📦';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return '📊';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  return '📎';
}

function fmtSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)}MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)}KB`;
  return `${bytes}B`;
}

async function downloadFile(file: FileItem) {
  // Prefer cloud URL when available
  let href = file.url ?? file.data;
  if (!href) href = (await loadFile(file.id)) ?? '';
  if (!href) return;
  const a = document.createElement('a');
  a.href = href;
  a.download = file.name;
  a.target = file.url ? '_blank' : '_self';
  a.click();
}

function FileUploadContent({
  data,
  onChange,
}: {
  data: FileUploadData;
  onChange: (d: Partial<FileUploadData>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;

    const room = roomBridge.current;
    const useCloud = SUPABASE_CONFIGURED && !!room;

    const newFiles: FileItem[] = [];
    for (const file of files) {
      try {
        if (useCloud) {
          const result = await uploadFileToCloud(file, room!);
          newFiles.push({
            id: result.id,
            name: file.name,
            size: file.size,
            mimeType: file.type || 'application/octet-stream',
            data: '',
            url: result.url,
            storagePath: result.storagePath,
          });
        } else {
          // legacy IDB fallback
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });
          const id = Math.random().toString(36).slice(2);
          await saveFile(id, dataUrl);
          newFiles.push({
            id, name: file.name, size: file.size,
            mimeType: file.type || 'application/octet-stream', data: '',
          });
        }
      } catch (err) {
        console.error('upload failed:', file.name, err);
      }
    }
    if (newFiles.length) onChange({ files: [...data.files, ...newFiles] });
  };

  return (
    <div className="fileupload-card">
      <div className="fileupload-header">
        <span className="fileupload-icon">📁</span>
        <span className="fileupload-title">{data.title || '파일 보관함'}</span>
        <span className="fileupload-count">{data.files.length}개</span>
      </div>
      {data.files.length === 0 ? (
        <div
          className="fileupload-drop-hint"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
        >
          <div className="fileupload-drop-icon">📂</div>
          <div>클릭하여 파일 업로드</div>
        </div>
      ) : (
        <div className="fileupload-list">
          {data.files.slice(0, 5).map((f) => (
            <div key={f.id} className="fileupload-item">
              <span className="fileupload-item-icon">{fileIcon(f.mimeType)}</span>
              <span className="fileupload-item-name">{f.name}</span>
              <span className="fileupload-item-size">{fmtSize(f.size)}</span>
              <button
                className="fileupload-item-dl"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); downloadFile(f); }}
                title="다운로드"
              >
                ↓
              </button>
            </div>
          ))}
          {data.files.length > 5 && (
            <div className="fileupload-more">+{data.files.length - 5}개 더</div>
          )}
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleUpload}
      />
    </div>
  );
}

/* ── Directory Content ── */
const COL_TYPE_ICON: Record<string, string> = {
  text: 'T', email: '@', phone: '☎', select: '▾', url: '🔗', number: '#',
};

/* ── Column resize utilities (shared across table widgets) ── */
function useColWidths(initials: number[], mins?: number[]) {
  const [widths, setWidths] = useState([...initials]);
  const startResize = (idx: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = widths[idx];
    const min = mins?.[idx] ?? 30;
    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - x0) / (vpBridge.scale || 1);
      setWidths(prev => prev.map((v, i) => i === idx ? Math.max(min, Math.round(w0 + dx)) : v));
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  return { widths, startResize };
}

function ColResizer({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <span
      className="col-resizer"
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function DirectoryContent({
  data,
  onChange,
}: {
  data: DirectoryData;
  onChange: (d: Partial<DirectoryData>) => void;
}) {
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [editingHeader, setEditingHeader] = useState<string | null>(null); // colId

  const genId = () => Math.random().toString(36).slice(2, 10);

  const addRow = () => {
    const newRow = {
      id: genId(),
      cells: Object.fromEntries(data.columns.map((c) => [c.id, ''])),
    };
    onChange({ rows: [...data.rows, newRow] });
    setEditingCell({ rowId: newRow.id, colId: data.columns[0]?.id ?? '' });
  };

  const updateCell = (rowId: string, colId: string, value: string) => {
    onChange({
      rows: data.rows.map((r) =>
        r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r
      ),
    });
  };

  const updateColLabel = (colId: string, label: string) => {
    onChange({ columns: data.columns.map((c) => c.id === colId ? { ...c, label } : c) });
  };

  const deleteRow = (rowId: string) => {
    onChange({ rows: data.rows.filter((r) => r.id !== rowId) });
    if (editingCell?.rowId === rowId) setEditingCell(null);
  };

  const moveEdit = (rowId: string, colId: string, dir: 'next' | 'prev') => {
    const rowIdx = data.rows.findIndex((r) => r.id === rowId);
    const colIdx = data.columns.findIndex((c) => c.id === colId);
    if (dir === 'next') {
      if (colIdx < data.columns.length - 1) setEditingCell({ rowId, colId: data.columns[colIdx + 1].id });
      else if (rowIdx < data.rows.length - 1) setEditingCell({ rowId: data.rows[rowIdx + 1].id, colId: data.columns[0].id });
      else addRow();
    } else {
      if (colIdx > 0) setEditingCell({ rowId, colId: data.columns[colIdx - 1].id });
      else if (rowIdx > 0) setEditingCell({ rowId: data.rows[rowIdx - 1].id, colId: data.columns[data.columns.length - 1].id });
      else setEditingCell(null);
    }
  };

  return (
    <div className="directory-card">
      <div className="directory-header">
        <span className="directory-icon">👥</span>
        <span className="directory-title">{data.title || '인원 디렉토리'}</span>
        <span className="directory-count">{data.rows.length}명</span>
      </div>
      <div className="directory-table-wrap">
        <table className="directory-table">
          <thead>
            <tr>
              {data.columns.map((col) => (
                <th
                  key={col.id}
                  data-dir-cell="1"
                  style={{ width: col.width, minWidth: col.width, cursor: 'text' }}
                  onClick={(e) => { e.stopPropagation(); setEditingHeader(col.id); }}
                  title="클릭으로 컬럼명 수정"
                >
                  {editingHeader === col.id ? (
                    <input
                      autoFocus
                      className="dir-header-input"
                      value={col.label}
                      onMouseDown={(e) => e.stopPropagation()}
                      onChange={(e) => updateColLabel(col.id, e.target.value)}
                      onBlur={() => setEditingHeader(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') setEditingHeader(null);
                        if (e.key === 'Tab') { e.preventDefault(); setEditingHeader(null); }
                      }}
                    />
                  ) : (
                    <>
                      <span className="dir-col-type-icon">{COL_TYPE_ICON[col.type] ?? 'T'}</span>
                      {col.label}
                    </>
                  )}
                </th>
              ))}
              <th className="dir-del-col" data-dir-cell="1" />
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.id} className="directory-row">
                {data.columns.map((col) => {
                  const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id;
                  const value = row.cells[col.id] ?? '';
                  return (
                    <td
                      key={col.id}
                      data-dir-cell="1"
                      onClick={() => { if (!isEditing) setEditingCell({ rowId: row.id, colId: col.id }); }}
                    >
                      {isEditing ? (
                        col.type === 'select' ? (
                          <select
                            autoFocus
                            className="dir-cell-input"
                            value={value}
                            onMouseDown={(e) => e.stopPropagation()}
                            onChange={(e) => updateCell(row.id, col.id, e.target.value)}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setEditingCell(null);
                              if (e.key === 'Tab') { e.preventDefault(); moveEdit(row.id, col.id, e.shiftKey ? 'prev' : 'next'); }
                            }}
                          >
                            <option value="">—</option>
                            {(col.options ?? []).map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            autoFocus
                            className="dir-cell-input"
                            type={col.type === 'number' ? 'number' : col.type === 'email' ? 'email' : col.type === 'url' ? 'url' : col.type === 'phone' ? 'tel' : 'text'}
                            value={value}
                            onMouseDown={(e) => e.stopPropagation()}
                            onChange={(e) => updateCell(row.id, col.id, e.target.value)}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => {
                              if (e.key === 'Tab') { e.preventDefault(); moveEdit(row.id, col.id, e.shiftKey ? 'prev' : 'next'); }
                              if (e.key === 'Enter') moveEdit(row.id, col.id, 'next');
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                          />
                        )
                      ) : (
                        <div className="dir-cell-display">
                          {value ? (
                            col.type === 'select'
                              ? <span className="dir-select-badge">{value}</span>
                              : col.type === 'email'
                                ? <span className="dir-email">{value}</span>
                                : col.type === 'url'
                                  ? <span className="dir-url" title={value}>{value}</span>
                                  : <span>{value}</span>
                          ) : (
                            <span className="dir-cell-empty">—</span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="dir-del-col" data-dir-cell="1">
                  <button
                    className="dir-row-del"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); deleteRow(row.id); }}
                  >×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.rows.length === 0 && (
          <div
            className="directory-empty"
            data-dir-cell="1"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={addRow}
          >
            클릭하여 첫 번째 항목 추가
          </div>
        )}
      </div>
      <div
        className="directory-add-row"
        data-dir-cell="1"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={addRow}
      >
        + 행 추가
      </div>
    </div>
  );
}

/* ── Worklog Widget ── */
function WorklogContent({ data, onChange }: { data: WorklogData; onChange: (d: Partial<WorklogData>) => void }) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    if (e.nativeEvent.isComposing) return; // ignore IME composition Enter
    const text = input.trim();
    if (!text) return;
    e.preventDefault();
    const session = getCurrentSession();
    const entry = {
      id: uuidv4(),
      content: text,
      createdAt: Date.now(),
      userId: session?.userId ?? 'unknown',
      userName: session?.name ?? '알 수 없음',
    };
    onChange({ entries: [entry, ...data.entries] });
    setInput('');
  };

  return (
    <div className="worklog-widget">
      <div className="worklog-header">
        <span className="worklog-icon">📋</span>
        <span className="worklog-title">{data.title || '작업로그'}</span>
        <span className="worklog-count">{data.entries.length}건</span>
      </div>
      <div
        className="worklog-input-area"
        data-worklog-input="1"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          className="worklog-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="작업 내용 입력 후 Enter..."
        />
      </div>
    </div>
  );
}

/* ── Finance Widget ── */

function fmtFinAmt(n: number, currency = 'KRW'): string {
  if (currency === 'KRW') {
    if (n >= 100_000_000) return `₩${(n / 100_000_000).toFixed(1)}억`;
    if (n >= 10_000) return `₩${Math.round(n / 10_000).toLocaleString()}만`;
    return `₩${n.toLocaleString()}`;
  }
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

const INV_STATUS_CFG: Record<InvoiceStatus, { label: string; color: string }> = {
  paid:      { label: '수금',  color: '#22c55e' },
  pending:   { label: '미수금', color: '#f59e0b' },
  cancelled: { label: '취소',  color: '#64748b' },
  requested: { label: '요청',  color: '#6366f1' },
};

function InvStatusBadge({ status }: { status: InvoiceStatus }) {
  const { label, color } = INV_STATUS_CFG[status];
  return <span className="inv-status-badge" style={{ color, borderColor: color + '44', background: color + '18' }}>{label}</span>;
}

function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (!total) return <div className="finance-donut-empty">데이터 없음</div>;
  const cx = 50, cy = 50, R = 38, r = 24;
  let angle = -Math.PI / 2;
  const slices = data.filter(d => d.value > 0).map((d) => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const x1 = cx + R * Math.cos(angle), y1 = cy + R * Math.sin(angle);
    const x2 = cx + R * Math.cos(angle + sweep), y2 = cy + R * Math.sin(angle + sweep);
    const ix1 = cx + r * Math.cos(angle), iy1 = cy + r * Math.sin(angle);
    const ix2 = cx + r * Math.cos(angle + sweep), iy2 = cy + r * Math.sin(angle + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    const path = `M${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} L${ix2},${iy2} A${r},${r} 0 ${large} 0 ${ix1},${iy1} Z`;
    angle += sweep;
    return { ...d, path };
  });
  return (
    <svg viewBox="0 0 100 100" className="finance-donut-svg">
      {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} />)}
    </svg>
  );
}

function HBarChart({ data, fmt }: { data: { label: string; value: number; color?: string }[]; fmt: (n: number) => string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="finance-hbar">
      {data.map((d, i) => (
        <div key={i} className="finance-hbar-row">
          <div className="finance-hbar-label" title={d.label}>{d.label}</div>
          <div className="finance-hbar-track">
            <div className="finance-hbar-fill" style={{ width: `${(d.value / max) * 100}%`, background: d.color || '#6366f1' }} />
          </div>
          <div className="finance-hbar-val">{fmt(d.value)}</div>
        </div>
      ))}
    </div>
  );
}

function MonthlyBars({ data, fmt }: { data: { month: string; paid: number; pending: number; requested: number }[]; fmt: (n: number) => string }) {
  const BAR_H = 60;
  const LABEL_H = 14;
  const LINE_H = 50;
  const SVG_H = BAR_H + LABEL_H + LINE_H + 16;
  const max = Math.max(...data.map(d => d.paid + d.pending + d.requested), 1);
  const lineMax = Math.max(...data.map(d => d.paid + d.pending + d.requested), 1);
  const bw = Math.min(32, Math.max(16, 200 / (data.length || 1)));
  const gap = 8;
  const padL = 8;
  const W = data.length * (bw + gap) + padL * 2;

  // Bar center x positions
  const cx = (i: number) => padL + i * (bw + gap) + bw / 2;

  // Line chart y for total (paid+pending+requested)
  const lineY = (d: typeof data[0]) => {
    const total = d.paid + d.pending + d.requested;
    return BAR_H + LABEL_H + 8 + (1 - total / lineMax) * (LINE_H - 12);
  };

  const linePoints = data.map((d, i) => `${cx(i)},${lineY(d)}`).join(' ');

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${SVG_H}`} style={{ width: Math.min(W, 480), height: SVG_H, display: 'block' }}>
        {/* Stacked bars */}
        {data.map((d, i) => {
          const x = padL + i * (bw + gap);
          const rH  = (d.requested / max) * BAR_H;
          const peH = (d.pending   / max) * BAR_H;
          const pH  = (d.paid      / max) * BAR_H;
          const base = BAR_H;
          return (
            <g key={i}>
              <rect x={x} y={base - pH - peH - rH} width={bw} height={rH}  fill="#6366f1" rx={1} />
              <rect x={x} y={base - pH - peH}       width={bw} height={peH} fill="#f59e0b" rx={1} />
              <rect x={x} y={base - pH}             width={bw} height={pH}  fill="#22c55e" rx={1} />
              <text x={cx(i)} y={BAR_H + LABEL_H} textAnchor="middle" fontSize="7" fill="#8b949e">
                {d.month.slice(5)}
              </text>
            </g>
          );
        })}

        {/* Divider */}
        <line x1={0} y1={BAR_H + LABEL_H + 6} x2={W} y2={BAR_H + LABEL_H + 6} stroke="var(--border,#334155)" strokeWidth="0.5" />

        {/* Line chart — cumulative total */}
        {data.length > 1 && (
          <polyline
            points={linePoints}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        )}
        {data.map((d, i) => (
          <circle key={i} cx={cx(i)} cy={lineY(d)} r="2.5" fill="#6366f1" />
        ))}

        {/* Line label */}
        <text x={4} y={BAR_H + LABEL_H + 16} fontSize="6.5" fill="#8b949e">누적</text>
      </svg>
    </div>
  );
}

type FinTab = 'overview' | 'client' | 'monthly' | 'list';
type SortKey = 'client' | 'date' | 'amount' | 'status';

const STATUS_ORDER: Record<InvoiceStatus, number> = { requested: 0, pending: 1, paid: 2, cancelled: 3 };

function ListTab({ invoices, fmt }: { invoices: InvoiceEntry[]; fmt: (n: number) => string }) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'date' || key === 'amount' ? 'desc' : 'asc'); }
  };

  const sorted = useMemo(() => {
    return [...invoices].sort((a, b) => {
      let v = 0;
      if (sortKey === 'client')  v = a.client.localeCompare(b.client);
      if (sortKey === 'date')    v = (a.date || '').localeCompare(b.date || '');
      if (sortKey === 'amount')  v = a.amount - b.amount;
      if (sortKey === 'status')  v = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      return sortDir === 'asc' ? v : -v;
    });
  }, [invoices, sortKey, sortDir]);

  const arrow = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <div className="finance-list-tab">
      <div className="finance-list-thead">
        {(['client', 'date', 'amount', 'status'] as SortKey[]).map((key) => {
          const labels: Record<SortKey, string> = { client: '고객사', date: '날짜', amount: '금액', status: '상태' };
          return (
            <span
              key={key}
              className="finance-list-sort-btn"
              onClick={(e) => { e.stopPropagation(); handleSort(key); }}
            >
              {labels[key]}{arrow(key)}
            </span>
          );
        })}
      </div>
      {sorted.map(inv => (
        <div key={inv.id} className="finance-list-row">
          <span className="finance-list-client" title={inv.client}>{inv.client}</span>
          <span className="finance-list-date">{inv.date || '-'}</span>
          <span className="finance-list-amt">{fmt(inv.amount)}</span>
          <InvStatusBadge status={inv.status} />
        </div>
      ))}
    </div>
  );
}

function fmtDual(n: number, currency: string, exchangeRate: number): [string, string | null] {
  const primary = fmtFinAmt(n, currency);
  if (!exchangeRate) return [primary, null];
  if (currency === 'USD') {
    const krw = n * exchangeRate;
    const sec = krw >= 100_000_000
      ? `₩${(krw / 100_000_000).toFixed(1)}억`
      : krw >= 10_000
        ? `₩${Math.round(krw / 10_000).toLocaleString()}만`
        : `₩${Math.round(krw).toLocaleString()}`;
    return [primary, sec];
  }
  if (currency === 'KRW') {
    const usd = n / exchangeRate;
    return [primary, `$${usd.toFixed(0)}`];
  }
  return [primary, null];
}

function KpiCard({ label, primary, secondary, className }: { label: string; primary: string; secondary?: string | null; className?: string }) {
  return (
    <div className={`finance-kpi${className ? ' ' + className : ''}`}>
      <div className="finance-kpi-label">{label}</div>
      <div className="finance-kpi-val">{primary}</div>
      {secondary && <div className="finance-kpi-sub">{secondary}</div>}
    </div>
  );
}

function FinanceContent({ data }: { data: FinanceData }) {
  const [tab, setTab] = useState<FinTab>('overview');
  const { invoices } = data;
  const exchangeRate = data.exchangeRate ?? 1450;

  // All hooks must be called before any early return (Rules of Hooks)
  const byClient = useMemo(() => {
    if (!invoices.length) return [];
    const map: Record<string, { paid: number; pending: number; requested: number; total: number; count: number }> = {};
    invoices.forEach(inv => {
      if (!map[inv.client]) map[inv.client] = { paid: 0, pending: 0, requested: 0, total: 0, count: 0 };
      if (inv.status !== 'cancelled') {
        (map[inv.client] as Record<string, number>)[inv.status] += inv.amount;
        map[inv.client].total += inv.amount;
      }
      map[inv.client].count++;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [invoices]);

  const byMonth = useMemo(() => {
    if (!invoices.length) return [];
    const map: Record<string, { paid: number; pending: number; requested: number }> = {};
    invoices.filter(i => i.status !== 'cancelled').forEach(inv => {
      const m = inv.date.slice(0, 7);
      if (!m || m.length < 7) return;
      if (!map[m]) map[m] = { paid: 0, pending: 0, requested: 0 };
      if (inv.status === 'paid') map[m].paid += inv.amount;
      else if (inv.status === 'requested') map[m].requested += inv.amount;
      else map[m].pending += inv.amount;
    });
    return Object.entries(map).sort().map(([month, v]) => ({ month, ...v }));
  }, [invoices]);

  const currency = invoices[0]?.currency || 'KRW';
  const fmt = (n: number) => fmtFinAmt(n, currency);
  const fmtD = (n: number) => fmtDual(n, currency, exchangeRate);

  if (!invoices.length) {
    return (
      <div className="finance-empty">
        <div style={{ fontSize: 28 }}>💰</div>
        <div style={{ fontWeight: 600, marginTop: 8 }}>{data.title || '재무 현황'}</div>
        <div style={{ fontSize: 12, color: '#8b949e', marginTop: 4 }}>인스펙터에서 MD 인보이스 파일을 업로드하세요</div>
      </div>
    );
  }

  const paid      = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.amount, 0);
  const pending   = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0);
  const requested = invoices.filter(i => i.status === 'requested').reduce((s, i) => s + i.amount, 0);
  const total     = paid + pending + requested;
  const collectRate = total > 0 ? Math.round((paid / total) * 100) : 0;

  const donutData = [
    { label: '수금',  value: paid,      color: '#22c55e' },
    { label: '미수금', value: pending,   color: '#f59e0b' },
    { label: '요청',  value: requested, color: '#6366f1' },
  ];

  return (
    <div className="finance-card">
      {/* KPI */}
      <div className="finance-kpi-row">
        <KpiCard label="총 청구" primary={fmtD(total)[0]}     secondary={fmtD(total)[1]} />
        <KpiCard label="수금"    primary={fmtD(paid)[0]}      secondary={fmtD(paid)[1]}    className="finance-kpi-paid" />
        <KpiCard label="미수금"  primary={fmtD(pending)[0]}   secondary={fmtD(pending)[1]} className="finance-kpi-pending" />
        <KpiCard label="요청"    primary={fmtD(requested)[0]} secondary={fmtD(requested)[1]} className="finance-kpi-requested" />
      </div>

      {/* Tabs */}
      <div className="finance-tabs">
        {(['overview', 'client', 'monthly', 'list'] as FinTab[]).map((t) => {
          const labels: Record<FinTab, string> = { overview: '개요', client: '고객사별', monthly: '월별', list: '목록' };
          return (
            <button
              key={t}
              className={`finance-tab${tab === t ? ' active' : ''}`}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); setTab(t); }}
            >{labels[t]}</button>
          );
        })}
        <div className="finance-collect-rate">수금률 <strong>{collectRate}%</strong></div>
      </div>

      <div className="finance-body">
        {/* 개요 */}
        {tab === 'overview' && (
          <div className="finance-overview">
            <DonutChart data={donutData} />
            <div className="finance-overview-right">
              {donutData.filter(d => d.value > 0).map(d => {
                const [p, s] = fmtD(d.value);
                return (
                  <div key={d.label} className="finance-legend-row">
                    <span className="finance-legend-dot" style={{ background: d.color }} />
                    <span className="finance-legend-label">{d.label}</span>
                    <span className="finance-legend-amt">
                      {p}{s && <span className="finance-legend-sub">{s}</span>}
                    </span>
                  </div>
                );
              })}
              <div className="finance-legend-divider" />
              <div className="finance-legend-row" style={{ fontSize: 11, color: '#8b949e' }}>
                <span>총 인보이스</span>
                <span style={{ marginLeft: 'auto' }}>{invoices.length}건</span>
              </div>
              <div className="finance-legend-row" style={{ fontSize: 11, color: '#8b949e' }}>
                <span>고객사</span>
                <span style={{ marginLeft: 'auto' }}>{byClient.length}곳</span>
              </div>
            </div>
          </div>
        )}

        {/* 고객사별 */}
        {tab === 'client' && (
          <div className="finance-client-tab">
            <HBarChart
              data={byClient.slice(0, 8).map(([label, v]) => ({ label, value: v.total }))}
              fmt={fmt}
            />
            <div className="finance-client-table">
              <div className="finance-client-thead">
                <span>고객사</span><span>수금</span><span>미수금</span><span>요청</span><span>건</span>
              </div>
              {byClient.map(([name, v]) => (
                <div key={name} className="finance-client-row">
                  <span className="finance-client-name" title={name}>{name}</span>
                  <span style={{ color: '#22c55e' }}>{v.paid ? fmt(v.paid) : '-'}</span>
                  <span style={{ color: '#f59e0b' }}>{v.pending ? fmt(v.pending) : '-'}</span>
                  <span style={{ color: '#6366f1' }}>{v.requested ? fmt(v.requested) : '-'}</span>
                  <span style={{ color: '#8b949e' }}>{v.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 월별 */}
        {tab === 'monthly' && (
          <div className="finance-monthly-tab">
            {byMonth.length > 0 ? (
              <>
                <MonthlyBars data={byMonth} fmt={fmt} />
                <div className="finance-monthly-legend">
                  <span><span className="finance-legend-dot" style={{ background: '#22c55e' }} />수금</span>
                  <span><span className="finance-legend-dot" style={{ background: '#f59e0b' }} />미수금</span>
                  <span><span className="finance-legend-dot" style={{ background: '#6366f1' }} />요청</span>
                </div>
                <div className="finance-monthly-table">
                  <div className="finance-monthly-row finance-monthly-thead">
                    <span>월</span>
                    <span style={{ color: '#22c55e' }}>수금</span>
                    <span style={{ color: '#f59e0b' }}>미수금</span>
                    <span style={{ color: '#6366f1' }}>요청</span>
                  </div>
                  {byMonth.map(d => (
                    <div key={d.month} className="finance-monthly-row">
                      <span className="finance-monthly-label">{d.month}</span>
                      <span style={{ color: '#22c55e' }}>{d.paid ? fmt(d.paid) : '-'}</span>
                      <span style={{ color: '#f59e0b' }}>{d.pending ? fmt(d.pending) : '-'}</span>
                      <span style={{ color: '#6366f1' }}>{d.requested ? fmt(d.requested) : '-'}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : <div className="finance-empty-msg">날짜 데이터가 없습니다</div>}
          </div>
        )}

        {/* 목록 */}
        {tab === 'list' && (
          <ListTab invoices={invoices} fmt={fmt} />
        )}
      </div>
    </div>
  );
}

/* ── Calendar Widget ── */
const CAL_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#8b5cf6', '#f97316'];

function CalendarContent({ data, onChange }: { data: CalendarData; onChange: (d: Partial<CalendarData>) => void }) {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    (data.events ?? []).forEach((ev) => {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    });
    return map;
  }, [data.events]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const dayLabel = ['일', '월', '화', '수', '목', '금', '토'];
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="cal-widget">
      <div className="cal-header">
        <button className="cal-nav" onClick={prevMonth}>‹</button>
        <span className="cal-title">{year}년 {month + 1}월</span>
        <button className="cal-nav" onClick={nextMonth}>›</button>
      </div>
      <div className="cal-grid">
        {dayLabel.map((d, i) => (
          <div key={d} className={`cal-dayname${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`}>{d}</div>
        ))}
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="cal-cell empty" />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const evs = eventsByDate[dateStr] ?? [];
          const isToday = dateStr === todayStr;
          const dow = (firstDay + day - 1) % 7;
          return (
            <div
              key={day}
              className={`cal-cell${isToday ? ' today' : ''}${dow === 0 ? ' sun' : dow === 6 ? ' sat' : ''}`}
            >
              <span className="cal-day-num">{day}</span>
              <div className="cal-dots">
                {evs.slice(0, 3).map((ev) => (
                  <span key={ev.id} className="cal-dot" style={{ background: ev.color }} title={ev.title} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Embed Widget ── */

// Convert common URLs to embeddable versions
function toEmbedUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    const h = url.hostname;

    // YouTube
    if (h.includes('youtube.com') || h.includes('youtu.be')) {
      let vid = url.searchParams.get('v');
      if (!vid) vid = url.pathname.split('/').pop() ?? '';
      if (vid) return `https://www.youtube.com/embed/${vid}?autoplay=0`;
    }

    // Figma
    if (h.includes('figma.com')) {
      return `https://www.figma.com/embed?embed_host=chaospm&url=${encodeURIComponent(raw)}`;
    }

    // Google Docs / Sheets / Slides
    if (h.includes('docs.google.com')) {
      return raw.replace(/\/(edit|view|pub)(\?.*)?$/, '/preview');
    }

    return raw;
  } catch {
    return raw;
  }
}

function EmbedContent({ data }: { data: EmbedData }) {
  const embedUrl = data.url ? toEmbedUrl(data.url) : '';

  if (!data.url) {
    return (
      <div className="embed-empty">
        <div style={{ fontSize: 28 }}>🔲</div>
        <div style={{ fontWeight: 600, marginTop: 8 }}>임베드</div>
        <div style={{ fontSize: 12, color: '#8b949e', marginTop: 4 }}>
          인스펙터에서 URL을 입력하세요
        </div>
      </div>
    );
  }

  return (
    <div className="embed-frame">
      <iframe
        src={embedUrl}
        title={data.title || '임베드'}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        style={{ width: '100%', flex: '1 1 auto', border: 'none', display: 'block', minHeight: 0 }}
      />
      <a
        className="embed-open-btn"
        href={data.url}
        target="_blank"
        rel="noopener noreferrer"
        title="새 탭에서 열기"
        onMouseDown={(e) => e.stopPropagation()}
      >
        ↗
      </a>
    </div>
  );
}
