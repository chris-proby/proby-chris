import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

const DURATION = 5000;

export default function GroupChangeToast() {
  const pendingGroupChange = useStore((s) => s.pendingGroupChange);
  const confirmGroupChange = useStore((s) => s.confirmGroupChange);
  const revertGroupChange = useStore((s) => s.revertGroupChange);

  const [progress, setProgress] = useState(100);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (!pendingGroupChange) {
      setProgress(100);
      return;
    }

    setProgress(100);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.max(0, 100 - (elapsed / DURATION) * 100);
      setProgress(pct);
      if (pct <= 0) {
        clearInterval(timerRef.current!);
        confirmGroupChange();
      }
    }, 40);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [pendingGroupChange?.widgetId, pendingGroupChange?.newGroupId, confirmGroupChange]);

  if (!pendingGroupChange) return null;

  const { action, groupName } = pendingGroupChange;
  const icon = action === 'added' ? '⬡' : '↗';
  const msg = action === 'added'
    ? `'${groupName}'에 추가했습니다`
    : `'${groupName}'에서 제거했습니다`;

  return (
    <div className="group-toast">
      <div className="group-toast-body">
        <span className="group-toast-icon">{icon}</span>
        <span className="group-toast-msg">{msg}</span>
        <button className="group-toast-undo" onClick={revertGroupChange}>취소</button>
      </div>
      <div className="group-toast-bar">
        <div className="group-toast-progress" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
