import type { RankingEntry } from '@workspace/api-client-react';

export function currentMonthRankingRange(today: string) {
  return { fromDate: `${today.slice(0, 7)}-01`, toDate: today };
}

export function topRegionalRankings(entries: RankingEntry[]) {
  const byRegion = new Map<string, RankingEntry[]>();

  entries
    .filter((entry) => entry.tasksCompleted > 0)
    .forEach((entry) => {
      const region = entry.region.trim() || 'Sem região';
      byRegion.set(region, [...(byRegion.get(region) ?? []), entry]);
    });

  return [...byRegion.entries()]
    .map(([region, stores]) => ({
      region,
      stores: stores
        .sort((first, second) => second.points - first.points || first.storeName.localeCompare(second.storeName, 'pt-BR'))
        .slice(0, 3),
    }))
    .sort((first, second) => first.region.localeCompare(second.region, 'pt-BR'));
}
