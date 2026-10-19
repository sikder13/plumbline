/**
 * Opening hours as a business publishes them on Google, and where the clock stands against them in
 * Indiana. Plumbing only: each page draws its hours in its own way.
 */

export interface Day {
  /** Monday first. */
  day: string;
  /** "10:00" in 24 hour time, or null when closed. "00:00" to "24:00" is open all day. */
  open: string | null;
  close: string | null;
}

export const ZONE = 'America/Indiana/Indianapolis';

/** Monday is 0. Minutes since midnight. Both in Indiana time. */
export function indianaNow(at: Date = new Date()): { weekday: number; minutes: number } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: ZONE, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(at).map((p) => [p.type, p.value]));
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(String(parts.weekday));
  return { weekday, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h! * 60 + (m ?? 0);
}

/** "10 AM", "9:30 PM", "12 PM". */
export function clock(t: string): string {
  const total = toMinutes(t) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
}

export function allDay(d: Day): boolean {
  return d.open === '00:00' && d.close === '24:00';
}

/** "10 AM to 9 PM", "Open 24 hours" or "Closed", as the profile says it. */
export function span(d: Day): string {
  if (!d.open || !d.close) return 'Closed';
  if (allDay(d)) return 'Open 24 hours';
  return `${clock(d.open)} to ${clock(d.close)}`;
}

export interface State {
  open: boolean;
  /** A short line: "Open now until 9 PM", "Opens Tuesday at 10 AM". */
  line: string;
}

/** Whether the business is open at this moment, and the next change, by its published hours. */
export function stateAt(week: Day[], now = indianaNow()): State {
  const today = week[now.weekday];
  if (today?.open && today.close && now.minutes >= toMinutes(today.open) && now.minutes < toMinutes(today.close)) {
    return { open: true, line: allDay(today) ? 'Open now, all day today' : `Open now until ${clock(today.close)}` };
  }
  for (let i = 0; i < 8; i++) {
    const k = (now.weekday + i) % 7;
    const d = week[k];
    if (!d?.open) continue;
    if (i === 0 && now.minutes >= toMinutes(d.open)) continue;
    const when = i === 0 ? 'today' : i === 1 ? 'tomorrow' : d.day;
    return { open: false, line: `Opens ${when} at ${clock(d.open)}` };
  }
  return { open: false, line: 'Closed' };
}
