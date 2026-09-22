import { useEffect, useRef, useState } from 'react'

// On a phone (touch screen with the system share sheet) the button opens that sheet; on a computer it copies the link.
const canShareSheet = () =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function' &&
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch { /* fall through to the old way (some browsers block the clipboard API) */ }
  try {
    const box = document.createElement('textarea')
    box.value = text
    box.setAttribute('readonly', '')
    box.style.position = 'fixed'
    box.style.opacity = '0'
    document.body.appendChild(box)
    box.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(box)
    return ok
  } catch { return false }
}

export default function ShareButton({ T, url, title, text, className = 'btn', trackId = 'site' }) {
  const [state, setState] = useState('idle') // idle | copied | failed
  const timer = useRef(0)
  const native = canShareSheet()
  useEffect(() => () => clearTimeout(timer.current), [])

  const flash = (s) => { setState(s); clearTimeout(timer.current); timer.current = setTimeout(() => setState('idle'), 2200) }

  async function onClick() {
    if (native) {
      try { await navigator.share({ title, text, url }) } catch { /* the reader closed the sheet: nothing to do */ }
      return
    }
    flash((await copyText(url)) ? 'copied' : 'failed')
  }

  return (
    <button type="button" className={className} onClick={onClick} aria-live="polite"
      data-goatcounter-click={`share-${trackId}`} data-goatcounter-title={title}>
      {state === 'copied' ? T.copied : state === 'failed' ? T.copyFailed : native ? T.share : T.copyLink}
    </button>
  )
}
