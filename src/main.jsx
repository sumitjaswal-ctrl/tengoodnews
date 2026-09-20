import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import { ANALYTICS_CODE } from './analytics.js'

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // Lets the site install like an app and open offline. Pages and data are network-first, so new stories always win.
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}))
}

if (ANALYTICS_CODE && import.meta.env.PROD && location.hostname.endsWith('tengoodnews.com') && navigator.doNotTrack !== '1') {
  const el = document.createElement('script')
  el.async = true
  el.src = 'https://gc.zgo.at/count.js'
  el.dataset.goatcounter = `https://${ANALYTICS_CODE}.goatcounter.com/count`
  document.head.appendChild(el)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
