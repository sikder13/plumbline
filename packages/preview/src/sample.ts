/**
 * A sample page: a homepage shown to the owner as it would stand on its own. It carries none of the
 * frame our other pages do (no strip, no tabs, no price, none of our actions), and it is static: the
 * framework's scripts are taken out after the build, so only the page's own small scripts run, and it
 * carries its own fonts, so its folder can be copied into any built site by itself.
 */

/** A script the page writes for itself. Every other script in a sample page is the framework's and is removed. */
export const PAGE_SCRIPT = 'data-page';

const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
const LINK = /<link\b[^>]*>/g;

/**
 * Makes a built sample page static and self-contained. Takes out the framework's scripts and the
 * shared stylesheets (a sample page sets all of its styles inline), keeps the scripts the page marks
 * as its own, and points its fonts at a folder of its own. Returns the page and the font files it names.
 */
export function staticSample(html: string, path: string): { html: string; fonts: string[] } {
  const fonts = new Set<string>();
  const local = (file: string) => {
    fonts.add(file);
    return `/demo/${path}/fonts/${file}`;
  };
  const out = html
    .replace(SCRIPT, (whole, attrs: string) => (new RegExp(`\\s${PAGE_SCRIPT}(?:[\\s=>]|$)`).test(attrs) ? whole : ''))
    .replace(LINK, (tag) => {
      const rel = /\srel="([^"]*)"/.exec(tag)?.[1] ?? '';
      const href = /\shref="([^"]*)"/.exec(tag)?.[1] ?? '';
      if (rel === 'modulepreload' || (rel === 'preload' && /\sas="(?:script|style)"/.test(tag))) return '';
      if (rel === 'stylesheet' && href.includes('/_next/')) return '';
      // The framework's icon is not in the page's folder.
      if (/(?:^|\s)icon(?:\s|$)/.test(rel) && href.includes('/_next/')) return '';
      return tag.replace(/\/demo\/fonts\/([\w.-]+\.woff2)/g, (_, file: string) => local(file));
    })
    .replace(/url\(\/demo\/fonts\/([\w.-]+\.woff2)\)/g, (_, file: string) => `url(${local(file)})`);
  return { html: out, fonts: [...fonts].sort() };
}

export interface VisitScriptOptions {
  token: string;
  endpoint: string;
  /** The query flag and storage key that mark a browser as ours (OWN_VISITS in apps/previews/lib/offer.ts). */
  own: { param: string; key: string };
}

/**
 * The visit report of a sample page, as a script of its own, on the same terms as the report every
 * other page sends (components/Visits.tsx): our own browsers, and visitors who ask not to be tracked,
 * send nothing; the query flag is taken out of the address; and one view is sent only once the page
 * has been on screen for three seconds. As on our other pages, the count starts at the first touch,
 * scroll or key, or two seconds after the page has loaded, so a link scanner opening the address never
 * reaches it. A link marked `data-visit="cta_click"` reports a click, once.
 */
export function visitScript({ token, endpoint, own }: VisitScriptOptions): string {
  const j = JSON.stringify;
  return `(function(){var T=${j(token)},E=${j(endpoint)},P=${j(own.param)},K=${j(own.key)},own=false;
try{var u=new URL(location.href),f=u.searchParams.get(P);if(f!==null){if(f==='0')localStorage.removeItem(K);else localStorage.setItem(K,'1');u.searchParams.delete(P);history.replaceState(history.state,'',u.pathname+u.search+u.hash)}own=localStorage.getItem(K)==='1'}catch(e){own=false}
if(own||navigator.globalPrivacyControl||navigator.doNotTrack==='1')return;
var sent={},ready=false,waiting=[],shown=0,since=null,timer,started=false,ev=['pointerdown','touchstart','keydown','scroll'];
function send(k){if(sent[k])return;sent[k]=1;try{fetch(E,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token:T,kind:k}),keepalive:true,credentials:'omit'}).catch(function(){})}catch(e){}}
function report(k){if(ready)send(k);else if(waiting.indexOf(k)<0)waiting.push(k)}
function done(){ready=true;send('view');waiting.forEach(send);waiting=[];document.removeEventListener('visibilitychange',change)}
function arm(){timer=setTimeout(done,Math.max(0,3000-shown))}
function change(){clearTimeout(timer);if(document.visibilityState==='visible'){since=performance.now();arm()}else if(since!==null){shown+=performance.now()-since;since=null}}
function start(){if(started)return;started=true;ev.forEach(function(n){removeEventListener(n,start,true)});document.addEventListener('visibilitychange',change);if(document.visibilityState==='visible'){since=performance.now();arm()}}
ev.forEach(function(n){addEventListener(n,start,{capture:true,passive:true})});
function later(){setTimeout(start,2000)}if(document.readyState==='complete')later();else addEventListener('load',later);
document.addEventListener('click',function(e){var t=e.target,el=t&&t.closest&&t.closest('[data-visit]');if(el&&el.getAttribute('data-visit')==='cta_click')report('cta_click')})})();`;
}
