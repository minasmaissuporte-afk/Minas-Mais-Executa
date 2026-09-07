import { ArrowLeft, CheckCircle2, CircleAlert, Paperclip, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetActivityQueryKey, getGetDashboardSummaryQueryKey, getGetTaskQueryKey, getListTasksQueryKey, useAddTaskEvidence, useCompleteTask, useGetTask, useRequestUploadUrl, useUpdateTask } from '@workspace/api-client-react';
import type { Evidence } from '@workspace/api-client-react';
import { useParams, Link } from 'wouter';
import { fallbackTasks } from '@/lib/demo-data';
import { EmptyState, ErrorState, EvidenceIcon, formatDate, LoadingBlocks, PriorityPill, StatusPill } from '@/components/ui-kit';

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const taskId = id || fallbackTasks[0].id;
  const client = useQueryClient();
  const taskQuery = useGetTask(taskId, { query: { queryKey: getGetTaskQueryKey(taskId), enabled: !!taskId } });
  const updateTask = useUpdateTask(); const addEvidence = useAddTaskEvidence(); const completeTask = useCompleteTask(); const requestUpload = useRequestUploadUrl();
  const [notice, setNotice] = useState('');
  const task = taskQuery.data ?? fallbackTasks.find((item) => item.id === taskId) ?? fallbackTasks[0];
  const evidence = taskQuery.data?.evidence ?? task.evidence ?? [];
  const invalidateTask = () => {
    client.invalidateQueries({ queryKey: getGetTaskQueryKey(task.id) }); client.invalidateQueries({ queryKey: getListTasksQueryKey() }); client.invalidateQueries({ queryKey: getListTasksQueryKey({ status: 'pending' }) }); client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };
  const updateStatus = (next: 'pending' | 'in_progress') => updateTask.mutate({ id: task.id, data: { status: next } }, { onSuccess: () => { invalidateTask(); setNotice(next === 'in_progress' ? 'Tarefa assumida.' : 'Tarefa devolvida para pendências.'); }, onError: () => setNotice('Não foi possível atualizar o status.') });
  const capture = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const type = (file.type.includes('video') ? 'video' : 'photo') as 'video' | 'photo';
    try {
      const upload = await requestUpload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type || 'application/octet-stream' } });
      await fetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      await addEvidence.mutateAsync({ id: task.id, data: { type, fileName: file.name, location: task.storeName } });
      invalidateTask(); client.invalidateQueries({ queryKey: getGetActivityQueryKey() }); setNotice('Evidência adicionada e enviada.');
    } catch { setNotice('Não foi possível enviar a evidência. Tente novamente.'); }
  };
  const complete = () => completeTask.mutate({ id: task.id }, { onSuccess: () => { invalidateTask(); client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); client.invalidateQueries({ queryKey: getGetActivityQueryKey() }); setNotice('Tarefa concluída.'); }, onError: () => setNotice('Adicione as evidências obrigatórias antes de concluir.') });
  return <div className="content"><Link href="/tasks" className="section-link" style={{ marginBottom: 17 }} data-testid="link-back-tasks"><ArrowLeft size={13} /> Voltar para tarefas</Link>{taskQuery.isError && <ErrorState onRetry={() => taskQuery.refetch()} />}{taskQuery.isLoading && !taskQuery.data ? <LoadingBlocks rows={2} /> : <div className="detail-layout"><div><section className="detail-hero"><div className="eyebrow">Execução · {task.category}</div><h1 className="detail-title">{task.title}</h1><div className="detail-meta"><span>{task.storeName}</span><span>•</span><span>{task.assignee}</span><span>•</span><span>vence {formatDate(task.dueDate)} às {task.dueTime}</span></div></section>
    <section className="card card-pad detail-section"><h3>O que precisa ser feito</h3><p className="detail-copy">{task.description || 'Sem descrição adicional.'}</p></section>
    <section className="card card-pad detail-section"><h3>Instruções de comprovação</h3><p className="detail-copy">{task.instructions || 'Registre o resultado da execução com uma observação objetiva.'}</p></section>
    <section className="card card-pad detail-section"><div className="section-heading"><h3 style={{ margin: 0 }}>Evidências <span className="stat-meta">({evidence.length})</span></h3>{task.evidenceRequired && <span className="status-chip status-in_progress">Obrigatória</span>}</div>{evidence.length ? <div className="evidence-list">{evidence.map((item: Evidence) => <div className="evidence-item" key={item.id} data-testid={`evidence-${item.id}`}><span className="evidence-icon"><EvidenceIcon type={item.type} /></span><div><div className="evidence-file">{item.fileName}</div><div className="evidence-by">{item.userName} · {formatDate(item.createdAt)}{item.location ? ` · ${item.location}` : ''}</div></div></div>)}</div> : <EmptyState icon={Paperclip} title="Ainda sem evidências" copy="Adicione uma foto ou vídeo para comprovar a execução." />}</section>
  </div><aside className="sticky-card"><section className="card action-card"><h3>Próximo passo</h3>{task.status === 'completed' ? <div className="completion-state"><CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: 7 }} /> Concluída por {task.completedBy || 'Marina Alves'}</div> : <><label className="capture-button" htmlFor="evidence-file"><UploadCloud size={18} /> {addEvidence.isPending || requestUpload.isPending ? 'Enviando...' : 'Adicionar evidência'}<input id="evidence-file" type="file" accept="image/*,video/*" className="hidden-file" onChange={capture} disabled={addEvidence.isPending || requestUpload.isPending} data-testid="input-evidence-file" /></label><div style={{ height: 10 }} /><button className="button button-primary" style={{ width: '100%', minHeight: 45 }} onClick={complete} disabled={completeTask.isPending || (task.evidenceRequired && evidence.length === 0)} data-testid="button-complete-task"><CheckCircle2 size={16} /> {completeTask.isPending ? 'Concluindo...' : 'Concluir tarefa'}</button>{task.evidenceRequired && evidence.length === 0 && <div className="stat-meta" style={{ display: 'flex', gap: 6, marginTop: 10, color: 'hsl(var(--accent-foreground))' }}><CircleAlert size={13} /> Evidência obrigatória para concluir.</div>}{task.status === 'pending' && <button className="button button-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => updateStatus('in_progress')} disabled={updateTask.isPending} data-testid="button-start-task">Começar execução</button>}{task.status === 'in_progress' && <button className="button button-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => updateStatus('pending')} disabled={updateTask.isPending} data-testid="button-pause-task">Deixar para depois</button>}</>}</section>{notice && <div className="stat-meta" style={{ padding: '12px 4px', color: notice.includes('não') || notice.includes('Não') ? 'hsl(var(--destructive))' : 'hsl(var(--primary))' }} data-testid="status-task-notice">{notice}</div>}<section className="card card-pad" style={{ marginTop: 14 }}><div className="section-title" style={{ marginBottom: 10 }}>Resumo rápido</div><div className="stat-meta" style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0' }}><span>Status</span><StatusPill status={task.status} /></div><div className="stat-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0' }}><span>Prioridade</span><PriorityPill priority={task.priority} /></div></section></aside></div>}</div>;
}