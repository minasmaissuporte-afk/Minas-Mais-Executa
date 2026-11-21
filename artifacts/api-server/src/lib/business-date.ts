const saoPauloDateTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Convert a validated business date into the UTC instant at local midnight. */
export function saoPauloStartOfDay(dateInput: string) {
  const utcMidnight = new Date(`${dateInput}T00:00:00.000Z`);
  const parts = saoPauloDateTime.formatToParts(utcMidnight);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const localAsUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));
  return new Date(utcMidnight.getTime() - (localAsUtc - utcMidnight.getTime()));
}
