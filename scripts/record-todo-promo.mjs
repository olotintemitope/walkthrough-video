import { createServer } from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { caption, cursorOn, glide, startHighQualityCapture } from './lib.mjs'
import { createAnimatedCard, transitionClips } from './motion.mjs'
import { execFileSync } from 'node:child_process'
import { render } from './tts.mjs'

const root = path.resolve('fixtures/todo-reminder')
const output = path.join(root, 'daymark-todo-reminder-promo-1080p.mp4')
const logo = path.join(root, 'assets/live-edit-mark.png')
const introSeconds = 6.2
const outroSeconds = 5.2
const captureDir = path.join(root, 'recording')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'daymark-promo-'))
const run = (command, args) => execFileSync(command, args, { stdio: 'inherit' })
const duration = (file) => Number(execFileSync('ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
]).toString().trim())
const scriptLines = [
  'When your day fills up, small tasks are easy to lose track of. Daymark brings today’s priorities and reminders into one clear view.',
  'Adding a task is quick. Give it a due date, set its priority, and choose when Daymark should remind you.',
  'Need a look at tomorrow? Upcoming keeps future work separate, so you can focus on today and still know what’s ahead.',
  'Preview a reminder and see exactly which task needs your attention.',
  'When it’s done, check it off. Daymark saves your list on this device, so your plan is ready the next time you return.',
]

function createVoiceover() {
  return scriptLines.map((text) => {
    const speech = render(text)
    return { text, file: speech.file, duration: speech.secs }
  })
}

function muxVoiceover(video, appCues, introSeconds, transitionSeconds, target) {
  const scheduled = appCues.map((cue) => ({
    file: cue.file,
    at: Math.round((introSeconds - transitionSeconds) * 1000) + cue.at,
  }))
  const args = ['-nostdin', '-loglevel', 'error', '-y', '-i', video]
  for (const cue of scheduled) args.push('-i', cue.file)
  const filters = ['[0:a]volume=0[bed]']
  scheduled.forEach((cue, index) => filters.push(`[${index + 1}:a]adelay=${cue.at}:all=1,volume=1.12[voice${index}]`))
  const voices = scheduled.map((_, index) => `[voice${index}]`).join('')
  filters.push(`[bed]${voices}amix=inputs=${scheduled.length + 1}:duration=first:normalize=0:dropout_transition=0,alimiter=limit=0.88[aout]`)
  args.push('-filter_complex', filters.join(';'), '-map', '0:v:0', '-map', '[aout]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-t', String(duration(video)),
    '-movflags', '+faststart', target)
  run('ffmpeg', args)
}

async function aim(page, locator, hold = 0) {
  const target = locator.first()
  await target.scrollIntoViewIfNeeded()
  const box = await target.boundingBox()
  if (!box) throw new Error('Could not find the visible target for the recorded pointer')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await glide(page, x, y, 420)
  await page.mouse.move(x, y)
  await page.evaluate(([px, py]) => window.__ring?.(px, py), [x, y])
  if (hold) await page.waitForTimeout(hold)
  return { x, y }
}

async function clickOn(page, locator, pause = 450) {
  const { x, y } = await aim(page, locator)
  await page.waitForTimeout(140)
  await page.mouse.click(x, y)
  await page.waitForTimeout(pause)
}

async function typeInto(page, locator, value, delay = 38) {
  const { x, y } = await aim(page, locator)
  await page.mouse.click(x, y)
  await locator.fill('')
  await locator.type(value, { delay })
}

function server() {
  return createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html')
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('Not found')
      return
    }
    const ext = path.extname(file)
    res.setHeader('Content-Type', ext === '.html' ? 'text/html; charset=utf-8' : 'application/octet-stream')
    fs.createReadStream(file).pipe(res)
  }).listen(0, '127.0.0.1')
}

function addSilentTrack(source, target) {
  const seconds = duration(source)
  run('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-i', source,
    '-f', 'lavfi', '-t', String(seconds), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'slow', '-crf', '13',
    '-r', '30', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', target])
}

fs.rmSync(captureDir, { recursive: true, force: true })
fs.mkdirSync(captureDir, { recursive: true })
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
  page.on('pageerror', (error) => console.error(`App page error: ${error.message}`))
  capture = await startHighQualityCapture(page, captureDir, { w: 1920, h: 1080 })
  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await cursorOn(page)
  const speak = async (line) => {
    const item = voice[line]
    await caption(page, item.text)
    cues.push({ file: item.file, at: Date.now() - capture.startedAt })
    await page.waitForTimeout(Math.ceil(item.duration * 1000) + 180)
  }
  await speak(0)
  await clickOn(page, page.locator('#new-task'), 500)
  await typeInto(page, page.locator('#task-name'), 'Send the revised launch plan')
  const tomorrow = await page.evaluate(() => {
    const date = new Date()
    date.setDate(date.getDate() + 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  })
  await page.locator('#task-date').fill(tomorrow)
  await aim(page, page.locator('#task-reminder'), 500)
  await page.locator('#task-reminder').selectOption('10')
  await page.locator('#task-priority').selectOption('High')
  await speak(1)
  await clickOn(page, page.locator('#task-form button[type="submit"]'), 700)
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('daymark.todos.v1') || '[]').some((task) => task.title === 'Send the revised launch plan'), null, { timeout: 6000 }).catch(async () => {
    console.error('Task was not saved; form state:', await page.locator('#task-form').evaluate((form) => ({
      title: form.elements.title.value, date: form.elements.date.value, time: form.elements.time.value,
      valid: form.checkValidity(), modalOpen: document.querySelector('#modal-backdrop').classList.contains('open'),
      tasks: JSON.parse(localStorage.getItem('daymark.todos.v1') || '[]').map((task) => task.title),
    })))
    await page.screenshot({ path: path.join(root, 'recording-debug.png') })
    throw new Error('The demo form did not save the new task')
  })
  await clickOn(page, page.locator('.nav [data-view="upcoming"]'), 650)
  const newTask = page.locator('.task').filter({ hasText: 'Send the revised launch plan' })
  await newTask.waitFor({ state: 'visible', timeout: 5000 })
  await speak(2)
  await aim(page, newTask, 450)
  await clickOn(page, newTask.locator('.bell'), 550)
  await page.locator('#toast').waitFor({ state: 'visible' })
  await aim(page, page.locator('#toast'), 350)
  await speak(3)
  await clickOn(page, page.locator('#toast-close'), 300)
  const completionButton = newTask.locator('.check')
  await speak(4)
  await aim(page, completionButton, 350)
  await completionButton.evaluate((button) => button.click())
  try {
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('daymark.todos.v1') || '[]')
      .find((task) => task.title === 'Send the revised launch plan')?.done, null, { timeout: 3000 })
  } catch {
    await page.screenshot({ path: path.join(root, 'recording-debug.png') })
    throw new Error('The demo did not mark the task complete')
  }
  await page.locator('.task').filter({ hasText: 'Send the revised launch plan' }).waitFor({ state: 'hidden', timeout: 5000 })
  await caption(page, '')
  await page.waitForTimeout(500)
  const recorded = await capture.stop('daymark-todo-reminder')
  await context.close()

  const cardsDir = path.join(temp, 'cards')
  const introRaw = await createAnimatedCard({
    kicker: 'LIVE EDIT PRESENTS · DAYMARK', title: 'A clearer way\nto plan your day.',
    subtitle: 'Tasks, priorities, and reminders in one place.', duration: introSeconds,
  }, { directory: cardsDir, name: 'intro', brand: 'LIVE EDIT', logo, accent: '#3d63ff', effect: 'fade-up', layout: 'split', exit: true, transitionDuration: 0.42 })
  const outroRaw = await createAnimatedCard({
    kicker: 'LIVE EDIT · DAYMARK', title: 'Know what\nis next.',
    subtitle: 'Try Daymark today.', duration: outroSeconds,
  }, { directory: cardsDir, name: 'outro', brand: 'LIVE EDIT', logo, accent: '#3d63ff', effect: 'slide-left', layout: 'closing' })
  const intro = path.join(temp, 'intro.mp4')
  const app = path.join(temp, 'app.mp4')
  const outro = path.join(temp, 'outro.mp4')
  addSilentTrack(introRaw, intro)
  addSilentTrack(recorded, app)
  addSilentTrack(outroRaw, outro)
  const transitionDuration = 0.42
  const silent = path.join(temp, 'daymark-promo-silent.mp4')
  transitionClips([intro, app, outro], { effect: ['fade', 'smoothright'], duration: transitionDuration }, silent)
  muxVoiceover(silent, cues, introSeconds, transitionDuration, output)
  console.log(`Promo video: ${output}`)
} finally {
  await browser.close().catch(() => {})
  await new Promise((resolve) => web.close(resolve))
  fs.rmSync(temp, { recursive: true, force: true })
}
