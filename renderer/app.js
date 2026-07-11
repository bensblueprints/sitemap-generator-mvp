'use strict';
const $ = (id) => document.getElementById(id);
const rows = $('rows');
const stats = { crawled: 0, queued: 0, ok: 0, redirect: 0, err: 0, noindex: 0 };
let running = false;

function resetStats() {
  for (const k of Object.keys(stats)) stats[k] = 0;
  renderStats();
}
function renderStats() {
  $('statCrawled').textContent = stats.crawled;
  $('statQueued').textContent = stats.queued;
  $('statOk').textContent = stats.ok;
  $('statRedirect').textContent = stats.redirect;
  $('statErr').textContent = stats.err;
  $('statNoindex').textContent = stats.noindex;
}

function statusBadge(status) {
  const cls = status >= 500 ? 's5' : status >= 400 ? 's4' : status >= 300 ? 's3' : status >= 200 ? 's2' : 's0';
  return `<span class="badge ${cls}">${status || 'ERR'}</span>`;
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function addRow(p) {
  $('empty').style.display = 'none';
  const tr = document.createElement('tr');
  const flags = [];
  if (p.noindex) flags.push('<span class="flag">noindex</span>');
  if (p.error) flags.push(`<span class="flag">${esc(p.error)}</span>`);
  if (p.status >= 200 && p.status < 300 && !p.title && !p.error) flags.push('<span class="flag">no title</span>');
  if (p.metaDescLength === 0 && p.status >= 200 && p.status < 300 && !p.error) flags.push('<span class="flag">no meta</span>');
  tr.innerHTML = `
    <td>${statusBadge(p.status)}</td>
    <td class="url" title="${esc(p.url)}">${esc(p.url)}</td>
    <td class="title" title="${esc(p.title)}">${esc(p.title)}</td>
    <td class="meta" title="${esc(p.metaDesc)}">${p.metaDescLength ? esc(p.metaDesc) : '—'}</td>
    <td>${p.wordCount || 0}</td>
    <td class="meta">${p.canonical ? esc(p.canonical) : '—'}</td>
    <td>${flags.join('') || ''}</td>`;
  rows.appendChild(tr);

  stats.crawled++;
  if (p.status >= 200 && p.status < 300) stats.ok++;
  else if (p.status >= 300 && p.status < 400) stats.redirect++;
  else stats.err++;
  if (p.noindex) stats.noindex++;
  renderStats();
}

window.maptrail.onPage(addRow);
window.maptrail.onProgress((p) => {
  stats.queued = p.queued;
  renderStats();
});

function setRunning(v) {
  running = v;
  $('start').hidden = v;
  $('cancel').hidden = !v;
  $('export').disabled = v;
}

$('start').addEventListener('click', async () => {
  let url = $('url').value.trim();
  if (!url) return $('url').focus();
  if (!/^https?:\/\//i.test(url)) { url = 'https://' + url; $('url').value = url; }
  rows.innerHTML = '';
  resetStats();
  setRunning(true);
  $('exportMsg').textContent = '';
  const res = await window.maptrail.startCrawl({
    url,
    maxDepth: $('depth').value,
    maxPages: $('maxPages').value,
    include: $('include').value,
    exclude: $('exclude').value,
  });
  setRunning(false);
  if (res.error) {
    $('exportMsg').textContent = res.error;
  } else {
    $('exportMsg').textContent = `Done — ${res.total} crawled, ${res.indexable} sitemap-eligible${res.aborted ? ' (cancelled)' : ''}`;
    loadHistory();
  }
});

$('cancel').addEventListener('click', () => window.maptrail.cancelCrawl());

$('advToggle').addEventListener('click', () => {
  const adv = $('adv');
  adv.hidden = !adv.hidden;
  $('advToggle').textContent = adv.hidden ? 'Advanced ▾' : 'Advanced ▴';
});

$('export').addEventListener('click', async () => {
  const res = await window.maptrail.exportFiles({
    xml: $('expXml').checked,
    html: $('expHtml').checked,
    csv: $('expCsv').checked,
  });
  if (res.error) $('exportMsg').textContent = res.error;
  else if (!res.canceled) $('exportMsg').textContent = `Exported: ${res.written.join(', ')}`;
});

async function loadHistory() {
  const list = await window.maptrail.listHistory();
  const el = $('history');
  el.innerHTML = '';
  if (!list.length) {
    el.innerHTML = '<div class="history-empty">No crawls yet.</div>';
    return;
  }
  for (const c of list) {
    const item = document.createElement('div');
    item.className = 'history-item';
    const when = c.startedAt ? new Date(c.startedAt).toLocaleString() : '';
    item.innerHTML = `<div class="history-url">${esc(c.url)}</div><div class="history-meta">${c.pageCount} pages · ${esc(when)}</div><button class="history-del" title="Delete">✕</button>`;
    item.querySelector('.history-del').addEventListener('click', async (e) => {
      e.stopPropagation();
      await window.maptrail.deleteCrawl(c.id);
      loadHistory();
    });
    item.addEventListener('click', async () => {
      if (running) return;
      const res = await window.maptrail.loadCrawl(c.id);
      if (res.error) return;
      rows.innerHTML = '';
      resetStats();
      $('url').value = res.startUrl;
      for (const p of res.pages) addRow(p);
      stats.queued = 0;
      renderStats();
      $('exportMsg').textContent = `Loaded crawl from ${new Date(res.startedAt).toLocaleString()}`;
    });
    el.appendChild(item);
  }
}
loadHistory();

// Demo data for screenshots
window.maptrail.onDemoFill(() => {
  $('url').value = 'https://example-store.com';
  const demo = [
    { url: 'https://example-store.com/', status: 200, title: 'Example Store — Handmade Goods', metaDesc: 'Handmade goods shipped worldwide. Free returns for 30 days.', metaDescLength: 58, wordCount: 642, canonical: 'https://example-store.com/', noindex: false },
    { url: 'https://example-store.com/shop', status: 200, title: 'Shop All Products', metaDesc: 'Browse our full catalog of handmade products.', metaDescLength: 46, wordCount: 1210, canonical: 'https://example-store.com/shop', noindex: false },
    { url: 'https://example-store.com/about', status: 200, title: 'About Us', metaDesc: '', metaDescLength: 0, wordCount: 480, canonical: '', noindex: false },
    { url: 'https://example-store.com/blog', status: 200, title: 'Blog — Example Store', metaDesc: 'News, guides and stories from the workshop.', metaDescLength: 44, wordCount: 890, canonical: 'https://example-store.com/blog', noindex: false },
    { url: 'https://example-store.com/blog/care-guide', status: 200, title: 'Product Care Guide', metaDesc: 'How to care for your handmade products so they last decades.', metaDescLength: 61, wordCount: 1530, canonical: '', noindex: false },
    { url: 'https://example-store.com/old-sale', status: 301, title: '', metaDesc: '', metaDescLength: 0, wordCount: 0, canonical: '', noindex: false },
    { url: 'https://example-store.com/cart', status: 200, title: 'Your Cart', metaDesc: '', metaDescLength: 0, wordCount: 95, canonical: '', noindex: true },
    { url: 'https://example-store.com/discontinued', status: 404, title: '', metaDesc: '', metaDescLength: 0, wordCount: 0, canonical: '', noindex: false },
  ];
  rows.innerHTML = '';
  resetStats();
  demo.forEach(addRow);
  $('exportMsg').textContent = 'Done — 8 crawled, 6 sitemap-eligible';
});
