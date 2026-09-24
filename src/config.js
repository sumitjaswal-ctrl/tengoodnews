export const SITE_NAME = 'Ten Good News'
export const SITE_URL = 'https://tengoodnews.com'
export const TAGLINE = 'Start your day with good news from around the world.'

// The idea in a few lines. It is also written into the static HTML at build time, so search engines see it.
export const INTRO_TEXT =
  'Most feeds are built to keep you scrolling, and an algorithm decides what you see. Ten Good News is different: ' +
  'ten stories a day, the same for everyone. No accounts, no tracking, no endless scroll. An AI screens positive-news ' +
  'publishers for real good news and we keep the ten best. Read them, then get on with your day.'

export const DAYS_PER_PAGE = 5

// Pictures are loaded straight from each publisher's site (hotlinked). Set to false to hide every picture
// (cards and the showcase fall back to plain coloured tiles). Decide before the site goes public.
export const SHOW_IMAGES = true

// Daily "your ten stories are ready" notification (opt-in). The Worker lives in goodnews/push-worker.
// Set PUSH_API to '' (or build with VITE_PUSH_API=) to hide the "Notify me" button.
export const PUSH_API = import.meta.env.VITE_PUSH_API ?? 'https://push.tengoodnews.com'
export const VAPID_PUBLIC_KEY = 'BCcsKf54dqn5NdiV2Qs0Qlz5ahcQPQxnNN2eT88QfZfhW4TOIUQJLfOd_TlNgwmYMWD5srXoftSrIKUXo0O2iks'
export const HERO_COUNT = 4
// How often the showcase rotates which of today's hero stories is in the lead spot (ms). Same 4 stories all day,
// just cycling the spotlight, so it still matches the "same ten stories for everyone" promise.
export const HERO_ROTATE_MS = 16000
// Readers in India (or anyone who picked "India and world together") always get at least this many India stories in the showcase, when the day has them.
export const HERO_INDIA_MIN = 2

// Kept short and quiet on purpose; the footer ("How this works") explains it in full.
export const NOTICE_SHORT = 'AI-screened, may contain errors.'

export const SOURCES = [
  ['Good News Network', 'https://www.goodnewsnetwork.org/'],
  ['Positive News', 'https://www.positive.news/'],
  ['Reasons to be Cheerful', 'https://reasonstobecheerful.world/'],
  ['The Optimist Daily', 'https://www.optimistdaily.com/'],
  ['The Better India', 'https://www.thebetterindia.com/'],
  ['Mongabay India', 'https://india.mongabay.com/'],
  ['YES! Magazine', 'https://www.yesmagazine.org/'],
  ['Upworthy', 'https://www.upworthy.com/'],
  ['Good Good Good', 'https://www.goodgoodgood.co/'],
  ['r/UpliftingNews', 'https://www.reddit.com/r/UpliftingNews/'],
]

// Our public pages, shown in the footer. Plain links, no embedded widgets or third-party scripts.
export const SOCIAL = [
  ['Instagram', 'https://www.instagram.com/tengoodnews/'],
  ['YouTube', 'https://www.youtube.com/@TenGoodNews'],
]

// A "support us" link (Buy Me a Coffee, Ko-fi, a UPI page...). Leave '' and nothing is shown. A plain link only: no embedded widget, so no third-party scripts or tracking.
export const SUPPORT_URL = '' // Razorpay page: https://rzp.io/rzp/iHG2h6ON (set again once live and the public support phone is sorted)
export const SUPPORT_TEXT = 'Made with care, kept free for everyone. Thank you for helping good news travel further.'
