'use strict';
/**
 * Maptrail smoke test — spins up a real local HTTP site fixture, crawls it,
 * generates sitemap.xml / sitemap.html / CSV, and verifies store save/load.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { crawl } = require('../src/crawler');
const { buildSitemapFiles, buildSitemapHtml, buildCsv, indexablePages, priorityForDepth } = require('../src/sitemap');
const { createStore } = require('../src/store');

let passed = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  passed++;
  console.log('  ✓ ' + msg);
}

const SITE = {
  '/': `<html><head><title>Fixture Home</title><meta name="description" content="A small fixture site for Maptrail."><link rel="canonical" href="URL/"></head>
        <body><h1>Home</h1><p>Welcome to the fixture site with some words in the body.</p>
        <a href="/about">About</a> <a href="/blog">Blog</a> <a href="/secret">Secret</a> <a href="/missing">Missing</a>
        <a href="https://external.example.com/x">External</a> <a href="/">Self</a> <a href="/#frag">Frag</a></body></html>`,
  '/about': `<html><head><title>About Us</title><meta name="description" content="About the fixture."></head>
        <body><h1>About</h1><p>One two three four five six seven eight nine ten.</p><a href="/team">Team</a></body></html>`,
  '/blog': `<html><head><title>Blog</title></head><body><h1>Blog</h1><a href="/blog/post-1">Post 1</a><a href="/blog/post-2">Post 2</a></body></html>`,
  '/blog/post-1': `<html><head><title>Post One</title></head><body><p>Deep content page one.</p></body></html>`,
  '/blog/post-2': `<html><head><title>Post Two</title></head><body><p>Deep content page two.</p></body></html>`,
  '/team': `<html><head><title>Team</title></head><body><p>The team page.</p></body></html>`,
  '/secret': `<html><head><title>Secret</title><meta name="robots" content="noindex, nofollow"></head><body><p>Hidden page.</p></body></html>`,
};

async function main() {
  console.log('Maptrail smoke test\n');

  // 1. Fixture HTTP server
  const server = http.createServer((req, res) => {
    const urlPath = req.url.split('?')[0];
    if (urlPath === '/missing') {
      res.writeHead(404, { 'content-type': 'text/html' });
      return res.end('<html><head><title>404</title></head><body>not found</body></html>');
    }
    const body = SITE[urlPath];
    if (!body) {
      res.writeHead(404, { 'content-type': 'text/html' });
      return res.end('nope');
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'last-modified': 'Tue, 07 Jul 2026 10:00:00 GMT' });
    res.end(body.replace(/URL/g, `http://127.0.0.1:${server.address().port}`));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  console.log('Fixture site at ' + base);

  // 2. Crawl it
  const result = await crawl(base + '/', { maxDepth: 5, maxPages: 100, concurrency: 3 });
  ok(result.pages.length === 8, `crawled all 8 pages (7 ok + 1 404), got ${result.pages.length}`);
  const home = result.pages.find((p) => p.url === base + '/');
  ok(home && home.status === 200 && home.title === 'Fixture Home', 'home page has correct status + title');
  ok(home.metaDesc === 'A small fixture site for Maptrail.', 'meta description extracted');
  ok(home.canonical === base + '/', 'canonical extracted');
  ok(home.wordCount > 5, `word count computed (${home.wordCount})`);
  const missing = result.pages.find((p) => p.url === base + '/missing');
  ok(missing && missing.status === 404, '404 page recorded with status 404');
  const secret = result.pages.find((p) => p.url === base + '/secret');
  ok(secret && secret.noindex === true, 'noindex flag detected');
  const post1 = result.pages.find((p) => p.url === base + '/blog/post-1');
  ok(post1 && post1.depth === 2, 'crawl depth tracked (blog post at depth 2)');
  ok(!result.pages.some((p) => p.url.includes('external.example.com')), 'external links not crawled');

  // 3. Depth limit respected
  const shallow = await crawl(base + '/', { maxDepth: 1, maxPages: 100 });
  ok(!shallow.pages.some((p) => p.depth > 1), 'maxDepth=1 stops at depth 1');

  // 4. Exclude patterns
  const excluded = await crawl(base + '/', { maxDepth: 5, maxPages: 100, exclude: ['/blog'] });
  ok(!excluded.pages.some((p) => p.url.includes('/blog')), 'exclude pattern skips /blog');

  // 5. Sitemap XML
  const files = buildSitemapFiles(result.pages, { crawledAt: result.finishedAt });
  ok(files.length === 1 && files[0].filename === 'sitemap.xml', 'single sitemap.xml under 50k URLs');
  const xml = files[0].content;
  ok(xml.startsWith('<?xml version="1.0"'), 'sitemap has XML declaration');
  ok(xml.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'), 'sitemap has correct namespace');
  const locCount = (xml.match(/<loc>/g) || []).length;
  const eligible = indexablePages(result.pages);
  ok(locCount === eligible.length, `sitemap contains exactly the ${eligible.length} indexable pages`);
  ok(!xml.includes('/secret'), 'noindex page excluded from sitemap');
  ok(!xml.includes('/missing'), '404 page excluded from sitemap');
  ok(xml.includes('<lastmod>2026-07-07</lastmod>'), 'lastmod taken from Last-Modified header');
  ok(xml.includes(`<loc>${base}/</loc>`), 'home URL present in sitemap');
  ok(priorityForDepth(0) === '1.0' && priorityForDepth(2) === '0.6' && priorityForDepth(9) === '0.3', 'priority scales with depth, floored at 0.3');

  // 6. 50k split → sitemap index
  const bigPages = Array.from({ length: 60001 }, (_, i) => ({
    url: `${base}/p/${i}`, status: 200, depth: 1, contentType: 'text/html', noindex: false, title: 't', metaDesc: '', wordCount: 1,
  }));
  const bigFiles = buildSitemapFiles(bigPages, { baseUrl: base });
  ok(bigFiles.length === 3 && bigFiles[0].content.includes('<sitemapindex'), '60,001 URLs → sitemap index + 2 chunk files');
  ok((bigFiles[1].content.match(/<url>/g) || []).length === 50000, 'first chunk capped at exactly 50,000 URLs');

  // 7. HTML sitemap + CSV
  const html = buildSitemapHtml(result.pages);
  ok(html.includes('<title>Sitemap') && html.includes('Fixture Home'), 'HTML sitemap renders with page titles');
  const csv = buildCsv(result.pages);
  const csvLines = csv.trim().split('\n');
  ok(csvLines.length === result.pages.length + 1, `CSV has header + ${result.pages.length} rows`);
  ok(csvLines[0].startsWith('url,status,depth,title'), 'CSV header correct');
  ok(csv.includes('/secret') && csv.includes('/missing'), 'CSV report includes noindex + 404 pages');

  // 8. Write real files to disk and re-read
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maptrail-test-'));
  fs.writeFileSync(path.join(outDir, 'sitemap.xml'), xml);
  fs.writeFileSync(path.join(outDir, 'sitemap.html'), html);
  fs.writeFileSync(path.join(outDir, 'crawl-report.csv'), csv);
  ok(fs.statSync(path.join(outDir, 'sitemap.xml')).size > 200, 'sitemap.xml written to disk and non-trivial');

  // 9. Store save/load roundtrip
  const store = createStore(outDir);
  console.log(`  (store backend: ${store.backend})`);
  const id = store.saveCrawl(result);
  const list = store.listCrawls();
  ok(list.length === 1 && list[0].pageCount === result.pages.length, 'crawl saved and listed');
  const loaded = store.loadCrawl(id);
  ok(loaded.pages.length === result.pages.length, 'crawl reloaded with all pages');
  const loadedSecret = loaded.pages.find((p) => p.url === base + '/secret');
  ok(loadedSecret && loadedSecret.noindex === true, 'noindex survives save/load roundtrip');
  store.deleteCrawl(id);
  ok(store.listCrawls().length === 0, 'crawl deleted');
  store.close();

  server.close();
  fs.rmSync(outDir, { recursive: true, force: true });
  console.log(`\nAll ${passed} assertions passed.`);
}

main().catch((err) => {
  console.error('\nSMOKE TEST FAILED:', err);
  process.exit(1);
});
