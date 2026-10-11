import { describe, expect, it } from 'vitest';
import { getCrawlDelay, isAllowedByRobots, outcomeAllows, outcomeFromResponse, parseRobotsTxt } from './robots.ts';

describe('robots.txt parsing', () => {
  it('groups consecutive user-agent lines and starts a new group after a rule', () => {
    const r = parseRobotsTxt('User-agent: a\nUser-agent: b\nDisallow: /x\nUser-agent: c\nDisallow: /y');
    expect(r.rules.a!.disallow).toEqual(['/x']);
    expect(r.rules.b!.disallow).toEqual(['/x']);
    expect(r.rules.c!.disallow).toEqual(['/y']);
  });

  it('survives a BOM, comments and CRLF', () => {
    const r = parseRobotsTxt('﻿User-agent: * # everyone\r\nDisallow: /private # keep out\r\nSitemap: https://e.nz/sitemap.xml\r\n');
    expect(r.rules['*']!.disallow).toEqual(['/private']);
    expect(r.sitemaps).toEqual(['https://e.nz/sitemap.xml']);
  });

  it('treats an empty Disallow as no restriction', () => {
    const r = parseRobotsTxt('User-agent: *\nDisallow:');
    expect(isAllowedByRobots(r, 'PlumblineAudit', '/anything')).toBe(true);
  });

  it('reads crawl-delay for the matching group', () => {
    const r = parseRobotsTxt('User-agent: *\nCrawl-delay: 5\nUser-agent: plumblineaudit\nCrawl-delay: 9');
    expect(getCrawlDelay(r, 'PlumblineAudit')).toBe(9);
    expect(getCrawlDelay(r, 'Other')).toBe(5);
  });
});

describe('robots.txt matching', () => {
  const r = parseRobotsTxt(
    ['User-agent: *', 'Disallow: /wp-admin/', 'Allow: /wp-admin/admin-ajax.php', 'Disallow: /*.pdf$', 'Disallow: /search*results', '', 'User-agent: OAI-SearchBot', 'Disallow: /'].join('\n'),
  );

  it('lets the longest rule win and Allow win a tie', () => {
    expect(isAllowedByRobots(r, 'x', '/wp-admin/options.php')).toBe(false);
    expect(isAllowedByRobots(r, 'x', '/wp-admin/admin-ajax.php')).toBe(true);
    const tie = parseRobotsTxt('User-agent: *\nDisallow: /a\nAllow: /a');
    expect(isAllowedByRobots(tie, 'x', '/a')).toBe(true);
  });

  it('honours * and a trailing $', () => {
    expect(isAllowedByRobots(r, 'x', '/files/menu.pdf')).toBe(false);
    expect(isAllowedByRobots(r, 'x', '/files/menu.pdf?x=1')).toBe(true);
    expect(isAllowedByRobots(r, 'x', '/search/all/results')).toBe(false);
  });

  it('uses a named group in place of the wildcard group', () => {
    expect(isAllowedByRobots(r, 'OAI-SearchBot', '/')).toBe(false);
    expect(isAllowedByRobots(r, 'PerplexityBot', '/')).toBe(true);
  });

  it('always allows robots.txt itself', () => {
    const all = parseRobotsTxt('User-agent: *\nDisallow: /');
    expect(isAllowedByRobots(all, 'x', '/robots.txt')).toBe(true);
    expect(isAllowedByRobots(all, 'x', '/')).toBe(false);
  });

  it('matches a hostile wildcard rule in linear time', () => {
    const evil = parseRobotsTxt(`User-agent: *\nDisallow: /${'*a'.repeat(40)}$`);
    const started = Date.now();
    isAllowedByRobots(evil, 'x', `/${'a'.repeat(5000)}b`);
    expect(Date.now() - started).toBeLessThan(500);
  });
});

describe('robots.txt status handling', () => {
  it('treats 4xx as allow all', () => {
    const o = outcomeFromResponse(404, '');
    expect(o.kind).toBe('allow_all');
    expect(outcomeAllows(o, 'x', 'https://e.nz/')).toBe(true);
  });

  it('treats 5xx and unreachable as disallow all', () => {
    expect(outcomeAllows(outcomeFromResponse(503, ''), 'x', 'https://e.nz/')).toBe(false);
    expect(outcomeAllows(outcomeFromResponse(null, ''), 'x', 'https://e.nz/')).toBe(false);
  });

  it('applies rules on 200', () => {
    const o = outcomeFromResponse(200, 'User-agent: *\nDisallow: /tours/');
    expect(outcomeAllows(o, 'x', 'https://e.nz/tours/kayak?d=1')).toBe(false);
    expect(outcomeAllows(o, 'x', 'https://e.nz/')).toBe(true);
  });
});
