import { ArrowLeft, CheckCircle2, CircleAlert, Download, MessageSquare, Paperclip, Pencil, Share2, Trash2, UploadCloud, X } from 'lucide-react';
import type { ChangeEvent, TouchEvent as ReactTouchEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { TaskCompletionMessage } from '@/components/task-completion-message';
import { useQueryClient } from '@tanstack/react-query';
import { getGetActivityQueryKey, getGetDashboardSummaryQueryKey, getGetTaskQueryKey, getListStoresQueryKey, getListTaskSummariesQueryKey, getListTasksQueryKey, useAddTaskComment, useAddTaskEvidence, useCompleteTask, useDeleteTask, useDeleteTaskEvidence, useGetMe, useGetTask, useListStores, useRequestUploadUrl, useReviewTask, useUpdateTask } from '@workspace/api-client-react';
import type { Evidence, Task, TaskModelAttachment } from '@workspace/api-client-react';
import { useParams, Link, useLocation } from 'wouter';
import { EmptyState, ErrorState, EvidenceIcon, formatDate, formatDateTime, LoadingBlocks, PriorityPill, StatusPill, TaskEvidenceExportButton } from '@/components/ui-kit';
import { TaskDeadline } from '@/components/task-deadline';

function TaskEditModal({ task, onClose, onSave, saving }: {
  task: Task;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const requestUpload = useRequestUploadUrl();
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState({
    title: task.title,
    description: task.description,
    category: task.category,
    priority: task.priority,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    evidenceRequired: task.evidenceRequired,
    evidenceTypes: task.evidenceTypes ?? [],
    instructions: task.instructions,
    modelAttachments: task.modelAttachments?.length
      ? task.modelAttachments
      : task.modelObjectPath ? [{ objectPath: task.modelObjectPath, fileName: 'Modelo da tarefa', type: 'photo' as const }] : [],
  });
  const update = (key: keyof typeof draft, value: unknown) => setDraft((current) => ({ ...current, [key]: value }));
  const uploadModels = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setNotice('');
    try {
      const additions: TaskModelAttachment[] = [];
      for (const file of Array.from(files)) {
        const upload = await requestUpload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type || 'application/octet-stream' } });
        const response = await fetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
        if (!response.ok) throw new Error('Upload failed');
        additions.push({ objectPath: upload.objectPath, fileName: file.name, type: file.type.startsWith('video/') ? 'video' : 'photo' });
      }
      update('modelAttachments', [...draft.modelAttachments, ...additions]);
    } catch {
      setNotice('Não foi possível enviar todos os modelos. Tente novamente.');
    } finally {
      setUploading(false);
    }
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim()) {
      setNotice('Informe o nome da tarefa.');
      return;
    }
    const { modelAttachments, ...fields } = draft;
    onSave({
      ...fields,
      modelAttachments,
      modelObjectPath: modelAttachments[0]?.objectPath ?? null,
    });
  };
  const toggleEvidenceType = (type: 'photo' | 'video') => {
    const current = draft.evidenceTypes;
    update('evidenceTypes', current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  };
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="task-edit-title">
    <div className="modal">
      <div className="modal-head"><div><div className="eyebrow">Somente quem criou esta tarefa</div><h2 className="modal-title" id="task-edit-title">Editar tarefa</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar edição"><X size={16} /></button></div>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field full"><label htmlFor="edit-task-title">Nome da tarefa</label><input id="edit-task-title" className="input" value={draft.title} onChange={(event) => update('title', event.target.value)} required /></div>
          <div className="field full"><label htmlFor="edit-task-description">O que precisa ser feito</label><textarea id="edit-task-description" className="textarea" value={draft.description} onChange={(event) => update('description', event.target.value)} /></div>
          <div className="field"><label htmlFor="edit-task-category">Categoria</label><input id="edit-task-category" className="input" value={draft.category} onChange={(event) => update('category', event.target.value)} /></div>
          <div className="field"><label htmlFor="edit-task-priority">Prioridade</label><select id="edit-task-priority" className="select" value={draft.priority} onChange={(event) => update('priority', event.target.value)}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></select></div>
          <div className="field"><label htmlFor="edit-task-date">Data</label><input id="edit-task-date" type="date" className="input" value={draft.dueDate.slice(0, 10)} onChange={(event) => update('dueDate', event.target.value)} /></div>
          <div className="field"><label htmlFor="edit-task-time">Horário</label><input id="edit-task-time" type="time" className="input" value={draft.dueTime} onChange={(event) => update('dueTime', event.target.value)} /></div>
          <div className="field full"><label htmlFor="edit-task-instructions">Instruções de comprovação</label><textarea id="edit-task-instructions" className="textarea" value={draft.instructions} onChange={(event) => update('instructions', event.target.value)} /></div>
          <div className="field full"><span className="field-hint">Modelos de evidência (não são fotos de execução)</span><div className="evidence-list">{draft.modelAttachments.map((attachment) => <div className="evidence-item" key={attachment.objectPath}><span className="evidence-file">{attachment.type === 'video' ? 'Vídeo' : 'Foto'} · {attachment.fileName}</span><button type="button" className="section-link evidence-delete" onClick={() => update('modelAttachments', draft.modelAttachments.filter((item) => item.objectPath !== attachment.objectPath))} aria-label={`Remover ${attachment.fileName}`}><Trash2 size={13} /> Remover</button></div>)}</div><label className="capture-button" htmlFor="edit-task-models" style={{ marginTop: 8, minHeight: 48 }}><UploadCloud size={16} /> {uploading ? 'Enviando modelos...' : 'Acrescentar modelo de evidência'}<input id="edit-task-models" type="file" accept="image/*,video/*" multiple className="hidden-file" disabled={uploading || saving} onChange={(event) => { void uploadModels(event.target.files); event.currentTarget.value = ''; }} /></label></div>
          <div className="field full"><label className="bulk-select-all"><input type="checkbox" checked={draft.evidenceRequired} onChange={(event) => update('evidenceRequired', event.target.checked)} /><span>Exigir evidência para concluir</span></label><div className="bulk-select-all"><label><input type="checkbox" checked={draft.evidenceTypes.includes('photo')} onChange={() => toggleEvidenceType('photo')} /> Fotos</label><label><input type="checkbox" checked={draft.evidenceTypes.includes('video')} onChange={() => toggleEvidenceType('video')} /> Vídeos</label></div></div>
        </div>
        {notice && <div className="form-notice error" role="alert">{notice}</div>}
        <div className="form-actions"><button type="button" className="button button-ghost" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary" disabled={saving || uploading}>{saving ? 'Salvando...' : 'Salvar alterações'}</button></div>
      </form>
    </div>
  </div>;
}

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
  const returnToStoreList = new URLSearchParams(window.location.search).get('returnTo') === 'stores';
  const taskId = id || '';
  const client = useQueryClient();
  const taskQuery = useGetTask(taskId, { query: { queryKey: getGetTaskQueryKey(taskId), enabled: !!taskId } });
  const me = useGetMe();
  const storesQuery = useListStores({ query: { queryKey: getListStoresQueryKey(), enabled: me.data?.role === 'admin' } });
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const addEvidence = useAddTaskEvidence();
  const deleteTaskEvidence = useDeleteTaskEvidence();
  const completeTask = useCompleteTask();
  const reviewTask = useReviewTask();
  const addComment = useAddTaskComment();
  const requestUpload = useRequestUploadUrl();
  const [notice, setNotice] = useState('');
  const [thankedTaskId, setThankedTaskId] = useState<string | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [newComment, setNewComment] = useState('');
  const [selectedImage, setSelectedImage] = useState<ImageViewerSelection | null>(null);
  const [sharingEvidenceId, setSharingEvidenceId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState(false);
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
  const canEditTask = !!task && !!me.data?.id && task.createdByMemberId === me.data.id;
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
  const evidenceUrl = (item: Evidence) => item.objectPath
    ? new URL(`/api/storage${item.objectPath}`, window.location.origin).toString()
    : '';
  const shareEvidence = async (item: Evidence) => {
    const url = evidenceUrl(item);
    if (!url || !navigator.share) {
      setNotice('O compartilhamento do dispositivo não está disponível neste navegador.');
      return;
    }
    setSharingEvidenceId(item.id);
    try {
      const storesResult = await storesQuery.refetch();
      if (storesResult.isError || !storesResult.data) {
        setNotice('Não foi possível carregar os dados da loja para compartilhar.');
        return;
      }
      const store = storesResult.data.find((candidate) => candidate.id === task?.storeId);
      if (!store) {
        setNotice('Não foi possível localizar a loja para completar o compartilhamento.');
        return;
      }
      const managerName = store.manager.trim() || 'Não definido';
      const shareText = [
        `Evidência: ${item.fileName}`,
        `Tarefa: ${task?.title ?? 'Não informada'}`,
        `Loja: ${task?.storeName ?? 'Não informada'}`,
        `Nome do Gerente: ${managerName}`,
      ].join('\n');
      const response = await fetch(url);
      if (!response.ok) throw new Error('Não foi possível carregar a evidência.');
      const blob = await response.blob();
      const file = new File([blob], item.fileName, { type: blob.type || (item.type === 'video' ? 'video/mp4' : 'image/jpeg') });
      const canShareFile = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
      await navigator.share(canShareFile
        ? { title: `Evidência: ${item.fileName}`, text: shareText, files: [file] }
        : { title: `Evidência: ${item.fileName}`, text: `${shareText}\n${url}` });
      setNotice('Evidência compartilhada.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setNotice('Não foi possível compartilhar a evidência.');
    } finally {
      setSharingEvidenceId(null);
    }
  };
  const saveEvidence = async (item: Evidence) => {
    const url = evidenceUrl(item);
    if (!url) return;
    setSharingEvidenceId(item.id);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Não foi possível carregar a evidência.');
      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = item.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(blobUrl);
      setNotice('Evidência salva no dispositivo.');
    } catch {
      setNotice('Não foi possível salvar a evidência.');
    } finally {
      setSharingEvidenceId(null);
    }
  };
  const complete = () => {
    if (!task) return;
    setThankedTaskId(null);
    completeTask.mutate({ id: task.id }, {
      onSuccess: () => {
        invalidateTask();
        setNotice('Tarefa concluída.');
        if (me.data?.role === 'manager' || me.data?.role === 'supervisor') setThankedTaskId(task.id);
      },
      onError: () => setNotice('Adicione as evidências obrigatórias antes de concluir.'),
    });
  };
  const review = (decision: 'approve' | 'reject') => {
    if (!task) return;
    reviewTask.mutate({ id: task.id, data: { decision, comment: reviewComment.trim() || undefined } }, {
      onSuccess: () => {
        invalidateTask();
        setReviewComment('');
        setNotice(decision === 'approve' ? 'Tarefa aprovada.' : 'Tarefa reprovada e devolvida ao gerente.');
        if (decision === 'approve' && me.data?.role === 'supervisor') setThankedTaskId(task.id);
      },
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
  const saveTask = (data: Record<string, unknown>) => {
    if (!task || !canEditTask) return;
    updateTask.mutate({ id: task.id, data }, {
      onSuccess: () => { setEditingTask(false); invalidateTask(); setNotice('Tarefa atualizada.'); },
      onError: (error) => {
        const message = error && typeof error === 'object' && 'data' in error && error.data && typeof error.data === 'object' && 'error' in error.data
          ? String(error.data.error)
          : 'Não foi possível atualizar a tarefa.';
        setNotice(message);
      },
    });
  };
   return <div className="content">
     <div className="task-detail-topbar"><Link href={returnToStoreList ? '/tasks?restoreStores=1' : '/tasks'} className="section-link" data-testid={returnToStoreList ? 'link-back-stores' : 'link-back-tasks'}><ArrowLeft size={13} /> {returnToStoreList ? 'Voltar para lojas' : 'Voltar para tarefas'}</Link>{task && canEditTask && <div className="task-owner-actions"><button className="button button-ghost" onClick={() => setEditingTask(true)} data-testid="button-edit-task"><Pencil size={15} /> Editar tarefa</button><button className="button button-danger" onClick={removeTask} disabled={deleteTask.isPending} data-testid="button-delete-task"><Trash2 size={15} /> {deleteTask.isPending ? 'Excluindo...' : 'Excluir tarefa'}</button></div>}</div>
     {taskQuery.isError ? <ErrorState onRetry={() => taskQuery.refetch()} /> : taskQuery.isLoading ? <LoadingBlocks rows={2} /> : !task ? <EmptyState title="Tarefa não encontrada" copy="Ela pode não estar disponível para o seu acesso." /> : <div className="detail-layout">
       <div>
           <section className="detail-hero"><div className="eyebrow">Execução · {task.category}</div><h1 className="detail-title">{task.title}</h1><div className="detail-meta"><mark className="task-person-highlight">{task.storeName}</mark><span>•</span><mark className="task-person-highlight">{task.assignee}</mark><span>•</span><span>Criada por {task.createdByName}</span><span>•</span><span>Em {formatDate(task.createdAt)}</span><span>•</span><span>Executar em {formatDate(task.dueDate)} às {task.dueTime}</span></div>{task.status === 'pending_review' && <div className="task-status-banner task-status-banner-pending_review"><strong>Aguardando conferência do supervisor</strong><span>O gerente concluiu a execução. A tarefa será encerrada após a aprovação.</span></div>}{task.status === 'rejected' && <div className="task-status-banner task-status-banner-rejected"><strong>Tarefa reprovada pelo supervisor</strong><span>Revise a orientação abaixo e inicie uma nova execução.</span></div>}
             <div className="detail-pdf-actions"><TaskEvidenceExportButton key={task.id} taskId={task.id} taskTitle={task.title} scope="store" taskStatus={task.status} storeName={task.storeName} /></div>
           </section>
         <section className="card card-pad detail-section"><h3>O que precisa ser feito</h3><p className="detail-copy">{task.description || 'Sem descrição adicional.'}</p></section>
         <section className="card card-pad detail-section"><h3>Instruções de comprovação</h3><p className="detail-copy">{task.instructions || 'Registre o resultado da execução com uma observação objetiva.'}</p></section>
            {modelAttachments.length > 0 && <section className="card card-pad detail-section"><h3>Modelos / exemplos <span className="stat-meta">({modelAttachments.length})</span></h3><p className="detail-copy">Use estas referências para conferir o padrão esperado. Elas não contam como evidência da execução.</p><div className="model-attachment-grid">{modelAttachments.map((attachment) => <div className="model-attachment-card" key={attachment.objectPath}>{attachment.type === 'photo' ? <img className="model-preview model-preview-clickable" src={`/api/storage${attachment.objectPath}`} alt={`Modelo: ${attachment.fileName}`} onClick={() => openModelAttachment(attachment)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openModelAttachment(attachment); }} role="button" tabIndex={0} data-testid={`image-task-model-${attachment.objectPath}`} /> : <video className="model-preview" controls playsInline preload="metadata" src={`/api/storage${attachment.objectPath}`}>Seu navegador não oferece suporte a vídeo.</video>}<div className="model-attachment-meta"><span>{attachment.type === 'video' ? 'Vídeo' : 'Foto'} · {attachment.fileName}</span><button type="button" className="section-link evidence-open" onClick={() => openModelAttachment(attachment)}>Abrir modelo</button></div></div>)}</div></section>}
              <section className="card card-pad detail-section"><div className="section-heading"><h3 style={{ margin: 0 }}>Evidências <span className="stat-meta">({evidence.length})</span></h3>{task.evidenceRequired && <span className="status-chip status-in_progress">Obrigatória</span>}</div>{evidence.length ? <div className="evidence-list">{evidence.map((item: Evidence) => <div className="evidence-item" key={item.id}><span className="evidence-icon"><EvidenceIcon type={item.type} /></span><div><div className="evidence-file">{item.fileName} {item.isHistorical && <span className="status-chip status-pending_review">Histórico</span>}</div><div className="evidence-by">{item.userName} · {formatDateTime(item.createdAt)}{item.location ? ` · ${item.location}` : ''}</div>{item.objectPath && <>{item.type === 'photo' ? <img className="evidence-preview evidence-preview-clickable" src={`/api/storage${item.objectPath}`} alt={`Evidência: ${item.fileName}`} onClick={() => openEvidenceImage(item)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') openEvidenceImage(item); }} role="button" tabIndex={0} data-testid={`image-evidence-${item.id}`} /> : <video className="evidence-preview" controls playsInline preload="metadata" src={`/api/storage${item.objectPath}`}>Seu navegador não oferece suporte a vídeo.</video>}<div className="evidence-actions">{item.type === 'photo' ? <button type="button" className="section-link evidence-open" onClick={() => openEvidenceImage(item)} data-testid={`button-open-evidence-${item.id}`}>Abrir evidência</button> : <a className="section-link" href={`/api/storage${item.objectPath}`} target="_blank" rel="noreferrer">Abrir evidência</a>}{me.data?.role === 'admin' && <details className="evidence-share-menu"><summary className="section-link evidence-share-trigger"><Share2 size={13} /> Compartilhar</summary><div className="evidence-share-options"><button type="button" onClick={() => shareEvidence(item)} disabled={sharingEvidenceId === item.id}><Share2 size={13} /> Compartilhar pelo celular</button><button type="button" onClick={() => saveEvidence(item)} disabled={sharingEvidenceId === item.id}><Download size={13} /> Salvar no telefone</button></div></details>}</div></>}{canExecute && !item.isHistorical && <div className="evidence-actions"><button type="button" className="section-link evidence-delete" onClick={() => removeEvidence(item)} disabled={deleteTaskEvidence.isPending} data-testid={`button-delete-evidence-${item.id}`}><Trash2 size={13} /> Remover</button></div>}</div></div>)}</div> : <EmptyState icon={Paperclip} title="Ainda sem evidências" copy="Adicione uma foto ou vídeo para comprovar a execução." />}</section>
           {rejectionComments.length > 0 && <section className="card card-pad detail-section rejection-feedback" data-testid="rejection-feedback"><div className="section-heading"><h3 style={{ margin: 0 }}>Orientação da reprovação</h3>{task.status === 'rejected' && <span className="status-chip status-rejected">Reprovada</span>}</div><div className="comment-list">{rejectionComments.map((item) => <div className="comment-item" key={item.id}><div className="comment-meta"><strong>{item.userName}</strong><span>{formatDateTime(item.createdAt)}</span></div><div className="comment-message">{item.message}</div></div>)}</div></section>}
          <section className="card card-pad detail-section"><div className="section-heading"><h3 style={{ margin: 0 }}><MessageSquare size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />Feedback e comentários <span className="stat-meta">({feedbackComments.length})</span></h3></div>{feedbackComments.length > 0 && <div className="comment-list">{feedbackComments.map((item) => <div className="comment-item" key={item.id}><div className="comment-meta"><strong>{item.userName}</strong><span>{formatDateTime(item.createdAt)}</span></div><div className="comment-message">{item.message}</div></div>)}</div>}<div className="field" style={{ marginTop: 12 }}><label htmlFor="task-comment">Adicionar comentário</label><textarea id="task-comment" className="textarea" value={newComment} onChange={(event) => setNewComment(event.target.value)} placeholder="Registre uma observação sobre a execução." data-testid="textarea-task-comment" /></div><button className="button button-ghost" style={{ marginTop: 8 }} onClick={comment} disabled={!newComment.trim() || addComment.isPending}>Adicionar comentário</button></section>
       </div>
       <aside className="sticky-card">
         <TaskDeadline dueDate={task.dueDate} dueTime={task.dueTime} status={task.status} />
           <section className="card action-card"><h3>Próximo passo</h3>{canReturnToPending && <button className="button button-ghost" style={{ width: '100%', marginBottom: 12 }} onClick={returnToPending} disabled={updateTask.isPending} data-testid="button-return-task-to-pending">Voltar tarefa para pendente</button>}{task.status === 'completed' ? <div className="completion-state"><CheckCircle2 size={16} /> Concluída por {task.completedBy || '—'}</div> : canReview ? <><div className="stat-meta">A tarefa foi concluída pelo gerente e aguarda sua conferência.</div><textarea className="textarea" style={{ marginTop: 12 }} value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Comentário opcional. Se reprovar, use este campo para registrar a orientação ao gerente." aria-label="Orientação da conferência" data-testid="textarea-review-comment" /><div className="form-actions" style={{ justifyContent: 'stretch' }}><button className="button button-success" style={{ flex: 1 }} onClick={() => review('approve')} disabled={reviewTask.isPending}>Aprovar</button><button className="button button-danger" style={{ flex: 1 }} onClick={() => review('reject')} disabled={reviewTask.isPending}>Reprovar</button></div></> : canExecute ? <><label className="capture-button" htmlFor="evidence-file"><UploadCloud size={18} /> {addEvidence.isPending || requestUpload.isPending ? 'Enviando...' : 'Adicionar evidência'}<input id="evidence-file" type="file" accept="image/*,video/*" className="hidden-file" onChange={capture} disabled={addEvidence.isPending || requestUpload.isPending} /></label><div style={{ height: 10 }} /><button className="button button-success" style={{ width: '100%', minHeight: 45 }} onClick={complete} disabled={completeTask.isPending || (task.evidenceRequired && evidence.length === 0)}><CheckCircle2 size={16} /> Concluir tarefa</button>{task.evidenceRequired && evidence.length === 0 && <div className="stat-meta" style={{ marginTop: 10 }}><CircleAlert size={13} /> Evidência obrigatória para concluir.</div>}{(task.status === 'pending' || task.status === 'rejected') && <button className="button button-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => updateStatus('in_progress')}>{task.status === 'rejected' ? 'Iniciar nova execução' : 'Começar execução'}</button>}{task.status === 'in_progress' && <button className="button button-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => updateStatus('pending')}>Deixar para depois</button>}</> : <p className="stat-meta">Esta tarefa está visível para acompanhamento, mas foi atribuída a outro responsável.</p>}</section>
         {notice && <div className="stat-meta" style={{ padding: '12px 4px' }}>{notice}</div>}
         <section className="card card-pad" style={{ marginTop: 14 }}><div className="section-title">Resumo rápido</div><div className="stat-meta">Status <StatusPill status={task.status} /></div><div className="stat-meta">Prioridade <PriorityPill priority={task.priority} /></div></section>
       </aside>
      </div>}
        {selectedImage?.objectPath && <div className="evidence-viewer-backdrop" role="dialog" aria-modal="true" aria-label={`Visualização de ${selectedImage.fileName}`} onClick={closeImageViewer}><div className="evidence-viewer" onClick={(event) => event.stopPropagation()}><div className="evidence-viewer-head"><div><div className="eyebrow">Visualização</div><div className="evidence-viewer-title">{selectedImage.fileName}</div></div><button type="button" className="button button-danger evidence-viewer-back-button" onClick={closeImageViewer} data-testid="button-back-image-viewer"><ArrowLeft size={14} /> Voltar</button></div><div className="evidence-viewer-image-scroll">{selectedImage.type === 'photo' ? <PinchZoomPhoto src={`/api/storage${selectedImage.objectPath}`} alt={selectedImage.alt} /> : <video className="evidence-viewer-image" controls playsInline autoPlay={false} src={`/api/storage${selectedImage.objectPath}`}>Seu navegador não oferece suporte a vídeo.</video>}</div></div></div>}
        {editingTask && task && canEditTask && <TaskEditModal task={task} onClose={() => setEditingTask(false)} onSave={saveTask} saving={updateTask.isPending} />}
        <TaskCompletionMessage open={!!task && thankedTaskId === task.id} onClose={() => setThankedTaskId(null)} />
   </div>;
}