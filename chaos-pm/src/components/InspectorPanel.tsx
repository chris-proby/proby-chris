import { useRef, useMemo, useState, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { useStore } from '../store';
import { saveFile, loadFile } from '../fileStorage';
import type { TaskData, NoteData, LinkData, ImageData, GroupData, GoalData, GoalStatus, KeyResult, LeadData, LeadStage, FunnelData, TextboxData, HtmlData, FileUploadData, FileItem, Attachment, ConnectionType, DirectoryData, DirectoryColumn, DirectoryColumnType, WorklogData, WorklogEntry } from '../types';

const NOTE_COLORS = ['#fef9c3', '#dbeafe', '#dcfce7', '#fce7f3', '#ede9fe', '#ffedd5'];

export default function InspectorPanel() {
  const selectedWidgetId = useStore((s) => s.selectedWidgetId);
  const selectedConnectionId = useStore((s) => s.selectedConnectionId);
  const widgets = useStore((s) => s.widgets);
  const connections = useStore((s) => s.connections);
  const updateWidgetData = useStore((s) => s.updateWidgetData);
  const deleteWidget = useStore((s) => s.deleteWidget);
  const deleteConnection = useStore((s) => s.deleteConnection);
  const updateConnection = useStore((s) => s.updateConnection);
  const setSelectedWidget = useStore((s) => s.setSelectedWidget);
  const setSelectedConnection = useStore((s) => s.setSelectedConnection);
  const ungroupWidget = useStore((s) => s.ungroupWidget);
  const toggleGroupCollapse = useStore((s) => s.toggleGroupCollapse);

  if (selectedConnectionId) {
    const conn = connections.find((c) => c.id === selectedConnectionId);
    if (!conn) return null;
    const from = widgets.find((w) => w.id === conn.fromId);
    const to = widgets.find((w) => w.id === conn.toId);
    const isGoalToGoal = from?.type === 'goal' && to?.type === 'goal';

    const getTitle = (w: typeof from) => {
      if (!w) return '알 수 없음';
      const d = w.data as TaskData & NoteData & LinkData;
      return d.title || d.content?.slice(0, 20) || TYPE_LABELS[w.type];
    };

    return (
      <aside className="inspector">
        <div className="inspector-header">
          <div className="inspector-title">↗ 연결선</div>
          <button className="inspector-close" onClick={() => setSelectedConnection(null)}>×</button>
        </div>
        <div className="inspector-body">
          <div className="conn-widgets">
            <div className="conn-widget-chip">{getTitle(from)}</div>
            <span className="conn-arrow">→</span>
            <div className="conn-widget-chip">{getTitle(to)}</div>
          </div>
          {isGoalToGoal && (
            <div className="field">
              <div className="field-label">목표 관계</div>
              <button
                className={`conn-goal-parent-btn${conn.type === 'goal-parent' ? ' active' : ''}`}
                onClick={() => updateConnection(conn.id, {
                  type: conn.type === 'goal-parent' ? 'relates-to' : 'goal-parent',
                })}
              >
                <span className="conn-goal-parent-icon">🎯</span>
                <span className="conn-goal-parent-text">
                  {conn.type === 'goal-parent'
                    ? `"${getTitle(from)}" 이 상위 목표 · 진행률 자동 계산 중`
                    : '상위→하위 목표 관계로 설정 (진행률 자동 계산)'}
                </span>
                {conn.type === 'goal-parent' && <span className="conn-goal-parent-on">ON</span>}
              </button>
              {conn.type === 'goal-parent' && (
                <div className="conn-goal-hint">
                  상위 목표 "{getTitle(from)}"의 진행률이 하위 목표들의 평균으로 자동 계산됩니다.
                </div>
              )}
            </div>
          )}
          <div className="field">
            <div className="field-label">{isGoalToGoal ? '기타 관계' : '관계 유형'}</div>
            <div className="seg-group">
              {(['relates-to', 'blocks', 'depends-on'] as ConnectionType[]).map((t) => (
                <button
                  key={t}
                  className={`seg-btn${conn.type === t ? ' active' : ''}`}
                  onClick={() => updateConnection(conn.id, { type: t })}
                >
                  {t === 'relates-to' ? '관련' : t === 'blocks' ? '차단' : '의존'}
                </button>
              ))}
            </div>
          </div>
          {conn.type !== 'goal-parent' && (
            <div className="field">
              <div className="field-label">라벨</div>
              <input
                value={conn.label}
                placeholder="라벨 추가..."
                onChange={(e) => updateConnection(conn.id, { label: e.target.value })}
              />
            </div>
          )}
        </div>
        <div className="inspector-footer">
          <button className="btn-danger" onClick={() => deleteConnection(conn.id)}>
            🗑 연결선 삭제
          </button>
        </div>
      </aside>
    );
  }

  const widget = widgets.find((w) => w.id === selectedWidgetId);
  if (!widget) return null;

  return (
    <aside className="inspector">
      <div className="inspector-header">
        <div className="inspector-title">
          <span>{TYPE_ICONS[widget.type]}</span>
          {TYPE_LABELS[widget.type]}
        </div>
        <button className="inspector-close" onClick={() => setSelectedWidget(null)}>×</button>
      </div>
      <div className="inspector-body">
        {widget.type === 'group' && (
          <GroupInspector
            widgetId={widget.id}
            data={widget.data as GroupData}
            onChange={(d) => updateWidgetData(widget.id, d)}
            onUngroup={() => ungroupWidget(widget.id)}
            onToggleCollapse={() => toggleGroupCollapse(widget.id)}
          />
        )}
        {widget.type === 'task' && (
          <TaskInspector
            data={widget.data as TaskData}
            onChange={(d) => updateWidgetData(widget.id, d)}
          />
        )}
        {widget.type === 'note' && (
          <NoteInspector
            data={widget.data as NoteData}
            onChange={(d) => updateWidgetData(widget.id, d)}
          />
        )}
        {widget.type === 'link' && (
          <LinkInspector
            data={widget.data as LinkData}
            onChange={(d) => updateWidgetData(widget.id, d)}
          />
        )}
        {widget.type === 'image' && (
          <ImageInspector
            data={widget.data as ImageData}
            onChange={(d) => updateWidgetData(widget.id, d)}
          />
        )}
        {widget.type === 'goal' && (
          <GoalInspector
            widgetId={widget.id}
            data={widget.data as GoalData}
            onChange={(d) => updateWidgetData(widget.id, d)}
          />
        )}
        {widget.type === 'lead' && (
          <LeadInspector
            data={widget.data as LeadData}
            onChange={(d) => updateWidgetData(widget.id, d)}
          />
        )}
        {widget.type === 'funnel' && (
          <FunnelInspector
            data={widget.data as FunnelData}
            onChange={(d) => updateWidgetData(widget.id, d)}
          />
        )}
        {widget.type === 'textbox' && (
          <TextboxInspector
            data={widget.data as TextboxData}
            onChange={(d) => updateWidgetData(widget.id, d)}
          />
        )}
        {widget.type === 'html' && (
          <HtmlInspector
            data={widget.data as HtmlData}
            onChange={(d) => updateWidgetData(widget.id, d)}
          />
        )}
        {widget.type === 'fileupload' && (
          <FileUploadInspector
            data={widget.data as FileUploadData}
            onChange={(d) => updateWidgetData(widget.id, d)}
          />
        )}
        {widget.type === 'directory' && (
          <DirectoryInspector
            data={widget.data as DirectoryData}
            onChange={(d) => updateWidgetData(widget.id, d)}
          />
        )}
        {widget.type === 'worklog' && (
          <WorklogInspector
            data={widget.data as WorklogData}
            onChange={(d) => updateWidgetData(widget.id, d)}
          />
        )}
      </div>
      <div className="inspector-footer">
        <div className="meta-row">
          <span>생성 {new Date(widget.createdAt).toLocaleDateString('ko-KR')}</span>
          <span>수정 {new Date(widget.updatedAt).toLocaleDateString('ko-KR')}</span>
        </div>
        <button className="btn-danger" onClick={() => deleteWidget(widget.id)}>
          🗑 위젯 삭제
        </button>
      </div>
    </aside>
  );
}

const TYPE_ICONS: Record<string, string> = {
  task: '✓', note: '📝', link: '🔗', image: '🖼️', group: '⬡', goal: '🎯', lead: '💼', funnel: '📊', textbox: 'T', html: '⟨/⟩', fileupload: '📁', directory: '👥', worklog: '📋',
};
const TYPE_LABELS: Record<string, string> = {
  task: '작업', note: '메모', link: '링크', image: '이미지', group: '그룹', goal: '목표', lead: '리드', funnel: '세일즈 퍼널', textbox: '텍스트박스', html: 'HTML', fileupload: '파일 업로드', directory: '인원 디렉토리', worklog: '작업로그',
};

/* ─── Group Inspector ─── */
const GROUP_COLORS = ['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

function getWidgetTitle(w: { type: string; data: unknown }): string {
  const d = w.data as Record<string, unknown>;
  if (typeof d.title === 'string' && d.title) return d.title;
  if (typeof d.name === 'string' && d.name) return d.name;
  return TYPE_LABELS[w.type] ?? w.type;
}

type GroupSort = 'updatedAt' | 'type';

function GroupInspector({
  widgetId, data, onChange, onUngroup, onToggleCollapse,
}: {
  widgetId: string;
  data: GroupData;
  onChange: (d: Partial<GroupData>) => void;
  onUngroup: () => void;
  onToggleCollapse: () => void;
}) {
  const [sort, setSort] = useState<GroupSort>('updatedAt');
  const children = useStore((s) => s.widgets.filter((w) => w.groupId === widgetId));
  const setSelectedWidget = useStore((s) => s.setSelectedWidget);

  const sorted = useMemo(() => {
    const arr = [...children];
    if (sort === 'updatedAt') arr.sort((a, b) => b.updatedAt - a.updatedAt);
    else arr.sort((a, b) => a.type.localeCompare(b.type));
    return arr;
  }, [children, sort]);

  return (
    <>
      <div className="field">
        <div className="field-label">그룹 이름</div>
        <input value={data.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="그룹 이름..." />
      </div>
      <div className="field">
        <div className="field-label">색상</div>
        <div className="color-swatches">
          {GROUP_COLORS.map((c) => (
            <div
              key={c}
              className={`color-swatch${data.color === c ? ' active' : ''}`}
              style={{ background: c }}
              onClick={() => onChange({ color: c })}
            />
          ))}
        </div>
      </div>

      <div className="field">
        <div className="group-children-header">
          <span className="field-label" style={{ margin: 0 }}>포함된 요소 ({children.length})</span>
          <div className="seg-group" style={{ gap: 2 }}>
            <button
              className={`seg-btn${sort === 'updatedAt' ? ' active' : ''}`}
              style={{ fontSize: 11, padding: '3px 8px' }}
              onClick={() => setSort('updatedAt')}
            >최근순</button>
            <button
              className={`seg-btn${sort === 'type' ? ' active' : ''}`}
              style={{ fontSize: 11, padding: '3px 8px' }}
              onClick={() => setSort('type')}
            >타입순</button>
          </div>
        </div>
        <div className="group-children-list">
          {sorted.length === 0 && (
            <div className="group-children-empty">비어있음</div>
          )}
          {sorted.map((w) => (
            <button
              key={w.id}
              className="group-child-item"
              onClick={() => setSelectedWidget(w.id)}
            >
              <span className="group-child-icon">{TYPE_ICONS[w.type] ?? '□'}</span>
              <span className="group-child-name">{getWidgetTitle(w)}</span>
              <span className="group-child-type">{TYPE_LABELS[w.type] ?? w.type}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          className="seg-btn"
          style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--panel-input-border)', background: 'transparent', color: 'var(--panel-text)', cursor: 'pointer', fontSize: 13 }}
          onClick={onToggleCollapse}
        >
          {data.collapsed ? '▶ 펼치기' : '▼ 접기'}
        </button>
        <button
          className="seg-btn"
          style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--panel-input-border)', background: 'transparent', color: 'var(--panel-text)', cursor: 'pointer', fontSize: 13 }}
          onClick={onUngroup}
        >
          ↗ 그룹 해제 (위젯 유지)
        </button>
      </div>
    </>
  );
}

/* ─── Task Inspector ─── */
function TaskInspector({ data, onChange }: { data: TaskData; onChange: (d: Partial<TaskData>) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const attachment: Attachment = {
          id: uuid(),
          name: file.name,
          type: file.type.startsWith('image/') ? 'image' : 'file',
          data: reader.result as string,
          mimeType: file.type,
          size: file.size,
        };
        onChange({ attachments: [...data.attachments, attachment] });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const addUrlAttachment = () => {
    const url = prompt('URL을 입력하세요:');
    if (!url) return;
    const attachment: Attachment = {
      id: uuid(),
      name: url,
      type: 'url',
      data: url,
    };
    onChange({ attachments: [...data.attachments, attachment] });
  };

  const removeAttachment = (id: string) => {
    onChange({ attachments: data.attachments.filter((a) => a.id !== id) });
  };

  const addTag = () => {
    const tag = tagInputRef.current?.value.trim();
    if (!tag || data.tags.includes(tag)) return;
    onChange({ tags: [...data.tags, tag] });
    if (tagInputRef.current) tagInputRef.current.value = '';
  };

  const attachIcon = (a: Attachment) => {
    if (a.type === 'url') return '🔗';
    if (a.type === 'image') return '🖼️';
    if (a.mimeType?.includes('pdf')) return '📄';
    return '📎';
  };

  return (
    <>
      <div className="field">
        <div className="field-label">제목</div>
        <input value={data.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="작업 제목..." />
      </div>
      <div className="field">
        <div className="field-label">상태</div>
        <div className="seg-group">
          {(['todo', 'in-progress', 'done'] as const).map((s) => (
            <button key={s} className={`seg-btn${data.status === s ? ' active' : ''}`} onClick={() => onChange({ status: s })}>
              {s === 'todo' ? '할 일' : s === 'in-progress' ? '진행 중' : '완료'}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <div className="field-label">우선순위</div>
        <div className="seg-group">
          {(['low', 'medium', 'high'] as const).map((p) => (
            <button key={p} className={`seg-btn${data.priority === p ? ' active' : ''}`} onClick={() => onChange({ priority: p })}>
              {p === 'low' ? '낮음' : p === 'medium' ? '보통' : '높음'}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <div className="field-label">마감일</div>
        <input type="date" value={data.dueDate} onChange={(e) => onChange({ dueDate: e.target.value })} />
      </div>
      <div className="field">
        <div className="field-label">설명</div>
        <textarea
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="세부 내용 추가..."
          rows={4}
        />
      </div>
      <div className="field">
        <div className="field-label">태그</div>
        <div className="tags-input-row">
          <input ref={tagInputRef} placeholder="태그 추가..." onKeyDown={(e) => e.key === 'Enter' && addTag()} />
          <button className="tag-add-btn" onClick={addTag}>+</button>
        </div>
        {data.tags.length > 0 && (
          <div className="tags-list">
            {data.tags.map((t) => (
              <span key={t} className="tag-chip">
                {t}
                <button onClick={() => onChange({ tags: data.tags.filter((x) => x !== t) })}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="field">
        <div className="field-label">첨부파일</div>
        <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileUpload} />
        <button className="attach-btn" onClick={() => fileInputRef.current?.click()}>
          📎 파일 또는 이미지 업로드
        </button>
        <button className="attach-btn" style={{ marginTop: 4 }} onClick={addUrlAttachment}>
          🔗 URL 추가
        </button>
        {data.attachments.length > 0 && (
          <div className="attach-list">
            {data.attachments.map((a) => (
              <div key={a.id} className="attach-item">
                <span className="attach-item-icon">{attachIcon(a)}</span>
                <span className="attach-item-name">
                  {a.type === 'url'
                    ? <a href={a.data} target="_blank" rel="noreferrer">{a.name}</a>
                    : <span>{a.name}</span>
                  }
                </span>
                {a.size && (
                  <span style={{ fontSize: 10, color: 'var(--panel-muted)', flexShrink: 0 }}>
                    {(a.size / 1024).toFixed(0)}KB
                  </span>
                )}
                <button className="attach-item-del" onClick={() => removeAttachment(a.id)}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Note Inspector ─── */
function NoteInspector({ data, onChange }: { data: NoteData; onChange: (d: Partial<NoteData>) => void }) {
  return (
    <>
      <div className="field">
        <div className="field-label">내용</div>
        <textarea
          value={data.content}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder="메모를 입력하세요..."
          rows={8}
        />
      </div>
      <div className="field">
        <div className="field-label">배경 색상</div>
        <div className="color-swatches">
          {NOTE_COLORS.map((c) => (
            <div
              key={c}
              className={`color-swatch${data.color === c ? ' active' : ''}`}
              style={{ background: c }}
              onClick={() => onChange({ color: c })}
            />
          ))}
        </div>
      </div>
    </>
  );
}

/* ─── Link Inspector ─── */
function LinkInspector({ data, onChange }: { data: LinkData; onChange: (d: Partial<LinkData>) => void }) {
  return (
    <>
      <div className="field">
        <div className="field-label">URL</div>
        <input
          type="url"
          value={data.url}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="https://..."
        />
      </div>
      <div className="field">
        <div className="field-label">제목</div>
        <input value={data.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="링크 제목..." />
      </div>
      <div className="field">
        <div className="field-label">설명</div>
        <textarea
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="간단한 설명..."
          rows={3}
        />
      </div>
      {data.url && (
        <a href={data.url} target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', fontSize: 12, color: 'var(--accent)' }}>
          링크 열기 ↗
        </a>
      )}
    </>
  );
}

/* ─── Image Inspector ─── */
function ImageInspector({ data, onChange }: { data: ImageData; onChange: (d: Partial<ImageData>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ src: reader.result as string, name: file.name });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <>
      <div className="field">
        <div className="field-label">이미지</div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        {data.src
          ? (
            <div>
              <img src={data.src} alt={data.caption} style={{ width: '100%', borderRadius: 6, display: 'block' }} />
              <button
                onClick={() => fileRef.current?.click()}
                style={{ marginTop: 6, width: '100%', padding: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--panel-input-border)', borderRadius: 6, color: 'var(--panel-muted)', cursor: 'pointer', fontSize: 12 }}
              >
                이미지 교체
              </button>
            </div>
          )
          : (
            <button className="attach-btn" style={{ height: 80, justifyContent: 'center' }} onClick={() => fileRef.current?.click()}>
              🖼️ 이미지 업로드
            </button>
          )
        }
      </div>
      <div className="field">
        <div className="field-label">캡션</div>
        <input value={data.caption} onChange={(e) => onChange({ caption: e.target.value })} placeholder="이미지 설명..." />
      </div>
      {!data.src && (
        <div className="field">
          <div className="field-label">또는 URL 입력</div>
          <input
            type="url"
            value={data.src}
            onChange={(e) => onChange({ src: e.target.value, name: '이미지' })}
            placeholder="https://..."
          />
        </div>
      )}
    </>
  );
}

/* ─── Goal Inspector ─── */
const GOAL_STATUS_OPTIONS: { value: GoalStatus; label: string }[] = [
  { value: 'on-track', label: '순조로움' },
  { value: 'at-risk',  label: '위험'    },
  { value: 'achieved', label: '달성'    },
  { value: 'paused',   label: '중단'    },
];

function GoalInspector({ widgetId, data, onChange }: { widgetId: string; data: GoalData; onChange: (d: Partial<GoalData>) => void }) {
  const krInputRef = useRef<HTMLInputElement>(null);

  const allWidgets = useStore((s) => s.widgets);
  const connections = useStore((s) => s.connections);
  const addConnection = useStore((s) => s.addConnection);
  const deleteConnection = useStore((s) => s.deleteConnection);

  const { childGoals, parentGoal, parentConn, autoProgress, otherGoals } = useMemo(() => {
    const childConns = connections.filter((c) => c.type === 'goal-parent' && c.fromId === widgetId);
    const childGoals = childConns
      .map((c) => allWidgets.find((w) => w.id === c.toId))
      .filter((w): w is typeof allWidgets[0] => !!w && w.type === 'goal');

    const parentConn = connections.find((c) => c.type === 'goal-parent' && c.toId === widgetId) ?? null;
    const parentGoal = parentConn
      ? (allWidgets.find((w) => w.id === parentConn.fromId && w.type === 'goal') ?? null)
      : null;

    const autoProgress = childGoals.length > 0
      ? Math.round(childGoals.reduce((sum, w) => sum + (w.data as GoalData).progress, 0) / childGoals.length)
      : null;

    const childIds = new Set(childGoals.map((w) => w.id));
    const otherGoals = allWidgets.filter(
      (w) => w.type === 'goal' && w.id !== widgetId && !childIds.has(w.id)
    );

    return { childGoals, parentGoal, parentConn, autoProgress, otherGoals };
  }, [connections, allWidgets, widgetId]);

  const childIds = useMemo(
    () => new Set(childGoals.map((w) => w.id)),
    [childGoals]
  );

  const setParent = (parentId: string) => {
    if (parentConn) deleteConnection(parentConn.id);
    if (parentId) addConnection(parentId, widgetId, 'goal-parent');
  };

  const addChild = (childId: string) => {
    addConnection(widgetId, childId, 'goal-parent');
  };

  const removeChild = (childId: string) => {
    const conn = connections.find((c) => c.type === 'goal-parent' && c.fromId === widgetId && c.toId === childId);
    if (conn) deleteConnection(conn.id);
  };

  const addKR = () => {
    const text = krInputRef.current?.value.trim();
    if (!text) return;
    const kr: KeyResult = { id: uuid(), text, done: false };
    onChange({ keyResults: [...data.keyResults, kr] });
    if (krInputRef.current) krInputRef.current.value = '';
  };

  const toggleKR = (id: string) => {
    onChange({
      keyResults: data.keyResults.map((k) => k.id === id ? { ...k, done: !k.done } : k),
    });
  };

  const deleteKR = (id: string) => {
    onChange({ keyResults: data.keyResults.filter((k) => k.id !== id) });
  };

  return (
    <>
      <div className="field">
        <div className="field-label">목표 제목</div>
        <input value={data.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="목표 제목..." />
      </div>
      <div className="field">
        <div className="field-label">상태</div>
        <div className="seg-group">
          {GOAL_STATUS_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              className={`seg-btn${data.status === value ? ' active' : ''}`}
              onClick={() => onChange({ status: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {/* ── Goal hierarchy ── */}
      <div className="field">
        <div className="field-label">상위 목표</div>
        {parentGoal ? (
          <div className="goal-link-row">
            <span className="goal-link-icon">🎯</span>
            <span className="goal-link-name">{(parentGoal.data as GoalData).title || '목표'}</span>
            <span className="goal-link-pct">{(parentGoal.data as GoalData).progress}%</span>
            <button className="goal-link-remove" onClick={() => setParent('')} title="연결 해제">×</button>
          </div>
        ) : (
          <select
            value=""
            onChange={(e) => { if (e.target.value) setParent(e.target.value); }}
            className="goal-link-select"
          >
            <option value="">— 상위 목표 선택 —</option>
            {otherGoals
              .filter((g) => !childIds.has(g.id))
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {(g.data as GoalData).title || '제목 없는 목표'}
                </option>
              ))}
          </select>
        )}
      </div>

      <div className="field">
        <div className="field-label">하위 목표</div>
        {childGoals.map((cw) => (
          <div key={cw.id} className="goal-link-row">
            <span className="goal-link-icon">🎯</span>
            <span className="goal-link-name">{(cw.data as GoalData).title || '목표'}</span>
            <span className="goal-link-pct">{(cw.data as GoalData).progress}%</span>
            <button className="goal-link-remove" onClick={() => removeChild(cw.id)} title="연결 해제">×</button>
          </div>
        ))}
        {otherGoals.filter((g) => g.id !== parentGoal?.id && !childIds.has(g.id)).length > 0 && (
          <select
            value=""
            onChange={(e) => { if (e.target.value) addChild(e.target.value); }}
            className="goal-link-select"
            style={{ marginTop: childGoals.length ? 4 : 0 }}
          >
            <option value="">+ 하위 목표 추가</option>
            {otherGoals
              .filter((g) => g.id !== parentGoal?.id && !childIds.has(g.id))
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {(g.data as GoalData).title || '제목 없는 목표'}
                </option>
              ))}
          </select>
        )}
        {childGoals.length > 0 && (
          <div className="goal-auto-info">
            🔄 진행률이 하위 목표 평균으로 자동 계산됩니다
          </div>
        )}
      </div>

      <div className="field">
        <div className="field-label">
          진행률 ({autoProgress ?? data.progress}%)
          {autoProgress !== null && <span className="goal-auto-label"> · 자동</span>}
        </div>
        {autoProgress !== null ? (
          <div className="goal-auto-progress-bar">
            <div className="goal-auto-progress-fill" style={{ width: `${autoProgress}%` }} />
            <span className="goal-auto-progress-hint">
              하위 {childGoals.length}개 목표 평균
            </span>
          </div>
        ) : (
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={data.progress}
            onChange={(e) => onChange({ progress: Number(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--accent)' }}
          />
        )}
      </div>
      <div className="field">
        <div className="field-label">목표 기한</div>
        <input type="date" value={data.targetDate} onChange={(e) => onChange({ targetDate: e.target.value })} />
      </div>
      <div className="field">
        <div className="field-label">설명</div>
        <textarea
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="목표 상세 설명..."
          rows={3}
        />
      </div>
      <div className="field">
        <div className="field-label">핵심 결과 (Key Results)</div>
        <div className="tags-input-row">
          <input ref={krInputRef} placeholder="핵심 결과 추가..." onKeyDown={(e) => e.key === 'Enter' && addKR()} />
          <button className="tag-add-btn" onClick={addKR}>+</button>
        </div>
        {data.keyResults.length > 0 && (
          <div className="goal-kr-inspector-list">
            {data.keyResults.map((kr) => (
              <div key={kr.id} className={`goal-kr-inspector-item${kr.done ? ' done' : ''}`}>
                <button
                  className="goal-kr-inspector-check"
                  onClick={() => toggleKR(kr.id)}
                >
                  {kr.done ? '✓' : '○'}
                </button>
                <span className="goal-kr-inspector-text">{kr.text}</span>
                <button className="attach-item-del" onClick={() => deleteKR(kr.id)}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Lead Inspector ─── */
const LEAD_STAGE_OPTIONS: { value: LeadStage; label: string }[] = [
  { value: 'prospect',    label: '잠재고객' },
  { value: 'qualified',   label: '검증됨'   },
  { value: 'proposal',    label: '제안중'   },
  { value: 'negotiation', label: '협상중'   },
  { value: 'won',         label: '성사'     },
  { value: 'lost',        label: '손실'     },
];

function LeadInspector({ data, onChange }: { data: LeadData; onChange: (d: Partial<LeadData>) => void }) {
  const tagInputRef = useRef<HTMLInputElement>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);

  const commitSource = () => {
    const val = sourceInputRef.current?.value.trim();
    if (!val) return;
    onChange({ source: val });
    if (sourceInputRef.current) sourceInputRef.current.value = '';
  };

  const allWidgets = useStore((s) => s.widgets);
  const existingSources = useMemo(
    () => [...new Set(
      allWidgets
        .filter((w) => w.type === 'lead')
        .map((w) => (w.data as LeadData).source?.trim())
        .filter(Boolean) as string[]
    )],
    [allWidgets]
  );

  const addTag = () => {
    const tag = tagInputRef.current?.value.trim();
    if (!tag || data.tags.includes(tag)) return;
    onChange({ tags: [...data.tags, tag] });
    if (tagInputRef.current) tagInputRef.current.value = '';
  };

  return (
    <>
      <div className="field">
        <div className="field-label">담당자 이름</div>
        <input value={data.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="홍길동" />
      </div>
      <div className="field">
        <div className="field-label">회사명</div>
        <input value={data.company} onChange={(e) => onChange({ company: e.target.value })} placeholder="삼성전자" />
      </div>
      <div className="field">
        <div className="field-label">스테이지</div>
        <div className="seg-group" style={{ flexWrap: 'wrap' }}>
          {LEAD_STAGE_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              className={`seg-btn${data.stage === value ? ' active' : ''}`}
              onClick={() => onChange({ stage: value })}
              style={{ flex: '1 1 30%' }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="field" style={{ flex: 1 }}>
          <div className="field-label">딜 금액</div>
          <input
            type="number"
            value={data.value || ''}
            onChange={(e) => onChange({ value: Number(e.target.value) })}
            placeholder="0"
          />
        </div>
        <div className="field" style={{ width: 90 }}>
          <div className="field-label">통화</div>
          <select value={data.currency} onChange={(e) => onChange({ currency: e.target.value })}>
            <option value="KRW">KRW ₩</option>
            <option value="USD">USD $</option>
            <option value="EUR">EUR €</option>
          </select>
        </div>
      </div>
      <div className="field">
        <div className="field-label">성사 확률 ({data.probability}%)</div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={data.probability}
          onChange={(e) => onChange({ probability: Number(e.target.value) })}
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
      </div>
      <div className="field">
        <div className="field-label">연락처 이메일</div>
        <input type="email" value={data.contactEmail} onChange={(e) => onChange({ contactEmail: e.target.value })} placeholder="name@company.com" />
      </div>
      <div className="field">
        <div className="field-label">연락처 전화</div>
        <input type="tel" value={data.contactPhone} onChange={(e) => onChange({ contactPhone: e.target.value })} placeholder="010-0000-0000" />
      </div>
      <div className="field">
        <div className="field-label">다음 액션</div>
        <input value={data.nextAction} onChange={(e) => onChange({ nextAction: e.target.value })} placeholder="제안서 발송, 미팅 예약..." />
      </div>
      <div className="field">
        <div className="field-label">다음 액션 날짜</div>
        <input type="date" value={data.nextActionDate} onChange={(e) => onChange({ nextActionDate: e.target.value })} />
      </div>
      <div className="field">
        <div className="field-label">메모</div>
        <textarea value={data.notes} onChange={(e) => onChange({ notes: e.target.value })} placeholder="리드 관련 메모..." rows={3} />
      </div>
      <div className="field">
        <div className="field-label">소스 (유입 경로)</div>
        {data.source ? (
          <div className="tags-list" style={{ marginTop: 0 }}>
            <span className="tag-chip source-chip">
              {data.source}
              <button onClick={() => onChange({ source: '' })}>×</button>
            </span>
          </div>
        ) : (
          <div className="tags-input-row">
            <input
              ref={sourceInputRef}
              placeholder="인스타그램, 구글 광고..."
              onKeyDown={(e) => e.key === 'Enter' && commitSource()}
            />
            <button className="tag-add-btn" onClick={commitSource}>+</button>
          </div>
        )}
        {existingSources.filter((s) => s !== data.source).length > 0 && (
          <div className="source-suggestions">
            {existingSources.filter((s) => s !== data.source).map((s) => (
              <button key={s} className="source-suggestion-chip" onClick={() => onChange({ source: s })}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="field">
        <div className="field-label">태그</div>
        <div className="tags-input-row">
          <input ref={tagInputRef} placeholder="태그 추가..." onKeyDown={(e) => e.key === 'Enter' && addTag()} />
          <button className="tag-add-btn" onClick={addTag}>+</button>
        </div>
        {data.tags.length > 0 && (
          <div className="tags-list">
            {data.tags.map((t) => (
              <span key={t} className="tag-chip">
                {t}
                <button onClick={() => onChange({ tags: data.tags.filter((x) => x !== t) })}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Funnel Inspector ─── */
function FunnelInspector({ data, onChange }: { data: FunnelData; onChange: (d: Partial<FunnelData>) => void }) {
  const leadCount = useStore((s) => s.widgets.filter((w) => w.type === 'lead').length);
  return (
    <>
      <div className="field">
        <div className="field-label">제목</div>
        <input value={data.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="세일즈 퍼널" />
      </div>
      <div style={{ padding: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, fontSize: 13, color: 'var(--panel-muted)' }}>
        캔버스의 모든 리드 위젯을 자동 집계합니다.
        <br />
        현재 <strong style={{ color: 'var(--panel-text)' }}>{leadCount}개</strong> 리드 추적 중
      </div>
    </>
  );
}

/* ─── Textbox Inspector ─── */
function TextboxInspector({ data, onChange }: { data: TextboxData; onChange: (d: Partial<TextboxData>) => void }) {
  const TEXT_COLORS = ['#1e293b', '#475569', '#94a3b8', '#e2e8f0', '#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];
  return (
    <>
      <div className="field">
        <div className="field-label">내용</div>
        <textarea
          value={data.content}
          onChange={(e) => onChange({ content: e.target.value })}
          placeholder="텍스트를 입력하세요..."
          rows={5}
        />
      </div>
      <div className="field">
        <div className="field-label">글자 크기 ({data.fontSize}px)</div>
        <input
          type="range"
          min={10}
          max={72}
          step={1}
          value={data.fontSize}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
      </div>
      <div className="field">
        <div className="field-label">정렬</div>
        <div className="seg-group">
          {(['left', 'center', 'right'] as const).map((a) => (
            <button
              key={a}
              className={`seg-btn${data.align === a ? ' active' : ''}`}
              onClick={() => onChange({ align: a })}
            >
              {a === 'left' ? '왼쪽' : a === 'center' ? '가운데' : '오른쪽'}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <div className="field-label">스타일</div>
        <div className="seg-group">
          <button
            className={`seg-btn${data.bold ? ' active' : ''}`}
            onClick={() => onChange({ bold: !data.bold })}
            style={{ fontWeight: 700 }}
          >
            B
          </button>
          <button
            className={`seg-btn${data.italic ? ' active' : ''}`}
            onClick={() => onChange({ italic: !data.italic })}
            style={{ fontStyle: 'italic' }}
          >
            I
          </button>
        </div>
      </div>
      <div className="field">
        <div className="field-label">색상</div>
        <div className="color-swatches">
          {TEXT_COLORS.map((c) => (
            <div
              key={c}
              className={`color-swatch${data.color === c ? ' active' : ''}`}
              style={{ background: c }}
              onClick={() => onChange({ color: c })}
            />
          ))}
        </div>
      </div>
    </>
  );
}

/* ─── HTML Inspector ─── */
function HtmlInspector({ data, onChange }: { data: HtmlData; onChange: (d: Partial<HtmlData>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ html: reader.result as string, name: file.name });
    reader.readAsText(file);
    e.target.value = '';
  };

  const openInNewTab = () => {
    if (!data.html) return;
    const blob = new Blob([data.html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <>
      <div className="field">
        <div className="field-label">HTML 파일</div>
        <input ref={fileRef} type="file" accept=".html,.htm" style={{ display: 'none' }} onChange={handleFile} />
        <button className="attach-btn" onClick={() => fileRef.current?.click()}>
          ⟨/⟩ HTML 파일 업로드
        </button>
        {data.name && (
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--panel-muted)' }}>{data.name}</div>
        )}
      </div>
      <div className="field">
        <div className="field-label">또는 HTML 직접 입력</div>
        <textarea
          value={data.html}
          onChange={(e) => onChange({ html: e.target.value, name: data.name || 'custom.html' })}
          placeholder="<html>...</html>"
          rows={8}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </div>
      {data.html && (
        <button
          className="attach-btn"
          style={{ justifyContent: 'center', background: 'rgba(99,102,241,0.12)', borderColor: 'var(--accent)' }}
          onClick={openInNewTab}
        >
          새 탭에서 열기 ↗
        </button>
      )}
    </>
  );
}

/* ─── File Upload Inspector ─── */
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

function FileUploadInspector({
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

  const removeFile = (id: string) => onChange({ files: data.files.filter((f) => f.id !== id) });

  return (
    <>
      <div className="field">
        <div className="field-label">제목</div>
        <input
          value={data.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="파일 보관함 이름..."
        />
      </div>
      <div className="field">
        <div className="field-label">파일 ({data.files.length}개)</div>
        <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleUpload} />
        <button className="attach-btn" onClick={() => fileInputRef.current?.click()}>
          📂 파일 업로드
        </button>
        {data.files.length > 0 && (
          <div className="attach-list" style={{ marginTop: 8 }}>
            {data.files.map((f) => (
              <div key={f.id} className="attach-item">
                <span className="attach-item-icon">{fileIcon(f.mimeType)}</span>
                <span className="attach-item-name">{f.name}</span>
                <span style={{ fontSize: 10, color: 'var(--panel-muted)', flexShrink: 0 }}>{fmtSize(f.size)}</span>
                <button
                  className="attach-item-del"
                  title="다운로드"
                  style={{ color: 'var(--panel-muted)' }}
                  onClick={() => downloadFile(f)}
                >
                  ↓
                </button>
                <button className="attach-item-del" onClick={() => removeFile(f.id)}>×</button>
              </div>
            ))}
          </div>
        )}
        {data.files.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--panel-muted)', marginTop: 6 }}>
            업로드된 파일이 없습니다
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Directory Inspector ─── */
const COL_TYPE_OPTIONS: { value: DirectoryColumnType; label: string }[] = [
  { value: 'text',   label: '텍스트' },
  { value: 'email',  label: '이메일' },
  { value: 'phone',  label: '전화번호' },
  { value: 'select', label: '선택' },
  { value: 'url',    label: 'URL' },
  { value: 'number', label: '숫자' },
];

function DirectoryInspector({
  data,
  onChange,
}: {
  data: DirectoryData;
  onChange: (d: Partial<DirectoryData>) => void;
}) {
  const colLabelInputRef = useRef<HTMLInputElement>(null);

  const addColumn = () => {
    const newCol: DirectoryColumn = {
      id: uuid(),
      label: '새 컬럼',
      type: 'text',
      width: 120,
    };
    onChange({ columns: [...data.columns, newCol] });
  };

  const updateColumn = (colId: string, update: Partial<DirectoryColumn>) => {
    onChange({ columns: data.columns.map((c) => c.id === colId ? { ...c, ...update } : c) });
  };

  const deleteColumn = (colId: string) => {
    onChange({
      columns: data.columns.filter((c) => c.id !== colId),
      rows: data.rows.map((r) => {
        const cells = { ...r.cells };
        delete cells[colId];
        return { ...r, cells };
      }),
    });
  };

  const selectCols = data.columns.filter((c) => c.type === 'select');

  return (
    <>
      <div className="field">
        <div className="field-label">제목</div>
        <input
          value={data.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="인원 디렉토리..."
        />
      </div>

      <div className="field">
        <div className="field-label">컬럼 관리</div>
        <div className="dir-col-list">
          {data.columns.map((col) => (
            <div key={col.id} className="dir-col-row">
              <ColumnLabelInput
                value={col.label}
                onCommit={(label) => updateColumn(col.id, { label })}
              />
              <select
                className="dir-col-type-select"
                value={col.type}
                onChange={(e) => updateColumn(col.id, { type: e.target.value as DirectoryColumnType })}
              >
                {COL_TYPE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button
                className="attach-item-del"
                onClick={() => deleteColumn(col.id)}
                disabled={data.columns.length <= 1}
              >×</button>
            </div>
          ))}
        </div>
        <button className="attach-btn" style={{ marginTop: 6 }} onClick={addColumn}>
          + 컬럼 추가
        </button>
      </div>

      {selectCols.map((col) => (
        <div key={col.id} className="field">
          <div className="field-label">"{col.label}" 선택 옵션</div>
          <SelectOptionsEditor
            options={col.options ?? []}
            onChange={(options) => updateColumn(col.id, { options })}
          />
        </div>
      ))}

      <div className="field">
        <div className="field-label">데이터</div>
        <div style={{ fontSize: 13, color: 'var(--panel-muted)', marginBottom: 6 }}>
          {data.rows.length}개 행
        </div>
        {data.rows.length > 0 && (
          <button
            className="attach-btn"
            style={{ color: 'var(--danger, #ef4444)', borderColor: 'rgba(239,68,68,0.3)' }}
            onClick={() => {
              if (window.confirm(`${data.rows.length}개 행을 모두 삭제하시겠습니까?`)) {
                onChange({ rows: [] });
              }
            }}
          >
            🗑 모든 행 삭제
          </button>
        )}
      </div>
    </>
  );
}

function SelectOptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (opts: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addOption = () => {
    const val = inputRef.current?.value.trim();
    if (!val || options.includes(val)) return;
    onChange([...options, val]);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <div className="tags-input-row">
        <input
          ref={inputRef}
          placeholder="옵션 추가..."
          onKeyDown={(e) => e.key === 'Enter' && addOption()}
        />
        <button className="tag-add-btn" onClick={addOption}>+</button>
      </div>
      {options.length > 0 && (
        <div className="tags-list">
          {options.map((opt) => (
            <span key={opt} className="tag-chip">
              {opt}
              <button onClick={() => onChange(options.filter((o) => o !== opt))}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Worklog Inspector ─── */
function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return `오늘 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function WorklogInspector({ data, onChange }: { data: WorklogData; onChange: (d: Partial<WorklogData>) => void }) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    onChange({ entries: data.entries.filter((e) => e.id !== id) });
    setConfirmDeleteId(null);
  };

  return (
    <div>
      <div className="field">
        <div className="field-label">제목</div>
        <input
          value={data.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="작업로그"
        />
      </div>
      <div className="field">
        <div className="field-label">
          로그 히스토리
          <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--panel-muted)' }}>
            {data.entries.length}건
          </span>
        </div>
        {data.entries.length === 0 ? (
          <div className="worklog-inspector-empty">
            캔버스 위젯에서 내용을 입력하고 Enter를 누르면 기록됩니다
          </div>
        ) : (
          <div className="worklog-log-list">
            {data.entries.map((entry: WorklogEntry) => (
              <div key={entry.id} className="worklog-log-item">
                <div className="worklog-log-meta">
                  <span className="worklog-log-user">{entry.userName}</span>
                  <span className="worklog-log-time">{formatTime(entry.createdAt)}</span>
                  {confirmDeleteId === entry.id ? (
                    <div className="worklog-log-confirm">
                      <button
                        className="worklog-log-confirm-yes"
                        onClick={() => handleDelete(entry.id)}
                      >삭제</button>
                      <button
                        className="worklog-log-confirm-no"
                        onClick={() => setConfirmDeleteId(null)}
                      >취소</button>
                    </div>
                  ) : (
                    <button
                      className="worklog-log-del"
                      onClick={() => setConfirmDeleteId(entry.id)}
                      title="삭제"
                    >✕</button>
                  )}
                </div>
                <div className="worklog-log-content">{entry.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Column label input with IME-safe local state ── */
function ColumnLabelInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  const composingRef = useRef(false);

  // Sync from parent only when not composing
  useEffect(() => {
    if (!composingRef.current) setLocal(value);
  }, [value]);

  return (
    <input
      className="dir-col-label-input"
      value={local}
      placeholder="컬럼명..."
      onChange={(e) => {
        setLocal(e.target.value);
        if (!composingRef.current) onCommit(e.target.value);
      }}
      onCompositionStart={() => { composingRef.current = true; }}
      onCompositionEnd={(e) => {
        composingRef.current = false;
        const v = (e.target as HTMLInputElement).value;
        setLocal(v);
        onCommit(v);
      }}
      onBlur={() => onCommit(local)}
    />
  );
}
