import { useCallback, useEffect, useMemo, useState } from 'react'
import Notify from './Notify.jsx'
import Swipe from './Swipe.jsx'
import { DAYS_PER_PAGE, HERO_COUNT, INTRO_TEXT, NOTICE_SHORT, PUSH_API, SHOW_IMAGES, SITE_NAME, SOURCES, SUPPORT_TEXT, SUPPORT_URL, TAGLINE } from './config'

const DATA = import.meta.env.BASE_URL + 'data/'

async function getJSON(path) {
  const r = await fetch(DATA + path)
  if (!r.ok) throw new Error(`${path}: ${r.status}`)
  return r.json()
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

function dayLabel(date) {
  return new Date(date + 'T12:00:00+05:30').toLocaleDateString('en-IN', {
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
      <span className="chip">{s.category}</span>
      <span className={'chip' + (s.region === 'india' ? ' in' : '')}>{s.region === 'india' ? 'India' : 'World'}</span>
      <Dots n={s.uplift} />
    </div>
  )
}

function Story({ s }) {
  return (
    <article className="card">
      <Pic s={s} className="thumb" />
      <div className="cbody">
        <h3><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a></h3>
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
        <a className="leadlink" href={lead.url} target="_blank" rel="noopener noreferrer">
          <Pic s={lead} className="leadpic" />
          <div className="leadtext">
            <span className="chip solid">{lead.category}</span>
            <h2>{lead.title}</h2>
            <p>{lead.summary}</p>
            <span className="by">{lead.source}{SHOW_IMAGES && lead.image ? ' · picture from the source' : ''}</span>
          </div>
        </a>
      </article>
      <div className="side">
        {rest.map((s) => (
          <article key={s.id} className="sidecard">
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="sidelink">
              <Pic s={s} className="sidepic" />
              <div>
                <span className="chip">{s.category}</span>
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
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [theme, setTheme] = useState(readTheme)
  const [swipe, setSwipe] = useState(() => new URLSearchParams(window.location.search).get('view') === 'swipe')
  const [{ region, topic, q }, setFilters] = useState(readParams)

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
      const docs = await Promise.all(list.slice(from, from + count).map((d) => getJSON(d.file)))
      setDays((prev) => [...prev, ...docs])
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let alive = true
    getJSON('index.json')
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
    return ranked.slice(0, HERO_COUNT)
  }, [days, filtersActive])
  const heroIds = useMemo(() => new Set(hero.map((s) => s.id)), [hero])

  const shownDays = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return days
      .map((d) => ({
        ...d,
        stories: d.stories.filter((s) =>
          !heroIds.has(s.id) &&
          (region === 'all' || s.region === region) &&
          (topic === 'all' || s.category === topic) &&
          (!needle || (s.title + ' ' + s.summary + ' ' + s.source).toLowerCase().includes(needle))),
      }))
      .filter((d) => d.stories.length)
  }, [days, region, topic, q, heroIds])

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
              <p className="tag">{TAGLINE}</p>
              <p className="ailine">{NOTICE_SHORT} Read the original before you rely on a story. <a href="#about">How this works</a></p>
            </div>
          </div>
          <div className="actions">
            <button type="button" className="btn" disabled={!days.length} onClick={() => setSwipe(true)}>Slideshow</button>
            <Notify />
            <button type="button" className="btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? 'Day mode' : 'Night mode'}
            </button>
          </div>
        </div>
      </header>

      <main className="wrap">
        <p className="intro">{INTRO_TEXT}</p>
        <Showcase stories={hero} />

        <section className="controls" aria-label="Filters">
          <div className="row" role="group" aria-label="Region">
            {[['all', 'All'], ['india', 'India'], ['world', 'World']].map(([v, label]) => (
              <button key={v} type="button" className={'btn' + (region === v ? ' on' : '')} aria-pressed={region === v} onClick={() => setFilter({ region: v })}>{label}</button>
            ))}
          </div>
          <div className="row" role="group" aria-label="Topic">
            <button type="button" className={'chipbtn' + (topic === 'all' ? ' on' : '')} aria-pressed={topic === 'all'} onClick={() => setFilter({ topic: 'all' })}>All topics</button>
            {topics.map(([t, n]) => (
              <button key={t} type="button" className={'chipbtn' + (topic === t ? ' on' : '')} aria-pressed={topic === t} onClick={() => setFilter({ topic: t })}>{t} <span>{n}</span></button>
            ))}
          </div>
          <label className="search">
            <span className="sr">Search stories</span>
            <input type="search" placeholder="Search stories" value={q} onChange={(e) => setFilter({ q: e.target.value })} />
          </label>
        </section>

        {error && <p className="msg err">Could not load the stories ({error}). Please try again later.</p>}
        {!error && !index && <p className="msg">Loading…</p>}

        {shownDays.map((d, i) => (
          <section key={d.date} className="day">
            <h2>{i === 0 && hero.length ? 'More from ' : ''}<a href={`${d.date}/`}>{dayLabel(d.date)}</a> <span>{d.stories.length} {d.stories.length === 1 ? 'story' : 'stories'}</span></h2>
            <div className="grid">{d.stories.map((s) => <Story key={s.id} s={s} />)}</div>
          </section>
        ))}

        {index && days.length > 0 && shownDays.length === 0 && hero.length === 0 && (
          <p className="msg">No stories match these filters{more ? ' in the days loaded so far — try loading older days.' : '.'}</p>
        )}

        {more && (
          <p className="center">
            <button type="button" className="btn big" disabled={loading} onClick={() => loadDays(index.days, days.length, DAYS_PER_PAGE)}>
              {loading ? 'Loading…' : 'Load older days'}
            </button>
          </p>
        )}
      </main>

      {swipe && days[0] && <Swipe day={days[0]} dayLabel={dayLabel(days[0].date)} Pic={Pic} showImages={SHOW_IMAGES} onClose={() => { setSwipe(false); window.scrollTo(0, 0) }} />}

      <footer className="foot">
        <div className="wrap" id="about">
          <h2>How this works</h2>
          <p>
            {SITE_NAME} collects positive stories from the sources below, and a local AI model screens them: it keeps genuine good news
            and drops adverts, tips and sad stories. It publishes at most ten a day. The dots are the model’s 1–10 “uplift” score, based on
            who benefits, how solid the evidence is and how lasting the good is. The screening and the summaries are done by an AI
            model, which can get things wrong, so please read the original story before you rely on it.
          </p>
          <p>
            We do not copy the articles. Each story shows the publisher’s headline, a one-line summary written by the AI, and a link to the
            original. {PUSH_API ? 'If you turn on the optional daily notification we keep only your browser’s anonymous push address and the hour you chose, nothing else. ' : ''}{SHOW_IMAGES ? 'Pictures are loaded directly from the publishers’ own sites and belong to them. ' : ''}All credit belongs
            to the publishers. This site is not affiliated with them.
          </p>
          <p className="src">
            Sources: {SOURCES.map(([n, u], i) => (
              <span key={n}>{i > 0 ? ' · ' : ''}<a href={u} target="_blank" rel="noopener noreferrer">{n}</a></span>
            ))}
          </p>
          {SUPPORT_URL && (
            <p className="support">{SUPPORT_TEXT} <a className="btn on" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">Buy us a coffee</a></p>
          )}
          <p className="src"><a href="archive/">Archive of every day</a> · <a href="feed.xml">RSS feed</a></p>
          <p className="src"><a href="terms/">Terms</a> · <a href="privacy/">Privacy</a> · <a href="refunds/">Refunds</a> · <a href="contact/">Contact</a></p>
          {index && <p className="src">{index.total_stories} stories across {index.days.length} days. Last updated {new Date(index.updated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST.</p>}
        </div>
      </footer>
    </>
  )
}
