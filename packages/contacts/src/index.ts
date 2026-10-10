import { domainOf, env, normalizeEmail, normalizeUrl, sameSite, utcIso, type Business, type Db } from '@plumbline/core';
import { guard, loadPrices, record, tokenCost } from '@plumbline/budget';
import { emailsIn, phonesIn } from '@plumbline/collect';
import type { Polite } from '@plumbline/fetch';
import type { PageCapture, Renderer } from '@plumbline/render';

/** Decodes the hex string Cloudflare uses to hide an email address. The first byte is the key. */
export function decodeCloudflareEmail(hex: string): string | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length < 4 || hex.length % 2) return null;
  const key = parseInt(hex.slice(0, 2), 16);
  let out = '';
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  try {
    out = decodeURIComponent(escape(out));
  } catch {
    // Plain ASCII needs no further decoding.
  }
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(out) ? out : null;
}

const NOT_A_BUSINESS_EMAIL = /@(example\.(com|org)|domain\.com|email\.com|yourdomain\.|sentry\.|wixpress\.com|sentry-next\.|godaddy\.com|squarespace\.com|wix\.com|rocketspark\.|mysite\.com|test\.com|company\.com|website\.com)|^(you|your|name|email|user|someone|username|firstname|john\.doe|jane\.doe)@|\.(png|jpe?g|gif|webp|svg)$/i;

export interface FoundEmail {
  email: string;
  sourceUrl: string;
  how: 'text' | 'mailto' | 'cloudflare';
}

/** Emails a visitor can see on the page: in the text, or behind a visible email link. */
export function publishedEmails(page: PageCapture): FoundEmail[] {
  const out = new Map<string, FoundEmail>();
  const add = (raw: string, how: FoundEmail['how']) => {
    const email = normalizeEmail(raw);
    if (!email || NOT_A_BUSINESS_EMAIL.test(email) || out.has(email)) return;
    out.set(email, { email, sourceUrl: page.finalUrl, how });
  };
  for (const e of emailsIn(page.text)) add(e, 'text');
  for (const l of page.links) {
    if (!l.visible) continue;
    const raw = l.raw.trim();
    if (/^mailto:/i.test(raw)) {
      for (const a of decodeURIComponent(raw.slice(7).split('?')[0] ?? '').split(/[,;]/)) if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.trim())) add(a, 'mailto');
    }
    const cf = /\/cdn-cgi\/l\/email-protection#([0-9a-f]+)/i.exec(raw);
    if (cf) {
      const decoded = decodeCloudflareEmail(cf[1]!);
      if (decoded) add(decoded, 'cloudflare');
    }
  }
  return [...out.values()];
}

/** Own-domain addresses first, then the rest, so the business's main address leads. */
export function rankEmails(emails: FoundEmail[], domain: string | null): FoundEmail[] {
  const score = (e: FoundEmail) => {
    const d = e.email.split('@')[1] ?? '';
    let s = domain && (d === domain || d.endsWith(`.${domain}`)) ? 0 : 2;
    if (/^(info|hello|bookings?|book|enquir|contact|office|admin|reservations|sales|tours?|kiaora)/.test(e.email)) s -= 0.5;
    if (/^(noreply|no-reply|donotreply|webmaster|privacy|accounts?|jobs|careers|media|press)@/.test(e.email)) s += 3;
    return s;
  };
  return [...emails].sort((a, b) => score(a) - score(b));
}

const REFUSAL: RegExp[] = [
  /\bno unsolicited\b/i,
  /\bunsolicited (?:e-?mails?|messages?|marketing|commercial|sales|offers?|proposals?|approaches|contact|advertising)\b[^.\n]{0,80}\b(?:not (?:welcome|accepted|wanted)|will (?:not )?be (?:ignored|deleted|blocked|reported|marked as spam|treated as spam)|prohibited|is not permitted|are not permitted)\b/i,
  /\b(?:do not|don'?t|please do not|please don'?t) (?:send|e-?mail|contact|message)(?: us| me)?(?: with)?(?: any)? (?:unsolicited|marketing|sales|seo|spam|promotional|advertising)/i,
  /\b(?:we|i) (?:do not|don'?t) (?:accept|want|welcome|respond to|reply to) (?:any )?(?:unsolicited|marketing|sales|seo|promotional)/i,
  /\bno (?:marketing|sales|seo|promotional|advertising) (?:e-?mails?|calls?|messages?|enquiries|inquiries|pitches)\b/i,
  /\bno solicit(?:ations?|ing|ors)\b/i,
  /\bno cold[- ]?call/i,
  /\bnot (?:for|to be used for) (?:unsolicited|marketing|sales|commercial)(?: (?:commercial|marketing|electronic|sales))? (?:e-?mails?|messages?|purposes|approaches)\b/i,
  /\bunsolicited electronic messages act\b[^.\n]{0,160}\b(?:do(?:es)? not consent|not consent|no consent|must not)\b/i,
];
/** The business promising its own customers it will not spam them is not a refusal. */
const OWN_PROMISE = /\bwe (?:will|do|shall|would) (?:not|never) (?:send|share|sell|spam)\b|\bwe won'?t (?:send|spam)\b|\byou will not receive\b|\bwe (?:hate|dislike) spam\b/i;

export function refusalStatement(text: string): string | null {
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    if (sentence.length > 600 || OWN_PROMISE.test(sentence)) continue;
    if (REFUSAL.some((re) => re.test(sentence))) return sentence.replace(/\s+/g, ' ').trim().slice(0, 400);
  }
  return null;
}

const CONTACT_LINK = /\b(contact|about|our story|team|meet|who we are|the crew|our people|the owners|your hosts?|your guides?|find us|get in touch)\b/i;

export function contactPageUrls(home: PageCapture, max = 5): string[] {
  const picked = new Map<string, number>();
  for (const l of home.links) {
    const url = normalizeUrl(l.href);
    if (!url || !sameSite(url, home.finalUrl) || /\.(pdf|jpe?g|png)(\?|$)/i.test(url)) continue;
    const key = url.replace(/\/$/, '');
    if (key === home.finalUrl.replace(/\/$/, '')) continue;
    const hay = `${l.text} ${decodeURIComponent(new URL(url).pathname).replace(/[-_/+]+/g, ' ')}`;
    if (!CONTACT_LINK.test(hay)) continue;
    const rank = /\bcontact|get in touch|find us\b/i.test(hay) ? 0 : /\babout|story|who we are\b/i.test(hay) ? 1 : 2;
    if (!picked.has(key) || picked.get(key)! > rank) picked.set(key, rank);
  }
  return [...picked.entries()].sort((a, b) => a[1] - b[1]).slice(0, max).map(([u]) => u);
}

export type Role = 'owner' | 'second';

export interface FoundPerson {
  name: string;
  role: Role;
  title: string;
  quote: string;
  sourceUrl: string;
  how: 'pattern' | 'model';
}

const OWNER_WORDS = 'owner[- ]operators?|co[- ]?owners?|owners?|founders?|co[- ]?founders?|managing directors?|directors?|operators?|skippers?|captains?|hosts?|proprietors?|principals?';
const SECOND_WORDS = 'general managers?|operations managers?|office managers?|business managers?|managers?|head guides?|lead guides?|senior guides?|office administrators?|operations|office|bookings? managers?';
const NAME = "(?:[A-Z][a-zāēīōū]+(?:['’-][A-Z]?[a-zāēīōū]+)?)";
const FULL_NAME = `${NAME}(?: (?:${NAME}|[A-Z]\\.|van|de|der|von|Mc${NAME}|Mac${NAME})){0,3}`;
const NOT_NAMES = new Set(['The', 'Our', 'We', 'Your', 'New', 'Zealand', 'Bay', 'Lake', 'Island', 'Islands', 'North', 'South', 'East', 'West', 'Mount', 'Port', 'Te', 'Aotearoa', 'Meet', 'About', 'Contact', 'Welcome', 'Home', 'Tours', 'Tour', 'Charters', 'Kayaks', 'Book', 'Booking', 'Bookings', 'Fishing', 'Cruises', 'Adventures', 'Company', 'Limited', 'Ltd', 'Team', 'Crew', 'Guide', 'Guides', 'Owner', 'Owners', 'Manager', 'Director', 'Skipper', 'Captain', 'Host', 'Hosts', 'Operator', 'Founder', 'Qualmark', 'Gold', 'Silver', 'Tripadvisor', 'Google', 'Facebook', 'Instagram', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'Kia', 'Ora', 'Haere', 'Mai', 'Nau', 'Read', 'More', 'Click', 'Here', 'Please', 'Since', 'With', 'Your', 'Their', 'This', 'That', 'They', 'She', 'He', 'It', 'In', 'On', 'At', 'For', 'From', 'As', 'And', 'Or', 'But', 'If', 'When', 'After', 'Before', 'Local', 'Family', 'Marine', 'Coastal', 'Nature', 'Eco', 'Wild', 'Sea', 'Ocean', 'River', 'Harbour', 'Sound', 'Sounds', 'Peninsula', 'Coast', 'National', 'Park', 'Department', 'Conservation', 'Māori', 'Maori', 'Pākehā', 'English', 'Kiwi', 'Mr', 'Mrs', 'Ms', 'Dr', 'Sir', 'Dame']);

const STRICT_NAME = new RegExp(`^${FULL_NAME}$`);

function cleanName(raw: string): string | null {
  // The patterns ignore case so that roles match however they are written. Names must still be capitalised.
  if (!STRICT_NAME.test(raw.trim())) return null;
  const words = raw.trim().split(/\s+/).filter((w) => !['Mr', 'Mrs', 'Ms', 'Dr'].includes(w));
  if (!words.length || words.length > 4) return null;
  if (words.some((w) => NOT_NAMES.has(w))) return null;
  if (words[0]!.length < 2) return null;
  return words.join(' ');
}

function roleOf(title: string): Role | null {
  const t = title.toLowerCase();
  if (/co[- ]?owner/.test(t)) return 'second';
  if (new RegExp(`\\b(?:${OWNER_WORDS})\\b`).test(t)) return 'owner';
  if (new RegExp(`\\b(?:${SECOND_WORDS})\\b`).test(t)) return 'second';
  return null;
}

/** Names with a role, read from visible text by fixed patterns. Every result carries the sentence it came from. */
export function peopleByPattern(page: PageCapture): FoundPerson[] {
  const out = new Map<string, FoundPerson>();
  const WORD = new RegExp(`^(?:${NAME}|[A-Z]\\.|van|de|der|von)$`);
  // Because case is ignored, a match can run on into ordinary words. Keep only the capitalised run next to the role.
  const capitalised = (part: string, nameFirst: boolean): string => {
    const words = part.trim().split(/\s+/);
    const run: string[] = [];
    for (const w of nameFirst ? words : [...words].reverse()) {
      if (!WORD.test(w)) break;
      run.push(w);
    }
    return (nameFirst ? run : run.reverse()).join(' ');
  };
  const add = (rawName: string, title: string, quote: string, nameFirst = false) => {
    const role = roleOf(title);
    if (!role) return;
    const parts = rawName.split(/\s+(?:and|&)\s+|\s*,\s*/);
    for (const [idx, part] of parts.entries()) {
      // Where the name follows the role, only the last part can run on into the sentence, and the reverse.
      const name = cleanName(capitalised(part, nameFirst ? true : idx < parts.length - 1 ? true : false) || part) ?? cleanName(capitalised(part, true));
      if (!name) continue;
      const key = `${name.toLowerCase()}|${role}`;
      if (!out.has(key)) out.set(key, { name, role, title: title.trim(), quote: quote.replace(/\s+/g, ' ').trim().slice(0, 300), sourceUrl: page.finalUrl, how: 'pattern' });
    }
  };
  const roles = `${OWNER_WORDS}|${SECOND_WORDS}`;
  const pair = `${FULL_NAME}(?:(?: and | & |, )${FULL_NAME})?`;
  const patterns: RegExp[] = [
    // "Ross Taylor, owner and skipper" / "Dora and Chad - owners"
    new RegExp(`(${pair})\\s*(?:,|-|–|—|\\||:|\\()\\s*(?:the |our |your |is the |is our |are the |are our )?((?:${roles})(?:(?: and | & |/|, )(?:${roles}))?)\\b`, 'gi'),
    // "Owner: Ross Taylor" / "your skipper Ross" / "owned and operated by Ross and Frances"
    new RegExp(`\\b((?:${roles})|owned (?:and (?:operated|run) )?by|operated by|run by|founded by|hosted by|skippered by|managed by)\\s*(?:,|:|-|–|is|are)?\\s+(${pair})`, 'gi'),
    // "Ross is the owner"
    new RegExp(`(${pair}) (?:is|are|has been|have been) (?:the |our |your |now the )?((?:${roles}))\\b`, 'gi'),
    // "I'm Ross, your skipper" / "We are Dora and Chad, the owners"
    new RegExp(`\\b(?:I'?m|I am|my name is|we are|we're) (${pair}),? (?:the |your |and I am the |and I'?m the )?((?:${roles}))\\b`, 'gi'),
  ];
  for (const block of page.blocks) {
    if (block.inNav || block.text.length > 1500) continue;
    for (const [i, re] of patterns.entries()) {
      for (const m of block.text.matchAll(re)) {
        const sentence = block.text.slice(Math.max(0, block.text.lastIndexOf('.', m.index ?? 0) + 1), Math.min(block.text.length, (m.index ?? 0) + m[0].length + 80));
        if (i === 1) {
          const lead = m[1]!.toLowerCase();
          const title = /by$/.test(lead) ? (/(managed)/.test(lead) ? 'manager' : 'owner') : m[1]!;
          add(m[2]!, title, sentence, true);
        } else if (i === 3) add(m[1]!, m[2]!, sentence, true);
        else add(m[1]!, m[2]!, sentence);
      }
    }
  }
  // Team cards: a name on one line with a role on the next.
  for (let i = 0; i + 1 < page.blocks.length; i++) {
    const a = page.blocks[i]!;
    const b = page.blocks[i + 1]!;
    if (a.text.length > 40 || b.text.length > 60 || a.inNav || b.inNav) continue;
    if (STRICT_NAME.test(a.text.trim()) && new RegExp(`^(?:${roles})(?:(?: and | & |/|, )(?:${roles}))?$`, 'i').test(b.text.trim())) add(a.text.trim(), b.text.trim(), `${a.text.trim()} / ${b.text.trim()}`);
  }
  return [...out.values()];
}

const OWNERISH = new RegExp(`\\b(?:${OWNER_WORDS}|owned|family[- ](?:owned|run|business)|husband and wife|couple)\\b`, 'i');

/** Ambiguous means the pages talk about owners but the patterns found none, or found more than two. */
export function isAmbiguous(people: FoundPerson[], pages: PageCapture[]): boolean {
  const owners = people.filter((p) => p.role === 'owner');
  if (owners.length > 2) return true;
  return owners.length === 0 && pages.some((p) => OWNERISH.test(p.text));
}

export interface ModelPerson {
  name: string;
  role: string;
  quote: string;
}

/** Keeps a model's answer only when its quote is in the page text word for word and names the person. */
export function acceptModelPeople(candidates: ModelPerson[], text: string, sourceUrl: string): FoundPerson[] {
  const flat = text.replace(/\s+/g, ' ');
  const out: FoundPerson[] = [];
  for (const c of candidates) {
    if (!c || typeof c.name !== 'string' || typeof c.quote !== 'string' || typeof c.role !== 'string') continue;
    const quote = c.quote.replace(/\s+/g, ' ').trim();
    if (quote.length < 8 || !flat.includes(quote)) continue;
    const first = c.name.trim().split(/\s+/)[0] ?? '';
    if (!first || !quote.includes(first)) continue;
    const name = cleanName(c.name);
    const role = roleOf(c.role);
    if (!name || !role) continue;
    out.push({ name, role, title: c.role, quote: quote.slice(0, 300), sourceUrl, how: 'model' });
  }
  return out;
}

export type PeopleModel = (text: string, businessName: string) => Promise<{ people: ModelPerson[]; inputTokens: number; outputTokens: number; model: string }>;

/** The cheapest OpenAI model in prices.json, asked for JSON only. */
export function openAiPeopleModel(): PeopleModel | null {
  const key = env().OPENAI_API_KEY;
  if (!key) return null;
  const prices = loadPrices();
  const model = Object.entries(prices.providers.openai.models).sort((a, b) => a[1].input_per_mtok - b[1].input_per_mtok)[0]![0];
  return async (text, businessName) => {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model,
        max_output_tokens: 2000,
        instructions:
          'You read text copied from a small business website and list the people it names as owner or as second in command. Reply with JSON only: {"people":[{"name":"...","role":"...","quote":"..."}]}. role is one of: owner, founder, director, operator, skipper, host, co-owner, manager, general manager, head guide, office, operations. quote must be copied exactly, character for character, from the text and must contain the name and show the role. If the text names nobody in such a role, reply {"people":[]}. Never guess.',
        input: `Business: ${businessName}\n\nText:\n${text.slice(0, 12_000)}`,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI returned ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const data = (await res.json()) as { output?: { type: string; content?: { type: string; text?: string }[] }[]; usage?: { input_tokens: number; output_tokens: number } };
    const textOut = (data.output ?? []).flatMap((o) => (o.type === 'message' ? (o.content ?? []) : [])).map((c) => c.text ?? '').join('');
    let people: ModelPerson[];
    try {
      const json = JSON.parse(textOut.slice(textOut.indexOf('{'), textOut.lastIndexOf('}') + 1)) as { people?: ModelPerson[] };
      people = Array.isArray(json.people) ? json.people : [];
    } catch {
      people = [];
    }
    return { people, inputTokens: data.usage?.input_tokens ?? 0, outputTokens: data.usage?.output_tokens ?? 0, model };
  };
}

export interface ContactsResult {
  businessId: number;
  pages: string[];
  emails: FoundEmail[];
  phones: string[];
  contactFormUrl: string | null;
  people: FoundPerson[];
  refusal: string | null;
  outcome: 'ok' | 'no_contact' | 'no_unsolicited_statement' | 'unreachable' | 'robots_blocked';
}

export interface ContactsOptions {
  model?: PeopleModel | null;
  log?: (l: string) => void;
}

/** Reads up to six pages of one business and records published contacts, people and the consent check. */
export async function findContacts(db: Db, polite: Polite, renderer: Renderer, business: Business, opts: ContactsOptions = {}): Promise<ContactsResult> {
  const result: ContactsResult = { businessId: business.id, pages: [], emails: [], phones: [], contactFormUrl: null, people: [], refusal: null, outcome: 'ok' };
  const homeUrl = normalizeUrl(business.website!) ?? business.website!;
  const home = await renderer.render({ url: homeUrl, viewport: 'desktop' });
  if (home.blocked) return finish(db, business, { ...result, outcome: 'robots_blocked' });
  if (!home.ok) return finish(db, business, { ...result, outcome: 'unreachable' });

  const pages: PageCapture[] = [home];
  for (const url of contactPageUrls(home, 5)) {
    const cap = await renderer.render({ url, viewport: 'desktop' });
    if (cap.ok) pages.push(cap);
  }
  result.pages = pages.map((p) => p.finalUrl);

  const domain = domainOf(home.finalUrl);
  result.emails = rankEmails(pages.flatMap(publishedEmails).filter((e, i, a) => a.findIndex((x) => x.email === e.email) === i), domain);
  result.phones = [...new Set(pages.flatMap((p) => [...phonesIn(p.text), ...p.links.filter((l) => l.visible && /^tel:\S/i.test(l.raw)).map((l) => decodeURIComponent(l.raw.slice(4)))]).map((x) => x.trim()))].slice(0, 4);
  const formPage = pages.find((p) => /contact|enquir|inquir|get-in-touch|book/i.test(p.finalUrl) && p.controls.some((c) => c.tag === 'form' && c.hasEmailField && c.fields >= 2)) ?? pages.find((p) => p.controls.some((c) => c.tag === 'form' && c.hasEmailField && c.fields >= 3));
  result.contactFormUrl = formPage?.finalUrl ?? null;

  for (const p of pages) {
    const r = refusalStatement(p.text);
    if (r) {
      result.refusal = r;
      break;
    }
  }

  const peoplePages = pages.filter((p) => p === home || /about|story|team|meet|who|crew|people|owner|host|guide/i.test(p.finalUrl));
  let people = peoplePages.flatMap(peopleByPattern);
  if (opts.model && isAmbiguous(people, peoplePages)) {
    const text = peoplePages.map((p) => p.blocks.filter((b) => !b.inNav).map((b) => b.text).join('\n')).join('\n\n').slice(0, 12_000);
    try {
      const prices = loadPrices();
      const cheapest = Object.entries(prices.providers.openai.models).sort((a, b) => a[1].input_per_mtok - b[1].input_per_mtok)[0]![0];
      const estimate = tokenCost(prices, 'openai', cheapest, { inputTokens: Math.ceil(text.length / 3) + 300, outputTokens: 1500 });
      guard(db, `owner names for ${business.slug}`, estimate, { quiet: true });
      const answer = await opts.model(text, business.name);
      const actual = tokenCost(prices, 'openai', answer.model, { inputTokens: answer.inputTokens, outputTokens: answer.outputTokens });
      record(db, { provider: 'openai', operation: 'owner_names', units: { model: answer.model, input_tokens: answer.inputTokens, output_tokens: answer.outputTokens, business: business.slug }, estimatedUsd: estimate, actualUsd: actual });
      const accepted = acceptModelPeople(answer.people, text, peoplePages[peoplePages.length - 1]!.finalUrl).map((p) => ({ ...p, sourceUrl: peoplePages.find((pg) => pg.text.replace(/\s+/g, ' ').includes(p.quote))?.finalUrl ?? p.sourceUrl }));
      // When the model was asked because the patterns found too many owners, its checked answer replaces them.
      if (accepted.length) people = [...people.filter((p) => p.role !== 'owner' || accepted.every((a) => a.role !== 'owner')), ...accepted];
    } catch (e) {
      opts.log?.(`  owner lookup skipped for ${business.slug}: ${(e as Error).message.slice(0, 140)}`);
    }
  }
  const seen = new Set<string>();
  result.people = people.filter((p) => (seen.has(p.name.toLowerCase()) ? false : (seen.add(p.name.toLowerCase()), true))).slice(0, 6);

  if (result.refusal) result.outcome = 'no_unsolicited_statement';
  else if (!result.emails.length && !result.contactFormUrl) result.outcome = 'no_contact';
  return finish(db, business, result);
}

function finish(db: Db, business: Business, r: ContactsResult): ContactsResult {
  const at = utcIso();
  db.transaction(() => {
    db.prepare("DELETE FROM contacts WHERE business_id = ? AND (source_quote IS NULL OR source_quote NOT LIKE 'input research:%')").run(business.id);
    const ins = db.prepare('INSERT INTO contacts (business_id, role, name, name_confirmed, title, email, email_source_url, phone, contact_form_url, source_url, source_quote, captured_at) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const [i, e] of r.emails.slice(0, 4).entries()) ins.run(business.id, 'general', null, null, e.email, e.sourceUrl, i === 0 ? (r.phones[0] ?? null) : null, null, e.sourceUrl, `published as ${e.how === 'text' ? 'visible text' : e.how === 'mailto' ? 'a visible email link' : 'a Cloudflare-protected email link'}`, at);
    if (!r.emails.length && (r.contactFormUrl || r.phones.length)) ins.run(business.id, 'general', null, null, null, null, r.phones[0] ?? null, r.contactFormUrl, r.contactFormUrl ?? r.pages[0] ?? null, r.contactFormUrl ? 'contact form' : 'phone only', at);
    else if (r.contactFormUrl) db.prepare("UPDATE contacts SET contact_form_url = ? WHERE business_id = ? AND role = 'general' AND id = (SELECT MIN(id) FROM contacts WHERE business_id = ? AND role = 'general' AND captured_at = ?)").run(r.contactFormUrl, business.id, business.id, at);
    for (const p of r.people) ins.run(business.id, p.role, p.name, p.title, null, null, null, null, p.sourceUrl, p.quote, at);
    db.prepare(
      `INSERT INTO consent_checks (business_id, pages_checked, no_unsolicited_statement_found, quote, checked_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (business_id) DO UPDATE SET pages_checked = excluded.pages_checked, no_unsolicited_statement_found = excluded.no_unsolicited_statement_found, quote = excluded.quote, checked_at = excluded.checked_at`,
    ).run(business.id, JSON.stringify(r.pages), r.refusal ? 1 : 0, r.refusal, at);
    if (r.outcome === 'no_unsolicited_statement') db.prepare("UPDATE businesses SET status = 'excluded', exclude_reason = 'no_unsolicited_statement' WHERE id = ?").run(business.id);
    else if (r.outcome === 'no_contact') db.prepare("UPDATE businesses SET status = 'excluded', exclude_reason = 'no_published_email (and no contact form)' WHERE id = ?").run(business.id);
    else if (r.outcome === 'unreachable') db.prepare("UPDATE businesses SET status = 'excluded', exclude_reason = 'site_does_not_load (in a browser)' WHERE id = ?").run(business.id);
    else if (r.outcome === 'robots_blocked') db.prepare("UPDATE businesses SET status = 'excluded', exclude_reason = 'robots_blocked (robots.txt disallows the homepage)' WHERE id = ?").run(business.id);
  })();
  return r;
}

/** True when a business has passed the consent check and has an email or a contact form. */
export function contactReady(db: Db, businessId: number): boolean {
  const consent = db.prepare('SELECT no_unsolicited_statement_found AS refused FROM consent_checks WHERE business_id = ?').get(businessId) as { refused: number } | undefined;
  if (!consent || consent.refused) return false;
  return !!db.prepare('SELECT 1 FROM contacts WHERE business_id = ? AND (email IS NOT NULL OR contact_form_url IS NOT NULL)').get(businessId);
}

/** A name as it may be used: in full once confirmed, otherwise the first name only. */
export function usableName(name: string | null, confirmed: boolean | number): string {
  if (!name) return '';
  return confirmed ? name : (name.trim().split(/\s+/)[0] ?? '');
}
