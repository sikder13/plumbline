import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import sharp, { type OverlayOptions, type Sharp } from 'sharp';
import { config, type Box, type Viewport } from '@plumbline/core';
import { tileCssWidth, type PageCapture } from '@plumbline/render';

export interface CropResult {
  file: string;
  width: number;
  height: number;
  /** The boxed area inside the saved image, in image pixels. */
  boxInImage: { x: number; y: number; w: number; h: number } | null;
}

const MAX_REGION_HEIGHT = 1500;

interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The part of the page to show: the element plus context on every side, kept inside what was captured. */
export function regionFor(box: Box, pageWidth: number, capturedHeight: number, context: number = config.evidence.contextPx): Region | null {
  const left = Math.max(0, Math.floor(box.x - context));
  const top = Math.max(0, Math.floor(box.y - context));
  const right = Math.min(pageWidth, Math.ceil(box.x + box.w + context));
  let bottom = Math.min(capturedHeight, Math.ceil(box.y + box.h + context));
  if (bottom - top > MAX_REGION_HEIGHT) bottom = top + MAX_REGION_HEIGHT;
  if (right - left < 2 || bottom - top < 2) return null;
  return { x: left, y: top, w: right - left, h: bottom - top };
}

async function compose(capture: PageCapture, region: Region): Promise<{ image: Sharp; scale: number } | null> {
  if (!capture.dir || !capture.tiles.length) return null;
  const cssWidth = tileCssWidth(capture.viewport, capture.layout);
  const first = await sharp(join(capture.dir, capture.tiles[0]!.file)).metadata();
  if (!first.width) return null;
  const scale = first.width / cssWidth;
  const outW = Math.round(region.w * scale);
  const outH = Math.round(region.h * scale);
  const parts: OverlayOptions[] = [];
  for (const tile of capture.tiles) {
    const top = Math.max(region.y, tile.y);
    const bottom = Math.min(region.y + region.h, tile.y + tile.h);
    if (bottom <= top) continue;
    const meta = await sharp(join(capture.dir, tile.file)).metadata();
    const left = Math.min(Math.round(region.x * scale), meta.width! - 1);
    const extract = {
      left,
      top: Math.min(Math.round((top - tile.y) * scale), meta.height! - 1),
      width: Math.max(1, Math.min(outW, meta.width! - left)),
      height: 0,
    };
    extract.height = Math.max(1, Math.min(Math.round((bottom - top) * scale), meta.height! - extract.top));
    parts.push({ input: await sharp(join(capture.dir, tile.file)).extract(extract).toBuffer(), left: 0, top: Math.round((top - region.y) * scale) });
  }
  if (!parts.length) return null;
  const canvas = sharp({ create: { width: outW, height: outH, channels: 3, background: '#ffffff' } }).composite(parts);
  return { image: sharp(await canvas.png().toBuffer()), scale };
}

function maxWidth(viewport: Viewport): number {
  return config.evidence.maxWidth[viewport];
}

/** Crops the screenshot to the element with context and draws the box round it. */
export async function cropElement(capture: PageCapture, box: Box, outFile: string): Promise<CropResult | null> {
  const captured = capture.tiles.reduce((m, t) => Math.max(m, t.y + t.h), 0);
  const region = regionFor(box, tileCssWidth(capture.viewport, capture.layout), captured);
  if (!region) return null;
  const composed = await compose(capture, region);
  if (!composed) return null;
  const srcW = Math.round(region.w * composed.scale);
  const srcH = Math.round(region.h * composed.scale);
  const outW = Math.min(srcW, maxWidth(capture.viewport));
  const k = outW / srcW;
  const outH = Math.max(1, Math.round(srcH * k));
  const stroke = config.evidence.boxPx;
  const bx = Math.max(stroke / 2, (box.x - region.x) * composed.scale * k);
  const by = Math.max(stroke / 2, (box.y - region.y) * composed.scale * k);
  const bw = Math.min(outW - bx - stroke / 2, box.w * composed.scale * k);
  const bh = Math.min(outH - by - stroke / 2, box.h * composed.scale * k);
  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}"><rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${Math.max(1, bw).toFixed(1)}" height="${Math.max(1, bh).toFixed(1)}" fill="none" stroke="${config.evidence.boxColor}" stroke-width="${stroke}"/></svg>`,
  );
  mkdirSync(dirname(outFile), { recursive: true });
  await sharp(await composed.image.resize(outW, outH).toBuffer()).composite([{ input: overlay, left: 0, top: 0 }]).webp({ quality: 82 }).toFile(outFile);
  return { file: outFile, width: outW, height: outH, boxInImage: { x: Math.round(bx), y: Math.round(by), w: Math.round(bw), h: Math.round(bh) } };
}

/** The top of the page as the visitor first sees it, for findings about the page as a whole. */
export async function pageShot(capture: PageCapture, outFile: string, cssHeight = 1400): Promise<CropResult | null> {
  const captured = capture.tiles.reduce((m, t) => Math.max(m, t.y + t.h), 0);
  const cssWidth = tileCssWidth(capture.viewport, capture.layout);
  const region = { x: 0, y: 0, w: cssWidth, h: Math.min(cssHeight, captured) };
  if (region.h < 2) return null;
  const composed = await compose(capture, region);
  if (!composed) return null;
  const srcW = Math.round(region.w * composed.scale);
  const outW = Math.min(srcW, maxWidth(capture.viewport));
  mkdirSync(dirname(outFile), { recursive: true });
  const info = await composed.image.resize({ width: outW }).webp({ quality: 80 }).toFile(outFile);
  return { file: outFile, width: info.width, height: info.height, boxInImage: null };
}
