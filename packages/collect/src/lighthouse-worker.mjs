// One Lighthouse run in its own process. Lighthouse keeps timing marks in process-wide state, so two
// runs in one process corrupt each other. The parent starts this file once per run and reads one line
// of JSON from standard output.
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

const [url, formFactor, chromePath, userAgent] = process.argv.slice(2);

const DESKTOP = {
  formFactor: 'desktop',
  screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false },
  throttling: { rttMs: 40, throughputKbps: 10 * 1024, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 },
};
const MOBILE = {
  formFactor: 'mobile',
  screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 3, disabled: false },
};

let chrome;
let out;
try {
  chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'], logLevel: 'silent' });
  const result = await lighthouse(
    url,
    { port: chrome.port, output: 'json', logLevel: 'silent', onlyCategories: ['performance'], maxWaitForLoad: 45000 },
    { extends: 'lighthouse:default', settings: { ...(formFactor === 'desktop' ? DESKTOP : MOBILE), emulatedUserAgent: userAgent, onlyCategories: ['performance'] } },
  );
  const lhr = result && result.lhr;
  if (!lhr) out = { error: 'no result' };
  else if (lhr.runtimeError && lhr.runtimeError.message) out = { error: String(lhr.runtimeError.message).slice(0, 200), version: lhr.lighthouseVersion };
  else {
    const score = lhr.categories.performance ? lhr.categories.performance.score : null;
    const items = (lhr.audits['network-requests'] && lhr.audits['network-requests'].details && lhr.audits['network-requests'].details.items) || [];
    out = {
      version: lhr.lighthouseVersion,
      performance: score === null || score === undefined ? null : Math.round(score * 100),
      lcpMs: lhr.audits['largest-contentful-paint'] ? (lhr.audits['largest-contentful-paint'].numericValue ?? null) : null,
      cls: lhr.audits['cumulative-layout-shift'] ? (lhr.audits['cumulative-layout-shift'].numericValue ?? null) : null,
      tbtMs: lhr.audits['total-blocking-time'] ? (lhr.audits['total-blocking-time'].numericValue ?? null) : null,
      images: items
        .filter((it) => it.resourceType === 'Image' && it.url && typeof it.transferSize === 'number')
        .map((it) => ({ url: it.url, bytes: it.transferSize }))
        .sort((a, b) => b.bytes - a.bytes)
        .slice(0, 5),
    };
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
