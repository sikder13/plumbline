import { getDomain, getHostname } from 'tldts';

export function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Registrable domain, lower case, or null when the input is not a usable URL. */
export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  return getDomain(withScheme) ?? null;
}

export function hostOf(url: string): string | null {
  return getHostname(url) ?? null;
}

export function sameSite(a: string, b: string): boolean {
  const ha = hostOf(a)?.replace(/^www\./, '');
  const hb = hostOf(b)?.replace(/^www\./, '');
  return !!ha && ha === hb;
}

export function normalizeUrl(raw: string, base?: string): string | null {
  try {
    const u = new URL(raw, base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    return u.toString();
  } catch {
    return null;
  }
}

/** Digits only, NZ numbers reduced to national form without the leading zero or 64. */
export function normalizePhone(raw: string): string {
  let d = raw.replace(/[^\d+]/g, '');
  if (d.startsWith('+64')) d = d.slice(3);
  else if (d.startsWith('0064')) d = d.slice(4);
  else if (d.startsWith('64') && d.length >= 10) d = d.slice(2);
  d = d.replace(/\D/g, '');
  return d.replace(/^0+/, '');
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function foldName(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function wordCount(s: string): number {
  return (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
}

export function median(values: number[]): number {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export function excerptAround(text: string, index: number, length: number, pad = 60): string {
  const start = Math.max(0, index - pad);
  const end = Math.min(text.length, index + length + pad);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}
