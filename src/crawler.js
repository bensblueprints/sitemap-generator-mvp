'use strict';
/**
 * Maptrail crawler — pure Node, no Electron dependency.
 * Crawls a site breadth-first with a concurrency pool, collecting SEO data per page.
 */
const cheerio = require('cheerio');

const DEFAULTS = {
  maxDepth: 5,
  maxPages: 500,
  concurrency: 5,
  include: [], // array of substrings or /regex/ strings; empty = include all
  exclude: [],
  userAgent: 'Maptrail/1.0 (+https://github.com/bensblueprints/sitemap-generator)',
  timeoutMs: 15000,
};

function toMatcher(pattern) {
  if (pattern instanceof RegExp) return (u) => pattern.test(u);
  const s = String(pattern).trim();
  if (!s) return null;
  if (s.length > 2 && s.startsWith('/') && s.endsWith('/')) {
    try {
      const re = new RegExp(s.slice(1, -1));
      return (u) => re.test(u);
    } catch {
      return (u) => u.includes(s);
    }
  }
  return (u) => u.includes(s);
}

function normalizeUrl(raw, base) {
  let u;
  try {
    u = new URL(raw, base);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  u.hash = '';
  // Normalize trailing default ports
  return u.href;
}

function countWords(text) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return 0;
  return t.split(' ').length;
}

function extractPageData(html, pageUrl) {
  const $ = cheerio.load(html);
  $('script, style, noscript, template').remove();
  const title = ($('title').first().text() || '').trim();
  const metaDesc = ($('meta[name="description"]').attr('content') || '').trim();
  const canonical = ($('link[rel="canonical"]').attr('href') || '').trim();
  const robots = ($('meta[name="robots"]').attr('content') || '').toLowerCase();
  const noindex = robots.includes('noindex');
  const h1 = ($('h1').first().text() || '').replace(/\s+/g, ' ').trim();
  const wordCount = countWords($('body').text() || '');
  const links = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const norm = normalizeUrl(href, pageUrl);
    if (norm) links.push(norm);
  });
  return { title, metaDesc, canonical, noindex, h1, wordCount, links };
}

/**
 * Crawl a site.
 * @param {string} startUrl
 * @param {object} opts { maxDepth, maxPages, concurrency, include, exclude, onPage(page), onProgress({crawled,queued}), signal }
 * @returns {Promise<{startUrl, pages: Array, startedAt, finishedAt, aborted}>}
 */
async function crawl(startUrl, opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const start = normalizeUrl(startUrl);
  if (!start) throw new Error(`Invalid start URL: ${startUrl}`);
  const origin = new URL(start).origin;
  const includeMatchers = (cfg.include || []).map(toMatcher).filter(Boolean);
  const excludeMatchers = (cfg.exclude || []).map(toMatcher).filter(Boolean);

  const allowed = (url) => {
    if (!url.startsWith(origin)) return false;
    if (excludeMatchers.some((m) => m(url))) return false;
    if (includeMatchers.length && url !== start && !includeMatchers.some((m) => m(url))) return false;
    return true;
  };

  const seen = new Set([start]);
  const queue = [{ url: start, depth: 0 }];
  const pages = [];
  const startedAt = new Date().toISOString();
  let aborted = false;
  let active = 0;

  async function fetchPage(url) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), cfg.timeoutMs);
    if (cfg.signal) cfg.signal.addEventListener('abort', () => ac.abort(), { once: true });
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: ac.signal,
        headers: { 'user-agent': cfg.userAgent, accept: 'text/html,*/*' },
      });
      const contentType = res.headers.get('content-type') || '';
      const lastMod = res.headers.get('last-modified') || null;
      const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml');
      const body = isHtml ? await res.text() : '';
      return { status: res.status, contentType, isHtml, body, lastMod, finalUrl: res.url || url };
    } finally {
      clearTimeout(timer);
    }
  }

  await new Promise((resolve) => {
    const pump = () => {
      if (cfg.signal && cfg.signal.aborted) aborted = true;
      if (aborted || (queue.length === 0 && active === 0) || pages.length >= cfg.maxPages) {
        if (active === 0) resolve();
        return;
      }
      while (!aborted && active < cfg.concurrency && queue.length > 0 && pages.length + active < cfg.maxPages) {
        const item = queue.shift();
        active++;
        (async () => {
          let page = {
            url: item.url,
            depth: item.depth,
            status: 0,
            title: '',
            metaDesc: '',
            metaDescLength: 0,
            canonical: '',
            noindex: false,
            h1: '',
            wordCount: 0,
            contentType: '',
            lastMod: null,
            error: null,
          };
          try {
            const res = await fetchPage(item.url);
            page.status = res.status;
            page.contentType = res.contentType;
            page.lastMod = res.lastMod;
            if (res.isHtml && res.status >= 200 && res.status < 300) {
              const data = extractPageData(res.body, item.url);
              Object.assign(page, {
                title: data.title,
                metaDesc: data.metaDesc,
                metaDescLength: data.metaDesc.length,
                canonical: data.canonical,
                noindex: data.noindex,
                h1: data.h1,
                wordCount: data.wordCount,
              });
              if (item.depth < cfg.maxDepth) {
                for (const link of data.links) {
                  if (!seen.has(link) && allowed(link) && seen.size < cfg.maxPages * 4) {
                    seen.add(link);
                    queue.push({ url: link, depth: item.depth + 1 });
                  }
                }
              }
            }
          } catch (err) {
            page.error = err && err.name === 'AbortError' ? 'timeout/aborted' : String(err && err.message || err);
          }
          pages.push(page);
          if (cfg.onPage) { try { cfg.onPage(page); } catch {} }
          if (cfg.onProgress) { try { cfg.onProgress({ crawled: pages.length, queued: queue.length }); } catch {} }
          active--;
          pump();
        })();
      }
    };
    pump();
  });

  return { startUrl: start, pages, startedAt, finishedAt: new Date().toISOString(), aborted };
}

module.exports = { crawl, normalizeUrl, extractPageData, DEFAULTS };
