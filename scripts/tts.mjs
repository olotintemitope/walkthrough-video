import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

if (!process.env.OPENAI_API_KEY) {
  const localEnv = path.resolve('.env.local')
  if (fs.existsSync(localEnv)) {
    const line = fs.readFileSync(localEnv, 'utf8').split(/\r?\n/)
      .find((entry) => /^\s*OPENAI_API_KEY\s*=/.test(entry))
    if (line) {
      const value = line.replace(/^\s*OPENAI_API_KEY\s*=\s*/, '').trim().replace(/^("|')|("|')$/g, '')
      if (value) process.env.OPENAI_API_KEY = value
    }
  }
}

/**
 * Narration, from OpenAI's gpt-4o-mini-tts.
 *
 * render() returns { file, secs } and the recorder paces each step by `secs`, so the voice is
 * what the whole walkthrough's timing is built from - change the voice and the cut re-times
 * itself.
 */
export const MODEL = process.env.TTS_MODEL || 'gpt-4o-mini-tts'

/**
 * The OpenAI guide currently recommends `marin` and `cedar` for best quality. `marin` is the
 * default here; set TTS_VOICE to audition another supported voice.
 */
export const VOICE = process.env.TTS_VOICE || 'marin'

/**
 * gpt-4o-mini-tts accepts plain-English direction for tone, emotion, intonation, and pace.
 */
export const INSTRUCTIONS = process.env.TTS_INSTRUCTIONS
  || 'Present this product to a customer as a real person would. Sound warm, confident, and '
   + 'engaged, with natural changes in pitch and pace. Tell the story of a busy day becoming '
   + 'easier to manage. Give the benefits light enthusiasm and emphasize the customer outcomes. '
   + 'Keep the delivery conversational and clear, with relaxed pauses at sentence breaks. Avoid '
   + 'a flat read, formal announcer voice, or exaggerated sales energy.'

const CACHE = './tts'
fs.mkdirSync(CACHE, { recursive: true })

const durationOf = (f) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())

function synthesise(text, m4a) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('narration needs OPENAI_API_KEY in the environment')

  const body = JSON.stringify({
    model: MODEL,
    voice: VOICE,
    input: text,
    instructions: INSTRUCTIONS,
    response_format: 'mp3',
  })
  const mp3 = m4a.replace(/\.m4a$/, '.mp3')
  const curlConfig = path.join(os.tmpdir(), `openai-tts-${crypto.randomUUID()}.curl`)
  const config = [
    `url = ${JSON.stringify('https://api.openai.com/v1/audio/speech')}`,
    `request = ${JSON.stringify('POST')}`,
    `header = ${JSON.stringify(`Authorization: Bearer ${key}`)}`,
    `header = ${JSON.stringify('Content-Type: application/json')}`,
    `data = ${JSON.stringify(body)}`,
    `output = ${JSON.stringify(mp3)}`,
    `write-out = ${JSON.stringify('%{http_code}')}`,
    'silent',
    'show-error',
  ].join('\n')
  fs.writeFileSync(curlConfig, config, { flag: 'wx', mode: 0o600 })
  let out
  try {
    out = execFileSync('curl', ['--config', curlConfig]).toString().trim()
  } finally {
    fs.rmSync(curlConfig, { force: true })
  }

  if (out !== '200') {
    const detail = fs.existsSync(mp3) ? fs.readFileSync(mp3, 'utf8').slice(0, 300) : ''
    fs.rmSync(mp3, { force: true })
    throw new Error(`OpenAI speech returned ${out}: ${detail}`)
  }

  execFileSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-i', mp3, '-c:a', 'aac', '-b:a', '160k', m4a])
  fs.unlinkSync(mp3)
}

/**
 * Render one line, cached on everything that changes how it sounds.
 *
 * The cache is what makes re-recording cheap: fix one sentence and only that sentence is
 * re-synthesised, which matters when the engine is billed per character.
 */
export function render(text) {
  const fingerprint = `${MODEL}|${VOICE}|${INSTRUCTIONS}|${text}`
  const key = crypto.createHash('sha1').update(fingerprint).digest('hex').slice(0, 16)
  const m4a = path.join(CACHE, `${key}.m4a`)

  if (!fs.existsSync(m4a)) synthesise(text, m4a)

  return { file: m4a, secs: durationOf(m4a) }
}

/**
 * Lay the narration clips onto the silent capture at the offsets they were spoken.
 *
 * The recorder waits out each line's real duration while performing the step, so the offsets
 * collected during the take already match what is on screen - this only places the audio there.
 */
export function mux(video, cues, out) {
  if (!cues.length) { fs.copyFileSync(video, out); return }

  const args = ['-nostdin', '-loglevel', 'error', '-y', '-i', video]
  for (const c of cues) args.push('-i', c.file)

  const delays = cues.map((c, i) => {
    const at = Math.max(0, Math.round(c.at))
    return `[${i + 1}:a]adelay=${at}|${at}[a${i}]`
  })
  const mixIn = cues.map((_, i) => `[a${i}]`).join('')
  const filter = `${delays.join(';')};${mixIn}amix=inputs=${cues.length}:normalize=0:dropout_transition=0[mix]`

  args.push('-filter_complex', filter, '-map', '0:v', '-map', '[mix]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out)

  execFileSync('ffmpeg', args)
}
