import { Clock3 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

function durationLabel(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return days > 0
    ? `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}min`
    : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function TaskDeadline({ dueDate, dueTime, status }: { dueDate: string; dueTime: string; status: string }) {
  const deadline = useMemo(() => new Date(`${dueDate}T${dueTime || '23:59'}:00`).getTime(), [dueDate, dueTime]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status === 'completed') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  if (status === 'completed') {
    return <div className="deadline-countdown done"><Clock3 size={15} /> Prazo encerrado — tarefa concluída</div>;
  }

  const remaining = deadline - now;
  return (
    <div className={`deadline-countdown ${remaining <= 0 ? 'late' : ''}`} aria-live="polite">
      <Clock3 size={15} />
      <span>
        <small>{remaining <= 0 ? 'Prazo ultrapassado' : 'Tempo restante'}</small>
        <strong>{durationLabel(Math.abs(remaining))}</strong>
      </span>
    </div>
  );
}