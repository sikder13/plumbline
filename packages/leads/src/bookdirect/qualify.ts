import type { Finding } from './classes.ts';
import { leadFindings, sectorOf } from './classes.ts';
import { hasPhrase } from './filters.ts';
import type { VerifyStatus } from './verify.ts';

/** What qualification reads about one lead: its contact record, its audit and its competitors. */
export interface QualifyInput {
  list: string;
  name: string;
  primaryType: string;
  verifyStatus: VerifyStatus | '';
  verifyFlags: string[];
  bookingEngineKind: string;
  otaLinks: string[];
  telPath: boolean;
  findings: Finding[];
  fullSignal: string;
  excluded: string | null;
  prior: string | null;
  ratingCount: number;
  competitorsBookOnline: number | null;
  audited: boolean;
}

/** Wineries and the faith screen: alcohol, gambling and the like, by whole word in the name or the Google type. */
const EXCLUDED_WORDS = ['winery', 'vineyard', 'wine tours', 'wines', 'brewery', 'distillery', 'bar', 'pub', 'tavern', 'casino', 'liquor', 'vape', 'cannabis', 'hemp', 'adult'];
const EXCLUDED_TYPES = /^(?:winery|bar|pub|night_club|wine_bar|cocktail_bar|liquor_store|casino|brewery|distillery|adult_entertainment_\w+)$/;

export function excludedType(name: string, type: string): string | null {
  if (EXCLUDED_TYPES.test(type)) return `type ${type}`;
  const w = EXCLUDED_WORDS.find((x) => hasPhrase(name, x));
  return w ? `name says "${w}"` : null;
}

/**
 * The "room to sell" rule, in the relay's order. The first rule that fails is the reason; null means
 * qualified.
 */
export function qualifyReason(q: QualifyInput): string | null {
  if (q.verifyStatus === 'invalid' || !q.verifyStatus) return 'invalid_email';
  const sector = sectorOf(q.list);
  const hasBooking = q.bookingEngineKind === 'own' || q.bookingEngineKind === 'platform' || q.bookingEngineKind === 'generic' || q.otaLinks.length > 0;
  if (sector === 'trades' ? !q.telPath : !hasBooking) return 'no_booking_engine_or_link';
  if (!q.audited) return 'not_audited';
  if (!leadFindings(q.findings).length) return q.findings.some((f) => f.tier === 4) ? 'only_tier4_finding' : 'no_lead_finding';
  if (q.fullSignal) return 'already_full';
  if (q.excluded) return 'excluded_business_type';
  if (q.prior) return 'previously_contacted_or_suppressed';
  return null;
}

/** Room to sell, 0 to 10. */
export function roomToSell(q: QualifyInput): { score: number; points: string[] } {
  const points: string[] = [];
  let s = 0;
  const has = (cls: string) => q.findings.find((f) => f.cls === cls);
  if (has('ota_only_booking')) {
    s += 3;
    points.push('+3 ota_only_booking');
  }
  if (has('book_cta_dead')) {
    s += 3;
    points.push('+3 book_cta_dead');
  }
  if (has('no_first_screen_cta')) {
    s += 2;
    points.push('+2 no_first_screen_cta');
  }
  const slow = has('slow_mobile');
  if (slow) {
    const v = Number(/LCP (\d+(?:\.\d+)?) s/.exec(slow.value)?.[1] ?? 0);
    const add = v > 6 ? 2 : 1;
    s += add;
    points.push(`+${add} slow_mobile ${v} s`);
  }
  if (has('tel_link_dead')) {
    s += 1;
    points.push('+1 tel_link_dead');
  }
  if (sectorOf(q.list) === 'allied_health' && (q.competitorsBookOnline ?? 0) >= 2) {
    s += 1;
    points.push(`+1 competitors_book_online ${q.competitorsBookOnline} of 3`);
  }
  if (q.ratingCount >= 10 && q.ratingCount <= 150) {
    s += 1;
    points.push(`+1 ${q.ratingCount} ratings (10 to 150)`);
  }
  if (q.verifyFlags.includes('needs_verifier')) {
    s -= 2;
    points.push('-2 needs_verifier');
  }
  return { score: Math.max(0, Math.min(10, s)), points };
}
