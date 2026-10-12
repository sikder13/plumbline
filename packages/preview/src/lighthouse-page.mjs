// One Lighthouse run of a preview page in its own process, measuring performance and accessibility
// under Lighthouse's standard phone settings. Prints one line of JSON.
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const [url, chromePath] = process.argv.slice(2);

let chrome;
let out;
try {
  chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'], logLevel: 'silent' });
  const result = await lighthouse(url, { port: chrome.port, output: 'json', logLevel: 'silent', onlyCategories: ['performance', 'accessibility'], maxWaitForLoad: 45000 });
  const lhr = result && result.lhr;
  if (!lhr) out = { error: 'no result' };
  else if (lhr.runtimeError && lhr.runtimeError.message) out = { error: String(lhr.runtimeError.message).slice(0, 200) };
  else {
    const score = (c) => (lhr.categories[c] && typeof lhr.categories[c].score === 'number' ? Math.round(lhr.categories[c].score * 100) : null);
    const value = (a) => (lhr.audits[a] ? (lhr.audits[a].numericValue ?? null) : null);
    const failed = Object.values(lhr.audits)
      .filter((a) => a.score !== null && a.score < 1 && lhr.categories.accessibility.auditRefs.some((r) => r.id === a.id && r.weight > 0))
      .map((a) => a.id);
    out = { version: lhr.lighthouseVersion, performance: score('performance'), accessibility: score('accessibility'), lcpMs: value('largest-contentful-paint'), cls: value('cumulative-layout-shift'), tbtMs: value('total-blocking-time'), failedAccessibility: failed };
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
