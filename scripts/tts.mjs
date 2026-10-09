import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Narration, from OpenAI's gpt-4o-mini-tts.
 *
 * macOS `say` was here first and is gone: free and offline, but audibly synthetic, and a video
 * that goes to a client cannot sound like a train announcement. This costs a fraction of a cent
 * a line and sounds like a person.
 *
 * render() returns { file, secs } and the recorder paces each step by `secs`, so the voice is
 * what the whole walkthrough's timing is built from - change the voice and the cut re-times
 * itself.
 */
export const MODEL = process.env.TTS_MODEL || 'gpt-4o-mini-tts'

/**
 * alloy ash ballad coral echo fable nova onyx sage shimmer verse.
 * `onyx` is a low, level male read that suits instruction; `sage` and `coral` are warmer if the
 * material is lighter. Worth auditioning a line or two before committing to a whole set.
 */
export const VOICE = process.env.TTS_VOICE || 'onyx'

/**
 * gpt-4o-mini-tts takes a plain-English direction for delivery, which does more for how this
 * lands than the choice of voice. Teaching someone their own till is a patient, level job: no
 * announcer gloss, and room between sentences for what is happening on screen.
 */
export const INSTRUCTIONS = process.env.TTS_INSTRUCTIONS
  || 'Speak as a calm, friendly colleague showing someone how to use software they will rely on '
   + 'every day. Unhurried and clear, warm but matter-of-fact. Not an advertisement, not a '
   + 'newsreader. Land the end of each sentence and leave a small pause after it.'

const CACHE = './tts'
fs.mkdirSync(CACHE, { recursive: true })

const durationOf = (f) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())

function synthesise(text, m4a) {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('narration needs OPENAI_API_KEY in the environment')

  // curl rather than fetch: this runs under whatever Node the machine has, and the body is
  // small enough that a subprocess costs nothing next to the request itself.
  const body = JSON.stringify({
    model: MODEL,
    voice: VOICE,
    input: text,
    instructions: INSTRUCTIONS,
    response_format: 'mp3',
  })
  const mp3 = m4a.replace(/\.m4a$/, '.mp3')
  const out = execFileSync('curl', [
    '-sS', '-X', 'POST', 'https://api.openai.com/v1/audio/speech',
    '-H', `Authorization: Bearer ${key}`,
    '-H', 'Content-Type: application/json',
    '-d', body, '-o', mp3, '-w', '%{http_code}',
  ]).toString().trim()

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
