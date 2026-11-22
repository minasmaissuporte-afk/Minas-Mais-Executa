import { Medal, Trophy } from 'lucide-react';
import type { RankingEntry } from '@workspace/api-client-react';
import { rankSupervisorsByPoints } from '@/lib/regional-ranking';
import { RankingPdfActions } from '@/components/ranking-pdf-actions';
import type { RankingPdfReport } from '@/lib/ranking-pdf';

export function SupervisorPointsRanking({
  entries,
  periodLabel,
  exportRange,
}: {
  entries: RankingEntry[];
  periodLabel: string;
  exportRange?: { fromDate: string; toDate: string };
}) {
  const supervisors = rankSupervisorsByPoints(entries);
  const leaderPoints = supervisors[0]?.points ?? 0;
  const totalPoints = entries.reduce((total, entry) => total + entry.points, 0);
  const storesWithCompletions = entries.filter((entry) => entry.tasksCompleted > 0).length;
  const completionShare = entries.length ? (storesWithCompletions / entries.length) * 100 : 0;
  const taskTotals = new Map<string, number>();
  entries.forEach((entry) => {
    const name = entry.supervisorName.trim().replace(/\s+/g, ' ');
    if (!name || name.toLocaleLowerCase('pt-BR') === 'sem supervisor') return;
    const key = name.toLocaleLowerCase('pt-BR');
    taskTotals.set(key, (taskTotals.get(key) ?? 0) + entry.tasksCompleted);
  });
  const formatPoints = (points: number) => points.toLocaleString('pt-BR');
  const pdfReport: RankingPdfReport = {
    title: 'Ranking dos supervisores',
    period: periodLabel,
    summary: `${entries.length} lojas · ${formatPoints(totalPoints)} pontos totais · ${completionShare.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% das lojas com tarefa concluída`,
    variant: 'supervisors',
    sections: [{
      columns: [
        { key: 'position', header: 'Pos.', width: 42 },
        { key: 'supervisor', header: 'Supervisor', width: 180 },
        { key: 'stores', header: 'Lojas', width: 75 },
        { key: 'tasks', header: 'Tarefas concluídas', width: 110 },
        { key: 'completion', header: 'Lojas com tarefa', width: 100 },
        { key: 'points', header: 'Pontos', width: 95 },
        { key: 'award', header: 'Faixa', width: 90 },
      ],
      rows: supervisors.map(({ supervisorName, points, storeCount, storesWithCompletions, position, award }) => {
        const key = supervisorName.toLocaleLowerCase('pt-BR');
        const taskCount = taskTotals.get(key) ?? 0;
        const completion = storeCount > 0 ? (storesWithCompletions / storeCount) * 100 : 0;
        return {
          position,
          supervisor: supervisorName,
          stores: storeCount,
          tasks: taskCount,
          completion: `${completion.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`,
          points: `${formatPoints(points)} pts`,
          award: award?.toLocaleUpperCase('pt-BR') ?? `${position}º lugar`,
        };
      }),
    }],
  };

  return <section className="supervisor-ranking-section" aria-labelledby="supervisor-points-title" data-testid="supervisor-points-ranking">
    <div className="supervisor-ranking-heading">
      <div className="supervisor-ranking-icon"><Medal size={19} aria-hidden="true" /></div>
      <div>
        <h3 id="supervisor-points-title">Ranking dos supervisores</h3>
        <p>Soma dos pontos das lojas no período · {periodLabel}</p>
      </div>
      {exportRange && supervisors.length > 0 && <RankingPdfActions report={pdfReport} {...exportRange} />}
    </div>
    <div className="supervisor-ranking-summary" aria-label="Resumo do período">
      <div><small>Total pontuado</small><strong>{totalPoints.toLocaleString('pt-BR')}</strong></div>
      <div><small>Lojas</small><strong>{entries.length.toLocaleString('pt-BR')}</strong></div>
      <div><small>Lojas com tarefa</small><strong>{completionShare.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</strong></div>
    </div>
    {leaderPoints > 0
      ? <>
        <section className="supervisor-ranking-highlights" aria-labelledby="supervisor-ranking-highlights-title">
          <div className="supervisor-ranking-highlights-heading">
            <Trophy size={16} aria-hidden="true" />
            <div>
              <h4 id="supervisor-ranking-highlights-title">Supervisores em destaque</h4>
              <span>Os quatro primeiros do período</span>
            </div>
          </div>
          <ol className="supervisor-ranking-podium" aria-label="Quatro supervisores em destaque">
            {supervisors.slice(0, 4).map(({ supervisorName, points, position, award }) => <li
              className={`supervisor-podium-card supervisor-award-${award ?? 'other'} supervisor-podium-place-${position}`}
              key={supervisorName}
              data-testid={`supervisor-podium-${position}`}
            >
              <span className="supervisor-podium-place">{position}º lugar</span>
              <span className="supervisor-podium-medal"><Medal size={18} aria-hidden="true" />{award}</span>
              <strong className="supervisor-podium-name">{supervisorName}</strong>
              <span className="supervisor-podium-points">{formatPoints(points)} <small>pts</small></span>
            </li>)}
          </ol>
        </section>
        <div className="supervisor-ranking-standings-heading">
          <h4>Classificação completa</h4>
          <span>{supervisors.length} {supervisors.length === 1 ? 'supervisor' : 'supervisores'}</span>
        </div>
        <ol className="supervisor-ranking-list" aria-label="Classificação completa de supervisores">
          {supervisors.map(({ supervisorName, points, storeCount, storesWithCompletions, position, award }) => {
            const key = supervisorName.toLocaleLowerCase('pt-BR');
            const taskCount = taskTotals.get(key) ?? 0;
            const completionShare = storeCount > 0 ? (storesWithCompletions / storeCount) * 100 : 0;
            const relativePoints = leaderPoints > 0 ? (points / leaderPoints) * 100 : 0;
            const pointsBehind = leaderPoints - points;
            return <li
              className={`supervisor-ranking-row ${award ? `supervisor-award-${award}` : 'supervisor-award-other'}`}
              key={supervisorName}
              data-testid={`supervisor-ranking-${position}`}
            >
              <span className="supervisor-ranking-position" aria-label={`${position}º lugar`}>{String(position).padStart(2, '0')}</span>
              <span className="supervisor-ranking-info">
                <strong>{supervisorName}</strong>
                <small>{storeCount} {storeCount === 1 ? 'loja' : 'lojas'} · {taskCount} {taskCount === 1 ? 'tarefa concluída' : 'tarefas concluídas'} · {completionShare.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% das lojas com tarefa concluída</small>
                <span className="supervisor-ranking-bar" role="progressbar" aria-label={`${relativePoints.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% da pontuação do líder`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(relativePoints)}>
                  <span style={{ width: `${relativePoints}%` }} />
                </span>
              </span>
              <span className="supervisor-ranking-score">
                <span className="supervisor-ranking-total"><strong>{formatPoints(points)}</strong><small>pts</small></span>
                <small className="supervisor-ranking-gap">{pointsBehind === 0 ? 'Líder' : `−${formatPoints(pointsBehind)} pts`}</small>
              </span>
              <span className="supervisor-ranking-award"><Trophy size={13} aria-hidden="true" />{award ?? `${position}º`}</span>
            </li>;
          })}
        </ol>
      </>
      : <div className="supervisor-ranking-empty">
        <Trophy size={22} aria-hidden="true" />
        <strong>Sem pontos positivos neste período</strong>
        <span>O pódio e a classificação aparecem quando houver pontos atribuídos.</span>
      </div>}
  </section>;
}
