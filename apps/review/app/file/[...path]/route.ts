import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { db, paths } from '@plumbline/core';

const TYPES: Record<string, string> = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', gif: 'image/gif' };

/** Serves one evidence image by its evidence id. Only files inside data/evidence are ever read. */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const id = Number(path[0]);
  const row = Number.isInteger(id) ? (db().prepare('SELECT path FROM evidence WHERE id = ?').get(id) as { path: string | null } | undefined) : undefined;
  if (!row?.path) return new Response('Not found', { status: 404 });
  // The data folder can be reached by more than one path, so both sides are compared as the real path on disk.
  let file: string;
  try {
    file = realpathSync(resolve(row.path));
    if (!file.startsWith(realpathSync(resolve(paths.evidence)) + sep)) return new Response('Not found', { status: 404 });
  } catch {
    return new Response('Not found', { status: 404 });
  }
  try {
    const ext = file.split('.').pop()!.toLowerCase();
    return new Response(new Uint8Array(await readFile(file)), { headers: { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'no-store' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
