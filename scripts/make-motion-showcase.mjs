import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createAnimatedCard, transitionClips } from './motion.mjs'

const root = path.resolve('fixtures/camera-check')
const output = path.join(root, 'motion-showcase-1080p.mp4')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'walkthrough-motion-showcase-'))
const run = (command, args) => execFileSync(command, args, { stdio: 'inherit' })
const duration = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim())

function shortSilentClip(source, target, start, seconds) {
  run('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-ss', String(start), '-i', source,
    '-f', 'lavfi', '-t', String(seconds), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-map', '0:v:0', '-map', '1:a:0', '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xf7f7f2,fps=30,format=yuv420p',
    '-t', String(seconds), '-c:v', 'libx264', '-preset', 'slow', '-crf', '13', '-r', '30',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2', target])
}

function addSilentTrack(source, target) {
  const seconds = duration(source)
  run('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-i', source,
    '-f', 'lavfi', '-t', String(seconds), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
    '-ar', '48000', '-ac', '2', '-shortest', target])
}

try {
  const captureDir = path.join(temp, 'cards')
  const introRaw = await createAnimatedCard({ kicker: 'MERCURY SUPPLY CO. · PRODUCT WALKTHROUGH', title: 'Every detail,\nin its place.', subtitle: 'Update product information, pricing, and inventory together.', duration: 2 }, {
    directory: captureDir, name: 'intro', brand: 'MERCURY SUPPLY CO.', effect: 'fade-up', accent: '#d9623e', exit: true, transitionDuration: 0.45,
  })
  const outroRaw = await createAnimatedCard({ kicker: 'MERCURY SUPPLY CO.', title: 'Ready for the\nnext order?', subtitle: 'Product details saved and ready to sell.', duration: 2 }, {
    directory: captureDir, name: 'outro', brand: 'MERCURY SUPPLY CO.', effect: 'slide-left', accent: '#d9623e',
  })
  const intro = path.join(temp, 'intro.mp4')
  const outro = path.join(temp, 'outro.mp4')
  addSilentTrack(introRaw, intro)
  addSilentTrack(outroRaw, outro)
  const productDetails = path.join(temp, 'product-details.mp4')
  const productVariants = path.join(temp, 'product-variants.mp4')
  const source = path.join(root, 'product-editor-1080p-silent.mp4')
  shortSilentClip(source, productDetails, 4, 4.5)
  shortSilentClip(source, productVariants, 24, 4.5)
  transitionClips([intro, productDetails, productVariants, outro], { effect: 'smoothleft', duration: 0.45 }, output)
  console.log(`Motion showcase: ${output}`)
} finally {
  fs.rmSync(temp, { recursive: true, force: true })
}
