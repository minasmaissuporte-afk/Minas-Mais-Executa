import { Filter, Plus, Search, Trash2, UploadCloud } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { getGetDashboardSummaryQueryKey, getListStoresQueryKey, getListTaskSummariesQueryKey, getListTasksQueryKey, getListTeamMembersQueryKey, useCreateBulkTasks, useCreateRecurringTasks, useCreateTask, useDeleteAllTasks, useDeleteTask, useGetMe, useListStores, useListTaskSummaries, useListTeamMembers, useRequestUploadUrl } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { todayInput } from '@/lib/demo-data';
import { ErrorState, LoadingBlocks, SearchEmpty, TaskGroupRow, TaskRow } from '@/components/ui-kit';

const taskListReturnContextKey = 'minas-mais-executa:task-list-return-context';

type TaskListReturnContext = {
  search: string;
  status: string;
  category: string;
  dateFrom: string;
  dateTo: string;
  expandedGroupIds: string[];
  orderedTaskIds: string[];
  scrollY: number;
};

function readTaskListReturnContext(): TaskListReturnContext | null {
  if (new URLSearchParams(window.location.search).get('restoreStores') !== '1') return null;
  try {
    const value = sessionStorage.getItem(taskListReturnContextKey);
    return value ? JSON.parse(value) as TaskListReturnContext : null;
  } catch {
    return null;
  }
}

function TaskCreateModal({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const storesQuery = useListStores({ query: { queryKey: getListStoresQueryKey() } });
  const membersQuery = useListTeamMembers(undefined, { query: { queryKey: getListTeamMembersQueryKey() } });
  const createTask = useCreateTask();
  const createBulkTasks = useCreateBulkTasks();
  const createRecurringTasks = useCreateRecurringTasks();
  const requestUpload = useRequestUploadUrl();
  const me = useGetMe();
  const stores = storesQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const isSupervisor = me.data?.role === 'supervisor';
  const isAdmin = me.data?.role === 'admin';
  const supervisors = members.filter((member) => member.role === 'supervisor' && member.active);
  const activeManagerForStore = (storeId: string) => {
    const store = stores.find((item) => item.id === storeId);
    return members.find((member) => (
      member.role === 'manager'
      && member.active
      && (
        member.storeId === storeId
        || member.id === store?.managerMemberId
        || (store?.manager && member.name.trim().toLowerCase() === store.manager.trim().toLowerCase())
      )
    ));
  };
  const supervisorOwnsStore = (store: typeof stores[number], member: typeof supervisors[number]) => (
    store.supervisorMemberId === member.id
    || member.storeId === store.id
    || (store.supervisor && store.supervisor.trim().toLowerCase() === member.name.trim().toLowerCase())
  );
  const linkedStoreIdsForSupervisors = (memberIds: string[]) => stores
    .filter((store) => supervisors.some((member) => memberIds.includes(member.id) && supervisorOwnsStore(store, member)))
    .map((store) => store.id);
  const [notice, setNotice] = useState('');
  const [uploadingModel, setUploadingModel] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [adminSupervisorMode, setAdminSupervisorMode] = useState<'single' | 'all'>('single');
  const [adminStoreMode, setAdminStoreMode] = useState<'all' | 'selected'>('all');
  const [recurrenceMode, setRecurrenceMode] = useState<'daily_count' | 'weekdays_until'>('daily_count');
  const [occurrenceCount, setOccurrenceCount] = useState(20);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [endDate, setEndDate] = useState(todayInput);
  const [draft, setDraft] = useState({
    title: '', description: '', storeId: '', storeName: '', storeIds: [] as string[],
    assignee: '', assigneeMemberIds: [] as string[], assigneeRole: 'manager' as 'manager' | 'supervisor', scope: 'single' as 'single' | 'selected' | 'all', category: 'Operação', priority: 'medium' as 'low' | 'high' | 'medium',
    dueDate: todayInput, dueTime: '17:00', evidenceRequired: true, evidenceTypes: ['photo'] as ('photo' | 'video')[], modelObjectPath: null as string | null, modelAttachments: [] as Array<{ objectPath: string; fileName: string; type: 'photo' | 'video' }>, instructions: '',
  });
  useEffect(() => {
    if (!stores.length) return;
    setDraft((current) => {
      const selectedStore = stores.find((store) => store.id === current.storeId) ?? stores[0];
      const selectedSupervisorIds = current.assigneeMemberIds.filter((memberId) => supervisors.some((member) => member.id === memberId));
       const assigneeRole = isAdmin ? 'manager' : current.assigneeRole;
       const assigneeMemberIds = isAdmin && supervisors.length
         ? selectedSupervisorIds.length ? selectedSupervisorIds : [supervisors[0].id]
         : assigneeRole === 'supervisor' && supervisors.length
        ? selectedSupervisorIds.length ? selectedSupervisorIds : [supervisors[0].id]
        : current.assigneeMemberIds;
       const canonicalAssignee = isAdmin
         ? 'Gerente de cada loja'
         : assigneeRole === 'manager'
        ? activeManagerForStore(selectedStore.id)?.name ?? ''
        : supervisors.filter((member) => assigneeMemberIds.includes(member.id)).map((member) => member.name).join(', ');
      const availableStoreIds = current.storeIds.filter((storeId) => stores.some((store) => store.id === storeId));
      const storeIds = isAdmin
        ? availableStoreIds.length ? availableStoreIds.filter((storeId) => linkedStoreIdsForSupervisors(assigneeMemberIds).includes(storeId)) : linkedStoreIdsForSupervisors(assigneeMemberIds)
        : availableStoreIds.length ? availableStoreIds : [selectedStore.id];
      if (
        current.storeId === selectedStore.id
        && current.storeName === selectedStore.name
        && current.assignee === canonicalAssignee
        && current.assigneeRole === assigneeRole
        && current.assigneeMemberIds.join(',') === assigneeMemberIds.join(',')
        && current.storeIds.join(',') === storeIds.join(',')
      ) return current;
      return {
        ...current,
        storeId: selectedStore.id,
        storeName: selectedStore.name,
        assigneeRole,
        assignee: canonicalAssignee,
        assigneeMemberIds,
        scope: isAdmin ? 'selected' : current.scope,
        storeIds,
      };
    });
  }, [stores, members, isAdmin]);
  const set = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const uploadModels = async (files: File[]) => {
    if (!files.length) return;
    setUploadingModel(true);
    let uploadedCount = 0;
    try {
      for (const file of files) {
        const upload = await requestUpload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type || 'application/octet-stream' } });
        const response = await fetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
        if (!response.ok) throw new Error('Upload failed');
        const type = file.type.startsWith('video/') ? 'video' : 'photo';
        setDraft((current) => ({
          ...current,
          modelObjectPath: current.modelObjectPath ?? upload.objectPath,
          modelAttachments: [...current.modelAttachments, { objectPath: upload.objectPath, fileName: file.name, type }],
        }));
        uploadedCount += 1;
      }
      setNotice(`${uploadedCount} exemplo(s) visual(is) anexado(s).`);
    } catch {
      setNotice(uploadedCount ? `${uploadedCount} exemplo(s) anexado(s), mas não foi possível enviar todos os arquivos.` : 'Não foi possível enviar os exemplos visuais.');
    } finally {
      setUploadingModel(false);
    }
  };
  const removeModel = (objectPath: string) => setDraft((current) => {
    const modelAttachments = current.modelAttachments.filter((attachment) => attachment.objectPath !== objectPath);
    return { ...current, modelAttachments, modelObjectPath: modelAttachments[0]?.objectPath ?? null };
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim()) { setNotice('Dê um nome para a tarefa antes de salvar.'); return; }
     const allowedStoreIds = isAdmin ? linkedStoreIdsForSupervisors(draft.assigneeMemberIds) : stores.map((store) => store.id);
     const selectedStoreIds = isAdmin
       ? draft.storeIds.filter((storeId) => allowedStoreIds.includes(storeId))
       : draft.scope === 'all' ? stores.map((store) => store.id) : draft.scope === 'selected' ? draft.storeIds : [draft.storeId];
     if ((isAdmin || draft.assigneeRole === 'supervisor') && !draft.assigneeMemberIds.length) { setNotice('Selecione pelo menos um supervisor responsável.'); return; }
    if (!stores.length || !selectedStoreIds.length || selectedStoreIds.some((storeId) => !stores.some((store) => store.id === storeId))) { setNotice('Selecione pelo menos uma loja.'); return; }
    if (draft.assigneeRole === 'manager' && draft.scope === 'single' && !draft.assignee.trim()) { setNotice('A loja selecionada ainda não possui um gerente ativo.'); return; }
    if (repeat && recurrenceMode === 'weekdays_until' && weekdays.length === 0) { setNotice('Escolha pelo menos um dia da semana.'); return; }
    if (repeat && recurrenceMode === 'weekdays_until' && endDate < draft.dueDate) { setNotice('A data final deve ser posterior à data inicial.'); return; }
    const mutationOptions = {
      onSuccess: () => {
        client.invalidateQueries({ queryKey: getListTasksQueryKey() });
        client.invalidateQueries({ queryKey: getListTasksQueryKey({ status: 'pending' }) });
        client.invalidateQueries({ queryKey: getListTaskSummariesQueryKey() });
        client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setNotice(repeat ? `Repetição programada para ${selectedStoreIds.length} loja(s).` : selectedStoreIds.length > 1 ? `Tarefa criada para ${selectedStoreIds.length} lojas.` : 'Tarefa criada com sucesso.'); setTimeout(onClose, 700);
      }, onError: () => setNotice('Não foi possível criar a tarefa.'),
    };
    if (repeat) {
      const { storeId: _storeId, storeName: _storeName, scope: _scope, ...common } = draft;
      createRecurringTasks.mutate({ data: {
        ...common,
        storeIds: selectedStoreIds,
        recurrenceMode,
        ...(recurrenceMode === 'daily_count' ? { occurrenceCount } : { weekdays, endDate }),
      } }, mutationOptions);
    } else if (isAdmin || draft.scope !== 'single') {
      const { storeId: _storeId, storeName: _storeName, scope: _scope, ...common } = draft;
      createBulkTasks.mutate({ data: { ...common, storeIds: selectedStoreIds } }, mutationOptions);
    } else {
      const { scope: _scope, ...singleTask } = draft;
      createTask.mutate({ data: singleTask }, mutationOptions);
    }
  };
  const pending = createTask.isPending || createBulkTasks.isPending || createRecurringTasks.isPending || uploadingModel;
  const weekdayOptions = [{ value: 0, label: 'Dom' }, { value: 1, label: 'Seg' }, { value: 2, label: 'Ter' }, { value: 3, label: 'Qua' }, { value: 4, label: 'Qui' }, { value: 5, label: 'Sex' }, { value: 6, label: 'Sáb' }];
     const allowedStoreIds = isAdmin ? linkedStoreIdsForSupervisors(draft.assigneeMemberIds) : stores.map((store) => store.id);
     const selectedStoreIds = isAdmin
       ? draft.storeIds.filter((storeId) => allowedStoreIds.includes(storeId))
      : draft.scope === 'all' ? stores.map((store) => store.id) : draft.scope === 'selected' ? draft.storeIds : [draft.storeId];
    const scopeAllLabel = isSupervisor ? 'Todas as lojas da minha região' : 'Todas as lojas';
    const scopeSelectionLabel = isSupervisor ? `Lojas da sua região selecionadas (${selectedStoreIds.length})` : `Lojas selecionadas (${selectedStoreIds.length})`;
    const scopeSelectionDescription = isSupervisor ? 'Marque somente as lojas da sua região que receberão esta tarefa.' : 'Selecione e desmarque as lojas que receberão esta tarefa.';
   const changeScope = (scope: 'single' | 'selected' | 'all') => setDraft((current) => ({
     ...current,
     scope,
     storeIds: scope === 'all' ? stores.map((store) => store.id) : scope === 'selected' ? (current.storeIds.length ? current.storeIds : [current.storeId]) : [current.storeId],
   }));
   const toggleStore = (storeId: string) => setDraft((current) => ({
     ...current,
     storeIds: current.storeIds.includes(storeId) ? current.storeIds.filter((id) => id !== storeId) : [...current.storeIds, storeId],
   }));
   const selectedSupervisorIds = draft.assigneeMemberIds;
    const allowedAdminStores = stores.filter((store) => linkedStoreIdsForSupervisors(selectedSupervisorIds).includes(store.id));
    const chooseAdminSupervisorMode = (mode: 'single' | 'all') => {
      const nextIds = mode === 'all' ? supervisors.map((member) => member.id) : supervisors.slice(0, 1).map((member) => member.id);
      setAdminSupervisorMode(mode);
      setAdminStoreMode('all');
      setDraft((current) => ({
        ...current,
        assigneeRole: 'manager',
        assignee: 'Gerente de cada loja',
        assigneeMemberIds: nextIds,
        scope: 'selected',
        storeIds: linkedStoreIdsForSupervisors(nextIds),
      }));
    };
    const toggleAdminSupervisor = (memberId: string) => {
      setAdminSupervisorMode('single');
      setDraft((current) => ({
        ...current,
        assigneeRole: 'manager',
        assignee: 'Gerente de cada loja',
        assigneeMemberIds: current.assigneeMemberIds.includes(memberId)
          ? current.assigneeMemberIds.filter((id) => id !== memberId)
          : [...current.assigneeMemberIds, memberId],
        scope: 'selected',
        storeIds: (() => {
          const nextIds = current.assigneeMemberIds.includes(memberId)
            ? current.assigneeMemberIds.filter((id) => id !== memberId)
            : [...current.assigneeMemberIds, memberId];
          const nextAllowedIds = linkedStoreIdsForSupervisors(nextIds);
          const retainedIds = current.storeIds.filter((id) => nextAllowedIds.includes(id));
          return adminStoreMode === 'all' ? nextAllowedIds : retainedIds;
        })(),
      }));
    };
    const chooseAdminStoreMode = (mode: 'all' | 'selected') => {
      setAdminStoreMode(mode);
      if (mode === 'all') setDraft((current) => ({ ...current, storeIds: allowedAdminStores.map((store) => store.id) }));
    };
    const toggleAdminStoreSelectAll = () => {
      if (adminStoreMode === 'all') {
        setAdminStoreMode('selected');
        setDraft((current) => ({ ...current, storeIds: [] }));
        return;
      }
      chooseAdminStoreMode('all');
    };
    const toggleAdminStore = (storeId: string) => {
      setAdminStoreMode('selected');
      toggleStore(storeId);
    };
    const allSupervisorsSelected = supervisors.length > 0 && supervisors.every((member) => selectedSupervisorIds.includes(member.id));
    const selectSupervisors = (nextIds: string[], role: 'manager' | 'supervisor' = 'supervisor') => setDraft((current) => {
      const previousIds = current.assigneeRole === 'supervisor' ? current.assigneeMemberIds : [];
      const previouslyLinkedStoreIds = linkedStoreIdsForSupervisors(previousIds);
       const nextLinkedStoreIds = linkedStoreIdsForSupervisors(nextIds);
      const retainedManualStoreIds = current.assigneeRole === 'supervisor'
        ? current.storeIds.filter((storeId) => !previouslyLinkedStoreIds.includes(storeId) || nextLinkedStoreIds.includes(storeId))
        : [];
       const storeIds = isAdmin
         ? current.storeIds.filter((storeId) => nextLinkedStoreIds.includes(storeId))
         : [...new Set([...retainedManualStoreIds, ...nextLinkedStoreIds])];
      return {
        ...current,
         assigneeRole: isAdmin ? 'manager' : role,
        assigneeMemberIds: nextIds,
         assignee: isAdmin ? 'Gerente de cada loja' : supervisors.filter((member) => nextIds.includes(member.id)).map((member) => member.name).join(', '),
         scope: role === 'supervisor' ? 'selected' : current.scope,
        storeIds: role === 'supervisor' ? storeIds : current.storeIds,
      };
    });
    const toggleSupervisor = (memberId: string) => {
      const nextIds = selectedSupervisorIds.includes(memberId)
        ? selectedSupervisorIds.filter((id) => id !== memberId)
        : [...selectedSupervisorIds, memberId];
      selectSupervisors(nextIds);
    };
    const toggleAllSupervisors = () => selectSupervisors(allSupervisorsSelected ? [] : supervisors.map((member) => member.id));
    return <div className="modal-backdrop task-create-backdrop" role="dialog" aria-modal="true"><form className="modal task-create-modal" onSubmit={submit}><div className="modal-head"><div><div className="eyebrow">Nova execução</div><div className="modal-title">Criar tarefa</div></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar formulário" data-testid="button-close-create">×</button></div><div className="form-grid">
    <div className="field full"><label htmlFor="task-title">Título</label><input id="task-title" className="input" value={draft.title} onChange={(event) => set('title', event.target.value)} placeholder="Ex.: Conferir exposição da campanha" data-testid="input-task-title" /></div>
     <div className="field full"><label htmlFor="task-description">Descrição</label><textarea id="task-description" className="textarea" value={draft.description} onChange={(event) => set('description', event.target.value)} placeholder="O que precisa ser feito?" data-testid="input-task-description" /></div>
      <div className="field full"><label htmlFor="task-model">Modelos / exemplos (opcional)</label><label className="capture-button" htmlFor="task-model"><UploadCloud size={17} /> {uploadingModel ? 'Enviando arquivos...' : draft.modelAttachments.length ? `${draft.modelAttachments.length} exemplo(s) anexado(s)` : 'Anexar fotos ou vídeos de exemplo'}<input id="task-model" type="file" accept="image/*,video/*" multiple className="hidden-file" onChange={(event) => { const files = Array.from(event.target.files ?? []); if (files.length) void uploadModels(files); event.currentTarget.value = ''; }} disabled={uploadingModel} data-testid="input-task-model" /></label>{draft.modelAttachments.length > 0 && <><div className="field-hint">Os exemplos serão exibidos separadamente das evidências da execução. Você pode anexar mais arquivos ou remover individualmente.</div><div className="model-upload-list">{draft.modelAttachments.map((attachment) => <div className="model-upload-item" key={attachment.objectPath}><span>{attachment.type === 'video' ? 'Vídeo' : 'Foto'} · {attachment.fileName}</span><button type="button" className="section-link" onClick={() => removeModel(attachment.objectPath)}>Remover</button></div>)}</div></>}</div>
     {!isAdmin && <div className="field"><label htmlFor="task-scope">Abrangência</label><select id="task-scope" className="select" value={draft.scope} onChange={(event) => changeScope(event.target.value as 'single' | 'selected' | 'all')} data-testid="select-task-scope"><option value="single">Uma loja</option><option value="selected">Selecionar várias lojas</option><option value="all">{scopeAllLabel}</option></select><label className="scope-checkbox"><input type="checkbox" checked={draft.scope === 'selected'} onChange={(event) => changeScope(event.target.checked ? 'selected' : 'single')} data-testid="checkbox-task-select-stores" /><span><strong>Marcar lojas manualmente</strong><small>{scopeSelectionDescription}</small></span></label></div>}
       {!isAdmin && <div className={`field ${draft.scope !== 'single' ? 'full' : ''}`}><label htmlFor="task-store">{draft.scope === 'selected' ? scopeSelectionLabel : 'Loja'}</label>{draft.scope === 'single' ? <select id="task-store" className="select" value={draft.storeId} onChange={(event) => { const store = stores.find((item) => item.id === event.target.value); setDraft((current) => ({ ...current, storeId: event.target.value, storeName: store?.name ?? current.storeName, storeIds: [event.target.value], assignee: current.assigneeRole === 'manager' ? activeManagerForStore(event.target.value)?.name ?? '' : current.assignee })); }} data-testid="select-task-store">{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select> : <div className="store-picker">{draft.scope === 'all' ? <div className="store-picker-all">{isSupervisor ? `Todas as ${stores.length} lojas da sua região serão incluídas.` : `Todas as ${stores.length} lojas serão incluídas.`}</div> : stores.map((store) => <label className="store-picker-option" key={store.id}><input type="checkbox" checked={draft.storeIds.includes(store.id)} onChange={() => toggleStore(store.id)} data-testid={`checkbox-task-store-${store.id}`} /><span>{store.name}</span><small>{store.city}</small></label>)}</div>}</div>}
        {isAdmin && <><div className="field"><label htmlFor="task-admin-supervisors-menu">Supervisores</label><details className="multi-select-details" id="task-admin-supervisors-menu"><summary className="multi-select-summary">{adminSupervisorMode === 'all' ? 'Todos os supervisores' : selectedSupervisorIds.length ? `${selectedSupervisorIds.length} supervisor(es) selecionado(s)` : 'Selecionar supervisor'}</summary><div className="multi-select-options"><label className="store-picker-option multi-select-all-option"><input type="checkbox" checked={adminSupervisorMode === 'all'} onChange={() => chooseAdminSupervisorMode(adminSupervisorMode === 'all' ? 'single' : 'all')} data-testid="checkbox-task-admin-all-supervisors" /><span>Todos os supervisores</span><small>Seleciona todas as lojas automaticamente</small></label>{supervisors.length ? supervisors.map((member) => <label className="store-picker-option" key={member.id}><input type="checkbox" checked={selectedSupervisorIds.includes(member.id)} onChange={() => toggleAdminSupervisor(member.id)} data-testid={`checkbox-task-admin-supervisor-${member.id}`} /><span>{member.name}</span><small>{member.email}</small></label>) : <div className="store-picker-all">Nenhum supervisor ativo disponível.</div>}</div></details></div><div className="field full"><label htmlFor="task-admin-stores-menu">Lojas ({selectedStoreIds.length})</label><details className="multi-select-details" id="task-admin-stores-menu"><summary className="multi-select-summary">{adminStoreMode === 'all' ? adminSupervisorMode === 'all' ? 'Todas as lojas selecionadas automaticamente' : 'Selecionar todas as lojas' : selectedStoreIds.length ? `${selectedStoreIds.length} loja(s) selecionada(s)` : 'Escolher lojas'}</summary><div className="multi-select-options"><label className="store-picker-option multi-select-all-option"><input type="checkbox" checked={adminStoreMode === 'all'} onChange={toggleAdminStoreSelectAll} disabled={!selectedSupervisorIds.length} data-testid="checkbox-task-admin-all-stores" /><span>Selecionar todas as lojas</span><small>{adminSupervisorMode === 'all' ? 'Incluídas pelos supervisores selecionados' : 'Todas as lojas permitidas'}</small></label>{allowedAdminStores.length ? allowedAdminStores.map((store) => <label className="store-picker-option" key={store.id}><input type="checkbox" checked={draft.storeIds.includes(store.id)} onChange={() => toggleAdminStore(store.id)} data-testid={`checkbox-task-store-${store.id}`} /><span>{store.name}</span><small>{store.city}</small></label>) : <div className="store-picker-all">Selecione um supervisor para ver as lojas vinculadas.</div>}</div></details><div className="field-hint">A lista mostra somente lojas dos supervisores selecionados.</div></div></>}
       {!isAdmin && <div className="field"><label htmlFor="task-assignee-role">Responsável</label><select id="task-assignee-role" className="select" value={draft.assigneeRole} onChange={(event) => { const role = event.target.value as 'manager' | 'supervisor'; if (role === 'supervisor') { selectSupervisors(supervisors.slice(0, 1).map((member) => member.id)); } else { setDraft((current) => ({ ...current, assigneeRole: role, assigneeMemberIds: [], assignee: activeManagerForStore(current.storeId)?.name ?? '' })); } }} data-testid="select-task-assignee-role"><option value="manager">Gerente de cada loja</option>{!isSupervisor && <option value="supervisor">Supervisor</option>}</select></div>}
        {!isAdmin && <div className={`field ${draft.assigneeRole === 'supervisor' ? 'full' : ''}`}><label htmlFor="task-assignee">{draft.assigneeRole === 'supervisor' ? `Supervisores escolhidos (${selectedSupervisorIds.length})` : 'Gerente responsável'}</label>{draft.assigneeRole === 'supervisor' ? <div className="store-picker supervisor-picker" id="task-assignee">{supervisors.length ? <><label className="store-picker-all supervisor-select-all"><input type="checkbox" checked={allSupervisorsSelected} onChange={toggleAllSupervisors} data-testid="checkbox-task-all-supervisors" /><span>Selecionar todos os supervisores</span></label>{supervisors.map((member) => <label className="store-picker-option" key={member.id}><input type="checkbox" checked={selectedSupervisorIds.includes(member.id)} onChange={() => toggleSupervisor(member.id)} data-testid={`checkbox-task-supervisor-${member.id}`} /><span>{member.name}</span><small>{member.email}</small></label>)}</> : <div className="store-picker-all">Nenhum supervisor ativo disponível.</div>}</div> : <input id="task-assignee" className="input" value={draft.scope !== 'single' ? 'Gerente de cada loja' : draft.assignee} readOnly data-testid="input-task-manager" />}</div>}
    <div className="field"><label htmlFor="task-category">Categoria</label><select id="task-category" className="select" value={draft.category} onChange={(event) => set('category', event.target.value)} data-testid="select-task-category"><option>Operação</option><option>Campanhas</option><option>Qualidade</option><option>Abastecimento</option></select></div>
    <div className="field"><label htmlFor="task-priority">Prioridade</label><select id="task-priority" className="select" value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as 'low' | 'medium' | 'high' }))} data-testid="select-task-priority"><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option></select></div>
    <div className="field"><label htmlFor="task-date">Primeiro dia</label><input id="task-date" type="date" className="input" value={draft.dueDate} onChange={(event) => { const value = event.target.value; set('dueDate', value); if (endDate < value) setEndDate(value); }} data-testid="input-task-date" /></div>
    <div className="field"><label htmlFor="task-time">Horário</label><input id="task-time" type="time" className="input" value={draft.dueTime} onChange={(event) => set('dueTime', event.target.value)} data-testid="input-task-time" /></div>
    <div className="field full recurrence-panel"><label className="recurrence-toggle"><input type="checkbox" checked={repeat} onChange={(event) => setRepeat(event.target.checked)} data-testid="checkbox-task-repeat" /><span><strong>Repetir esta tarefa</strong><small>Cada dia será uma nova tarefa, com status e evidência próprios.</small></span></label>
      {repeat && <div className="recurrence-fields"><div className="field"><label htmlFor="recurrence-mode">Tipo de repetição</label><select id="recurrence-mode" className="select" value={recurrenceMode} onChange={(event) => setRecurrenceMode(event.target.value as 'daily_count' | 'weekdays_until')} data-testid="select-recurrence-mode"><option value="daily_count">Todos os dias</option><option value="weekdays_until">Dias específicos da semana</option></select></div>
        {recurrenceMode === 'daily_count' ? <div className="field"><label htmlFor="occurrence-count">Por quantos dias?</label><input id="occurrence-count" type="number" min="1" max="365" className="input" value={occurrenceCount} onChange={(event) => setOccurrenceCount(Math.max(1, Number(event.target.value)))} data-testid="input-occurrence-count" /></div> : <><div className="field"><label htmlFor="recurrence-end-date">Repetir até</label><input id="recurrence-end-date" type="date" min={draft.dueDate} className="input" value={endDate} onChange={(event) => setEndDate(event.target.value)} data-testid="input-recurrence-end-date" /></div><div className="field full"><label>Dias da semana</label><div className="weekday-picker">{weekdayOptions.map((day) => <label key={day.value} className={weekdays.includes(day.value) ? 'selected' : ''}><input type="checkbox" checked={weekdays.includes(day.value)} onChange={() => setWeekdays((current) => current.includes(day.value) ? current.filter((value) => value !== day.value) : [...current, day.value])} /><span>{day.label}</span></label>)}</div></div></>}
      </div>}
    </div>
    <div className="field full"><label htmlFor="task-instructions">Instruções de comprovação</label><textarea id="task-instructions" className="textarea" value={draft.instructions} onChange={(event) => set('instructions', event.target.value)} placeholder="Como comprovar que foi feito?" data-testid="input-task-instructions" /></div>
   </div>{draft.scope !== 'single' && <div className="bulk-task-note">Será criada uma tarefa independente para cada uma das {selectedStoreIds.length} lojas selecionadas. Cada unidade terá seu próprio status e suas próprias evidências.</div>}{notice && <div className="stat-meta" style={{ marginTop: 12, color: notice.includes('sucesso') || notice.includes('criada') || notice.includes('programada') ? 'hsl(var(--primary))' : 'hsl(var(--destructive))' }} data-testid="status-create-notice">{notice}</div>}<div className="form-actions"><button type="button" className="button button-ghost" onClick={onClose} data-testid="button-cancel-create">Cancelar</button><button type="submit" className="button button-primary" disabled={pending} data-testid="button-submit-task"><Plus size={15} /> {pending ? 'Salvando...' : repeat ? 'Programar repetição' : draft.scope !== 'single' ? `Criar para ${selectedStoreIds.length} lojas` : 'Criar tarefa'}</button></div></form></div>;
}

export default function TasksPage() {
  const [returnContext] = useState(readTaskListReturnContext);
  const restoreApplied = useRef(false);
  const [search, setSearch] = useState(returnContext?.search ?? ''); const [status, setStatus] = useState(returnContext?.status ?? 'all'); const [category, setCategory] = useState(returnContext?.category ?? 'all'); const [creating, setCreating] = useState(false); const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState(returnContext?.dateFrom ?? '');
  const [dateTo, setDateTo] = useState(returnContext?.dateTo ?? '');
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(() => new Set(returnContext?.expandedGroupIds ?? []));
  const client = useQueryClient();
  const me = useGetMe();
  const isAdmin = me.data?.role === 'admin';
   const canCreate = me.data?.role === 'admin' || me.data?.role === 'supervisor';
  const params = {
    status: status === 'all' ? undefined : status,
    category: category === 'all' ? undefined : category,
    dateFrom: isAdmin && dateFrom ? dateFrom : undefined,
    dateTo: isAdmin && dateTo ? dateTo : undefined,
  };
   const query = useListTaskSummaries(params, { query: { queryKey: getListTaskSummariesQueryKey(params) } });
  const deleteTask = useDeleteTask();
  const deleteAllTasks = useDeleteAllTasks();
   const data = (query.data ?? []).filter((task) => isAdmin || task.dueDate <= todayInput);
   const tasks = useMemo(() => {
     const matches = data.filter((task) => `${task.title} ${task.storeName} ${task.assignee}`.toLowerCase().includes(search.toLowerCase()));
     if (!returnContext?.orderedTaskIds.length) return matches;
     const order = new Map(returnContext.orderedTaskIds.map((taskId, index) => [taskId, index]));
     return [...matches].sort((first, second) => (order.get(first.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(second.id) ?? Number.MAX_SAFE_INTEGER));
   }, [data, search, returnContext]);
  const taskRows = useMemo(() => {
    const rows: Array<{ key: string; tasks: typeof tasks }> = [];
    const bulkRows = new Map<string, typeof tasks>();
    tasks.forEach((task) => {
      if (!task.batchGroupId) {
        rows.push({ key: task.id, tasks: [task] });
        return;
      }
      const existing = bulkRows.get(task.batchGroupId);
      if (existing) existing.push(task);
      else {
        const group = [task];
        bulkRows.set(task.batchGroupId, group);
        rows.push({ key: task.batchGroupId, tasks: group });
      }
    });
    return rows;
  }, [tasks]);
  useEffect(() => {
    if (!returnContext || restoreApplied.current || query.isFetching) return;
    restoreApplied.current = true;
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo(0, returnContext.scrollY);
      sessionStorage.removeItem(taskListReturnContextKey);
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.hash}`);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [returnContext, query.isFetching]);
  const rememberTaskListContext = (groupId: string) => {
    const expanded = new Set(expandedGroupIds);
    expanded.add(groupId);
    try {
      sessionStorage.setItem(taskListReturnContextKey, JSON.stringify({
        search,
        status,
        category,
        dateFrom,
        dateTo,
        expandedGroupIds: [...expanded],
        orderedTaskIds: tasks.map((task) => task.id),
        scrollY: window.scrollY,
      } satisfies TaskListReturnContext));
    } catch {
      // Navigation remains available if browser storage is disabled or full.
    }
  };
  const categories = [...new Set(data.map((task) => task.category))];
  const removeTask = (task: { id: string; title: string }) => {
    if (!window.confirm(`Excluir definitivamente "${task.title}"? Esta ação apagará a tarefa e suas evidências.`)) return;
    deleteTask.mutate({ id: task.id }, {
      onSuccess: () => {
        client.invalidateQueries({ queryKey: getListTasksQueryKey() });
        client.invalidateQueries({ queryKey: getListTaskSummariesQueryKey() });
        client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
    });
  };
  const toggleTaskSelection = (taskId: string) => setSelectedTaskIds((current) => {
    const next = new Set(current);
    if (next.has(taskId)) next.delete(taskId);
    else next.add(taskId);
    return next;
  });
  const toggleTaskGroupSelection = (taskIds: string[]) => setSelectedTaskIds((current) => {
    const next = new Set(current);
    const shouldSelect = taskIds.some((taskId) => !next.has(taskId));
    taskIds.forEach((taskId) => shouldSelect ? next.add(taskId) : next.delete(taskId));
    return next;
  });
  const toggleVisibleTaskSelection = () => setSelectedTaskIds((current) => {
    const next = new Set(current);
    const shouldSelect = tasks.some((task) => !next.has(task.id));
    tasks.forEach((task) => shouldSelect ? next.add(task.id) : next.delete(task.id));
    return next;
  });
  const selectedVisibleTaskIds = tasks.filter((task) => selectedTaskIds.has(task.id)).map((task) => task.id);
  const removeSelectedTasks = () => {
    if (!selectedVisibleTaskIds.length || !window.confirm(`Excluir definitivamente ${selectedVisibleTaskIds.length} tarefa(s) selecionada(s)? Esta ação apagará as tarefas, evidências, comentários e imagens de modelo.`)) return;
    deleteAllTasks.mutate({ data: { taskIds: selectedVisibleTaskIds } }, {
      onSuccess: () => {
        setSelectedTaskIds(new Set());
        client.invalidateQueries({ queryKey: getListTasksQueryKey() });
         client.invalidateQueries({ queryKey: getListTaskSummariesQueryKey() });
        client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
    });
  };
  return <div className="content"><div className="page-head"><div><div className="eyebrow">Ritmo operacional</div><h1 className="page-title">Tarefas</h1><p className="page-intro">Veja, execute e comprove cada combinado da rede.</p></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{canCreate && <button className="button button-primary" onClick={() => setCreating(true)} data-testid="button-new-task"><Plus size={15} /> Nova tarefa</button>}</div></div>
      <div className="card filters"><div className="search-wrap"><Search size={15} /><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por tarefa, loja ou responsável" aria-label="Buscar tarefas" data-testid="input-search-tasks" /></div><select className="select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por status" data-testid="select-filter-status"><option value="all">Todos os status</option><option value="pending">Pendentes</option><option value="in_progress">Em execução</option><option value="pending_review">Aguardando conferência</option><option value="rejected">Reprovadas</option><option value="completed">Concluídas</option><option value="overdue">Atrasadas</option></select><select className="select" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filtrar por categoria" data-testid="select-filter-category"><option value="all">Todas categorias</option>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select>{isAdmin && <><label className="date-filter"><span>De</span><input type="date" className="input" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} aria-label="Data inicial" data-testid="input-filter-date-from" /></label><label className="date-filter"><span>Até</span><input type="date" className="input" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} aria-label="Data final" data-testid="input-filter-date-to" /></label>{(dateFrom || dateTo) && <button className="button button-ghost" type="button" onClick={() => { setDateFrom(''); setDateTo(''); }} data-testid="button-clear-date-filter">Limpar datas</button>}</>}<button className="icon-button" aria-label="Filtros adicionais" data-testid="button-filter"><Filter size={15} /></button></div>
       {isAdmin && <div className="bulk-task-actions"><div><strong>Exclusão por seleção</strong><span>Marque tarefas individuais ou o conjunto inteiro. A seleção respeita a busca e os filtros aplicados.</span></div><label className="bulk-select-all"><input type="checkbox" checked={tasks.length > 0 && tasks.every((task) => selectedTaskIds.has(task.id))} onChange={toggleVisibleTaskSelection} data-testid="checkbox-select-visible-tasks" /><span>Selecionar todas ({tasks.length})</span></label><button className="button button-danger" onClick={removeSelectedTasks} disabled={deleteAllTasks.isPending || !selectedVisibleTaskIds.length} data-testid="button-delete-selected-tasks"><Trash2 size={15} /> {deleteAllTasks.isPending ? 'Excluindo...' : `Excluir selecionadas (${selectedVisibleTaskIds.length})`}</button></div>}
        {query.isError ? <ErrorState onRetry={() => query.refetch()} /> : query.isLoading ? <LoadingBlocks rows={2} /> : taskRows.length ? <div className="task-list">{taskRows.map((row) => row.tasks.length > 1 ? <TaskGroupRow key={row.key} tasks={row.tasks} onDelete={isAdmin ? removeTask : undefined} selectedTaskIds={selectedTaskIds} onToggleSelect={isAdmin ? toggleTaskSelection : undefined} onToggleGroupSelect={isAdmin ? toggleTaskGroupSelection : undefined} expanded={expandedGroupIds.has(row.key)} onExpandedChange={(expanded) => setExpandedGroupIds((current) => { const next = new Set(current); if (expanded) next.add(row.key); else next.delete(row.key); return next; })} onOpenTask={() => rememberTaskListContext(row.key)} /> : <TaskRow key={row.key} task={row.tasks[0]} onDelete={isAdmin ? removeTask : undefined} selected={selectedTaskIds.has(row.tasks[0].id)} onToggleSelect={isAdmin ? toggleTaskSelection : undefined} onOpenTask={row.tasks[0].batchGroupId ? () => rememberTaskListContext(row.key) : undefined} />)}</div> : <div className="card"><SearchEmpty /></div>}
    {creating && canCreate && <TaskCreateModal onClose={() => setCreating(false)} />}
  </div>;
}