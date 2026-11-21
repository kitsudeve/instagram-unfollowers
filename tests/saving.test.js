// Regression tests for the data-loss bugs found in the 21 Nov review.
const assert = require('assert');
const { openDevice, reload, makeDb, importExport, marks, mark, settle, switchProfile } = require('./helpers');

const T = 1600000000;
const FING = { alice: T, bob: T + 10, carol: T + 20 };
const FERS = { bob: T + 15 };
const FING_B = { xavier: T, yusuf: T + 10 };

module.exports = {
  async 'bug 1: a mark is saved even if you switch profile straight away'(browser) {
    const { context, page } = await openDevice(browser);
    await importExport(page, { profile: 'one', fing: FING, fers: FERS });
    await importExport(page, { profile: 'two', fing: FING_B, fers: {} });
    await switchProfile(page, 'one');
    await mark(page, 'alice', 'k');
    await switchProfile(page, 'two');
    await mark(page, 'xavier', 'r');
    await settle(page);
    await reload(page);
    assert.deepStrictEqual(await marks(page, 'one'), { alice: 'k' });
    assert.deepStrictEqual(await marks(page, 'two'), { xavier: 'r' });
    await context.close();
  },
  async 'bug 1: closing the page mid-wait still saves both profiles'(browser) {
    const { context, page } = await openDevice(browser);
    await importExport(page, { profile: 'one', fing: FING, fers: FERS });
    await importExport(page, { profile: 'two', fing: FING_B, fers: {} });
    await switchProfile(page, 'one');
    await mark(page, 'alice', 'k');
    await switchProfile(page, 'two');
    await mark(page, 'xavier', 'r');
    await page.evaluate(() => dispatchEvent(new Event('pagehide')));
    const local = await page.evaluate(() => [localStorage.getItem('igm_one'), localStorage.getItem('igm_two')]);
    assert.match(local[0], /alice/);
    assert.match(local[1], /xavier/);
    await context.close();
  },
  async 'bug 2: two devices do not overwrite each other\'s marks'(browser) {
    const db = makeDb();
    const lap = await openDevice(browser, db);
    await importExport(lap.page, { profile: 'me', fing: FING, fers: FERS });
    const phone = await openDevice(browser, db);
    await mark(phone.page, 'alice', 'k'); await settle(phone.page);
    // Laptop still has the page open from before and marks something else.
    await mark(lap.page, 'carol', 'r'); await settle(lap.page);
    const dbMarks = JSON.parse(JSON.parse(db.docs.get('data/users/u1/m_me')).j);
    assert.strictEqual(dbMarks.alice.s, 'k', 'phone mark kept in database');
    assert.strictEqual(dbMarks.carol.s, 'r', 'laptop mark saved');
    // A brand new device sees both.
    const tab = await openDevice(browser, db);
    assert.deepStrictEqual(await marks(tab.page, 'me'), { alice: 'k', carol: 'r' });
    await lap.context.close(); await phone.context.close(); await tab.context.close();
  },
  async 'bug 3: Clear all marks does not come back from another device'(browser) {
    const db = makeDb();
    const lap = await openDevice(browser, db);
    await importExport(lap.page, { profile: 'me', fing: FING, fers: FERS });
    const phone = await openDevice(browser, db);
    await mark(phone.page, 'alice', 'k'); await mark(phone.page, 'carol', 'r'); await settle(phone.page);
    await phone.page.close(); // the phone's browser keeps its own copy of the marks
    await reload(lap.page);
    assert.deepStrictEqual(await marks(lap.page, 'me'), { alice: 'k', carol: 'r' });
    await lap.page.click('[data-a=set]');
    await lap.page.click('[data-a=dmarks]'); await lap.page.click('[data-a=dmarks]');
    await settle(lap.page);
    assert.deepStrictEqual(await marks(lap.page, 'me'), {});
    // Phone comes back later with its stale copy.
    const phone2 = await openDevice(browser, db, phone.context);
    assert.deepStrictEqual(await marks(phone2.page, 'me'), {});
    await lap.context.close(); await phone.context.close();
  },
  async 'bug 3: stale local marks on the same device stay cleared'(browser) {
    const db = makeDb();
    const lap = await openDevice(browser, db);
    await importExport(lap.page, { profile: 'me', fing: FING, fers: FERS });
    await mark(lap.page, 'alice', 'k'); await settle(lap.page);
    // Another device with an older copy of marks in its browser storage.
    const other = await openDevice(browser, db);
    await lap.page.click('[data-a=set]');
    await lap.page.click('[data-a=dmarks]'); await lap.page.click('[data-a=dmarks]');
    await settle(lap.page);
    await reload(other.page);
    assert.deepStrictEqual(await marks(other.page, 'me'), {});
    await mark(other.page, 'carol', 'r'); await settle(other.page);
    await reload(lap.page);
    assert.deepStrictEqual(await marks(lap.page, 'me'), { carol: 'r' });
    await lap.context.close(); await other.context.close();
  },
  async 'Clear all marks can be undone'(browser) {
    const db = makeDb();
    const { context, page } = await openDevice(browser, db);
    await importExport(page, { profile: 'me', fing: FING, fers: FERS });
    await mark(page, 'alice', 'k'); await settle(page);
    await page.click('[data-a=set]');
    await page.click('[data-a=dmarks]'); await page.click('[data-a=dmarks]');
    await page.click('[data-a=undo]'); await settle(page);
    await reload(page);
    assert.deepStrictEqual(await marks(page, 'me'), { alice: 'k' });
    await context.close();
  },
  async 'bug 4: an upload that failed to sync is kept after reload'(browser) {
    const db = makeDb();
    const { context, page } = await openDevice(browser, db);
    await importExport(page, { profile: 'me', fing: FING, fers: FERS, date: '2026-11-01' });
    db.failWrites = true;
    await importExport(page, { profile: 'me', fing: { ...FING, zed: T + 99 }, fers: FERS, date: '2026-11-15' });
    assert.ok(await page.evaluate(() => !!saveErr), 'red banner shown');
    db.failWrites = false;
    await reload(page);
    const fing = await page.evaluate(() => Object.keys(S.P.me.fing).sort());
    assert.deepStrictEqual(fing, ['alice', 'bob', 'carol', 'zed']);
    await settle(page);
    const dbList = JSON.parse(JSON.parse(db.docs.get('data/users/u1/p_me')).j);
    assert.ok('zed' in dbList.fing, 'newer upload pushed to the database');
    await context.close();
  },
  async 'bug 4: a new profile that failed to sync still appears'(browser) {
    const db = makeDb();
    const { context, page } = await openDevice(browser, db);
    await importExport(page, { profile: 'me', fing: FING, fers: FERS });
    db.failWrites = true;
    await importExport(page, { profile: 'second', fing: FING_B, fers: {} });
    db.failWrites = false;
    await reload(page);
    const names = await page.evaluate(() => Object.keys(S.P).sort());
    assert.deepStrictEqual(names, ['example_user', 'me', 'second']);
    await context.close();
  },
  async 'existing data without the new save time still loads (migration)'(browser) {
    const db = makeDb();
    // A profile saved by the old version: no `sa` field anywhere.
    const old = { name: 'me', date: '2026-11-01', fing: FING, fers: FERS, log: [], fl: {} };
    db.docs.set('data/users/u1/index', JSON.stringify({ n: ['me'] }));
    db.docs.set('data/users/u1/p_me', JSON.stringify({ j: JSON.stringify(old) }));
    db.docs.set('data/users/u1/m_me', JSON.stringify({ j: JSON.stringify({ alice: { s: 'k', t: 1795000000 } }) }));
    const { context, page } = await openDevice(browser, db);
    assert.deepStrictEqual(await marks(page, 'me'), { alice: 'k' });
    assert.deepStrictEqual(await page.evaluate(() => Object.keys(S.P.me.fing).sort()), ['alice', 'bob', 'carol']);
    await context.close();
  },
  async 'a profile deleted on one device does not come back from another'(browser) {
    const db = makeDb();
    const lap = await openDevice(browser, db);
    await importExport(lap.page, { profile: 'me', fing: FING, fers: FERS });
    await importExport(lap.page, { profile: 'old', fing: FING_B, fers: {} });
    const phone = await openDevice(browser, db); // phone now has a local copy of "old"
    await lap.page.click('[data-a=set]');
    await lap.page.click('[data-a=dprof]'); await lap.page.click('[data-a=dprof]');
    await settle(lap.page);
    await reload(phone.page); await settle(phone.page);
    assert.deepStrictEqual(await phone.page.evaluate(() => Object.keys(S.P).sort()), ['example_user', 'me']);
    await reload(lap.page);
    assert.deepStrictEqual(await lap.page.evaluate(() => Object.keys(S.P).sort()), ['example_user', 'me']);
    await lap.context.close(); await phone.context.close();
  },
};
