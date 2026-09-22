import { useEffect, useMemo, useState } from 'react'
import { slug, bindClickEvents } from './analytics.js'

// "Surprise me": one random good story from the library at a time.
// The reader's topic choice and the stories already shown live in this browser only: no account, nothing is sent anywhere.
const KEY = 'stumbleState'
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} } }
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)) } catch { /* storage blocked: still works, just forgets */ } }

export default function Stumble({ onClose, catName, ShareButton, T, siteUrl, dataUrl }) {
  const [lib, setLib] = useState(null)
  const [err, setErr] = useState('')
  const saved = useMemo(load, [])
  const [topics, setTopics] = useState(saved.topics || [])
  const [region, setRegion] = useState(saved.region || 'all')
  const [seen, setSeen] = useState(saved.seen || [])
  const [trail, setTrail] = useState([]) // stories shown this visit, so "Back" works
  const [pos, setPos] = useState(-1)

  useEffect(() => {
    fetch(dataUrl + 'library.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json() }).then(setLib).catch((e) => setErr(String(e.message || e)))
  }, [dataUrl])

  useEffect(bindClickEvents, [pos])  // re-scan each time a new story's read/share buttons appear

  const cats = useMemo(() => (lib ? [...new Set(lib.stories.map((s) => s.category))].sort() : []), [lib])
  const pool = useMemo(() => (lib ? lib.stories.filter((s) => (!topics.length || topics.includes(s.category)) && (region === 'all' || s.region === region)) : []), [lib, topics, region])

  function next() {
    if (!pool.length) return
    let fresh = pool.filter((s) => !seen.includes(s.id))
    let seenNow = seen
    if (!fresh.length) { fresh = pool; seenNow = [] }   // everything shown: start the round again
    const pick = fresh[Math.floor(Math.random() * fresh.length)]
    const nextSeen = [...seenNow, pick.id]
    setSeen(nextSeen)
    setTrail((t) => [...t.slice(0, pos + 1), pick])
    setPos((p) => p + 1)
    save({ topics, region, seen: nextSeen.slice(-2000) })
  }
  useEffect(() => { if (lib && pos === -1) next() /* first story on opening */ }, [lib]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { save({ topics, region, seen: seen.slice(-2000) }) }, [topics, region]) // eslint-disable-line react-hooks/exhaustive-deps

  const cur = pos >= 0 ? trail[pos] : null
  const toggle = (c) => setTopics((t) => (t.includes(c) ? t.filter((x) => x !== c) : [...t, c]))
  const ago = (iso) => { const y = new Date(iso).getFullYear(); return Number.isFinite(y) ? String(y) : '' }

  return (
    <div className="swipe stumble" role="dialog" aria-label="Surprise me">
      <div className="swtop"><span>Surprise me · {lib ? `${pool.length} of ${lib.count} stories` : '…'}</span><button type="button" className="btn" onClick={onClose}>{T.close}</button></div>
      <div className="stbody">
        <div className="stfilters">
          <div className="row" role="group" aria-label="Region">
            {[['all', T.all], ['india', T.india], ['world', T.world]].map(([v, l]) => (
              <button key={v} type="button" className={'btn' + (region === v ? ' on' : '')} onClick={() => setRegion(v)}>{l}</button>
            ))}
          </div>
          <div className="row" role="group" aria-label="Topics">
            {cats.map((c) => <button key={c} type="button" className={'chipbtn' + (topics.includes(c) ? ' on' : '')} onClick={() => toggle(c)}>{catName(c)}</button>)}
          </div>
        </div>
        {err && <p className="msg err">The library could not be loaded ({err}).</p>}
        {!err && !lib && <p className="msg">{T.loading}</p>}
        {lib && !pool.length && <p className="msg">Nothing matches those topics yet.</p>}
        {cur && (
          <article className="stcard">
            <span className="chip solid">{catName(cur.category)}</span>
            <h2>{cur.title}</h2>
            <p>{cur.summary}</p>
            <span className="by">{cur.source} · {ago(cur.published_at)}</span>
            <div className="slidebtns">
              <a className="btn on readbtn" href={cur.url} target="_blank" rel="noopener noreferrer"
                data-goatcounter-click={`read-${slug(cur.title)}`} data-goatcounter-title={cur.title}>{T.readFull}</a>
              <ShareButton T={T} className="btn readbtn" url={siteUrl} title={cur.title} text={`${cur.title} — ${T.shareText}`} trackId={slug(cur.title)} />
            </div>
          </article>
        )}
        <div className="stnav">
          <button type="button" className="btn" disabled={pos <= 0} onClick={() => setPos((p) => p - 1)}>← Back</button>
          <button type="button" className="btn on big" disabled={!pool.length} onClick={() => (pos < trail.length - 1 ? setPos((p) => p + 1) : next())}>Surprise me →</button>
        </div>
      </div>
    </div>
  )
}
