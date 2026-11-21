import assert from 'node:assert/strict';
const { currentMonthRankingRange, topRegionalRankings } = await import('../src/lib/regional-ranking.ts');

assert.deepEqual(currentMonthRankingRange('2026-11-21'), { fromDate: '2026-11-01', toDate: '2026-11-21' });

const entry = (region, storeName, points, tasksCompleted = 1) => ({
  position: 1,
  storeName,
  manager: 'Gerente',
  region,
  execution: 0,
  tasksCompleted,
  points,
  averageExecutionMinutes: 0,
  trend: 'stable',
  groupName: 'G',
  supervisorName: 'Supervisão',
});

const groups = topRegionalRankings([
  entry('Sul', 'Loja Sul 4', 40),
  entry('Norte', 'Loja Norte 3', 60),
  entry('Norte', 'Loja Norte 2', 80),
  entry('Norte', 'Loja Norte 1', 100),
  entry('Norte', 'Loja Norte 4', 20),
  entry('Sul', 'Loja Sul 1', 80),
  entry('Sul', 'Loja Sul 2', 80),
  entry('Norte', 'Loja sem conclusão', 0, 0),
]);

assert.deepEqual(groups.map(({ region }) => region), ['Norte', 'Sul']);
assert.deepEqual(groups[0].stores.map(({ storeName }) => storeName), ['Loja Norte 1', 'Loja Norte 2', 'Loja Norte 3']);
assert.deepEqual(groups[1].stores.map(({ storeName }) => storeName), ['Loja Sul 1', 'Loja Sul 2', 'Loja Sul 4']);
assert.ok(groups.every(({ stores }) => stores.length <= 3));
assert.ok(groups.every(({ stores }) => stores.every(({ tasksCompleted }) => tasksCompleted > 0)));
console.log('Regional execution leaderboard tests passed.');
