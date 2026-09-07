import { ArrowUpRight, CheckCircle2, CircleAlert, ListChecks, Target } from 'lucide-react';
import { useGetActivity, useGetDashboardSummary, useListTasks, getGetActivityQueryKey, getGetDashboardSummaryQueryKey, getListTasksQueryKey } from '@workspace/api-client-react';
import type { Role } from '@/components/app-shell';
import { fallbackActivities, fallbackSummary, fallbackTasks } from '@/lib/demo-data';
import { ActivityItem, EmptyState, ErrorState, LoadingBlocks, MetricCard, TaskRow } from '@/components/ui-kit';
import { Link } from 'wouter';

export default function DashboardPage({ role }: { role: Role }) {
  const summaryQuery = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const activityQuery = useGetActivity({ query: { queryKey: getGetActivityQueryKey() } });
  const tasksQuery = useListTasks({ status: 'pending' }, { query: { queryKey: getListTasksQueryKey({ status: 'pending' }) } });
  const summary = summaryQuery.data ?? { ...fallbackSummary, role };
  const tasks = (tasksQuery.data ?? fallbackTasks).slice(0, 5);
  const activities = activityQuery.data ?? fallbackActivities;
  const isNetwork = role !== 'manager';
  return <div className="content">
    <div className="page-head"><div><div className="eyebrow">{isNetwork ? 'Pulso da rede' : 'Acompanhamento de hoje'}</div><h1 className="page-title">{isNetwork ? 'A operação, sem ruído.' : 'Bom dia, Marina.'}</h1><p className="page-intro">{isNetwork ? <>Acompanhe a execução das <strong>{summary.storesCount} lojas</strong> e encontre o próximo ponto de atenção.</> : <>Sua loja está em ritmo de execução. <strong>{summary.pending} tarefas</strong> pedem atenção antes do fim do dia.</>}</p></div><Link className="button button-primary" href="/tasks" data-testid="link-open-tasks"><ListChecks size={15} /> Abrir tarefas</Link></div>
    {summaryQuery.isError && <ErrorState onRetry={() => summaryQuery.refetch()} />}
    <div className="stats-grid">
      <MetricCard label={isNetwork ? 'Execução da rede' : 'Execução da loja'} value={`${summary.execution.toFixed(1)}%`} meta="+4,2 pts esta semana" tone="stat-accent" />
      <MetricCard label="Tarefas de hoje" value={summary.tasksToday} meta={`${summary.completed} finalizadas`} />
      <MetricCard label="Em aberto" value={summary.pending} meta="Priorize as de alta" tone="stat-warn" />
      <MetricCard label="Atrasadas" value={summary.overdue} meta="Requer ação imediata" tone="stat-alert" />
    </div>
    <div className="dashboard-grid">
      <section className="card card-pad"><div className="section-heading"><div><div className="section-title">Fila de execução</div><div className="stat-meta">O que precisa acontecer agora</div></div><Link href="/tasks" className="section-link" data-testid="link-view-all-tasks">Ver todas <ArrowUpRight size={13} /></Link></div>{tasksQuery.isLoading ? <LoadingBlocks rows={2} /> : tasks.length ? <div className="task-stack">{tasks.map((task) => <TaskRow key={task.id} task={task} />)}</div> : <EmptyState title="Tudo em dia" copy="Nenhuma tarefa pendente neste momento." />}</section>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <section className="card card-pad execution-card"><div className="section-heading"><div className="section-title">Ritmo da operação</div><span className="muted" style={{ fontSize: 9 }}>hoje</span></div><div className="execution-number">{summary.execution.toFixed(1)}<small>%</small></div><div className="muted" style={{ margin: '6px 0 13px', fontSize: 10 }}>Meta diária: 90%</div><div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(summary.execution, 100)}%` }} /></div></section>
        <section className="card card-pad"><div className="section-heading"><div className="section-title">Atividade recente</div><span className="stat-meta">últimas 24h</span></div>{activityQuery.isLoading ? <LoadingBlocks rows={1} /> : activities.length ? <div className="activity-list">{activities.slice(0, 4).map((activity) => <ActivityItem activity={activity} key={activity.id} />)}</div> : <EmptyState icon={Target} title="Sem atividade recente" copy="As próximas movimentações aparecerão aqui." />}</section>
      </div>
    </div>
    <div className="card card-pad" style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12, background: 'hsl(var(--accent))' }} data-testid="dashboard-operations-note"><CircleAlert size={17} color="hsl(var(--accent-foreground))" /><div><div className="section-title" style={{ color: 'hsl(var(--accent-foreground))' }}>Regra de conclusão ativa</div><div className="stat-meta">Tarefas que pedem evidência só entram no indicador depois da comprovação.</div></div><CheckCircle2 size={18} color="hsl(var(--primary))" style={{ marginLeft: 'auto' }} /></div>
  </div>;
}