import type { RankingEntry } from '@workspace/api-client-react';

export function currentMonthRankingRange(today: string) {
  return { fromDate: `${today.slice(0, 7)}-01`, toDate: today };
}

export function topRegionalRankings(entries: RankingEntry[]) {
  const bySupervisor = new Map<string, { supervisorName: string; stores: RankingEntry[] }>();

  entries
    .filter((entry) => entry.tasksCompleted > 0 && entry.supervisorName.trim() && entry.supervisorName.trim().toLocaleLowerCase('pt-BR') !== 'sem supervisor')
    .forEach((entry) => {
      const supervisorName = entry.supervisorName.trim().replace(/\s+/g, ' ');
      const key = supervisorName.toLocaleLowerCase('pt-BR');
      const group = bySupervisor.get(key) ?? { supervisorName, stores: [] };
      group.stores.push(entry);
      bySupervisor.set(key, group);
    });

  return [...bySupervisor.values()]
    .sort((first, second) => first.supervisorName.localeCompare(second.supervisorName, 'pt-BR'))
    .map(({ supervisorName, stores }, index) => ({
      regionNumber: index + 1,
      supervisorName,
      stores: stores
        .sort((first, second) => second.points - first.points || first.storeName.localeCompare(second.storeName, 'pt-BR'))
        .slice(0, 3),
    }));
}
