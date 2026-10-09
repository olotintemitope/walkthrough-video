---
name: walkthrough-video
description: Record narrated product walkthrough videos that navigate an app's features end to end - title cards, burned-in captions, a visible cursor and spoken voiceover, encoded to MP4. Drives web apps (Laravel, Rails, Django, any SPA), desktop Electron apps, and mobile via device emulation. Use this whenever the user wants a demo video, training video, product walkthrough, feature tour, onboarding video, screen recording, tutorial, or anything to "show a client how to use" an app - and also when they ask for a video script or storyboard for software, since the script and the recording come from the same chapters. Not for capturing a bug to attach to an issue, or a one-off screenshot - this teaches someone to use the app.
---

# Narrated feature walkthroughs

Drives a real app with Playwright, records it navigating each feature, and lays narration over the
result. One MP4 per chapter: title card, burned-in captions, visible cursor, spoken voiceover.

The point is a video that teaches, not a screen recording. Four things make the difference, and
each is why a piece of this exists:

- **Playwright records the page, not the OS pointer**, so clicks would be invisible. A cursor is
  drawn into the page and glides to each target before the real click lands.
- **Narration has to match what is on screen.** Each line's audio is rendered first and its
  duration measured, then the recorder holds that step for exactly that long. There is no timeline
  to edit afterwards.
- **A take must not inherit the last take's data.** Every chapter restores the same database
  snapshot, so a duplicate barcode or an already-registered branch cannot break a recording.
- **A drawer that opens is not a feature demonstrated.** Chapters complete their actions, and the
  harness reports any chapter that ended on an error.

## What it drives

| Target | What it is | Notes |
| --- | --- | --- |
| `web` | Any URL — Laravel, Rails, Django, a SPA, an admin panel | The common case |
| `electron` | A packaged desktop app | Isolated profile per take |
| `web` + `DEVICE` | Mobile, via Playwright device emulation | Real viewport, pixel ratio, touch, user agent |

Mobile emulation is genuine mobile *web*: the layout renders as it does in a hand, and the capture
is natively portrait. It is **not** a native iOS/Android app — a real `.ipa` or `.apk` needs
Appium, which this does not wrap. Say so rather than implying otherwise.

## The loop

### 1. Configure

Copy `scripts/` to a working directory (not into the app), then edit **`config.mjs`** — the only
file you should need to change. Set `TARGET`, the start URL or Electron paths, the login, the
selectors, and optionally `DEVICE`.

```bash
npm init -y && npm install playwright-core     # plus ffmpeg and curl
export OPENAI_API_KEY=...                      # narration is gpt-4o-mini-tts
```

**Point it at a local server.** Chapters create products, orders, staff and stock. Recording
against production writes all of that into a real business's records — and an action like
approving a payment on camera approves it for real.

### 2. Snapshot the demo data

```bash
cp /path/to/app.sqlite ./baseline.sqlite     # set DB.live / DB.baseline in config
```

Pick a moment when the data looks good on camera — a few items in each queue, some stock, a
supplier. `run.mjs` restores this before every chapter. Set `DB.live` to `null` if there is no
local database to reset.

### 3. Survey the app

Never guess selectors. This prints what is actually there:

```bash
node survey.mjs                    # every section
node survey.mjs --drawers          # also open each form and list its fields
node survey.mjs Products Orders    # only these - start here on a big app
node survey.mjs --limit 6          # or just the first few
```

Results stream to `survey.txt` as well as the terminal. That matters more than it sounds: Node
buffers stdout when piped, so on an admin panel with thirty-odd sections a run that is working
perfectly prints nothing for twenty minutes and looks hung. Watch the file.

Three traps it already knows about. The first two fail silently rather than erroring, which is what makes them expensive:

- **Nav items carry count badges.** "Approvals" renders as `"Approvals8"`, so a regex anchored at
  both ends never matches. Anchor the start only.
- **Typeahead suggestions have their own class.** Guess it wrong and the picker matches nothing,
  falls through, and you film a form that looks filled in and saves nothing. Take the class from
  the survey output.
- **Nav groups that start collapsed** put an item in the DOM but invisible, so a click waits out
  its whole timeout on an element that is genuinely there. The error distinguishes the two cases:
  "matched N node(s) but none became visible" is a collapsed group or an overlay; "no element
  matched" is a wrong selector.

  Set `SEL.navGroupToggle` to **every** group toggle, open or closed, and use `openTab()` rather
  than `click(win, tab(...))`. It opens groups one at a time until the item it wants appears.
  Two reasons it works that way, both learned the hard way: many sidebars are accordions, where
  opening one group closes the last, so "expand everything" settles on exactly one group however
  you order the clicks; and state attributes lie — Filament animates with Alpine's `x-collapse`
  and leaves both `aria-expanded` and `hidden` stale, so a selector keyed on either reopens and
  recloses the same group forever. Judge by whether the item appeared.

  Avoid a bare `[aria-expanded]`: the sidebar's own collapse control carries it, and clicking that
  hides the whole nav.

  Worked example — Filament: `navGroupToggle: '.fi-sidebar-group-collapse-btn'`.

### 4. Write the chapters

`chapters.example.mjs` is a complete worked set. The shape:

```js
{ id: 'ch06-add-product', title: 'How to add a product', async run(win, ctx) {
    await titleCard(win, 'How to add a product')
    await click(win, tab(win, 'Products'), { pause: 1500 })
    await say(ctx, win, 'The catalogue: everything you sell.')
    await click(win, act(win, '+ New product'), { pause: 1300 })
    await type(win, field(win, 'Product name'), 'Northwind 5kW Inverter')
    await say(ctx, win, 'Give it a name the way a customer would say it.')
    await submit(win)                    // returns true only once the form has closed
    await say(ctx, win, 'And here it is, with no stock.')
    await caption(win)                   // clear the caption before the chapter ends
}}
```

What separates a walkthrough from a click-through:

- **Complete the action.** `submit()` returns false if the button was disabled and true only once
  the drawer has closed — closing is the proof it saved. Chapters that merely open forms teach
  nothing, and a reviewer will notice.
- **Say why before where.** "Stock moves on the Stock side, where every change gets a name and a
  reason against it" beats "click the Stock tab". People keep the reason and rediscover the button.
- **One idea per line.** Each `say()` is a caption as well as a sentence, so it has to be readable
  at a glance.
- **Name the trap.** The invite link that expires in an hour, the field that looks optional but
  isn't, the button that does nothing until a box is ticked — these are why someone is watching
  instead of clicking around themselves.

### 5. Record

```bash
node run.mjs                 # every chapter
node run.mjs ch06 ch11       # just these
```

Each chapter prints its duration and line count, and warns if it ended on an error or if a
typeahead found nothing. Output lands in `mp4/<id>.mp4`.

## The camera

The frame follows the pointer. Each step puts the camera on its target, holds the punch-in while
the pointer keeps working nearby, and pulls back when it stops — so a 14px field is readable on a
phone without the viewer losing where they are.

It needs nothing from the chapter: `click`, `type` and `point` drive it. Three knobs when you want
them:

| | |
| --- | --- |
| `ZOOM.action` / `ZOOM.point` / `ZOOM.wide` | how close each kind of step sits |
| `SETTLE` | how long before a pause counts as "stopped" and pulls back |
| `{ stay: true }` on a step | keep the punch-in; use it across a run of fields in one form |
| `wide(win)` | an explicit context beat |

Two decisions worth knowing if you change it. The app is moved inside a `#__stage` element that the
camera transforms, while the pointer and captions stay outside it — so captions keep their size and
position while the app moves, and Playwright keeps working untouched, because `boundingBox()`
reports where things have been moved to. And the camera is eased in the page on
`requestAnimationFrame`: driving it per-frame over the debugging protocol would cost a round trip a
frame and stutter.

Targets are measured twice per step — once to aim the camera, once after it arrives. Gliding the
pointer to the first reading would send it where the element used to be.

## Reading the output

| Symptom | What it means |
| --- | --- |
| `(no suggestion for "X")` | Typeahead selector is wrong, or the term matches nothing in the demo data. The line was not added — the take is wrong even though it looks fine. |
| `(no "X" on the Y tab - skipped)` | A sub-tab click landed during a re-render. `openAction()` retries three times; if it still fails the label is wrong. |
| `left an error on screen` | The flow failed. Read the message: usually demo data, sometimes a real bug. |
| `no element matched` | The selector is wrong. Re-run the survey — do not just lengthen the wait. |
| `matched N node(s) but none became visible` | The element is there but hidden: a collapsed nav group, or something overlaying it. Different problem, different fix. |
| Sign-in never completes | Auth endpoints are commonly rate limited. `signIn()` waits out a 60s window and retries once. |
| `rows=0` on a page you know has data | The list is probably still loading — Livewire and similar fetch the table after first paint. Raise the pause before suspecting the selector. |

## Things worth knowing

**Filming finds bugs.** Driving every flow end to end exercises paths no test covers. This pipeline
has already turned up a 500 on an optional field left blank, and a printable document with no page
margins that ran off the paper. When a chapter will not complete, suspect a defect before blaming
the data — and tell the user what you found.

**Orientation follows the capture.** A phone profile records portrait and is delivered 1080x1920; a
desktop capture lands 1920x1080. Resist cropping a desktop app into 9:16: it renders at roughly 56%
inside deep bands and is unreadable on the phone it was cropped for. If the user wants vertical,
film mobile.

**Window sizing (Electron).** An app that maximises itself on `ready-to-show` will override a
resize issued immediately, leaving the page a different shape from the video frame. `boot()` waits,
takes the size back, and records at the real viewport so there is no letterbox.

**Never film a password.** `signIn()` types the email visibly and fills the password without
keystrokes, for exactly this reason.

**Voice.** OpenAI's `gpt-4o-mini-tts`. `TTS_VOICE` picks from alloy, ash, ballad, coral, echo,
fable, nova, onyx, sage, shimmer, verse — `onyx` is the default, a level male read that suits
instruction. `TTS_INSTRUCTIONS` steers delivery in plain English and does more for how it lands
than the voice does; the default asks for an unhurried colleague rather than an announcer.
Audition a line or two before committing to a set.

macOS `say` was the original engine and is gone: free and offline, but audibly synthetic, and a
video going to a client cannot sound like a train announcement. The cost of the replacement is
negligible — a full thirteen-chapter set is under two cents — and clips are cached on voice +
instructions + text, so fixing one sentence re-synthesises only that sentence.

**Changing the voice re-times the video.** Narration drives the pacing, so a new engine or voice
means re-recording, not re-muxing the audio onto the old capture. Swapping audio of a different
length onto an existing take desynchronises every step after the first line.

**The script is a by-product.** The `say()` lines in order are the narration script. When someone
asks for a storyboard or shooting script rather than a video, write the chapters anyway and print
the lines — the two artefacts stay in sync because they are the same source.

## Files

| | |
| --- | --- |
| `scripts/config.mjs` | **The only file to edit** — target, URLs, login, selectors, device |
| `scripts/lib.mjs` | Launch, sign-in, drawn cursor, captions, title cards, narration timing |
| `scripts/tts.mjs` | Speech rendering, caching, and muxing audio onto the capture |
| `scripts/encode.sh` | webm → MP4, auto-oriented, scaled to fit and padded, never stretched |
| `scripts/run.mjs` | Runs chapters, restores the snapshot, encodes, reports |
| `scripts/survey.mjs` | Prints the app's real sections, actions and form fields |
| `chapters.example.mjs` | A complete worked set of chapters to copy from |
