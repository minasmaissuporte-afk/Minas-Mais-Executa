import { Crown, Trophy, UserRound } from 'lucide-react';
import type { RankingEntry } from '@workspace/api-client-react';
import { EmptyState, ErrorState, LoadingBlocks } from '@/components/ui-kit';
import { rankSupervisorsByPoints, topRegionalRankings } from '@/lib/regional-ranking';
import { SupervisorPointsRanking } from '@/components/supervisor-points-ranking';

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
  const hasMonthlyPoints = rankSupervisorsByPoints(entries).some((supervisor) => supervisor.points > 0);

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
        : hasMonthlyPoints
          ? <>
            {regions.length > 0 && <div className="regional-ranking-grid">
              {regions.map(({ regionNumber, supervisorName, stores }) => <article className="regional-ranking-card" key={supervisorName} data-testid={`regional-ranking-${regionNumber}`}>
                <header className="regional-ranking-card-head">
                  <span className="regional-ranking-region-tag">
                    <span>Região</span><strong>{regionNumber}</strong>
                  </span>
                  <span className="regional-ranking-supervisor"><UserRound size={16} aria-hidden="true" /><span><small>SUPERVISOR</small><strong>{supervisorName}</strong></span></span>
                  <span className="regional-ranking-store-count">{stores.length} destacadas</span>
                </header>
                <ol className="regional-ranking-podium" aria-label={`Pódio das lojas da Região ${regionNumber}`}>
                  {stores.map((store, index) => <li className={`regional-ranking-item regional-ranking-place-${index + 1}`} key={store.storeName}>
                    <span className="regional-ranking-position" aria-label={`${index + 1}º lugar`}>
                      {index === 0 && <Crown size={13} aria-hidden="true" />}
                      <b>{index + 1}º</b>
                    </span>
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
                <footer className="regional-ranking-subtotal">
                  <span>Total das {stores.length} destacadas</span>
                  <strong>{stores.reduce((total, store) => total + store.points, 0).toLocaleString('pt-BR')} <small>pts</small></strong>
                </footer>
              </article>)}
            </div>}
            {hasMonthlyPoints && <SupervisorPointsRanking entries={entries} periodLabel={monthLabel} />}
          </>
          : <EmptyState icon={Trophy} title="Sem pontuação neste mês" copy="As lojas aparecerão aqui após concluírem tarefas neste mês." />}
  </section>;
}
