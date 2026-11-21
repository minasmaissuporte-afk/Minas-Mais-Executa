import { MapPin, Medal, Search, Store as StoreIcon, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getGetRankingsQueryKey, getListStoresQueryKey, useGetRankings, useListStores } from '@workspace/api-client-react';
import { EmptyState, ErrorState, formatDurationMinutes, LoadingBlocks, SearchEmpty, TrendIcon } from '@/components/ui-kit';
import { SupervisorPointsRanking } from '@/components/supervisor-points-ranking';

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultRankingRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return { fromDate: toDateInputValue(from), toDate: toDateInputValue(to) };
}

function periodLabel(fromDate: string, toDate: string) {
  const format = (value: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T12:00:00.000Z`));
  return `${format(fromDate)} a ${format(toDate)}`;
}

function podiumClass(position: number) {
  return position <= 3 ? `podium podium-${position}` : '';
}

export default function StoresPage() {
  const [search, setSearch] = useState('');
  const [rankingRange, setRankingRange] = useState(getDefaultRankingRange);
  const [rankingRegion, setRankingRegion] = useState('');
  const [rankingSupervisor, setRankingSupervisor] = useState('');
  const storesQuery = useListStores({ query: { queryKey: getListStoresQueryKey() } });
  const validRankingRange = Boolean(rankingRange.fromDate && rankingRange.toDate && rankingRange.fromDate <= rankingRange.toDate);
  const rankingParams = {
    fromDate: rankingRange.fromDate,
    toDate: rankingRange.toDate,
    ...(rankingRegion ? { region: rankingRegion } : {}),
    ...(rankingSupervisor ? { supervisor: rankingSupervisor } : {}),
  };
  const rankingsQuery = useGetRankings(rankingParams, {
    query: {
      queryKey: getGetRankingsQueryKey(rankingParams),
      enabled: validRankingRange,
    },
  });
  const stores = storesQuery.data ?? [];
  const rankings = rankingsQuery.data ?? [];
  const storeByName = useMemo(() => new Map(stores.map((store) => [store.name.trim().toLocaleLowerCase('pt-BR'), store])), [stores]);
  const regions = useMemo(() => [...new Set(stores.map((store) => store.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [stores]);
  const supervisors = useMemo(() => [...new Set(stores.map((store) => store.supervisor).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [stores]);
  const orderedRankings = useMemo(
    () => [...rankings].sort((first, second) => second.points - first.points || first.position - second.position || first.storeName.localeCompare(second.storeName, 'pt-BR')),
    [rankings],
  );
  const visibleRankings = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    if (!term) return orderedRankings;
    return orderedRankings.filter((entry) => {
      const store = storeByName.get(entry.storeName.trim().toLocaleLowerCase('pt-BR'));
      return `${entry.storeName} ${entry.manager} ${entry.supervisorName} ${store?.city ?? ''} ${store?.region ?? ''}`.toLocaleLowerCase('pt-BR').includes(term);
    });
  }, [orderedRankings, search, storeByName]);
  const rangeLabel = validRankingRange ? periodLabel(rankingRange.fromDate, rankingRange.toDate) : 'período inválido';

  return <div className="content stores-page">
    <div className="page-head">
      <div>
        <div className="eyebrow">Visão da rede</div>
        <h1 className="page-title">Lojas</h1>
        <p className="page-intro">Uma classificação direta por pontos de rapidez — da primeira colocada a todas as unidades da rede.</p>
      </div>
      <div className="card stores-count" data-testid="stores-count">
        <StoreIcon size={16} aria-hidden="true" />
        <span className="stores-count-number">{stores.length}</span>
        <span className="stat-meta">unidades visíveis</span>
      </div>
    </div>

    <div className="card filters ranking-filters" data-testid="stores-ranking-filters">
      <label className="ranking-filter">De
        <input className="input" type="date" value={rankingRange.fromDate} max={rankingRange.toDate || undefined}
          onChange={(event) => setRankingRange((range) => ({ ...range, fromDate: event.target.value }))}
          aria-label="Data inicial do ranking" data-testid="input-ranking-from-date" />
      </label>
      <label className="ranking-filter">Até
        <input className="input" type="date" value={rankingRange.toDate} min={rankingRange.fromDate || undefined}
          onChange={(event) => setRankingRange((range) => ({ ...range, toDate: event.target.value }))}
          aria-label="Data final do ranking" data-testid="input-ranking-to-date" />
      </label>
      <label className="ranking-filter">Região
        <select className="select" value={rankingRegion} onChange={(event) => setRankingRegion(event.target.value)} data-testid="select-ranking-region" aria-label="Filtrar por região">
          <option value="">Todas as regiões</option>
          {regions.map((region) => <option key={region} value={region}>{region}</option>)}
        </select>
      </label>
      <label className="ranking-filter">Supervisor
        <select className="select" value={rankingSupervisor} onChange={(event) => setRankingSupervisor(event.target.value)} data-testid="select-ranking-supervisor" aria-label="Filtrar por supervisor">
          <option value="">Todos os supervisores</option>
          {supervisors.map((supervisor) => <option key={supervisor} value={supervisor}>{supervisor}</option>)}
        </select>
      </label>
    </div>

    <div className="stores-ranking-toolbar">
      <div>
        <span className="stores-ranking-kicker"><Trophy size={14} aria-hidden="true" /> Placar da rede</span>
        <h2 id="stores-ranking-title">Ranking de lojas</h2>
        <p>Pontuação total por tarefas concluídas e rapidez no período escolhido.</p>
      </div>
      <div className="search-wrap stores-ranking-search">
        <Search size={15} aria-hidden="true" />
        <input className="input" value={search} onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar loja, cidade ou responsável" aria-label="Buscar no ranking de lojas" data-testid="input-search-stores" />
      </div>
    </div>

    <section className="card stores-ranking-card" aria-labelledby="stores-ranking-title" data-testid="stores-overall-ranking">
      <div className="stores-ranking-meta">
        <span>{validRankingRange ? `${visibleRankings.length} ${visibleRankings.length === 1 ? 'loja classificada' : 'lojas classificadas'}` : 'Confira o período selecionado'}</span>
        <span className="stores-ranking-period">{rangeLabel}</span>
      </div>
      {storesQuery.isError && <div className="stores-metadata-error"><ErrorState onRetry={() => storesQuery.refetch()} /></div>}
      {!validRankingRange
        ? <EmptyState title="Período inválido" copy="Escolha uma data inicial igual ou anterior à data final." />
        : rankingsQuery.isError
          ? <ErrorState onRetry={() => rankingsQuery.refetch()} />
          : rankingsQuery.isLoading
            ? <div className="stores-ranking-loading"><LoadingBlocks rows={3} /></div>
            : visibleRankings.length
              ? <>
                <div className="table-scroll stores-ranking-desktop">
                  <table className="data-table stores-ranking-table">
                    <caption className="sr-only">Classificação geral das lojas por pontos no período selecionado</caption>
                    <thead><tr><th scope="col">Posição</th><th scope="col">Loja</th><th scope="col">Gerente</th><th scope="col">Supervisor</th><th scope="col">Região</th><th scope="col">Tarefas</th><th scope="col">Pontos</th><th scope="col">Tempo médio</th><th scope="col">Tendência</th></tr></thead>
                    <tbody>{visibleRankings.map((entry) => {
                      const position = entry.position;
                      const store = storeByName.get(entry.storeName.trim().toLocaleLowerCase('pt-BR'));
                      return <tr key={`${entry.storeName}-${entry.position}`} className={podiumClass(position)} data-testid={`row-ranking-${position}`}>
                        <td><span className="store-rank-medal" aria-label={`${position}º lugar`}>{position <= 3 ? <Medal size={14} aria-hidden="true" /> : String(position).padStart(2, '0')}</span></td>
                        <td><strong className="store-name">{entry.storeName}</strong>{store?.city && <span className="store-city"><MapPin size={10} aria-hidden="true" />{store.city}</span>}</td>
                        <td>{entry.manager || store?.manager || 'Não definido'}</td>
                        <td>{entry.supervisorName || store?.supervisor || 'Não definido'}</td>
                        <td>{store?.region || '—'}</td>
                        <td>{entry.tasksCompleted}</td>
                        <td><span className="score">{entry.points.toLocaleString('pt-BR')} pts</span></td>
                        <td>{formatDurationMinutes(entry.averageExecutionMinutes)}</td>
                        <td><span className={`store-trend trend-${entry.trend}`} aria-label={`Tendência ${entry.trend}`} title={`Tendência: ${entry.trend}`}><TrendIcon trend={entry.trend} /><span>{entry.trend === 'up' ? 'Em alta' : entry.trend === 'down' ? 'Em queda' : 'Estável'}</span></span></td>
                      </tr>;
                    })}</tbody>
                  </table>
                </div>
                <ol className="stores-ranking-mobile" aria-label="Classificação geral das lojas">
                  {visibleRankings.map((entry) => {
                    const position = entry.position;
                    const store = storeByName.get(entry.storeName.trim().toLocaleLowerCase('pt-BR'));
                    return <li className={`stores-ranking-mobile-row ${podiumClass(position)}`} key={`${entry.storeName}-mobile-${entry.position}`} data-testid={`mobile-row-ranking-${position}`}>
                      <div className="stores-mobile-rank"><span className="store-rank-medal" aria-hidden="true">{position <= 3 ? <Medal size={14} /> : String(position).padStart(2, '0')}</span><span>{position}º lugar</span></div>
                      <div className="stores-mobile-main"><strong>{entry.storeName}</strong><span>{entry.manager || store?.manager || 'Gerente não definido'} · {entry.supervisorName || store?.supervisor || 'Supervisor não definido'}</span>
                        {store?.city && <small><MapPin size={10} aria-hidden="true" />{store.city}{store.region ? ` · ${store.region}` : ''}</small>}
                      </div>
                      <div className="stores-mobile-points"><strong>{entry.points.toLocaleString('pt-BR')}</strong><small>pontos</small></div>
                      <div className="stores-mobile-details">
                        <span>{entry.tasksCompleted} tarefas</span>
                        <span>média {formatDurationMinutes(entry.averageExecutionMinutes)}</span>
                        <span className={`store-trend trend-${entry.trend}`}><TrendIcon trend={entry.trend} />{entry.trend === 'up' ? 'Em alta' : entry.trend === 'down' ? 'Em queda' : 'Estável'}</span>
                      </div>
                    </li>;
                  })}
                </ol>
              </>
              : search
                ? <div className="stores-ranking-empty"><SearchEmpty title="Nenhuma loja encontrada" copy="Tente outro nome, cidade ou responsável." /></div>
                : <EmptyState title="Ranking indisponível" copy="Não há tarefas concluídas nesse período." />}
    </section>

    {!rankingsQuery.isError && validRankingRange && !rankingsQuery.isLoading && rankings.length > 0 &&
      <SupervisorPointsRanking entries={rankings} periodLabel={rangeLabel} />}
  </div>;
}
