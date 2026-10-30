import fs from 'node:fs'
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { startHighQualityCapture, click, cursorOn, type, wide } from './lib.mjs'

const dir = '/Users/temitopeolotin/PhpstormProjects/walkthrough-video/fixtures/camera-check'
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
const page = await context.newPage()
await page.goto('http://127.0.0.1:8765/sidebar-form.html', { waitUntil: 'networkidle' })
assert.equal(await page.title(), 'Northstar · Create a workspace')
await cursorOn(page)
const capture = await startHighQualityCapture(page, dir, { w: 1920, h: 1080 })
await page.evaluate((startedAt) => {
  window.__edgeAudit = []
  window.__edgeAuditTimer = setInterval(() => {
    const r = document.querySelector('#__stage')?.getBoundingClientRect()
    const c = window.__camState?.()
    if (r && c) window.__edgeAudit.push({ t: (Date.now() - startedAt) / 1000, left: r.left, right: r.right, top: r.top, bottom: r.bottom, k: c.k, x: c.x, y: c.y })
  }, 40)
}, capture.startedAt)

await click(page, page.getByRole('link', { name: 'Projects' }), { pause: 450 })
assert.equal(await page.getByRole('link', { name: 'Projects' }).getAttribute('class'), 'active')
await click(page, page.getByRole('link', { name: 'Settings' }), { pause: 300 })
await type(page, page.locator('[name=workspace]'), 'Acme Product Studio', { delay: 65, pause: 250 })
await type(page, page.locator('[name=description]'), 'We build thoughtful tools for teams doing ambitious work.', { delay: 38, pause: 250 })
await page.locator('[name=industry]').selectOption({ label: 'Design and creative' })
await page.locator('[name=size]').selectOption({ label: '11–50 people' })
await click(page, page.getByRole('button', { name: /Continue to invitations/ }), { pause: 450 })
assert.equal(await page.locator('#success').isVisible(), true)
assert.equal(await page.locator('[name=workspace]').inputValue(), 'Acme Product Studio')
await wide(page, { ms: 900 })
await page.waitForTimeout(500)
const cameraAtEnd = await page.evaluate(() => ({ left: document.querySelector('#__stage').getBoundingClientRect().left, k: window.__camState().k }))
assert.ok(Math.abs(cameraAtEnd.left) < 1 && Math.abs(cameraAtEnd.k - 1) < 0.01, `camera did not return wide: ${JSON.stringify(cameraAtEnd)}`)
const edgeAudit = await page.evaluate(() => { clearInterval(window.__edgeAuditTimer); return window.__edgeAudit })
assert.ok(edgeAudit.length > 100, `camera edge audit captured too few samples: ${edgeAudit.length}`)
const edgeExposure = edgeAudit.filter(({ left, right, top, bottom }) => left > 0.5 || right < 1919.5 || top > 0.5 || bottom < 1079.5)
assert.equal(edgeExposure.length, 0, `camera exposed page edges in ${edgeExposure.length}/${edgeAudit.length} samples; first=${JSON.stringify(edgeExposure[0])}`)
const silent = await capture.stop('sidebar-form-1080p')
await context.close()
await browser.close()
console.log(JSON.stringify({ navigation: 'passed', formTyping: 'passed', selects: 'passed', submit: 'passed', edgeAuditSamples: edgeAudit.length, exposedEdgeSamples: edgeExposure.length, cameraAtEnd, silent }, null, 2))
