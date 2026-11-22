import { MapPin, Medal, Search, Store as StoreIcon, Trophy, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getGetRankingsQueryKey, getListStoresQueryKey, useGetRankings, useListStores } from '@workspace/api-client-react';
import { EmptyState, ErrorState, formatDurationMinutes, LoadingBlocks, SearchEmpty, TrendIcon } from '@/components/ui-kit';
import { SupervisorPointsRanking } from '@/components/supervisor-points-ranking';
import { RankingPdfActions } from '@/components/ranking-pdf-actions';
import type { RankingPdfReport } from '@/lib/ranking-pdf';
import { groupStoresBySupervisor } from '@/lib/store-region-ranking';

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
  const regionalStores = useMemo(() => stores.filter((store) =>
    (!rankingRegion || store.region === rankingRegion) &&
    (!rankingSupervisor || store.supervisor === rankingSupervisor),
  ), [stores, rankingRegion, rankingSupervisor]);
  const regionalRankings = useMemo(
    () => groupStoresBySupervisor(regionalStores, orderedRankings, search),
    [regionalStores, orderedRankings, search],
  );
  const rangeLabel = validRankingRange ? periodLabel(rankingRange.fromDate, rankingRange.toDate) : 'período inválido';
  const overallPdfReport: RankingPdfReport = {
    title: 'Ranking geral de lojas',
    period: rangeLabel,
    variant: 'stores',
  };
  const regionalPdfReport: RankingPdfReport = {
    title: 'Ranking das lojas por região',
    period: rangeLabel,
    variant: 'regions',
  };

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
      <label className="ranking-filter">Localização
        <select className="select" value={rankingRegion} onChange={(event) => setRankingRegion(event.target.value)} data-testid="select-ranking-region" aria-label="Filtrar por localização da loja">
          <option value="">Todas as localizações</option>
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

    <div className="stores-ranking-export-surface" data-ranking-pdf-target="stores-overall">
    <div className="stores-ranking-toolbar">
      <div>
        <span className="stores-ranking-kicker"><Trophy size={14} aria-hidden="true" /> Placar da rede</span>
        <h2 id="stores-ranking-title">Ranking de lojas</h2>
        <p>Pontuação total por tarefas concluídas e rapidez no período escolhido.</p>
      </div>
      <div className="search-wrap stores-ranking-search" data-html2canvas-ignore="true">
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
      {validRankingRange && !rankingsQuery.isLoading && !rankingsQuery.isError && visibleRankings.length > 0 &&
        <div className="ranking-pdf-footer">
          <RankingPdfActions report={overallPdfReport} targetId="stores-overall" fromDate={rankingRange.fromDate} toDate={rankingRange.toDate} />
        </div>}
    </section>
    </div>

    <section className="regional-stores-section" aria-labelledby="regional-stores-title" data-testid="stores-regional-ranking" data-ranking-pdf-target="stores-regions">
      <div className="regional-stores-heading">
        <div>
          <span className="stores-ranking-kicker"><UsersRound size={14} aria-hidden="true" /> Comparativo local</span>
          <h2 id="regional-stores-title">Ranking por região</h2>
          <p>As lojas são agrupadas pelo supervisor responsável, não pela localização.</p>
        </div>
        <div className="regional-stores-heading-actions">
          <span className="regional-stores-count">{regionalStores.length} {regionalStores.length === 1 ? 'loja' : 'lojas'} no recorte</span>
        </div>
      </div>
      {!validRankingRange
        ? <EmptyState title="Período inválido" copy="Escolha uma data inicial igual ou anterior à data final." />
        : storesQuery.isLoading
          ? <div className="stores-ranking-loading"><LoadingBlocks rows={3} /></div>
          : storesQuery.isError
            ? <ErrorState onRetry={() => storesQuery.refetch()} />
            : rankingsQuery.isError
              ? <ErrorState onRetry={() => rankingsQuery.refetch()} />
              : rankingsQuery.isLoading
                ? <div className="stores-ranking-loading"><LoadingBlocks rows={3} /></div>
                : regionalRankings.length
                  ? <div className="regional-stores-groups">
                    {regionalRankings.map(({ region, supervisorName, stores: regionStores }) => <section className="regional-store-group" key={region} data-testid={`regional-group-${region}`}>
                      <div className="regional-store-group-heading">
                        <div className="regional-store-group-title">
                          <h3>{region}</h3>
                          <span className="regional-store-group-supervisor">Supervisor · {supervisorName}</span>
                        </div>
                        <span>{regionStores.length} {regionStores.length === 1 ? 'unidade' : 'unidades'}</span>
                      </div>
                      <div className="table-scroll regional-stores-desktop">
                        <table className="data-table regional-stores-table">
                          <caption className="sr-only">Ranking das lojas da região {region}</caption>
                          <thead><tr><th scope="col">Posição</th><th scope="col">Loja</th><th scope="col">Gerente</th><th scope="col">Supervisor</th><th scope="col">Tarefas</th><th scope="col">Pontos</th><th scope="col">Tempo médio</th><th scope="col">Tendência</th></tr></thead>
                          <tbody>{regionStores.map(({ store, entry, position }) => <tr key={store.id} className={podiumClass(position)} data-testid={`regional-row-${store.id}`}>
                            <td><span className="store-rank-medal" aria-label={`${position}º lugar`}>{position <= 3 ? <Medal size={14} aria-hidden="true" /> : String(position).padStart(2, '0')}</span></td>
                            <td><strong className="store-name">{store.name}</strong>{store.city && <span className="store-city"><MapPin size={10} aria-hidden="true" />{store.city}</span>}</td>
                            <td>{entry?.manager || store.manager || 'Não definido'}</td>
                            <td>{entry?.supervisorName || store.supervisor || 'Não definido'}</td>
                            <td>{entry ? entry.tasksCompleted : '—'}</td>
                            <td><span className="score">{entry ? `${entry.points.toLocaleString('pt-BR')} pts` : 'Sem dados'}</span></td>
                            <td>{entry ? formatDurationMinutes(entry.averageExecutionMinutes) : '—'}</td>
                            <td>{entry
                              ? <span className={`store-trend trend-${entry.trend}`} aria-label={`Tendência ${entry.trend}`}><TrendIcon trend={entry.trend} /><span>{entry.trend === 'up' ? 'Em alta' : entry.trend === 'down' ? 'Em queda' : 'Estável'}</span></span>
                              : <span className="regional-no-data">Sem dados</span>}</td>
                          </tr>)}</tbody>
                        </table>
                      </div>
                      <ol className="regional-stores-mobile" aria-label={`Ranking de lojas da região ${region}`}>
                        {regionStores.map(({ store, entry, position }) => <li className={`regional-store-mobile-row ${podiumClass(position)}`} key={`${store.id}-mobile`} data-testid={`regional-mobile-row-${store.id}`}>
                          <div className="regional-mobile-position"><span className="store-rank-medal" aria-hidden="true">{position <= 3 ? <Medal size={14} /> : String(position).padStart(2, '0')}</span><span>{position}º lugar</span></div>
                          <div className="regional-mobile-store"><strong>{store.name}</strong><span>{store.manager || 'Gerente não definido'} · {store.supervisor || 'Supervisor não definido'}</span><small><MapPin size={10} aria-hidden="true" />{store.city}{store.city && store.region ? ' · ' : ''}{store.region}</small></div>
                          <div className="regional-mobile-score"><strong>{entry ? entry.points.toLocaleString('pt-BR') : '—'}</strong><small>{entry ? 'pontos' : 'sem dados'}</small></div>
                          <div className="regional-mobile-detail">
                            <span>{entry ? `${entry.tasksCompleted} tarefas` : 'Tarefas —'}</span>
                            <span>{entry ? `média ${formatDurationMinutes(entry.averageExecutionMinutes)}` : 'Tempo —'}</span>
                            {entry && <span className={`store-trend trend-${entry.trend}`}><TrendIcon trend={entry.trend} />{entry.trend === 'up' ? 'Em alta' : entry.trend === 'down' ? 'Em queda' : 'Estável'}</span>}
                          </div>
                        </li>)}
                      </ol>
                    </section>)}
                  </div>
                  : <div className="stores-ranking-empty"><SearchEmpty title="Nenhuma loja encontrada" copy="Ajuste a busca ou os filtros para ver outras unidades." /></div>}
      {validRankingRange && !storesQuery.isLoading && !storesQuery.isError && !rankingsQuery.isLoading && !rankingsQuery.isError && regionalRankings.length > 0 &&
        <div className="ranking-pdf-footer">
          <RankingPdfActions report={regionalPdfReport} targetId="stores-regions" fromDate={rankingRange.fromDate} toDate={rankingRange.toDate} />
        </div>}
    </section>

    {!rankingsQuery.isError && validRankingRange && !rankingsQuery.isLoading &&
      <SupervisorPointsRanking entries={rankings} periodLabel={rangeLabel} exportRange={{ fromDate: rankingRange.fromDate, toDate: rankingRange.toDate }} exportTargetId="stores-supervisors" />}
  </div>;
}
