import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { startHighQualityCapture, click, cursorOn, type, wide } from './lib.mjs'

const base = 'http://127.0.0.1:8765'
const dir = '/Users/temitopeolotin/PhpstormProjects/walkthrough-video/fixtures/camera-check'
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
const page = await context.newPage()

async function begin(file) {
  await page.goto(`${base}/${file}`, { waitUntil: 'networkidle' })
  await cursorOn(page)
  const capture = await startHighQualityCapture(page, dir, { w: 1920, h: 1080 })
  await page.evaluate((startedAt) => {
    window.__edgeAudit = []
    window.__edgeAuditTimer = setInterval(() => {
      const r = document.querySelector('#__stage')?.getBoundingClientRect()
      const c = window.__camState?.()
      if (r && c) window.__edgeAudit.push({ t: (Date.now() - startedAt) / 1000, left: r.left, right: r.right, top: r.top, bottom: r.bottom, k: c.k })
    }, 40)
  }, capture.startedAt)
  return capture
}

async function finish(capture, name) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await wide(page, { ms: 850 })
  await page.waitForTimeout(450)
  const camera = await page.evaluate(() => ({ left: document.querySelector('#__stage').getBoundingClientRect().left, k: window.__camState().k }))
  assert.ok(Math.abs(camera.left) < 1 && Math.abs(camera.k - 1) < 0.01, `camera did not reset wide: ${JSON.stringify(camera)}`)
  const audit = await page.evaluate(() => { clearInterval(window.__edgeAuditTimer); return window.__edgeAudit })
  assert.ok(audit.length > 100, `edge audit captured too few samples: ${audit.length}`)
  const exposed = audit.filter(({ left, right, top, bottom }) => left > 0.5 || right < 1919.5 || top > 0.5 || bottom < 1079.5)
  assert.equal(exposed.length, 0, `page edge exposed in ${exposed.length}/${audit.length} samples: ${JSON.stringify(exposed[0])}`)
  const output = await capture.stop(name)
  return { output, edgeAuditSamples: audit.length, exposedEdgeSamples: exposed.length, camera }
}

const projectCapture = await begin('project-settings.html')
await click(page, page.getByRole('link', { name: 'Roadmap' }), { pause: 250 })
await click(page, page.getByRole('link', { name: 'Project settings' }), { pause: 250 })
await type(page, page.locator('[name=name]'), 'Atlas mobile launch: Global rollout', { delay: 48, pause: 200 })
await type(page, page.locator('[name=description]'), 'Prepare the Atlas mobile experience for a coordinated global launch.', { delay: 34, pause: 200 })
await page.locator('[name=owner]').selectOption({ label: 'Riley Chen' })
await click(page, page.locator('.toggle').first(), { pause: 200 })
await click(page, page.getByRole('button', { name: 'Save project settings' }), { pause: 350 })
assert.equal(await page.locator('#saved').isVisible(), true)
assert.equal(await page.locator('[name=name]').inputValue(), 'Atlas mobile launch: Global rollout')
const project = await finish(projectCapture, 'project-settings-1080p')

const productCapture = await begin('product-editor.html')
await click(page, page.getByRole('link', { name: 'Orders' }), { pause: 220 })
await click(page, page.getByRole('link', { name: 'Products' }), { pause: 220 })
await type(page, page.locator('[name=title]'), 'Everyday Organic Canvas Tote', { delay: 50, pause: 200 })
await type(page, page.locator('[name=price]'), '32.00', { delay: 90, pause: 250 })
await page.locator('[name=location]').selectOption({ label: 'Brooklyn fulfillment' })
await type(page, page.getByRole('textbox', { name: 'Natural price' }), '29.00', { delay: 85, pause: 250 })
await click(page, page.getByRole('button', { name: 'Save product' }).last(), { pause: 350 })
assert.equal(await page.locator('#saved').isVisible(), true)
assert.equal(await page.locator('[name=title]').inputValue(), 'Everyday Organic Canvas Tote')
assert.equal(await page.locator('[name=price]').inputValue(), '32.00')
assert.equal(await page.getByRole('textbox', { name: 'Natural price' }).inputValue(), '29.00')
const product = await finish(productCapture, 'product-editor-1080p')

await context.close()
await browser.close()
console.log(JSON.stringify({ projectSettings: { interactions: 'passed', ...project }, productEditor: { interactions: 'passed', ...product } }, null, 2))
