# Product Hunt Launch — Maptrail

## Name
Maptrail

## Tagline (60 chars)
Crawl any site, ship its sitemap. Pay once, own it forever.

## Description (260 chars)
Maptrail is a local-first desktop crawler: enter a URL, get a spec-compliant sitemap.xml (auto-split at 50k URLs), a human sitemap.html, and a full CSV SEO report — titles, meta, status codes, noindex flags. $19 once instead of £199/yr. No cloud, no URL caps.

## Full description

Maptrail is a desktop website crawler and sitemap generator for people who are tired of paying a yearly license to do a one-time job.

**Why another crawler?** Because the category standard, Screaming Frog, is £199/year — and its free tier caps you at 500 URLs. Most people fire up a crawler to audit a site and ship a sitemap. That shouldn't be a subscription. Maptrail is $19 once, MIT-licensed, and runs entirely on your machine.

**What it actually does:**
- Enter a URL, set crawl depth, page limit, and include/exclude patterns (substrings or /regex/), and crawl breadth-first with a live progress table
- See status, title, meta description length, H1, word count, canonical, and noindex flag per page as the crawl runs
- Generate a standards-compliant sitemap.xml with real lastmod (from Last-Modified headers) and depth-scaled priority
- Sites over 50,000 URLs automatically split into a sitemap index + numbered chunks, per the sitemaps.org spec
- Export a human-readable sitemap.html and a full CSV SEO report — including the 404s and noindexed pages the sitemap correctly excludes, so you can fix them
- Every crawl saved locally (SQLite) — reload, re-export, delete

No account. No license server. No URL caps. No telemetry. Pay once. Own it forever.

## Maker first comment

Hey PH 👋

I got tired of paying £199/year for a crawler I opened a few times a year — almost always to do the same two things: sanity-check a site's pages and generate a sitemap. The free-tier 500-URL cap made it useless for real sites, and the yearly renewal always landed at the worst time. So I built Maptrail: a local desktop crawler that's $19 once.

It does the crawl → sitemap → report loop properly: breadth-first crawl with concurrency, depth/limit/pattern controls, a spec-compliant sitemap.xml with real Last-Modified lastmods, automatic sitemap-index chunking at 50k URLs (tested against a 60,001-URL crawl), an HTML sitemap, and a CSV report that includes the 404s and noindexed pages so you can actually fix them.

Being upfront: this is not a Screaming Frog replacement for power users — no JS rendering, no log-file analysis, no integrations. If you need those, buy the Frog. If you need clean sitemaps and a crawl report without a subscription, that's exactly what this is. The crawler and sitemap engine are pure Node modules with a 31-assertion test suite that spins up a real local server and crawls it.

$19 once. That's it. Would love feedback, especially on what SEO columns you'd want added to the report.

## Gallery shots (5)

1. **Hero — crawl in progress**: dark UI, URL entered, live table filling with pages — status codes green/red, noindex badges visible, progress counter running. Caption: "Crawl any site, locally."
2. **Advanced controls**: the depth / page limit / include / exclude panel open, a `/regex/` pattern in the exclude box. Caption: "Crawl exactly what you mean."
3. **Sitemap index chunking**: file explorer showing `sitemap-index.xml` + `sitemap-1.xml` (50,000 URLs) + `sitemap-2.xml`, with the index XML open beside it. Caption: "50k+ URLs? Handled, per spec."
4. **CSV SEO report**: the exported CSV open in a spreadsheet — status, title, meta description, word count, noindex columns, a 404 row highlighted. Caption: "The report that finds what your sitemap leaves out."
5. **Price comparison card**: "Screaming Frog: £199/year vs Maptrail: $19 once" side by side. Caption: "Your sitemap is not a subscription."
