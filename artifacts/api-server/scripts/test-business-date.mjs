import assert from 'node:assert/strict';
import { saoPauloStartOfDay } from '../src/lib/business-date.ts';

for (const date of ['2026-11-01', '2026-11-30', '2026-12-01']) {
  const start = saoPauloStartOfDay(date);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(start);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  assert.equal(`${value('year')}-${value('month')}-${value('day')} ${value('hour')}:${value('minute')}:${value('second')}`, `${date} 00:00:00`);
}
console.log('São Paulo ranking date-boundary tests passed.');
