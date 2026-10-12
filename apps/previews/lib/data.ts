import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { PageData, Picture } from '@plumbline/preview/types';

export type { FindingCard, PageData, Picture, SecondCheck, Strength } from '@plumbline/preview/types';

/** Where `plumb preview build` writes the page data. Nothing under it is in the repository. */
const DATA_DIR = process.env.PREVIEWS_DATA ? resolve(process.env.PREVIEWS_DATA) : resolve(process.cwd(), '..', '..', 'previews', 'out', 'data');

export function allPages(): PageData[] {
  if (!existsSync(DATA_DIR)) return [];
  return readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8')) as PageData);
}

export function pageByPath(path: string): PageData {
  const page = allPages().find((p) => p.path === path);
  if (!page) throw new Error(`no preview page at ${path}`);
  return page;
}

/** A photo named in the content file. A missing one stops the build, so no page ships with a hole. */
export function pic(data: PageData, key: string): Picture {
  const p = data.images[key];
  if (!p) throw new Error(`${data.slug}: the content file names no image "${key}"`);
  return p;
}
