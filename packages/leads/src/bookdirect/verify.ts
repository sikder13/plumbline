import { resolveMx } from 'node:dns/promises';

/** The relay's verification steps, in order: syntax and MX, then a single-address check where a key exists. */
export type VerifyStatus = 'valid' | 'catch_all' | 'mx_only' | 'unknown' | 'invalid';

const SYNTAX = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export function syntaxOk(email: string): boolean {
  if (!SYNTAX.test(email) || email.length > 254) return false;
  const [local] = email.split('@');
  return !!local && local.length <= 64 && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..');
}

export type MxResolver = (domain: string) => Promise<{ exchange: string; priority: number }[]>;

/** Whether the address's domain has MX records. A lookup that times out or fails for another reason is tried once more. */
export async function mxCheck(email: string, resolver: MxResolver = resolveMx): Promise<{ ok: boolean; hosts: string[]; error: string | null }> {
  const domain = email.split('@')[1] ?? '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const mx = (await resolver(domain)).filter((r) => r.exchange && r.exchange !== '.');
      return { ok: mx.length > 0, hosts: mx.sort((a, b) => a.priority - b.priority).map((r) => r.exchange).slice(0, 3), error: mx.length ? null : 'no MX records' };
    } catch (e) {
      const code = (e as { code?: string }).code ?? 'lookup failed';
      if (code === 'ENOTFOUND' || code === 'ENODATA' || attempt === 1) return { ok: false, hosts: [], error: code };
    }
  }
  return { ok: false, hosts: [], error: 'lookup failed' };
}

export interface SingleCheck {
  provider: 'zerobounce';
  status: string;
  subStatus: string;
  checkedAt: string;
  error: string | null;
}

/** One ZeroBounce validation. The key is passed in and never written to a result or an error. */
export async function zeroBounceCheck(email: string, key: string, fetcher: typeof fetch = fetch, now: () => string = () => new Date().toISOString()): Promise<SingleCheck> {
  const hide = (s: string) => s.split(key).join('<hidden>');
  try {
    const res = await fetcher(`https://api.zerobounce.net/v2/validate?api_key=${encodeURIComponent(key)}&email=${encodeURIComponent(email)}&ip_address=`, { signal: AbortSignal.timeout(60_000) });
    const j = (await res.json()) as { status?: string; sub_status?: string; error?: string };
    if (j.error || !j.status) return { provider: 'zerobounce', status: 'error', subStatus: '', checkedAt: now(), error: hide(j.error ?? `no status (http ${res.status})`).slice(0, 160) };
    return { provider: 'zerobounce', status: j.status.toLowerCase(), subStatus: (j.sub_status ?? '').toLowerCase(), checkedAt: now(), error: null };
  } catch (e) {
    return { provider: 'zerobounce', status: 'error', subStatus: '', checkedAt: now(), error: hide((e as Error).message).slice(0, 160) };
  }
}

/**
 * The verdict from a single-address check. Role addresses (info@, bookings@) are allowed, and so are
 * catch-all domains, flagged. Known traps, abuse and complainer lists are invalid. A check that could
 * not decide leaves the address as MX-checked only, still waiting for a verifier.
 */
export function verdictOf(c: SingleCheck): { status: VerifyStatus; flags: string[] } {
  switch (c.status) {
    case 'valid':
      return { status: 'valid', flags: [] };
    case 'catch-all':
      return { status: 'catch_all', flags: ['catch_all_domain'] };
    case 'invalid':
    case 'spamtrap':
    case 'abuse':
      return { status: 'invalid', flags: [`zerobounce_${c.status}${c.subStatus ? `_${c.subStatus}` : ''}`] };
    case 'do_not_mail':
      if (/role_based/.test(c.subStatus)) return { status: c.subStatus === 'role_based_catch_all' ? 'catch_all' : 'valid', flags: c.subStatus === 'role_based_catch_all' ? ['role_address', 'catch_all_domain'] : ['role_address'] };
      if (c.subStatus === 'mx_forward') return { status: 'valid', flags: ['mx_forward'] };
      return { status: 'invalid', flags: [`zerobounce_do_not_mail_${c.subStatus || 'unknown'}`] };
    case 'unknown':
      return { status: 'unknown', flags: ['needs_verifier', `zerobounce_unknown${c.subStatus ? `_${c.subStatus}` : ''}`] };
    default:
      return { status: 'mx_only', flags: ['needs_verifier'] };
  }
}
