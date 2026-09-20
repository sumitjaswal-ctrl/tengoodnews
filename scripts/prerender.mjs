// Runs after `vite build`. Turns the story archive into real HTML pages so search engines and link previews can read them:
//   dist/index.html            the home page with the intro and the newest day already in the HTML
//   dist/<YYYY-MM-DD>/         one page per day (title, ten stories, links to the originals)
//   dist/archive/              every day, grouped by month
//   dist/sitemap.xml, dist/feed.xml (RSS), dist/404.html
// No dependencies. Everything is read from dist/data, which Vite copied from public/data.
import fs from 'node:fs'
import path from 'node:path'

const SITE = 'https://tengoodnews.com'
const NAME = 'Ten Good News'
const TAGLINE = 'Start your day with good news from around the world.'
const dist = path.resolve('dist')
const read = (p) => fs.readFileSync(path.join(dist, p), 'utf8')
const write = (p, s) => { fs.mkdirSync(path.dirname(path.join(dist, p)), { recursive: true }); fs.writeFileSync(path.join(dist, p), s, 'utf8') }

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const label = (date) => new Date(date + 'T12:00:00+05:30').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
const monthLabel = (date) => new Date(date + 'T12:00:00+05:30').toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…')

const index = JSON.parse(read('data/index.json'))
const days = index.days.map((d) => JSON.parse(read('data/' + d.file))).sort((a, b) => b.date.localeCompare(a.date))
if (!days.length) throw new Error('no days found in dist/data')
const newest = days[0]

const html = read('index.html')
const css = (html.match(/href="\.\/assets\/(index-[^"]+\.css)"/) || [])[1]
if (!css) throw new Error('could not find the built stylesheet in dist/index.html')

const INTRO = 'Most feeds are built to keep you scrolling, and an algorithm decides what you see. Ten Good News is different: ten stories a day, the same for everyone. No accounts, no tracking, no endless scroll. An AI screens positive-news publishers for real good news and we keep the ten best. Read them, then get on with your day.'
const AI_LINE = 'AI-screened, may contain errors. Read the original before you rely on a story.'

const card = (s) => `<article class="card"><div class="cbody"><h3><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a></h3>` +
  `<div class="meta"><span>${esc(s.source)}</span><span class="chip">${esc(s.category)}</span><span class="chip${s.region === 'india' ? ' in' : ''}">${s.region === 'india' ? 'India' : 'World'}</span></div>` +
  `<p>${esc(s.summary)}</p></div></article>`

const itemList = (doc, pageUrl) => ({
  '@context': 'https://schema.org', '@type': 'ItemList', name: `Good news for ${label(doc.date)}`, url: pageUrl,
  itemListOrder: 'https://schema.org/ItemListOrderDescending', numberOfItems: doc.stories.length,
  itemListElement: doc.stories.map((s, i) => ({ '@type': 'ListItem', position: i + 1, url: s.url, name: s.title })),
})
const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`

const header = (rel) => `<header class="top"><div class="wrap bar"><div class="brand"><a href="${rel}"><img class="logo" src="${rel}logo.svg" alt="" width="52" height="52"></a>` +
  `<div><h1 style="margin:0"><a href="${rel}" style="color:inherit;text-decoration:none">${NAME}</a></h1><p class="tag">${esc(TAGLINE)}</p><p class="ailine">${esc(AI_LINE)} <a href="${rel}#about">How this works</a></p></div></div></div></header>`
const footer = (rel) => `<footer class="foot"><div class="wrap"><p class="src"><a href="${rel}">Home</a> · <a href="${rel}archive/">Archive of every day</a> · <a href="${rel}feed.xml">RSS feed</a></p>` +
  `<p class="src">${NAME} shows the publishers’ headlines, a one-line summary written by an AI, and a link to each original story. All credit belongs to the publishers.</p></div></footer>`

function page({ title, description, canonical, rel, body, extraHead = '', robots = 'index, follow, max-image-preview:large' }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="${robots}">
<meta name="theme-color" content="#1f7a4d">
<link rel="icon" href="${rel}favicon.svg" type="image/svg+xml"><link rel="icon" href="${rel}favicon.ico" sizes="32x32"><link rel="apple-touch-icon" href="${rel}apple-touch-icon.png">
<link rel="manifest" href="${rel}site.webmanifest"><link rel="alternate" type="application/rss+xml" title="${NAME}" href="${rel}feed.xml">
<meta property="og:type" content="website"><meta property="og:site_name" content="${NAME}"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}/og-image.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${SITE}/og-image.png">
<link rel="stylesheet" href="${rel}assets/${css}">
${extraHead}</head><body>${header(rel)}${body}${footer(rel)}</body></html>`
}

// ---- one page per day ----
days.forEach((doc, i) => {
  const url = `${SITE}/${doc.date}/`
  const older = days[i + 1], newer = days[i - 1]
  const desc = clip(`Ten good news stories from ${label(doc.date)}: ${doc.stories.slice(0, 3).map((s) => s.title).join('; ')}.`, 158)
  const nav = `<p class="src" style="margin:18px 0 0">${older ? `<a href="../${older.date}/">← ${esc(label(older.date))}</a>` : ''}${older && newer ? ' · ' : ''}${newer ? `<a href="../${newer.date}/">${esc(label(newer.date))} →</a>` : ''}</p>`
  const crumbs = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: NAME, item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: 'Archive', item: SITE + '/archive/' },
    { '@type': 'ListItem', position: 3, name: label(doc.date), item: url }] }
  write(`${doc.date}/index.html`, page({
    title: `Good news for ${label(doc.date)} — ${NAME}`, description: desc, canonical: url, rel: '../',
    extraHead: ld(itemList(doc, url)) + ld(crumbs),
    body: `<main class="wrap"><h2 style="font-size:26px;margin:26px 0 4px">Good news for ${esc(label(doc.date))}</h2><p class="intro" style="margin-top:6px">${doc.stories.length} stories, screened by AI from positive-news publishers. ${esc(AI_LINE)}</p>` +
      `<section class="day" style="margin-top:20px"><div class="grid">${doc.stories.map(card).join('')}</div></section>${nav}</main>`,
  }))
})

// ---- archive ----
const byMonth = new Map()
days.forEach((d) => { const m = monthLabel(d.date); if (!byMonth.has(m)) byMonth.set(m, []); byMonth.get(m).push(d) })
write('archive/index.html', page({
  title: `Archive of every day — ${NAME}`, description: `Every day of ${NAME}: ten good news stories a day, ${index.total_stories} stories so far.`,
  canonical: `${SITE}/archive/`, rel: '../',
  body: `<main class="wrap"><h2 style="font-size:26px;margin:26px 0 8px">Archive</h2><p class="intro" style="margin-top:0">${index.total_stories} stories across ${days.length} days.</p>` +
    [...byMonth].map(([m, list]) => `<section class="day"><h2>${esc(m)}</h2><ul style="padding-left:18px;line-height:1.9">${list.map((d) => `<li><a href="../${d.date}/">${esc(label(d.date))}</a> <span style="color:var(--mut)">· ${d.stories.length} stories</span></li>`).join('')}</ul></section>`).join('') + '</main>',
}))

// ---- home page: the intro and the newest day written into the HTML ----
const snapshot = header('') + `<main class="wrap"><p class="intro">${esc(INTRO)}</p><section class="day"><h2><a href="${newest.date}/">${esc(label(newest.date))}</a> <span>${newest.stories.length} stories</span></h2>` +
  `<div class="grid">${newest.stories.map(card).join('')}</div></section><p class="src" style="margin:24px 0"><a href="archive/">Archive of every day</a> · <a href="feed.xml">RSS feed</a></p></main>`
let home = html.replace('<div id="root"></div>', `<div id="root">${snapshot}</div>`)
home = home.replace('</head>', ld(itemList(newest, SITE + '/')) + '</head>')
if (!home.includes('id="root"><header')) throw new Error('home page snapshot was not injected')
write('index.html', home)

// ---- sitemap ----
const urls = [{ loc: SITE + '/', lastmod: newest.date, changefreq: 'daily', priority: '1.0' }, { loc: SITE + '/archive/', lastmod: newest.date, changefreq: 'daily', priority: '0.6' },
  ...days.map((d) => ({ loc: `${SITE}/${d.date}/`, lastmod: d.date, changefreq: 'never', priority: '0.7' }))]
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n') + '\n</urlset>\n')

// ---- RSS: the latest 30 stories, each linking to its original ----
const items = days.flatMap((d) => d.stories.map((s) => ({ ...s, day: d.date }))).slice(0, 30)
write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n` +
  `<title>${NAME}</title>\n<link>${SITE}/</link>\n<description>${esc(TAGLINE)} Ten good news stories a day, screened by AI. May contain errors.</description>\n<language>en</language>\n` +
  `<lastBuildDate>${new Date(index.updated_at).toUTCString()}</lastBuildDate>\n<atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>\n` +
  items.map((s) => `<item><title>${esc(s.title)}</title><link>${esc(s.url)}</link><guid isPermaLink="true">${esc(s.url)}</guid>` +
    `<pubDate>${new Date(s.published_at || s.day).toUTCString()}</pubDate><category>${esc(s.category)}</category>` +
    `<description>${esc(s.summary)} (via ${esc(s.source)}. AI-written summary, may contain errors.)</description></item>`).join('\n') + '\n</channel>\n</rss>\n')

// ---- 404 (GitHub Pages serves this for unknown addresses, so paths are absolute) ----
write('404.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Page not found — ${NAME}</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/${css}"></head>
<body><main class="wrap" style="padding:60px 0"><img class="logo" src="/logo.svg" alt="" width="52" height="52"><h2 style="font-size:28px">That page is not here.</h2>
<p class="intro">Try <a href="/">today’s ten good stories</a> or the <a href="/archive/">archive</a>.</p></main></body></html>`)

console.log(`prerendered: home + ${days.length} day pages + archive + sitemap (${urls.length} urls) + feed (${items.length} items) + 404`)
