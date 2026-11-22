// Restoring asks first and merges, failed saves are visible, and the export
// date comes from the files (older exports can't replace newer ones).
const assert = require('assert');
const JSZip = require('jszip');
const { openDevice, reload, importExport, marks, mark, settle, followersJson, followingJson } = require('./helpers');

const T = 1600000000;
const FING = { alice: T, bob: T + 10, carol: T + 20 };
const FERS = { bob: T + 15, dave: T + 25 };

async function pickBackup(page, json) {
  await page.click('[data-a=set]');
  await page.setInputFiles('#rs', { name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await page.waitForSelector('[data-a=rstgo]');
}

// A backup made on 1 Nov, then newer work on this device.
async function olderBackupThenNewerWork(browser) {
  const dev = await openDevice(browser);
  const { page } = dev;
  await importExport(page, { profile: 'me', fing: FING, fers: FERS, date: '2026-11-01' });
  await mark(page, 'alice', 'k'); await mark(page, 'carol', 'k'); await settle(page);
  const bk = await page.evaluate(() => backup());
  await page.waitForTimeout(1100); // so later marks are dated later
  await importExport(page, { profile: 'me', fing: { ...FING, erin: T + 30 }, fers: FERS, date: '2026-11-15' });
  await mark(page, 'alice', 'r'); await settle(page);
  // The backup also holds a mark this device never made.
  const j = JSON.parse(bk); j.profiles.me.meta.bob = { s: 'k', t: Math.round(Date.now() / 1000) - 5 };
  return { ...dev, bk: JSON.stringify(j) };
}

module.exports = {
  async 'restore asks first, and Cancel changes nothing'(browser) {
    const { context, page, bk } = await olderBackupThenNewerWork(browser);
    const before = await page.evaluate(() => JSON.stringify(S.P.me));
    await pickBackup(page, bk);
    const text = await page.textContent('#modal');
    assert.ok(text.includes('Restore this backup?'), text);
    assert.ok(text.includes('your lists stay'), text);
    assert.strictEqual(await page.evaluate(() => JSON.stringify(S.P.me)), before);
    await page.click('[data-a=rstno]');
    assert.strictEqual(await page.evaluate(() => JSON.stringify(S.P.me)), before);
    await context.close();
  },
  async 'restoring an older backup keeps newer lists and newer marks'(browser) {
    const { context, page, bk } = await olderBackupThenNewerWork(browser);
    await pickBackup(page, bk);
    await page.click('[data-a=rstgo]'); await settle(page);
    await reload(page);
    const p = await page.evaluate(() => ({ date: S.P.me.date, erin: 'erin' in S.P.me.fing }));
    assert.deepStrictEqual(p, { date: '2026-11-15', erin: true });
    // alice: newer Remove wins over the backup's Keep. bob: added from the backup.
    assert.deepStrictEqual(await marks(page, 'me'), { alice: 'r', bob: 'k', carol: 'k' });
    await context.close();
  },
  async 'a newer backup replaces the lists but still merges marks'(browser) {
    const one = await openDevice(browser);
    await importExport(one.page, { profile: 'me', fing: { ...FING, erin: T + 30 }, fers: FERS, date: '2026-11-15' });
    await mark(one.page, 'erin', 'k'); await settle(one.page);
    const bk = await one.page.evaluate(() => backup());
    const two = await openDevice(browser);
    await importExport(two.page, { profile: 'me', fing: FING, fers: FERS, date: '2026-11-01' });
    await mark(two.page, 'carol', 'r'); await settle(two.page);
    await pickBackup(two.page, bk);
    assert.ok((await two.page.textContent('#modal')).includes('its lists replace yours'));
    await two.page.click('[data-a=rstgo]'); await settle(two.page);
    await reload(two.page);
    assert.strictEqual(await two.page.evaluate(() => S.P.me.date), '2026-11-15');
    assert.deepStrictEqual(await marks(two.page, 'me'), { carol: 'r', erin: 'k' });
    await one.context.close(); await two.context.close();
  },
  async 'restore can be undone'(browser) {
    const { context, page, bk } = await olderBackupThenNewerWork(browser);
    const before = await marks(page, 'me');
    await pickBackup(page, bk);
    await page.click('[data-a=rstgo]'); await settle(page);
    assert.notDeepStrictEqual(await marks(page, 'me'), before);
    await page.click('#msg [data-a=undo]'); await settle(page);
    await reload(page);
    assert.deepStrictEqual(await marks(page, 'me'), before);
    await context.close();
  },
  async 'bug 6: a save the browser refuses shows a warning'(browser) {
    const { context, page } = await openDevice(browser);
    await importExport(page, { profile: 'me', fing: FING, fers: FERS });
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); }; });
    await mark(page, 'alice', 'k'); await settle(page);
    const banner = await page.textContent('#hb');
    assert.ok(banner.includes('couldn’t be saved'), banner);
    assert.ok(banner.includes('storage may be full'), banner);
    await context.close();
  },
  async 'a backup reminder shows until a backup is downloaded'(browser) {
    const { context, page } = await openDevice(browser);
    await page.evaluate(() => { persist = 'no'; render(); });
    assert.strictEqual(await page.$('#bkr'), null, 'no reminder before any data');
    await importExport(page, { profile: 'me', fing: FING, fers: FERS });
    assert.ok(await page.$('#bkr'), 'reminder once there is data');
    await page.click('#bkr [data-a=bkup]'); await page.waitForTimeout(200);
    assert.strictEqual(await page.$('#bkr'), null, 'gone after a backup');
    await context.close();
  },
  async 'export date comes from the file name'(browser) {
    const { context, page } = await openDevice(browser);
    await importExport(page, { profile: 'me', fing: FING, fers: FERS, date: '2026-11-20',
      names: { fers: 'followers_1-2026-11-18.json' } });
    assert.strictEqual(await page.evaluate(() => S.P.me.date), '2026-11-18');
    await context.close();
  },
  async 'export date comes from when the files were saved'(browser) {
    const { context, page } = await openDevice(browser);
    await importExport(page, { profile: 'me', fing: FING, fers: FERS, date: '2026-11-10' });
    assert.strictEqual(await page.evaluate(() => S.P.me.date), '2026-11-10');
    await context.close();
  },
  async 'export date and username come from an Instagram zip'(browser) {
    const { context, page } = await openDevice(browser);
    const z = new JSZip(), d = new Date('2026-11-12T09:00:00Z');
    z.file('connections/followers_and_following/followers_1.json', followersJson(FERS), { date: d });
    z.file('connections/followers_and_following/following.json', followingJson(FING), { date: d });
    const buf = await z.generateAsync({ type: 'nodebuffer' });
    await page.click('[data-a=up]');
    await page.setInputFiles('#fl', { name: 'instagram-hayley.test-2026-11-12-AbCd.zip', mimeType: 'application/zip', buffer: buf });
    assert.strictEqual(await page.inputValue('#un'), 'hayley.test');
    assert.ok((await page.textContent('#dtx')).includes('12 Nov 2026'));
    await page.click('[data-a=go]'); await page.waitForFunction(() => !S.up); await settle(page);
    assert.strictEqual(await page.evaluate(() => S.P['hayley.test'].date), '2026-11-12');
    await context.close();
  },
  async 'an older export cannot replace a newer one'(browser) {
    const { context, page } = await openDevice(browser);
    await importExport(page, { profile: 'me', fing: FING, fers: FERS, date: '2026-11-15' });
    await mark(page, 'alice', 'k'); await settle(page);
    const before = await page.evaluate(() => JSON.stringify(S.P.me));
    const err = await importExport(page, { profile: 'me', fing: { alice: T }, fers: {}, date: '2026-11-01', expectError: true });
    assert.ok(err.includes('already has a newer one'), err);
    assert.strictEqual(await page.evaluate(() => JSON.stringify(S.P.me)), before);
    await context.close();
  },
};
