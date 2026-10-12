import type { ComponentType } from 'react';
import type { PageData } from '@/lib/data';

export interface Design {
  Demo: ComponentType<{ data: PageData }>;
  /** Font files to fetch first, by file stem under /fonts. */
  fonts: string[];
  /** How wide the top photo is drawn, so the browser fetches the right size first. */
  heroSizes: string;
}
