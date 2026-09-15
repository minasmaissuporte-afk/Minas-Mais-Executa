import { ArrowLeft, CheckCircle2, CircleAlert, MessageSquare, Paperclip, Trash2, UploadCloud } from 'lucide-react';
import type { ChangeEvent, TouchEvent as ReactTouchEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetActivityQueryKey, getGetDashboardSummaryQueryKey, getGetTaskQueryKey, getListTaskSummariesQueryKey, getListTasksQueryKey, useAddTaskComment, useAddTaskEvidence, useCompleteTask, useDeleteTask, useDeleteTaskEvidence, useGetMe, useGetTask, useRequestUploadUrl, useReviewTask, useUpdateTask } from '@workspace/api-client-react';
import type { Evidence, TaskModelAttachment } from '@workspace/api-client-react';
import { useParams, Link, useLocation } from 'wouter';
import { EmptyState, ErrorState, EvidenceIcon, formatDate, LoadingBlocks, PriorityPill, StatusPill } from '@/components/ui-kit';
import { TaskDeadline } from '@/components/task-deadline';

type ImageViewerSelection = {
  objectPath: string;
  fileName: string;
  alt: string;
  type: 'photo' | 'video';
};

type PinchGesture = {
  mode: 'pinch' | 'pan';
  startDistance: number;
  startScale: number;
  startX: number;
  startY: number;
  startOffsetX: number;
  startOffsetY: number;
};

function PinchZoomPhoto({ src, alt }: { src: string; alt: string }) {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const gesture = useRef<PinchGesture | null>(null);
  const distanceBetweenTouches = (touches: ReactTouchEvent<HTMLDivElement>['touches']) => {
    const first = touches[0];
    const second = touches[1];
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  };
  const centerOfTouches = (touches: ReactTouchEvent<HTMLDivElement>['touches']) => ({
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  });
  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length >= 2) {
      const center = centerOfTouches(event.touches);
      gesture.current = {
        mode: 'pinch',
        startDistance: distanceBetweenTouches(event.touches),
        startScale: transform.scale,
        startX: center.x,
        startY: center.y,
        startOffsetX: transform.x,
        startOffsetY: transform.y,
      };
    } else if (event.touches.length === 1 && transform.scale > 1) {
      gesture.current = {
        mode: 'pan',
        startDistance: 0,
        startScale: transform.scale,
        startX: event.touches[0].clientX,
        startY: event.touches[0].clientY,
        startOffsetX: transform.x,
        startOffsetY: transform.y,
      };
    }
  };
  const handleTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    const activeGesture = gesture.current;
    if (!activeGesture) return;
    event.preventDefault();
    if (activeGesture.mode === 'pinch' && event.touches.length >= 2) {
      const center = centerOfTouches(event.touches);
      const ratio = distanceBetweenTouches(event.touches) / activeGesture.startDistance;
      const scale = Math.min(4, Math.max(1, activeGesture.startScale * ratio));
      setTransform({
        scale,
        x: activeGesture.startOffsetX + center.x - activeGesture.startX,
        y: activeGesture.startOffsetY + center.y - activeGesture.startY,
      });
      return;
    }
    if (activeGesture.mode === 'pan' && event.touches.length === 1) {
      setTransform({
        ...transform,
        x: activeGesture.startOffsetX + event.touches[0].clientX - activeGesture.startX,
        y: activeGesture.startOffsetY + event.touches[0].clientY - activeGesture.startY,
      });
    }
  };
  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 0) {
      gesture.current = null;
      if (transform.scale <= 1.02) setTransform({ scale: 1, x: 0, y: 0 });
    }
  };
  useEffect(() => {
    setTransform({ scale: 1, x: 0, y: 0 });
    gesture.current = null;
  }, [src]);
  return (
    <div
      className="evidence-viewer-media-viewport"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <img
        className="evidence-viewer-image"
        src={src}
        alt={alt}
        draggable={false}
        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
      />
    </div>
  );
}

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
  const [selectedImage, setSelectedImage] = useState<ImageViewerSelection | null>(null);
  const [, navigate] = useLocation();
  const task = taskQuery.data;
  const evidence = task?.evidence ?? [];
  const modelAttachments: TaskModelAttachment[] = task?.modelAttachments?.length
    ? task.modelAttachments
    : task?.modelObjectPath
      ? [{ objectPath: task.modelObjectPath, fileName: 'Modelo da tarefa', type: 'photo' }]
      : [];
  const feedbackComments = task?.comments.filter((item) => item.type !== 'supervisor_rejection') ?? [];
  const rejectionComments = task?.comments.filter((item) => item.type === 'supervisor_rejection') ?? [];
  useEffect(() => {
    if (!selectedImage) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedImage(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [selectedImage]);
  const invalidateTask = () => {
    if (!task) return;
    client.invalidateQueries({ queryKey: getGetTaskQueryKey(task.id) });
    client.invalidateQueries({ queryKey: getListTasksQueryKey() });
    client.invalidateQueries({ queryKey: getListTaskSummariesQueryKey() });
    client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };
  const canExecute = !!task && task.status !== 'pending_review' && task.status !== 'completed' && (me.data?.role === 'admin' || task.assigneeMemberId === me.data?.id || task.assigneeMemberIds?.includes(me.data?.id ?? '') === true);
  const canReview = !!task && me.data?.role === 'supervisor' && task.status === 'pending_review';
  const canManageStatus = !!task && (me.data?.role === 'admin' || me.data?.role === 'supervisor');
  const canReturnToPending = canManageStatus && task.status !== 'pending';
  const updateStatus = (status: 'pending' | 'in_progress') => {
    if (!task) return;
    updateTask.mutate({ id: task.id, data: { status } }, { onSuccess: () => { invalidateTask(); setNotice(status === 'in_progress' ? 'Tarefa assumida.' : 'Tarefa devolvida para pendências.'); }, onError: () => setNotice('Não foi possível atualizar o status.') });
  };
  const returnToPending = () => {
    if (!task || !canReturnToPending || !window.confirm('Voltar esta tarefa para pendente? A aprovação atual será desfeita.')) return;
    updateStatus('pending');
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
  const openModelAttachment = (attachment: TaskModelAttachment) => {
    setSelectedImage({
      objectPath: attachment.objectPath,
      fileName: attachment.fileName,
      alt: `${attachment.type === 'video' ? 'Vídeo' : 'Imagem'} ampliado(a) do modelo`,
      type: attachment.type,
    });
  };
  const openEvidenceImage = (item: Evidence) => {
    if (!item.objectPath) return;
    setSelectedImage({ objectPath: item.objectPath, fileName: item.fileName, alt: `Evidência ampliada: ${item.fileName}`, type: 'photo' });
  };
  const closeImageViewer = () => {
    setSelectedImage(null);
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
            {modelAttachments.length > 0 && <section className="card card-pad detail-section"><h3>Modelos / exemplos <span className="stat-meta">({modelAttachments.length})</span></h3><p className="detail-copy">Use estas referências para conferir o padrão esperado. Elas não contam como evidência da execução.</p><div className="model-attachment-grid">{modelAttachments.map((attachment) => <div className="model-attachment-card" key={attachment.objectPath}>{attachment.type === 'photo' ? <img className="model-preview model-preview-clickable" src={`/api/storage${attachment.objectPath}`} alt={`Modelo: ${attachment.fileName}`} onClick={() => openModelAttachment(attachment)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openModelAttachment(attachment); }} role="button" tabIndex={0} data-testid={`image-task-model-${attachment.objectPath}`} /> : <video className="model-preview" controls playsInline preload="metadata" src={`/api/storage${attachment.objectPath}`}>Seu navegador não oferece suporte a vídeo.</video>}<div className="model-attachment-meta"><span>{attachment.type === 'video' ? 'Vídeo' : 'Foto'} · {attachment.fileName}</span><button type="button" className="section-link evidence-open" onClick={() => openModelAttachment(attachment)}>Abrir modelo</button></div></div>)}</div></section>}
              <section className="card card-pad detail-section"><div className="section-heading"><h3 style={{ margin: 0 }}>Evidências <span className="stat-meta">({evidence.length})</span></h3>{task.evidenceRequired && <span className="status-chip status-in_progress">Obrigatória</span>}</div>{evidence.length ? <div className="evidence-list">{evidence.map((item: Evidence) => <div className="evidence-item" key={item.id}><span className="evidence-icon"><EvidenceIcon type={item.type} /></span><div><div className="evidence-file">{item.fileName} {item.isHistorical && <span className="status-chip status-pending_review">Histórico</span>}</div><div className="evidence-by">{item.userName} · {formatDate(item.createdAt)}{item.location ? ` · ${item.location}` : ''}</div>{item.objectPath && <>{item.type === 'photo' ? <img className="evidence-preview evidence-preview-clickable" src={`/api/storage${item.objectPath}`} alt={`Evidência: ${item.fileName}`} onClick={() => openEvidenceImage(item)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openEvidenceImage(item); }} role="button" tabIndex={0} data-testid={`image-evidence-${item.id}`} /> : <video className="evidence-preview" controls playsInline preload="metadata" src={`/api/storage${item.objectPath}`}>Seu navegador não oferece suporte a vídeo.</video>}<div className="evidence-actions">{item.type === 'photo' ? <button type="button" className="section-link evidence-open" onClick={() => openEvidenceImage(item)} data-testid={`button-open-evidence-${item.id}`}>Abrir evidência</button> : <a className="section-link" href={`/api/storage${item.objectPath}`} target="_blank" rel="noreferrer">Abrir evidência</a>}</div></>}{canExecute && !item.isHistorical && <div className="evidence-actions"><button type="button" className="section-link evidence-delete" onClick={() => removeEvidence(item)} disabled={deleteTaskEvidence.isPending} data-testid={`button-delete-evidence-${item.id}`}><Trash2 size={13} /> Remover</button></div>}</div></div>)}</div> : <EmptyState icon={Paperclip} title="Ainda sem evidências" copy="Adicione uma foto ou vídeo para comprovar a execução." />}</section>
           {rejectionComments.length > 0 && <section className="card card-pad detail-section rejection-feedback" data-testid="rejection-feedback"><div className="section-heading"><h3 style={{ margin: 0 }}>Orientação da reprovação</h3>{task.status === 'rejected' && <span className="status-chip status-rejected">Reprovada</span>}</div><div className="comment-list">{rejectionComments.map((item) => <div className="comment-item" key={item.id}><div className="comment-meta"><strong>{item.userName}</strong><span>{formatDate(item.createdAt)}</span></div><div className="comment-message">{item.message}</div></div>)}</div></section>}
          <section className="card card-pad detail-section"><div className="section-heading"><h3 style={{ margin: 0 }}><MessageSquare size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />Feedback e comentários <span className="stat-meta">({feedbackComments.length})</span></h3></div>{feedbackComments.length > 0 && <div className="comment-list">{feedbackComments.map((item) => <div className="comment-item" key={item.id}><div className="comment-meta"><strong>{item.userName}</strong><span>{formatDate(item.createdAt)}</span></div><div className="comment-message">{item.message}</div></div>)}</div>}<div className="field" style={{ marginTop: 12 }}><label htmlFor="task-comment">Adicionar comentário</label><textarea id="task-comment" className="textarea" value={newComment} onChange={(event) => setNewComment(event.target.value)} placeholder="Registre uma observação sobre a execução." data-testid="textarea-task-comment" /></div><button className="button button-ghost" style={{ marginTop: 8 }} onClick={comment} disabled={!newComment.trim() || addComment.isPending}>Adicionar comentário</button></section>
       </div>
       <aside className="sticky-card">
         <TaskDeadline dueDate={task.dueDate} dueTime={task.dueTime} status={task.status} />
           <section className="card action-card"><h3>Próximo passo</h3>{canReturnToPending && <button className="button button-ghost" style={{ width: '100%', marginBottom: 12 }} onClick={returnToPending} disabled={updateTask.isPending} data-testid="button-return-task-to-pending">Voltar tarefa para pendente</button>}{task.status === 'completed' ? <div className="completion-state"><CheckCircle2 size={16} /> Concluída por {task.completedBy || '—'}</div> : canReview ? <><div className="stat-meta">A tarefa foi concluída pelo gerente e aguarda sua conferência.</div><textarea className="textarea" style={{ marginTop: 12 }} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Comentário opcional. Se reprovar, use este campo para registrar a orientação ao gerente." aria-label="Orientação da conferência" data-testid="textarea-review-comment" /><div className="form-actions" style={{ justifyContent: 'stretch' }}><button className="button button-success" style={{ flex: 1 }} onClick={() => review('approve')} disabled={reviewTask.isPending}>Aprovar</button><button className="button button-danger" style={{ flex: 1 }} onClick={() => review('reject')} disabled={reviewTask.isPending}>Reprovar</button></div></> : canExecute ? <><label className="capture-button" htmlFor="evidence-file"><UploadCloud size={18} /> {addEvidence.isPending || requestUpload.isPending ? 'Enviando...' : 'Adicionar evidência'}<input id="evidence-file" type="file" accept="image/*,video/*" className="hidden-file" onChange={capture} disabled={addEvidence.isPending || requestUpload.isPending} /></label><div style={{ height: 10 }} /><button className="button button-success" style={{ width: '100%', minHeight: 45 }} onClick={complete} disabled={completeTask.isPending || (task.evidenceRequired && evidence.length === 0)}><CheckCircle2 size={16} /> Concluir tarefa</button>{task.evidenceRequired && evidence.length === 0 && <div className="stat-meta" style={{ marginTop: 10 }}><CircleAlert size={13} /> Evidência obrigatória para concluir.</div>}{(task.status === 'pending' || task.status === 'rejected') && <button className="button button-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => updateStatus('in_progress')}>{task.status === 'rejected' ? 'Iniciar nova execução' : 'Começar execução'}</button>}{task.status === 'in_progress' && <button className="button button-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => updateStatus('pending')}>Deixar para depois</button>}</> : <p className="stat-meta">Esta tarefa está visível para acompanhamento, mas foi atribuída a outro responsável.</p>}</section>
         {notice && <div className="stat-meta" style={{ padding: '12px 4px' }}>{notice}</div>}
         <section className="card card-pad" style={{ marginTop: 14 }}><div className="section-title">Resumo rápido</div><div className="stat-meta">Status <StatusPill status={task.status} /></div><div className="stat-meta">Prioridade <PriorityPill priority={task.priority} /></div></section>
       </aside>
      </div>}
        {selectedImage?.objectPath && <div className="evidence-viewer-backdrop" role="dialog" aria-modal="true" aria-label={`Visualização de ${selectedImage.fileName}`} onClick={closeImageViewer}><div className="evidence-viewer" onClick={(event) => event.stopPropagation()}><div className="evidence-viewer-head"><div><div className="eyebrow">Visualização</div><div className="evidence-viewer-title">{selectedImage.fileName}</div></div><button type="button" className="button button-danger evidence-viewer-back-button" onClick={closeImageViewer} data-testid="button-back-image-viewer"><ArrowLeft size={14} /> Voltar</button></div><div className="evidence-viewer-image-scroll">{selectedImage.type === 'photo' ? <PinchZoomPhoto src={`/api/storage${selectedImage.objectPath}`} alt={selectedImage.alt} /> : <video className="evidence-viewer-image" controls playsInline autoPlay={false} src={`/api/storage${selectedImage.objectPath}`}>Seu navegador não oferece suporte a vídeo.</video>}</div></div></div>}
   </div>;
}