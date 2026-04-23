export type PortSide = 'top' | 'right' | 'bottom' | 'left';
export type WidgetType = 'task' | 'note' | 'link' | 'image' | 'group' | 'goal' | 'lead' | 'funnel' | 'textbox' | 'html' | 'fileupload' | 'directory';
export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export type ConnectionType = 'relates-to' | 'blocks' | 'depends-on' | 'goal-parent';

export interface Point {
  x: number;
  y: number;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'file' | 'image' | 'url';
  data: string;
  mimeType?: string;
  size?: number;
}

export interface TaskData {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  tags: string[];
  attachments: Attachment[];
}

export interface NoteData {
  content: string;
  color: string;
}

export interface LinkData {
  url: string;
  title: string;
  description: string;
}

export interface ImageData {
  src: string;
  caption: string;
  name: string;
}

export type GoalStatus = 'on-track' | 'at-risk' | 'achieved' | 'paused';

export interface KeyResult {
  id: string;
  text: string;
  done: boolean;
}

export interface GoalData {
  title: string;
  description: string;
  status: GoalStatus;
  progress: number;
  targetDate: string;
  keyResults: KeyResult[];
}

export type LeadStage = 'prospect' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

export interface LeadData {
  name: string;
  company: string;
  value: number;
  currency: string;
  stage: LeadStage;
  probability: number;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  nextAction: string;
  nextActionDate: string;
  tags: string[];
  source: string;
}

export interface GroupData {
  title: string;
  collapsed: boolean;
  color: string;
  expandedWidth: number;
  expandedHeight: number;
}

export interface FunnelData {
  title: string;
}

export interface TextboxData {
  content: string;
  fontSize: number;
  align: 'left' | 'center' | 'right';
  bold: boolean;
  italic: boolean;
  color: string;
}

export interface HtmlData {
  html: string;
  name: string;
}

export interface FileItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  data: string;
}

export interface FileUploadData {
  title: string;
  files: FileItem[];
}

export type DirectoryColumnType = 'text' | 'email' | 'phone' | 'select' | 'url' | 'number';

export interface DirectoryColumn {
  id: string;
  label: string;
  type: DirectoryColumnType;
  options?: string[];
  width: number;
}

export interface DirectoryRow {
  id: string;
  cells: Record<string, string>;
}

export interface DirectoryData {
  title: string;
  columns: DirectoryColumn[];
  rows: DirectoryRow[];
}

export type WidgetData = TaskData | NoteData | LinkData | ImageData | GroupData | GoalData | LeadData | FunnelData | TextboxData | HtmlData | FileUploadData | DirectoryData;

export interface Widget {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  width: number;
  height: number;
  data: WidgetData;
  createdAt: number;
  updatedAt: number;
  zIndex: number;
  groupId?: string;
  userResized?: boolean;
}

export interface Connection {
  id: string;
  fromId: string;
  toId: string;
  label: string;
  type: ConnectionType;
}

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export interface PendingConnection {
  fromId: string;
  fromPort: PortSide;
  toX: number;
  toY: number;
}

export interface RubberBand {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface Snapshot {
  id: string;
  timestamp: number;
  label: string;
  widgets: Widget[];
  connections: Connection[];
}

export interface PendingGroupChange {
  widgetId: string;
  prevGroupId: string | undefined;
  prevX: number;
  prevY: number;
  newGroupId: string | undefined;
  groupName: string;
  action: 'added' | 'removed';
}
