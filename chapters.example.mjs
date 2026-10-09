/**
 * A complete worked set of chapters for an imaginary shop's point-of-sale. Copy to `chapters.mjs`
 * and rewrite the bodies for your app - the helpers and the shape stay the same.
 */
import { click, type, point, openTab, cursorOn, caption, titleCard, say, SEL } from './scripts/lib.mjs'

const sub = (win, l) => win.locator(`${SEL.body} ${SEL.subTab}`).filter({ hasText: new RegExp(`^\\s*${l}`) }).first()
const act = (win, l) => win.locator(`${SEL.body} ${SEL.action}`).filter({ hasText: l }).first()
const dw = (win) => win.locator(SEL.drawer)
const rows = (win) => win.locator(`${SEL.body} ${SEL.row}`)
const field = (win, ph) => dw(win).locator(`input[placeholder="${ph}"], textarea[placeholder="${ph}"]`).first()
const sel = (win, i = 0) => dw(win).locator('select').nth(i)
const send = (win) => dw(win).locator(SEL.submit).first()

/**
 * Switch sub-tab and open its action, confirming the button is really there first.
 *
 * A sub-tab click that lands while the list is still re-rendering is swallowed, leaving the
 * previous tab's action on screen - so this checks for the button it wants and tries again.
 */
async function openAction(win, subLabel, actionLabel) {
  for (let i = 0; i < 3; i++) {
    if (subLabel) {
      const s = sub(win, subLabel)
      if (await s.count()) await click(win, s, { pause: 1400 })
    }
    const a = act(win, actionLabel)
    if (await a.count() && await a.isVisible().catch(() => false)) {
      await click(win, a, { pause: 1400 })
      return true
    }
    await win.waitForTimeout(1500)
  }
  console.log(`     (no "${actionLabel}" on the ${subLabel ?? 'current'} tab - skipped)`)
  return false
}

async function shut(win) {
  if (await dw(win).count()) { await win.keyboard.press('Escape'); await win.waitForTimeout(600) }
}

/**
 * The product pickers are a typeahead: type, then take the first suggestion row.
 *
 * The suggestion is `.suggest-row`. Worth stating because an earlier guess at the class silently
 * matched nothing, fell through to pressing Enter, and produced takes where the line was never
 * added - a drawer that looks filled in on camera but saves nothing.
 */
async function pickProduct(win, term, { nth = 0 } = {}) {
  const boxes = dw(win).locator('input[placeholder="Search product or SKU…"]')
  const box = boxes.nth(Math.min(nth, Math.max(0, await boxes.count() - 1)))
  await type(win, box, term, { delay: 60, pause: 1000 })
  const hit = dw(win).locator(SEL.suggestion).first()
  if (await hit.count()) { await click(win, hit, { pause: 1000 }); return true }
  console.log(`     (no suggestion for "${term}")`)
  return false
}

/** Quotations, POs and transfers take as many lines as you like. */
async function addAnother(win, term) {
  const more = dw(win).locator('button').filter({ hasText: '+ Add another product' }).first()
  if (!(await more.count())) return false
  const before = await dw(win).locator('input[placeholder="Search product or SKU…"]').count()
  await click(win, more, { pause: 900 })
  return pickProduct(win, term, { nth: before })
}

/** Fire the drawer's primary action and wait for it to close - that is the proof it saved. */
async function submit(win, { wait = 3000 } = {}) {
  const go = send(win)
  if (!(await go.count()) || await go.isDisabled()) return false
  await click(win, go, { pause: wait })
  return (await dw(win).count()) === 0
}

export const CHAPTERS = [

{ id: 'ch01-the-two-halves', title: 'The two halves of the terminal', async run(win, ctx) {
  await titleCard(win, 'The two halves of the terminal')
  await say(ctx, win, 'This terminal has two halves. The till rings up a sale. The Admin side runs the shop behind it.')
  await point(win, win.locator('#mode-switch'), { hold: 500 })
  await say(ctx, win, 'You move between them with this switch. Till. Admin.')
  await click(win, win.locator('#mode-till'), { pause: 1800 })
  await cursorOn(win)
  await say(ctx, win, 'This is the till, where your salesperson works.')
  await click(win, win.locator('#mode-admin'), { pause: 2000 })
  await cursorOn(win)
  await say(ctx, win, 'And this is the Admin side. Twelve sections, and we will go through every one.')
  await caption(win)
}},

{ id: 'ch03-dashboard', title: 'The Dashboard', async run(win, ctx) {
  await titleCard(win, 'The Dashboard')
  await openTab(win, 'Dashboard', { pause: 1500 })
  await say(ctx, win, 'This is your morning glance. What the counter has taken today.')
  const tiles = win.locator('#admin-body .astat')
  const n = Math.min(await tiles.count(), 6)
  for (let i = 0; i < n; i++) await point(win, tiles.nth(i), { hold: 500 })
  await say(ctx, win, 'How many customers are waiting on you to approve a payment. Stock running low. Income and expenses this month.')
  await win.mouse.wheel(0, 420)
  await say(ctx, win, 'And underneath, the last seven days of takings. Nothing to do here. Just look at it before you open.')
  await caption(win)
}},

{ id: 'ch04-approvals', title: 'How to approve a payment', async run(win, ctx) {
  await titleCard(win, 'How to approve a payment')
  await openTab(win, 'Approvals', { pause: 1600 })
  await say(ctx, win, 'This section keeps a customer standing at your counter, so it is the one to watch.')
  await say(ctx, win, 'When your salesperson takes payment, the sale does not finish by itself. It waits here for someone to confirm the money arrived.')
  const first = rows(win).first()
  if (!(await first.count())) { await caption(win); return }
  await click(win, first, { pause: 1600 })
  await say(ctx, win, 'Click the sale. What they bought, how they paid, and the reference are all on the right.')
  await say(ctx, win, 'Now check it. Against your bank alert, or the card terminal. Actually check.')
  const go = win.locator('#admin-body .approve').first()
  await point(win, go, { hold: 400 })
  await say(ctx, win, 'Look at the Approve button. Until you tick the box, it does nothing. That is on purpose.')
  const box = win.locator('#admin-body .averify input[type=checkbox]').first()
  if (await box.count()) await click(win, box, { pause: 700 })
  await say(ctx, win, 'Tick to confirm, and approve. The invoice releases, and your salesperson can print it.')
  if (await go.count()) await click(win, go, { pause: 3000 })
  await cursorOn(win)
  await say(ctx, win, 'If the money is not there, send it back instead, and say what was wrong. It returns to this queue once corrected.')
  await caption(win)
}},

{ id: 'ch05-pickups', title: 'How to release a pickup', async run(win, ctx) {
  await titleCard(win, 'How to release a pickup')
  await openTab(win, 'Pickups', { pause: 1500 })
  await say(ctx, win, 'Orders the customer is coming to collect.')
  await say(ctx, win, 'Find their order, ask them for their pickup code, and type it in.')
  const code = win.locator('#admin-body input').first()
  if (await code.count()) await type(win, code, 'A7K2', { delay: 200, pause: 700 })
  await point(win, act(win, 'Release order'), { hold: 600 })
  await say(ctx, win, 'Then release it. A wrong code is refused, so the code is what proves it is really them.')
  await click(win, sub(win, 'Collected'), { pause: 1500 })
  await say(ctx, win, 'Everything handed over already is on the Collected tab.')
  await caption(win)
}},

{ id: 'ch06-add-product', title: 'How to add a product', async run(win, ctx) {
  await titleCard(win, 'How to add a product')
  await openTab(win, 'Products', { pause: 1500 })
  await say(ctx, win, 'The catalogue: everything you sell.')
  await say(ctx, win, 'Notice what is not here: the quantity on your shelves. Stock moves on the Stock side, where every change gets a name and a reason.')
  await click(win, act(win, '+ New product'), { pause: 1300 })
  await say(ctx, win, 'Give it a name the way a customer would say it.')
  await type(win, dw(win).locator('input[placeholder="420W Monocrystalline Panel"]'), 'Northwind 5kW Hybrid Inverter')
  await say(ctx, win, 'Pick the category.')
  await sel(win, 0).selectOption({ index: 2 }).catch(() => {})
  await win.waitForTimeout(600)
  await say(ctx, win, 'The S K U is your own code. Press Suggest and it builds one from the category.')
  await click(win, dw(win).locator('.abtn', { hasText: 'Suggest' }).first(), { pause: 1300 })
  await say(ctx, win, 'The barcode is what makes the scanner work at the till.')
  await type(win, field(win, '13-digit EAN'), '5012345678900', { delay: 45 })
  await say(ctx, win, 'Selling price is what a normal customer pays. Cost price is what you paid, and it makes your profit figures true.')
  const money = dw(win).locator('input[placeholder="₦0"]')
  await type(win, money.nth(0), '128250')
  await type(win, money.nth(1), '96000')
  await say(ctx, win, 'Restock threshold. At five, this product starts reporting as low.')
  await type(win, field(win, 'e.g. 5'), '5')
  await say(ctx, win, 'Tracking decides what you are asked for when the goods arrive. Serial numbers, for an inverter.')
  const tr = dw(win).locator('select.aselect').filter({ has: win.locator('option[value="serial"]') }).first()
  await tr.selectOption('serial').catch(() => {})
  await win.waitForTimeout(700)
  await say(ctx, win, 'Create the product.')
  await submit(win, { wait: 2600 })
  await cursorOn(win)
  await say(ctx, win, 'And here it is, with no stock. A new product always starts at zero. Stock arrives by delivery, transfer, or adjustment.')
  await caption(win)
}},

{ id: 'ch07-stock', title: 'How to adjust stock and run a count', async run(win, ctx) {
  await titleCard(win, 'How to adjust stock')
  await openTab(win, 'Stock', { pause: 1500 })
  await say(ctx, win, 'On hand, reserved and available, for every product at every branch.')
  const first = rows(win).first()
  if (await first.count()) {
    await click(win, first, { pause: 1800 })
    await say(ctx, win, 'Click any row and you get its whole history. What changed, when, by how much, who did it and why.')
    await shut(win)
  }
  await say(ctx, win, 'An adjustment is for the small truth: something broke, something was found.')
  await click(win, act(win, 'Adjust a product…'), { pause: 1300 })
  await pickProduct(win, '450W')
  await say(ctx, win, 'Pick the product and the branch, then the change. Minus two for two cracked panels.')
  await type(win, field(win, 'e.g. -2 or 5'), '-2')
  await say(ctx, win, 'And give a reason. Mean it: your name is on it permanently.')
  await type(win, field(win, 'Why - e.g. delivery shortfall'), 'Two panels cracked in the store')
  await submit(win, { wait: 2600 })
  await cursorOn(win)
  await say(ctx, win, 'For a whole shelf, do not adjust line by line. Use a count session instead.')
  await click(win, sub(win, 'Count sessions'), { pause: 1600 })
  await click(win, act(win, 'Start count session'), { pause: 1300 })
  await type(win, field(win, 'e.g. weekly shelf count'), 'October shelf count')
  await say(ctx, win, 'Name the count and open it. What you type stays a draft, so the shop keeps selling while you count.')
  await submit(win, { wait: 2600 })
  await cursorOn(win)
  await say(ctx, win, 'Only when you approve it does stock move, and every changed line becomes its own movement.')
  await caption(win)
}},

{ id: 'ch08-branches-and-staff', title: 'How to add a branch and a staff login', async run(win, ctx) {
  await titleCard(win, 'How to add a branch and a staff login')
  await openTab(win, 'Warehouses', { pause: 1500 })
  await say(ctx, win, 'Your locations. Register a branch with its name and address.')
  await click(win, act(win, '+ Register warehouse'), { pause: 1300 })
  await type(win, field(win, 'Riverside - North'), 'Riverside - North')
  await type(win, field(win, 'e.g. county or state'), 'Riverside')
  await type(win, field(win, '12 Dock Road, Riverside'), '14 Mill Street, Riverside')
  await say(ctx, win, 'Tick the box if customers can collect from there. Then register it.')
  await submit(win, { wait: 2600 })
  await cursorOn(win)
  await say(ctx, win, 'This is also where you give a cashier a login. Open the branch.')
  const first = rows(win).first()
  if (await first.count()) await click(win, first, { pause: 1600 })
  const invite = dw(win).locator('.abtn').filter({ hasText: 'Invite sales staff' }).first()
  if (await invite.count()) {
    await click(win, invite, { pause: 1300 })
    const ins = dw(win).locator('input')
    await type(win, ins.nth(0), 'Sam Carter')
    await type(win, ins.nth(1), 'sam@example.test')
    await say(ctx, win, 'Their name and work email. They get a link to set their own password. You never type one for them.')
    await submit(win, { wait: 2600 })
    await say(ctx, win, 'One warning that catches everybody: that link dies after one hour. Send it when the person is there to open it.')
  }
  await shut(win)
  await caption(win)
}},

{ id: 'ch09-transfers', title: 'How to move stock between branches', async run(win, ctx) {
  await titleCard(win, 'How to move stock between branches')
  await openTab(win, 'Transfers', { pause: 1500 })
  await say(ctx, win, 'Three steps, and stock only moves on the last two.')
  await click(win, act(win, '+ New transfer'), { pause: 1300 })
  await say(ctx, win, 'From which branch, to which branch, and what.')
  await sel(win, 0).selectOption({ index: 1 }).catch(() => {}); await win.waitForTimeout(500)
  await sel(win, 1).selectOption({ index: 2 }).catch(() => {}); await win.waitForTimeout(500)
  await pickProduct(win, '450W')
  await say(ctx, win, 'Create it. It is a draft. Nothing has moved and nobody has lost anything.')
  await submit(win, { wait: 2800 })
  await cursorOn(win)
  const t = rows(win).first()
  if (await t.count()) {
    await click(win, t, { pause: 1800 })
    await say(ctx, win, 'When the goods physically leave, dispatch it. Now the stock is gone from the branch it left.')
    const dis = dw(win).locator('.go').filter({ hasText: 'Dispatch' }).first()
    if (await dis.count()) { await click(win, dis, { pause: 2800 }) }
    await cursorOn(win)
    await say(ctx, win, 'When it arrives, the other branch receives it. And you can receive less than was sent.')
    const r2 = rows(win).first()
    if (await r2.count()) await click(win, r2, { pause: 1600 })
    const rec = dw(win).locator('.go').filter({ hasText: 'Receive' }).first()
    if (await rec.count()) { await click(win, rec, { pause: 2800 }) }
    await cursorOn(win)
    await say(ctx, win, 'If ten went and nine arrived, you say nine. You have recorded the loss instead of hiding it.')
  }
  await shut(win)
  await caption(win)
}},

{ id: 'ch10-purchasing', title: 'How to order and receive from a supplier', async run(win, ctx) {
  await titleCard(win, 'How to order and receive from a supplier')
  await openTab(win, 'Purchasing', { pause: 1500 })
  await click(win, sub(win, 'Suppliers'), { pause: 1300 })
  await say(ctx, win, 'Add your supplier once, with their contact details.')
  await click(win, act(win, '+ New supplier'), { pause: 1300 })
  await type(win, field(win, 'Harbour Supply Co'), 'Harbour Supply Co')
  await type(win, field(win, 'e.g. panels, batteries'), 'Inverters and batteries')
  await type(win, field(win, 'Phone or email'), 'sales@harboursupply.test')
  await submit(win, { wait: 2600 })
  await cursorOn(win)
  await say(ctx, win, 'Then raise a purchase order: who you are buying from, which branch, what, and at what cost.')
  await click(win, sub(win, 'Purchase orders'), { pause: 1300 })
  await click(win, act(win, '+ New purchase order'), { pause: 1300 })
  await sel(win, 0).selectOption({ index: 1 }).catch(() => {}); await win.waitForTimeout(500)
  await pickProduct(win, '450W')
  const cost = field(win, '₦ unit cost')
  if (await cost.count()) await type(win, cost, '133000')
  await submit(win, { wait: 2800 })
  await cursorOn(win)
  await say(ctx, win, 'When the delivery arrives, open the order and book in what actually turned up. Partial is fine.')
  const po = rows(win).first()
  if (await po.count()) {
    await click(win, po, { pause: 2000 })
    await say(ctx, win, 'A batch product asks for the batch number, a serial product for the serials. Enter them and you can trace any unit later.')
    await shut(win)
  }
  await say(ctx, win, 'And if something is faulty, Supplier returns sends it back the same way.')
  await click(win, sub(win, 'Supplier returns'), { pause: 1600 })
  await caption(win)
}},

{ id: 'ch11-dealers-and-quotes', title: 'How to quote and sell to a dealer', async run(win, ctx) {
  await titleCard(win, 'How to quote and sell to a dealer')
  await openTab(win, 'Quotations', { pause: 1500 })
  await say(ctx, win, 'Dealers buy differently from walk-in customers, so they have their own corner.')
  if (await openAction(win, 'Dealers', '+ New dealer')) {
    await type(win, field(win, 'Fairview Installers'), 'Fairview Installers')
    await say(ctx, win, 'Register the dealer once. Their tier decides their discount, so you are not working it out by hand every time.')
    await submit(win, { wait: 2600 })
    await cursorOn(win)
  }
  await say(ctx, win, 'A quotation is for the dealer asking today and buying next week.')
  if (await openAction(win, 'Quotations', '+ New quotation')) {
    await sel(win, 0).selectOption({ index: 1 }).catch(() => {}); await win.waitForTimeout(500)
    await pickProduct(win, '450W')
    await say(ctx, win, 'Add the first product and its quantity.')
    await addAnother(win, '200Ah')
    await say(ctx, win, 'Add another, and another. A quotation carries as many lines as the job needs.')
    await addAnother(win, '5kVA')
    await say(ctx, win, 'Then send it. When they come back, you convert it into an order rather than typing it twice.')
    await submit(win, { wait: 2800 })
    await cursorOn(win)
  }
  const q = rows(win).first()
  if (await q.count()) {
    await click(win, q, { pause: 2000 })
    await say(ctx, win, 'Open a quotation and you see its lines and the quoted value.')
    const doc = dw(win).locator('.abtn').filter({ hasText: 'View quotation document' }).first()
    if (await doc.count()) {
      await click(win, doc, { pause: 2200 })
      await say(ctx, win, 'View quotation document gives you the dealer-facing sheet: your company masthead, the lines, the total in words.')
      await say(ctx, win, 'It prints in the same format as the invoice, with a banner saying it is a quotation and not an invoice.')
      const pdf = win.locator('.sheet-actions button').filter({ hasText: 'Save PDF' }).first()
      if (await pdf.count()) await point(win, pdf, { hold: 900 })
      await say(ctx, win, 'Print it for the dealer, or save it as a P D F named after the quote number.')
      const close = win.locator('.sheet-actions button').filter({ hasText: 'Close' }).first()
      if (await close.count()) await click(win, close, { pause: 1200 })
    }
    await shut(win)
  }
  await say(ctx, win, 'If they are buying right now, skip the quote and place a bulk order instead.')
  await click(win, sub(win, 'Customer returns'), { pause: 1600 })
  await say(ctx, win, 'Customer returns are on the third tab. You raise the return here; the goods go back on the shelf from the web admin.')
  await caption(win)
}},

{ id: 'ch12-batches-and-kits', title: 'How to track batches and build kits', async run(win, ctx) {
  await titleCard(win, 'How to track batches and build kits')
  await openTab(win, 'Traceability', { pause: 1500 })
  await say(ctx, win, 'If you sell anything by batch or serial number, this is where you find it.')
  await click(win, act(win, '+ New batch'), { pause: 1300 })
  await pickProduct(win, '200Ah')
  await type(win, field(win, 'e.g. LOT-2026-08'), 'LOT-2026-10')
  await say(ctx, win, 'Register a lot against a product, with its quantity and expiry. Then any unit from it can be traced back.')
  await submit(win, { wait: 2600 })
  await cursorOn(win)
  await click(win, sub(win, 'Serials'), { pause: 1500 })
  await say(ctx, win, 'Serials does the same for individual units.')
  await click(win, sub(win, 'Builds'), { pause: 1500 })
  await say(ctx, win, 'Builds is for a package made of other things: a panel, an inverter and a battery sold as one kit.')
  const bom = act(win, 'Edit a kit')
  if (await bom.count()) { await click(win, bom, { pause: 1500 }); await say(ctx, win, 'Tell it what goes into one kit, once.'); await shut(win) }
  const asm = act(win, 'Assemble a kit')
  if (await asm.count()) { await click(win, asm, { pause: 1500 }); await say(ctx, win, 'Then assemble as many as you like. The parts come out of stock and the finished kits go in.'); await shut(win) }
  await caption(win)
}},

{ id: 'ch13-finance', title: 'How to record an expense', async run(win, ctx) {
  await titleCard(win, 'How to record an expense')
  await openTab(win, 'Finance', { pause: 1500 })
  await say(ctx, win, 'Record what the shop spends: rent, fuel, transport.')
  await click(win, act(win, '+ Record expense'), { pause: 1300 })
  await type(win, field(win, 'e.g. Diesel & power'), 'Diesel & power')
  await type(win, field(win, 'What was paid for'), 'Generator fuel for the week')
  await type(win, field(win, '₦0'), '45000')
  await say(ctx, win, 'A category, what it was for, and the amount. Then record it.')
  await submit(win, { wait: 2600 })
  await cursorOn(win)
  await click(win, sub(win, 'Journal'), { pause: 1800 })
  await say(ctx, win, 'The Journal is the proper double-entry record. Every sale, receipt and expense lands here by itself.')
  await win.mouse.wheel(0, 380)
  await say(ctx, win, 'You do not edit it. This is what your accountant will ask you for.')
  await caption(win)
}},

{ id: 'ch14-reports', title: 'Reading the reports', async run(win, ctx) {
  await titleCard(win, 'Reading the reports')
  await openTab(win, 'Reports', { pause: 1800 })
  await say(ctx, win, 'Seven days, thirty, or ninety.')
  for (const r of ['Last 30 days', 'Last 90 days']) {
    const b = sub(win, r)
    if (await b.count()) await click(win, b, { pause: 1800 })
  }
  await say(ctx, win, 'What your stock is worth right now, what sold, and what it earned.')
  await win.mouse.wheel(0, 420)
  await say(ctx, win, 'Which products move fastest, and which are sitting there. The second half is usually the more useful one.')
  await say(ctx, win, 'That is the Admin side. Approvals keep a customer waiting, so watch that badge. And stock never changes without a name and a reason on it.')
  await caption(win)
}},
]
