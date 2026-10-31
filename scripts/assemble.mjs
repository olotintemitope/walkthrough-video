import { chromium } from 'playwright-core'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { VIDEO } from './config.mjs'
import { createAnimatedCard, transitionClips } from './motion.mjs'

let CHAPTERS
for (const file of ['./chapters.mjs', '../chapters.mjs']) {
  try {
    ;({ CHAPTERS } = await import(new URL(file, import.meta.url)))
    break
  } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error
  }
}
if (!CHAPTERS) throw new Error('chapters.mjs was not found beside assemble.mjs or in the project root')

const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' })
const duration = (file) => Number(execFileSync('ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
]).toString().trim())
const hasAudio = (file) => execFileSync('ffprobe', [
  '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=index', '-of', 'csv=p=0', file,
]).toString().trim().length > 0
const isUrl = (value) => /^https?:\/\//i.test(value)
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]))

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'walkthrough-video-'))
const resolveSource = (src, label) => {
  if (!src) return null
  if (!isUrl(src)) {
    const file = path.resolve(src)
    if (!fs.existsSync(file)) throw new Error(`${label} file does not exist: ${file}`)
    return file
  }
  const ext = path.extname(new URL(src).pathname) || '.media'
  const file = path.join(temp, `${label}${ext}`)
  run('curl', ['-L', '--fail', '--silent', '--show-error', src, '-o', file])
  return file
}

async function cardImage(scene, dest, overlayOnly = false) {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: VIDEO.width, height: VIDEO.height }, deviceScaleFactor: 1 })
    const title = escapeHtml(scene.title)
    const subtitle = escapeHtml(scene.subtitle)
    const brand = escapeHtml(VIDEO.brand)
    const logo = VIDEO.logo ? resolveSource(VIDEO.logo, `logo-${path.basename(dest)}`) : null
    const logoData = logo
      ? `data:${({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' })[path.extname(logo).toLowerCase()] || 'image/png'};base64,${fs.readFileSync(logo).toString('base64')}`
      : null
    const background = scene.background
    const style = overlayOnly
      ? 'background:transparent'
      : 'background:linear-gradient(135deg,#171a16 0%,#343a32 55%,#171a16 100%)'
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden}
      body{${style};font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#fff}
      .wash{position:absolute;inset:0;background:linear-gradient(90deg,rgba(7,13,26,.82),rgba(7,13,26,.25))}
      .content{position:absolute;left:9%;right:9%;top:50%;transform:translateY(-50%)}
      h1{font-size:clamp(48px,6vw,104px);line-height:1.04;letter-spacing:-.045em;margin:0 0 26px;max-width:1500px}
      p{font-size:clamp(22px,2.2vw,38px);line-height:1.35;margin:0;color:rgba(255,255,255,.82)}
      .brand{position:absolute;left:9%;bottom:7%;display:flex;align-items:center;gap:16px;font-size:20px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.82)}
      .brand img{max-width:160px;max-height:56px;object-fit:contain}
    </style></head><body><div class="wash"></div><main class="content"><h1>${title}</h1><p>${subtitle}</p></main><div class="brand">${logoData ? `<img src="${logoData}" alt="">` : ''}<span>${brand}</span></div></body></html>`)
    if (background?.type === 'image') {
      const image = resolveSource(background.src, `image-${path.basename(dest)}`)
      const mime = ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif' })[path.extname(image).toLowerCase()] || 'application/octet-stream'
      const dataUrl = `data:${mime};base64,${fs.readFileSync(image).toString('base64')}`
      await page.evaluate(async (src) => {
        const image = new Image()
        image.src = src
        await image.decode()
        document.body.style.backgroundImage = `linear-gradient(90deg,rgba(7,13,26,.78),rgba(7,13,26,.25)),url("${src}")`
        document.body.style.backgroundSize = 'cover'
        document.body.style.backgroundPosition = 'center'
      }, dataUrl)
    }
    await page.screenshot({ path: dest, omitBackground: overlayOnly })
  } finally {
    await browser.close()
  }
}

function renderScene(scene, output, overlay) {
  const seconds = Number(scene.duration)
  if (!(seconds > 0)) throw new Error('intro/outro duration must be greater than zero')
  const args = ['-nostdin', '-loglevel', 'error', '-y']
  let filter
  if (scene.background?.type === 'video') {
    const video = resolveSource(scene.background.src, `video-${path.basename(output)}`)
    args.push('-stream_loop', '-1', '-i', video, '-i', overlay,
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000')
    filter = `[0:v]scale=${VIDEO.width}:${VIDEO.height}:force_original_aspect_ratio=increase,crop=${VIDEO.width}:${VIDEO.height},fps=30[bg];[bg][1:v]overlay=0:0:format=auto,format=yuv420p[v]`
    args.push('-filter_complex', filter, '-map', '[v]', '-map', '2:a:0')
  } else {
    args.push('-loop', '1', '-framerate', '30', '-i', overlay,
      '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-map', '0:v:0', '-map', '1:a:0')
  }
  args.push('-t', String(seconds), '-c:v', 'libx264', '-preset', 'slow', '-crf', '13',
    '-r', '30', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', output)
  run('ffmpeg', args)
}

function normalizeClip(input, output) {
  const seconds = duration(input)
  const args = ['-nostdin', '-loglevel', 'error', '-y', '-i', input]
  const audio = hasAudio(input)
  if (!audio) args.push('-f', 'lavfi', '-t', String(seconds), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000')
  args.push('-map', '0:v:0', '-map', audio ? '0:a:0' : '1:a:0',
    '-vf', `scale=${VIDEO.width}:${VIDEO.height}:force_original_aspect_ratio=decrease,pad=${VIDEO.width}:${VIDEO.height}:(ow-iw)/2:(oh-ih)/2:color=0x171a16,fps=30,format=yuv420p`,
    '-t', String(seconds), '-c:v', 'libx264', '-preset', 'slow', '-crf', '13', '-r', '30',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2', output)
  run('ffmpeg', args)
}

function addMusic(video, music, output) {
  const seconds = duration(video)
  const fadeOutAt = Math.max(0, seconds - Math.max(0, Number(VIDEO.music.fadeOut) || 0))
  const audioFilter = `[1:a]volume=${Number(VIDEO.music.volume)}${Number(VIDEO.music.fadeIn) > 0 ? `,afade=t=in:d=${Number(VIDEO.music.fadeIn)}` : ''},afade=t=out:st=${fadeOutAt}:d=${Math.max(.01, seconds - fadeOutAt)}[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=0[mix]`
  run('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-i', video,
    '-stream_loop', '-1', '-i', music, '-filter_complex', audioFilter,
    '-map', '0:v:0', '-map', '[mix]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-t', String(seconds), '-movflags', '+faststart', output])
}

try {
  const all = new Map(CHAPTERS.map((chapter) => [chapter.id, chapter]))
  const chosen = VIDEO.chapters?.length ? VIDEO.chapters.map((id) => {
    const chapter = all.get(id)
    if (!chapter) throw new Error(`unknown chapter ID in VIDEO.chapters: ${id}`)
    return chapter
  }) : CHAPTERS
  if (!chosen.length) throw new Error('there are no chapters to assemble')

  async function makeScene(scene, key) {
    if (!scene) return null
    const clip = path.join(temp, `${key}.mp4`)
    const videoBackground = scene.background?.type === 'video'
    const cardMotion = VIDEO.motion?.card || 'none'
    if (!videoBackground && cardMotion !== 'none') {
      const captureDir = path.join(temp, `${key}-capture`)
      const captured = await createAnimatedCard(scene, {
        directory: captureDir,
        name: key,
        width: VIDEO.width,
        height: VIDEO.height,
        brand: VIDEO.brand,
        logo: VIDEO.logo,
        accent: VIDEO.motion?.accent || '#c8f04a',
        effect: cardMotion,
        layout: scene.layout || 'editorial',
        exit: key === 'intro',
        transitionDuration: VIDEO.transition?.effect === 'none' ? 0 : Number(VIDEO.transition?.duration) || 0.45,
      })
      normalizeClip(captured, clip)
      fs.rmSync(captureDir, { recursive: true, force: true })
      return clip
    }
    const still = path.join(temp, `${key}.png`)
    await cardImage(scene, still, videoBackground)
    renderScene(scene, clip, still)
    return clip
  }

  await makeScene(VIDEO.intro, 'intro')
  await makeScene(VIDEO.outro, 'outro')
  const normalized = []
  const introClip = VIDEO.intro ? path.join(temp, 'intro.mp4') : null
  const outroClip = VIDEO.outro ? path.join(temp, 'outro.mp4') : null
  if (introClip) normalized.push(introClip)
  for (const chapter of chosen) {
    const source = path.resolve(`./mp4/${chapter.id}.mp4`)
    if (!fs.existsSync(source)) throw new Error(`missing chapter video: ${source} (record it with node run.mjs ${chapter.id})`)
    const target = path.join(temp, `chapter-${normalized.length}.mp4`)
    normalizeClip(source, target)
    normalized.push(target)
  }
  if (outroClip) normalized.push(outroClip)

  const assembled = path.join(temp, 'assembled.mp4')
  transitionClips(normalized, VIDEO.transition || { effect: 'none' }, assembled)

  const output = path.resolve(VIDEO.output)
  fs.mkdirSync(path.dirname(output), { recursive: true })
  if (VIDEO.music?.src) addMusic(assembled, resolveSource(VIDEO.music.src, 'music'), output)
  else fs.copyFileSync(assembled, output)
  console.log(`Finished product video: ${output}`)
} finally {
  fs.rmSync(temp, { recursive: true, force: true })
}
