import { z } from 'zod';
import type { Viewport } from './config.ts';

export const Tier = z.enum(['measured', 'rule', 'judgment']);
export type Tier = z.infer<typeof Tier>;

export const FindingStatus = z.enum(['candidate', 'reproduced', 'approved', 'rejected', 'resolved']);
export type FindingStatus = z.infer<typeof FindingStatus>;

export const BusinessStatus = z.enum(['candidate', 'qualified', 'excluded', 'audited']);
export type BusinessStatus = z.infer<typeof BusinessStatus>;

export interface Business {
  id: number;
  slug: string;
  name: string;
  website: string | null;
  domain: string | null;
  country: string;
  region: string | null;
  town: string | null;
  lat: number | null;
  lng: number | null;
  pack: string;
  activity: string | null;
  source: 'seed20' | 'master76' | 'discovered';
  google_place_id: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  google_business_status: string | null;
  phone: string | null;
  listing_urls: string;
  seed: string | null;
  status: BusinessStatus;
  exclude_reason: string | null;
  notes: string | null;
  created_at: string;
}

/** Box in CSS pixels, relative to the top left of the document. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ElementRef {
  selector: string;
  box: Box;
  text: string;
}

export type PageRole = 'homepage' | 'inner';

export interface EvidenceSpec {
  kind: 'element' | 'page' | 'ai';
  url?: string;
  viewport?: Viewport;
  selector?: string;
  box?: Box;
  excerpt: string;
}

export interface CandidateFinding {
  checkId: string;
  /** Stable across runs for the same problem, so run B can be matched to run A. */
  fingerprint: string;
  title: string;
  pageUrl: string | null;
  viewport: Viewport | null;
  where: 'homepage_mobile' | 'homepage_desktop' | 'inner';
  detail: Record<string, unknown>;
  evidence: EvidenceSpec[];
}
