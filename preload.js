'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('maptrail', {
  startCrawl: (cfg) => ipcRenderer.invoke('crawl:start', cfg),
  cancelCrawl: () => ipcRenderer.invoke('crawl:cancel'),
  exportFiles: (opts) => ipcRenderer.invoke('export:files', opts),
  listHistory: () => ipcRenderer.invoke('history:list'),
  loadCrawl: (id) => ipcRenderer.invoke('history:load', id),
  deleteCrawl: (id) => ipcRenderer.invoke('history:delete', id),
  onPage: (cb) => ipcRenderer.on('crawl:page', (_e, page) => cb(page)),
  onProgress: (cb) => ipcRenderer.on('crawl:progress', (_e, p) => cb(p)),
  onDemoFill: (cb) => ipcRenderer.on('demo-fill', () => cb()),
});
