import { describe, expect, it } from 'vitest';
import { clock, indianaNow, span, stateAt, type Day } from '../../../apps/previews/components/os/hours.ts';

const week: Day[] = [
  { day: 'Monday', open: null, close: null },
  { day: 'Tuesday', open: '10:00', close: '21:00' },
  { day: 'Wednesday', open: '10:00', close: '21:00' },
  { day: 'Thursday', open: '10:00', close: '21:00' },
  { day: 'Friday', open: '10:00', close: '22:00' },
  { day: 'Saturday', open: '10:00', close: '22:00' },
  { day: 'Sunday', open: '10:00', close: '19:00' },
];

describe('hours', () => {
  it('writes times the way the profile does', () => {
    expect(clock('10:00')).toBe('10 AM');
    expect(clock('21:00')).toBe('9 PM');
    expect(clock('12:00')).toBe('12 PM');
    expect(span(week[1]!)).toBe('10 AM to 9 PM');
    expect(span(week[0]!)).toBe('Closed');
    expect(span({ day: 'Monday', open: '00:00', close: '24:00' })).toBe('Open 24 hours');
  });
  it('reads Indiana time', () => {
    // 19 October 2026 15:00 UTC is a Monday, 11 AM in Indiana.
    expect(indianaNow(new Date('2026-10-19T15:00:00Z'))).toEqual({ weekday: 0, minutes: 11 * 60 });
  });
  it('says what is next', () => {
    expect(stateAt(week, { weekday: 0, minutes: 600 })).toEqual({ open: false, line: 'Opens tomorrow at 10 AM' });
    expect(stateAt(week, { weekday: 1, minutes: 700 })).toEqual({ open: true, line: 'Open now until 9 PM' });
    expect(stateAt(week, { weekday: 6, minutes: 1200 })).toEqual({ open: false, line: 'Opens Tuesday at 10 AM' });
    expect(stateAt(week, { weekday: 2, minutes: 300 })).toEqual({ open: false, line: 'Opens today at 10 AM' });
  });
});
