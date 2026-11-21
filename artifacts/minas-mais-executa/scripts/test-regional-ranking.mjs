import assert from 'node:assert/strict';
const { currentMonthRankingRange, rankSupervisorsByPoints, topRegionalRankings } = await import('../src/lib/regional-ranking.ts');
const { groupStoresBySupervisor } = await import('../src/lib/store-region-ranking.ts');

assert.deepEqual(currentMonthRankingRange('2026-11-21'), { fromDate: '2026-11-01', toDate: '2026-11-21' });

const entry = (supervisorName, storeName, points, tasksCompleted = 1) => ({
  position: 1,
  storeName,
  manager: 'Gerente',
  supervisorName,
  execution: 0,
  tasksCompleted,
  points,
  averageExecutionMinutes: 0,
  trend: 'stable',
  groupName: 'G',
});

const groups = topRegionalRankings([
  entry('Jhonathan', 'Loja Sul 4', 40),
  entry('Ana Paula', 'Loja Norte 3', 60),
  entry('Ana Paula', 'Loja Norte 2', 80),
  entry('Ana Paula', 'Loja Norte 1', 100),
  entry('Ana Paula', 'Loja Norte 4', 20),
  entry('Jhonathan', 'Loja Sul 1', 80),
  entry('Jhonathan', 'Loja Sul 2', 80),
  entry('Ana Paula', 'Loja sem conclusão', 0, 0),
  entry('Sem supervisor', 'Loja sem supervisor', 999, 2),
]);

assert.deepEqual(groups.map(({ regionNumber, supervisorName }) => [regionNumber, supervisorName]), [[1, 'Ana Paula'], [2, 'Jhonathan']]);
assert.deepEqual(groups[0].stores.map(({ storeName }) => storeName), ['Loja Norte 1', 'Loja Norte 2', 'Loja Norte 3']);
assert.deepEqual(groups[1].stores.map(({ storeName }) => storeName), ['Loja Sul 1', 'Loja Sul 2', 'Loja Sul 4']);
assert.ok(groups.every(({ stores }) => stores.length <= 3));
assert.ok(groups.every(({ stores }) => stores.every(({ tasksCompleted }) => tasksCompleted > 0)));

const supervisorRanking = rankSupervisorsByPoints([
  entry('Ana Paula', 'Loja Norte 1', 100),
  entry('Ana Paula', 'Loja Norte 2', 80),
  entry('Ana Paula', 'Loja Norte 3', 60),
  entry(' Ana Paula ', 'Loja Norte 4', 50, 0),
  entry('Jhonathan', 'Loja Sul 1', 240),
  entry('Edson', 'Loja Leste 1', 180),
  entry('Christiano', 'Loja Oeste 1', 120),
  entry('Supervisor sem pontos', 'Loja sem tarefas concluídas', 0, 0),
  entry('Sem supervisor', 'Loja sem supervisor', 999),
]);

assert.deepEqual(supervisorRanking.map(({ supervisorName, points, storeCount, award }) => [supervisorName, points, storeCount, award]), [
  ['Ana Paula', 290, 4, 'ouro'],
  ['Jhonathan', 240, 1, 'prata'],
  ['Edson', 180, 1, 'bronze'],
  ['Christiano', 120, 1, 'cobre'],
]);
assert.ok(supervisorRanking.every(({ points }) => points > 0), 'Supervisors with no points must not receive a podium rank.');

const store = (id, name, region, supervisor = 'Supervisor compartilhado') => ({
  id, name, region, supervisor, city: `Cidade ${id}`, manager: `Gerente ${id}`, execution: 0,
});
const regionalStores = [
  store('a', 'Unidade A', 'Centro'),
  store('b', 'Unidade B', 'Centro'),
  store('c', 'Unidade C', 'Centro'),
  store('d', 'Unidade D', 'Centro'),
  store('e', 'Unidade E', 'Centro'),
  store('f', 'Unidade F', 'Norte'),
  store('g', 'Unidade G', 'Centro', 'Outro supervisor'),
];
const regionalEntries = [
  { ...entry('Supervisor compartilhado', 'Unidade A', 25), position: 4 },
  { ...entry('Supervisor compartilhado', 'Unidade B', 80), position: 1 },
  { ...entry('Supervisor compartilhado', 'Unidade C', 50), position: 2 },
  { ...entry('Supervisor compartilhado', 'Unidade D', 0, 0), position: 5 },
  { ...entry('Supervisor compartilhado', 'Unidade F', 120), position: 1 },
  { ...entry('Outro supervisor', 'Unidade G', 40), position: 3 },
];
const storeRegions = groupStoresBySupervisor(regionalStores, regionalEntries);
assert.deepEqual(storeRegions.map(({ region, supervisorName }) => [region, supervisorName]), [
  ['Região 1', 'Outro supervisor'],
  ['Região 2', 'Supervisor compartilhado'],
]);
assert.deepEqual(storeRegions[0].stores.map(({ store: item, position }) => [item.name, position]), [['Unidade G', 1]]);
assert.deepEqual(storeRegions[1].stores.map(({ store: item, position }) => [item.name, position]), [
  ['Unidade F', 1],
  ['Unidade B', 2],
  ['Unidade C', 3],
  ['Unidade A', 4],
  ['Unidade D', 5],
  ['Unidade E', 6],
]);
assert.equal(storeRegions[1].stores[5].entry, undefined, 'Stores absent from the period ranking remain listed without fabricated metrics.');
assert.deepEqual(groupStoresBySupervisor(regionalStores, regionalEntries, 'Cidade f').map(({ region, supervisorName, stores: items }) => [region, supervisorName, items.map(({ store: item }) => item.name)]), [
  ['Região 1', 'Supervisor compartilhado', ['Unidade F']],
]);
console.log('Regional execution leaderboard tests passed.');
