'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { crawl } = require('./src/crawler');
const { buildSitemapFiles, buildSitemapHtml, buildCsv, indexablePages } = require('./src/sitemap');
const { createStore } = require('./src/store');
const { gateLicense, registerLicenseIpc } = require('./license-gate');

let win = null;
let store = null;
let currentAbort = null;
let lastResult = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1240,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0b0f19',
    title: 'Maptrail',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Screenshot mode for docs: ONETIME_SCREENSHOT=<output path>
  const shot = process.env.ONETIME_SCREENSHOT;
  if (shot) {
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('demo-fill');
      setTimeout(async () => {
        try {
          const img = await win.webContents.capturePage();
          fs.mkdirSync(path.dirname(shot), { recursive: true });
          fs.writeFileSync(shot, img.toPNG());
          console.log('screenshot saved:', shot);
        } catch (e) {
          console.error('screenshot failed:', e);
        }
        app.quit();
      }, 1500);
    });
  }
}

app.whenReady().then(async () => {
  if (!(await gateLicense())) return; // quit already requested
  registerLicenseIpc();
  store = createStore(path.join(app.getPath('userData'), 'data'));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (store) store.close();
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('crawl:start', async (_e, cfg) => {
  if (currentAbort) return { error: 'A crawl is already running' };
  currentAbort = new AbortController();
  try {
    const result = await crawl(cfg.url, {
      maxDepth: Number(cfg.maxDepth) || 5,
      maxPages: Number(cfg.maxPages) || 500,
      include: (cfg.include || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
      exclude: (cfg.exclude || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
      signal: currentAbort.signal,
      onPage: (page) => { if (win && !win.isDestroyed()) win.webContents.send('crawl:page', page); },
      onProgress: (p) => { if (win && !win.isDestroyed()) win.webContents.send('crawl:progress', p); },
    });
    lastResult = result;
    let crawlId = null;
    try { crawlId = store.saveCrawl(result); } catch (e) { console.error('save failed', e); }
    return {
      done: true,
      crawlId,
      aborted: result.aborted,
      total: result.pages.length,
      indexable: indexablePages(result.pages).length,
    };
  } catch (err) {
    return { error: String(err && err.message || err) };
  } finally {
    currentAbort = null;
  }
});

ipcMain.handle('crawl:cancel', () => {
  if (currentAbort) currentAbort.abort();
  return true;
});

ipcMain.handle('export:files', async (_e, opts) => {
  if (!lastResult || !lastResult.pages.length) return { error: 'No crawl loaded. Run or load a crawl first.' };
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Choose export folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (canceled || !filePaths[0]) return { canceled: true };
  const dir = filePaths[0];
  const written = [];
  try {
    if (opts.xml) {
      for (const f of buildSitemapFiles(lastResult.pages, { crawledAt: lastResult.finishedAt })) {
        fs.writeFileSync(path.join(dir, f.filename), f.content, 'utf8');
        written.push(f.filename);
      }
    }
    if (opts.html) {
      fs.writeFileSync(path.join(dir, 'sitemap.html'), buildSitemapHtml(lastResult.pages), 'utf8');
      written.push('sitemap.html');
    }
    if (opts.csv) {
      fs.writeFileSync(path.join(dir, 'crawl-report.csv'), buildCsv(lastResult.pages), 'utf8');
      written.push('crawl-report.csv');
    }
    shell.openPath(dir);
    return { written, dir };
  } catch (err) {
    return { error: String(err && err.message || err) };
  }
});

ipcMain.handle('history:list', () => {
  try { return store.listCrawls(); } catch { return []; }
});

ipcMain.handle('history:load', (_e, id) => {
  const result = store.loadCrawl(id);
  if (!result) return { error: 'Crawl not found' };
  lastResult = result;
  return { startUrl: result.startUrl, startedAt: result.startedAt, pages: result.pages };
});

ipcMain.handle('history:delete', (_e, id) => {
  try { store.deleteCrawl(id); return true; } catch { return false; }
});
