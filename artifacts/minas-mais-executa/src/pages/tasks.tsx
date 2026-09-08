import { Filter, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { getGetDashboardSummaryQueryKey, getListStoresQueryKey, getListTasksQueryKey, getListTeamMembersQueryKey, useCreateBulkTasks, useCreateRecurringTasks, useCreateTask, useListStores, useListTasks, useListTeamMembers } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { fallbackStores, fallbackTasks, todayInput } from '@/lib/demo-data';
import { ErrorState, LoadingBlocks, SearchEmpty, TaskGroupRow, TaskRow } from '@/components/ui-kit';

function TaskCreateModal({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const storesQuery = useListStores({ query: { queryKey: getListStoresQueryKey() } });
  const supervisorsQuery = useListTeamMembers({ role: 'supervisor' }, { query: { queryKey: getListTeamMembersQueryKey({ role: 'supervisor' }) } });
  const createTask = useCreateTask();
  const createBulkTasks = useCreateBulkTasks();
  const createRecurringTasks = useCreateRecurringTasks();
  const stores = storesQuery.data ?? fallbackStores;
  const supervisors = (supervisorsQuery.data ?? []).filter((member) => member.active);
  const [notice, setNotice] = useState('');
  const [repeat, setRepeat] = useState(false);
  const [recurrenceMode, setRecurrenceMode] = useState<'daily_count' | 'weekdays_until'>('daily_count');
  const [occurrenceCount, setOccurrenceCount] = useState(20);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [endDate, setEndDate] = useState(todayInput);
  const [draft, setDraft] = useState({
    title: '', description: '', storeId: stores[0]?.id ?? 'store-01', storeName: stores[0]?.name ?? 'Savassi 01',
    assignee: stores[0]?.manager ?? 'Marina Alves', assigneeRole: 'manager' as 'manager' | 'supervisor', scope: 'single' as 'single' | 'all', category: 'Operação', priority: 'medium' as 'low' | 'medium' | 'high',
    dueDate: todayInput, dueTime: '17:00', evidenceRequired: true, evidenceTypes: ['photo'] as ('photo' | 'video')[], instructions: '',
  });
  const set = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim()) { setNotice('Dê um nome para a tarefa antes de salvar.'); return; }
    if (draft.assigneeRole === 'supervisor' && !draft.assignee) { setNotice('Selecione o supervisor responsável.'); return; }
    if (repeat && recurrenceMode === 'weekdays_until' && weekdays.length === 0) { setNotice('Escolha pelo menos um dia da semana.'); return; }
    if (repeat && recurrenceMode === 'weekdays_until' && endDate < draft.dueDate) { setNotice('A data final deve ser posterior à data inicial.'); return; }
    const mutationOptions = {
      onSuccess: () => {
        client.invalidateQueries({ queryKey: getListTasksQueryKey() });
        client.invalidateQueries({ queryKey: getListTasksQueryKey({ status: 'pending' }) });
        client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        setNotice(repeat ? 'Repetição programada com sucesso.' : draft.scope === 'all' ? `Tarefa criada para ${stores.length} lojas.` : 'Tarefa criada com sucesso.'); setTimeout(onClose, 700);
      }, onError: () => setNotice('Não foi possível criar a tarefa.'),
    };
    if (repeat) {
      const { storeId: _storeId, storeName: _storeName, scope: _scope, ...common } = draft;
      createRecurringTasks.mutate({ data: {
        ...common,
        storeIds: draft.scope === 'all' ? stores.map((store) => store.id) : [draft.storeId],
        recurrenceMode,
        ...(recurrenceMode === 'daily_count' ? { occurrenceCount } : { weekdays, endDate }),
      } }, mutationOptions);
    } else if (draft.scope === 'all') {
      const { storeId: _storeId, storeName: _storeName, scope: _scope, ...common } = draft;
      createBulkTasks.mutate({ data: { ...common, storeIds: stores.map((store) => store.id) } }, mutationOptions);
    } else {
      const { scope: _scope, ...singleTask } = draft;
      createTask.mutate({ data: singleTask }, mutationOptions);
    }
  };
  const pending = createTask.isPending || createBulkTasks.isPending || createRecurringTasks.isPending;
  const weekdayOptions = [{ value: 0, label: 'Dom' }, { value: 1, label: 'Seg' }, { value: 2, label: 'Ter' }, { value: 3, label: 'Qua' }, { value: 4, label: 'Qui' }, { value: 5, label: 'Sex' }, { value: 6, label: 'Sáb' }];
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><form className="modal" onSubmit={submit}><div className="modal-head"><div><div className="eyebrow">Nova execução</div><div className="modal-title">Criar tarefa</div></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar formulário" data-testid="button-close-create">×</button></div><div className="form-grid">
    <div className="field full"><label htmlFor="task-title">Título</label><input id="task-title" className="input" value={draft.title} onChange={(event) => set('title', event.target.value)} placeholder="Ex.: Conferir exposição da campanha" data-testid="input-task-title" /></div>
    <div className="field full"><label htmlFor="task-description">Descrição</label><textarea id="task-description" className="textarea" value={draft.description} onChange={(event) => set('description', event.target.value)} placeholder="O que precisa ser feito?" data-testid="input-task-description" /></div>
    <div className="field"><label htmlFor="task-scope">Abrangência</label><select id="task-scope" className="select" value={draft.scope} onChange={(event) => setDraft((current) => ({ ...current, scope: event.target.value as 'single' | 'all' }))} data-testid="select-task-scope"><option value="single">Uma loja</option><option value="all">Todas as lojas</option></select></div>
    <div className="field"><label htmlFor="task-store">Loja</label><select id="task-store" className="select" value={draft.storeId} disabled={draft.scope === 'all'} onChange={(event) => { const store = stores.find((item) => item.id === event.target.value); setDraft((current) => ({ ...current, storeId: event.target.value, storeName: store?.name ?? current.storeName, assignee: current.assigneeRole === 'manager' ? store?.manager ?? current.assignee : current.assignee })); }} data-testid="select-task-store">{draft.scope === 'all' && <option value={draft.storeId}>Todas as {stores.length} lojas</option>}{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></div>
    <div className="field"><label htmlFor="task-assignee-role">Responsável</label><select id="task-assignee-role" className="select" value={draft.assigneeRole} onChange={(event) => { const role = event.target.value as 'manager' | 'supervisor'; const selectedStore = stores.find((store) => store.id === draft.storeId); setDraft((current) => ({ ...current, assigneeRole: role, assignee: role === 'manager' ? selectedStore?.manager ?? '' : supervisors[0]?.name ?? '' })); }} data-testid="select-task-assignee-role"><option value="manager">Gerente de cada loja</option><option value="supervisor">Supervisor</option></select></div>
    <div className="field"><label htmlFor="task-assignee">{draft.assigneeRole === 'supervisor' ? 'Supervisor escolhido' : 'Gerente responsável'}</label>{draft.assigneeRole === 'supervisor' ? <select id="task-assignee" className="select" value={draft.assignee} onChange={(event) => set('assignee', event.target.value)} data-testid="select-task-supervisor"><option value="">Selecione</option>{supervisors.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}</select> : <input id="task-assignee" className="input" value={draft.scope === 'all' ? 'Gerente de cada loja' : draft.assignee} readOnly data-testid="input-task-manager" />}</div>
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
  </div>{draft.scope === 'all' && <div className="bulk-task-note">Será criada uma tarefa independente para cada loja. Cada unidade terá seu próprio status e suas próprias evidências.</div>}{notice && <div className="stat-meta" style={{ marginTop: 12, color: notice.includes('sucesso') || notice.includes('criada') ? 'hsl(var(--primary))' : 'hsl(var(--destructive))' }} data-testid="status-create-notice">{notice}</div>}<div className="form-actions"><button type="button" className="button button-ghost" onClick={onClose} data-testid="button-cancel-create">Cancelar</button><button type="submit" className="button button-primary" disabled={pending} data-testid="button-submit-task"><Plus size={15} /> {pending ? 'Salvando...' : repeat ? 'Programar repetição' : draft.scope === 'all' ? `Criar para ${stores.length} lojas` : 'Criar tarefa'}</button></div></form></div>;
}

export default function TasksPage() {
  const [search, setSearch] = useState(''); const [status, setStatus] = useState('all'); const [category, setCategory] = useState('all'); const [creating, setCreating] = useState(false);
  const params = { status: status === 'all' ? undefined : status, category: category === 'all' ? undefined : category };
  const query = useListTasks(params, { query: { queryKey: getListTasksQueryKey(params) } });
  const data = (query.data ?? fallbackTasks).filter((task) => task.dueDate <= todayInput);
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
  return <div className="content"><div className="page-head"><div><div className="eyebrow">Ritmo operacional</div><h1 className="page-title">Tarefas</h1><p className="page-intro">Veja, execute e comprove cada combinado da rede.</p></div><button className="button button-primary" onClick={() => setCreating(true)} data-testid="button-new-task"><Plus size={15} /> Nova tarefa</button></div>
    <div className="card filters"><div className="search-wrap"><Search size={15} /><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por tarefa, loja ou responsável" aria-label="Buscar tarefas" data-testid="input-search-tasks" /></div><select className="select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por status" data-testid="select-filter-status"><option value="all">Todos os status</option><option value="pending">Pendentes</option><option value="in_progress">Em execução</option><option value="completed">Concluídas</option><option value="overdue">Atrasadas</option></select><select className="select" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filtrar por categoria" data-testid="select-filter-category"><option value="all">Todas categorias</option>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select><button className="icon-button" aria-label="Filtros adicionais" data-testid="button-filter"><Filter size={15} /></button></div>
    {query.isError ? <ErrorState onRetry={() => query.refetch()} /> : query.isLoading ? <LoadingBlocks rows={2} /> : taskRows.length ? <div className="task-list">{taskRows.map((row) => row.tasks.length > 1 ? <TaskGroupRow key={row.key} tasks={row.tasks} /> : <TaskRow key={row.key} task={row.tasks[0]} />)}</div> : <div className="card"><SearchEmpty /></div>}
    {creating && <TaskCreateModal onClose={() => setCreating(false)} />}
  </div>;
}