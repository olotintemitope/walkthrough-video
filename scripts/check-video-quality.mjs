import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { VIDEO } from './config.mjs'

function usage() {
  console.error('Usage: node scripts/check-video-quality.mjs <final.mp4> [--source <capture.mp4>]')
  process.exit(2)
}

const args = process.argv.slice(2)
const input = args.find((arg) => !arg.startsWith('--'))
if (!input) usage()
const option = (name) => {
  const index = args.indexOf(name)
  if (index < 0) return null
  const value = args[index + 1]
  if (!value || value.startsWith('--')) usage()
  return value
}
const sourcePath = option('--source')
const expectedWidth = Number(option('--width') || VIDEO.width)
const expectedHeight = Number(option('--height') || VIDEO.height)

const probe = (file) => JSON.parse(execFileSync('ffprobe', [
  '-v', 'error', '-show_streams', '-show_format', '-of', 'json', file,
], { encoding: 'utf8' }))

const videoPath = path.resolve(input)
if (!fs.existsSync(videoPath)) throw new Error(`Video not found: ${videoPath}`)
const metadata = probe(videoPath)
const video = metadata.streams.find((stream) => stream.codec_type === 'video')
if (!video) throw new Error('The file has no video stream')

const duration = Number(metadata.format.duration)
const rate = (value) => {
  const [numerator, denominator] = String(value || '0/1').split('/').map(Number)
  return denominator ? numerator / denominator : 0
}
const fps = rate(video.avg_frame_rate || video.r_frame_rate)
const failures = []

if (video.width !== expectedWidth || video.height !== expectedHeight) {
  failures.push(`dimensions are ${video.width}×${video.height}; configured output is ${expectedWidth}×${expectedHeight}`)
}
if (!Number.isFinite(duration) || duration < 1) failures.push(`duration is invalid (${metadata.format.duration})`)
if (fps < 24) failures.push(`frame rate is ${fps.toFixed(2)} fps; expected at least 24 fps`)

if (sourcePath) {
  const resolvedSource = path.resolve(sourcePath)
  if (!fs.existsSync(resolvedSource)) throw new Error(`Source capture not found: ${resolvedSource}`)
  const sourceVideo = probe(resolvedSource).streams.find((stream) => stream.codec_type === 'video')
  if (!sourceVideo) throw new Error('The source file has no video stream')
  if (sourceVideo.width < video.width || sourceVideo.height < video.height) {
    failures.push(`source capture is ${sourceVideo.width}×${sourceVideo.height}, below the ${video.width}×${video.height} delivery size; this export is enlarged footage`)
  }
  console.log(`Source: ${sourceVideo.width}×${sourceVideo.height} at ${rate(sourceVideo.avg_frame_rate || sourceVideo.r_frame_rate).toFixed(2)} fps`)
}

// Decode all streams so a file with correct metadata but broken frames/audio cannot pass.
execFileSync('ffmpeg', ['-v', 'error', '-i', videoPath, '-map', '0', '-f', 'null', '-'], { stdio: 'ignore' })

console.log(`Video: ${video.width}×${video.height} at ${fps.toFixed(2)} fps, ${duration.toFixed(2)} seconds`)
console.log(`Audio: ${metadata.streams.some((stream) => stream.codec_type === 'audio') ? 'present' : 'none'}`)
console.log('Decode: all audio and video streams decoded without errors')

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`)
  process.exit(1)
}

console.log('PASS: export metadata and source-resolution checks meet the configured delivery size')
