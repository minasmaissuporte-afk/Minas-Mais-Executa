import { ArrowLeft, CheckCircle2, CircleAlert, MessageSquare, Paperclip, Trash2, UploadCloud } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetActivityQueryKey, getGetDashboardSummaryQueryKey, getGetTaskQueryKey, getListTaskSummariesQueryKey, getListTasksQueryKey, useAddTaskComment, useAddTaskEvidence, useCompleteTask, useDeleteTask, useDeleteTaskEvidence, useGetMe, useGetTask, useRequestUploadUrl, useReviewTask, useUpdateTask } from '@workspace/api-client-react';
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
  const deleteTaskEvidence = useDeleteTaskEvidence();
  const completeTask = useCompleteTask();
  const reviewTask = useReviewTask();
  const addComment = useAddTaskComment();
  const requestUpload = useRequestUploadUrl();
  const [notice, setNotice] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [newComment, setNewComment] = useState('');
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [, navigate] = useLocation();
  const task = taskQuery.data;
  const evidence = task?.evidence ?? [];
  const feedbackComments = task?.comments.filter((item) => item.type !== 'supervisor_rejection') ?? [];
  const rejectionComments = task?.comments.filter((item) => item.type === 'supervisor_rejection') ?? [];
  useEffect(() => {
    if (!selectedEvidence) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedEvidence(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [selectedEvidence]);
  const invalidateTask = () => {
    if (!task) return;
    client.invalidateQueries({ queryKey: getGetTaskQueryKey(task.id) });
    client.invalidateQueries({ queryKey: getListTasksQueryKey() });
    client.invalidateQueries({ queryKey: getListTaskSummariesQueryKey() });
    client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };
  const canExecute = !!task && task.status !== 'pending_review' && task.status !== 'completed' && (me.data?.role === 'admin' || task.assigneeMemberId === me.data?.id || task.assigneeMemberIds?.includes(me.data?.id ?? '') === true);
  const canReview = !!task && me.data?.role === 'supervisor' && task.status === 'pending_review';
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
  const removeEvidence = (item: Evidence) => {
    if (!task || !window.confirm(`Remover a evidência "${item.fileName}"? Ela será apagada permanentemente.`)) return;
    deleteTaskEvidence.mutate({ id: task.id, evidenceId: item.id }, {
      onSuccess: () => { invalidateTask(); setNotice('Evidência removida.'); },
      onError: () => setNotice('Não foi possível remover a evidência.'),
    });
  };
  const complete = () => {
    if (!task) return;
    completeTask.mutate({ id: task.id }, { onSuccess: () => { invalidateTask(); setNotice('Tarefa concluída.'); }, onError: () => setNotice('Adicione as evidências obrigatórias antes de concluir.') });
  };
  const review = (decision: 'approve' | 'reject') => {
    if (!task) return;
    reviewTask.mutate({ id: task.id, data: { decision, comment: reviewComment.trim() || undefined } }, {
      onSuccess: () => { invalidateTask(); setReviewComment(''); setNotice(decision === 'approve' ? 'Tarefa aprovada.' : 'Tarefa reprovada e devolvida ao gerente.'); },
      onError: () => setNotice('Não foi possível registrar a conferência.'),
    });
  };
  const comment = () => {
    if (!task || !newComment.trim()) return;
    addComment.mutate({ id: task.id, data: { message: newComment.trim() } }, {
      onSuccess: () => { invalidateTask(); setNewComment(''); setNotice('Comentário adicionado.'); },
      onError: () => setNotice('Não foi possível adicionar o comentário.'),
    });
  };
  const removeTask = () => {
    if (!task || !window.confirm(`Excluir definitivamente "${task.title}"? Esta ação apagará a tarefa e suas evidências.`)) return;
    deleteTask.mutate({ id: task.id }, {
      onSuccess: () => navigate('/tasks'),
      onError: () => setNotice('Não foi possível excluir a tarefa.'),
    });
  };
   return <div className="content">
     <Link href="/tasks" className="section-link" style={{ marginBottom: 17 }} data-testid="link-back-tasks"><ArrowLeft size={13} /> Voltar para tarefas</Link>
     {me.data?.role === 'admin' && task && <button className="button button-danger" style={{ float: 'right' }} onClick={removeTask} disabled={deleteTask.isPending}><Trash2 size={15} /> {deleteTask.isPending ? 'Excluindo...' : 'Excluir tarefa'}</button>}
     {taskQuery.isError ? <ErrorState onRetry={() => taskQuery.refetch()} /> : taskQuery.isLoading ? <LoadingBlocks rows={2} /> : !task ? <EmptyState title="Tarefa não encontrada" copy="Ela pode não estar disponível para o seu acesso." /> : <div className="detail-layout">
       <div>
           <section className="detail-hero"><div className="eyebrow">Execução · {task.category}</div><h1 className="detail-title">{task.title}</h1><div className="detail-meta"><span>{task.storeName}</span><span>•</span><span>{task.assignee}</span><span>•</span><span>Criada por {task.createdByName}</span><span>•</span><span>Em {formatDate(task.createdAt)}</span><span>•</span><span>Executar em {formatDate(task.dueDate)} às {task.dueTime}</span></div>{task.status === 'pending_review' && <div className="task-status-banner task-status-banner-pending_review"><strong>Aguardando conferência do supervisor</strong><span>O gerente concluiu a execução. A tarefa será encerrada após a aprovação.</span></div>}{task.status === 'rejected' && <div className="task-status-banner task-status-banner-rejected"><strong>Tarefa reprovada pelo supervisor</strong><span>Revise a orientação abaixo e inicie uma nova execução.</span></div>}</section>
         <section className="card card-pad detail-section"><h3>O que precisa ser feito</h3><p className="detail-copy">{task.description || 'Sem descrição adicional.'}</p></section>
         <section className="card card-pad detail-section"><h3>Instruções de comprovação</h3><p className="detail-copy">{task.instructions || 'Registre o resultado da execução com uma observação objetiva.'}</p></section>
         {task.modelObjectPath && <section className="card card-pad detail-section"><h3>Modelo / exemplo</h3><p className="detail-copy">Use esta referência para conferir o padrão esperado. Ela não conta como evidência da execução.</p><img className="model-preview" src={`/api/storage${task.modelObjectPath}`} alt="Imagem de modelo da tarefa" /><a className="section-link" href={`/api/storage${task.modelObjectPath}`} target="_blank" rel="noreferrer">Abrir modelo</a></section>}
           <section className="card card-pad detail-section"><div className="section-heading"><h3 style={{ margin: 0 }}>Evidências <span className="stat-meta">({evidence.length})</span></h3>{task.evidenceRequired && <span className="status-chip status-in_progress">Obrigatória</span>}</div>{evidence.length ? <div className="evidence-list">{evidence.map((item: Evidence) => <div className="evidence-item" key={item.id}><span className="evidence-icon"><EvidenceIcon type={item.type} /></span><div><div className="evidence-file">{item.fileName}</div><div className="evidence-by">{item.userName} · {formatDate(item.createdAt)}{item.location ? ` · ${item.location}` : ''}</div>{item.objectPath && <>{item.type === 'photo' ? <img className="evidence-preview evidence-preview-clickable" src={`/api/storage${item.objectPath}`} alt={`Evidência: ${item.fileName}`} onClick={() => setSelectedEvidence(item)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedEvidence(item); }} role="button" tabIndex={0} data-testid={`image-evidence-${item.id}`} /> : <video className="evidence-preview" controls playsInline preload="metadata" src={`/api/storage${item.objectPath}`}>Seu navegador não oferece suporte a vídeo.</video>}<div className="evidence-actions">{item.type === 'photo' ? <button type="button" className="section-link evidence-open" onClick={() => setSelectedEvidence(item)} data-testid={`button-open-evidence-${item.id}`}>Abrir evidência</button> : <a className="section-link" href={`/api/storage${item.objectPath}`} target="_blank" rel="noreferrer">Abrir evidência</a>}</div></>}{canExecute && <div className="evidence-actions"><button type="button" className="section-link evidence-delete" onClick={() => removeEvidence(item)} disabled={deleteTaskEvidence.isPending} data-testid={`button-delete-evidence-${item.id}`}><Trash2 size={13} /> Remover</button></div>}</div></div>)}</div> : <EmptyState icon={Paperclip} title="Ainda sem evidências" copy="Adicione uma foto ou vídeo para comprovar a execução." />}</section>
           {rejectionComments.length > 0 && <section className="card card-pad detail-section rejection-feedback" data-testid="rejection-feedback"><div className="section-heading"><h3 style={{ margin: 0 }}>Orientação da reprovação</h3>{task.status === 'rejected' && <span className="status-chip status-rejected">Reprovada</span>}</div><div className="comment-list">{rejectionComments.map((item) => <div className="comment-item" key={item.id}><div className="comment-meta"><strong>{item.userName}</strong><span>{formatDate(item.createdAt)}</span></div><div className="comment-message">{item.message}</div></div>)}</div></section>}
          <section className="card card-pad detail-section"><div className="section-heading"><h3 style={{ margin: 0 }}><MessageSquare size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />Feedback e comentários <span className="stat-meta">({feedbackComments.length})</span></h3></div>{feedbackComments.length > 0 && <div className="comment-list">{feedbackComments.map((item) => <div className="comment-item" key={item.id}><div className="comment-meta"><strong>{item.userName}</strong><span>{formatDate(item.createdAt)}</span></div><div className="comment-message">{item.message}</div></div>)}</div>}<div className="field" style={{ marginTop: 12 }}><label htmlFor="task-comment">Adicionar comentário</label><textarea id="task-comment" className="textarea" value={newComment} onChange={(event) => setNewComment(event.target.value)} placeholder="Registre uma observação sobre a execução." data-testid="textarea-task-comment" /></div><button className="button button-ghost" style={{ marginTop: 8 }} onClick={comment} disabled={!newComment.trim() || addComment.isPending}>Adicionar comentário</button></section>
       </div>
       <aside className="sticky-card">
         <TaskDeadline dueDate={task.dueDate} dueTime={task.dueTime} status={task.status} />
          <section className="card action-card"><h3>Próximo passo</h3>{task.status === 'completed' ? <div className="completion-state"><CheckCircle2 size={16} /> Concluída por {task.completedBy || '—'}</div> : canReview ? <><div className="stat-meta">A tarefa foi concluída pelo gerente e aguarda sua conferência.</div><textarea className="textarea" style={{ marginTop: 12 }} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Comentário opcional. Se reprovar, use este campo para registrar a orientação ao gerente." aria-label="Orientação da conferência" data-testid="textarea-review-comment" /><div className="form-actions" style={{ justifyContent: 'stretch' }}><button className="button button-success" style={{ flex: 1 }} onClick={() => review('approve')} disabled={reviewTask.isPending}>Aprovar</button><button className="button button-danger" style={{ flex: 1 }} onClick={() => review('reject')} disabled={reviewTask.isPending}>Reprovar</button></div></> : canExecute ? <><label className="capture-button" htmlFor="evidence-file"><UploadCloud size={18} /> {addEvidence.isPending || requestUpload.isPending ? 'Enviando...' : 'Adicionar evidência'}<input id="evidence-file" type="file" accept="image/*,video/*" className="hidden-file" onChange={capture} disabled={addEvidence.isPending || requestUpload.isPending} /></label><div style={{ height: 10 }} /><button className="button button-success" style={{ width: '100%', minHeight: 45 }} onClick={complete} disabled={completeTask.isPending || (task.evidenceRequired && evidence.length === 0)}><CheckCircle2 size={16} /> Concluir tarefa</button>{task.evidenceRequired && evidence.length === 0 && <div className="stat-meta" style={{ marginTop: 10 }}><CircleAlert size={13} /> Evidência obrigatória para concluir.</div>}{(task.status === 'pending' || task.status === 'rejected') && <button className="button button-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => updateStatus('in_progress')}>{task.status === 'rejected' ? 'Iniciar nova execução' : 'Começar execução'}</button>}{task.status === 'in_progress' && <button className="button button-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => updateStatus('pending')}>Deixar para depois</button>}</> : <p className="stat-meta">Esta tarefa está visível para acompanhamento, mas foi atribuída a outro responsável.</p>}</section>
         {notice && <div className="stat-meta" style={{ padding: '12px 4px' }}>{notice}</div>}
         <section className="card card-pad" style={{ marginTop: 14 }}><div className="section-title">Resumo rápido</div><div className="stat-meta">Status <StatusPill status={task.status} /></div><div className="stat-meta">Prioridade <PriorityPill priority={task.priority} /></div></section>
       </aside>
      </div>}
      {selectedEvidence?.objectPath && <div className="evidence-viewer-backdrop" role="dialog" aria-modal="true" aria-label={`Visualização da evidência ${selectedEvidence.fileName}`} onClick={() => setSelectedEvidence(null)}><div className="evidence-viewer" onClick={(event) => event.stopPropagation()}><div className="evidence-viewer-head"><div><div className="eyebrow">Evidência</div><div className="evidence-viewer-title">{selectedEvidence.fileName}</div></div><button type="button" className="button button-ghost" onClick={() => setSelectedEvidence(null)} data-testid="button-back-evidence"><ArrowLeft size={14} /> Voltar</button></div><img className="evidence-viewer-image" src={`/api/storage${selectedEvidence.objectPath}`} alt={`Evidência ampliada: ${selectedEvidence.fileName}`} /></div></div>}
   </div>;
}