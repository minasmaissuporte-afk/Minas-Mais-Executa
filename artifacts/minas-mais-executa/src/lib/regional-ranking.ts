import type { RankingEntry, SupervisorRankingEntry } from '@workspace/api-client-react';

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

const supervisorAwards = ['ouro', 'prata', 'bronze', 'cobre'] as const;

export function rankSupervisorsByPoints(entries: RankingEntry[]) {
  const bySupervisor = new Map<string, {
    supervisorName: string;
    points: number;
    storeCount: number;
    storesWithCompletions: number;
    tasksCompleted: number;
  }>();

  entries.forEach((entry) => {
    const supervisorName = entry.supervisorName.trim().replace(/\s+/g, ' ');
    if (!supervisorName || supervisorName.toLocaleLowerCase('pt-BR') === 'sem supervisor') return;

    const key = supervisorName.toLocaleLowerCase('pt-BR');
    const group = bySupervisor.get(key) ?? {
      supervisorName,
      points: 0,
      storeCount: 0,
      storesWithCompletions: 0,
      tasksCompleted: 0,
    };
    group.points += entry.points;
    group.storeCount += 1;
    group.tasksCompleted += entry.tasksCompleted;
    if (entry.tasksCompleted > 0) group.storesWithCompletions += 1;
    bySupervisor.set(key, group);
  });

  return rankSupervisorSummaries([...bySupervisor.values()]);
}

export function rankSupervisorSummaries(supervisors: SupervisorRankingEntry[]) {
  return supervisors
    .filter((supervisor) => supervisor.points > 0)
    .sort((first, second) => second.points - first.points || first.supervisorName.localeCompare(second.supervisorName, 'pt-BR'))
    .map((supervisor, index) => ({
      ...supervisor,
      position: index + 1,
      award: supervisorAwards[index] ?? null,
    }));
}
