import { z } from 'zod';
import type { Db } from '@plumbline/core';
import type { PageCapture } from '@plumbline/render';
import { quoteOnPage } from './extract.ts';
import { setFacts, type NewFact } from './facts.ts';
import { sameAddress } from './pages.ts';

/**
 * What a person has established about one business by reading its pages, written down in one
 * file. Every item names the page it was read on and quotes the words that state it, and nothing
 * is stored until each quote has been found on the saved copy of that page.
 */

const Source = z.object({ url: z.string().url(), quote: z.string().min(1) });
export type Source = z.infer<typeof Source>;

export const Research = z.object({
  slug: z.string().min(1),
  trading: z.object({
    status: z.enum(['trading', 'for sale', 'closed', 'new owners', 'taking a break', 'unclear']),
    /** Every "for sale", "closed", "under new management", "new owners" or "taking a break" on the pages checked, quoted. */
    flags: z.array(z.object({ kind: z.string().min(1), url: z.string().url(), quote: z.string().min(1) })).default([]),
    pages_checked: z.array(z.string().url()).min(1),
    note: z.string().optional(),
  }),
  people: z.object({
    status: z.enum(['confirmed', 'unconfirmed', 'owner unknown']),
    /** Who to address, in the first names the business itself uses: "Tony and Lisa". */
    address_as: z.string().nullable(),
    owners: z.array(
      z.object({
        name: z.string().min(1),
        /** The first name as the business uses it, where the register has a formal one. */
        first_name_used: z.string().nullable(),
        role: z.string().min(1),
        confirmed: z.boolean(),
        sources: z.array(Source).min(1),
      }),
    ),
    note: z.string().optional(),
  }),
  email: z.object({ address: z.string().email(), published: z.boolean(), source: Source.nullable(), note: z.string().optional() }),
  agency: z.object({ name: z.string().nullable(), signs: z.array(z.object({ kind: z.string().min(1), agency: z.string().min(1), url: z.string().url(), quote: z.string().min(1) })).default([]), note: z.string().optional() }),
  location: z.object({ town: z.string().min(1), region: z.string().min(1), address: z.string().nullable(), source: Source }),
  booking: z.object({ system: z.string().nullable(), link: z.string().url().nullable(), source: Source.nullable(), note: z.string().optional() }),
  prices: z.array(z.object({ item: z.string().min(1), text: z.string().min(1), amount: z.number().positive(), source: Source })).default([]),
  /** The same thing priced differently on two pages. Both are kept. We do not pick one. */
  price_conflicts: z.array(z.object({ item: z.string().min(1), values: z.array(z.object({ text: z.string().min(1), source: Source })).min(2) })).default([]),
  /** One or two activities in plain words, main one first, for the question put to AI tools. */
  activities: z.array(z.string().min(1)).max(2).default([]),
  strengths: z.array(z.object({ kind: z.enum(['award', 'certification', 'reviews', 'other']), text: z.string().min(1), source: Source })).default([]),
  voice: z.array(Source).max(5).default([]),
  unknowns: z.array(z.string().min(1)).default([]),
});
export type Research = z.infer<typeof Research>;

const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '').toLowerCase();

function everySource(r: Research): { where: string; source: Source }[] {
  return [
    ...r.trading.flags.map((f) => ({ where: `trading sign "${f.kind}"`, source: { url: f.url, quote: f.quote } })),
    ...r.people.owners.flatMap((o) => o.sources.map((source) => ({ where: `owner ${o.name}`, source }))),
    ...(r.email.source ? [{ where: 'email', source: r.email.source }] : []),
    ...r.agency.signs.map((s) => ({ where: `agency sign "${s.agency}"`, source: { url: s.url, quote: s.quote } })),
    { where: 'location', source: r.location.source },
    ...(r.booking.source ? [{ where: 'booking', source: r.booking.source }] : []),
    ...r.prices.map((p) => ({ where: `price "${p.item}"`, source: p.source })),
    ...r.price_conflicts.flatMap((c) => c.values.map((v) => ({ where: `price conflict "${c.item}"`, source: v.source }))),
    ...r.strengths.map((s) => ({ where: `strength "${s.text}"`, source: s.source })),
    ...r.voice.map((source) => ({ where: 'voice quote', source })),
  ];
}

const pageFor = (pages: PageCapture[], url: string) => pages.find((p) => sameAddress(p.finalUrl, url) || sameAddress(p.url, url)) ?? null;

/**
 * Everything wrong with a research file, in words. An empty list means it can be stored. A name
 * is confirmed only when two sources on different sites give it, an email is published only with
 * the page that shows it, and every quote must be on the saved copy of its page.
 */
export function checkResearch(r: Research, pages: PageCapture[]): string[] {
  const problems: string[] = [];
  for (const { where, source } of everySource(r)) {
    const page = pageFor(pages, source.url);
    if (!page) problems.push(`${where}: ${source.url} has not been read and kept`);
    else if (!quoteOnPage(page, source.quote)) problems.push(`${where}: the quote is not on ${source.url}: "${source.quote.slice(0, 80)}"`);
  }
  for (const url of r.trading.pages_checked) if (!pageFor(pages, url)) problems.push(`trading: ${url} is listed as checked but has not been read and kept`);
  for (const o of r.people.owners) {
    if (o.confirmed && new Set(o.sources.map((s) => hostOf(s.url))).size < 2) problems.push(`owner ${o.name}: marked confirmed with sources on one site only`);
  }
  if (r.people.status === 'confirmed' && !r.people.owners.some((o) => o.confirmed)) problems.push('people: status is confirmed but no owner is');
  if (r.people.status === 'owner unknown' && r.people.address_as) problems.push('people: owner unknown, yet a name to address is given');
  if (r.people.status !== 'owner unknown' && !r.people.address_as) problems.push('people: no name to address');
  if (r.email.published && !r.email.source) problems.push('email: marked published without the page that shows it');
  if (r.email.source && !r.email.source.quote.toLowerCase().includes(r.email.address.toLowerCase())) problems.push('email: the quote does not contain the address');
  if (r.trading.status !== 'trading' && r.trading.status !== 'unclear' && !r.trading.flags.length) problems.push(`trading: status "${r.trading.status}" without a quoted sign`);
  if (r.booking.link && !r.booking.source) problems.push('booking: a link without the page it was read on');
  return problems;
}

/** Stores a checked research file as facts, each dated by the reading of its page, and sets the town and region from the business's own address. */
export function storeResearch(db: Db, business: { id: number }, r: Research, pages: PageCapture[], now: string): void {
  const readAt = (url: string | null | undefined) => (url ? pageFor(pages, url)?.capturedAtUtc : undefined) ?? now;
  const put = (topic: string, facts: (NewFact & { at?: string })[]) => {
    // Facts of one topic share a write. Each keeps the day its own page was read.
    const byDay = new Map<string, NewFact[]>();
    for (const { at, ...f } of facts) byDay.set(at ?? now, [...(byDay.get(at ?? now) ?? []), f]);
    setFacts(db, business.id, topic, []);
    const insert = db.prepare('INSERT INTO facts (business_id, topic, label, value, source_url, quote, flag, checked_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    db.transaction(() => {
      for (const [day, list] of byDay) for (const f of list) insert.run(business.id, topic, f.label ?? '', JSON.stringify(f.value), f.sourceUrl ?? null, f.quote ?? null, f.flag ?? null, day);
    })();
  };
  const conflicted = new Set(r.price_conflicts.map((c) => c.item.toLowerCase()));
  put('trading', [
    { label: 'status', value: { status: r.trading.status, pagesChecked: r.trading.pages_checked, note: r.trading.note ?? null }, flag: r.trading.status === 'trading' ? null : r.trading.status, at: readAt(r.trading.pages_checked[0]) },
    ...r.trading.flags.map((f) => ({ label: f.kind, value: f.kind, sourceUrl: f.url, quote: f.quote, flag: f.kind, at: readAt(f.url) })),
  ]);
  put('people', [{ label: 'who to address', value: { status: r.people.status, addressAs: r.people.address_as, note: r.people.note ?? null }, flag: r.people.status === 'confirmed' ? null : r.people.status }]);
  put('owner', r.people.owners.flatMap((o) => o.sources.map((s) => ({ label: o.name, value: { firstNameUsed: o.first_name_used, role: o.role, confirmed: o.confirmed }, sourceUrl: s.url, quote: s.quote, flag: o.confirmed ? null : 'unconfirmed', at: readAt(s.url) }))));
  put('email', [{ label: r.email.address, value: { address: r.email.address, published: r.email.published, note: r.email.note ?? null }, sourceUrl: r.email.source?.url, quote: r.email.source?.quote, flag: r.email.published ? null : 'no longer published', at: readAt(r.email.source?.url) }]);
  put('agency', [
    { label: 'summary', value: { name: r.agency.name, note: r.agency.note ?? null }, flag: r.agency.name ? 'agency' : null },
    ...r.agency.signs.map((s) => ({ label: s.agency, value: s.kind, sourceUrl: s.url, quote: s.quote, at: readAt(s.url) })),
  ]);
  put('location', [{ label: 'address', value: { town: r.location.town, region: r.location.region, address: r.location.address }, sourceUrl: r.location.source.url, quote: r.location.source.quote, at: readAt(r.location.source.url) }]);
  put('booking', [{ label: r.booking.system ?? 'none found', value: { system: r.booking.system, link: r.booking.link, note: r.booking.note ?? null }, sourceUrl: r.booking.source?.url, quote: r.booking.source?.quote, at: readAt(r.booking.source?.url) }]);
  put('price', r.prices.map((p) => ({ label: p.item, value: { text: p.text, amount: p.amount }, sourceUrl: p.source.url, quote: p.source.quote, flag: conflicted.has(p.item.toLowerCase()) ? 'conflict' : null, at: readAt(p.source.url) })));
  put('price_conflict', r.price_conflicts.flatMap((c) => c.values.map((v) => ({ label: c.item, value: v.text, sourceUrl: v.source.url, quote: v.source.quote, flag: 'conflict', at: readAt(v.source.url) }))));
  put('activity', r.activities.map((a) => ({ value: a })));
  put('strength', r.strengths.map((s) => ({ label: s.kind, value: s.text, sourceUrl: s.source.url, quote: s.source.quote, at: readAt(s.source.url) })));
  put('voice', r.voice.map((v) => ({ value: v.quote, sourceUrl: v.url, quote: v.quote, at: readAt(v.url) })));
  put('unknown', r.unknowns.map((u) => ({ value: u, flag: 'unknown' })));
  db.prepare('UPDATE businesses SET town = ?, region = ? WHERE id = ?').run(r.location.town, r.location.region, business.id);
}
