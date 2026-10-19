/** Booking engines and booking platforms a Book Direct lead may already pay for, known by the host they send a visitor to. */
export interface Engine {
  name: string;
  /** own: the business's own engine. platform: a marketplace that sells for them (Bookme). ota: an online travel agent. */
  kind: 'own' | 'platform' | 'ota';
  host: RegExp;
}

export const ENGINES: Engine[] = [
  // Accommodation
  { name: 'Seekom', kind: 'own', host: /(^|\.)seekom\.com$/ },
  { name: 'STAAH', kind: 'own', host: /(^|\.)staah\.(net|com)$/ },
  { name: 'Little Hotelier', kind: 'own', host: /(^|\.)(littlehotelier\.com|thebookingbutton\.com(\.au)?|direct-book\.com)$/ },
  { name: 'SiteMinder', kind: 'own', host: /(^|\.)(siteminder\.com|book-directonline\.com|bookdirectonline\.com)$/ },
  { name: 'Preno', kind: 'own', host: /(^|\.)(preno\.com|prenohq\.com)$/ },
  { name: 'ResBook', kind: 'own', host: /(^|\.)resbook\.(net|com|co\.nz)$/ },
  { name: 'RMS', kind: 'own', host: /(^|\.)rmscloud\.com$/ },
  { name: 'Newbook', kind: 'own', host: /(^|\.)newbook\.(cloud|com\.au)$/ },
  { name: 'ResOnline', kind: 'own', host: /(^|\.)resonline\.com$/ },
  { name: 'Cloudbeds', kind: 'own', host: /(^|\.)cloudbeds\.com$/ },
  { name: 'Mews', kind: 'own', host: /(^|\.)mews\.(com|li)$/ },
  { name: 'Beds24', kind: 'own', host: /(^|\.)beds24\.com$/ },
  { name: 'Lodgify', kind: 'own', host: /(^|\.)lodgify\.com$/ },
  { name: 'eviivo', kind: 'own', host: /(^|\.)eviivo\.com$/ },
  { name: 'Sirvoy', kind: 'own', host: /(^|\.)sirvoy\.com$/ },
  { name: 'Webroomz', kind: 'own', host: /(^|\.)webroomz\.com$/ },
  { name: 'Bookeasy', kind: 'own', host: /(^|\.)bookeasy\.com\.au$/ },
  { name: 'RoomRaccoon', kind: 'own', host: /(^|\.)roomraccoon\.(com|app)$/ },
  { name: 'Smoobu', kind: 'own', host: /(^|\.)smoobu\.com$/ },
  { name: 'Hostaway', kind: 'own', host: /(^|\.)hostaway\.com$/ },
  { name: 'Guesty', kind: 'own', host: /(^|\.)guesty\.com$/ },
  { name: 'Bookit', kind: 'own', host: /(^|\.)bookit\.co\.nz$/ },
  { name: 'Checkfront', kind: 'own', host: /(^|\.)checkfront\.(com|co\.uk)$/ },
  { name: 'Rezdy', kind: 'own', host: /(^|\.)rezdy\.com$/ },
  { name: 'FareHarbor', kind: 'own', host: /(^|\.)fareharbor\.com$/ },
  { name: 'Bookeo', kind: 'own', host: /(^|\.)bookeo\.com$/ },
  { name: 'Rezexpert', kind: 'own', host: /(^|\.)rezexpert\.com$/ },
  // Allied health and appointments
  { name: 'Cliniko', kind: 'own', host: /(^|\.)cliniko\.com$/ },
  { name: 'Halaxy', kind: 'own', host: /(^|\.)halaxy\.com$/ },
  { name: 'Noterro', kind: 'own', host: /(^|\.)noterro\.com$/ },
  { name: 'Gentu', kind: 'own', host: /(^|\.)gentu\.(co\.nz|com|app|health)$/ },
  { name: 'Gensolve', kind: 'own', host: /(^|\.)gensolve\.(com|co\.nz|net)$/ },
  { name: 'Nookal', kind: 'own', host: /(^|\.)nookal\.com$/ },
  { name: 'Jane', kind: 'own', host: /(^|\.)janeapp\.(com|co\.uk)$/ },
  { name: 'Power Diary', kind: 'own', host: /(^|\.)(powerdiary\.com|zandahealth\.com)$/ },
  { name: 'Splose', kind: 'own', host: /(^|\.)splose\.com$/ },
  { name: 'Coreplus', kind: 'own', host: /(^|\.)coreplus\.com\.au$/ },
  { name: 'HotDoc', kind: 'own', host: /(^|\.)hotdoc\.com\.au$/ },
  { name: 'Timely', kind: 'own', host: /(^|\.)gettimely\.com$/ },
  { name: 'Fresha', kind: 'own', host: /(^|\.)fresha\.com$/ },
  { name: 'Mindbody', kind: 'own', host: /(^|\.)(mindbodyonline\.com|mindbody\.io)$/ },
  { name: 'SimplyBook.me', kind: 'own', host: /(^|\.)simplybook\.(me|it|cc|asia)$/ },
  { name: 'Setmore', kind: 'own', host: /(^|\.)setmore\.com$/ },
  { name: 'Acuity', kind: 'own', host: /(^|\.)(acuityscheduling\.com|as\.me)$/ },
  { name: 'Squarespace Scheduling', kind: 'own', host: /(^|\.)squarespacescheduling\.com$/ },
  { name: 'Calendly', kind: 'own', host: /(^|\.)calendly\.com$/ },
  { name: 'Square Appointments', kind: 'own', host: /(^|\.)(squareup\.com|square\.site|book\.squareup\.com)$/ },
  { name: 'Bookwhen', kind: 'own', host: /(^|\.)bookwhen\.com$/ },
  // Marketplaces
  { name: 'Bookme', kind: 'platform', host: /(^|\.)bookme\.co\.nz$/ },
  // Online travel agents
  { name: 'Booking.com', kind: 'ota', host: /(^|\.)booking\.com$/ },
  { name: 'Expedia', kind: 'ota', host: /(^|\.)expedia\.(com|co\.nz|com\.au)$/ },
  { name: 'Agoda', kind: 'ota', host: /(^|\.)agoda\.com$/ },
  { name: 'Airbnb', kind: 'ota', host: /(^|\.)airbnb\.(com|co\.nz|com\.au)$/ },
  { name: 'Hotels.com', kind: 'ota', host: /(^|\.)hotels\.com$/ },
];

export function engineOf(url: string, base?: string): Engine | null {
  let host = '';
  try {
    host = new URL(url, base).hostname.toLowerCase();
  } catch {
    return null;
  }
  return ENGINES.find((e) => e.host.test(host)) ?? null;
}

/** Link words that ask a visitor to book: Book, Book now, Book online, Check availability, Book appointment, Reserve. */
export const BOOK_WORDS = /^\W*(?:book(?:\s+(?:now|online|here|today|direct|your\s+\w+|an?\s+\w+|a\s+room|appointment|in))?|reserve(?:\s+now)?|check\s+(?:availability|rates)|(?:make\s+an?\s+)?(?:booking|reservation|appointment)s?|online\s+booking|book\s+appointment|availability|bookings?)\W*$/i;
const BOOK_ANYWHERE = /\b(?:book now|book online|book here|book direct|check availability|book (?:an |your )?appointment|make a (?:booking|reservation)|online booking|book a room|book your stay|reserve now)\b/i;

/** Whether short link words are a Book control. */
export function isBookWords(text: string): boolean {
  const t = text.replace(/[\ue000-\uf8ff\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim();
  if (!t || t.split(' ').length > 6) return false;
  return BOOK_WORDS.test(t) || BOOK_ANYWHERE.test(t);
}
