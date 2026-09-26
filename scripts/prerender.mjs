// Runs after `vite build`. Turns the story archive into real HTML pages so search engines and link previews can read them:
//   dist/index.html            the home page with the intro and the newest day already in the HTML
//   dist/<YYYY-MM-DD>/         one page per day (title, ten stories, links to the originals)
//   dist/archive/              every day, grouped by month
//   dist/sitemap.xml, dist/feed.xml (RSS), dist/404.html
// No dependencies. Everything is read from dist/data, which Vite copied from public/data.
import fs from 'node:fs'
import path from 'node:path'
import { STR } from '../src/strings.js'
import { ANALYTICS_CODE } from '../src/analytics.js'

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

// Hindi edition: only days a person approved (data/hi/<date>.json). Each Hindi day reuses the English story (link, source, picture) with the Hindi text swapped in.
const HI = STR.hi
const labelHi = (date) => new Date(date + 'T12:00:00+05:30').toLocaleDateString('hi-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
const hiDays = []
if (fs.existsSync(path.join(dist, 'data/hi/index.json'))) {
  for (const d of JSON.parse(read('data/hi/index.json')).days) {
    const en = days.find((x) => x.date === d.date)
    if (!en) continue
    const by = new Map(JSON.parse(read('data/hi/' + d.date + '.json')).stories.map((h) => [h.id, h]))
    hiDays.push({ date: d.date, stories: en.stories.filter((s) => by.has(s.id)).map((s) => ({ ...s, title: by.get(s.id).title_hi, summary: by.get(s.id).summary_hi })) })
  }
  hiDays.sort((a, b) => b.date.localeCompare(a.date))
}
const hasHi = (date) => hiDays.some((d) => d.date === date)

// Sunday editions (data/best_of_week.json, written by goodnews/sunday_edition.py --site): the week's five best and "Five That Almost Made It".
const editions = fs.existsSync(path.join(dist, 'data/best_of_week.json')) ? (JSON.parse(read('data/best_of_week.json')).editions || []) : []

// Deep Dive Sunday episodes: content/deepdive/*.json, committed with the site code and NOT under public/data, so the nightly data publish never carries them.
const ddDir = path.resolve('content/deepdive')
const episodes = fs.existsSync(ddDir)
  ? fs.readdirSync(ddDir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(ddDir, f), 'utf8'))).sort((a, b) => b.episode - a.episode)
  : []
const alt = (enUrl, hiUrl) => `<link rel="alternate" hreflang="en" href="${enUrl}"><link rel="alternate" hreflang="hi" href="${hiUrl}"><link rel="alternate" hreflang="x-default" href="${enUrl}">`

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

// The "AI-screened, may contain errors" notice is the LAST line of every page (footer), not the header, so the story leads (Sumit, 2026-09-25).
const header = (rel) => `<header class="top"><div class="wrap bar"><div class="brand"><a href="${rel}"><img class="logo" src="${rel}logo.svg" alt="" width="52" height="52"></a>` +
  `<div><h1 style="margin:0"><a href="${rel}" style="color:inherit;text-decoration:none">${NAME}</a></h1><p class="tag">${esc(TAGLINE)}</p></div></div></div></header>`
const footer = (rel) => `<footer class="foot"><div class="wrap"><p class="src"><a href="${rel}">Home</a> · ${episodes.length ? `<a href="${rel}deep-dive-sunday/">Deep Dive Sunday</a> · ` : ''}${editions.length ? `<a href="${rel}best-of-week/">Best of the week</a> · ` : ''}<a href="${rel}archive/">Archive of every day</a> · <a href="${rel}feed.xml">RSS feed</a>${hiDays.length ? ` · <a href="${rel}hi/" lang="hi">हिन्दी</a>` : ''}</p>` +
  `<p class="src"><a href="${rel}terms/">Terms</a> · <a href="${rel}privacy/">Privacy</a> · <a href="${rel}refunds/">Refunds</a> · <a href="${rel}contact/">Contact</a></p>` +
  `<p class="src">${NAME} shows the publishers’ headlines, a one-line summary written by an AI, and a link to each original story. All credit belongs to the publishers.</p>` +
  `<p class="src">${esc(AI_LINE)} <a href="${rel}#about">How this works</a></p></div></footer>`

function page({ title, description, canonical, rel, body, extraHead = '', robots = 'index, follow, max-image-preview:large', lang = 'en', hdr, ftr }) {
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
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
${extraHead}${ANALYTICS_CODE ? `<script data-goatcounter="https://${ANALYTICS_CODE}.goatcounter.com/count" data-goatcounter-settings='{"allow_local":false}' async src="https://gc.zgo.at/count.js"></script>` : ''}</head><body>${hdr ?? header(rel)}${body}${ftr ?? footer(rel)}</body></html>`
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
    extraHead: ld(itemList(doc, url)) + ld(crumbs) + (hasHi(doc.date) ? alt(url, `${SITE}/hi/${doc.date}/`) : ''),
    body: `<main class="wrap"><h2 style="font-size:26px;margin:26px 0 4px">Good news for ${esc(label(doc.date))}</h2><p class="intro" style="margin-top:6px">${doc.stories.length} stories, screened by AI from positive-news publishers.</p>` +
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

// ---- Best of the week (Deep Dive Sunday): newest edition in full, older ones below ----
if (editions.length) {
  const range = (e) => `${label(e.week_start).replace(/^\w+, /, '')} to ${label(e.week_end).replace(/^\w+, /, '')}`
  const bow = (list) => `<div class="grid">${list.map(card).join('')}</div>`
  const [latest, ...older] = editions
  const desc = clip(`The five best good news stories of the week to ${label(latest.week_end)}, and five that almost made the daily ten: ${latest.best.slice(0, 2).map((s) => s.title).join('; ')}.`, 158)
  const list = { '@context': 'https://schema.org', '@type': 'ItemList', name: `Best of the week to ${label(latest.week_end)}`, url: `${SITE}/best-of-week/`,
    numberOfItems: latest.best.length, itemListElement: latest.best.map((s, i) => ({ '@type': 'ListItem', position: i + 1, url: s.url, name: s.title })) }
  write('best-of-week/index.html', page({
    title: `Best of the week: good news, ${range(latest)} — ${NAME}`, description: desc, canonical: `${SITE}/best-of-week/`, rel: '../', extraHead: ld(list),
    body: `<main class="wrap"><h2 style="font-size:26px;margin:26px 0 4px">Best of the week</h2><p class="intro" style="margin-top:6px">Every Sunday: the five stories that made the week a little better, and five that almost made our daily ten. ${esc(range(latest))}.</p>` +
      `<section class="day" style="margin-top:20px"><h2>The week’s five best</h2>${bow(latest.best)}</section>` +
      `<section class="day"><h2>Five That Almost Made It</h2><p class="intro" style="margin-top:0">Good stories that missed the daily ten, and deserved a look.</p>${bow(latest.almost)}</section>` +
      (older.length ? `<section class="day"><h2>Earlier weeks</h2><ul style="padding-left:18px;line-height:1.9">${older.map((e) => `<li><a href="../best-of-week/${e.week_end}/">${esc(range(e))}</a></li>`).join('')}</ul></section>` : '') +
      `<p class="src" style="margin:24px 0">Deep Dive Sunday: one good story, told properly. Coming soon.</p></main>`,
  }))
  older.forEach((e) => write(`best-of-week/${e.week_end}/index.html`, page({
    title: `Best of the week, ${range(e)} — ${NAME}`, description: clip(`The five best good news stories of the week to ${label(e.week_end)}.`, 158), canonical: `${SITE}/best-of-week/${e.week_end}/`, rel: '../../',
    body: `<main class="wrap"><h2 style="font-size:26px;margin:26px 0 4px">Best of the week: ${esc(range(e))}</h2>` +
      `<section class="day"><h2>The week’s five best</h2>${bow(e.best)}</section><section class="day"><h2>Five That Almost Made It</h2>${bow(e.almost)}</section><p class="src" style="margin:24px 0"><a href="../">Latest edition</a></p></main>`,
  })))
}

// ---- Deep Dive Sunday: /deep-dive-sunday/ and one page per episode ----
if (episodes.length) {
  const cite = (s, raw = false) => (raw ? s : esc(s)).replace(/(?:\[S\d+\])+/g, (m) =>
    `<sup class="c">${[...m.matchAll(/S(\d+)/g)].map((x) => `<a href="#s${x[1]}">${x[1]}</a>`).join(', ')}</sup>`)
  const dlabel = (d) => new Date(d + 'T12:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
  const DD_CSS = `<style>.dd{max-width:760px;margin:0 auto;padding-bottom:30px}.dd h2.t{font-size:30px;line-height:1.15;margin:8px 0 10px}.dd .kick{display:inline-block;background:var(--chip);color:var(--acc);border-radius:20px;padding:4px 12px;font-size:13px;font-weight:700;letter-spacing:.4px;margin-top:26px}.dd .stand{font-size:18px;line-height:1.5;color:var(--mut);margin:0 0 20px}.dd h3{font-size:21px;margin:30px 0 8px}.dd p{line-height:1.65;font-size:17px;margin:0 0 12px}.dd sup.c{font-size:11px;margin-left:1px}.dd sup.c a{text-decoration:none;color:var(--acc);font-weight:700}.dd figure{margin:18px 0}.dd figure img{width:100%;height:auto;border-radius:12px;display:block}.dd figcaption{font-size:13px;color:var(--mut);margin-top:6px}.video{position:relative;aspect-ratio:16/9;background:#000;border-radius:14px;overflow:hidden;margin:6px 0 4px}.video img,.video iframe{width:100%;height:100%;border:0;object-fit:cover;display:block}.video button{position:absolute;inset:0;margin:auto;width:76px;height:76px;border-radius:50%;border:0;background:rgba(255,255,255,.92);color:#1f7a4d;font-size:30px;cursor:pointer;padding-left:6px}.video .soon{position:absolute;left:0;right:0;bottom:0;padding:10px 14px;background:rgba(0,0,0,.6);color:#fff;font-size:14px}.dd .box{background:var(--notice);color:var(--noticefg);border-radius:12px;padding:6px 18px 8px;margin:22px 0}.dd .box ul{padding-left:18px;margin:8px 0}.dd .box li{margin:8px 0;line-height:1.5;font-size:16px}.dd table{width:100%;border-collapse:collapse;font-size:15px;margin:10px 0}.dd th,.dd td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);vertical-align:top}.dd caption{caption-side:top;text-align:left;color:var(--mut);font-size:13px;padding-bottom:6px}.dd ol.src{padding-left:22px;line-height:1.6;font-size:15px}.dd .fine{font-size:13px;color:var(--mut)}.dd .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin:14px 0}.dd .card a{text-decoration:none}</style>`
  const DD_JS = `<script>document.querySelectorAll('.video[data-yt]').forEach(function(v){var b=v.querySelector('button');if(!b)return;b.addEventListener('click',function(){var f=document.createElement('iframe');f.src='https://www.youtube-nocookie.com/embed/'+v.getAttribute('data-yt')+'?autoplay=1&rel=0';f.allow='accelerometer; autoplay; encrypted-media; picture-in-picture';f.allowFullscreen=true;f.title='Video';v.innerHTML='';v.appendChild(f)})})</script>`
  const video = (ep) => ep.youtube_id
    ? `<div class="video" data-yt="${esc(ep.youtube_id)}"><img src="${esc(ep.video_poster)}" alt="Video: ${esc(ep.title)}" loading="lazy"><button type="button" aria-label="Play the video">&#9654;</button></div>` +
      `<p class="fine">${esc(ep.video_length)}. The video loads from YouTube (privacy-enhanced mode) only when you press play. <a href="https://www.youtube.com/watch?v=${esc(ep.youtube_id)}" target="_blank" rel="noopener noreferrer">Watch on YouTube</a></p>${DD_JS}`
    : `<div class="video"><img src="${esc(ep.video_poster)}" alt=""><div class="soon">The video for this episode is coming soon.</div></div>`
  const table = (t) => `<table><caption>${esc(t.caption)}</caption><thead><tr>${t.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${cite(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`

  episodes.forEach((ep) => {
    const url = `${SITE}/deep-dive-sunday/${ep.slug}/`
    const body = ep.sections.map((s) => `<h3>${esc(s.heading)}</h3>` +
      (s.image ? `<figure><img src="${esc(s.image.src)}" alt="${esc(s.image.alt)}" width="900" height="900" loading="lazy"><figcaption>AI-generated illustration</figcaption></figure>` : '') +
      (s.table ? table(s.table) : '') + (s.paras || []).map((p) => `<p>${cite(p)}</p>`).join('')).join('')
    const jsonld = [
      { '@context': 'https://schema.org', '@type': 'Article', headline: ep.title, description: ep.description, datePublished: ep.published, image: SITE + ep.video_poster,
        mainEntityOfPage: url, publisher: { '@type': 'Organization', name: NAME } },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: NAME, item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: 'Deep Dive Sunday', item: SITE + '/deep-dive-sunday/' },
        { '@type': 'ListItem', position: 3, name: ep.title, item: url }] },
      ...(ep.youtube_id ? [{ '@context': 'https://schema.org', '@type': 'VideoObject', name: ep.title, description: ep.description, thumbnailUrl: SITE + ep.video_poster,
        uploadDate: ep.published, embedUrl: `https://www.youtube.com/embed/${ep.youtube_id}` }] : []),
    ].map(ld).join('')
    write(`deep-dive-sunday/${ep.slug}/index.html`, page({
      title: `${ep.title}: Deep Dive Sunday — ${NAME}`, description: clip(ep.description, 158), canonical: url, rel: '../../', extraHead: DD_CSS + jsonld,
      body: `<main class="wrap dd"><span class="kick">DEEP DIVE SUNDAY · EPISODE ${ep.episode}</span><h2 class="t">${esc(ep.title)}</h2><p class="stand">${esc(ep.standfirst)}</p>` +
        `<p class="fine">${esc(dlabel(ep.published))}</p>${video(ep)}${body}` +
        `<h3>Timeline</h3><table><tbody>${ep.timeline.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${cite(r[1])} ${cite(r[2])}</td></tr>`).join('')}</tbody></table>` +
        `<h3>Where the reports differ</h3><div class="box"><ul>${ep.differ.map((d) => `<li>${d}</li>`).join('')}</ul></div>` +
        `<h3>What we left out, and why</h3><ul>${ep.left_out.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` +
        `<h3>Sources</h3><ol class="src">${ep.sources.map((s) => `<li id="s${s.id}">${esc(s.outlet)}${s.by ? `, ${esc(s.by)}` : ''}, ${esc(s.date)}. <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.url)}</a></li>`).join('')}</ol>` +
        `<h3>How we made this</h3><p class="fine">We read each source, wrote down every fact with its source, and marked where the sources disagree before writing a word. This page and the video use only the facts on that list. The illustrations and the narration are AI-generated. They are not photographs or recordings of Karimul Haque, and the look of the motorbike ambulance follows how it appears in a recent Better India story. This page is AI-assisted and may contain errors, so please read the sources. Something wrong? Write to <a href="mailto:hello@tengoodnews.com">hello@tengoodnews.com</a>.</p>` +
        `<p class="src" style="margin:24px 0"><a href="../">All Deep Dive Sunday stories</a></p></main>`,
    }))
  })

  write('deep-dive-sunday/index.html', page({
    title: `Deep Dive Sunday: one good story, told properly — ${NAME}`, description: 'One good story, told properly: built from several public sources, every source listed and every disagreement shown, with a video.',
    canonical: `${SITE}/deep-dive-sunday/`, rel: '../', extraHead: DD_CSS,
    body: `<main class="wrap dd"><span class="kick">DEEP DIVE SUNDAY</span><h2 class="t">One good story, told properly.</h2>` +
      `<p class="stand">Each episode takes one good story and tells it in full: built from several public sources, with every source listed and every disagreement between them shown. A video goes with it.</p>` +
      episodes.map((ep) => `<div class="card"><div class="fine">Episode ${ep.episode} · ${esc(dlabel(ep.published))}</div><h3 style="margin:6px 0"><a href="${ep.slug}/">${esc(ep.title)}</a></h3><p style="margin:0">${esc(ep.standfirst)}</p></div>`).join('') +
      `</main>`,
  }))
}

// ---- home page: the intro and the newest day written into the HTML ----
const snapshot = header('') + `<main class="wrap"><p class="intro">${esc(INTRO)}</p><section class="day"><h2><a href="${newest.date}/">${esc(label(newest.date))}</a> <span>${newest.stories.length} stories</span></h2>` +
  `<div class="grid">${newest.stories.map(card).join('')}</div></section><p class="src" style="margin:24px 0"><a href="archive/">Archive of every day</a> · <a href="feed.xml">RSS feed</a></p></main>`
let home = html.replace('<div id="root"></div>', `<div id="root">${snapshot}</div>`)
home = home.replace('</head>', ld(itemList(newest, SITE + '/')) + (hiDays.length ? alt(SITE + '/', SITE + '/hi/') : '') + '</head>')
if (!home.includes('id="root"><header')) throw new Error('home page snapshot was not injected')
write('index.html', home)


// ---- policy pages (also needed by the payment provider's website check) ----
const EMAIL = 'hello@tengoodnews.com'
const UPDATED = '27 September 2026'
const LEGAL = {
  terms: ['Terms of use', `The rules for using ${NAME}, in plain words.`, `
<p>${NAME} (“we”, “the site”) is a free website at tengoodnews.com that lists ten good-news stories a day. By using it you agree to these terms.</p>
<h3>What the site is</h3>
<p>We collect positive-news headlines from publishers’ public feeds. An AI model screens them and writes a one-line summary. We show the publisher’s headline, our summary and a link to the original story. We do not copy the articles.</p>
<h3>AI can be wrong</h3>
<p>The screening and the summaries are done by an AI model and may contain errors. Read the original story before you rely on anything. Nothing on this site is professional, medical, legal or financial advice.</p>
<h3>Other people’s content</h3>
<p>Headlines, pictures and stories belong to their publishers, and we credit them on every story. Links take you to other websites, which we do not control and are not responsible for. If you are a publisher and want something changed or removed, write to <a href="mailto:${EMAIL}">${EMAIL}</a> and we will act promptly.</p>
<h3>Using the site</h3>
<p>Use the site for yourself and do not try to break it or overload it. You may link to it freely. You may not copy it wholesale or pass its content off as your own.</p>
<h3>Voluntary support</h3>
<p>The site is free. You may choose to support it with a payment; see the <a href="../refunds/">Refunds</a> page. Support does not buy anything and does not change what you see.</p>
<h3>Limits</h3>
<p>The site is provided as it is, with no promise that it will always be available or free of mistakes. To the extent the law allows, we are not liable for loss arising from using it. We may change or stop the site, or these terms, at any time; the date below shows the latest change. These terms are governed by the laws of India.</p>
<p class="src">Last updated ${UPDATED}.</p>`],
  privacy: ['Privacy', `What ${NAME} does and does not collect: very little.`, `
<p>Short version: no accounts, no advertising, no tracking cookies${ANALYTICS_CODE ? ' and only an anonymous visit counter' : ' and no analytics'}.</p>
<h3>What we do not collect</h3>
<p>We do not ask your name or email to read the site. We run no advertising scripts and build no profile of you.${ANALYTICS_CODE ? ' We do count visits, using GoatCounter, which sets no cookies and stores no personal information: it records that a page was opened, roughly which country and browser type it came from, and nothing that identifies you. If your browser sends Do Not Track, we do not count you at all.' : ' We do not run analytics.'}</p>
<h3>What stays on your device</h3>
<p>The site remembers your day or night mode choice, and your chosen notification hour, in your own browser storage. It never leaves your device. It also reads the time zone your browser reports, only to decide whether to show world stories first for readers outside India. That check happens in your browser; we do not look up your location and nothing is sent to us.</p>
<h3>Optional daily notification</h3>
<p>If you tap “Notify me”, we store your browser’s anonymous push address, the time zone and the hour you chose, so we can send one message a day. That is all: no name, no email. It is kept with our service provider, Cloudflare. Turn it off any time from the same button and we delete it.</p>
${episodes.length ? `<h3>Videos</h3>
<p>Some Deep Dive Sunday pages show a YouTube video. Nothing is loaded from YouTube until you press play. Then YouTube’s privacy-enhanced player (youtube-nocookie.com) loads, and YouTube’s own policies apply to that video.</p>
` : ''}<h3>Who else sees your visit</h3>
<p>The site is hosted by GitHub Pages, and our domain and notification service run on Cloudflare, so like any website their servers see your IP address in the ordinary way. Story pictures load directly from the publishers’ own sites, so those publishers see the request too. When you follow a link to a story, you are on the publisher’s site and their policies apply.</p>
<h3>Voluntary support payments</h3>
<p>If you choose to support us, the payment is handled by Razorpay on its own page. Razorpay collects the details it needs, such as your email, phone number and payment method, and shows us the payment and those contact details in our account. We use them only to record and acknowledge the payment, and we never sell or share them. Razorpay’s own privacy policy applies to what it holds.</p>
<h3>Your choices</h3>
<p>To ask about, correct or delete anything we hold about you, write to <a href="mailto:${EMAIL}">${EMAIL}</a>.</p>
<p class="src">Last updated ${UPDATED}.</p>`],
  refunds: ['Refunds and support payments', 'Support payments are voluntary; here is how refunds work.', `
<p>${NAME} is free and sells nothing. A support payment is a voluntary contribution, so no goods or services are delivered and there is nothing to return.</p>
<h3>Refunds</h3>
<p>Support payments are not refundable. The one exception is a mistake: a duplicate payment or a wrong amount. If that happens, write to <a href="mailto:${EMAIL}">${EMAIL}</a> within 7 days with the payment details, and we will refund it to the original payment method. Refunds normally reach your account within 5 to 10 working days after we approve them, depending on your bank.</p>
<h3>Cancellation</h3>
<p>Payments are one-time. There are no subscriptions and nothing renews, so there is nothing to cancel.</p>
<p class="src">Last updated ${UPDATED}.</p>`],
  contact: ['Contact', `How to reach ${NAME}.`, `
<p>We would love to hear from you: a correction, a story tip, a question about the site, or a request from a publisher.</p>
<p><strong>Email:</strong> <a href="mailto:${EMAIL}">${EMAIL}</a></p>
<p>We read every message and aim to reply within a few working days.</p>
<h3>Publishers</h3>
<p>If you would like a headline or picture changed or removed, tell us which story and we will act promptly.</p>
<h3>Payments</h3>
<p>For a problem with a support payment, write to the same address with the payment details.</p>`],
}
for (const [slug, [title, desc, content]] of Object.entries(LEGAL)) {
  write(`${slug}/index.html`, page({
    title: `${title} — ${NAME}`, description: desc, canonical: `${SITE}/${slug}/`, rel: '../',
    body: `<main class="wrap" style="max-width:760px"><h2 style="font-size:28px;margin:28px 0 12px">${esc(title)}</h2><div class="legal" style="line-height:1.65">${content}</div></main>`,
  }))
}

// ---- Hindi edition (only when at least one day has been approved) ----
const cardHi = (s) => `<article class="card"><div class="cbody"><h3><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a></h3>` +
  `<div class="meta"><span>${esc(s.source)}</span><span class="chip">${esc(HI.cat[s.category] || s.category)}</span><span class="chip${s.region === 'india' ? ' in' : ''}">${s.region === 'india' ? HI.india : HI.world}</span></div>` +
  `<p>${esc(s.summary)}</p></div></article>`
const hiHeader = `<header class="top"><div class="wrap bar"><div class="brand"><a href="/hi/"><img class="logo" src="/logo.svg" alt="" width="52" height="52"></a>` +
  `<div><h1 style="margin:0"><a href="/hi/" style="color:inherit;text-decoration:none">${NAME}</a></h1><p class="tag">${esc(HI.tagline)}</p></div></div>` +
  `<div class="actions"><a class="btn" href="/" lang="en">English</a></div></div></header>`
const hiFooter = `<footer class="foot"><div class="wrap"><p class="src"><a href="/hi/">${HI.footHome}</a> · <a href="/archive/">${HI.archive}</a></p>` +
  `<p class="src"><a href="/terms/">${HI.terms}</a> · <a href="/privacy/">${HI.privacy}</a> · <a href="/refunds/">${HI.refunds}</a> · <a href="/contact/">${HI.contact}</a></p>` +
  `<p class="src">${esc(HI.about2)}</p><p class="src">${esc(HI.notice + ' ' + HI.readOriginal)} <a href="/hi/#about">${HI.howLink}</a></p></div></footer>`
const hiItemList = (doc, pageUrl) => ({ ...itemList(doc, pageUrl), name: HI.moreFrom + labelHi(doc.date), inLanguage: 'hi' })

if (hiDays.length) {
  hiDays.forEach((doc, i) => {
    const url = `${SITE}/hi/${doc.date}/`
    const older = hiDays[i + 1], newer = hiDays[i - 1]
    const nav = `<p class="src" style="margin:18px 0 0">${older ? `<a href="../${older.date}/">← ${esc(labelHi(older.date))}</a>` : ''}${older && newer ? ' · ' : ''}${newer ? `<a href="../${newer.date}/">${esc(labelHi(newer.date))} →</a>` : ''}</p>`
    write(`hi/${doc.date}/index.html`, page({
      title: `${labelHi(doc.date)} की अच्छी ख़बरें — ${NAME}`, lang: 'hi', rel: '../../', canonical: url,
      description: clip(`${labelHi(doc.date)} की दस अच्छी ख़बरें: ${doc.stories.slice(0, 3).map((s) => s.title).join('; ')}।`, 158),
      extraHead: ld(hiItemList(doc, url)) + alt(`${SITE}/${doc.date}/`, url),
      hdr: hiHeader, ftr: hiFooter,
      body: `<main class="wrap"><h2 style="font-size:26px;margin:26px 0 4px">${esc(labelHi(doc.date))} की अच्छी ख़बरें</h2>` +
        `<section class="day" style="margin-top:20px"><div class="grid">${doc.stories.map(cardHi).join('')}</div></section>${nav}</main>`,
    }))
  })
  // the Hindi home page: the same app (it reads lang="hi"), with a Hindi snapshot in the HTML for search engines
  const newestHi = hiDays[0]
  const snap = hiHeader + `<main class="wrap"><p class="intro">${esc(HI.intro)}</p><section class="day"><h2><a href="/hi/${newestHi.date}/">${esc(labelHi(newestHi.date))}</a> <span>${HI.stories(newestHi.stories.length)}</span></h2>` +
    `<div class="grid">${newestHi.stories.map(cardHi).join('')}</div></section></main>`
  const homeTitle = `${NAME} — ${HI.tagline}`
  let hh = html.replace('<html lang="en">', '<html lang="hi">').replace('<head>', '<head><base href="/">')
  hh = hh.replace(/<title>[^<]*<\/title>/, `<title>${esc(homeTitle)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*"/, `$1${esc(HI.intro)}"`)
    .replace(/(<link rel="canonical" href=")[^"]*"/, `$1${SITE}/hi/"`)
    .replace(/(<meta property="og:url" content=")[^"]*"/, `$1${SITE}/hi/"`)
    .replace(/(<meta property="og:title" content=")[^"]*"/, `$1${esc(homeTitle)}"`)
    .replace(/(<meta property="og:description" content=")[^"]*"/, `$1${esc(HI.intro)}"`)
    .replace('<div id="root"></div>', `<div id="root">${snap}</div>`)
    .replace('</head>', ld(hiItemList(newestHi, SITE + '/hi/')) + alt(SITE + '/', SITE + '/hi/') + '</head>')
  if (!hh.includes('id="root"><header')) throw new Error('Hindi home snapshot was not injected')
  write('hi/index.html', hh)
}

// ---- sitemap ----
const urls = [{ loc: SITE + '/', lastmod: newest.date, changefreq: 'daily', priority: '1.0' }, { loc: SITE + '/archive/', lastmod: newest.date, changefreq: 'daily', priority: '0.6' },
  ...(editions.length ? [{ loc: SITE + '/best-of-week/', lastmod: editions[0].week_end, changefreq: 'weekly', priority: '0.6' }, ...editions.slice(1).map((e) => ({ loc: `${SITE}/best-of-week/${e.week_end}/`, lastmod: e.week_end, changefreq: 'never', priority: '0.4' }))] : []),
  ...(episodes.length ? [{ loc: SITE + '/deep-dive-sunday/', lastmod: episodes[0].published, changefreq: 'weekly', priority: '0.6' }, ...episodes.map((e) => ({ loc: `${SITE}/deep-dive-sunday/${e.slug}/`, lastmod: e.published, changefreq: 'monthly', priority: '0.7' }))] : []),
  ...Object.keys(LEGAL).map((k) => ({ loc: `${SITE}/${k}/`, lastmod: newest.date, changefreq: 'yearly', priority: '0.3' })),
  ...(hiDays.length ? [{ loc: SITE + '/hi/', lastmod: hiDays[0].date, changefreq: 'daily', priority: '0.9' }, ...hiDays.map((d) => ({ loc: `${SITE}/hi/${d.date}/`, lastmod: d.date, changefreq: 'never', priority: '0.6' }))] : []),
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

console.log(`prerendered: ${hiDays.length} Hindi day(s); home + ${days.length} day pages + archive + sitemap (${urls.length} urls) + feed (${items.length} items) + 404`)
