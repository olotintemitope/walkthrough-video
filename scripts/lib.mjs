import { _electron as electron, chromium, devices } from 'playwright-core'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { render } from './tts.mjs'
import path from 'node:path'

import { TARGET, APP, BIN, SERVER, SERVER_ENV, START_URL, HEADLESS, DEVICE, LOGIN, SIZE, SEL } from './config.mjs'

export { TARGET, APP, BIN, SERVER, LOGIN, SEL }

/** Capture Chrome's PNG screencast frames and encode them once at delivery quality. */
export async function startHighQualityCapture(win, dir, view) {
  const cdp = await win.context().newCDPSession(win)
  const portrait = view.h > view.w
  const outputSize = portrait ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 }
  const output = path.join(dir, 'capture-silent.mp4')
  const vf = `scale=${outputSize.width}:${outputSize.height}:force_original_aspect_ratio=decrease,pad=${outputSize.width}:${outputSize.height}:(ow-iw)/2:(oh-ih)/2:color=0xEAEDED,format=yuv420p`
  const ffmpeg = spawn('ffmpeg', [
    '-nostdin', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', '30', '-vcodec', 'png', '-i', 'pipe:0',
    '-vf', vf, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '13', '-r', '30',
    '-movflags', '+faststart', '-an', output,
  ], { stdio: ['pipe', 'ignore', 'pipe'] })

  let latestFrame = null
  let frameCount = 0
  let stderr = ''
  let stopped = false
  let finalPath = null
  ffmpeg.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-3000) })
  const completion = new Promise((resolve, reject) => {
    ffmpeg.once('error', reject)
    ffmpeg.once('close', resolve)
  })
  const startedAt = Date.now()

  cdp.on('Page.screencastFrame', ({ data, sessionId }) => {
    latestFrame = Buffer.from(data, 'base64')
    frameCount++
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  })

  await cdp.send('Page.enable')
  await cdp.send('Page.startScreencast', {
    format: 'png', maxWidth: view.w, maxHeight: view.h, everyNthFrame: 1,
  })

  // CDP sends frames only when the page changes. Write the latest frame at a fixed
  // cadence so pauses and narration keep their real duration in the final video.
  const timer = setInterval(() => {
    if (latestFrame && !ffmpeg.stdin.destroyed) ffmpeg.stdin.write(latestFrame)
  }, 1000 / 30)

  return {
    startedAt,
    async stop(name) {
      if (stopped) return finalPath
      stopped = true
      clearInterval(timer)
      await cdp.send('Page.stopScreencast').catch(() => {})
      await cdp.detach().catch(() => {})
      ffmpeg.stdin.end()
      const code = await completion
      if (code !== 0) throw new Error(`high-quality capture failed${stderr ? `: ${stderr}` : ''}`)
      if (!frameCount) throw new Error('high-quality capture produced no frames')
      finalPath = path.join(dir, `${name}-silent.mp4`)
      fs.renameSync(output, finalPath)
      return finalPath
    },
  }
}

/** Playwright records the page, not the OS pointer, so a tutorial would have invisible clicks.
 *  This draws one in the page and drives it alongside the real input. */
const CURSOR = `
(() => {
  if (document.getElementById('__cur')) return

  /* The app goes inside a stage the camera can move; the cursor and captions stay outside it.
     That split is what makes a following camera workable at all - the stage scales, while the
     pointer and the words sit in frame coordinates and keep their size. It also means Playwright
     keeps working untouched: boundingBox() reports where things have been moved to, so clicks
     and pointer positions come out right through any transform without a line of extra maths. */
  const stage = document.createElement('div')
  stage.id = '__stage'
  stage.style.cssText = 'transform-origin:0 0;will-change:transform'
  while (document.body.firstChild) stage.appendChild(document.body.firstChild)
  document.body.appendChild(stage)

  const s = document.createElement('style')
  s.textContent = \`
    #__cur{position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;
      transform:translate(-2px,-2px);transition:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}
    #__ring{position:fixed;left:0;top:0;width:44px;height:44px;border-radius:50%;z-index:2147483646;
      pointer-events:none;border:3px solid #F5A524;opacity:0;transform:translate(-50%,-50%) scale(.4)}
    #__ring.go{animation:__r .45s ease-out}
    @keyframes __r{0%{opacity:.95;transform:translate(-50%,-50%) scale(.4)}
                   100%{opacity:0;transform:translate(-50%,-50%) scale(1.5)}}
    #__cap{position:fixed;left:50%;bottom:38px;transform:translateX(-50%);z-index:2147483645;
      pointer-events:none;max-width:76vw;padding:14px 28px;border-radius:8px;
      background:rgba(20,24,33,.93);color:#fff;font:600 26px/1.35 Inter,system-ui,sans-serif;
      text-align:center;opacity:0;transition:opacity .25s ease;box-shadow:0 8px 26px rgba(0,0,0,.3)}
    #__card{position:fixed;inset:0;z-index:2147483644;pointer-events:none;display:flex;
      align-items:center;justify-content:center;background:rgba(20,24,33,.92);
      opacity:0;transition:opacity .35s ease}
    #__card span{color:#fff;font:800 62px/1.2 Poppins,Inter,system-ui,sans-serif;
      letter-spacing:-.02em;text-align:center;max-width:70vw}\`
  document.head.appendChild(s)

  const c = document.createElement('div')
  c.id = '__cur'
  c.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 2l14 10.5-6.2.6 3.4 7.1-2.9 1.4-3.4-7.1L5 19z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>'
  document.body.appendChild(c)
  const r = document.createElement('div'); r.id = '__ring'; document.body.appendChild(r)
  const cap = document.createElement('div'); cap.id = '__cap'; document.body.appendChild(cap)
  const card = document.createElement('div'); card.id = '__card'
  card.innerHTML = '<span></span>'; document.body.appendChild(card)

  window.__cur = (x, y) => { c.style.left = x + 'px'; c.style.top = y + 'px' }
  window.__ring = (x, y) => { r.style.left = x + 'px'; r.style.top = y + 'px'; r.classList.remove('go'); void r.offsetWidth; r.classList.add('go') }
  window.__caption = (t) => { cap.textContent = t || ''; cap.style.opacity = t ? '1' : '0' }
  window.__title = (t) => { card.firstChild.textContent = t || ''; card.style.opacity = t ? '1' : '0' }
  window.__cur(640, 420)

  /* The camera. Eased every frame towards a target rather than jumped, because the movement is
     the point: a cut that snaps between crops reads as a slideshow, where a slow follow reads as
     someone showing you their screen. Runs in the page on rAF - driving it per-frame over the
     debugging protocol would cost a round trip per frame and stutter. */
  const cam = { x: 0, y: 0, k: 1, tx: 0, ty: 0, tk: 1, timer: 0 }
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi)

  function frame() {
    // Critically damped feel: fast enough to keep up with the pointer, slow enough to read.
    cam.k += (cam.tk - cam.k) * (cam.tk < cam.k ? 0.13 : 0.08)   // out faster than in
    cam.x += (cam.tx - cam.x) * 0.10
    cam.y += (cam.ty - cam.y) * 0.10

    const vw = window.innerWidth, vh = window.innerHeight
    const sw = Math.max(stage.scrollWidth, vw), sh = Math.max(stage.scrollHeight, vh)
    const sx = window.scrollX, sy = window.scrollY
    // Hold the focus point in the middle, then refuse to show anything past the page edges -
    // letterboxing the app against its own background is the one thing that looks broken.
    let dx = vw / 2 + sx - cam.x * cam.k
    let dy = vh / 2 + sy - cam.y * cam.k
    // Translation is in viewport coordinates while stage content lives in document
    // coordinates. Include scroll offsets and the real stage size when limiting travel.
    dx = clamp(dx, vw + sx - sw * cam.k, sx)
    dy = clamp(dy, vh + sy - sh * cam.k, sy)
    stage.style.transform = \`translate(\${dx}px, \${dy}px) scale(\${cam.k})\`
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  /* Look at a point given in frame coordinates - which is what boundingBox() hands back - and
     convert it to a point on the page, so the camera keeps tracking it as it moves. */
  window.__look = (sx, sy, k) => {
    clearTimeout(cam.timer)
    const t = new DOMMatrix(getComputedStyle(stage).transform)
    // boundingBox() is viewport-relative; undo both the page scroll and stage transform.
    cam.tx = (sx + window.scrollX - t.e) / t.a
    cam.ty = (sy + window.scrollY - t.f) / t.d
    if (typeof k === 'number') cam.tk = k
  }
  window.__zoom = (k) => { clearTimeout(cam.timer); cam.tk = k }

  /* Pull back, but not instantly - and not at all if the pointer goes somewhere else first.
     Working through six fields of one form should not breathe in and out six times; stopping
     should bring the whole screen back. The timer is what tells those two apart, and any new
     focus cancels it. */
  window.__release = (after) => {
    clearTimeout(cam.timer)
    cam.timer = setTimeout(() => { cam.tk = 1 }, after)
  }
  window.__camState = () => ({ ...cam })
})()`

/**
 * Launch whichever kind of app this is and start recording.
 *
 * Returns the same shape either way - `{ win, close, t0, cues }` - so nothing downstream has to
 * care. `win` is a Playwright page in both cases, which is why the cursor, captions and chapters
 * are written once and work against a desktop app and a website alike.
 *
 * `t0` marks the start of the captured take: narration offsets are measured from it so the voice
 * lands on the frame the action happens.
 */
export async function boot({ dir, size = SIZE } = {}) {
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })

  const recordVideo = { dir, size }
  let t0 = Date.now()
  let win, close, capture

  if (TARGET === 'electron') {
    // An isolated profile per take. Share one and the app remembers the last session, so the
    // picker never appears and the take opens on whatever the previous chapter chose.
    const profile = path.join(dir, 'profile')
    fs.mkdirSync(profile, { recursive: true })

    const app = await electron.launch({
      args: ['.', `--user-data-dir=${profile}`], cwd: APP, executablePath: BIN,
      env: { ...process.env, [SERVER_ENV]: SERVER },
      recordVideo,
    })
    win = await app.firstWindow()

    // An app that maximises itself on ready-to-show overrides a resize issued immediately, and
    // the page then differs in shape from the video frame. Let it settle, then take the size back.
    await win.waitForTimeout(2500)
    await app.evaluate(async ({ BrowserWindow }, s) => {
      const w = BrowserWindow.getAllWindows()[0]
      if (w.isMaximized()) w.unmaximize()
      w.setContentSize(s.width, s.height)
      w.center()
    }, size)
    await win.waitForTimeout(1800)
    close = () => app.close()
  } else {
    const browser = await chromium.launch({ headless: HEADLESS })
    // A device profile brings its own viewport, pixel ratio, touch and user agent. Recording at
    // deviceScaleFactor 1 keeps the file sane; the layout is still the phone's.
    const profile = DEVICE ? devices[DEVICE] : null
    if (DEVICE && !profile) throw new Error(`Unknown DEVICE "${DEVICE}" - see Playwright's device list`)
    const ctx = await browser.newContext({
      ...(profile ?? {}),
      viewport: profile?.viewport ?? size,
      // Keep desktop's CSS pixels one-to-one with the 1080p capture; the source UI reads
      // more cleanly without being resampled from a 2x backing store.
      deviceScaleFactor: 1,
    })
    win = await ctx.newPage()
    const initialView = await win.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }))
    capture = await startHighQualityCapture(win, dir, initialView)
    t0 = capture.startedAt
    await win.goto(START_URL, { waitUntil: 'networkidle' }).catch(() => {})
    await win.waitForTimeout(1200)
    close = async () => {
      await capture?.stop(path.basename(dir)).catch(() => {})
      await ctx.close()
      await browser.close()
    }
  }

  const view = await win.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }))
  fs.writeFileSync(path.join(dir, 'viewport.json'), JSON.stringify(view))

  return { win, close, size, view, t0, cues: [], capture }
}

export const cursorOn = (win) => win.evaluate(CURSOR).catch(() => {})

/**
 * Speak a line: show it as a caption, hold for exactly as long as the audio runs, and note
 * where in the take it belongs so the voice can be laid on afterwards.
 *
 * Driving the pace from the audio rather than the other way round is what keeps the narration
 * and the pointer together without anybody editing a timeline.
 */
export async function say(ctx, win, text, { lead = 250, tail = 450 } = {}) {
  const { file, secs } = render(text)
  await caption(win, text)
  ctx.cues.push({ file, at: Date.now() - ctx.t0 + lead })
  await win.waitForTimeout(Math.round(secs * 1000) + lead + tail)
}

/** A step caption along the bottom. Pass nothing to clear it. */
export async function caption(win, text = '') {
  await cursorOn(win)
  await win.evaluate((t) => window.__caption?.(t), text).catch(() => {})
  if (text) await win.waitForTimeout(450)
}

/** A full-screen title card - "How to add a product" - to open a chapter on. */
export async function titleCard(win, text, ms = 2200) {
  await cursorOn(win)
  await win.evaluate((k) => window.__zoom?.(k), ZOOM.wide).catch(() => {})
  await win.evaluate((t) => window.__title?.(t), text).catch(() => {})
  await win.waitForTimeout(ms)
  await win.evaluate(() => window.__title?.(''), null).catch(() => {})
  await win.waitForTimeout(500)
}

/** Glide the drawn pointer to a point, so the eye can follow it between clicks. */
export async function glide(win, x, y, ms = 650) {
  const from = await win.evaluate(() => {
    const c = document.getElementById('__cur')
    return c ? [parseFloat(c.style.left) || 640, parseFloat(c.style.top) || 420] : [640, 420]
  })
  const steps = Math.max(12, Math.round(ms / 16))
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2 // ease-in-out
    const cx = from[0] + (x - from[0]) * e
    const cy = from[1] + (y - from[1]) * e
    await win.evaluate(([a, b]) => { window.__cur?.(a, b); window.__look?.(a, b) }, [cx, cy])
    await win.waitForTimeout(16)
  }
}

/** Wait until the compositor camera has finished moving before text is entered. */
async function settleCamera(win, { stable = 100, timeout = 1800 } = {}) {
  await win.evaluate(({ stable, timeout }) => new Promise((resolve) => {
    const start = performance.now()
    let stillSince = null
    const check = () => {
      const now = performance.now()
      const c = window.__camState?.()
      if (!c || now - start >= timeout) return resolve()
      const moving = Math.abs(c.k - c.tk) > 0.003
        || Math.abs(c.x - c.tx) > 0.75
        || Math.abs(c.y - c.ty) > 0.75
      if (moving) stillSince = null
      else {
        stillSince ??= now
        if (now - stillSince >= stable) return resolve()
      }
      requestAnimationFrame(check)
    }
    requestAnimationFrame(check)
  }), { stable, timeout })
}

/* How close the camera sits. Working shots punch in; a title card or an explicit wide beat pulls
   back so the viewer can see where they are. Tuned so a 14px field is comfortable on a phone
   without the surrounding screen disappearing. */
export const ZOOM = { action: 1.45, point: 1.3, wide: 1 }

/* How long the camera waits, after a step finishes, before deciding the pointer has really
   stopped and pulling back. Long enough to carry straight on to the next field without a
   breath; short enough that a pause genuinely returns you to the whole screen. */
export const SETTLE = 900

/**
 * Put the camera on something and wait for it to arrive, then report where it ended up.
 *
 * Measuring twice is the whole trick: the first read says where the element is now, the camera
 * moves, and the second says where it has been moved to. Gliding the pointer to the first
 * reading would send it to where the element used to be.
 */
async function focusOn(win, locator, k, stay = false) {
  const currentScale = await win.evaluate(() => window.__camState?.().k ?? 1)
  if (!stay && currentScale > 1.02) await wide(win, { ms: 450 })
  await locator.first().scrollIntoViewIfNeeded().catch(() => {})
  await win.waitForTimeout(180)

  const firstBox = await box(locator)
  let x = firstBox.x + firstBox.width / 2
  let y = firstBox.y + firstBox.height / 2
  const { vw, vh, settledScale } = await win.evaluate(() => ({
    vw: window.innerWidth,
    vh: window.innerHeight,
    settledScale: window.__camState?.().k ?? 1,
  }))
  // Keep the whole target in frame with a little breathing room. Small targets retain
  // the configured punch-in; large controls, drawers, and phone layouts zoom less.
  const framingScale = Math.min(
    k,
    (vw * 0.82 * settledScale) / Math.max(firstBox.width, 1),
    (vh * 0.72 * settledScale) / Math.max(firstBox.height, 1),
  )
  const targetScale = Math.max(1, framingScale)
  await win.evaluate(([a, b, kk]) => window.__look?.(a, b, kk), [x, y, targetScale])
  await win.waitForTimeout(650)
  ;[x, y] = await centre(locator)
  // Scrolling and responsive layouts can shift the target while the zoom settles.
  // Re-aim from its transformed position so that drift does not carry into the glide.
  await win.evaluate(([a, b, kk]) => window.__look?.(a, b, kk), [x, y, targetScale])
  await win.waitForTimeout(350)
  ;[x, y] = await centre(locator)
  return [x, y]
}

/** Pull back to the whole screen - for a title card, or a beat that needs context. */
export async function wide(win, { ms = 700 } = {}) {
  await win.evaluate((k) => window.__zoom?.(k), ZOOM.wide)
  await win.waitForTimeout(ms)
}

/**
 * Let go: the pointer is done here, so come back out.
 *
 * Issued without waiting, so the pull-back runs underneath whatever the step does next instead
 * of adding a pause to it. Holding the punch-in until some later cue leaves the viewer staring
 * at a corner of a screen they have finished with, which reads as the camera being stuck.
 *
 * Pass stay:true on a step that is part of a run in the same place - filling six fields in one
 * form should not breathe in and out six times.
 */
async function release(win, stay) {
  if (stay) return
  await win.evaluate((ms) => window.__release?.(ms), SETTLE).catch(() => {})
}

/** The drawer rebuilds its own DOM on every state change (Suggest, a field edit), so a box
 *  measured a moment too early comes back null. Wait for it to settle, then measure. */
async function centre(locator) {
  try {
    await locator.first().waitFor({ state: 'visible', timeout: 15000 })
  } catch (e) {
    // "exists but never became visible" and "matched nothing" are different problems with the
    // same timeout, and confusing them costs an hour. The usual cause of the first is a nav
    // group that starts collapsed - see SEL.navGroupToggle.
    const present = await locator.count().catch(() => 0)
    throw new Error(present
      ? `element matched ${present} node(s) but none became visible - collapsed nav group, or hidden behind an overlay?`
      : 'no element matched - re-run survey.mjs, the selector is wrong')
  }
  for (let i = 0; i < 25; i++) {
    const box = await locator.first().boundingBox()
    if (box && box.width > 0 && box.height > 0) return [box.x + box.width / 2, box.y + box.height / 2]
    await new Promise((r) => setTimeout(r, 120))
  }
  throw new Error('element never settled into a box')
}

async function box(locator) {
  await locator.first().waitFor({ state: 'visible', timeout: 15000 }).catch(async () => {
    // Preserve centre()'s helpful distinction between a missing and hidden element.
    await centre(locator)
  })
  for (let i = 0; i < 25; i++) {
    const value = await locator.first().boundingBox()
    if (value && value.width > 0 && value.height > 0) return value
    await new Promise((r) => setTimeout(r, 120))
  }
  throw new Error('element never settled into a box')
}

/** Move the pointer there, ripple, then really click it. */
export async function click(win, locator, { pause = 500, moveMs = 650, zoom = ZOOM.action, stay = false } = {}) {
  let [x, y] = await focusOn(win, locator, zoom, stay)
  await glide(win, x, y, moveMs)
  // The camera follows the animated cursor during the glide. Its last few eased frames can
  // still move the target after the glide has finished, so remeasure only after it settles.
  await settleCamera(win)
  ;[x, y] = await centre(locator)
  await win.evaluate(([a, b]) => window.__cur?.(a, b), [x, y])
  await win.mouse.move(x, y)
  await win.evaluate(([a, b]) => window.__ring?.(a, b), [x, y])
  await win.waitForTimeout(220)
  // Locator.click() silently moves Playwright's real mouse after the drawn cursor was placed.
  // Click at the freshly measured point instead, keeping both pointers registered.
  await win.mouse.click(x, y)
  await release(win, stay)
  await win.waitForTimeout(pause)
}

/** Type at a human pace so the viewer can read it going in. */
export async function type(win, locator, text, { delay = 55, pause = 350, zoom = ZOOM.action, stay = false } = {}) {
  let [x, y] = await focusOn(win, locator, zoom, stay)
  await glide(win, x, y, 500)
  await settleCamera(win)
  ;[x, y] = await centre(locator)
  await win.evaluate(([a, b]) => window.__cur?.(a, b), [x, y])
  await win.mouse.move(x, y)
  await win.evaluate(([a, b]) => window.__ring?.(a, b), [x, y])
  await win.mouse.click(x, y)
  await win.waitForTimeout(200)
  // Clicking can trigger scroll anchoring or a focus-driven layout change. Let that finish
  // before the first glyph appears, so text is not captured while the stage is still rescaling.
  await settleCamera(win)
  await locator.first().fill('')
  await locator.first().type(text, { delay })
  await release(win, stay)
  await win.waitForTimeout(pause)
}

/**
 * Punch in on something, so a 14px field is readable on a phone.
 *
 * Done as a transform on the document rather than by cropping in post, which means the drawn
 * cursor, the captions and the app all scale together and stay registered with each other - and
 * you can see the result while the take is running instead of discovering it at encode time.
 *
 * The origin is the element's own centre in page coordinates, so the thing you are talking about
 * stays put while everything else grows around it. Clamped so the zoom cannot pull the page off
 * its own edges and reveal background.
 */
/** Park the pointer on something without clicking - for "look at this" moments. */
export async function point(win, locator, { hold = 900, zoom = ZOOM.point, stay = false } = {}) {
  let [x, y] = await focusOn(win, locator, zoom, stay)
  await glide(win, x, y, 700)
  await settleCamera(win)
  ;[x, y] = await centre(locator)
  await win.evaluate(([a, b]) => window.__cur?.(a, b), [x, y])
  await win.mouse.move(x, y)
  await win.waitForTimeout(hold)
  await release(win, stay)
}

export async function signIn(ctx, win) {
  await cursorOn(win)
  await win.waitForTimeout(600)

  if (await win.locator(SEL.signinVisible).count()) {
    await type(win, win.locator(SEL.signinEmail), LOGIN.email, { delay: 45 })
    // Typed without keystrokes on purpose: a password must never appear in a video.
    await win.locator(SEL.signinPassword).fill(LOGIN.password)
    await win.waitForTimeout(300)
    await click(win, win.locator(`${SEL.signinForm} button[type=submit]`)).catch(async () => {
      await click(win, win.locator(`${SEL.signinForm} button`).first())
    })
  }

  // /auth/token is throttle:10,1. A batch of takes plus a probe or two can trip it, and the
  // symptom is a sign-in screen that simply stays put - so wait out the window and try once more
  // rather than failing the chapter on someone else's rate limit.
  await win.waitForTimeout(2500)
  if (await win.locator(SEL.signinVisible).count()) {
    const msg = (await win.locator(SEL.signinError).textContent().catch(() => '') || '').trim()
    console.log(`     sign-in did not take${msg ? ` (${msg})` : ''}; waiting out the rate limit`)
    await win.waitForTimeout(62000)
    await win.locator(SEL.signinPassword).fill(LOGIN.password)
    await click(win, win.locator(`${SEL.signinForm} button`).first())
    await win.waitForTimeout(3000)
  }
  if (SEL.picker && await win.locator(SEL.picker.visible).count()) {
    // Film the one the business actually uses, not whichever row happens to sort first.
    const sel = win.locator(SEL.picker.select)
    if (SEL.picker.prefer) {
      const i = (await sel.locator('option').allTextContents()).findIndex((t) => SEL.picker.prefer.test(t))
      if (i >= 0) await sel.selectOption({ index: i })
    }
    await win.waitForTimeout(400)
    await click(win, win.locator(SEL.picker.confirm))
  }
  await win.waitForTimeout(2500)
  await cursorOn(win)
  await win.waitForTimeout(400)
}

/**
 * Open any collapsed nav groups, so every section is reachable.
 *
 * Without this, an item inside a closed group is in the DOM but invisible, and a click on it
 * waits out its full timeout before failing - which reads like a wrong selector when the
 * selector was right all along.
 */
/**
 * Make a nav item reachable, opening the group it lives in if it is collapsed.
 *
 * Expanding the whole sidebar up-front was the first idea and it cannot work: plenty of panels
 * run their groups as an accordion, where opening one closes the last, so "open everything"
 * settles on exactly one group no matter how you order the clicks. Revealing the single group
 * you are about to use sidesteps that entirely, and costs nothing when nothing is collapsed.
 *
 * Judged by whether the wanted item actually appeared rather than by an attribute: Filament, for
 * one, animates groups with Alpine's x-collapse and leaves both `aria-expanded` and `hidden`
 * stale, so a selector keyed on either reopens and recloses the same group forever.
 */
export async function reveal(win, locator) {
  if (await locator.isVisible().catch(() => false)) return true
  if (!SEL.navGroupToggle) return false

  const toggles = win.locator(`${SEL.tabs} ${SEL.navGroupToggle}`)
  const n = await toggles.count().catch(() => 0)
  for (let i = 0; i < n; i++) {
    await click(win, toggles.nth(i), { pause: 400, moveMs: 300, stay: true }).catch(() => {})
    if (await locator.isVisible().catch(() => false)) return true
  }
  return false
}

/** Reveal a top-level section if need be, then click it. Use this instead of click(win, tab(...)). */
export async function openTab(win, label, opts = {}) {
  const t = tab(win, label)
  await reveal(win, t)
  return click(win, t, opts)
}

/** Step from wherever the app opens into the screen being filmed. */
export async function enter(win) {
  if (SEL.enter) {
    const btn = win.locator(SEL.enter.button)
    if (await btn.count() && !(await win.locator(SEL.enter.ready).count())) {
      await click(win, btn, { pause: 1200 })
    }
  }
  await cursorOn(win)
  await win.waitForTimeout(600)
}

/**
 * A top-level tab by its label.
 *
 * Anchored at the start only: tabs carry count badges, so "Approvals" renders as "Approvals8"
 * and a trailing `$` would never match it.
 */
export const tab = (win, label) =>
  win.locator(`${SEL.tabs} ${SEL.tabItem}`).filter({ hasText: new RegExp(`^\\s*${label}`) }).first()

export async function finish(ctx, win, dir, name) {
  /* A chapter that ends on a visible error filmed a failure and must say so - that is how the
     invalid barcode in the product chapter was caught.

     Visible is the operative word. This first read every .error in the DOM, which includes the
     sign-in screen's own notice sitting hidden behind the running app: every long chapter
     reported "this till was signed out by the server" while the footage was perfect to the last
     frame. A warning that fires on takes that are fine is worse than no warning, because the
     real ones stop being read. */
  const errs = (await win.locator('.error:visible').allTextContents().catch(() => []))
    .map((e) => e.trim()).filter(Boolean)

  if (errs.length) console.error(`  !! ${name} left an error on screen: ${errs.join(' | ')}`)

  await win.waitForTimeout(1200)
  if (ctx.capture) {
    const silent = await ctx.capture.stop(name)
    await ctx.close()
    return silent
  }
  await ctx.close()
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.webm'))
  if (!files.length) throw new Error('no video produced')
  const out = path.join(dir, `${name}.webm`)
  fs.renameSync(path.join(dir, files[0]), out)
  return out
}
