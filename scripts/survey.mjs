/**
 * Print what the app actually contains, so chapters are written against real selectors.
 *
 * Guessing a class name is the single most expensive mistake here: a wrong typeahead selector
 * matches nothing, the picker silently falls through, and you get a take where the form looks
 * filled in and saves nothing. Run this first, and write chapters from what it prints.
 *
 *   node survey.mjs                    every section
 *   node survey.mjs --drawers          also open each form and list its fields
 *   node survey.mjs Products Stock     only these sections
 *   node survey.mjs --limit 6          only the first six
 *
 * Output is written to survey.txt as it goes as well as to the terminal. Node buffers stdout
 * when it is piped, so on an app with thirty-odd sections a run that is working perfectly looks
 * hung for twenty minutes - the file is how you watch it.
 */
import fs from 'node:fs'
import { boot, signIn, enter, click, openTab, SEL } from './lib.mjs'

const argv = process.argv.slice(2)
const drawersToo = argv.includes('--drawers')
const limitAt = argv.indexOf('--limit')
const limit = limitAt >= 0 ? Number(argv[limitAt + 1]) : null
const only = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--limit')

const LOG = './survey.txt'
fs.writeFileSync(LOG, '')
const out = (line) => { console.log(line); fs.appendFileSync(LOG, line + '\n') }
const ctx = await boot({ dir: './out/survey' })
const { win } = ctx

await signIn(ctx, win)
await enter(win)

const sub = (l) => win.locator(`${SEL.body} ${SEL.subTab}`).filter({ hasText: new RegExp(`^\\s*${l}`) }).first()
const act = (l) => win.locator(`${SEL.body} ${SEL.action}`).filter({ hasText: l }).first()

const labels = await win.evaluate(
  ([tabsSel, itemSel]) => [...document.querySelectorAll(`${tabsSel} ${itemSel}`)]
    .map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean),
  [SEL.tabs, SEL.tabItem],
)

out(`\n${labels.length} sections: ${labels.join(' | ')}\n`)

const chosen = labels
  .filter((l) => !only.length || only.some((o) => l.toLowerCase().includes(o.toLowerCase())))
  .slice(0, limit ?? labels.length)
if (chosen.length !== labels.length) out(`surveying ${chosen.length} of them\n`)

for (const raw of chosen) {
  // Tabs carry count badges ("Approvals8"), so match the word, not the whole string.
  const label = raw.replace(/\s*\d+$/, '').trim()
  try {
    await openTab(win, label, { pause: 1100, moveMs: 80 })
    const info = await win.evaluate(
      ([bodySel, subSel, actSel, rowSel]) => {
        const body = document.querySelector(bodySel)
        if (!body) return null
        const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
        return {
          subtabs: [...body.querySelectorAll(subSel)].filter(vis).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).slice(0, 12),
          actions: [...body.querySelectorAll(actSel)].filter(vis).map((e) => e.textContent.replace(/\s+/g, ' ').trim()).slice(0, 8),
          rows: body.querySelectorAll(rowSel).length,
          empty: [...body.querySelectorAll('.aempty, .empty')].map((e) => e.textContent.trim()).slice(0, 1),
        }
      },
      [SEL.body, SEL.subTab, SEL.action, SEL.row],
    )
    if (!info) { out(`## ${label}  (no body matched ${SEL.body})`); continue }
    out(`## ${label}  rows=${info.rows}${info.empty.length ? `  EMPTY: ${info.empty[0]}` : ''}`)
    out(`   subtabs: ${info.subtabs.join(' | ') || '-'}`)
    out(`   actions: ${info.actions.join(' | ') || '-'}`)

    if (drawersToo) {
      for (const a of info.actions.filter((t) => /^\+|…$/.test(t))) {
        try {
          await click(win, act(a), { pause: 1400, moveMs: 150 })
          const d = await win.evaluate((sel) => {
            const p = document.querySelector(sel.drawer)
            if (!p) return null
            const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
            return {
              fields: [...p.querySelectorAll('input,textarea')].filter(vis).map((e) => e.placeholder || e.type),
              selects: [...p.querySelectorAll('select')].filter(vis)
                .map((e) => [...e.options].slice(0, 3).map((o) => o.textContent.trim()).join('/')),
              buttons: [...p.querySelectorAll('button')].filter(vis).map((e) => e.textContent.trim()).slice(0, 10),
              submit: p.querySelector(sel.submit)?.textContent?.trim(),
            }
          }, SEL)
          out(`   → ${a}: ${JSON.stringify(d)}`)
          await win.keyboard.press('Escape')
          await win.waitForTimeout(500)
        } catch { out(`   → ${a}: could not open`) }
      }
    }
    out('')
  } catch (e) {
    out(`## ${label}  !! ${e.message.split('\n')[0].slice(0, 70)}\n`)
  }
}

await ctx.close()
out(`\nwritten to ${LOG}`)
