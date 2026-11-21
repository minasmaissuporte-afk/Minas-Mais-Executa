import type { RankingEntry, Store } from '@workspace/api-client-react';

export type RegionalStoreRow = {
  store: Store;
  entry?: RankingEntry;
  position: number;
};

export type RegionalStoreGroup = {
  region: string;
  stores: RegionalStoreRow[];
};

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

export function groupStoresByRegion(
  stores: Store[],
  rankings: RankingEntry[],
  search = '',
): RegionalStoreGroup[] {
  const entryByStoreName = new Map(rankings.map((entry) => [normalize(entry.storeName), entry]));
  const term = normalize(search);
  const groups = new Map<string, Store[]>();

  stores.forEach((store) => {
    const entry = entryByStoreName.get(normalize(store.name));
    const searchable = normalize(`${store.name} ${store.city} ${store.region} ${store.manager} ${store.supervisor} ${entry?.supervisorName ?? ''}`);
    if (term && !searchable.includes(term)) return;
    const region = store.region.trim() || 'Região não informada';
    groups.set(region, [...(groups.get(region) ?? []), store]);
  });

  return [...groups.entries()]
    .sort(([first], [second]) => first.localeCompare(second, 'pt-BR'))
    .map(([region, regionStores]) => ({
      region,
      stores: regionStores
        .map((store) => ({ store, entry: entryByStoreName.get(normalize(store.name)) }))
        .sort((first, second) =>
          (second.entry?.points ?? -1) - (first.entry?.points ?? -1) ||
          (first.entry?.position ?? Number.MAX_SAFE_INTEGER) - (second.entry?.position ?? Number.MAX_SAFE_INTEGER) ||
          first.store.name.localeCompare(second.store.name, 'pt-BR'),
        )
        .map((row, index) => ({ ...row, position: index + 1 })),
    }));
}
