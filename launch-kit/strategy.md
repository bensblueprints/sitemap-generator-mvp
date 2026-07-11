# Launch Strategy — Maptrail

## Positioning
"You don't need a £199/yr desktop app to make a sitemap — you need this once." Target freelance SEOs, web agencies, and site owners who fire up a crawler a handful of times a year to audit pages and generate sitemaps, and resent renewing a yearly license (or hitting the 500-URL free-tier cap) for that. Named competitor: **Screaming Frog SEO Spider (£199/yr)**; secondary: XML-Sitemaps.com Pro (subscription, cloud-based, page caps), Sitebulb (subscription).

Honesty rule for all copy: Screaming Frog is a deeper tool (JS rendering, log analysis, integrations). Maptrail wins on the 90% use case — crawl, sitemap, report — at 1/13th of one year's price, forever.

## Target communities

| Community | Angle (rules-aware) |
|---|---|
| r/SEO / r/bigseo | Strict self-promo rules — participate first; share in "cheap Screaming Frog alternative?" and "how do I generate a sitemap for a huge site?" threads only when asked for tools. Lead with the free MIT repo. |
| r/TechSEO | Technical angle: correct noindex/404 exclusion, Last-Modified-driven lastmod, sitemap-index chunking at exactly 50k per the sitemaps.org spec. This crowd checks the details — the 31-assertion test suite is the credibility hook. |
| r/SideProject | Straight "I built this" post welcome — one-time-price-vs-yearly-license story, free source + paid installer. |
| r/webdev / r/web_design | Angle: ship a sitemap.xml + HTML sitemap for client sites without a subscription; CSV report doubles as a pre-launch QA checklist (404s, missing titles/meta). |
| r/juststart / r/Blogging | Niche-site owners who need sitemaps + thin-content audits (word-count column) but won't pay £199/yr. Comment helpfully in audit-tool threads. |
| Hacker News | Show HN (draft below) — HN responds to the local-first stance, no-native-deps `node:sqlite` store, and the honest "buy the Frog if you need JS rendering" framing. |

## Show HN draft

**Title:** Show HN: Maptrail – a desktop site crawler and sitemap generator you buy once

**Body:**
I use a crawler a few times a year, almost always for the same job: crawl a site, sanity-check titles/meta/status codes, ship a sitemap.xml. The industry-standard tool for this is £199/year (its free tier caps at 500 URLs), which is a strange price shape for an occasional-use tool. So I built Maptrail — an Electron app where the whole pipeline runs locally: breadth-first crawler with a concurrency pool and depth/limit/regex-pattern controls, then sitemap.xml with lastmod from real Last-Modified headers, automatic sitemap-index chunking at the spec's 50k-URL limit, an HTML sitemap, and a CSV report that deliberately includes the 404s and noindexed pages the sitemap excludes.

Implementation notes: the crawler and sitemap engine are pure Node modules (native fetch + cheerio) that run identically under Electron and in the test suite, which spins up a real local HTTP server with noindex/404/redirect fixtures and crawls it — plus a 60,001-URL synthetic crawl to prove the index chunking. Crawl history uses Node's built-in `node:sqlite` (no native build step) with a same-API JSON fallback.

To be upfront: this is not a Screaming Frog replacement for power users — no JS rendering, no log-file analysis. If you need those, buy the Frog. This covers the crawl → sitemap → report loop for $19 once instead of £199/yr.

Source is MIT on GitHub. Packaged installer for people who don't want to `npm i`.

## SEO keywords (10)
1. sitemap generator free
2. screaming frog alternative
3. xml sitemap generator desktop
4. seo crawler tool one time purchase
5. sitemap generator no page limit
6. website crawler desktop app
7. sitemap index generator 50000 urls
8. seo audit tool no subscription
9. html sitemap generator
10. offline website crawler windows

## AppSumo / PitchGround pitch

Maptrail is the anti-subscription website crawler: a polished dark-mode desktop app that crawls any site locally (depth, page-limit, and regex include/exclude controls), streams a live SEO table (status, title, meta length, H1, word count, canonical, noindex), and exports a spec-compliant sitemap.xml — auto-split into a sitemap index at 50,000 URLs — plus an HTML sitemap and a CSV audit report that surfaces the 404s and noindexed pages sitemaps hide. The crawler category is priced for agencies (£199/yr Screaming Frog, subscription Sitebulb) while most buyers run a handful of crawls a year, which makes a lifetime deal an easy sell: "One year of Screaming Frog costs ~$250; this is $19 once." MIT-licensed source doubles as trust and a technical differentiator (pure-Node crawler with a real local-server test suite, zero native dependencies). Zero infrastructure cost per user means deep discount headroom for a launch campaign.

## Pricing math

- **Price: $19 one-time** (launch: $12)
- Screaming Frog: £199/yr ≈ $250/yr ≈ $21/mo → Maptrail **pays for itself in under 1 month**
- 1-year Screaming Frog: ≈$250 (13x Maptrail) · 3-year: ≈$750 (39x Maptrail)
- Anchor line for all copy: "Cheaper than 1 month of a Screaming Frog license. Yours for life."
