import type { WidgetType } from './types';

export type WidgetItem = { type: WidgetType; icon: string; label: string; desc: string };
export type WidgetGroup = { label: string; items: WidgetItem[] };

export const WIDGET_GROUPS: WidgetGroup[] = [
  {
    label: '업무 & 목표',
    items: [
      { type: 'task',     icon: '✓',   label: '작업',     desc: '할 일 & 태스크' },
      { type: 'goal',     icon: '🎯',  label: '목표',     desc: 'OKR & 핵심 결과' },
      { type: 'calendar', icon: '📅',  label: '캘린더',   desc: '일정 & 이벤트 관리' },
      { type: 'worklog',  icon: '📋',  label: '작업로그', desc: '팀 작업 기록 & 로그' },
    ],
  },
  {
    label: '세일즈 & 재무',
    items: [
      { type: 'lead',      icon: '💼',   label: '리드',      desc: '세일즈 파이프라인' },
      { type: 'funnel',    icon: '📊',   label: '퍼널',      desc: '리드 집계 차트' },
      { type: 'finance',   icon: '💰',   label: '재무 현황', desc: '인보이스 & 재무 대시보드' },
      { type: 'directory', icon: '👥',   label: '디렉토리',  desc: '인원 & 연락처 목록' },
    ],
  },
  {
    label: '콘텐츠 & 자료',
    items: [
      { type: 'note',       icon: '📝',   label: '메모',       desc: '자유 텍스트 메모' },
      { type: 'textbox',    icon: 'T',    label: '텍스트박스', desc: '자유 텍스트 배치' },
      { type: 'image',      icon: '🖼️',  label: '이미지',     desc: '이미지 & 사진' },
      { type: 'link',       icon: '🔗',   label: '링크',       desc: 'URL 북마크' },
      { type: 'fileupload', icon: '📁',   label: '파일',       desc: '파일 업로드 & 보관' },
      { type: 'embed',      icon: '🔲',   label: '임베드',     desc: 'Figma·YouTube·Docs 미리보기' },
      { type: 'html',       icon: '⟨/⟩', label: 'HTML',       desc: 'HTML 미리보기' },
    ],
  },
];
