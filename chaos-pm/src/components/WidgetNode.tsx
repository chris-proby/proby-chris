import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { saveFile, loadFile } from '../fileStorage';
import { vpBridge, keyBridge } from '../viewportBridge';
import { getCurrentSession } from '../auth';
import { v4 as uuidv4 } from 'uuid';
import type { Widget, PortSide, TaskData, NoteData, LinkData, ImageData, GroupData, GoalData, GoalStatus, LeadData, LeadStage, FunnelData, TextboxData, HtmlData, FileUploadData, FileItem, DirectoryData, DirectoryColumn, WorklogData } from '../types';

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
    if (!isGroup) bringToFront(widget.id);

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
        // Use cached el — no querySelector per frame
        multiStart.forEach((sp) => {
          if (sp.el) sp.el.style.transform = `translate(${dx}px,${dy}px)`;
        });
        if (!isGroup) {
          const state = useStore.getState();
          const targetId = findGroupForWidget({ ...widget, x: startPos.x + dx, y: startPos.y + dy }, state.widgets) ?? null;
          if (targetId !== state.dropTargetGroupId) setDropTargetGroupId(targetId);
        }
      } else {
        if (nodeRef.current) nodeRef.current.style.transform = `translate(${dx}px,${dy}px)`;
        // Use cached el — no querySelector per frame
        if (childStart) {
          childStart.forEach((cp) => {
            if (cp.el) cp.el.style.transform = `translate(${dx}px,${dy}px)`;
          });
        }
        // Skip findGroupForWidget during group drag (O(n) per frame) — still runs on mouseup
        if (!isGroup) {
          const state = useStore.getState();
          const targetId = findGroupForWidget({ ...widget, x: startPos.x + dx, y: startPos.y + dy }, state.widgets) ?? null;
          if (targetId !== state.dropTargetGroupId) setDropTargetGroupId(targetId);
        }
      }
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      const dx = lastDx, dy = lastDy;

      if (multiStart) {
        multiStart.forEach((sp) => {
          if (sp.el) { sp.el.style.transform = ''; sp.el.style.left = (sp.x + dx) + 'px'; sp.el.style.top = (sp.y + dy) + 'px'; }
          updateWidget(sp.id, { x: sp.x + dx, y: sp.y + dy });
        });
        const state = useStore.getState();
        multiStart.forEach((sp) => {
          const w = state.widgets.find((x) => x.id === sp.id);
          if (!w) return;
          const targetGroupId = findGroupForWidget(w, state.widgets);
          if (targetGroupId !== w.groupId) {
            useStore.getState().setWidgetGroup(sp.id, targetGroupId);
          }
        });
      } else {
        const newX = startPos.x + dx;
        const newY = startPos.y + dy;
        if (nodeRef.current) {
          nodeRef.current.style.transform = '';
          nodeRef.current.style.left = newX + 'px';
          nodeRef.current.style.top = newY + 'px';
        }
        updateWidget(widget.id, { x: newX, y: newY });
        if (childStart) {
          childStart.forEach((cp) => {
            if (cp.el) { cp.el.style.transform = ''; cp.el.style.left = (cp.x + dx) + 'px'; cp.el.style.top = (cp.y + dy) + 'px'; }
            updateWidget(cp.id, { x: cp.x + dx, y: cp.y + dy });
          });
        }
        {
          const state = useStore.getState();
          const targetGroupId = findGroupForWidget({ ...widget, x: newX, y: newY }, state.widgets);
          const prevGroupId = state.widgets.find((w) => w.id === widget.id)?.groupId;
          if (targetGroupId !== prevGroupId) {
            const targetGroup = targetGroupId
              ? state.widgets.find((w) => w.id === targetGroupId)
              : state.widgets.find((w) => w.id === prevGroupId);
            const groupName = (targetGroup?.data as GroupData)?.title || '그룹';
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
    setPendingConnection({ fromId: widget.id, fromPort: port, toX: e.clientX, toY: e.clientY });
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
    if (isGroup) { e.stopPropagation(); toggleGroupCollapse(widget.id); return; }
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
        overflow: widget.userResized ? 'hidden' : undefined,
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

      <WidgetContent
        widget={widget}
        isTextboxEditing={isTextboxEditing}
        onTextboxEditEnd={() => setIsTextboxEditing(false)}
      />
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

    const startMouse = { x: e.clientX, y: e.clientY };
    const start = { x: widget.x, y: widget.y, w: widget.width, h: widget.height };

    const onMove = (ev: MouseEvent) => {
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

function FunnelContent({ data }: { data: FunnelData }) {
  const [tab, setTab] = useState<'stage' | 'source'>('stage');
  const widgets = useStore((s) => s.widgets);
  const allLeads = useMemo(
    () => widgets.filter((w) => w.type === 'lead').map((w) => w.data as LeadData),
    [widgets]
  );

  const stageRows = FUNNEL_STAGES.map((stage) => {
    const items = allLeads.filter((l) => l.stage === stage);
    const totalVal = items.reduce((sum, l) => sum + (l.value || 0), 0);
    const currencies = [...new Set(items.map((l) => l.currency || 'KRW'))];
    return { stage, count: items.length, value: totalVal, currency: currencies[0] ?? 'KRW' };
  });
  const lostCount = allLeads.filter((l) => l.stage === 'lost').length;
  const maxStageCount = Math.max(...stageRows.map((r) => r.count), 1);
  const totalLeads = allLeads.length;
  const wonRow = stageRows.find((r) => r.stage === 'won')!;
  const prospectRow = stageRows.find((r) => r.stage === 'prospect')!;
  const convRate = prospectRow.count > 0 ? Math.round((wonRow.count / prospectRow.count) * 100) : 0;
  const totalActiveValue = stageRows.reduce((s, r) => s + r.value, 0);
  const displayCurrency = allLeads[0]?.currency ?? 'KRW';

  const sourceRows = useMemo(() => {
    const map = new Map<string, { count: number; value: number; currency: string }>();
    allLeads.forEach((l) => {
      const src = l.source?.trim() || '미입력';
      const existing = map.get(src) ?? { count: 0, value: 0, currency: l.currency || 'KRW' };
      map.set(src, { count: existing.count + 1, value: existing.value + (l.value || 0), currency: existing.currency });
    });
    return [...map.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([source, stats], i) => ({ source, ...stats, color: SOURCE_COLORS[i % SOURCE_COLORS.length] }));
  }, [allLeads]);

  const maxSourceCount = Math.max(...sourceRows.map((r) => r.count), 1);

  return (
    <div className="funnel-card">
      <div className="funnel-header">
        <span className="funnel-title-text">{data.title || '세일즈 퍼널'}</span>
        <span className="funnel-total-badge">{totalLeads}개 리드</span>
      </div>

      {totalLeads === 0 ? (
        <div className="funnel-empty">
          <div>💼 리드 위젯을 추가하면</div>
          <div>여기에 자동으로 집계됩니다</div>
        </div>
      ) : (
        <>
          <div className="funnel-tabs">
            <button
              className={`funnel-tab${tab === 'stage' ? ' active' : ''}`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setTab('stage'); }}
            >
              스테이지
            </button>
            <button
              className={`funnel-tab${tab === 'source' ? ' active' : ''}`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setTab('source'); }}
            >
              소스별
            </button>
          </div>

          {tab === 'stage' ? (
            <div className="funnel-stages">
              {stageRows.map(({ stage, count, value, currency }, i) => {
                const pct = Math.max(count > 0 ? 8 : 0, (count / maxStageCount) * 100);
                const color = LEAD_STAGE_COLOR[stage];
                const convFromPrev = i > 0 && stageRows[i - 1].count > 0
                  ? Math.round((count / stageRows[i - 1].count) * 100)
                  : null;
                return (
                  <div key={stage} className="funnel-row">
                    <div className="funnel-row-label">{LEAD_STAGE_KO[stage]}</div>
                    <div className="funnel-bar-track">
                      <div className="funnel-bar-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <div className="funnel-row-stats">
                      <span className="funnel-count" style={{ color }}>{count}</span>
                      {value > 0 && <span className="funnel-value">{fmtValue(value, currency)}</span>}
                    </div>
                    {convFromPrev !== null && count > 0 && (
                      <div className="funnel-conv-arrow">↓{convFromPrev}%</div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="funnel-stages">
              {sourceRows.map(({ source, count, value, currency, color }) => {
                const pct = Math.max(8, (count / maxSourceCount) * 100);
                return (
                  <div key={source} className="funnel-row">
                    <div className="funnel-row-label funnel-source-label" title={source}>{source}</div>
                    <div className="funnel-bar-track">
                      <div className="funnel-bar-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <div className="funnel-row-stats">
                      <span className="funnel-count" style={{ color }}>{count}</span>
                      {value > 0 && <span className="funnel-value">{fmtValue(value, currency)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="funnel-footer">
        <div className="funnel-footer-stat">
          <span className="funnel-footer-label">잠재→성사</span>
          <span className="funnel-footer-val">{convRate}%</span>
        </div>
        {totalActiveValue > 0 && (
          <div className="funnel-footer-stat">
            <span className="funnel-footer-label">파이프라인</span>
            <span className="funnel-footer-val">{fmtValue(totalActiveValue, displayCurrency)}</span>
          </div>
        )}
        {lostCount > 0 && (
          <div className="funnel-footer-stat lost">
            <span className="funnel-footer-label">손실</span>
            <span className="funnel-footer-val">{lostCount}개</span>
          </div>
        )}
      </div>
    </div>
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
  let dataUrl = file.data;
  if (!dataUrl) dataUrl = await loadFile(file.id) ?? '';
  if (!dataUrl) return;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = file.name;
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

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    let pending = files.length;
    const newFiles: FileItem[] = [];
    if (!pending) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const id = Math.random().toString(36).slice(2);
        const dataUrl = reader.result as string;
        saveFile(id, dataUrl);
        newFiles.push({
          id,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          data: '',
        });
        pending--;
        if (pending === 0) onChange({ files: [...data.files, ...newFiles] });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
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

function DirectoryContent({
  data,
  onChange,
}: {
  data: DirectoryData;
  onChange: (d: Partial<DirectoryData>) => void;
}) {
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);

  const genId = () => Math.random().toString(36).slice(2, 10);

  const addRow = (e: React.MouseEvent) => {
    e.stopPropagation();
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

  const deleteRow = (rowId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ rows: data.rows.filter((r) => r.id !== rowId) });
  };

  const moveEdit = (rowId: string, colId: string, dir: 'next' | 'prev') => {
    const rowIdx = data.rows.findIndex((r) => r.id === rowId);
    const colIdx = data.columns.findIndex((c) => c.id === colId);
    if (dir === 'next') {
      if (colIdx < data.columns.length - 1) {
        setEditingCell({ rowId, colId: data.columns[colIdx + 1].id });
      } else if (rowIdx < data.rows.length - 1) {
        setEditingCell({ rowId: data.rows[rowIdx + 1].id, colId: data.columns[0].id });
      } else {
        setEditingCell(null);
      }
    } else {
      if (colIdx > 0) {
        setEditingCell({ rowId, colId: data.columns[colIdx - 1].id });
      } else if (rowIdx > 0) {
        setEditingCell({ rowId: data.rows[rowIdx - 1].id, colId: data.columns[data.columns.length - 1].id });
      } else {
        setEditingCell(null);
      }
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
                <th key={col.id} style={{ width: col.width, minWidth: col.width }}>
                  <span className="dir-col-type-icon">{COL_TYPE_ICON[col.type] ?? 'T'}</span>
                  {col.label}
                </th>
              ))}
              <th className="dir-del-col" />
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.id} className="directory-row">
                {data.columns.map((col) => {
                  const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id;
                  const value = row.cells[col.id] ?? '';
                  return (
                    <td key={col.id} data-dir-cell="1">
                      {isEditing ? (
                        col.type === 'select' ? (
                          <select
                            autoFocus
                            className="dir-cell-input"
                            value={value}
                            onMouseDown={(e) => e.stopPropagation()}
                            onChange={(e) => updateCell(row.id, col.id, e.target.value)}
                            onBlur={() => setEditingCell(null)}
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
                            type={col.type === 'number' ? 'number' : 'text'}
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
                        <div
                          className="dir-cell-display"
                          onClick={() => setEditingCell({ rowId: row.id, colId: col.id })}
                        >
                          {value ? (
                            col.type === 'select'
                              ? <span className="dir-select-badge">{value}</span>
                              : col.type === 'email'
                                ? <span className="dir-email">{value}</span>
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
                    onClick={(e) => deleteRow(row.id, e)}
                  >×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.rows.length === 0 && (
          <div className="directory-empty" data-dir-cell="1" onClick={addRow}>
            클릭하여 첫 번째 항목 추가
          </div>
        )}
      </div>
      <div className="directory-add-row" data-dir-cell="1" onMouseDown={(e) => e.stopPropagation()} onClick={addRow}>
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
