import { Medal, Trophy, UserRound } from 'lucide-react';
import type { RankingEntry } from '@workspace/api-client-react';
import { EmptyState, ErrorState, LoadingBlocks } from '@/components/ui-kit';
import { rankSupervisorsByPoints, topRegionalRankings } from '@/lib/regional-ranking';

export function RegionalExecutionLeaderboard({
  entries,
  monthLabel,
  isLoading,
  isError,
  onRetry,
}: {
  entries: RankingEntry[];
  monthLabel: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const regions = topRegionalRankings(entries);
  const supervisors = rankSupervisorsByPoints(entries);
  const hasMonthlyPoints = supervisors.some((supervisor) => supervisor.points > 0);

  return <section className="regional-ranking-section" aria-labelledby="regional-ranking-title" data-testid="regional-execution-leaderboard">
    <div className="regional-ranking-heading">
      <div className="regional-ranking-heading-icon"><Trophy size={18} /></div>
      <div>
        <h2 id="regional-ranking-title">Destaques por região</h2>
        <p>Pontuação por rapidez na conclusão · mês vigente: {monthLabel}</p>
      </div>
    </div>
    {isError
      ? <ErrorState onRetry={onRetry} />
      : isLoading
        ? <LoadingBlocks rows={1} />
        : regions.length || hasMonthlyPoints
          ? <>
            {regions.length > 0 && <div className="regional-ranking-grid">
              {regions.map(({ regionNumber, supervisorName, stores }) => <article className="regional-ranking-card" key={supervisorName} data-testid={`regional-ranking-${regionNumber}`}>
                <header className="regional-ranking-card-head">
                  <span className="regional-ranking-region-tag">Região {regionNumber}</span>
                  <span className="regional-ranking-supervisor"><UserRound size={16} aria-hidden="true" /><span><small>SUPERVISOR</small><strong>{supervisorName}</strong></span></span>
                  <span className="regional-ranking-store-count">{stores.length} {stores.length === 1 ? 'loja' : 'lojas'}</span>
                </header>
                <ol className="regional-ranking-list">
                  {stores.map((store, index) => <li className={`regional-ranking-item regional-ranking-place-${index + 1}`} key={store.storeName}>
                    <span className="regional-ranking-position" aria-label={`${index + 1}º lugar`}>{index + 1}</span>
                    <span className="regional-ranking-store">
                      <strong>{store.storeName}</strong>
                      <small>{store.tasksCompleted} {store.tasksCompleted === 1 ? 'tarefa concluída' : 'tarefas concluídas'}</small>
                    </span>
                    <span className="regional-ranking-points">
                      <strong>{store.points.toLocaleString('pt-BR')}</strong>
                      <small>pts</small>
                    </span>
                  </li>)}
                </ol>
              </article>)}
            </div>}
            {hasMonthlyPoints && <div className="supervisor-ranking-section" aria-labelledby="supervisor-ranking-title" data-testid="supervisor-points-ranking">
              <div className="supervisor-ranking-heading">
                <div className="supervisor-ranking-icon"><Medal size={19} aria-hidden="true" /></div>
                <div>
                  <h3 id="supervisor-ranking-title">Ranking dos supervisores</h3>
                  <p>Soma dos pontos de todas as lojas · {monthLabel}</p>
                </div>
              </div>
              <ol className="supervisor-ranking-list">
                {supervisors.map(({ supervisorName, points, storeCount, storesWithCompletions, position, award }) => <li
                  className={`supervisor-ranking-row ${award ? `supervisor-award-${award}` : 'supervisor-award-other'}`}
                  key={supervisorName}
                  data-testid={`supervisor-ranking-${position}`}
                >
                  <span className="supervisor-ranking-position">{position}</span>
                  <span className="supervisor-ranking-info">
                    <strong>{supervisorName}</strong>
                    <small>{storeCount} {storeCount === 1 ? 'loja' : 'lojas'} · {storesWithCompletions} com tarefas concluídas</small>
                  </span>
                  <span className="supervisor-ranking-total"><strong>{points.toLocaleString('pt-BR')}</strong><small>pts</small></span>
                  <span className="supervisor-ranking-award"><Medal size={13} aria-hidden="true" />{award ?? `${position}º`}</span>
                </li>)}
              </ol>
            </div>}
          </>
          : <EmptyState icon={Trophy} title="Sem pontuação neste mês" copy="As lojas aparecerão aqui após concluírem tarefas neste mês." />}
  </section>;
}
