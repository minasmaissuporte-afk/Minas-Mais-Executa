import { ArrowDownRight, ArrowUpRight, Camera, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, FileVideo, Search, Store, Trash2 } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';
import type { Activity, Task, TaskSummary } from '@workspace/api-client-react';
import { Link } from 'wouter';

export function formatDate(date?: string | null) {
  if (!date) return 'Hoje';
  const value = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00` : date;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(value));
}
export function formatFullDate(date?: string | null) {
  if (!date) return '—';
  const value = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00` : date;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}
export function formatTime(date?: string | null) {
  if (!date) return '';
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(date));
}
export function formatDurationMinutes(minutes: number) {
  if (!minutes) return '—';
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const remainingMinutes = minutes % 60;
  if (days) return `${days}d${hours ? ` ${hours}h` : ''}`;
  if (hours) return `${hours}h${remainingMinutes ? `${remainingMinutes}min` : ''}`;
  return `${remainingMinutes}min`;
}
type TaskListItem = Task | TaskSummary;
export function initials(name: string) {
  return name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}
export function roleLabel(role: string) {
  return ({ manager: 'Gerente de loja', supervisor: 'Supervisão', admin: 'Administração' } as Record<string, string>)[role] || role;
}
export function statusLabel(status: string) {
  return ({ pending: 'Pendente', in_progress: 'Em execução', pending_review: 'Aguardando conferência', rejected: 'Reprovada', completed: 'Concluída', overdue: 'Atrasada' } as Record<string, string>)[status] || status;
}
export function priorityLabel(priority: string) {
  return ({ high: 'Alta', medium: 'Média', low: 'Baixa' } as Record<string, string>)[priority] || priority;
}

export function LoadingBlocks({ rows = 3 }: { rows?: number }) {
  return <div className="card card-pad" aria-label="Carregando" data-testid="status-loading">{Array.from({ length: rows }).map((_, index) => <div key={index}><div className="skeleton" /><div className="skeleton short" /><div className="skeleton line" /></div>)}</div>;
}
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return <div className="error-state" data-testid="status-error">Não foi possível carregar os dados agora.<button className="button button-danger" onClick={onRetry} data-testid="button-retry">Tentar novamente</button></div>;
}
export function EmptyState({ icon: Icon = CheckCircle2, title, copy, action }: { icon?: ComponentType<{ size?: number }>; title: string; copy: string; action?: ReactNode }) {
  return <div className="empty-state" data-testid="status-empty"><Icon size={25} /><h3>{title}</h3><p>{copy}</p>{action}</div>;
}
export function StatusPill({ status }: { status: string }) {
  return <span className={`status-chip status-${status}`} data-testid={`status-pill-${status}`}>{statusLabel(status)}</span>;
}
export function PriorityPill({ priority }: { priority: string }) {
  return <span className={`priority priority-${priority}`} data-testid={`priority-pill-${priority}`}>{priorityLabel(priority)}</span>;
}
export function TaskRow({ task, onDelete, selected = false, onToggleSelect }: { task: TaskListItem; onDelete?: (task: TaskListItem) => void; selected?: boolean; onToggleSelect?: (taskId: string) => void }) {
  return <div className={`task-row task-row-result result-${task.status === 'completed' ? 'completed' : 'open'} task-status-${task.status}`} data-testid={`row-task-${task.id}`}>
    {onToggleSelect && <input type="checkbox" className="task-select-checkbox" checked={selected} onChange={() => onToggleSelect(task.id)} onClick={(event) => event.stopPropagation()} aria-label={`Selecionar ${task.title} da ${task.storeName}`} data-testid={`checkbox-select-task-${task.id}`} />}
    <span className={`task-status-dot dot-${task.status}`} aria-hidden="true" />
    <Link href={`/tasks/${task.id}`} className="task-main" data-testid={`link-task-${task.id}`}>
      <div className="task-title">{task.title}</div><div className="task-sub">{task.category} · {task.storeName} · {task.assigneeRole === 'supervisor' ? 'Supervisor: ' : ''}{task.assignee}</div>
      <div className="task-dates">Criada em {formatFullDate(task.createdAt)} por {task.createdByName} · Executar em {formatFullDate(task.dueDate)} às {task.dueTime}</div>
      {task.status === 'pending_review' && <div className="task-row-status-note task-row-status-note-review">Aguardando conferência do supervisor</div>}
      {task.status === 'rejected' && <div className="task-row-status-note task-row-status-note-rejected">Reprovada pelo supervisor · veja a orientação</div>}
    </Link>
   {task.status === 'pending_review' && <span className="status-chip status-pending_review task-row-status-chip">Conferência</span>}{task.status === 'rejected' && <span className="status-chip status-rejected task-row-status-chip">Reprovada</span>}<PriorityPill priority={task.priority} /><span className="task-time">{task.dueTime}</span>{onDelete && <button className="icon-button task-delete-button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onDelete(task); }} aria-label={`Excluir ${task.title}`} data-testid={`button-delete-task-${task.id}`}><Trash2 size={14} /></button>}<ChevronRight size={15} color="hsl(var(--muted-foreground))" />
  </div>;
}
export function TaskGroupRow({ tasks, onDelete, selectedTaskIds = new Set<string>(), onToggleSelect, onToggleGroupSelect }: { tasks: TaskListItem[]; onDelete?: (task: TaskListItem) => void; selectedTaskIds?: Set<string>; onToggleSelect?: (taskId: string) => void; onToggleGroupSelect?: (taskIds: string[]) => void }) {
  const first = tasks[0];
  if (!first) return null;
  const statuses = new Set(tasks.map((task) => task.status));
  const groupStatus = statuses.has('rejected')
    ? 'rejected'
    : statuses.has('pending_review')
      ? 'pending_review'
      : statuses.has('overdue')
        ? 'overdue'
        : statuses.has('in_progress')
          ? 'in_progress'
          : statuses.has('pending')
            ? 'pending'
            : 'completed';
  const resultStatus = tasks.every((task) => task.status === 'completed') ? 'completed' : 'open';
  return <details className="task-group" data-testid={`group-task-${first.batchGroupId}`}>
     <summary className={`task-row task-row-result result-${resultStatus} task-group-summary task-status-${groupStatus}`}>
       {onToggleGroupSelect && <input type="checkbox" className="task-select-checkbox" checked={tasks.length > 0 && tasks.every((task) => selectedTaskIds.has(task.id))} onChange={() => onToggleGroupSelect(tasks.map((task) => task.id))} onClick={(event) => event.stopPropagation()} aria-label={`Selecionar conjunto ${first.title}`} data-testid={`checkbox-select-task-group-${first.batchGroupId}`} />}
       <span className={`task-status-dot dot-${groupStatus}`} aria-hidden="true" />
      <span className="task-main">
        <span className="task-title">{first.title}</span>
        <span className="task-sub"><Store size={13} /> Todas as lojas · {tasks.length} unidades · Clique para acompanhar</span>
        <span className="task-dates">Criada em {formatFullDate(first.createdAt)} · Executar em {formatFullDate(first.dueDate)} às {first.dueTime}</span>
      </span>
       {groupStatus === 'pending_review' && <span className="status-chip status-pending_review task-row-status-chip">Conferência</span>}{groupStatus === 'rejected' && <span className="status-chip status-rejected task-row-status-chip">Reprovada</span>}<PriorityPill priority={first.priority} /><span className="task-time">{first.dueTime}</span><ChevronDown className="task-group-chevron" size={15} />
    </summary>
     <div className="task-group-items">{tasks.map((task) => <TaskRow key={task.id} task={task} onDelete={onDelete} selected={selectedTaskIds.has(task.id)} onToggleSelect={onToggleSelect} />)}</div>
  </details>;
}
export function ActivityItem({ activity }: { activity: Activity }) {
  return <div className="activity-item" data-testid={`activity-${activity.id}`}><span className={`activity-mark mark-${activity.tone}`} /><div><div className="activity-title">{activity.title}</div><div className="activity-detail">{activity.detail}</div><div className="activity-date">{formatDate(activity.createdAt)} · {formatTime(activity.createdAt)}</div></div></div>;
}
export function MetricCard({ label, value, meta, tone = '' }: { label: string; value: string | number; meta: string; tone?: string }) {
  return <div className={`card stat-card ${tone}`} data-testid={`metric-${label.toLowerCase().replace(/\s+/g, '-')}`}><span className="stat-label">{label}</span><span className="stat-value">{value}</span><span className="stat-meta">{meta}</span></div>;
}
export function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <ArrowUpRight size={15} />;
  if (trend === 'down') return <ArrowDownRight size={15} />;
  return <span aria-hidden="true">—</span>;
}
export function SearchEmpty({ title = 'Nenhum resultado', copy = 'Tente outro termo ou ajuste os filtros.' }: { title?: string; copy?: string }) {
  return <EmptyState icon={Search} title={title} copy={copy} />;
}
export function EvidenceIcon({ type }: { type: string }) {
  return type === 'video' ? <FileVideo size={15} /> : <Camera size={15} />;
}
export function AlertIcon() { return <CircleAlert size={17} />; }