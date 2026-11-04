import { ArrowUpRight, CheckCircle2, CircleAlert, ListChecks, Target } from 'lucide-react';
import { useMemo } from 'react';
import { useGetActivity, useGetDashboardSummary, useListTaskSummaries, getGetActivityQueryKey, getGetDashboardSummaryQueryKey, getListTaskSummariesQueryKey } from '@workspace/api-client-react';
import type { CurrentMember } from '@workspace/api-client-react';
import { todayInput } from '@/lib/demo-data';
import { ActivityItem, EmptyState, ErrorState, LoadingBlocks, MetricCard, TaskGroupRow, TaskRow } from '@/components/ui-kit';
import { Link } from 'wouter';

export default function DashboardPage({ member }: { member: CurrentMember }) {
  const firstName = member.name.split(' ')[0] || 'Usuário';
  const summaryQuery = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const activityQuery = useGetActivity({ query: { queryKey: getGetActivityQueryKey() } });
  const tasksQuery = useListTaskSummaries({ dateFrom: todayInput, dateTo: todayInput }, { query: { queryKey: getListTaskSummariesQueryKey({ dateFrom: todayInput, dateTo: todayInput }) } });
  const summary = summaryQuery.data;
  const taskRows = useMemo(() => {
    const todayTasks = (tasksQuery.data ?? [])
      .filter((task) => task.dueDate === todayInput)
      .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
    const rows: Array<{ key: string; tasks: typeof todayTasks }> = [];
    const taskGroups = new Map<string, typeof todayTasks>();

    todayTasks.forEach((task) => {
      const title = task.title.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
      const category = task.category.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
      const taskIdentity = `${title}::${category}::${task.dueDate}::${task.dueTime}`;
      const existing = taskGroups.get(taskIdentity);
      if (existing) {
        existing.push(task);
      } else {
        const group = [task];
        taskGroups.set(taskIdentity, group);
        rows.push({ key: taskIdentity, tasks: group });
      }
    });

    return rows.slice(0, 5);
  }, [tasksQuery.data]);
  const activities = activityQuery.data ?? [];
  const isNetwork = member.role !== 'manager';
  return <div className="content">
    <div className="page-head"><div><div className="eyebrow">{isNetwork ? 'Pulso da rede' : 'Acompanhamento de hoje'}</div><h1 className="page-title">{isNetwork ? 'A operação, sem ruído.' : `Bom dia, ${firstName}.`}</h1><p className="page-intro">{isNetwork ? <>Acompanhe a execução das <strong>{summary?.storesCount ?? 0} lojas</strong> e encontre o próximo ponto de atenção.</> : <>Sua loja está em ritmo de execução. <strong>{summary?.pending ?? 0} tarefas</strong> pedem atenção antes do fim do dia.</>}</p></div><Link className="button button-primary" href="/tasks" data-testid="link-open-tasks"><ListChecks size={15} /> Abrir tarefas</Link></div>
     {summaryQuery.isError && <ErrorState onRetry={() => summaryQuery.refetch()} />}
     {summary
       ? <div className="stats-grid">
         <MetricCard label={isNetwork ? 'Execução da rede' : 'Execução da loja'} value={`${summary.execution.toFixed(1)}%`} meta="+4,2 pts esta semana" tone="stat-accent" />
         <MetricCard label="Tarefas de hoje" value={summary.tasksToday} meta={`${summary.completed} finalizadas`} />
         <MetricCard label="Em aberto" value={summary.pending} meta="Priorize as de alta" tone="stat-warn" />
         <MetricCard label="Atrasadas" value={summary.overdue} meta="Requer ação imediata" tone="stat-alert" />
       </div>
       : summaryQuery.isLoading ? <LoadingBlocks rows={1} /> : null}
     <div className="dashboard-grid">
       <section className="card card-pad">
         <div className="section-heading">
           <div>
             <div className="section-title">Fila de execução</div>
             <div className="stat-meta">Tarefas iguais são agrupadas entre lojas; abra uma para ver cada unidade. Vermelho: aberta, atrasada ou reprovada · Amarelo: aguardando conferência · Verde: concluída</div>
           </div>
           <Link href="/tasks" className="section-link" data-testid="link-view-all-tasks">Ver todas <ArrowUpRight size={13} /></Link>
         </div>
         {tasksQuery.isError
           ? <ErrorState onRetry={() => tasksQuery.refetch()} />
           : tasksQuery.isLoading
             ? <LoadingBlocks rows={2} />
             : taskRows.length
               ? <div className="task-stack" data-testid="dashboard-task-queue">{taskRows.map((row) => row.tasks.length > 1 ? <TaskGroupRow key={row.key} groupId={`dashboard-${row.key}`} tasks={row.tasks} showProgress showTaskStatus /> : <TaskRow key={row.key} task={row.tasks[0]} showStatus />)}</div>
               : <EmptyState title="Sem tarefas hoje" copy="As tarefas do dia aparecerão aqui." />}
       </section>
       <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
         {summary && <section className="card card-pad execution-card">
           <div className="section-heading"><div className="section-title">Ritmo da operação</div><span className="muted" style={{ fontSize: 9 }}>hoje</span></div>
           <div className="execution-number">{summary.execution.toFixed(1)}<small>%</small></div>
           <div className="muted" style={{ margin: '6px 0 13px', fontSize: 10 }}>Meta diária: 90%</div>
           <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(summary.execution, 100)}%` }} /></div>
         </section>}
         <section className="card card-pad">
           <div className="section-heading"><div className="section-title">Atividade recente</div><span className="stat-meta">últimas 24h</span></div>
           {activityQuery.isError
             ? <ErrorState onRetry={() => activityQuery.refetch()} />
             : activityQuery.isLoading
               ? <LoadingBlocks rows={1} />
               : activities.length
                 ? <div className="activity-list">{activities.slice(0, 4).map((activity) => <ActivityItem activity={activity} key={activity.id} />)}</div>
                 : <EmptyState icon={Target} title="Sem atividade recente" copy="As próximas movimentações aparecerão aqui." />}
         </section>
       </div>
     </div>
     {member.role === 'admin' && (summary?.storeFulfillment?.length ?? 0) > 0 && <section className="card card-pad store-fulfillment-chart">
       <div className="section-heading"><div><div className="section-title">Cumprimento por loja</div><div className="stat-meta">Ciclo atual de 30 dias · concluídas x não concluídas</div></div></div>
       <div className="bar-list">{summary?.storeFulfillment?.map((store) => { const total = store.completed + store.pending; const completion = total ? Math.round((store.completed / total) * 100) : 0; return <div className="bar-row" key={store.storeName}><div className="bar-label" title={store.storeName}>{store.storeName}</div><div className="bar-track"><div className="bar-fill" style={{ width: `${completion}%` }} /></div><div className="bar-value">{completion}%</div><div className="bar-legend"><span>{store.completed} feitas</span><span>{store.pending} abertas</span></div></div>; })}</div>
     </section>}
     <div className="card card-pad" style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12, background: 'hsl(var(--accent))' }} data-testid="dashboard-operations-note"><CircleAlert size={17} color="hsl(var(--accent-foreground))" /><div><div className="section-title" style={{ color: 'hsl(var(--accent-foreground))' }}>Regra de conclusão ativa</div><div className="stat-meta">Tarefas que pedem evidência só entram no indicador depois da comprovação.</div></div><CheckCircle2 size={18} color="hsl(var(--primary))" style={{ marginLeft: 'auto' }} /></div>
  </div>;
}