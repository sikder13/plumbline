// One Lighthouse run of a preview page in its own process, measuring performance, accessibility and best practices
// under Lighthouse's standard phone settings. The page's visit report is blocked, so a measurement
// is never counted as a visit. Prints one line of JSON.
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const [url, chromePath] = process.argv.slice(2);

let chrome;
let out;
try {
  chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'], logLevel: 'silent' });
  const result = await lighthouse(url, { port: chrome.port, output: 'json', logLevel: 'silent', onlyCategories: ['performance', 'accessibility', 'best-practices'], maxWaitForLoad: 45000, blockedUrlPatterns: ['*/api/demo-visit*'] });
  const lhr = result && result.lhr;
  if (!lhr) out = { error: 'no result' };
  else if (lhr.runtimeError && lhr.runtimeError.message) out = { error: String(lhr.runtimeError.message).slice(0, 200) };
  else {
    const score = (c) => (lhr.categories[c] && typeof lhr.categories[c].score === 'number' ? Math.round(lhr.categories[c].score * 100) : null);
    const value = (a) => (lhr.audits[a] ? (lhr.audits[a].numericValue ?? null) : null);
    const failed = Object.values(lhr.audits)
      .filter((a) => a.score !== null && a.score < 1 && lhr.categories.accessibility.auditRefs.some((r) => r.id === a.id && r.weight > 0))
      .map((a) => a.id);
    const failedBest = Object.values(lhr.audits)
      .filter((a) => a.score !== null && a.score < 1 && lhr.categories['best-practices'].auditRefs.some((r) => r.id === a.id && r.weight > 0))
      .map((a) => a.id);
    // The element the largest paint was of, as Lighthouse names it.
    // Lighthouse 12 names it in an audit of its own; 13 within its breakdown of the largest paint.
    const nodeIn = (v) => {
      if (!v || typeof v !== 'object') return null;
      if (v.type === 'node' && typeof v.selector === 'string') return v;
      for (const x of Object.values(v)) {
        const found = nodeIn(x);
        if (found) return found;
      }
      return null;
    };
    const lcpNode = nodeIn(lhr.audits['largest-contentful-paint-element']?.details) ?? nodeIn(lhr.audits['lcp-breakdown-insight']?.details);
    const lcpElement = lcpNode ? { selector: lcpNode.selector ?? '', snippet: String(lcpNode.snippet ?? '').slice(0, 200) } : null;
    const consoleErrors = (lhr.audits['errors-in-console']?.details?.items ?? []).map((i) => String(i.description ?? i.source ?? '').slice(0, 160));
    out = { consoleErrors, version: lhr.lighthouseVersion, performance: score('performance'), accessibility: score('accessibility'), bestPractices: score('best-practices'), lcpMs: value('largest-contentful-paint'), cls: value('cumulative-layout-shift'), tbtMs: value('total-blocking-time'), failedAccessibility: failed, failedBestPractices: failedBest, lcpElement };
  }
} catch (e) {
  out = { error: String((e && e.message) || e).slice(0, 200) };
} finally {
  try {
    if (chrome) await chrome.kill();
  } catch {
    // The browser may already be gone.
  }
}
process.stdout.write(`\nPLUMBLINE_LH ${JSON.stringify(out)}\n`);
process.exit(0);
