import { Filter, Plus, Search, Trash2, UploadCloud } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { getGetDashboardSummaryQueryKey, getListStoresQueryKey, getListTasksQueryKey, getListTeamMembersQueryKey, useCreateBulkTasks, useCreateRecurringTasks, useCreateTask, useDeleteAllTasks, useDeleteTask, useGetMe, useListStores, useListTasks, useListTeamMembers, useRequestUploadUrl } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { todayInput } from '@/lib/demo-data';
import { ErrorState, LoadingBlocks, SearchEmpty, TaskGroupRow, TaskRow } from '@/components/ui-kit';

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
  const supervisors = members.filter((member) => member.role === 'supervisor' && member.active);
  const activeManagerForStore = (storeId: string) => {
    const store = stores.find((item) => item.id === storeId);
    return members.find((member) => (
      member.role === 'manager'
      && member.active
      && (
        member.storeId === storeId
        || (store?.manager && member.name.trim().toLowerCase() === store.manager.trim().toLowerCase())
      )
    ));
  };
  const [notice, setNotice] = useState('');
  const [uploadingModel, setUploadingModel] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [recurrenceMode, setRecurrenceMode] = useState<'daily_count' | 'weekdays_until'>('daily_count');
  const [occurrenceCount, setOccurrenceCount] = useState(20);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [endDate, setEndDate] = useState(todayInput);
  const [draft, setDraft] = useState({
    title: '', description: '', storeId: '', storeName: '', storeIds: [] as string[],
    assignee: '', assigneeRole: 'manager' as 'manager' | 'supervisor', scope: 'single' as 'single' | 'selected' | 'all', category: 'Operação', priority: 'medium' as 'low' | 'medium' | 'high',
    dueDate: todayInput, dueTime: '17:00', evidenceRequired: true, evidenceTypes: ['photo'] as ('photo' | 'video')[], modelObjectPath: null as string | null, instructions: '',
  });
  useEffect(() => {
    if (!stores.length) return;
    setDraft((current) => {
      const selectedStore = stores.find((store) => store.id === current.storeId) ?? stores[0];
      const canonicalAssignee = current.assigneeRole === 'manager'
        ? activeManagerForStore(selectedStore.id)?.name ?? ''
        : current.assignee;
      const availableStoreIds = current.storeIds.filter((storeId) => stores.some((store) => store.id === storeId));
      const storeIds = availableStoreIds.length ? availableStoreIds : [selectedStore.id];
      if (
        current.storeId === selectedStore.id
        && current.storeName === selectedStore.name
        && current.assignee === canonicalAssignee
        && current.storeIds.join(',') === storeIds.join(',')
      ) return current;
      return {
        ...current,
        storeId: selectedStore.id,
        storeName: selectedStore.name,
        assignee: canonicalAssignee,
        storeIds,
      };
    });
  }, [stores, members]);
  const set = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const uploadModel = async (file: File) => {
    setUploadingModel(true);
    try {
      const upload = await requestUpload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type || 'application/octet-stream' } });
      const response = await fetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      if (!response.ok) throw new Error('Upload failed');
      setDraft((current) => ({ ...current, modelObjectPath: upload.objectPath }));
      setNotice('Imagem de modelo anexada.');
    } catch {
      setNotice('Não foi possível enviar a imagem de modelo.');
    } finally {
      setUploadingModel(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim()) { setNotice('Dê um nome para a tarefa antes de salvar.'); return; }
    const selectedStoreIds = draft.scope === 'all' ? stores.map((store) => store.id) : draft.scope === 'selected' ? draft.storeIds : [draft.storeId];
    if (!stores.length || !selectedStoreIds.length || selectedStoreIds.some((storeId) => !stores.some((store) => store.id === storeId))) { setNotice('Selecione pelo menos uma loja.'); return; }
    if (draft.assigneeRole === 'manager' && draft.scope === 'single' && !draft.assignee.trim()) { setNotice('A loja selecionada ainda não possui um gerente ativo.'); return; }
    if (draft.assigneeRole === 'supervisor' && !draft.assignee) { setNotice('Selecione o supervisor responsável.'); return; }
    if (repeat && recurrenceMode === 'weekdays_until' && weekdays.length === 0) { setNotice('Escolha pelo menos um dia da semana.'); return; }
    if (repeat && recurrenceMode === 'weekdays_until' && endDate < draft.dueDate) { setNotice('A data final deve ser posterior à data inicial.'); return; }
    const mutationOptions = {
      onSuccess: () => {
        client.invalidateQueries({ queryKey: getListTasksQueryKey() });
        client.invalidateQueries({ queryKey: getListTasksQueryKey({ status: 'pending' }) });
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
    } else if (draft.scope !== 'single') {
      const { storeId: _storeId, storeName: _storeName, scope: _scope, ...common } = draft;
      createBulkTasks.mutate({ data: { ...common, storeIds: selectedStoreIds } }, mutationOptions);
    } else {
      const { scope: _scope, ...singleTask } = draft;
      createTask.mutate({ data: singleTask }, mutationOptions);
    }
  };
  const pending = createTask.isPending || createBulkTasks.isPending || createRecurringTasks.isPending || uploadingModel;
  const weekdayOptions = [{ value: 0, label: 'Dom' }, { value: 1, label: 'Seg' }, { value: 2, label: 'Ter' }, { value: 3, label: 'Qua' }, { value: 4, label: 'Qui' }, { value: 5, label: 'Sex' }, { value: 6, label: 'Sáb' }];
   const selectedStoreIds = draft.scope === 'all' ? stores.map((store) => store.id) : draft.scope === 'selected' ? draft.storeIds : [draft.storeId];
   const changeScope = (scope: 'single' | 'selected' | 'all') => setDraft((current) => ({
     ...current,
     scope,
     storeIds: scope === 'all' ? stores.map((store) => store.id) : scope === 'selected' ? (current.storeIds.length ? current.storeIds : [current.storeId]) : [current.storeId],
   }));
   const toggleStore = (storeId: string) => setDraft((current) => ({
     ...current,
     storeIds: current.storeIds.includes(storeId) ? current.storeIds.filter((id) => id !== storeId) : [...current.storeIds, storeId],
   }));
   return <div className="modal-backdrop" role="dialog" aria-modal="true"><form className="modal" onSubmit={submit}><div className="modal-head"><div><div className="eyebrow">Nova execução</div><div className="modal-title">Criar tarefa</div></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar formulário" data-testid="button-close-create">×</button></div><div className="form-grid">
    <div className="field full"><label htmlFor="task-title">Título</label><input id="task-title" className="input" value={draft.title} onChange={(event) => set('title', event.target.value)} placeholder="Ex.: Conferir exposição da campanha" data-testid="input-task-title" /></div>
     <div className="field full"><label htmlFor="task-description">Descrição</label><textarea id="task-description" className="textarea" value={draft.description} onChange={(event) => set('description', event.target.value)} placeholder="O que precisa ser feito?" data-testid="input-task-description" /></div>
     <div className="field full"><label htmlFor="task-model">Imagem de modelo (opcional)</label><label className="capture-button" htmlFor="task-model"><UploadCloud size={17} /> {uploadingModel ? 'Enviando imagem...' : draft.modelObjectPath ? 'Imagem de modelo anexada' : 'Anexar exemplo visual'}<input id="task-model" type="file" accept="image/*" className="hidden-file" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadModel(file); event.currentTarget.value = ''; }} disabled={uploadingModel} data-testid="input-task-model" /></label>{draft.modelObjectPath && <div className="field-hint">A imagem será exibida separadamente das evidências da execução. <button type="button" className="section-link" onClick={() => setDraft((current) => ({ ...current, modelObjectPath: null }))}>Remover</button></div>}</div>
     <div className="field"><label htmlFor="task-scope">Abrangência</label><select id="task-scope" className="select" value={draft.scope} onChange={(event) => changeScope(event.target.value as 'single' | 'selected' | 'all')} data-testid="select-task-scope"><option value="single">Uma loja</option><option value="selected">Selecionar várias lojas</option><option value="all">Todas as lojas</option></select></div>
     <div className={`field ${draft.scope !== 'single' ? 'full' : ''}`}><label htmlFor="task-store">{draft.scope === 'selected' ? `Lojas selecionadas (${selectedStoreIds.length})` : 'Loja'}</label>{draft.scope === 'single' ? <select id="task-store" className="select" value={draft.storeId} onChange={(event) => { const store = stores.find((item) => item.id === event.target.value); setDraft((current) => ({ ...current, storeId: event.target.value, storeName: store?.name ?? current.storeName, storeIds: [event.target.value], assignee: current.assigneeRole === 'manager' ? activeManagerForStore(event.target.value)?.name ?? '' : current.assignee })); }} data-testid="select-task-store">{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select> : <div className="store-picker">{draft.scope === 'all' ? <div className="store-picker-all">Todas as {stores.length} lojas serão incluídas.</div> : stores.map((store) => <label className="store-picker-option" key={store.id}><input type="checkbox" checked={draft.storeIds.includes(store.id)} onChange={() => toggleStore(store.id)} data-testid={`checkbox-task-store-${store.id}`} /><span>{store.name}</span><small>{store.city}</small></label>)}</div>}</div>
     <div className="field"><label htmlFor="task-assignee-role">Responsável</label><select id="task-assignee-role" className="select" value={draft.assigneeRole} onChange={(event) => { const role = event.target.value as 'manager' | 'supervisor'; setDraft((current) => ({ ...current, assigneeRole: role, assignee: role === 'manager' ? activeManagerForStore(current.storeId)?.name ?? '' : supervisors[0]?.name ?? '' })); }} data-testid="select-task-assignee-role"><option value="manager">Gerente de cada loja</option>{!isSupervisor && <option value="supervisor">Supervisor</option>}</select></div>
     <div className="field"><label htmlFor="task-assignee">{draft.assigneeRole === 'supervisor' ? 'Supervisor escolhido' : 'Gerente responsável'}</label>{draft.assigneeRole === 'supervisor' ? <select id="task-assignee" className="select" value={draft.assignee} onChange={(event) => set('assignee', event.target.value)} data-testid="select-task-supervisor"><option value="">Selecione</option>{supervisors.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}</select> : <input id="task-assignee" className="input" value={draft.scope !== 'single' ? 'Gerente de cada loja' : draft.assignee} readOnly data-testid="input-task-manager" />}</div>
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
  const [search, setSearch] = useState(''); const [status, setStatus] = useState('all'); const [category, setCategory] = useState('all'); const [creating, setCreating] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
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
  const query = useListTasks(params, { query: { queryKey: getListTasksQueryKey(params) } });
  const deleteTask = useDeleteTask();
  const deleteAllTasks = useDeleteAllTasks();
   const data = (query.data ?? []).filter((task) => isAdmin || task.dueDate <= todayInput);
  const tasks = useMemo(() => data.filter((task) => `${task.title} ${task.storeName} ${task.assignee}`.toLowerCase().includes(search.toLowerCase())), [data, search]);
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
  const categories = [...new Set(data.map((task) => task.category))];
  const removeTask = (task: { id: string; title: string }) => {
    if (!window.confirm(`Excluir definitivamente "${task.title}"? Esta ação apagará a tarefa e suas evidências.`)) return;
    deleteTask.mutate({ id: task.id }, {
      onSuccess: () => {
        client.invalidateQueries({ queryKey: getListTasksQueryKey() });
        client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
    });
  };
  const removeAllTasks = () => {
    if (!tasks.length || !window.confirm(`Excluir definitivamente as ${tasks.length} tarefas visíveis? Esta ação apagará as tarefas, evidências, comentários e imagens de modelo selecionados.`)) return;
    deleteAllTasks.mutate({ data: { taskIds: tasks.map((task) => task.id) } }, {
      onSuccess: () => {
        client.invalidateQueries({ queryKey: getListTasksQueryKey() });
        client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
    });
  };
  return <div className="content"><div className="page-head"><div><div className="eyebrow">Ritmo operacional</div><h1 className="page-title">Tarefas</h1><p className="page-intro">Veja, execute e comprove cada combinado da rede.</p></div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{isAdmin && <button className="button button-danger" onClick={removeAllTasks} disabled={deleteAllTasks.isPending || !tasks.length} data-testid="button-delete-all-tasks"><Trash2 size={15} /> {deleteAllTasks.isPending ? 'Excluindo...' : `Excluir ${tasks.length || 'todas'} visíveis`}</button>}{canCreate && <button className="button button-primary" onClick={() => setCreating(true)} data-testid="button-new-task"><Plus size={15} /> Nova tarefa</button>}</div></div>
     <div className="card filters"><div className="search-wrap"><Search size={15} /><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por tarefa, loja ou responsável" aria-label="Buscar tarefas" data-testid="input-search-tasks" /></div><select className="select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por status" data-testid="select-filter-status"><option value="all">Todos os status</option><option value="pending">Pendentes</option><option value="in_progress">Em execução</option><option value="pending_review">Aguardando conferência</option><option value="rejected">Reprovadas</option><option value="completed">Concluídas</option><option value="overdue">Atrasadas</option></select><select className="select" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filtrar por categoria" data-testid="select-filter-category"><option value="all">Todas categorias</option>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select>{isAdmin && <><label className="date-filter"><span>De</span><input type="date" className="input" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} aria-label="Data inicial" data-testid="input-filter-date-from" /></label><label className="date-filter"><span>Até</span><input type="date" className="input" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} aria-label="Data final" data-testid="input-filter-date-to" /></label>{(dateFrom || dateTo) && <button className="button button-ghost" type="button" onClick={() => { setDateFrom(''); setDateTo(''); }} data-testid="button-clear-date-filter">Limpar datas</button>}</>}<button className="icon-button" aria-label="Filtros adicionais" data-testid="button-filter"><Filter size={15} /></button></div>
      {query.isError ? <ErrorState onRetry={() => query.refetch()} /> : query.isLoading ? <LoadingBlocks rows={2} /> : taskRows.length ? <div className="task-list">{taskRows.map((row) => row.tasks.length > 1 ? <TaskGroupRow key={row.key} tasks={row.tasks} onDelete={isAdmin ? removeTask : undefined} /> : <TaskRow key={row.key} task={row.tasks[0]} onDelete={isAdmin ? removeTask : undefined} />)}</div> : <div className="card"><SearchEmpty /></div>}
    {creating && canCreate && <TaskCreateModal onClose={() => setCreating(false)} />}
  </div>;
}