import { describe, expect, it } from 'vitest';
import { openSignCopy, usTel } from './opensign-gates.ts';

describe('usTel', () => {
  it('takes a US number in international form', () => {
    expect(usTel('tel:+18128140851')).toBe(true);
    expect(usTel('tel:+1812814085')).toBe(false);
    expect(usTel('tel:8128140851')).toBe(false);
  });
});

describe('openSignCopy', () => {
  const allowed = new Set(['2920', '7', '812', '814', '0851', '10', '9']);
  it('passes plain copy with known figures and a phone number', () => {
    expect(openSignCopy('Open Tuesday to Sunday. Call (812) 814-0851. 2920 S 7th St. 10 AM to 9 PM.', allowed)).toEqual([]);
  });
  it('finds a dash inside a sentence, an AI word, a placeholder and an unknown figure', () => {
    const issues = openSignCopy('The best studio — truly innovative solutions. Lorem ipsum. Rated 4.9 by 120 people.', allowed);
    const kinds = issues.map((i) => `${i.kind}:${i.text.toLowerCase()}`);
    expect(kinds).toContain('dash:—');
    expect(kinds).toContain('banned:innovative');
    expect(kinds).toContain('banned:solutions');
    expect(kinds).toContain('placeholder:lorem');
    expect(kinds).toContain('number:4.9');
    expect(kinds).toContain('number:120');
  });
});
