/** Opening hours as minutes from midnight, one entry per day, Sunday first (Google's numbering). */
export type DayHours = { open: number; close: number } | 'closed';
export type Week = (DayHours | undefined)[];

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Period {
  open: { day: number; hour?: number; minute?: number };
  close?: { day: number; hour?: number; minute?: number };
}

/** Google's periods as one span a day: the earliest opening and the latest closing; a day with none is closed. */
export function googleWeek(periodsJson: string): Week | null {
  if (!periodsJson) return null;
  let periods: Period[];
  try {
    periods = JSON.parse(periodsJson) as Period[];
  } catch {
    return null;
  }
  if (!periods.length) return null;
  const week: Week = Array.from({ length: 7 }, () => 'closed' as DayHours);
  // Open around the clock: a single period with no close.
  if (periods.length === 1 && !periods[0]!.close) return Array.from({ length: 7 }, () => ({ open: 0, close: 1440 }));
  for (const p of periods) {
    const open = (p.open.hour ?? 0) * 60 + (p.open.minute ?? 0);
    let close = p.close ? (p.close.hour ?? 0) * 60 + (p.close.minute ?? 0) : 1440;
    if (p.close && p.close.day !== p.open.day) close += 1440;
    const d = p.open.day;
    const prev = week[d];
    week[d] = prev && prev !== 'closed' ? { open: Math.min(prev.open, open), close: Math.max(prev.close, close) } : { open, close };
  }
  return week;
}

/** Odd spaces Google and site builders use, made plain. */
const plain = (s: string) => s.replace(/[\u00a0\u2000-\u200f\u202f\u205f\ufeff]/g, ' ');

/**
 * Google's own day-by-day wording ("Monday: 9:00 AM – 5:00 PM | Tuesday: Closed | Wednesday: Open 24
 * hours"), which is what a visitor reads on the listing. More dependable than the raw periods.
 */
export function googleWeekFromText(desc: string): Week | null {
  if (!desc) return null;
  const week: Week = Array.from({ length: 7 }, () => undefined);
  for (const part of desc.split('|')) {
    const m = /^\s*(\w+):\s*(.+)$/.exec(plain(part));
    if (!m) continue;
    const d = dayIndex(m[1]!);
    if (d < 0) continue;
    const h = /\bclosed\b/i.test(m[2]!) ? 'closed' : hoursIn(m[2]!);
    if (h) week[d] = h;
  }
  return week.filter((x) => x !== undefined).length >= 5 ? week : null;
}

const DAY_TOKEN = '(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)';
const DAY_RE = new RegExp(`\\b${DAY_TOKEN}\\b`, 'gi');
const dayIndex = (t: string): number => ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(t.slice(0, 3).toLowerCase());
const TIME = '(\\d{1,2}(?:[:.]\\d{2})?\\s*(?:am|pm|a\\.m\\.|p\\.m\\.)?|noon|midday|midnight)';
const RANGE_RE = new RegExp(`${TIME}\\s*(?:-|–|—|to|till|until)\\s*${TIME}`, 'gi');

function minutes(t: string, partner?: string): number | null {
  const s = t.toLowerCase().replace(/\s+/g, '').replace(/\./g, (m, i, all: string) => (/\d/.test(all[i + 1] ?? '') ? ':' : ''));
  if (s === 'noon' || s === 'midday') return 720;
  if (s === 'midnight') return 1440;
  const m = /^(\d{1,2})(?::(\d{2}))?(am|pm)?$/.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 24 || min > 59) return null;
  let ap = m[3];
  // "9-5": a bare number takes its partner's half of the day, or a working day's guess.
  if (!ap && partner) ap = /pm/i.test(partner) ? 'pm' : /am/i.test(partner) ? 'am' : undefined;
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return h * 60 + min;
}

/** The days a piece of text names: "Mon - Fri", "Monday to Friday", "Sat & Sun", "Weekdays", "7 days". */
export function daysIn(text: string): number[] {
  const t = text.toLowerCase();
  if (/\b(?:7 days|seven days|every ?day|daily)\b/.test(t)) return [0, 1, 2, 3, 4, 5, 6];
  const out = new Set<number>();
  if (/\bweekdays?\b/.test(t)) [1, 2, 3, 4, 5].forEach((d) => out.add(d));
  if (/\bweekends?\b/.test(t)) [6, 0].forEach((d) => out.add(d));
  const range = new RegExp(`\\b${DAY_TOKEN}\\s*(?:-|–|—|to|through|thru)\\s*${DAY_TOKEN}\\b`, 'gi');
  let rest = t;
  for (const m of t.matchAll(range)) {
    const a = dayIndex(m[1]!);
    const b = dayIndex(m[2]!);
    if (a < 0 || b < 0) continue;
    for (let d = a; ; d = (d + 1) % 7) {
      out.add(d);
      if (d === b) break;
    }
    rest = rest.replace(m[0], ' ');
  }
  for (const m of rest.matchAll(DAY_RE)) {
    const d = dayIndex(m[1]!);
    if (d >= 0) out.add(d);
  }
  return [...out];
}

/** The hours one line gives: closed, around the clock, or the earliest opening and latest closing of its ranges. */
export function hoursIn(text: string): DayHours | null {
  if (/\bclosed\b/i.test(text) && !RANGE_RE.test(text)) return 'closed';
  RANGE_RE.lastIndex = 0;
  if (/\b24\s*(?:hours|hrs|\/\s*7)\b/i.test(text)) return { open: 0, close: 1440 };
  let open: number | null = null;
  let close: number | null = null;
  for (const m of text.matchAll(RANGE_RE)) {
    const a = minutes(m[1]!, m[2]);
    let b = minutes(m[2]!, m[1]);
    if (a === null || b === null) continue;
    // "9-5" with no am or pm: a closing hour before the opening one is in the afternoon.
    if (b <= a && !/am|pm|noon|midday|midnight/i.test(m[2]!) && b < 720) b += 720;
    if (b <= a) b += 1440;
    open = open === null ? a : Math.min(open, a);
    close = close === null ? b : Math.max(close, b);
  }
  return open !== null && close !== null ? { open, close } : null;
}

/**
 * Opening hours published on a page, from its visible text. A day named twice with different hours
 * (summer and winter, kitchen and bar, two locations) makes the whole page unreadable: null.
 */
/** Hours that are not the opening hours: the office, the phones, the kitchen, a holiday or a season. */
const SUB_HOURS = /\b(?:office|reception|phones?|admin|kitchen|bar|breakfast|brunch|lunch|dinner|pool|parking|car ?park|metered|delivery|takeaways?|happy hour|holidays?|christmas|easter|anzac|waitangi|matariki|labour|winter|summer|autumn|spring|school|term|classes?|class|lessons?|sessions?|staffed|unstaffed|manned|private|by appointment|appointments? only|check[- ]?in|check[- ]?out|after hours|emergency)\b/i;

export function siteWeek(text: string): { week: Week; lines: string[] } | null {
  const lines = plain(text)
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const week: Week = Array.from({ length: 7 }, () => undefined);
  const used: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]!;
    if (line.length > 160 || SUB_HOURS.test(line) || (i > 0 && SUB_HOURS.test(lines[i - 1]!) && lines[i - 1]!.length < 40 && !daysIn(lines[i - 1]!).length)) continue;
    let days = daysIn(line);
    if (!days.length) continue;
    let h = hoursIn(line);
    // A table: the day in one cell, the hours in the next.
    if (!h && i + 1 < lines.length && !daysIn(lines[i + 1]!).length) {
      h = hoursIn(lines[i + 1]!);
      if (h) {
        line = `${line} ${lines[i + 1]}`;
        i++;
      }
    }
    if (!h) continue;
    // A second session on the next line ("3:00 - 6:00pm") belongs to the same days.
    while (h !== 'closed' && i + 1 < lines.length && !daysIn(lines[i + 1]!).length && lines[i + 1]!.length < 40) {
      let more = hoursIn(lines[i + 1]!);
      if (!more || more === 'closed') break;
      // "3:00 - 6:00" after a morning session is the afternoon.
      if (!/am|pm|noon|midday/i.test(lines[i + 1]!) && more.open < h.close && more.open < 720) more = { open: more.open + 720, close: more.close + 720 };
      h = { open: Math.min(h.open, more.open), close: Math.max(h.close, more.close) };
      line = `${line}, ${lines[i + 1]}`;
      i++;
    }
    days = daysIn(line.replace(RANGE_RE, ' '));
    RANGE_RE.lastIndex = 0;
    for (const d of days) {
      const prev = week[d];
      if (prev !== undefined && JSON.stringify(prev) !== JSON.stringify(h)) return null;
      week[d] = h;
    }
    used.push(line);
  }
  const known = week.filter((x) => x !== undefined).length;
  return known >= 3 ? { week, lines: used } : null;
}

export const fmtDay = (h: DayHours | undefined): string => {
  if (h === undefined) return 'not given';
  if (h === 'closed') return 'closed';
  const f = (m: number) => {
    const mm = m % 1440;
    return `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`;
  };
  return h.open === 0 && h.close === 1440 ? 'open 24 hours' : `${f(h.open)}–${f(h.close)}`;
};

/** Days where the site and Google disagree: one says closed and the other open, or a time differs by 30 minutes or more. */
export function hoursConflicts(site: Week, google: Week): { day: string; site: string; google: string }[] {
  const out: { day: string; site: string; google: string }[] = [];
  for (let d = 0; d < 7; d++) {
    const s = site[d];
    const g = google[d];
    if (s === undefined || g === undefined) continue;
    const differ = s === 'closed' || g === 'closed' ? s !== g : Math.abs(s.open - g.open) >= 30 || Math.abs(s.close - g.close) >= 30;
    if (differ) out.push({ day: DAY_NAMES[d]!, site: fmtDay(s), google: fmtDay(g) });
  }
  return out;
}
