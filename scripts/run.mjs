import { boot, signIn, enter, finish } from './lib.mjs'
import { mux } from './tts.mjs'
import { DB } from './config.mjs'
import { CHAPTERS } from './chapters.mjs'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const only = process.argv.slice(2)
const list = only.length ? CHAPTERS.filter((c) => only.some((o) => c.id.includes(o))) : CHAPTERS

// Every chapter starts from the same demo data, so a take never trips over what an earlier
// one created (a duplicate barcode, a branch already registered) and re-runs are repeatable.
/**
 * Put the demo data back, without yanking the file out from under the app server.
 *
 * `cp` was the first version and it caused takes to die halfway with "signed out by the server":
 * a running PHP-FPM worker holds the database open, and overwriting the file under it leaves
 * that worker reading something between two databases, so the token it just issued is not there
 * on the next request. sqlite3's .restore goes through the backup API, which takes the proper
 * locks and leaves one consistent database behind.
 */
const resetDemoData = () => {
  if (!DB?.live || !DB?.baseline || !fs.existsSync(DB.baseline)) return
  try {
    execFileSync('sqlite3', [DB.live, `.restore '${DB.baseline}'`])
  } catch {
    fs.copyFileSync(DB.baseline, DB.live)   // not sqlite, or no sqlite3 on PATH
  }
}

const report = []
for (const ch of list) {
  const dir = `./out/${ch.id}`
  process.stdout.write(`\n▶ ${ch.id} — ${ch.title}\n`)
  let app
  try {
    resetDemoData()
    const booted = await boot({ dir })
    app = booted
    const { win } = booted
    await signIn(booted, win)
    await enter(win)
    await ch.run(win, booted)
    const webm = await finish(booted, win, dir, ch.id)
    execFileSync('./encode.sh', [webm, ch.id, `${dir}/viewport.json`], { stdio: 'inherit' })
    // Lay the narration on at the offsets it was spoken during the take.
    const silent = `./mp4/${ch.id}-silent.mp4`
    const voiced = `./mp4/${ch.id}.mp4`
    mux(silent, booted.cues, voiced)
    fs.unlinkSync(silent)
    const secs = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', voiced]).toString().trim())
    report.push({ id: ch.id, title: ch.title, secs: secs.toFixed(1), ok: true })
    console.log(`  ✓ ${secs.toFixed(1)}s  ${booted.cues.length} lines  →  mp4/${ch.id}.mp4`)
  } catch (e) {
    report.push({ id: ch.id, title: ch.title, ok: false, err: e.message.split('\n')[0].slice(0, 110) })
    console.log(`  ✗ ${e.message.split('\n')[0].slice(0, 110)}`)
    try { await app?.close?.() } catch {}
  }
}

console.log('\n================ RESULT ================')
for (const r of report) console.log(r.ok ? `  ok    ${r.secs.padStart(6)}s  ${r.id}` : `  FAIL          ${r.id}  ${r.err}`)
fs.writeFileSync('./out/report.json', JSON.stringify(report, null, 2))
