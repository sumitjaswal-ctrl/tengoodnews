import { useCallback, useEffect, useMemo, useState } from 'react'
import Notify from './Notify.jsx'
import Swipe from './Swipe.jsx'
import ShareButton from './Share.jsx'
import Stumble from './Stumble.jsx'
import { DAYS_PER_PAGE, HERO_COUNT, HERO_INDIA_MIN, PUSH_API, SHOW_IMAGES, SITE_NAME, SITE_URL, SOURCES, SUPPORT_TEXT, SUPPORT_URL } from './config'
import { STR } from './strings.js'
import { slug, bindClickEvents } from './analytics.js'

// The Hindi edition lives at /hi/ (its page is written with lang="hi"). Everything visible comes from STR.
const LANG = typeof document !== 'undefined' && document.documentElement.lang === 'hi' ? 'hi' : 'en'
const T = STR[LANG]
const catName = (c) => T.cat[c] || c

const DATA = import.meta.env.BASE_URL + 'data/'

async function getJSON(path) {
  const r = await fetch(DATA + path)
  if (!r.ok) throw new Error(`${path}: ${r.status}`)
  return r.json()
}

// One day for the current language. Hindi = the English day with each story's headline and summary swapped for the approved Hindi.
async function loadDay(entry) {
  if (LANG !== 'hi') return getJSON(entry.file)
  const [en, hi] = await Promise.all([getJSON(`days/${entry.date}.json`), getJSON(entry.file)])
  const by = new Map(hi.stories.map((h) => [h.id, h]))
  return {
    ...en,
    stories: en.stories.filter((s) => by.has(s.id)).map((s) => ({ ...s, titleEn: s.title, title: by.get(s.id).title_hi, summary: by.get(s.id).summary_hi })),
  }
}

function readParams() {
  const p = new URLSearchParams(window.location.search)
  return { region: p.get('region') || 'all', topic: p.get('topic') || 'all', q: p.get('q') || '' }
}

function readTheme() {
  try {
    const v = localStorage.getItem('theme')
    if (v === 'dark' || v === 'light') return v
  } catch { /* storage can be blocked; fall through */ }
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Readers outside India see world stories first. This uses only the time zone their browser reports: no location lookup, nothing is sent to us.
function detectInIndia() {
  try { return /^Asia\/(Kolkata|Calcutta)$/.test(Intl.DateTimeFormat().resolvedOptions().timeZone) } catch { return true }
}
// On a phone the first visit of a session opens straight into the slideshow (not for search-engine crawlers, and not when a filter is in the address).
function shouldOpenSlideshow() {
  const p = new URLSearchParams(window.location.search)
  if (p.get('view') === 'swipe') return true
  if (p.get('view') === 'list' || p.get('region') || p.get('topic') || p.get('q')) return false
  if (/bot|crawl|spider|lighthouse|preview/i.test(navigator.userAgent)) return false
  try {
    if (sessionStorage.getItem('slideshowShown')) return false
    if (window.matchMedia('(max-width: 720px)').matches) { sessionStorage.setItem('slideshowShown', '1'); return true }
  } catch { /* storage blocked: just show the list */ }
  return false
}
const worldFirst = (list) => [...list].sort((a, b) => (b.region === 'world') - (a.region === 'world'))

function dayLabel(date) {
  return new Date(date + 'T12:00:00+05:30').toLocaleDateString(LANG === 'hi' ? 'hi-IN' : 'en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata',
  })
}

function tint(category) {
  let h = 0
  for (const c of category || 'x') h = (h * 31 + c.charCodeAt(0)) % 360
  return `hsl(${h} 32% 38%)`
}

// A story picture, or a plain coloured tile when there is none or it fails to load.
function Pic({ s, className }) {
  const [bad, setBad] = useState(false)
  if (!SHOW_IMAGES || !s.image || bad) {
    return <div className={`ph ${className}`} style={{ background: tint(s.category) }} aria-hidden="true">{(s.category || '?')[0]}</div>
  }
  return <img className={className} src={s.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} />
}

function Dots({ n }) {
  return (
    <span className="dots" role="img" aria-label={`Uplift score ${n} out of 10`} title={`Uplift score ${n}/10`}>
      {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}
    </span>
  )
}

function Meta({ s }) {
  return (
    <div className="meta">
      <span>{s.source}</span>
      <span className="chip">{catName(s.category)}</span>
      <span className={'chip' + (s.region === 'india' ? ' in' : '')}>{s.region === 'india' ? T.india : T.world}</span>
      <Dots n={s.uplift} />
    </div>
  )
}

function Story({ s }) {
  return (
    <article className="card">
      <Pic s={s} className="thumb" />
      <div className="cbody">
        <h3><a href={s.url} target="_blank" rel="noopener noreferrer" data-goatcounter-click={`read-${slug(s.title)}`} data-goatcounter-title={s.title}>{s.title}</a></h3>
        <Meta s={s} />
        <p>{s.summary}</p>
      </div>
    </article>
  )
}

function Showcase({ stories }) {
  const [lead, ...rest] = stories
  if (!lead) return null
  return (
    <section className="hero" aria-label="Top stories">
      <article className="lead">
        <a className="leadlink" href={lead.url} target="_blank" rel="noopener noreferrer" data-goatcounter-click={`read-${slug(lead.title)}`} data-goatcounter-title={lead.title}>
          <Pic s={lead} className="leadpic" />
          <div className="leadtext">
            <span className="chip solid">{catName(lead.category)}</span>
            <h2>{lead.title}</h2>
            <p>{lead.summary}</p>
            <span className="by">{lead.source}{SHOW_IMAGES && lead.image ? T.pictureNote : ''}</span>
          </div>
        </a>
      </article>
      <div className="side">
        {rest.map((s) => (
          <article key={s.id} className="sidecard">
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="sidelink" data-goatcounter-click={`read-${slug(s.title)}`} data-goatcounter-title={s.title}>
              <Pic s={s} className="sidepic" />
              <div>
                <span className="chip">{catName(s.category)}</span>
                <h3>{s.title}</h3>
                <span className="by">{s.source}</span>
              </div>
            </a>
          </article>
        ))}
      </div>
    </section>
  )
}

export default function App() {
  const [index, setIndex] = useState(null)
  const [days, setDays] = useState([])
  useEffect(bindClickEvents, [days])  // story cards render after this fetch; count.js's own scan already ran by then
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [theme, setTheme] = useState(readTheme)
  const [swipe, setSwipe] = useState(shouldOpenSlideshow)
  const [stumble, setStumble] = useState(false)
  const [order, setOrder] = useState(() => (detectInIndia() ? 'india' : 'world'))  // which region leads
  const [{ region, topic, q }, setFilters] = useState(readParams)
  const [hiReady, setHiReady] = useState(LANG === 'hi')  // the language button shows only once a Hindi day has been approved

  useEffect(() => {
    if (LANG === 'hi') return
    getJSON('hi/index.json').then((i) => setHiReady(Array.isArray(i.days) && i.days.length > 0)).catch(() => {})
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('theme', theme) } catch { /* ignore */ }
  }, [theme])

  useEffect(() => {
    const p = new URLSearchParams()
    if (region !== 'all') p.set('region', region)
    if (topic !== 'all') p.set('topic', topic)
    if (q) p.set('q', q)
    const s = p.toString()
    window.history.replaceState(null, '', window.location.pathname + (s ? '?' + s : ''))
  }, [region, topic, q])

  const loadDays = useCallback(async (list, from, count) => {
    setLoading(true)
    try {
      const docs = await Promise.all(list.slice(from, from + count).map(loadDay))
      setDays((prev) => [...prev, ...docs])
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let alive = true
    getJSON(LANG === 'hi' ? 'hi/index.json' : 'index.json')
      .then((idx) => {
        if (!alive) return
        setIndex(idx)
        loadDays(idx.days, 0, DAYS_PER_PAGE)
      })
      .catch((e) => alive && setError(String(e.message || e)))
    return () => { alive = false }
  }, [loadDays])

  const topics = useMemo(() => {
    const c = {}
    days.forEach((d) => d.stories.forEach((s) => { c[s.category] = (c[s.category] || 0) + 1 }))
    return Object.entries(c).sort((a, b) => b[1] - a[1])
  }, [days])

  const filtersActive = region !== 'all' || topic !== 'all' || q.trim() !== ''

  // The showcase: the newest day's strongest stories, preferring ones that have a picture.
  const hero = useMemo(() => {
    if (filtersActive || !days.length) return []
    const ranked = [...days[0].stories].sort((a, b) => (!!b.image - !!a.image) || b.uplift - a.uplift)
    const ordered = order === 'world' ? worldFirst(ranked) : ranked
    const top = ordered.slice(0, HERO_COUNT)
    if (order !== 'world') {
      // make room for India stories the ranking pushed out: swap them in for the weakest non-India ones (never the lead)
      const need = Math.min(HERO_INDIA_MIN, ordered.filter((s) => s.region === 'india').length)
      const extra = ordered.filter((s) => s.region === 'india' && !top.includes(s)).slice(0, Math.max(0, need - top.filter((s) => s.region === 'india').length))
      extra.forEach((e) => {
        for (let i = top.length - 1; i > 0; i--) if (top[i].region !== 'india') { top[i] = e; break }
      })
      top.sort((a, b) => ordered.indexOf(a) - ordered.indexOf(b))
    }
    return top
  }, [days, filtersActive, order])
  const heroIds = useMemo(() => new Set(hero.map((s) => s.id)), [hero])

  const shownDays = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return days
      .map((d) => ({
        ...d,
        stories: (order === 'world' ? worldFirst(d.stories) : d.stories).filter((s) =>
          !heroIds.has(s.id) &&
          (region === 'all' || s.region === region) &&
          (topic === 'all' || s.category === topic) &&
          (!needle || (s.title + ' ' + s.summary + ' ' + s.source).toLowerCase().includes(needle))),
      }))
      .filter((d) => d.stories.length)
  }, [days, region, topic, q, heroIds, order])

  const setFilter = (patch) => setFilters((f) => ({ ...f, ...patch }))
  const more = index && days.length < index.days.length

  return (
    <>
      <header className="top">
        <div className="wrap bar">
          <div className="brand">
            <img className="logo" src="logo.svg" alt="" width="52" height="52" />
            <div>
              <h1>{SITE_NAME}</h1>
              <p className="tag">{T.tagline}</p>
              <p className="ailine">{T.notice} {T.readOriginal} <a href="#about">{T.howLink}</a></p>
            </div>
          </div>
          <div className="actions">
            <button type="button" className="btn" disabled={!days.length} onClick={() => setSwipe(true)}>{T.slideshow}</button>
            {LANG === 'en' && <Notify />}
            <button type="button" className="btn surprise" onClick={() => setStumble(true)}>{T.surpriseMe}</button>
            <ShareButton T={T} url={`${SITE_URL}/${LANG === 'hi' ? 'hi/' : ''}`} title={SITE_NAME} text={T.tagline} />
            {hiReady && <a className="btn" href={T.otherLangHref} lang={LANG === 'en' ? 'hi' : 'en'}>{T.otherLang}</a>}
            <button type="button" className="btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? T.day : T.night}
            </button>
          </div>
        </div>
      </header>

      <main className="wrap">
        <p className="intro">{T.intro}</p>
        <p className="ordernote">
          {order === 'world' ? T.orderWorld : T.orderMixed}{' '}
          <button type="button" className="linkbtn" onClick={() => setOrder(order === 'world' ? 'india' : 'world')}>
            {order === 'world' ? T.switchMixed : T.switchWorld}
          </button>
        </p>
        <Showcase stories={hero} />

        <section className="controls" aria-label="Filters">
          <div className="row" role="group" aria-label="Region">
            {[['all', T.all], ['india', T.india], ['world', T.world]].map(([v, label]) => (
              <button key={v} type="button" className={'btn' + (region === v ? ' on' : '')} aria-pressed={region === v} onClick={() => setFilter({ region: v })}>{label}</button>
            ))}
          </div>
          <div className="row" role="group" aria-label="Topic">
            <button type="button" className={'chipbtn' + (topic === 'all' ? ' on' : '')} aria-pressed={topic === 'all'} onClick={() => setFilter({ topic: 'all' })}>{T.allTopics}</button>
            {topics.map(([t, n]) => (
              <button key={t} type="button" className={'chipbtn' + (topic === t ? ' on' : '')} aria-pressed={topic === t} onClick={() => setFilter({ topic: t })}>{catName(t)} <span>{n}</span></button>
            ))}
          </div>
          <label className="search">
            <span className="sr">{T.search}</span>
            <input type="search" placeholder={T.search} value={q} onChange={(e) => setFilter({ q: e.target.value })} />
          </label>
        </section>

        {error && <p className="msg err">Could not load the stories ({error}). Please try again later.</p>}
        {!error && !index && <p className="msg">{T.loading}</p>}

        {shownDays.map((d, i) => (
          <section key={d.date} className="day">
            <h2>{i === 0 && hero.length ? T.moreFrom : ''}<a href={`${LANG === 'hi' ? 'hi/' : ''}${d.date}/`}>{dayLabel(d.date)}</a> <span>{T.stories(d.stories.length)}</span></h2>
            <div className="grid">{d.stories.map((s) => <Story key={s.id} s={s} />)}</div>
          </section>
        ))}

        {index && days.length > 0 && shownDays.length === 0 && hero.length === 0 && (
          <p className="msg">{T.noMatch}</p>
        )}

        {more && (
          <p className="center">
            <button type="button" className="btn big" disabled={loading} onClick={() => loadDays(index.days, days.length, DAYS_PER_PAGE)}>
              {loading ? T.loading : T.loadOlder}
            </button>
          </p>
        )}
      </main>

      {swipe && days[0] && <Swipe day={days[0]} dayLabel={dayLabel(days[0].date)} Pic={Pic} showImages={SHOW_IMAGES} worldFirst={order === 'world'} T={T} catName={catName} dayUrl={`${SITE_URL}/${LANG === 'hi' ? 'hi/' : ''}${days[0].date}/`} onClose={() => { setSwipe(false); window.scrollTo(0, 0) }} />}

      {stumble && <Stumble onClose={() => setStumble(false)} catName={catName} ShareButton={ShareButton} T={T} siteUrl={`${SITE_URL}/`} dataUrl={DATA} />}

      <footer className="foot">
        <div className="wrap" id="about">
          <h2>{T.aboutTitle}</h2>
          <p>{SITE_NAME} {T.about1}</p>
          <p>
            {T.about2}{' '}{PUSH_API && LANG === 'en' ? 'If you turn on the optional daily notification we keep only your browser’s anonymous push address and the hour you chose, nothing else. ' : ''}{SHOW_IMAGES && LANG === 'en' ? 'Pictures are loaded directly from the publishers’ own sites and belong to them.' : ''}
          </p>
          <p className="src">
            {T.sources}{SOURCES.map(([n, u], i) => (
              <span key={n}>{i > 0 ? ' · ' : ''}<a href={u} target="_blank" rel="noopener noreferrer">{n}</a></span>
            ))}
          </p>
          {SUPPORT_URL && LANG === 'en' && (
            <p className="support">{SUPPORT_TEXT} <a className="btn on" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">Buy us a coffee</a></p>
          )}
          <p className="src"><a href="archive/">{T.archive}</a> · <a href="feed.xml">{T.rss}</a></p>
          <p className="src"><a href="terms/">{T.terms}</a> · <a href="privacy/">{T.privacy}</a> · <a href="refunds/">{T.refunds}</a> · <a href="contact/">{T.contact}</a></p>
          {index && (
            <p className="src">
              {LANG === 'hi'
                ? `${index.days.length} दिन। अंतिम अपडेट: `
                : `${index.total_stories} stories across ${index.days.length} days. Last updated `}
              {new Date(index.updated_at).toLocaleString(LANG === 'hi' ? 'hi-IN' : 'en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST.
            </p>
          )}
        </div>
      </footer>
    </>
  )
}
