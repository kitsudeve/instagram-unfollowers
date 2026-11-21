// Core behaviour on the plain browser-storage version (no Claude account).
const assert = require('assert');
const { openDevice, reload, importExport, marks, mark, settle } = require('./helpers');

const T = 1600000000;
const FING = { alice: T, bob: T + 10, carol: T + 20 };
const FERS = { bob: T + 15, dave: T + 25 };

module.exports = {
  async 'import sorts accounts into the right tabs'(browser) {
    const { context, page } = await openDevice(browser);
    await importExport(page, { profile: 'me', fing: FING, fers: FERS });
    const tabs = await page.$$eval('#tb button', bs => bs.map(b => b.textContent));
    assert.deepStrictEqual(tabs.slice(0, 3), ['Unfollowers2', 'Mutuals1', 'Fans1']);
    assert.deepStrictEqual(page.__errors || [], []);
    await context.close();
  },
  async 'marks survive a reload'(browser) {
    const { context, page } = await openDevice(browser);
    await importExport(page, { profile: 'me', fing: FING, fers: FERS });
    await mark(page, 'alice', 'k'); await mark(page, 'carol', 'r'); await settle(page);
    await reload(page);
    assert.deepStrictEqual(await marks(page, 'me'), { alice: 'k', carol: 'r' });
    await context.close();
  },
  async 'a renamed account keeps its mark'(browser) {
    const { context, page } = await openDevice(browser);
    await importExport(page, { profile: 'me', fing: FING, fers: FERS, date: '2026-11-01' });
    await mark(page, 'alice', 'k'); await settle(page);
    const fing2 = { alice_new: T, bob: T + 10, carol: T + 20 };
    await importExport(page, { profile: 'me', fing: fing2, fers: FERS, date: '2026-11-15' });
    assert.deepStrictEqual(await marks(page, 'me'), { alice_new: 'k' });
    const rn = await page.evaluate(() => S.P.me.log[0].rn);
    assert.deepStrictEqual(rn, [['alice', 'alice_new']]);
    await context.close();
  },
  async 'backup and restore round trip'(browser) {
    const { context, page } = await openDevice(browser);
    await importExport(page, { profile: 'me', fing: FING, fers: FERS });
    await mark(page, 'alice', 'k'); await settle(page);
    const bk = await page.evaluate(() => backup());
    const two = await openDevice(browser);
    await two.page.click('[data-a=set]');
    await two.page.setInputFiles('#rs', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(bk) });
    await settle(two.page);
    await reload(two.page);
    assert.deepStrictEqual(await marks(two.page, 'me'), { alice: 'k' });
    await context.close(); await two.context.close();
  },
};
