const NZ = new Intl.DateTimeFormat('en-NZ', {
  timeZone: 'Pacific/Auckland',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZoneName: 'short',
});

export function utcIso(d: Date = new Date()): string {
  return d.toISOString();
}

/** "2026-10-11 09:15:02 NZDT" for the given instant. */
export function nzTime(d: Date | string = new Date()): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const p = Object.fromEntries(NZ.formatToParts(date).map((x) => [x.type, x.value]));
  const hour = p.hour === '24' ? '00' : p.hour;
  return `${p.year}-${p.month}-${p.day} ${hour}:${p.minute}:${p.second} ${p.timeZoneName}`;
}

export function bothTimes(d: Date = new Date()): { utc: string; nz: string } {
  return { utc: utcIso(d), nz: nzTime(d) };
}

export function utcDay(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Calendar month in Pacific/Auckland, 1 to 12. */
export function nzMonth(d: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', month: 'numeric' }).format(d));
}

export function nzYear(d: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', year: 'numeric' }).format(d));
}

export function minutesBetween(a: string | Date, b: string | Date): number {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 60_000;
}
