import type { ComponentType } from 'react';
import type { PageData } from '@/lib/data';

export interface Design {
  Demo: ComponentType<{ data: PageData }>;
  /** Font files to fetch first, by file stem under /fonts. A design built from a recipe reads them from the page. */
  fonts: string[] | ((data: PageData) => string[]);
  /** How wide the top photo is drawn, so the browser fetches the right size first. */
  heroSizes: string | ((data: PageData) => string);
}
