import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, paths } from '@plumbline/core';

const root = join(ROOT, 'previews');

/** Everything under previews/ is local only: business content, generated pages and review screenshots. */
export const previewPaths = {
  root,
  content: join(root, 'content'),
  out: join(root, 'out'),
  data: join(root, 'out', 'data'),
  site: join(root, 'out', 'site'),
  review: join(root, 'review'),
  app: join(ROOT, 'apps', 'previews'),
};

export function contentDir(slug: string): string {
  return join(previewPaths.content, slug);
}

/** The Crawlmouse summary for a business, if UD has supplied one. */
export function crawlmouseFile(slug: string): string | null {
  const candidates = [join(paths.inputs, 'crawlmouse', `${slug}.json`), join(paths.inputs, 'crawlmouse-inputs', 'crawlmouse', `${slug}.json`)];
  return candidates.find((f) => existsSync(f)) ?? null;
}
