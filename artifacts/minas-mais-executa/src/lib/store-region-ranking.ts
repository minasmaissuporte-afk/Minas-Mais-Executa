import type { RankingEntry, Store } from '@workspace/api-client-react';

export type RegionalStoreRow = {
  store: Store;
  entry?: RankingEntry;
  position: number;
};

export type RegionalStoreGroup = {
  region: string;
  supervisorName: string;
  stores: RegionalStoreRow[];
};

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

function assignedSupervisor(...names: Array<string | undefined>) {
  for (const candidate of names) {
    const name = candidate?.trim().replace(/\s+/g, ' ');
    if (name && normalize(name) !== 'sem supervisor') return name;
  }
  return 'Supervisor não informado';
}

export function groupStoresBySupervisor(
  stores: Store[],
  rankings: RankingEntry[],
  search = '',
): RegionalStoreGroup[] {
  const entryByStoreName = new Map(rankings.map((entry) => [normalize(entry.storeName), entry]));
  const term = normalize(search);
  const groups = new Map<string, { supervisorName: string; stores: Store[] }>();

  stores.forEach((store) => {
    const entry = entryByStoreName.get(normalize(store.name));
    const searchable = normalize(`${store.name} ${store.city} ${store.region} ${store.manager} ${store.supervisor} ${entry?.supervisorName ?? ''}`);
    if (term && !searchable.includes(term)) return;
    const supervisorName = assignedSupervisor(entry?.supervisorName, store.supervisor);
    const key = normalize(supervisorName);
    const group = groups.get(key) ?? { supervisorName, stores: [] };
    group.stores.push(store);
    groups.set(key, group);
  });

  return [...groups.values()]
    .sort((first, second) => first.supervisorName.localeCompare(second.supervisorName, 'pt-BR'))
    .map(({ supervisorName, stores: supervisorStores }, index) => ({
      region: `Região ${index + 1}`,
      supervisorName,
      stores: supervisorStores
        .map((store) => ({ store, entry: entryByStoreName.get(normalize(store.name)) }))
        .sort((first, second) =>
          (second.entry?.points ?? -1) - (first.entry?.points ?? -1) ||
          (first.entry?.position ?? Number.MAX_SAFE_INTEGER) - (second.entry?.position ?? Number.MAX_SAFE_INTEGER) ||
          first.store.name.localeCompare(second.store.name, 'pt-BR'),
        )
        .map((row, index) => ({ ...row, position: index + 1 })),
    }));
}
