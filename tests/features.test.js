// Deactivated, super keep, unmark in the checker, Blocked tab.
const assert = require('assert');
const { openDevice, reload, importExport, marks, mark, settle } = require('./helpers');

const T = 1600000000;
const FING = { alice: T, bob: T + 10, carol: T + 20 };
const FERS = { bob: T + 15, dave: T + 25 };

const meta = (page, u) => page.evaluate(u => Object.assign({}, S.P.me.meta[u]), u);
// Open the checker on one account (alphabetical order, everything in the group).
async function openChecker(page, st) {
  await page.evaluate(st => { S.cks.sort = 'az'; S.cks.st = st; }, st || []);
  await page.click('[data-a=check]').catch(() => page.evaluate(() => ckOpen()));
  await page.evaluate(() => ckOpen());
  await page.waitForSelector('#kc');
}
const cardName = page => page.textContent('#kc .kn');
const after = page => page.waitForTimeout(350);

module.exports = {
  async 'deactivated from the checker menu is saved, filterable and skipped next time'(browser) {
    const { context, page } = await openDevice(browser);
    await importExport(page, { profile: 'me', fing: FING, fers: FERS });
    await openChecker(page, ['u']);
    assert.strictEqual(await cardName(page), 'alice');
    assert.strictEqual(await page.$('.kmenu'), null, 'menu starts closed');
    await page.click('[data-a=ckm]');
    await page.click('.kmenu [data-k=d]');
    await after(page);
    assert.strictEqual(await cardName(page), 'carol', 'moves on to the next account');
    await settle(page); await reload(page);
    assert.deepStrictEqual(await marks(page, 'me'), { alice: 'd' });
    // Not in the default checker queue any more (it isn't unchecked).
    await openChecker(page, ['u']);
    assert.strictEqual(await cardName(page), 'carol');
    // But the Deactivated status filter finds it.
    const v = await page.evaluate(() => { S.f.st = ['d']; return view(); });
    assert.deepStrictEqual(v, ['alice']);
    assert.deepStrictEqual(page.__errors || [], []);
    await context.close();
  },
  async 'super keep from the checker survives Clear marks, bulk changes and an import reset'(browser) {
    const { context, page } = await openDevice(browser);
    await importExport(page, { profile: 'me', fing: FING, fers: FERS, date: '2026-11-01' });
    await openChecker(page, ['u']);
    await page.click('[data-a=ckm]');
    await page.click('.kmenu [data-k=K]');
    await after(page);
    await page.click('[data-a=ckclose]');
    await mark(page, 'carol', 'r');
    let m = await meta(page, 'alice');
    assert.strictEqual(m.s, 'k'); assert.strictEqual(m.sk, 1);
    // Status filters: Kept includes super kept, Super kept is only those.
    assert.deepStrictEqual(await page.evaluate(() => { S.f.st = ['k']; return view(); }), ['alice']);
    assert.deepStrictEqual(await page.evaluate(() => { S.f.st = ['K']; const v = view(); S.f.st = []; return v; }), ['alice']);
    // A quick tap in the list doesn't undo it.
    await page.click('[data-a=mr][data-u="alice"]');
    assert.strictEqual((await meta(page, 'alice')).sk, 1);
    // Bulk remove leaves it alone.
    await page.evaluate(() => { S.sel = new Set(['alice', 'carol']); });
    await page.evaluate(() => render());
    await page.click('[data-a=bu]');
    assert.deepStrictEqual(await marks(page, 'me'), { alice: 'k' });
    // Clear all marks leaves it alone.
    await mark(page, 'carol', 'r');
    await page.click('[data-a=set]');
    await page.click('[data-a=dmarks]'); await page.click('[data-a=dmarks]');
    assert.deepStrictEqual(await marks(page, 'me'), { alice: 'k' });
    assert.strictEqual((await meta(page, 'alice')).sk, 1);
    await page.click('[data-a=close]');
    // Alice follows back in a newer export: a plain mark would reset, a super keep doesn't.
    await mark(page, 'carol', 'r');
    await importExport(page, { profile: 'me', fing: FING, fers: Object.assign({ alice: T + 30, carol: T + 31 }, FERS), date: '2026-11-15' });
    assert.deepStrictEqual(await marks(page, 'me'), { alice: 'k' });
    assert.strictEqual((await meta(page, 'alice')).sk, 1);
    await settle(page); await reload(page);
    assert.strictEqual((await meta(page, 'alice')).sk, 1);
    assert.deepStrictEqual(page.__errors || [], []);
    await context.close();
  },
  async 'tapping the badge in the checker unmarks and stays on the card, with undo'(browser) {
    const { context, page } = await openDevice(browser);
    await importExport(page, { profile: 'me', fing: FING, fers: FERS });
    await mark(page, 'alice', 'k');
    await openChecker(page, []);
    assert.strictEqual(await cardName(page), 'alice');
    await page.click('#kc button.tag');
    await after(page);
    assert.strictEqual(await cardName(page), 'alice', 'stays on the same account');
    assert.deepStrictEqual(await marks(page, 'me'), {});
    assert.strictEqual(await page.$('#kc button.tag'), null);
    await page.click('#msg [data-a=undo]');
    assert.deepStrictEqual(await marks(page, 'me'), { alice: 'k' });
    await context.close();
  },
  async 'unmark is in the checker menu only when the account is marked'(browser) {
    const { context, page } = await openDevice(browser);
    await importExport(page, { profile: 'me', fing: FING, fers: FERS });
    await openChecker(page, []);
    await page.click('[data-a=ckm]');
    assert.strictEqual(await page.$('.kmenu [data-a=ckun]'), null);
    await page.click('[data-a=ckm]');
    await page.evaluate(() => { setStatus(cp(), ['alice'], 'K'); ckRender(); });
    await page.click('[data-a=ckm]');
    assert.strictEqual(await page.$('.kmenu [data-k=K]'), null, 'no Super keep when already super kept');
    await page.click('.kmenu [data-a=ckun]');
    assert.deepStrictEqual(await marks(page, 'me'), {});
    assert.strictEqual(await cardName(page), 'alice');
    await context.close();
  },
  async 'details panel can super keep and mark deactivated, and CSV round trips both'(browser) {
    const { context, page } = await openDevice(browser);
    await importExport(page, { profile: 'me', fing: FING, fers: FERS });
    await page.evaluate(() => { S.info = 'alice'; render(); });
    await page.click('#modal [data-a=msk]');
    await page.evaluate(() => { S.info = 'carol'; render(); });
    await page.click('#modal [data-a=mdd]');
    assert.deepStrictEqual(await marks(page, 'me'), { alice: 'k', carol: 'd' });
    const csv = await page.evaluate(() => csvText());
    assert.ok(/alice,[^\n]*Super kept/.test(csv), csv);
    assert.ok(/carol,[^\n]*Deactivated/.test(csv), csv);
    const back = await page.evaluate(t => fromCSV(t).meta, csv);
    assert.deepStrictEqual(back.alice, { s: 'k', sk: 1 });
    assert.deepStrictEqual(back.carol, { s: 'd' });
    await context.close();
  },
  async 'blocked accounts from the export get their own tab'(browser) {
    const { context, page } = await openDevice(browser);
    await page.click('[data-a=up]');
    await page.selectOption('#pf', '__new'); await page.fill('#un', 'me');
    const blocked = JSON.stringify({ relationships_blocked_users: [{ title: 'troll_1', string_list_data: [{ href: 'https://www.instagram.com/troll_1', timestamp: T + 5 }] }] });
    await page.evaluate(([b, f]) => pickFiles([
      new File([f], 'following.json', { type: 'application/json' }),
      new File([b], 'blocked_profiles.json', { type: 'application/json' })]),
      [blocked, JSON.stringify({ relationships_following: [{ title: 'alice', string_list_data: [{ timestamp: T }] }] })]);
    await page.click('[data-a=go]');
    await page.waitForFunction(() => !S.up);
    await page.click('[data-a=tab][data-t=bl]');
    const names = await page.$$eval('#list .r .uc a', as => as.map(a => a.textContent));
    assert.deepStrictEqual(names, ['troll_1']);
    assert.strictEqual(await page.$('#list .r [data-a=mk]'), null, 'no keep/remove on blocked accounts');
    assert.deepStrictEqual(page.__errors || [], []);
    await context.close();
  },
  async 'a mark saved by an older version still loads unchanged'(browser) {
    const { context, page } = await openDevice(browser);
    await importExport(page, { profile: 'me', fing: FING, fers: FERS });
    await page.evaluate(() => { S.P.me.meta = { alice: { k: 1, t: 1 }, carol: { s: 'r', t: 2 } }; render(); });
    assert.deepStrictEqual(await marks(page, 'me'), { alice: 'k', carol: 'r' });
    assert.ok(await page.$('[data-a=mk][data-u="alice"].on2'));
    await context.close();
  },
};
