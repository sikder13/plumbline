import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { nzTime, paths, type Db } from '@plumbline/core';
import { BASE_PATH, buildPicture, ensureToken } from './build.ts';
import { contentDir, previewPaths } from './paths.ts';
import type { ContentFile, PageData, Picture } from './types.ts';

/**
 * An Open Sign page: a new business with a Google profile and no website. There is no audit, so
 * there are no findings: the second tab carries our price. Its photographs are the ones saved from
 * the business's own Google profile under data/<campaign>/assets/<slug>/.
 */
export interface OpenSignContent extends Pick<ContentFile, 'images' | 'look' | 'brief' | 'demo'> {
  design: string;
  /** The business name as the page shows it: their trading name on Google. */
  name: string;
}

export function openSignContent(slug: string): OpenSignContent {
  const file = join(contentDir(slug), 'content.json');
  if (!existsSync(file)) throw new Error(`${file} does not exist`);
  return JSON.parse(readFileSync(file, 'utf8')) as OpenSignContent;
}

/** Gathers what one Open Sign page shows and prepares its photographs. Nothing is written to the repository. */
export async function buildOpenSignPage(db: Db, campaign: string, slug: string, opts: { replyEmail: string; now?: Date }): Promise<PageData> {
  const content = openSignContent(slug);
  const token = ensureToken(db, slug);
  const path = `${slug}-${token}`;
  const media = join(paths.data, campaign, 'assets', slug);
  const out = join(previewPaths.out, 'assets', path, 'img');
  const images: Record<string, Picture> = {};
  for (const [key, spec] of Object.entries(content.images)) images[key] = await buildPicture(join(media, spec.file), out, `${BASE_PATH}/${path}/img`, key, spec);
  const data: PageData = {
    slug,
    token,
    path,
    name: content.name,
    domain: '',
    design: content.design,
    demo: content.demo,
    images,
    video: null,
    findings: [],
    strengths: [],
    rating: null,
    secondCheck: null,
    reply: { email: opts.replyEmail, subject: `${content.name} website`, call: '' },
    builtAtNz: nzTime(opts.now ?? new Date()),
    campaign,
  };
  mkdirSync(previewPaths.data, { recursive: true });
  writeFileSync(join(previewPaths.data, `${slug}.json`), JSON.stringify(data, null, 2));
  return data;
}
