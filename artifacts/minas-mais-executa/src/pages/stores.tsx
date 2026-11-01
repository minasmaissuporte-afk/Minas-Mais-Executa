import { MapPin, Search, Store as StoreIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getGetRankingsQueryKey, getListStoresQueryKey, useGetRankings, useListStores } from '@workspace/api-client-react';
import { EmptyState, ErrorState, formatDurationMinutes, LoadingBlocks, SearchEmpty, TrendIcon } from '@/components/ui-kit';

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

export default function StoresPage() {
  const [search, setSearch] = useState('');
  const [rankingRange, setRankingRange] = useState(getDefaultRankingRange);
  const [rankingRegion, setRankingRegion] = useState('');
  const storesQuery = useListStores({ query: { queryKey: getListStoresQueryKey() } });
  const validRankingRange = Boolean(rankingRange.fromDate && rankingRange.toDate && rankingRange.fromDate <= rankingRange.toDate);
  const rankingParams = {
    fromDate: rankingRange.fromDate,
    toDate: rankingRange.toDate,
    ...(rankingRegion ? { region: rankingRegion } : {}),
  };
  const rankingsQuery = useGetRankings(rankingParams, {
    query: {
      queryKey: getGetRankingsQueryKey(rankingParams),
      enabled: validRankingRange,
    },
  });
  const stores = storesQuery.data ?? [];
  const rankings = rankingsQuery.data ?? [];
  const regions = useMemo(() => [...new Set(stores.map((store) => store.region).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [stores]);
  const filtered = useMemo(
    () => stores.filter((store) => `${store.name} ${store.city} ${store.manager}`.toLowerCase().includes(search.toLowerCase())),
    [stores, search],
  );

  return <div className="content">
    <div className="page-head">
      <div>
        <div className="eyebrow">Visão da rede</div>
        <h1 className="page-title">Lojas</h1>
        <p className="page-intro">Uma leitura rápida de quem está executando bem e onde a operação pede presença.</p>
      </div>
      <div className="card" style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 9 }} data-testid="stores-count">
        <StoreIcon size={16} color="hsl(var(--primary))" />
        <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: 12 }}>{stores.length}</span>
        <span className="stat-meta">unidades visíveis</span>
      </div>
    </div>

    <div className="card filters">
      <div className="search-wrap">
        <Search size={15} />
        <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por loja, cidade ou gerente" aria-label="Buscar lojas" data-testid="input-search-stores" />
      </div>
    </div>
    {storesQuery.isError
      ? <ErrorState onRetry={() => storesQuery.refetch()} />
      : storesQuery.isLoading
        ? <LoadingBlocks rows={2} />
        : filtered.length
          ? <div className="card table-card">
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Loja</th><th>Gerente</th><th>Supervisor</th><th>Região</th><th>Execução</th></tr></thead>
                <tbody>{filtered.map((store) => <tr key={store.id} data-testid={`row-store-${store.id}`}>
                  <td><div className="store-name">{store.name}</div><div className="store-city"><MapPin size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />{store.city}</div></td>
                  <td>{store.manager || 'Não definido'}</td>
                  <td>{store.supervisor || 'Não definido'}</td>
                  <td className="stat-meta">{store.region}</td>
                  <td><span className={`score ${store.execution >= 90 ? 'score-good' : 'score-mid'}`}>{store.execution.toFixed(1)}%</span></td>
                </tr>)}</tbody>
              </table>
            </div>
          </div>
          : <div className="card"><SearchEmpty title="Nenhuma loja encontrada" copy="Ajuste a busca para ver outras unidades." /></div>}

    <section className="card table-card" style={{ marginTop: 18 }}>
      <div className="ranking-heading">
        <div>
          <div className="section-title">Ranking geral das lojas</div>
          <div className="stat-meta" style={{ marginTop: 4 }}>Pontuação por tarefa concluída e rapidez, usando a data real de conclusão.</div>
        </div>
        <div className="ranking-filters">
          <label className="ranking-filter">De
            <input
              className="input"
              type="date"
              value={rankingRange.fromDate}
              max={rankingRange.toDate || undefined}
              onChange={(event) => setRankingRange((range) => ({ ...range, fromDate: event.target.value }))}
              aria-label="Data inicial do ranking"
              data-testid="input-ranking-from-date"
            />
          </label>
          <label className="ranking-filter">Até
            <input
              className="input"
              type="date"
              value={rankingRange.toDate}
              min={rankingRange.fromDate || undefined}
              onChange={(event) => setRankingRange((range) => ({ ...range, toDate: event.target.value }))}
              aria-label="Data final do ranking"
              data-testid="input-ranking-to-date"
            />
          </label>
          <label className="ranking-filter">Região
            <select className="select" value={rankingRegion} onChange={(event) => setRankingRegion(event.target.value)} data-testid="select-ranking-region">
              <option value="">Todas as regiões</option>
              {regions.map((region) => <option key={region} value={region}>{region}</option>)}
            </select>
          </label>
        </div>
      </div>
      {!validRankingRange
        ? <EmptyState title="Período inválido" copy="Escolha uma data inicial igual ou anterior à data final." />
        : rankingsQuery.isError
          ? <ErrorState onRetry={() => rankingsQuery.refetch()} />
          : rankingsQuery.isLoading
            ? <LoadingBlocks rows={2} />
            : rankings.length
              ? <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>#</th><th>Loja</th><th>Responsável</th><th>Tarefas concluídas</th><th>Pontos</th><th>Tempo médio</th><th>Tendência</th></tr></thead>
                  <tbody>{rankings.map((entry) => <tr key={entry.storeName} className={entry.position <= 3 ? `podium podium-${entry.position}` : ''} data-testid={`row-ranking-${entry.position}`}>
                    <td className="rank">{String(entry.position).padStart(2, '0')}</td>
                    <td className="store-name">{entry.storeName}</td>
                    <td>{entry.manager}</td>
                    <td>{entry.tasksCompleted}</td>
                    <td><span className="score">{entry.points} pts</span></td>
                    <td>{formatDurationMinutes(entry.averageExecutionMinutes)}</td>
                    <td className={`trend-${entry.trend}`} title={`Tendência: ${entry.trend}`}><TrendIcon trend={entry.trend} /></td>
                  </tr>)}</tbody>
                </table>
              </div>
              : <EmptyState title="Ranking indisponível" copy="Não há tarefas concluídas nesse período." />}
    </section>
  </div>;
}
