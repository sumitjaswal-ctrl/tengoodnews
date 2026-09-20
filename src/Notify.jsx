import { useEffect, useState } from 'react'
import { PUSH_API, VAPID_PUBLIC_KEY } from './config'

const HOURS = [5, 6, 7, 8, 9, 10, 11]
const label = (h) => `${h % 12 || 12}:00 ${h < 12 ? 'am' : 'pm'}`

function keyBytes(b64) {
  const raw = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}
function savedHour() {
  try { const n = parseInt(localStorage.getItem('notifyHour'), 10); return HOURS.includes(n) ? n : 7 } catch { return 7 }
}
function rememberHour(h) { try { localStorage.setItem('notifyHour', String(h)) } catch { /* storage can be blocked */ } }

const canPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isInstalled = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true

async function post(path, body) {
  const r = await fetch(PUSH_API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`${path} ${r.status}`)
}

// A quiet, opt-in daily message: "today's ten stories are ready". Nothing is asked until the reader clicks.
// Hidden completely until PUSH_API is set in config.js, so it never shows a button that cannot work.
export default function Notify() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState('checking') // checking | idle | on | denied | ios | none
  const [hour, setHour] = useState(savedHour)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!PUSH_API) return undefined
    if (!canPush()) { setState(isIOS() && !isInstalled() ? 'ios' : 'none'); return undefined }
    let alive = true
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => { if (alive) setState(Notification.permission === 'denied' ? 'denied' : sub ? 'on' : 'idle') })
      .catch(() => alive && setState('none'))
    return () => { alive = false }
  }, [])

  if (!PUSH_API || state === 'checking' || state === 'none') return null

  async function turnOn(h) {
    setBusy(true); setMsg('')
    let created = null
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { setState(perm === 'denied' ? 'denied' : 'idle'); return }
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) sub = created = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) })
      await post('/subscribe', { subscription: sub.toJSON(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone, hour: h })
      rememberHour(h); setHour(h); setState('on')
      setMsg(`Done. You will get one message a day at about ${label(h)}, your time.`)
    } catch {
      if (created) { try { await created.unsubscribe() } catch { /* nothing to undo */ } }
      setMsg('Sorry, that did not work. Please try again in a little while.')
    } finally { setBusy(false) }
  }

  async function turnOff() {
    setBusy(true); setMsg('')
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) { await post('/unsubscribe', { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe() }
      setState('idle'); setMsg('Notifications are off.')
    } catch { setMsg('Sorry, that did not work. Please try again.') } finally { setBusy(false) }
  }

  return (
    <div className="notify">
      <button type="button" className={'btn' + (state === 'on' ? ' on' : '')} aria-expanded={open} onClick={() => setOpen(!open)}>
        {state === 'on' ? 'Notifications on' : 'Notify me'}
      </button>
      {open && (
        <div className="npanel" role="dialog" aria-label="Daily notification">
          {state === 'ios' && <p>On iPhone, notifications work once this site is on your Home Screen. Tap Share, then Add to Home Screen, open it from there, and come back to this button.</p>}
          {state === 'denied' && <p>Notifications are blocked for this site in your browser settings. Allow them there, then try again.</p>}
          {(state === 'idle' || state === 'on') && (
            <>
              <p>Get one quiet message a day when the ten stories are ready. Pick your morning hour:</p>
              <div className="nrow">
                <select aria-label="Hour of the morning" value={hour} onChange={(e) => setHour(parseInt(e.target.value, 10))} disabled={busy}>
                  {HOURS.map((h) => <option key={h} value={h}>{label(h)}</option>)}
                </select>
                <button type="button" className="btn on" disabled={busy} onClick={() => turnOn(hour)}>{state === 'on' ? 'Update time' : 'Turn on'}</button>
                {state === 'on' && <button type="button" className="btn" disabled={busy} onClick={turnOff}>Turn off</button>}
              </div>
            </>
          )}
          {msg && <p className="nmsg" role="status">{msg}</p>}
          <p className="nfine">We keep only your browser’s anonymous push address and this hour. No name, no email. Turn it off any time.</p>
        </div>
      )}
    </div>
  )
}
