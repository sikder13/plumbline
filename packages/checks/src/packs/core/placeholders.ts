import type { Phrase } from '@plumbline/collect';

/** Strings that only appear when template or filler text was never replaced. */
export const PLACEHOLDERS: Phrase[] = [
  { label: 'lorem ipsum', re: /\blorem ipsum\b/i },
  { label: 'lorem ipsum', re: /\bdolor sit amet\b/i },
  { label: 'lorem ipsum', re: /\bconsectetur adipisc?ing\b/i },
  { label: 'template text', re: /\b(?:your|insert|add|enter|type|put) (?:your )?(?:text|content|title|heading|headline|description|tagline|caption|copy) (?:here|goes here)\b/i },
  { label: 'template text', re: /\b(?:text|content|title|subtitle|heading|headline|description|caption) goes here\b/i },
  { label: 'template text', re: /\bclick here to (?:edit|add)(?: your)?(?: own)? (?:text|content)\b/i },
  { label: 'template text', re: /\bi'?m a paragraph\b/i },
  { label: 'template text', re: /\bthis is a paragraph\. (?:double )?click\b/i },
  { label: 'template text', re: /\bdouble[- ]click (?:here |me )?to (?:edit|add)\b/i },
  { label: 'template text', re: /\bedit or remove this text\b/i },
  { label: 'template text', re: /\byour content goes here\b/i },
  { label: 'template text', re: /\bplaceholder text\b/i },
  { label: 'template text', re: /\bsample (?:text|page|post)\b/i },
  { label: 'template text', re: /\bthis is (?:a|an) (?:sample|example|demo) (?:page|post|text)\b/i },
  { label: 'template text', re: /\bjust another wordpress site\b/i },
  { label: 'template text', re: /\bwelcome to wordpress\. this is your first post\b/i },
  { label: 'template text', re: /\bhello world!/i },
  { label: 'template text', re: /\b(?:your (?:company|business) name|company name here|your name here|your logo here)\b/i },
  { label: 'template text', re: /\bdescribe your (?:image|product|service|business)\b/i },
  { label: 'template text', re: /\badd a (?:description|caption|title) here\b/i },
  { label: 'template text', re: /\buntitled(?: page| section)?$/i },
  { label: 'template token', re: /\{\{\s*[\w.]+\s*\}\}/ },
  { label: 'template token', re: /%%[a-z_]{3,}%%/i },
  { label: 'template token', re: /\[(?:contact-form-7|gallery|caption|et_pb_[a-z_]+|vc_[a-z_]+|shortcode)[^\]]*\]/i },
  { label: 'stray text', re: /\b([a-z])\1{9,}[a-z]*\b/i },
];

/** Text that is nothing but a file name, shown where a heading or link label should be. */
export const FILE_NAME_ONLY = /^[\w+.-]{1,60}\.(?:php|html?|aspx?|jsp)$/i;
