// GoatCounter site code (the part before .goatcounter.com). Leave '' to run with no visit counting at all.
// GoatCounter counts page visits without cookies and without storing anything personal. Set this only after the account exists.
export const ANALYTICS_CODE = 'tengoodnews'

// A short id for a story, used as the GoatCounter event name so "Events" in the dashboard breaks down by story
// (which ones get read, which ones get shared) — data we want for deciding what to post on WhatsApp/Telegram later.
export function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

// count.js only scans the page once, when it loads, for elements with data-goatcounter-click. Cards rendered after
// that (the slideshow, "Surprise me", stories that arrive after an async fetch) need a fresh scan, so call this once
// after such content mounts. Safe to call repeatedly: already-bound elements are skipped (elem.dataset.goatcounterBound).
export function bindClickEvents() {
  try { window.goatcounter && window.goatcounter.bind_events && window.goatcounter.bind_events() } catch { /* ignore */ }
}
