/**
 * The only file you need to edit. Everything else is app-agnostic.
 *
 * Works against two kinds of app:
 *
 *   TARGET = 'web'       a site in a browser - Laravel, Rails, Django, a SPA, anything with a URL
 *   TARGET = 'electron'  a packaged desktop app
 *
 * Only the launch differs. The drawn cursor, captions, narration timing, chapters and encoding
 * are identical either way, because they all operate on a Playwright page.
 */
export const TARGET = 'web'

/* --- electron only ------------------------------------------------------- */

/** The Electron app's directory - the one with package.json. */
export const APP = '/Users/you/project/desktop'

/** The Electron binary inside it. On Linux/Windows this is a plain `electron` executable. */
export const BIN = `${APP}/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron`

/* --- web only ------------------------------------------------------------ */

/** Where filming starts. A login page, or the dashboard if the session is already seeded. */
export const START_URL = 'http://your-app.test/login'

/** Headed browsers render fonts and scrollbars the way a viewer will see them. */
export const HEADLESS = true

/**
 * Emulate a phone or tablet, by Playwright device name - 'iPhone 14 Pro', 'Pixel 7',
 * 'iPad Mini'. Leave null to film a desktop browser.
 *
 * This is genuine mobile: the device's viewport, pixel ratio, touch events and user agent, so a
 * responsive layout renders the way it does in a hand. It is the honest way to get a portrait
 * video - a phone is 9:16 natively, where a desktop app letterboxed into 9:16 is unreadable.
 *
 * What it is NOT is a native iOS or Android app. Playwright drives web content; a real .ipa or
 * .apk needs Appium, which this does not wrap.
 */
export const DEVICE = null

/**
 * Where the app should talk to while filming.
 *
 * Point at a LOCAL server. Chapters create products, orders, staff and stock; recording against
 * production writes all of that into a real business's books, and approving a payment on camera
 * approves it for real.
 */
export const SERVER = 'http://your-app.test'

/** Electron only: the env var the app reads its server address from. */
export const SERVER_ENV = 'POS_SERVER_URL'

/** The account to film as - normally the most privileged, so every section is visible. */
export const LOGIN = { email: 'admin@example.test', password: 'password' }

/**
 * A snapshot of the demo database, restored before every chapter.
 *
 * Without it, take two trips over what take one created: a barcode already used, a branch already
 * registered. Set to null if the app has no local database.
 */
export const DB = {
  live: '/Users/you/project/database/database.sqlite',
  baseline: './baseline.sqlite',
}

/**
 * Recording size, for desktop. 1920x1080 is the sweet spot: readable, and a sane file.
 * Ignored when DEVICE is set - the device's own viewport wins, which is the point of it.
 */
export const SIZE = { width: 1920, height: 1080 }

/**
 * Optional, project-level finishing. Edit this block to brand the final video without touching
 * recorder code. Leave a scene null or music.src null to omit it. Backgrounds accept a local
 * file or direct URL; use a generated image saved in the project or an Unsplash image URL.
 * For a video background, use { type: 'video', src: '...' }.
 */
export const VIDEO = {
  output: './mp4/product-tour.mp4',
  width: 1920,
  height: 1080,
  brand: 'Your product',
  logo: null, // './assets/logo.png' or a direct image URL
  // Optional IDs in presentation order. Omit or leave empty to use CHAPTERS order.
  chapters: [],
  intro: null, // { title: 'Feature name', subtitle: 'What it helps you do', duration: 1, background: { type: 'image', src: './assets/intro.jpg' } },
  outro: null, // { title: 'Ready to get started?', subtitle: 'your-site.com', duration: 1, background: { type: 'video', src: './assets/outro.mp4' } },
  music: {
    src: null, // './assets/music.mp3' or a direct audio URL
    volume: 0.12,
    fadeIn: 1.2,
    fadeOut: 2,
  },
}

/**
 * Selectors. These are the app's own class names - get them from `node survey.mjs`, never by
 * guessing. The values below are one app's; yours will differ in every one of them.
 */
export const SEL = {
  // Sign-in. For a web app these are usually `form`, `input[name=email]`, `input[name=password]`
  // and an error element; `signinVisible` is whatever only exists while signed out.
  signinForm: '#signin-form',
  signinEmail: '#email',
  signinPassword: '#password',
  signinVisible: '#signin:not([hidden])',
  signinError: '#signin-error',

  // An optional post-sign-in picker (which branch/tenant/workspace). Leave null if there is none.
  picker: { visible: '#lock:not([hidden])', select: '#lock-warehouse', confirm: '#lock-confirm', prefer: /main/i },

  // The screen the chapters navigate. `tabs` is the nav container, `body` the pane it swaps.
  tabs: '#admin-tabs',
  tabItem: '.admin-tab',

  // Collapsible nav groups, if this app has them and they start closed. An item inside a closed
  // group is in the DOM but invisible, so a click on it waits out its full timeout - which reads
  // like a wrong selector when the selector was right.
  //
  // Name EVERY group toggle, open or closed - reveal() works out which one it needs by whether
  // the item it wants appears, not by reading an attribute. That matters: Filament animates with
  // Alpine's x-collapse and leaves both aria-expanded and `hidden` stale, so a selector keyed on
  // either reopens and recloses one group forever. Filament: '.fi-sidebar-group-collapse-btn'.
  // Avoid a bare '[aria-expanded]' - the sidebar's own collapse control carries it, and clicking
  // that hides the whole nav. null means this app has no collapsing groups.
  navGroupToggle: null,
  body: '#admin-body',

  // How to get from the app's default screen into the one being filmed. Leave null if it opens there.
  enter: { button: '#mode-admin', ready: '#admin:not([hidden])' },

  subTab: '.afilter, .admin-tab',   // sub-tabs and filter pills within a section
  action: '.abtn',                  // "+ New thing" buttons
  // A clickable list row. 'tbody tr' covers most table UIs. If the survey reports rows=0 on a
  // page you know has data, the list is probably still loading - Livewire and friends fetch the
  // table after first paint - so raise the chapter's pause before blaming the selector.
  row: '.arow, tbody tr',
  drawer: '.panel.drawer',          // the slide-over / modal a form lives in
  submit: '.go',                    // that form's primary action
  suggestion: '.suggest-row',       // a typeahead result
}
