import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from 'playwright';
import type { AxeViolation } from './types.ts';

/** Serious and critical axe violations on the live page, with a box for the first few nodes. */
export async function runAxe(page: Page): Promise<AxeViolation[]> {
  const results = await new AxeBuilder({ page }).analyze();
  const out: AxeViolation[] = [];
  for (const v of results.violations) {
    if (v.impact !== 'serious' && v.impact !== 'critical') continue;
    const nodes: AxeViolation['nodes'] = [];
    for (const node of v.nodes.slice(0, 3)) {
      const target = node.target.map(String).join(' ');
      let box: AxeViolation['nodes'][number]['box'] = null;
      try {
        const b = await page.locator(String(node.target[0])).first().boundingBox({ timeout: 1000 });
        if (b) {
          const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
          box = { x: Math.round(b.x + scroll.x), y: Math.round(b.y + scroll.y), w: Math.round(b.width), h: Math.round(b.height) };
        }
      } catch {
        // A node that cannot be located keeps a null box.
      }
      nodes.push({ target, html: node.html.slice(0, 300), box, summary: (node.failureSummary ?? '').slice(0, 300) });
    }
    out.push({ id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, nodes, nodeCount: v.nodes.length });
  }
  return out;
}
