import { chromium } from 'playwright-core'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { startHighQualityCapture } from './lib.mjs'

const require = createRequire(import.meta.url)
const gsapSource = fs.readFileSync(require.resolve('gsap/dist/gsap.min.js'), 'utf8').replaceAll('</script', '<\\/script')
const run = (command, args) => execFileSync(command, args, { stdio: 'inherit' })
const probeDuration = (file) => Number(execFileSync('ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
]).toString().trim())
const html = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]))
const transitions = new Set([
  'fade', 'fadeblack', 'fadewhite', 'wipeleft', 'wiperight', 'wipeup', 'wipedown',
  'slideleft', 'slideright', 'slideup', 'slidedown', 'smoothleft', 'smoothright',
  'smoothup', 'smoothdown', 'circleopen', 'circleclose', 'dissolve', 'pixelize',
])

function imageData(source) {
  if (!source) return null
  let file = source
  if (/^https?:\/\//i.test(source)) {
    const extension = path.extname(new URL(source).pathname) || '.jpg'
    file = path.join('/tmp', `walkthrough-motion-${Date.now()}${extension}`)
    run('curl', ['-L', '--fail', '--silent', '--show-error', source, '-o', file])
  } else file = path.resolve(source)
  if (!fs.existsSync(file)) throw new Error(`motion card image does not exist: ${file}`)
  const mime = ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif' })[path.extname(file).toLowerCase()] || 'image/png'
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`
}

/** Capture animated, native-resolution intro/outro typography as a clean 30fps MP4. */
export async function createAnimatedCard(scene, {
  directory, name, width = 1920, height = 1080, brand = '', logo = null,
  accent = '#c8f04a', effect = 'fade-up', layout = 'editorial', exit = false, transitionDuration = 0.45,
}) {
  const duration = Number(scene.duration)
  if (!(duration > 0)) throw new Error(`${name} duration must be greater than zero`)
  const bgImage = scene.background?.type === 'image' ? imageData(scene.background.src) : null
  const logoImage = logo ? imageData(logo) : null
  if (!['editorial', 'split', 'closing'].includes(layout)) throw new Error(`unsupported title-card layout: ${layout}`)
  const dark = Boolean(bgImage) || layout === 'closing'
  const background = bgImage
    ? `background-image:linear-gradient(90deg,rgba(14,20,17,.82),rgba(14,20,17,.30)),url('${bgImage}');background-size:cover;background-position:center`
    : `background:${layout === 'closing' ? '#0b0c10' : '#f5f6f2'}`
  const layoutStyles = layout === 'split' ? `
    body:before{content:"";position:absolute;left:5.5%;top:9%;bottom:9%;width:1px;background:#deded5}
    body:after{content:"";position:absolute;left:calc(5.5% - 4px);top:9%;width:9px;height:9px;background:${accent};border-radius:50%}
    .content{left:9%;width:39%}h1{font-size:clamp(60px,6.8vw,118px);max-width:740px}
    p{font-size:clamp(22px,1.9vw,32px);max-width:620px}
    .visual{position:absolute;left:54%;top:21%;width:38%;height:58%;padding:34px 38px;background:#fffefa;
      border:1px solid #e6e3da;border-radius:17px;box-shadow:0 24px 70px rgba(38,43,35,.10);display:flex;flex-direction:column}
    .visual-head{display:flex;justify-content:space-between;align-items:center;padding-bottom:23px;border-bottom:1px solid #ece9e1;
      font-size:13px;font-weight:750;letter-spacing:.08em;color:#5e625a}
    .visual-head span:last-child{font-size:12px;font-weight:550;letter-spacing:0;color:#96988f}
    .demo-row{display:grid;grid-template-columns:23px 1fr auto;gap:13px;align-items:center;min-height:72px;border-bottom:1px solid #efede7;color:#42463e;font-size:15px;font-weight:620}
    .demo-check{width:18px;height:18px;border:1px solid #c8c9bf;border-radius:50%;display:grid;place-items:center;color:white;font-size:11px}
    .demo-row:first-of-type .demo-check{background:#67846f;border-color:#67846f}
    .demo-time{font-size:12px;font-weight:550;color:#96988f}
    .demo-foot{display:flex;align-items:center;gap:10px;margin-top:auto;padding:15px 16px;border-radius:8px;background:#f3f1e9;color:#686b62;font-size:12px}
    .demo-bell{color:${accent};font-size:15px}
    .brand{left:9%}` : layout === 'closing' ? `
    body:before{content:"";position:absolute;left:8%;right:8%;top:14%;height:1px;background:rgba(255,255,255,.17)}
    body:after{content:"";position:absolute;right:8%;top:calc(14% - 4px);width:9px;height:9px;border-radius:50%;background:${accent}}
    .content{left:12%;width:76%;text-align:center}
    .eyebrow{justify-content:center;color:#d3d7cc}
    h1{max-width:1460px;margin:0 auto 25px;font-size:clamp(72px,8.2vw,140px)}
    p{max-width:1050px;margin:0 auto;color:#c5cbc2}
    .brand{left:0;right:0;justify-content:center;color:#e7e8e0}
    .mark{border-radius:0}` : `
    body:before{content:"";position:absolute;left:5.5%;top:7%;bottom:7%;width:2px;background:${dark ? 'rgba(255,255,255,.22)' : '#d9ddd5'}}
    body:after{content:"";position:absolute;left:calc(5.5% - 4px);top:7%;width:10px;height:10px;background:${accent}}`
  const visualMarkup = layout === 'split' ? `<aside class="visual"><div class="visual-head"><span>YOUR LIST</span><span>Today · 03</span></div><div class="demo-row"><span class="demo-check">✓</span><span>Review the launch plan</span><span class="demo-time">9:30</span></div><div class="demo-row"><span class="demo-check"></span><span>Send the project update</span><span class="demo-time">11:00</span></div><div class="demo-row"><span class="demo-check"></span><span>Prepare for the review</span><span class="demo-time">2:15</span></div><div class="demo-foot"><span class="demo-bell">◷</span><span>A reminder, right when you need it</span></div></aside>` : ''
  const markup = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden}
    body{position:relative;${background};color:${dark ? '#fff' : '#151820'};font-family:Inter,Arial,sans-serif}
    .content{position:absolute;left:10%;top:50%;width:78%;transform:translateY(-50%)}
    .eyebrow{display:flex;align-items:center;gap:13px;color:${dark ? '#fff' : '#444a43'};font-size:clamp(16px,1.45vw,24px);font-weight:700;letter-spacing:.015em;margin-bottom:22px}
    h1{font-size:clamp(68px,8.2vw,142px);letter-spacing:-.065em;line-height:.99;max-width:1450px;margin:0 0 22px;font-weight:780}
    p{font-size:clamp(24px,2.3vw,38px);line-height:1.3;margin:0;color:${dark ? 'rgba(255,255,255,.84)' : '#697067'};max-width:1150px}
    .brand{position:absolute;left:10%;bottom:7%;display:flex;align-items:center;gap:14px;font-size:14px;letter-spacing:.13em;text-transform:uppercase;font-weight:700;opacity:0;color:${dark ? '#fff' : '#454b44'}}
    .brand img{max-width:140px;max-height:68px;object-fit:contain}
    .eyebrow,h1,.content p,.brand{opacity:0}
    .mark{height:12px;width:0;background:${accent};border-radius:9px;transform-origin:left;display:inline-block}
    ${layoutStyles}
  </style></head><body><main class="content"><div class="eyebrow"><i class="mark"></i><span>${html(scene.kicker || 'PRODUCT WALKTHROUGH')}</span></div><h1>${html(scene.title)}</h1><p>${html(scene.subtitle)}</p></main>${visualMarkup}<div class="brand">${logoImage ? `<img src="${logoImage}" alt="">` : ''}<span>${html(brand)}</span></div><script>${gsapSource}</script><script>
    const gsap = window.gsap
    const start = { 'slide-left': { x: 64, y: 0, scale: 1 }, pop: { x: 0, y: 0, scale: .9 }, 'fade-up': { x: 0, y: 38, scale: 1 } }[${JSON.stringify(effect)}] || { x: 0, y: 38, scale: 1 }
    const timeline = gsap.timeline({ paused: true })
    timeline.fromTo('.eyebrow', { autoAlpha: 0, x: start.x, y: start.y }, { autoAlpha: 1, x: 0, y: 0, duration: .42, ease: 'power3.out' }, 0)
      .to('.mark', { width: 62, duration: .34, ease: 'power2.out' }, .20)
      .fromTo('h1', { autoAlpha: 0, y: 42, scale: start.scale }, { autoAlpha: 1, y: 0, scale: 1, duration: .58, ease: 'power3.out' }, .10)
      .fromTo('.content p', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: .46, ease: 'power2.out' }, .34)
      .fromTo('.brand', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .48, ease: 'power2.out' }, .30)
    if (${JSON.stringify(layout === 'split')}) timeline.fromTo('.visual', { autoAlpha: 0, x: 34 }, { autoAlpha: 1, x: 0, duration: .62, ease: 'power3.out' }, .22)
      .fromTo('.demo-row,.demo-foot', { autoAlpha: 0, y: 13 }, { autoAlpha: 1, y: 0, duration: .38, stagger: .08, ease: 'power2.out' }, .52)
    if (${JSON.stringify(exit)}) timeline.to('.content,.brand,.visual', { autoAlpha: 0, y: -18, duration: .28, ease: 'power2.in' }, ${Math.max(0, duration - Number(transitionDuration) - 0.30)})
    window.playScene = () => timeline.play(0)
  </script></body></html>`

  fs.mkdirSync(directory, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.setContent(markup, { waitUntil: 'load' })
    const gsapReady = await page.evaluate(() => typeof window.gsap?.timeline === 'function' && typeof window.playScene === 'function')
    if (!gsapReady) throw new Error('GSAP did not initialize in the title-card browser')
    const capture = await startHighQualityCapture(page, directory, { w: width, h: height })
    await page.evaluate(() => window.playScene())
    await page.waitForTimeout(Math.ceil(duration * 1000))
    const rendered = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.querySelector('h1')).opacity))
    if (rendered < 0.98) throw new Error(`GSAP title animation did not complete for ${name}: opacity=${rendered}`)
    if (pageErrors.length) throw new Error(`GSAP title-card browser error: ${pageErrors.join('; ')}`)
    const raw = await capture.stop(name)
    const exact = path.join(directory, `${name}-card.mp4`)
    run('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-i', raw, '-vf', 'fps=30,format=yuv420p',
      '-frames:v', String(Math.max(1, Math.round(duration * 30))), '-an', '-c:v', 'libx264', '-preset', 'slow',
      '-crf', '13', '-r', '30', '-movflags', '+faststart', exact])
    return exact
  } finally {
    await browser.close()
  }
}

/** Join title cards and feature chapters with a real video transition and matched audio fade. */
export function transitionClips(files, { effect = 'fade', duration = 0.45 } = {}, output) {
  const effects = Array.isArray(effect) ? effect : files.slice(1).map(() => effect)
  if (files.length < 2 || effects.every((item) => item === 'none') || Number(duration) <= 0) {
    const list = `${output}.concat.txt`
    fs.writeFileSync(list, files.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join('\n'))
    try { run('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', output]) }
    finally { fs.rmSync(list, { force: true }) }
    return
  }
  if (effects.length !== files.length - 1) throw new Error(`provide one transition effect per clip join (${files.length - 1} needed)`)
  for (const item of effects) if (item !== 'none' && !transitions.has(item)) throw new Error(`unsupported VIDEO.transition.effect: ${item}`)
  const seconds = Number(duration)
  const lengths = files.map(probeDuration)
  if (lengths.some((length) => length <= seconds)) throw new Error('transition duration must be shorter than every clip')

  const args = ['-nostdin', '-loglevel', 'error', '-y']
  for (const file of files) args.push('-i', file)
  const filters = []
  for (let i = 0; i < files.length; i++) {
    filters.push(`[${i}:v]settb=AVTB,setpts=PTS-STARTPTS,fps=30,format=yuv420p[v${i}]`)
    filters.push(`[${i}:a]asetpts=PTS-STARTPTS[a${i}]`)
  }
  let elapsed = lengths[0]
  let video = 'v0'
  let audio = 'a0'
  for (let i = 1; i < files.length; i++) {
    const effectAtCut = effects[i - 1]
    const cutDuration = effectAtCut === 'none' ? 1 / 30 : seconds
    const offset = Math.max(0, elapsed - cutDuration)
    const nextVideo = `vx${i}`
    const nextAudio = `ax${i}`
    filters.push(`[${video}][v${i}]xfade=transition=${effectAtCut === 'none' ? 'fade' : effectAtCut}:duration=${cutDuration}:offset=${offset.toFixed(6)}[${nextVideo}]`)
    filters.push(`[${audio}][a${i}]acrossfade=d=${cutDuration}:c1=tri:c2=tri[${nextAudio}]`)
    elapsed += lengths[i] - cutDuration
    video = nextVideo
    audio = nextAudio
  }
  args.push('-filter_complex', filters.join(';'), '-map', `[${video}]`, '-map', `[${audio}]`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '13', '-r', '30', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', output)
  run('ffmpeg', args)
}
