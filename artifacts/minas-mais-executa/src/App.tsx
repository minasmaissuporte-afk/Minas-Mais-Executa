import { useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, Show, SignIn, SignUp, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  ArrowDownRight, ArrowUpRight, BarChart3, Bell, Camera, Check, CheckCircle2,
  ChevronRight, CircleAlert, FileVideo, Filter, LayoutDashboard, ListChecks,
  Paperclip, Plus, Search, Store as StoreIcon, UploadCloud,
} from 'lucide-react';
import {
  getGetActivityQueryKey, getGetDashboardSummaryQueryKey, getGetRankingsQueryKey,
  getGetTaskQueryKey, getListStoresQueryKey, getListTasksQueryKey,
  useAddTaskEvidence, useCompleteTask, useCreateTask, useGetActivity,
  useGetDashboardSummary, useGetRankings, useGetTask, useListStores, useListTasks,
  useUpdateTask,
} from '@workspace/api-client-react';
import type {
  Activity, DashboardSummary, Evidence, RankingEntry, Store as StoreType, Task,
} from '@workspace/api-client-react';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import './index.css';

const queryClient = new QueryClient();
type Role = 'manager' | 'supervisor' | 'admin';
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const todayInput = new Date().toISOString().slice(0, 10);
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in environment.');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: 'hsl(31 85% 55%)',
    colorForeground: 'hsl(210 28% 18%)',
    colorMutedForeground: 'hsl(215 12% 45%)',
    colorDanger: 'hsl(0 70% 48%)',
    colorBackground: 'hsl(40 33% 97%)',
    colorInput: 'hsl(0 0% 100%)',
    colorInputForeground: 'hsl(210 28% 18%)',
    colorNeutral: 'hsl(210 18% 85%)',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.65rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-white rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-slate-900',
    headerSubtitle: 'text-slate-600',
    socialButtonsBlockButtonText: 'text-slate-800',
    formFieldLabel: 'text-slate-800',
    footerActionLink: 'text-amber-700',
    footerActionText: 'text-slate-600',
    dividerText: 'text-slate-500',
    identityPreviewEditButton: 'text-amber-700',
    formFieldSuccessText: 'text-emerald-700',
    alertText: 'text-red-700',
    logoBox: 'mb-4',
    logoImage: 'max-h-9',
    socialButtonsBlockButton: 'border-slate-200',
    formButtonPrimary: 'bg-slate-900 hover:bg-slate-800',
    formFieldInput: 'border-slate-200 text-slate-900',
    footerAction: 'text-slate-600',
    dividerLine: 'bg-slate-200',
    alert: 'bg-red-50 border-red-200',
    otpCodeFieldInput: 'border-slate-200 text-slate-900',
    formFieldRow: 'mb-4',
    main: 'bg-transparent',
  },
};

const fallbackTasks: Task[] = [
  { id: 'task-204', title: 'Conferir exposição da campanha de inverno', description: 'Validar se os materiais e a comunicação de preço estão corretos na área de destaque.', storeId: 'store-01', storeName: 'Savassi 01', assignee: 'Marina Alves', category: 'Campanhas', priority: 'high', dueDate: '2025-06-18', dueTime: '11:00', status: 'in_progress', evidenceRequired: true, evidenceTypes: ['photo'], evidence: [], instructions: 'Fotografe a ponta de gôndola completa, incluindo a etiqueta de preço.', completedAt: null, completedBy: null },
  { id: 'task-198', title: 'Repor itens de alto giro', description: 'Garantir disponibilidade dos SKUs destacados no relatório de ruptura.', storeId: 'store-01', storeName: 'Savassi 01', assignee: 'Marina Alves', category: 'Abastecimento', priority: 'high', dueDate: '2025-06-18', dueTime: '14:30', status: 'pending', evidenceRequired: true, evidenceTypes: ['photo'], evidence: [], instructions: 'Faça a checagem no salão e no estoque antes de registrar a evidência.', completedAt: null, completedBy: null },
  { id: 'task-193', title: 'Atualizar checklist de temperatura', description: 'Registrar a leitura dos equipamentos de armazenamento conforme rotina.', storeId: 'store-01', storeName: 'Savassi 01', assignee: 'Carlos Mendes', category: 'Qualidade', priority: 'medium', dueDate: '2025-06-18', dueTime: '16:00', status: 'completed', evidenceRequired: false, evidenceTypes: [], evidence: [], instructions: 'Anote a leitura de cada equipamento no checklist físico.', completedAt: '2025-06-18T09:42:00', completedBy: 'Carlos Mendes' },
  { id: 'task-187', title: 'Revisar planograma de dermocosméticos', description: 'Comparar o mobiliário com a última versão aprovada.', storeId: 'store-02', storeName: 'Centro 03', assignee: 'João Silva', category: 'Operação', priority: 'low', dueDate: '2025-06-18', dueTime: '17:30', status: 'overdue', evidenceRequired: false, evidenceTypes: [], evidence: [], instructions: 'Sinalize qualquer divergência na observação da tarefa.', completedAt: null, completedBy: null },
];
const fallbackActivities: Activity[] = [
  { id: 'a1', title: 'Tarefa concluída', detail: 'Atualizar checklist de temperatura · Savassi 01', createdAt: '2025-06-18T09:42:00', tone: 'success' },
  { id: 'a2', title: 'Evidência adicionada', detail: 'Campanha de inverno · Centro 03', createdAt: '2025-06-18T09:16:00', tone: 'info' },
  { id: 'a3', title: 'Prazo ultrapassado', detail: 'Revisar planograma · Centro 03', createdAt: '2025-06-18T08:50:00', tone: 'warning' },
];
const fallbackSummary: DashboardSummary = { role: 'manager', storeName: 'Savassi 01', tasksToday: 12, completed: 7, pending: 4, overdue: 1, execution: 82.4, storesCount: 38, campaignsActive: 4, actionPlans: 3 };
const fallbackStores: StoreType[] = [
  { id: 'store-01', name: 'Savassi 01', city: 'Belo Horizonte', region: 'Centro-Sul', manager: 'Marina Alves', execution: 94.8 },
  { id: 'store-02', name: 'Centro 03', city: 'Belo Horizonte', region: 'Centro', manager: 'João Silva', execution: 88.1 },
  { id: 'store-03', name: 'Uberlândia 02', city: 'Uberlândia', region: 'Triângulo', manager: 'Letícia Rocha', execution: 84.6 },
  { id: 'store-04', name: 'Juiz de Fora 01', city: 'Juiz de Fora', region: 'Zona da Mata', manager: 'Rafael Costa', execution: 79.3 },
];
const fallbackRankings: RankingEntry[] = fallbackStores.map((store, index) => ({ position: index + 1, storeName: store.name, manager: store.manager, execution: store.execution, trend: index === 0 ? 'up' : index === 1 ? 'stable' : 'down' }));

function formatDate(date?: string | null) {
  if (!date) return 'Hoje';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(date));
}
function formatTime(date?: string | null) {
  if (!date) return '';
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(date));
}
function initials(name: string) {
  return name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}
function statusLabel(status: string) {
  return ({ pending: 'Pendente', in_progress: 'Em execução', completed: 'Concluída', overdue: 'Atrasada' } as Record<string, string>)[status] || status;
}
function roleLabel(role: Role) {
  return ({ manager: 'Gerente de loja', supervisor: 'Supervisão', admin: 'Administração' })[role];
}

function NavItem({ href, label, icon: Icon }: { href: string; label: string; icon: typeof LayoutDashboard }) {
  const [location] = useLocation();
  const active = href === '/' ? location === '/' : location.startsWith(href);
  return <Link href={href} className={`nav-item ${active ? 'active' : ''}`} data-testid={`link-nav-${label.toLowerCase()}`}><Icon size={16} strokeWidth={active ? 2.5 : 1.8} /><span>{label}</span></Link>;
}

function Shell({ children, role, onRoleChange }: { children: React.ReactNode; role: Role; onRoleChange: (role: Role) => void }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const pageName = location === '/' ? 'Visão geral' : location.split('/')[1] === 'tasks' ? 'Tarefas' : location.split('/')[1] === 'stores' ? 'Lojas' : 'Relatórios';
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand" data-testid="link-brand"><span className="brand-mark">M</span><span><span className="brand-name">Minas Mais</span><span className="brand-sub">Executa</span></span></Link>
      <div className="nav-label">Operação</div>
      <nav className="nav-list">
        <NavItem href="/" label="Visão geral" icon={LayoutDashboard} />
        <NavItem href="/tasks" label="Tarefas" icon={ListChecks} />
        <NavItem href="/stores" label="Lojas" icon={StoreIcon} />
        <NavItem href="/reports" label="Relatórios" icon={BarChart3} />
      </nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-footer"><div className="user-row"><span className="avatar">MA</span><span><div className="user-name">Marina Alves</div><div className="user-role">{roleLabel(role)}</div></span></div></div>
    </aside>
    <main className="main-area">
     <header className="topbar"><div className="breadcrumb">Minas Mais <span>/</span> <strong>{pageName}</strong></div><div className="top-actions"><select className="role-switch" value={role} onChange={(event) => onRoleChange(event.target.value as Role)} aria-label="Selecionar papel de demonstração" data-testid="select-role"><option value="manager">Gerente de loja</option><option value="supervisor">Supervisão</option><option value="admin">Administração</option></select><button className="icon-button" aria-label="Notificações" data-testid="button-notifications"><Bell size={16} /></button><button className="icon-button" aria-label="Sair" data-testid="button-logout" onClick={() => signOut({ redirectUrl: basePath || '/' })}><ArrowUpRight size={16} /></button></div></header>
      {children}
    </main>
    <nav className="mobile-nav"><NavItem href="/" label="Início" icon={LayoutDashboard} /><NavItem href="/tasks" label="Tarefas" icon={ListChecks} /><NavItem href="/stores" label="Lojas" icon={StoreIcon} /><NavItem href="/reports" label="Dados" icon={BarChart3} /></nav>
  </div>;
}

function LoadingCard() {
  return <div className="card card-pad" style={{ minHeight: 140 }}><div className="skeleton" /><div className="skeleton short" /><div className="skeleton line" /></div>;
}
function ErrorMessage({ onRetry }: { onRetry?: () => void }) {
  return <div className="error-state" data-testid="status-error">Não foi possível carregar os dados agora. <button className="button button-danger" onClick={onRetry} data-testid="button-retry">Tentar novamente</button></div>;
}

function TaskRow({ task }: { task: Task }) {
  return <div className="task-row" data-testid={`row-task-${task.id}`}><span className={`task-status-dot dot-${task.status}`} /><Link href={`/tasks/${task.id}`} data-testid={`link-task-${task.id}`}><div className="task-main"><div className="task-title">{task.title}</div><div className="task-sub">{task.category} · {task.storeName}</div></div></Link><span className={`priority priority-${task.priority}`}>{task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}</span><span className="task-time">{task.dueTime}</span><ChevronRight size={15} color="hsl(215 12% 45%)" /></div>;
}

function Dashboard({ role }: { role: Role }) {
  const summaryQuery = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const activityQuery = useGetActivity({ query: { queryKey: getGetActivityQueryKey() } });
  const tasksQuery = useListTasks({ status: 'pending' }, { query: { queryKey: getListTasksQueryKey({ status: 'pending' }) } });
  const summary = summaryQuery.data ?? { ...fallbackSummary, role };
  const tasks = (tasksQuery.data ?? fallbackTasks).slice(0, 4);
  const activities = activityQuery.data ?? fallbackActivities;
  const execute = summary.execution;
  return <div className="content">
     <div className="page-head"><div><div className="eyebrow">Acompanhamento de hoje</div><h1 className="page-title">Bom dia, Marina.</h1><p className="page-intro">{role === 'manager' ? <>Sua loja está em ritmo de execução. <strong>{summary.pending} tarefas</strong> pedem atenção antes do fim do dia.</> : <>Acompanhe a execução da rede e encontre o próximo ponto de atenção.</>}</p></div><Link className="button button-primary" href="/tasks" data-testid="link-open-tasks"><ListChecks size={15} /> Abrir tarefas</Link></div>
    <div className="stats-grid">
      <div className="card stat-card stat-accent"><span className="stat-label">Execução da loja</span><span className="stat-value">{execute.toFixed(1)}<small style={{ fontSize: 13 }}>%</small></span><span className="stat-meta">+4,2 pts esta semana</span></div>
      <div className="card stat-card"><span className="stat-label">Tarefas de hoje</span><span className="stat-value">{summary.tasksToday}</span><span className="stat-meta">{summary.completed} finalizadas</span></div>
      <div className="card stat-card stat-warn"><span className="stat-label">Em aberto</span><span className="stat-value">{summary.pending}</span><span className="stat-meta">Priorize as de alta</span></div>
      <div className="card stat-card stat-alert"><span className="stat-label">Atrasadas</span><span className="stat-value">{summary.overdue}</span><span className="stat-meta">Requer ação imediata</span></div>
    </div>
    <div className="dashboard-grid">
      <section className="card card-pad"><div className="section-heading"><div><div className="section-title">Fila de execução</div><div className="stat-meta">O que precisa acontecer agora</div></div><Link href="/tasks" className="section-link" data-testid="link-view-all-tasks">Ver todas <ArrowUpRight size={13} /></Link></div>{tasksQuery.isLoading ? <LoadingCard /> : <div className="task-stack">{tasks.length ? tasks.map((task) => <TaskRow key={task.id} task={task} />) : <div className="empty-state"><CheckCircle2 size={25} /><h3>Tudo em dia</h3><p>Nenhuma tarefa pendente neste momento.</p></div>}</div>}</section>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <section className="card card-pad execution-card"><div className="section-heading"><div className="section-title">Ritmo da loja</div><span className="muted" style={{ fontSize: 10 }}>hoje</span></div><div className="execution-number">{execute.toFixed(1)}<small>%</small></div><div className="muted" style={{ fontSize: 11, margin: '6px 0 13px' }}>Meta diária: 90%</div><div className="progress-track" style={{ background: 'hsl(215 28% 29%)' }}><div className="progress-fill" style={{ width: `${Math.min(execute, 100)}%`, background: 'hsl(32 80% 63%)' }} /></div></section>
        <section className="card card-pad"><div className="section-heading"><div className="section-title">Atividade recente</div><span className="stat-meta">últimas 24h</span></div><div className="activity-list">{activities.slice(0, 3).map((activity) => <div className="activity-item" key={activity.id} data-testid={`activity-${activity.id}`}><span className={`activity-mark mark-${activity.tone}`} /><div><div className="activity-title">{activity.title}</div><div className="activity-detail">{activity.detail}</div><div className="activity-date">{formatDate(activity.createdAt)} · {formatTime(activity.createdAt)}</div></div></div>)}</div></section>
      </div>
    </div>
  </div>;
}

function TaskCreateModal({ onClose }: { onClose: () => void }) {
  const createTask = useCreateTask();
  const client = useQueryClient();
  const [notice, setNotice] = useState('');
   const [draft, setDraft] = useState({ title: '', description: '', storeId: 'store-centro', storeName: 'Loja Centro', assignee: 'João Mendes', category: 'Rotina', priority: 'medium' as 'low' | 'medium' | 'high', dueDate: todayInput, dueTime: '17:00', evidenceRequired: true, evidenceTypes: ['photo'] as ('photo' | 'video')[], instructions: '' });
  const set = (key: string, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim()) { setNotice('Dê um nome para a tarefa antes de salvar.'); return; }
    createTask.mutate({ data: draft }, { onSuccess: () => { client.invalidateQueries({ queryKey: getListTasksQueryKey() }); setNotice('Tarefa criada com sucesso.'); setTimeout(onClose, 450); }, onError: () => setNotice('Não foi possível criar a tarefa.') });
  };
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><form className="modal" onSubmit={submit}><div className="modal-head"><div><div className="eyebrow">Nova execução</div><div className="modal-title">Criar tarefa</div></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar" data-testid="button-close-create"><Check size={16} /></button></div><div className="form-grid"><div className="field full"><label htmlFor="task-title">Título</label><input id="task-title" className="input" value={draft.title} onChange={(event) => set('title', event.target.value)} placeholder="Ex.: Conferir exposição da campanha" data-testid="input-task-title" /></div><div className="field full"><label htmlFor="task-description">Descrição</label><textarea id="task-description" className="textarea" value={draft.description} onChange={(event) => set('description', event.target.value)} placeholder="O que precisa ser feito?" data-testid="input-task-description" /></div><div className="field"><label htmlFor="task-category">Categoria</label><select id="task-category" className="select" value={draft.category} onChange={(event) => set('category', event.target.value)} data-testid="select-task-category"><option>Operação</option><option>Campanhas</option><option>Qualidade</option><option>Abastecimento</option></select></div><div className="field"><label htmlFor="task-priority">Prioridade</label><select id="task-priority" className="select" value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as 'low' | 'medium' | 'high' }))} data-testid="select-task-priority"><option value="high">Alta</option><option value="medium">Média</option><option value="low">Baixa</option></select></div><div className="field"><label htmlFor="task-date">Data limite</label><input id="task-date" type="date" className="input" value={draft.dueDate} onChange={(event) => set('dueDate', event.target.value)} data-testid="input-task-date" /></div><div className="field"><label htmlFor="task-time">Horário</label><input id="task-time" type="time" className="input" value={draft.dueTime} onChange={(event) => set('dueTime', event.target.value)} data-testid="input-task-time" /></div><div className="field full"><label htmlFor="task-instructions">Instruções</label><textarea id="task-instructions" className="textarea" value={draft.instructions} onChange={(event) => set('instructions', event.target.value)} placeholder="Como comprovar que foi feito?" data-testid="input-task-instructions" /></div></div>{notice && <div className="stat-meta" style={{ marginTop: 12, color: notice.includes('sucesso') ? 'hsl(var(--primary))' : 'hsl(var(--destructive))' }}>{notice}</div>}<div className="form-actions"><button type="button" className="button button-ghost" onClick={onClose} data-testid="button-cancel-create">Cancelar</button><button type="submit" className="button button-primary" disabled={createTask.isPending} data-testid="button-submit-task"><Plus size={15} /> {createTask.isPending ? 'Salvando...' : 'Criar tarefa'}</button></div></form></div>;
}

function TasksPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [creating, setCreating] = useState(false);
  const params = { status: status === 'all' ? undefined : status, category: category === 'all' ? undefined : category };
  const query = useListTasks(params, { query: { queryKey: getListTasksQueryKey(params) } });
  const data = query.data ?? fallbackTasks;
  const tasks = useMemo(() => data.filter((task) => `${task.title} ${task.storeName} ${task.assignee}`.toLowerCase().includes(search.toLowerCase())), [data, search]);
  const categories = [...new Set(data.map((task) => task.category))];
  return <div className="content"><div className="page-head"><div><div className="eyebrow">Ritmo operacional</div><h1 className="page-title">Tarefas</h1><p className="page-intro">Veja, execute e comprove cada combinado da rede.</p></div><button className="button button-primary" onClick={() => setCreating(true)} data-testid="button-new-task"><Plus size={15} /> Nova tarefa</button></div><div className="card filters"><div style={{ position: 'relative', flex: 1, minWidth: 220 }}><Search size={15} style={{ position: 'absolute', left: 11, top: 11, color: 'hsl(var(--muted-foreground))' }} /><input className="input search-input" style={{ width: '100%', paddingLeft: 34 }} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por tarefa, loja ou responsável" aria-label="Buscar tarefas" data-testid="input-search-tasks" /></div><select className="select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por status" data-testid="select-filter-status"><option value="all">Todos os status</option><option value="pending">Pendentes</option><option value="in_progress">Em execução</option><option value="completed">Concluídas</option><option value="overdue">Atrasadas</option></select><select className="select" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filtrar por categoria" data-testid="select-filter-category"><option value="all">Todas categorias</option>{categories.map((item) => <option value={item} key={item}>{item}</option>)}</select><button className="icon-button" aria-label="Filtros" data-testid="button-filter"><Filter size={15} /></button></div>{query.isError ? <ErrorMessage onRetry={() => query.refetch()} /> : <div className="task-list">{query.isLoading ? <><LoadingCard /><LoadingCard /></> : tasks.length ? tasks.map((task) => <TaskRow key={task.id} task={task} />) : <div className="card empty-state"><Search size={25} /><h3>Nenhuma tarefa encontrada</h3><p>Tente outro termo ou ajuste os filtros.</p></div>}</div>}{creating && <TaskCreateModal onClose={() => setCreating(false)} />}</div>;
}

function DetailPage() {
  const { id = 'task-204' } = useParams<{ id: string }>();
  const client = useQueryClient();
  const taskQuery = useGetTask(id, { query: { queryKey: getGetTaskQueryKey(id) } });
  const updateTask = useUpdateTask();
  const addEvidence = useAddTaskEvidence();
  const completeTask = useCompleteTask();
  const [notice, setNotice] = useState('');
  const fallback = fallbackTasks.find((item) => item.id === id) ?? fallbackTasks[0];
  const task = taskQuery.data ?? fallback;
  const evidence = taskQuery.data?.evidence ?? task.evidence ?? [];
  const updateStatus = (next: 'pending' | 'in_progress') => updateTask.mutate({ id: task.id, data: { status: next } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getGetTaskQueryKey(task.id) }); setNotice(next === 'in_progress' ? 'Tarefa assumida.' : 'Tarefa devolvida para pendências.'); }, onError: () => setNotice('Não foi possível atualizar o status.') });
  const capture = (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; addEvidence.mutate({ id: task.id, data: { type: file.type.includes('video') ? 'video' : 'photo', fileName: file.name, location: task.storeName } }, { onSuccess: () => { client.invalidateQueries({ queryKey: getGetTaskQueryKey(task.id) }); setNotice('Evidência adicionada.'); }, onError: () => setNotice('Não foi possível adicionar a evidência.') }); };
  const complete = () => completeTask.mutate({ id: task.id }, { onSuccess: () => { client.invalidateQueries({ queryKey: getGetTaskQueryKey(task.id) }); client.invalidateQueries({ queryKey: getListTasksQueryKey() }); client.invalidateQueries({ queryKey: getGetActivityQueryKey() }); setNotice('Tarefa concluída.'); }, onError: () => setNotice('Adicione as evidências obrigatórias antes de concluir.') });
  return <div className="content"><Link href="/tasks" className="section-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 17 }} data-testid="link-back-tasks">← Voltar para tarefas</Link>{taskQuery.isError && <ErrorMessage onRetry={() => taskQuery.refetch()} />}<div className="detail-layout"><div><section className="detail-hero"><div className="eyebrow">Execução · {task.category}</div><h1 className="detail-title">{task.title}</h1><div className="detail-meta"><span>{task.storeName}</span><span>•</span><span>{task.assignee}</span><span>•</span><span>vence {formatDate(task.dueDate)} às {task.dueTime}</span></div></section><section className="card card-pad detail-section"><h3>O que precisa ser feito</h3><p className="detail-copy">{task.description}</p></section><section className="card card-pad detail-section"><h3>Instruções de comprovação</h3><p className="detail-copy">{task.instructions}</p></section><section className="card card-pad detail-section"><div className="section-heading"><h3 style={{ margin: 0 }}>Evidências <span className="stat-meta">({evidence.length})</span></h3>{task.evidenceRequired && <span className="status-chip status-in_progress">Obrigatória</span>}</div>{evidence.length ? <div className="evidence-list">{evidence.map((item: Evidence) => <div className="evidence-item" key={item.id} data-testid={`evidence-${item.id}`}><span className="evidence-icon">{item.type === 'video' ? <FileVideo size={15} /> : <Camera size={15} />}</span><div><div className="evidence-file">{item.fileName}</div><div className="evidence-by">{item.userName} · {formatDate(item.createdAt)}</div></div></div>)}</div> : <div className="empty-state" style={{ padding: '25px 10px' }}><Paperclip size={22} /><h3>Ainda sem evidências</h3><p>Adicione uma foto ou vídeo para comprovar a execução.</p></div>}</section></div><aside className="sticky-card"><section className="card action-card"><h3>Próximo passo</h3>{task.status === 'completed' ? <div className="completion-state"><CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: 7 }} /> Concluída por {task.completedBy || 'Marina Alves'}</div> : <><label className="capture-button" htmlFor="evidence-file"><UploadCloud size={18} /> {addEvidence.isPending ? 'Enviando...' : 'Adicionar evidência'}<input id="evidence-file" type="file" accept="image/*,video/*" className="hidden-file" onChange={capture} data-testid="input-evidence-file" /></label><div style={{ height: 10 }} /><button className="button button-primary" style={{ width: '100%', minHeight: 45 }} onClick={complete} disabled={completeTask.isPending || (task.evidenceRequired && evidence.length === 0)} data-testid="button-complete-task"><CheckCircle2 size={16} /> {completeTask.isPending ? 'Concluindo...' : 'Concluir tarefa'}</button>{task.status === 'pending' && <button className="button button-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => updateStatus('in_progress')} disabled={updateTask.isPending} data-testid="button-start-task">Começar execução</button>}{task.status === 'in_progress' && <button className="button button-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => updateStatus('pending')} disabled={updateTask.isPending} data-testid="button-pause-task">Deixar para depois</button>}</>}</section>{notice && <div className="stat-meta" style={{ padding: '12px 4px', color: notice.includes('não') ? 'hsl(var(--destructive))' : 'hsl(var(--primary))' }} data-testid="status-task-notice">{notice}</div>}<section className="card card-pad" style={{ marginTop: 14 }}><div className="section-title" style={{ marginBottom: 10 }}>Resumo rápido</div><div className="stat-meta" style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0' }}><span>Status</span><strong>{statusLabel(task.status)}</strong></div><div className="stat-meta" style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0' }}><span>Prioridade</span><strong>{task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}</strong></div></section></aside></div></div>;
}

function StoresPage() {
  const storesQuery = useListStores({ query: { queryKey: getListStoresQueryKey() } });
  const rankingsQuery = useGetRankings({ query: { queryKey: getGetRankingsQueryKey() } });
  const stores = storesQuery.data ?? fallbackStores;
  const rankings = rankingsQuery.data ?? fallbackRankings;
  return <div className="content"><div className="page-head"><div><div className="eyebrow">Rede Minas Mais</div><h1 className="page-title">Lojas</h1><p className="page-intro">A saúde operacional de cada ponto em uma única leitura.</p></div><div className="button button-soft"><StoreIcon size={15} /> {stores.length} unidades</div></div><div className="report-grid"><section className="card table-card"><div className="card-pad section-heading"><div><div className="section-title">Diretório de lojas</div><div className="stat-meta">Execução atual por unidade</div></div><Search size={16} color="hsl(var(--muted-foreground))" /></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Loja</th><th>Região</th><th>Gerente</th><th>Execução</th></tr></thead><tbody>{stores.map((store) => <tr key={store.id} data-testid={`row-store-${store.id}`}><td><div className="store-name">{store.name}</div><div className="store-city">{store.city}</div></td><td>{store.region}</td><td>{store.manager}</td><td><span className={`score ${store.execution >= 85 ? 'score-good' : 'score-mid'}`}>{store.execution.toFixed(1)}%</span></td></tr>)}</tbody></table></div></section><section className="card table-card"><div className="card-pad section-heading"><div><div className="section-title">Ranking de execução</div><div className="stat-meta">Comparativo da rede</div></div><BarChart3 size={16} color="hsl(var(--primary))" /></div><div className="table-scroll"><table className="data-table"><thead><tr><th>#</th><th>Loja / gerente</th><th>Execução</th><th>Tendência</th></tr></thead><tbody>{rankings.map((entry) => <tr key={entry.position} data-testid={`row-ranking-${entry.position}`}><td><span className="rank">{String(entry.position).padStart(2, '0')}</span></td><td><div className="store-name">{entry.storeName}</div><div className="store-city">{entry.manager}</div></td><td><span className="score score-good">{entry.execution.toFixed(1)}%</span></td><td className={`trend-${entry.trend}`}>{entry.trend === 'up' ? <ArrowUpRight size={16} /> : entry.trend === 'down' ? <ArrowDownRight size={16} /> : '—'}</td></tr>)}</tbody></table></div></section></div></div>;
}

function ReportsPage() {
  const summaryQuery = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const rankingsQuery = useGetRankings({ query: { queryKey: getGetRankingsQueryKey() } });
  const summary = summaryQuery.data ?? fallbackSummary;
  const rankings = rankingsQuery.data ?? fallbackRankings;
  const bars = [{ label: 'Campanhas', value: Math.min(summary.execution + 3, 100) }, { label: 'Abastecimento', value: Math.max(summary.execution - 7, 0) }, { label: 'Qualidade', value: Math.min(summary.execution + 6, 100) }, { label: 'Operação', value: Math.max(summary.execution - 2, 0) }];
  return <div className="content"><div className="page-head"><div><div className="eyebrow">Leitura para decisão</div><h1 className="page-title">Relatórios</h1><p className="page-intro">Um retrato curto do que está avançando — e do que merece cobrança.</p></div><div className="button button-soft">Período: hoje <ChevronRight size={14} /></div></div><div className="stats-grid"><div className="card stat-card stat-accent"><span className="stat-label">Execução consolidada</span><span className="stat-value">{summary.execution.toFixed(1)}%</span><span className="stat-meta">+2,8 pts vs. semana anterior</span></div><div className="card stat-card"><span className="stat-label">Lojas acompanhadas</span><span className="stat-value">{summary.storesCount}</span><span className="stat-meta">rede ativa</span></div><div className="card stat-card stat-warn"><span className="stat-label">Campanhas ativas</span><span className="stat-value">{summary.campaignsActive}</span><span className="stat-meta">em execução</span></div><div className="card stat-card"><span className="stat-label">Planos de ação</span><span className="stat-value">{summary.actionPlans}</span><span className="stat-meta">acompanhamentos abertos</span></div></div><div className="report-grid"><section className="card card-pad"><div className="section-heading"><div><div className="section-title">Execução por frente</div><div className="stat-meta">Percentual de tarefas concluídas</div></div></div><div className="bar-list">{bars.map((bar) => <div className="bar-row" key={bar.label}><span className="bar-label">{bar.label}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${bar.value}%` }} /></div><span className="bar-value">{bar.value.toFixed(0)}%</span></div>)}</div></section><section className="card card-pad"><div className="section-heading"><div><div className="section-title">Leitura de campo</div><div className="stat-meta">O sinal mais importante de hoje</div></div><CircleAlert size={17} color="hsl(21 75% 43%)" /></div><div className="insight"><div className="insight-title">Onde agir primeiro</div><p>{rankings[rankings.length - 1]?.storeName || 'A rede'} está abaixo do ritmo médio. Uma revisão rápida das tarefas atrasadas pode recuperar a execução ainda hoje.</p></div><div style={{ marginTop: 16 }}><div className="section-title" style={{ marginBottom: 10 }}>Top 3 da rede</div>{rankings.slice(0, 3).map((entry) => <div key={entry.position} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid hsl(var(--border))', fontSize: 11 }}><span><strong>{entry.position}.</strong> {entry.storeName}</span><span className="score score-good">{entry.execution.toFixed(1)}%</span></div>)}</div></section></div></div>;
}

function LoginPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('marina.alves@minasmais.com.br');
  return <div className="login-page"><section className="login-brand"><Link href="/" className="brand" data-testid="link-login-brand"><span className="brand-mark">M</span><span><span className="brand-name">Minas Mais</span><span className="brand-sub">Executa</span></span></Link><div className="login-statement"><div className="login-kicker">Operação sem ruído</div><h1>Veja. Faça. Comprove.</h1><p>O pulso operacional da rede de farmácias Minas Mais — do combinado à execução no ponto de venda.</p></div><div className="login-footer">Ambiente seguro para a operação Minas Mais · 2025</div></section><section className="login-form-side"><div className="login-card"><div className="eyebrow">Acesso à operação</div><h2>Entrar no Executa</h2><p>Use seu e-mail corporativo para continuar.</p><form className="login-form" onSubmit={(event) => { event.preventDefault(); setLocation('/'); }}><div className="field"><label htmlFor="login-email">E-mail corporativo</label><input id="login-email" type="email" className="input" value={email} onChange={(event) => setEmail(event.target.value)} data-testid="input-login-email" /></div><div className="field"><label htmlFor="login-password">Senha</label><input id="login-password" type="password" className="input" defaultValue="minasmais" data-testid="input-login-password" /></div><button type="submit" className="button button-primary login-submit" data-testid="button-login">Entrar na operação <ArrowUpRight size={16} /></button></form><div className="login-note">Ao entrar, você concorda com as diretrizes de segurança da Minas Mais.</div></div></section></div>;
}

function SignInPage() {
  return <div className="login-page"><div className="login-form-side" style={{ width: '100%' }}><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div></div>;
}

function SignUpPage() {
  return <div className="login-page"><div className="login-form-side" style={{ width: '100%' }}><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div></div>;
}

function RouterView({ role, onRoleChange }: { role: Role; onRoleChange: (role: Role) => void }) {
  const [location] = useLocation();
  if (location === '/login') return <Redirect to="/sign-in" />;
  if (location.startsWith('/sign-in')) return <SignInPage />;
  if (location.startsWith('/sign-up')) return <SignUpPage />;
  if (location === '/login') return <Switch><Route path="/login" component={LoginPage} /></Switch>;
  return <Shell role={role} onRoleChange={onRoleChange}><ErrorBoundary resetKey={location}><Switch><Route path="/" component={() => <Dashboard role={role} />} /><Route path="/tasks" component={TasksPage} /><Route path="/tasks/:id" component={DetailPage} /><Route path="/stores" component={StoresPage} /><Route path="/reports" component={ReportsPage} /><Route component={NotFound} /></Switch></ErrorBoundary></Shell>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const userId = user?.id ?? null;
    if (previousUserId.current !== undefined && previousUserId.current !== userId) client.clear();
    previousUserId.current = userId;
  }), [addListener, client]);
  return null;
}

function AppContent() {
  const [role, setRole] = useState<Role>('manager');
  return <><ClerkQueryClientCacheInvalidator /><Show when="signed-out"><div className="sr-only">Acesso público</div></Show><RouterView role={role} onRoleChange={setRole} /><Toaster /></>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  const stripBase = (path: string) => basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace: true })}><QueryClientProvider client={queryClient}><TooltipProvider><AppContent /></TooltipProvider></QueryClientProvider></ClerkProvider>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

export default App;