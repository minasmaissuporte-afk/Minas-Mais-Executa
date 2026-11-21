import { Medal } from 'lucide-react';
import type { RankingEntry } from '@workspace/api-client-react';
import { rankSupervisorsByPoints } from '@/lib/regional-ranking';

export function SupervisorPointsRanking({
  entries,
  periodLabel,
}: {
  entries: RankingEntry[];
  periodLabel: string;
}) {
  const supervisors = rankSupervisorsByPoints(entries);

  return <section className="supervisor-ranking-section" aria-labelledby="supervisor-points-title" data-testid="supervisor-points-ranking">
    <div className="supervisor-ranking-heading">
      <div className="supervisor-ranking-icon"><Medal size={19} aria-hidden="true" /></div>
      <div>
        <h3 id="supervisor-points-title">Ranking dos supervisores</h3>
        <p>Soma dos pontos das lojas no período · {periodLabel}</p>
      </div>
    </div>
    {supervisors.length
      ? <ol className="supervisor-ranking-list">
        {supervisors.map(({ supervisorName, points, storeCount, storesWithCompletions, position, award }) => <li
          className={`supervisor-ranking-row ${award ? `supervisor-award-${award}` : 'supervisor-award-other'}`}
          key={supervisorName}
          data-testid={`supervisor-ranking-${position}`}
        >
          <span className="supervisor-ranking-position" aria-label={`${position}º lugar`}>{position}</span>
          <span className="supervisor-ranking-info">
            <strong>{supervisorName}</strong>
            <small>{storeCount} {storeCount === 1 ? 'loja' : 'lojas'} · {storesWithCompletions} com tarefas concluídas</small>
          </span>
          <span className="supervisor-ranking-total"><strong>{points.toLocaleString('pt-BR')}</strong><small>pts</small></span>
          <span className="supervisor-ranking-award"><Medal size={13} aria-hidden="true" />{award ?? `${position}º`}</span>
        </li>)}
      </ol>
      : <p className="supervisor-ranking-empty">Ainda não há pontos atribuídos a supervisores neste período.</p>}
  </section>;
}
