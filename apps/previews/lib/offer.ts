/** Our own offer, shown the same on every page. */

export const SENDER = 'Nahl Technologies';

export const PACKAGES = [
  {
    name: 'Rebuild',
    price: 'NZ$1,490',
    text: 'Full redesign of up to 8 pages, built for phones first and fast to load. Your booking system connected to a button on every page. Prices shown. Every issue above fixed. Set up so Google and AI tools can read your business clearly. Live in 14 days.',
    note: null,
  },
  {
    name: 'Rebuild and Bookings',
    price: 'NZ$2,490',
    text: 'Everything in Rebuild, plus enquiry forms that reach your phone, an instant reply to every enquiry, a pre-trip information email, a review request after each trip, and a tidy-up of your Google Business Profile.',
    note: null,
  },
  {
    name: 'Always On',
    price: 'NZ$3,990',
    text: 'Everything above, plus a 24/7 chat assistant trained on your own tours, prices and FAQs that answers visitors and passes enquiries to you, and a monthly report for 3 months on how AI tools describe your business.',
    note: 'Needs Care at NZ$129 a month, because the assistant runs every day.',
  },
];

export const CARE = 'Included free for the first 3 months with every package. After that it is optional at NZ$79 a month: hosting, security updates, backups, uptime monitoring and small edits. You own your site either way.';

export const PAYMENT = [
  '30% deposit to start.',
  'Within 7 days you see the full design of every page. If you don’t like it, the whole deposit is refunded.',
  'The remaining 70% is due only when you approve the finished site, before it goes live on your domain.',
];

export const WHO = 'Nahl Technologies Inc., a small team led by Udaay Sikder, building websites and AI tools for small businesses.';
export const TOOLS = 'We found these issues with our own audit tools, Plumbline and Crawlmouse.';
export const TOOLS_LINK = { label: 'crawlmouse.com', href: 'https://crawlmouse.com' };

export const REMOVAL = 'This private demo is removed after 30 days, or sooner on request.';

export const SENDER_SITE = 'https://nahltech.com';

/** The link in the strip at the top that opens the second tab. */
export const FOUND_LINK = 'See what we found';

export function demoNote(domain: string): string {
  return `Demo built from content on ${domain}. Not the official site.`;
}

export const REPLY_BUTTONS = { email: 'Reply by email', call: 'Book a 15 minute call' };

/** On an engine page the first way to answer is a reply to the email the link came in, set as a line of its own. */
export const REPLY_LINE = { label: 'Reply to Udaay’s email', sub: 'The link to this page came in an email from Udaay. A reply there reaches him directly, and is the quickest way to ask anything.' };

/** The designs that are page engines, rendered from a settings file. */
export const ENGINE_DESIGNS = new Set(['fishing', 'paddle', 'stay', 'physio']);

/** Every page lives under this path on the main site. */
export const BASE = '/demo';

/** Where a page reports that a person opened it. */
export const VISIT_ENDPOINT = 'https://nahltech.com/api/demo-visit';

/**
 * Our own visits. Opening any page once with ?nahl-own=1 marks this browser as ours, and from then
 * on no page reports anything from it; ?nahl-own=0 clears the mark. Every check we run sets it.
 */
export const OWN_VISITS = { param: 'nahl-own', key: 'nahl-own' };
