import { useEffect, useRef, useState } from 'react'
import ShareButton from './Share.jsx'

// The whole picture is always shown (nothing cropped, headline text inside pictures stays readable); a blurred copy fills the rest of the frame.
function SlidePic({ s, Pic }) {
  const [bad, setBad] = useState(false)
  if (!s.image || bad) return <Pic s={s} className="slidepic" />
  return (
    <div className="picbox">
      <img className="picbg" src={s.image} alt="" aria-hidden="true" referrerPolicy="no-referrer" />
      <img className="picfg" src={s.image} alt="" referrerPolicy="no-referrer" onError={() => setBad(true)} />
    </div>
  )
}

// A phone-style "one story at a time" view: each story fills the screen, swipe (or scroll, or press an arrow key) for the next.
// Uses the browser's own scroll snapping, so touch, mouse wheel and keyboard all work without extra code.
export default function Swipe({ day, dayLabel, Pic, onClose, showImages, worldFirst, T, catName, dayUrl }) {
  const box = useRef(null)
  const [at, setAt] = useState(0)
  const stories = [...day.stories].sort((a, b) => (worldFirst ? (b.region === 'world') - (a.region === 'world') : 0) || b.uplift - a.uplift)
  const last = stories.length // the closing card

  useEffect(() => {
    const el = box.current
    el.focus()
    const onScroll = () => setAt(Math.round(el.scrollTop / el.clientHeight))
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  // reaching the closing card takes the reader back to the home page after a moment (scrolling back up cancels it)
  useEffect(() => {
    if (at !== last) return undefined
    const t = setTimeout(onClose, 2200)
    return () => clearTimeout(t)
  }, [at, last, onClose])

  const go = (n) => {
    const el = box.current
    el.scrollTo({ top: Math.max(0, Math.min(last, n)) * el.clientHeight, behavior: 'smooth' })
  }

  return (
    <div className="swipe" role="dialog" aria-label={dayLabel}>
      <div className="swtop">
        <span>{at < last ? T.counter(at + 1, stories.length) : T.allDone}</span>
        <button type="button" className="btn" onClick={onClose}>{T.close}</button>
      </div>
      <div className="swscroll" ref={box} tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(at + 1) }
          if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); go(at - 1) }
        }}>
        {stories.map((s, i) => (
          <section className="slide" key={s.id} aria-label={`${i + 1}`}>
            {showImages && <SlidePic s={s} Pic={Pic} />}
            <div className="slidebody">
              <span className="chip solid">{catName(s.category)}</span>
              <h2>{s.title}</h2>
              <p>{s.summary}</p>
              <span className="by">{s.source}</span>
              <div className="slidebtns">
                <a className="btn on readbtn" href={s.url} target="_blank" rel="noopener noreferrer">{T.readFull}</a>
                <ShareButton T={T} className="btn readbtn" url={dayUrl} title={s.title} text={`${s.title} — ${T.shareText}`} />
              </div>
              {i === 0 && <span className="hint">{T.swipeHint}</span>}
            </div>
          </section>
        ))}
        <section className="slide slideend">
          <div className="slidebody">
            <h2>{T.endTitle}</h2>
            <p>{dayLabel}. {T.endBody}</p>
            <button type="button" className="btn on readbtn" onClick={onClose}>{T.endHome}</button>
            <button type="button" className="btn readbtn" onClick={() => go(0)}>{T.endFirst}</button>
          </div>
        </section>
      </div>
      <div className="swnav" aria-hidden={false}>
        <button type="button" className="btn" disabled={at === 0} onClick={() => go(at - 1)} aria-label="Previous story">↑</button>
        <button type="button" className="btn" disabled={at >= last} onClick={() => go(at + 1)} aria-label="Next story">↓</button>
      </div>
    </div>
  )
}
