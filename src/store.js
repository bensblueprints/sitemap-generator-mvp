'use strict';
/**
 * Crawl history store. Uses node:sqlite (built into Node 22.13+/24, no native builds).
 * Falls back to a JSON file store with the same API if node:sqlite is unavailable.
 */
const fs = require('fs');
const path = require('path');

function createStore(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  try {
    const { DatabaseSync } = require('node:sqlite');
    return sqliteStore(new DatabaseSync(path.join(dataDir, 'maptrail.db')));
  } catch {
    return jsonStore(path.join(dataDir, 'maptrail-crawls.json'));
  }
}

function sqliteStore(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS crawls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      page_count INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      crawl_id INTEGER NOT NULL REFERENCES crawls(id),
      url TEXT NOT NULL,
      status INTEGER,
      depth INTEGER,
      title TEXT,
      meta_desc TEXT,
      h1 TEXT,
      word_count INTEGER,
      canonical TEXT,
      noindex INTEGER,
      content_type TEXT,
      last_mod TEXT,
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_pages_crawl ON pages(crawl_id);
  `);

  return {
    backend: 'sqlite',
    saveCrawl(result) {
      const ins = db.prepare('INSERT INTO crawls (url, started_at, finished_at, page_count) VALUES (?, ?, ?, ?)');
      const { lastInsertRowid } = ins.run(result.startUrl, result.startedAt, result.finishedAt, result.pages.length);
      const crawlId = Number(lastInsertRowid);
      const insPage = db.prepare(
        'INSERT INTO pages (crawl_id, url, status, depth, title, meta_desc, h1, word_count, canonical, noindex, content_type, last_mod, error) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'
      );
      for (const p of result.pages) {
        insPage.run(crawlId, p.url, p.status, p.depth, p.title, p.metaDesc, p.h1, p.wordCount, p.canonical, p.noindex ? 1 : 0, p.contentType, p.lastMod, p.error);
      }
      return crawlId;
    },
    listCrawls() {
      return db.prepare('SELECT id, url, started_at AS startedAt, finished_at AS finishedAt, page_count AS pageCount FROM crawls ORDER BY id DESC').all();
    },
    loadCrawl(id) {
      const crawl = db.prepare('SELECT id, url, started_at AS startedAt, finished_at AS finishedAt FROM crawls WHERE id = ?').get(id);
      if (!crawl) return null;
      const pages = db
        .prepare('SELECT url, status, depth, title, meta_desc AS metaDesc, h1, word_count AS wordCount, canonical, noindex, content_type AS contentType, last_mod AS lastMod, error FROM pages WHERE crawl_id = ?')
        .all(id)
        .map((p) => ({ ...p, noindex: !!p.noindex, metaDescLength: (p.metaDesc || '').length }));
      return { startUrl: crawl.url, startedAt: crawl.startedAt, finishedAt: crawl.finishedAt, pages };
    },
    deleteCrawl(id) {
      db.prepare('DELETE FROM pages WHERE crawl_id = ?').run(id);
      db.prepare('DELETE FROM crawls WHERE id = ?').run(id);
    },
    close() { db.close(); },
  };
}

function jsonStore(file) {
  const read = () => {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { nextId: 1, crawls: [] }; }
  };
  const write = (data) => fs.writeFileSync(file, JSON.stringify(data));
  return {
    backend: 'json',
    saveCrawl(result) {
      const data = read();
      const id = data.nextId++;
      data.crawls.unshift({ id, url: result.startUrl, startedAt: result.startedAt, finishedAt: result.finishedAt, pageCount: result.pages.length, pages: result.pages });
      write(data);
      return id;
    },
    listCrawls() {
      return read().crawls.map(({ id, url, startedAt, finishedAt, pageCount }) => ({ id, url, startedAt, finishedAt, pageCount }));
    },
    loadCrawl(id) {
      const c = read().crawls.find((c) => c.id === id);
      return c ? { startUrl: c.url, startedAt: c.startedAt, finishedAt: c.finishedAt, pages: c.pages } : null;
    },
    deleteCrawl(id) {
      const data = read();
      data.crawls = data.crawls.filter((c) => c.id !== id);
      write(data);
    },
    close() {},
  };
}

module.exports = { createStore };
