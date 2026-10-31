import { createServer } from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { caption, cursorOn, glide, point, startHighQualityCapture, wide, ZOOM } from './lib.mjs'
import { createAnimatedCard, transitionClips } from './motion.mjs'
import { execFileSync } from 'node:child_process'
import { render } from './tts.mjs'

const root = path.resolve('fixtures/signaldesk')
const output = path.join(root, 'signaldesk-product-tour-1080p.mp4')
const music = path.join(root, 'assets/signaldesk-digital-clouds.mp3')
const logo = null
const introSeconds = 1
const outroSeconds = 1
const transitionSeconds = 0.12
const captureDir = path.join(root, 'recording')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'signaldesk-promo-'))
const run = (command, args) => execFileSync(command, args, { stdio: 'inherit' })
const duration = (file) => Number(execFileSync('ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
]).toString().trim())

const scriptLines = [
  'Customer feedback is everywhere. It’s in support tickets, customer calls, and product reviews. But teams rarely have time to connect it all.',
  'SignalDesk brings those conversations into one workspace and highlights the patterns that matter most.',
  'Here, setup friction is rising. Twenty-nine mentions across three sources point to one problem: new teams aren’t sure what to do after connecting a data source.',
  'Open the action brief to see the customer evidence, how the signal is changing, and a practical next step your team can test.',
  'Turn that recommendation into a shared product brief, with an owner and a clear reason to act.',
  'Now the conversation can move from customer voice to product decision, with everyone working from the same evidence.',
]

function createVoiceover() {
  return scriptLines.map((text) => {
    const speech = render(text)
    return { text, file: speech.file, duration: speech.secs }
  })
}

function addSilentTrack(source, target) {
  const seconds = duration(source)
  run('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-i', source,
    '-f', 'lavfi', '-t', String(seconds), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'slow', '-crf', '13',
    '-r', '30', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', target])
}

function muxNarrationAndMusic(video, appCues, introDuration, appDuration, outroDuration, target) {
  const finalDuration = duration(video)
  const outroStart = introDuration + appDuration - 2 * transitionSeconds
  const cues = appCues.map((cue) => ({
    file: cue.file,
    at: Math.round((introDuration - transitionSeconds) * 1000) + cue.at,
  }))
  const duckStart = Math.max(introDuration + 0.5, cues[0].at / 1000 - 0.35)
  const duckEnd = duckStart + 1.5
  const speechEnd = Math.max(...cues.map((cue) => (cue.at + cue.duration * 1000) / 1000 + introDuration - transitionSeconds))
  const liftStart = Math.max(duckEnd, Math.min(outroStart, speechEnd + 0.2))
  const liftEnd = outroStart + 0.8
  const introFade = Math.min(0.7, introDuration * 0.25)
  const outroFade = Math.min(1.8, outroDuration * 0.45)
  const volume = `if(lt(t,${duckStart}),0.45,if(lt(t,${duckEnd}),0.45-0.23*(t-${duckStart})/${duckEnd-duckStart},if(lt(t,${liftStart}),0.22,if(lt(t,${liftEnd}),0.22+0.23*(t-${liftStart})/${liftEnd-liftStart},0.45))))`
  const args = ['-nostdin', '-loglevel', 'error', '-y', '-i', video, '-stream_loop', '-1', '-i', music]
  for (const cue of cues) args.push('-i', cue.file)

  const filters = [
    '[0:a]volume=0[bed]',
    `[1:a]atrim=duration=${finalDuration},asetpts=PTS-STARTPTS,loudnorm=I=-20:TP=-2.5:LRA=10,afade=t=in:d=${introFade},volume='${volume}',afade=t=out:st=${Math.max(0, finalDuration - outroFade)}:d=${outroFade}[score]`,
  ]
  cues.forEach((cue, index) => filters.push(`[${index + 2}:a]adelay=${cue.at}:all=1,volume=1.08[voice${index}]`))
  const inputs = ['[bed]', '[score]', ...cues.map((_, index) => `[voice${index}]`)].join('')
  filters.push(`${inputs}amix=inputs=${cues.length + 2}:duration=first:normalize=0:dropout_transition=0,alimiter=limit=0.90[aout]`)
  args.push('-filter_complex', filters.join(';'), '-map', '0:v:0', '-map', '[aout]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-t', String(finalDuration), '-movflags', '+faststart', target)
  run('ffmpeg', args)
}

function server() {
  return createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html')
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('Not found')
      return
    }
    res.setHeader('Content-Type', path.extname(file) === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream')
    fs.createReadStream(file).pipe(res)
  }).listen(0, '127.0.0.1')
}

async function aim(page, locator, hold = 120) {
  const target = locator.first()
  await target.scrollIntoViewIfNeeded()
  const box = await target.boundingBox()
  if (!box) throw new Error('Could not find the visible pointer target')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await glide(page, x, y, 260)
  await page.mouse.move(x, y)
  await page.evaluate(([px, py]) => window.__ring?.(px, py), [x, y])
  if (hold) await page.waitForTimeout(hold)
}

async function clickOn(page, locator) {
  await aim(page, locator, 90)
  const box = await locator.first().boundingBox()
  if (!box) throw new Error('Could not click the visible demo control')
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(180)
}

fs.rmSync(captureDir, { recursive: true, force: true })
fs.mkdirSync(captureDir, { recursive: true })
if (!fs.existsSync(music)) throw new Error(`Downloaded soundtrack is missing: ${music}`)
const voice = createVoiceover()
const web = server()
await new Promise((resolve) => web.once('listening', resolve))
const address = web.address()
const browser = await chromium.launch({ headless: true })
let capture
const cues = []

try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  page.on('pageerror', (error) => console.error(`SignalDesk page error: ${error.message}`))
  capture = await startHighQualityCapture(page, captureDir, { w: 1920, h: 1080 })
  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await cursorOn(page)

  const beginSpeech = async (index) => {
    const item = voice[index]
    await caption(page, item.text)
    const startedAt = Date.now()
    cues.push({ file: item.file, at: startedAt - capture.startedAt, duration: item.duration })
    return { startedAt, duration: item.duration }
  }
  const finishSpeech = async (speech) => {
    const remaining = Math.ceil(speech.duration * 1000 - (Date.now() - speech.startedAt))
    if (remaining > 0) await page.waitForTimeout(remaining + 100)
  }

  let speech = await beginSpeech(0)
  for (const source of await page.locator('.source-tile').all()) await aim(page, source, 150)
  await aim(page, page.locator('.stat').nth(1), 150)
  await finishSpeech(speech)

  speech = await beginSpeech(1)
  await point(page, page.locator('#signal-card'), { hold: 300, zoom: ZOOM.action, stay: true })
  await wide(page)
  await finishSpeech(speech)

  await clickOn(page, page.locator('#review-brief'))
  await page.locator('#modal-backdrop.open').waitFor({ state: 'visible' })

  speech = await beginSpeech(2)
  await point(page, page.locator('.modal-box').first(), { hold: 200, zoom: ZOOM.point, stay: true })
  await wide(page)
  await finishSpeech(speech)

  speech = await beginSpeech(3)
  await aim(page, page.locator('.modal-box').nth(1), 200)
  await aim(page, page.locator('.modal-box li').first(), 200)
  await aim(page, page.locator('.modal-box li').last(), 200)
  await finishSpeech(speech)

  await clickOn(page, page.locator('#create-brief'))
  await page.locator('#toast.visible').waitFor({ state: 'visible', timeout: 3000 })
  speech = await beginSpeech(4)
  await aim(page, page.locator('#brief-count'), 200)
  await finishSpeech(speech)

  speech = await beginSpeech(5)
  await aim(page, page.locator('.source-tile').first(), 180)
  await aim(page, page.locator('.evidence'), 180)
  await aim(page, page.locator('.brief-panel'), 180)
  await finishSpeech(speech)
  await caption(page, '')
  await page.waitForTimeout(500)

  const recorded = await capture.stop('signaldesk-product-tour')
  await context.close()
  const cards = path.join(temp, 'cards')
  const introRaw = await createAnimatedCard({
    kicker: 'AN AI CUSTOMER INTELLIGENCE PLATFORM',
    title: 'Hear the pattern.\nBuild what matters.',
    subtitle: 'Customer insight for teams that ship.', duration: introSeconds,
  }, { directory: cards, name: 'signaldesk-intro', brand: 'SIGNALDESK AI', accent: '#c6df76', effect: 'fade-up', layout: 'editorial', transitionDuration: transitionSeconds })
  const outroRaw = await createAnimatedCard({
    kicker: 'SIGNALDESK AI · ORBIT LABS',
    title: 'From customer voice\nto product action.',
    subtitle: 'A clearer reason to build what matters.', duration: outroSeconds,
  }, { directory: cards, name: 'signaldesk-outro', brand: 'SIGNALDESK AI', accent: '#c6df76', effect: 'slide-left', layout: 'closing' })
  const intro = path.join(temp, 'intro.mp4')
  const app = path.join(temp, 'app.mp4')
  const outro = path.join(temp, 'outro.mp4')
  addSilentTrack(introRaw, intro)
  addSilentTrack(recorded, app)
  addSilentTrack(outroRaw, outro)
  const silent = path.join(temp, 'signaldesk-promo-silent.mp4')
  transitionClips([intro, app, outro], { effect: ['fade', 'smoothright'], duration: transitionSeconds }, silent)
  muxNarrationAndMusic(silent, cues, introSeconds, duration(app), outroSeconds, output)
  console.log(`SignalDesk product video: ${output}`)
} finally {
  await browser.close().catch(() => {})
  await new Promise((resolve) => web.close(resolve))
  fs.rmSync(temp, { recursive: true, force: true })
}
