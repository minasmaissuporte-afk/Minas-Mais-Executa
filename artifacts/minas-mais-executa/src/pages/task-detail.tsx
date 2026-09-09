import { ArrowLeft, CheckCircle2, CircleAlert, Paperclip, Trash2, UploadCloud } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetActivityQueryKey, getGetDashboardSummaryQueryKey, getGetTaskQueryKey, getListTasksQueryKey, useAddTaskEvidence, useCompleteTask, useDeleteTask, useGetMe, useGetTask, useRequestUploadUrl, useUpdateTask } from '@workspace/api-client-react';
import type { Evidence } from '@workspace/api-client-react';
import { useParams, Link, useLocation } from 'wouter';
import { EmptyState, ErrorState, EvidenceIcon, formatDate, LoadingBlocks, PriorityPill, StatusPill } from '@/components/ui-kit';
import { TaskDeadline } from '@/components/task-deadline';

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const taskId = id || '';
  const client = useQueryClient();
  const taskQuery = useGetTask(taskId, { query: { queryKey: getGetTaskQueryKey(taskId), enabled: !!taskId } });
  const me = useGetMe();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const addEvidence = useAddTaskEvidence();
  const completeTask = useCompleteTask();
  const requestUpload = useRequestUploadUrl();
  const [notice, setNotice] = useState('');
  const [, navigate] = useLocation();
  const task = taskQuery.data;
  const evidence = task?.evidence ?? [];
  const invalidateTask = () => {
    if (!task) return;
    client.invalidateQueries({ queryKey: getGetTaskQueryKey(task.id) });
    client.invalidateQueries({ queryKey: getListTasksQueryKey() });
    client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };
  const canExecute = !!task && (me.data?.role === 'admin' || task.assigneeMemberId === me.data?.id);
  const updateStatus = (status: 'pending' | 'in_progress') => {
    if (!task) return;
    updateTask.mutate({ id: task.id, data: { status } }, { onSuccess: () => { invalidateTask(); setNotice(status === 'in_progress' ? 'Tarefa assumida.' : 'Tarefa devolvida para pendências.'); }, onError: () => setNotice('Não foi possível atualizar o status.') });
  };
  const capture = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !task) return;
    try {
      const type = (file.type.includes('video') ? 'video' : 'photo') as 'video' | 'photo';
      const upload = await requestUpload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type || 'application/octet-stream' } });
      const response = await fetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      if (!response.ok) throw new Error('Upload failed');
      await addEvidence.mutateAsync({ id: task.id, data: { type, fileName: file.name, objectPath: upload.objectPath, location: task.storeName } });
      invalidateTask();
      client.invalidateQueries({ queryKey: getGetActivityQueryKey() });
      setNotice('Evidência adicionada e enviada.');
    } catch { setNotice('Não foi possível enviar a evidência. Tente novamente.'); }
  };
  const complete = () => {
    if (!task) return;
    completeTask.mutate({ id: task.id }, { onSuccess: () => { invalidateTask(); setNotice('Tarefa concluída.'); }, onError: () => setNotice('Adicione as evidências obrigatórias antes de concluir.') });
  };
  const removeTask = () => {
    if (!task || !window.confirm(`Excluir definitivamente "${task.title}"? Esta ação apagará a tarefa e suas evidências.`)) return;
    deleteTask.mutate({ id: task.id }, {
      onSuccess: () => navigate('/tasks'),
      onError: () => setNotice('Não foi possível excluir a tarefa.'),
    });
  };
  return <div className="content">
     <Link href="/tasks" className="section-link" style={{ marginBottom: 17 }} data-testid="link-back-tasks"><ArrowLeft size={13} /> Voltar para tarefas</Link>{me.data?.role === 'admin' && task && <button className="button button-danger" style={{ float: 'right' }} onClick={removeTask} disabled={deleteTask.isPending}><Trash2 size={15} /> {deleteTask.isPending ? 'Excluindo...' : 'Excluir tarefa'}</button>}
    {taskQuery.isError ? <ErrorState onRetry={() => taskQuery.refetch()} /> : taskQuery.isLoading ? <LoadingBlocks rows={2} /> : !task ? <EmptyState title="Tarefa não encontrada" copy="Ela pode não estar disponível para o seu acesso." /> : <div className="detail-layout"><div>
      <section className="detail-hero"><div className="eyebrow">Execução · {task.category}</div><h1 className="detail-title">{task.title}</h1><div className="detail-meta"><span>{task.storeName}</span><span>•</span><span>{task.assignee}</span><span>•</span><span>Criada em {formatDate(task.createdAt)}</span><span>•</span><span>Executar em {formatDate(task.dueDate)} às {task.dueTime}</span></div></section>
      <section className="card card-pad detail-section"><h3>O que precisa ser feito</h3><p className="detail-copy">{task.description || 'Sem descrição adicional.'}</p></section>
      <section className="card card-pad detail-section"><h3>Instruções de comprovação</h3><p className="detail-copy">{task.instructions || 'Registre o resultado da execução com uma observação objetiva.'}</p></section>
     <section className="card card-pad detail-section"><div className="section-heading"><h3 style={{ margin: 0 }}>Evidências <span className="stat-meta">({evidence.length})</span></h3>{task.evidenceRequired && <span className="status-chip status-in_progress">Obrigatória</span>}</div>{evidence.length ? <div className="evidence-list">{evidence.map((item: Evidence) => <div className="evidence-item" key={item.id}><span className="evidence-icon"><EvidenceIcon type={item.type} /></span><div><div className="evidence-file">{item.fileName}</div><div className="evidence-by">{item.userName} · {formatDate(item.createdAt)}{item.location ? ` · ${item.location}` : ''}</div>{item.objectPath && <>{item.type === 'photo' ? <img className="evidence-preview" src={`/api/storage${item.objectPath}`} alt={`Evidência: ${item.fileName}`} /> : <video className="evidence-preview" controls playsInline preload="metadata" src={`/api/storage${item.objectPath}`}>Seu navegador não oferece suporte a vídeo.</video>}<a className="section-link" href={`/api/storage${item.objectPath}`} target="_blank" rel="noreferrer">Abrir evidência</a></>}</div></div>)}</div> : <EmptyState icon={Paperclip} title="Ainda sem evidências" copy="Adicione uma foto ou vídeo para comprovar a execução." />}</section>
    </div><aside className="sticky-card"><TaskDeadline dueDate={task.dueDate} dueTime={task.dueTime} status={task.status} /><section className="card action-card"><h3>Próximo passo</h3>{task.status === 'completed' ? <div className="completion-state"><CheckCircle2 size={16} /> Concluída por {task.completedBy || '—'}</div> : canExecute ? <><label className="capture-button" htmlFor="evidence-file"><UploadCloud size={18} /> {addEvidence.isPending || requestUpload.isPending ? 'Enviando...' : 'Adicionar evidência'}<input id="evidence-file" type="file" accept="image/*,video/*" className="hidden-file" onChange={capture} disabled={addEvidence.isPending || requestUpload.isPending} /></label><div style={{ height: 10 }} /><button className="button button-success" style={{ width: '100%', minHeight: 45 }} onClick={complete} disabled={completeTask.isPending || (task.evidenceRequired && evidence.length === 0)}><CheckCircle2 size={16} /> Concluir tarefa</button>{task.evidenceRequired && evidence.length === 0 && <div className="stat-meta" style={{ marginTop: 10 }}><CircleAlert size={13} /> Evidência obrigatória para concluir.</div>}{task.status === 'pending' && <button className="button button-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => updateStatus('in_progress')}>Começar execução</button>}{task.status === 'in_progress' && <button className="button button-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => updateStatus('pending')}>Deixar para depois</button>}</> : <p className="stat-meta">Esta tarefa está visível para acompanhamento, mas foi atribuída a outro responsável.</p>}</section>{notice && <div className="stat-meta" style={{ padding: '12px 4px' }}>{notice}</div>}<section className="card card-pad" style={{ marginTop: 14 }}><div className="section-title">Resumo rápido</div><div className="stat-meta">Status <StatusPill status={task.status} /></div><div className="stat-meta">Prioridade <PriorityPill priority={task.priority} /></div></section></aside></div>}
  </div>;
}