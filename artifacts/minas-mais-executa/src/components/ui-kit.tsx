import { ArrowDownRight, ArrowUpRight, Camera, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, Clock3, Download, FileVideo, Search, Share2, Store, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ComponentType, MouseEvent, ReactNode } from 'react';
import type { Activity, Task, TaskSummary } from '@workspace/api-client-react';
import { Link } from 'wouter';

export function formatDate(date?: string | null) {
  if (!date) return 'Hoje';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const value = dateOnly ? `${date}T12:00:00` : date;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    ...(dateOnly ? {} : { hour: '2-digit', minute: '2-digit' }),
  }).format(new Date(value));
}
export function formatDateTime(date?: string | null) {
  if (!date) return 'Hoje';
  const value = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00` : date;
  const formattedDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(value));
  const formattedTime = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  return `${formattedDate} às ${formattedTime}`;
}
export function formatFullDate(date?: string | null) {
  if (!date) return '—';
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const value = dateOnly ? `${date}T12:00:00` : date;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(dateOnly ? {} : { hour: '2-digit', minute: '2-digit' }),
  }).format(new Date(value));
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
export function TaskEvidenceExportButton({ taskId, taskTitle, scope = 'task', taskStatus, storeName }: { taskId: string; taskTitle: string; scope?: 'task' | 'store'; taskStatus?: string; storeName?: string }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [preparedPdf, setPreparedPdf] = useState<File | null>(null);
  const [sharing, setSharing] = useState(false);
  const [canSharePreparedPdf, setCanSharePreparedPdf] = useState(false);
  const storeOnly = scope === 'store';
  const awaitingCompletion = storeOnly && taskStatus !== 'completed';
  const label = storeOnly ? 'Gerar PDF da loja' : 'Gerar PDF de todas as lojas';
  const documentTitle = storeOnly && storeName ? `${taskTitle} - ${storeName}` : `${taskTitle} - todas as lojas`;

  const downloadPdf = (file: File) => {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Let mobile browsers finish consuming the URL before revoking it.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  // Called directly by the share button: no fetch/await before navigator.share,
  // so mobile browsers receive a fresh user activation.
  const sharePdf = async (file: File) => {
    setSharing(true);
    try {
      if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
        setNotice('PDF pronto. Use Baixar PDF para salvar e enviar o documento.');
        return;
      }
      await navigator.share({ files: [file], title: `Evidências: ${taskTitle}` });
      setNotice('PDF entregue ao compartilhamento do aparelho.');
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      setNotice(name === 'AbortError'
        ? 'PDF pronto para compartilhar ou baixar.'
        : 'PDF pronto. Use Baixar PDF para salvar e enviar o documento.');
    } finally {
      setSharing(false);
    }
  };
  const exportPhotos = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (busy || awaitingCompletion) return;
    setBusy(true);
    setNotice('');
    setPreparedPdf(null);
    setCanSharePreparedPdf(false);
    try {
      const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/evidence/pdf?scope=${scope}`);
      if (!response.ok) {
        const error = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(error?.error ?? 'Não foi possível gerar o PDF desta tarefa.');
      }
      const blob = await response.blob();
      if (!blob.size || blob.type.split(';')[0] !== 'application/pdf') {
        throw new Error('O servidor não retornou um PDF válido. Tente gerar novamente.');
      }
      const header = await blob.slice(0, 5).text();
      const trailer = await blob.slice(-1024).text();
      if (header !== '%PDF-' || !trailer.includes('%%EOF')) {
        throw new Error('O PDF recebido está incompleto. Gere novamente antes de compartilhar.');
      }
      const pdfName = `${documentTitle.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_')}-evidencias.pdf`;
      const pdfFile = new File([blob], pdfName, { type: 'application/pdf' });
      setPreparedPdf(pdfFile);
      let canSharePdf = false;
      try {
        canSharePdf = typeof navigator.share === 'function'
          && typeof navigator.canShare === 'function'
          && navigator.canShare({ files: [pdfFile] });
      } catch {
        // Download remains available when capability detection is unavailable.
      }
      setCanSharePreparedPdf(canSharePdf);
      setNotice('PDF pronto. Escolha como deseja salvar ou enviar.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Não foi possível gerar o PDF desta tarefa.');
    } finally {
      setBusy(false);
    }
  };

  return <span className="task-export-control">
    <button type="button" className="button task-export-button" onClick={exportPhotos} disabled={busy || sharing || awaitingCompletion} title={awaitingCompletion ? 'Disponível quando a tarefa desta loja estiver concluída' : label} aria-label={`${label}: ${documentTitle}`} data-testid={`button-export-task-photos-${taskId}`}>
      {busy ? <Download size={14} /> : <Share2 size={14} />}
      {busy ? 'Gerando PDF...' : preparedPdf ? 'Gerar novamente' : 'Gerar PDF'}
    </button>
    {awaitingCompletion && <span className="task-export-notice">Disponível ao concluir a loja.</span>}
    {preparedPdf && <span className="task-pdf-actions">
      {canSharePreparedPdf && <button type="button" className="button task-pdf-share" disabled={busy || sharing} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void sharePdf(preparedPdf); }} data-testid={`button-share-task-pdf-${taskId}`}><Share2 size={15} />{sharing ? 'Compartilhando...' : 'Compartilhar PDF'}</button>}
      <button type="button" className="button task-pdf-download" disabled={busy || sharing} onClick={(event) => { event.preventDefault(); event.stopPropagation(); downloadPdf(preparedPdf); }} data-testid={`button-save-task-pdf-${taskId}`}><Download size={15} />Baixar PDF</button>
    </span>}
    {notice && <span className="task-export-notice" role="status">{notice}</span>}
  </span>;
}
export function initials(name: string) {
  return name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}
export function roleLabel(role: string) {
  return ({ manager: 'Gerente de loja', supervisor: 'Supervisão', admin: 'Administração' } as Record<string, string>)[role] || role;
}
export function statusLabel(status: string) {
  return ({ pending: 'Pendente', in_progress: 'Em execução', pending_review: 'Pendente de aprovação', rejected: 'Reprovada', completed: 'Concluída', overdue: 'Atrasada' } as Record<string, string>)[status] || status;
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
export function TaskRow({ task, onDelete, selected = false, onToggleSelect, onOpenTask, showStatus = false, canExportEvidence = true }: { task: TaskListItem; onDelete?: (task: TaskListItem) => void; selected?: boolean; onToggleSelect?: (taskId: string) => void; onOpenTask?: () => void; showStatus?: boolean; canExportEvidence?: boolean }) {
  const detailHref = task.batchGroupId ? `/tasks/${task.id}?returnTo=stores` : `/tasks/${task.id}`;
  return <div className={`task-row task-row-result result-${task.status === 'completed' ? 'completed' : 'open'} task-status-${task.status}`} data-testid={`row-task-${task.id}`}>
    {onToggleSelect && <input type="checkbox" className="task-select-checkbox" checked={selected} onChange={() => onToggleSelect(task.id)} onClick={(event) => event.stopPropagation()} aria-label={`Selecionar ${task.title} da ${task.storeName}`} data-testid={`checkbox-select-task-${task.id}`} />}
    <span className={`task-status-dot dot-${task.status}`} aria-hidden="true" />
    <Link href={detailHref} className="task-main" onClick={onOpenTask} data-testid={`link-task-${task.id}`}>
      <div className="task-title">{task.title}</div><div className="task-sub">{task.category} · <mark className="task-person-highlight">{task.storeName}</mark> · {task.assigneeRole === 'supervisor' ? 'Supervisor: ' : ''}<mark className="task-person-highlight">{task.assignee}</mark></div>
      <div className="task-dates">Criada em {formatFullDate(task.createdAt)} por {task.createdByName} · Executar em {formatFullDate(task.dueDate)} às {task.dueTime}</div>
      {task.status === 'pending_review' && <div className="task-row-status-note task-row-status-note-review"><Clock3 size={13} aria-hidden="true" /><span>Pendente de aprovação do supervisor</span></div>}
      {task.status === 'rejected' && <div className="task-row-status-note task-row-status-note-rejected">Reprovada pelo supervisor · veja a orientação</div>}
    </Link>
    {showStatus
      ? <StatusPill status={task.status} />
      : task.status === 'pending_review'
         ? <span className="status-chip status-pending_review task-row-status-chip">Aprovação pendente</span>
        : task.status === 'rejected'
          ? <span className="status-chip status-rejected task-row-status-chip">Reprovada</span>
          : null}
    <PriorityPill priority={task.priority} /><span className="task-time">{task.dueTime}</span>{canExportEvidence && <TaskEvidenceExportButton taskId={task.id} taskTitle={task.title} scope="store" taskStatus={task.status} storeName={task.storeName} />}{onDelete && <button className="icon-button task-delete-button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onDelete(task); }} aria-label={`Excluir ${task.title}`} data-testid={`button-delete-task-${task.id}`}><Trash2 size={14} /></button>}<ChevronRight size={15} color="hsl(var(--muted-foreground))" />
  </div>;
}
export function TaskGroupRow({ tasks, onDelete, selectedTaskIds = new Set<string>(), onToggleSelect, onToggleGroupSelect, canManageTask, expanded = false, onExpandedChange, onOpenTask, showProgress = false, showTaskStatus = false, executionQueue = false, groupId }: { tasks: TaskListItem[]; onDelete?: (task: TaskListItem) => void; selectedTaskIds?: Set<string>; onToggleSelect?: (taskId: string) => void; onToggleGroupSelect?: (taskIds: string[]) => void; canManageTask?: (task: TaskListItem) => boolean; expanded?: boolean; onExpandedChange?: (expanded: boolean) => void; onOpenTask?: () => void; showProgress?: boolean; showTaskStatus?: boolean; executionQueue?: boolean; groupId?: string }) {
  const first = tasks[0];
  if (!first) return null;
  const storeTasks = new Map<string, TaskListItem[]>();
  tasks.forEach((task) => storeTasks.set(task.storeId, [...(storeTasks.get(task.storeId) ?? []), task]));
  const storeCount = storeTasks.size;
  const storeTaskGroups = [...storeTasks.values()];
  const completedCount = storeTaskGroups.filter((storeGroup) => storeGroup.every((task) => task.status === 'completed')).length;
  const statuses = new Set(tasks.map((task) => task.status));
  const hasExecutionPending = tasks.some((task) => ['pending', 'in_progress', 'overdue', 'rejected'].includes(task.status));
  const groupStatus = executionQueue
    ? hasExecutionPending
      ? statuses.has('rejected') ? 'rejected' : statuses.has('overdue') ? 'overdue' : statuses.has('in_progress') ? 'in_progress' : 'pending'
      : statuses.has('pending_review') ? 'pending_review' : 'completed'
    : statuses.has('rejected')
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
  return <div className={`task-group-card task-row-result result-${resultStatus}`}>
    <details className="task-group" open={expanded} onToggle={(event) => onExpandedChange?.(event.currentTarget.open)} data-testid={`group-task-${groupId ?? first.batchGroupId ?? first.id}`}>
     <summary className={`task-row task-row-result result-${resultStatus} task-group-summary task-status-${groupStatus}`}>
       {onToggleGroupSelect && tasks.every((task) => canManageTask?.(task) ?? true) && <input type="checkbox" className="task-select-checkbox" checked={tasks.length > 0 && tasks.every((task) => selectedTaskIds.has(task.id))} onChange={() => onToggleGroupSelect(tasks.map((task) => task.id))} onClick={(event) => event.stopPropagation()} aria-label={`Selecionar conjunto ${first.title}`} data-testid={`checkbox-select-task-group-${groupId ?? first.batchGroupId ?? first.id}`} />}
       <span className={`task-status-dot dot-${groupStatus}`} aria-hidden="true" />
      <span className="task-main">
        <span className="task-title">{first.title}</span>
        <span className="task-sub"><Store size={13} /> {showProgress
          ? `${completedCount}/${storeCount} lojas concluídas · ${storeCount - completedCount} ainda precisam concluir · clique para abrir as lojas`
         : `Todas as lojas · ${storeCount} unidades · Clique para acompanhar`}</span>
        <span className="task-dates">Criada em {formatFullDate(first.createdAt)} · Executar em {formatFullDate(first.dueDate)} às {first.dueTime}</span>
      </span>
         {showProgress ? <StatusPill status={groupStatus} /> : groupStatus === 'pending_review' ? <span className="status-chip status-pending_review task-row-status-chip">Pendente de aprovação</span> : groupStatus === 'rejected' ? <span className="status-chip status-rejected task-row-status-chip">Reprovada</span> : null}<PriorityPill priority={first.priority} /><span className="task-time">{first.dueTime}</span><ChevronDown className="task-group-chevron" size={15} />
    </summary>
        <div className="task-group-items">{tasks.map((task) => <TaskRow key={task.id} task={task} onDelete={canManageTask?.(task) ?? true ? onDelete : undefined} selected={selectedTaskIds.has(task.id)} onToggleSelect={canManageTask?.(task) ?? true ? onToggleSelect : undefined} onOpenTask={onOpenTask} showStatus={showTaskStatus} />)}</div>
    </details>
    <div className="task-group-actions"><TaskEvidenceExportButton taskId={first.id} taskTitle={first.title} /></div>
  </div>;
}
export function ActivityItem({ activity }: { activity: Activity }) {
  return <div className="activity-item" data-testid={`activity-${activity.id}`}><span className={`activity-mark mark-${activity.tone}`} /><div><div className="activity-title">{activity.title}</div><div className="activity-detail">{activity.detail}</div><div className="activity-date">{formatDate(activity.createdAt)}</div></div></div>;
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