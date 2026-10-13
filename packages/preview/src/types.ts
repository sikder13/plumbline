/** The data one preview page is built from. Written by `plumb preview build`, read by apps/previews. */

export interface Picture {
  width: number;
  height: number;
  alt: string;
  /** One entry per format, best first. */
  sources: { type: string; srcset: string }[];
  fallback: string;
  /** Average colour of the image, shown while it loads. */
  colour: string;
  /** CSS object-position for crops, when the content file sets one. */
  position: string | null;
}

export interface FindingCard {
  check: string;
  title: string;
  /** The library's impact sentence with any outside statistic removed. */
  sentence: string;
  fix: string;
  measuredNz: string;
  pageUrl: string | null;
  /** The evidence: a screenshot with the problem boxed, and what was seen in words. */
  shots: { image: { src: string; width: number; height: number } | null; seen: string | null }[];
  score: number;
}

export interface Strength {
  text: string;
  source: string;
}

export interface SecondCheck {
  score: string | null;
  aiReadiness: string | null;
  crawlerAccess: string | null;
  findings: string[];
}

export interface PageData {
  slug: string;
  token: string;
  /** The path the page is served at: slug and token. */
  path: string;
  name: string;
  domain: string;
  design: string;
  /** Design specific content, taken as it is from the content file. */
  demo: unknown;
  images: Record<string, Picture>;
  /** A short silent loop of the business's own footage for the top of the page, where it has any. */
  video: string | null;
  findings: FindingCard[];
  strengths: Strength[];
  /** The stored Google rating, for a design that shows it. */
  rating: { value: string; count: number } | null;
  secondCheck: SecondCheck | null;
  reply: { email: string; subject: string; call: string };
  builtAtNz: string;
}

/** previews/content/<slug>/content.json */
export interface ContentFile {
  design: string;
  /** The business name as it should read on the page, when the stored name carries extra words. */
  name?: string;
  images: Record<string, { file: string; alt: string; widths?: number[]; position?: string; crop?: { left: number; top: number; width: number; height: number } }>;
  /** A short loop cut from the business's own film, under previews/content/<slug>/. */
  video?: { file: string };
  /** Awards and certifications shown on the business's own site, each with the page it is shown on. */
  strengths?: Strength[];
  demo: unknown;
}
