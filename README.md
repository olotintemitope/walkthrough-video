# walkthrough-video

Record narrated product walkthrough videos by driving your own app.

One MP4 per chapter, with a title card, burned-in captions, a visible cursor that glides to each
target, a camera that follows it, and spoken narration. It drives the real application — web,
Electron, or a mobile viewport — so what is on screen is the product, not a mockup.

Designed for coding agents such as Codex and Claude, and the scripts are plain Node programs that
also run on their own. `AGENTS.md` and `SKILL.md` describe the agent workflow.

**1080p example:** [Watch the product editor walkthrough](fixtures/camera-check/product-editor-1080p-silent.mp4)
with the visible pointer and click effect.

---

## Why this exists

A screen recorder gives you a file. It does not give you a video that teaches. Four things make
the difference, and each is a piece of this:

- **Playwright records the page, not the OS pointer**, so clicks would be invisible. A cursor is
  drawn into the page and moved alongside the real input.
- **Narration has to match what is on screen.** Each line's audio is rendered first and measured,
  then the recorder holds that step for exactly that long. There is no timeline to edit after.
- **A take must not inherit the last take's data.** Every chapter restores the same database
  snapshot, so a duplicate barcode cannot break a recording.
- **A drawer that opens is not a feature demonstrated.** Chapters complete their actions, and the
  harness reports any chapter that ended on a visible error.

A side effect worth knowing: driving every flow end to end exercises paths no test covers. On its
first real use this turned up a 500 on an optional field left blank, and a printable document with
no page margins that ran off the paper.

## What it drives

| Target | What it is |
| --- | --- |
| `web` | Any URL — Laravel, Rails, Django, a SPA, an admin panel |
| `electron` | A packaged desktop app |
| `web` + `DEVICE` | Mobile, via Playwright device emulation: real viewport, pixel ratio, touch |

Mobile emulation is genuine mobile *web*. It is **not** a native iOS/Android app — a real `.ipa`
or `.apk` needs Appium, which this does not wrap.

## Requirements

- Node 18+
- `ffmpeg` and `ffprobe` on your PATH
- An OpenAI API key, for narration (`gpt-4o-mini-tts`)
- The app you want to film, running locally

```bash
npm install playwright-core
export OPENAI_API_KEY=sk-...
```

> **Point it at a local server.** Chapters create products, orders and staff. Recording against
> production writes all of that into a real business's records — and an action like approving a
> payment on camera approves it for real.

---

## Quick start

### 1. Configure

Everything you need to change is in **`scripts/config.mjs`**:

```js
export const TARGET    = 'web'                          // or 'electron'
export const START_URL = 'http://your-app.test/login'
export const LOGIN     = { email: '...', password: '...' }
export const DEVICE     = null                          // or 'iPhone 14 Pro'
export const DB = { live: '/path/app.sqlite', baseline: './baseline.sqlite' }
export const SEL = { /* your app's selectors — see step 3 */ }
```

### 2. Snapshot your demo data

```bash
cp /path/to/app.sqlite ./baseline.sqlite
```

Pick a moment when the data looks good on camera. It is restored before every chapter, so takes
are repeatable. Set `DB.live` to `null` if there is nothing to reset.

### 3. Survey the app

Never guess selectors — print what is actually there:

```bash
node survey.mjs                    # every section
node survey.mjs --drawers          # also open each form and list its fields
node survey.mjs Products Orders    # only these — start here on a big app
```

Output streams to `survey.txt` as well as the terminal, because Node buffers stdout when piped and
a thirty-section app otherwise looks hung for twenty minutes.

### 4. Write chapters

Copy `chapters.example.mjs` to `chapters.mjs` and rewrite the bodies:

```js
{ id: 'ch01-add-product', title: 'How to add a product', async run(win, ctx) {
    await titleCard(win, 'How to add a product')
    await openTab(win, 'Products', { pause: 1500 })
    await say(ctx, win, 'The catalogue: everything you sell.')
    await click(win, act(win, '+ New product'), { pause: 1300 })
    await type(win, field(win, 'Product name'), 'Northwind 5kW Inverter')
    await say(ctx, win, 'Give it a name the way a customer would say it.')
    await submit(win)                 // true only once the form has closed
    await say(ctx, win, 'And here it is, with no stock.')
    await caption(win)
}}
```

### 5. Record

```bash
node run.mjs                 # every chapter
node run.mjs ch01 ch04       # just these
```

Each chapter prints its duration and line count and warns if it ended on an error. Output lands in
`mp4/<id>.mp4`.

### 6. Assemble a finished product video

Edit the `VIDEO` block in `scripts/config.mjs`. It controls the brand, intro/outro copy, media,
soundtrack, chapter order, and output size in one place. Scenes and music are optional:

```js
export const VIDEO = {
  output: './mp4/product-tour.mp4',
  brand: 'Northstar',
  logo: './assets/logo.png', // optional local image or direct image URL
  chapters: ['ch01-overview', 'ch04-invitations'], // omit to use chapter-file order
  intro: {
    title: 'Meet Northstar',
    subtitle: 'Plan thoughtful work together',
    duration: 1,
    background: { type: 'image', src: './assets/intro.png' },
  },
  outro: {
    title: 'See what your team can do',
    subtitle: 'northstar.example',
    duration: 1,
    background: null, // or { type: 'video', src: './assets/outro.mp4' }
  },
  music: {
    src: './assets/soft-loop.mp3', // local audio or a direct URL; null means no music
    volume: 0.12,
    fadeIn: 1.2,
    fadeOut: 2,
  },
}
```

Use your own image, an image generated for the project, or a direct image URL from Unsplash. Save
AI-generated artwork in `assets/` and point `src` to it. Remote images, video, and music are
downloaded before rendering. Run:

Keep intro and outro cards brief; the example uses one second each so the product footage remains
the focus.

```bash
node scripts/assemble.mjs
```

The assembler joins the selected chapter MP4s with the optional intro and outro, then adds the
optional music bed. It writes one upload-ready file to `VIDEO.output` and keeps the chapter MP4s.
Set `intro` or `outro` to `null`, or `music.src` to `null`, to omit them. High-quality assembly
preserves the detail in the capture, but cannot restore detail missing from the original app.

---

## Writing chapters people actually learn from

- **Complete the action.** `submit()` returns true only once the form has closed — closing is the
  proof it saved. Chapters that merely open forms teach nothing, and a reviewer will notice.
- **Say why before where.** "Stock moves on the Stock side, where every change gets a name and a
  reason against it" beats "click the Stock tab". People keep the reason and rediscover the button.
- **One idea per line.** Each `say()` is a caption as well as a sentence.
- **Name the trap.** The invite link that expires in an hour, the field that looks optional but
  isn't, the button that does nothing until a box is ticked — these are why someone is watching
  instead of clicking around themselves.

## The camera

The frame follows the pointer: each step puts the camera on its target, then returns to the wide
view before the next target. `{ stay: true }` keeps a punch-in across related steps, and a pause
also lets the camera pull back. Nothing is asked of the chapter.

| | |
| --- | --- |
| `ZOOM.action` / `ZOOM.point` / `ZOOM.wide` | how close each kind of step sits |
| `SETTLE` | how long before a pause counts as "stopped" |
| `{ stay: true }` | keep the punch-in across a run of fields in one form |
| `wide(win)` | an explicit context beat |

Two decisions, if you change it. The app is moved inside a `#__stage` the camera transforms while
the pointer and captions stay outside, so captions keep their size and Playwright keeps working
untouched — `boundingBox()` reports where things have been moved to. And the easing runs in the
page on `requestAnimationFrame`; driving it from the recorder would cost a round trip per frame.

## Narration

OpenAI `gpt-4o-mini-tts`. `TTS_VOICE` picks from alloy, ash, ballad, coral, echo, fable, nova,
onyx, sage, shimmer, verse. `TTS_INSTRUCTIONS` steers delivery in plain English and does more for
how it lands than the voice does.

Clips cache on voice + instructions + text, so fixing one sentence re-synthesises one sentence. A
thirteen-chapter set costs a couple of cents.

**Changing the voice re-times the video.** Narration drives the pacing, so a new voice means
re-recording, not re-muxing audio onto the old capture.

## Troubleshooting

| Symptom | What it means |
| --- | --- |
| `no element matched` | The selector is wrong. Re-run the survey; don't just lengthen the wait. |
| `matched N node(s) but none became visible` | It's there but hidden — a collapsed nav group, or an overlay. Different problem. |
| `(no suggestion for "X")` | Typeahead selector wrong, or the term matches nothing in your data. The line was **not** added. |
| `left an error on screen` | The flow failed. Usually demo data; sometimes a real bug. |
| `rows=0` on a page with data | The list is still loading — Livewire and friends fetch after first paint. Raise the pause. |
| Sign-in never completes | Auth endpoints are commonly rate limited. `signIn()` waits out a 60s window and retries once. |

**Collapsed nav groups.** Set `SEL.navGroupToggle` to the group toggle and use `openTab()`. It
opens groups one at a time until the item appears — many sidebars are accordions where opening one
closes the last, so "expand everything" settles on exactly one group. Judge by whether the item
appeared, not by an attribute: some UIs leave `aria-expanded` and `hidden` stale.

**Never film a password.** `signIn()` types the email visibly and fills the password without
keystrokes, for exactly this reason.

---

## Using it as a Claude Code skill

Drop the folder into `.claude/skills/walkthrough-video/` in your project (or
`~/.claude/skills/` for every project). Claude picks it up next session, and asking for "a demo
video of the checkout" or "a training video for the admin side" invokes it.

## Using it as a ChatGPT skill

Upload `chatgpt-skills/walkthrough-video-chatgpt.zip` from ChatGPT's **Skills → Create → Upload
from your computer** flow. The ZIP contains a standalone `SKILL.md` for this repository's product
recording workflow.

## Files

| | |
| --- | --- |
| `SKILL.md` | The repository skill instructions for coding agents |
| `scripts/config.mjs` | **The only file you need to edit** — app, selectors, branding and media |
| `scripts/lib.mjs` | Launch, sign-in, cursor, captions, camera, narration timing |
| `scripts/tts.mjs` | Speech rendering, caching, muxing |
| `scripts/encode.sh` | webm → MP4, auto-oriented, scaled to fit, never stretched |
| `scripts/run.mjs` | Runs chapters, restores the snapshot, encodes, reports |
| `scripts/assemble.mjs` | Joins chapters with optional intro, outro and music |
| `scripts/survey.mjs` | Prints your app's real sections, actions and form fields |
| `chapters.example.mjs` | A complete worked set to copy from |

## Licence

MIT.
