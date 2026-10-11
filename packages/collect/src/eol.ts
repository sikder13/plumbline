/**
 * End-of-life dates for site software. Each entry names the page the date was
 * read from. All dates were checked against those pages on 2026-10-10.
 *
 * WordPress is treated as past end of life only below 4.7. Newer branches still
 * get security fixes backported, so calling them unsupported would be wrong.
 */
export interface EolRule {
  product: string;
  /** Matches technology names as detected. */
  match: RegExp;
  sourceUrl: string;
  verifiedOn: string;
  /** Highest version series that is past end of life, with the date support ended. */
  cycles: { upTo: string; eolDate: string }[];
}

export const EOL_TABLE: EolRule[] = [
  {
    product: 'PHP',
    match: /^php$/i,
    sourceUrl: 'https://endoflife.date/php',
    verifiedOn: '2026-10-10',
    cycles: [
      { upTo: '5.6', eolDate: '2018-12-31' },
      { upTo: '7.0', eolDate: '2019-01-10' },
      { upTo: '7.1', eolDate: '2019-12-01' },
      { upTo: '7.2', eolDate: '2020-11-30' },
      { upTo: '7.3', eolDate: '2021-12-06' },
      { upTo: '7.4', eolDate: '2022-11-28' },
      { upTo: '8.0', eolDate: '2023-11-26' },
      { upTo: '8.1', eolDate: '2025-12-31' },
    ],
  },
  {
    product: 'WordPress',
    match: /^wordpress$/i,
    sourceUrl: 'https://wordpress.org/news/2025/06/dropping-security-updates-for-wordpress-versions-4-1-through-4-6/',
    verifiedOn: '2026-10-10',
    cycles: [{ upTo: '4.6', eolDate: '2025-07-31' }],
  },
  {
    product: 'Joomla',
    match: /^joomla!?$/i,
    sourceUrl: 'https://endoflife.date/joomla',
    verifiedOn: '2026-10-10',
    cycles: [
      { upTo: '3', eolDate: '2023-08-17' },
      { upTo: '4', eolDate: '2025-10-14' },
    ],
  },
  {
    product: 'Drupal',
    match: /^drupal$/i,
    sourceUrl: 'https://endoflife.date/drupal',
    verifiedOn: '2026-10-10',
    cycles: [
      { upTo: '9', eolDate: '2023-11-01' },
      { upTo: '10.4', eolDate: '2025-12-10' },
    ],
  },
  {
    product: 'Magento',
    match: /^magento$/i,
    sourceUrl: 'https://endoflife.date/magento',
    verifiedOn: '2026-10-10',
    cycles: [
      { upTo: '2.3', eolDate: '2022-09-30' },
      { upTo: '2.4.5', eolDate: '2024-11-25' },
    ],
  },
  {
    product: 'TYPO3',
    match: /^typo3( cms)?$/i,
    sourceUrl: 'https://endoflife.date/typo3',
    verifiedOn: '2026-10-10',
    cycles: [
      { upTo: '11', eolDate: '2024-10-31' },
      { upTo: '12', eolDate: '2026-04-30' },
    ],
  },
];

function parts(v: string): number[] {
  return v.split('.').map((p) => parseInt(p, 10)).filter((n) => Number.isFinite(n));
}

/** True when `version` falls in or below the series `upTo` (7.4.33 is within 7.4, and 7 is within 7). */
export function atOrBelowSeries(version: string, upTo: string): boolean {
  const v = parts(version);
  const s = parts(upTo);
  if (!v.length) return false;
  for (let i = 0; i < s.length; i++) {
    const a = v[i];
    if (a === undefined) return false;
    if (a < s[i]!) return true;
    if (a > s[i]!) return false;
  }
  return true;
}

export function eolFor(name: string, version: string | null, today: string): { product: string; eolDate: string; sourceUrl: string } | null {
  if (!version || !/^\d+(\.\d+)*$/.test(version)) return null;
  const rule = EOL_TABLE.find((r) => r.match.test(name));
  if (!rule) return null;
  // A bare major version is not enough to place a release in a minor series.
  const hit = rule.cycles.find((c) => parts(version).length >= parts(c.upTo).length && atOrBelowSeries(version, c.upTo));
  if (!hit || hit.eolDate > today) return null;
  return { product: rule.product, eolDate: hit.eolDate, sourceUrl: rule.sourceUrl };
}
