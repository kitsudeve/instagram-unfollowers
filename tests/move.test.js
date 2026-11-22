// Moving saved data from the old web address to the new one. Both addresses
// are served the local index.html, so they are two real, separate origins
// with their own browser storage, as on Vercel.
const assert = require('assert');
const path = require('path');
const { importExport, marks, mark, settle } = require('./helpers');

const OLD = 'https://instagram-unfollowers-iota.vercel.app';
const NEW = 'https://unfollower-checker-kitsudeve.vercel.app';
const T = 1600000000;
const FING = { alice: T, bob: T + 10, carol: T + 20 };
const FERS = { bob: T + 15, dave: T + 25 };

async function context(browser) {
  const ctx = await browser.newContext();
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await ctx.route(/cdnjs\.cloudflare\.com\/.*jszip/, r => r.fulfill({ path: require.resolve('jszip/dist/jszip.min.js'), contentType: 'text/javascript' }));
  for (const o of [OLD, NEW]) await ctx.route(o + '/**', r => r.request().url().endsWith('/seed')
    ? r.fulfill({ body: '<!doctype html><title>seed</title>', contentType: 'text/html' })
    : r.fulfill({ path: path.resolve(__dirname, '..', 'index.html'), contentType: 'text/html' }));
  return ctx;
}
// Make data on a scratch copy of the app, then copy its browser storage onto
// the old address (opening the old address with nothing saved redirects).
async function seedOld(browser, ctx, setup) {
  const tmp = await context(browser);
  const p = await open(tmp, NEW + '/');
  await setup(p);
  const items = await p.evaluate(() => Object.assign({}, localStorage));
  await tmp.close();
  const s = await ctx.newPage();
  await s.goto(OLD + '/seed');
  await s.evaluate(it => Object.entries(it).forEach(([k, v]) => localStorage.setItem(k, v)), items);
  await s.close();
}
async function open(ctx, url) {
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForFunction(() => ready === true);
  return page;
}

module.exports = {
  async 'data moves from the old address to the new one, after asking'(browser) {
    const ctx = await context(browser);
    await seedOld(browser, ctx, async p => {
      await importExport(p, { profile: 'me', fing: FING, fers: FERS, date: '2026-11-15' });
      await mark(p, 'alice', 'k'); await settle(p);
    });
    const old = await open(ctx, OLD + '/');
    assert.ok((await old.textContent('#mvb')).includes('new address'));
    const [tab] = await Promise.all([ctx.waitForEvent('page'), old.click('[data-a=mvgo]')]);
    await tab.waitForSelector('[data-a=rstgo]');
    assert.ok((await tab.textContent('#modal')).includes('Bring your data to the new address?'));
    await tab.click('[data-a=rstgo]'); await settle(tab);
    await old.waitForFunction(() => mvState === 'done');
    // The new address keeps it after a reload; the old address still has its copy.
    await tab.reload(); await tab.waitForFunction(() => ready === true);
    assert.deepStrictEqual(await marks(tab, 'me'), { alice: 'k' });
    assert.strictEqual(await tab.evaluate(() => S.P.me.date), '2026-11-15');
    assert.ok(await old.evaluate(() => !!localStorage.getItem('ig_me')), 'old copy kept');
    // Coming back to the old address now goes straight to the new one.
    await old.goto(OLD + '/');
    await old.waitForURL(NEW + '/');
    await ctx.close();
  },
  async 'moving merges with data already on the new address'(browser) {
    const ctx = await context(browser);
    const nw = await open(ctx, NEW + '/');
    await importExport(nw, { profile: 'me', fing: { ...FING, erin: T + 30 }, fers: FERS, date: '2026-11-20' });
    await mark(nw, 'erin', 'r'); await settle(nw); await nw.close();
    await seedOld(browser, ctx, async p => {
      await importExport(p, { profile: 'me', fing: FING, fers: FERS, date: '2026-11-15' });
      await mark(p, 'carol', 'k'); await settle(p);
    });
    const old = await open(ctx, OLD + '/');
    const [tab] = await Promise.all([ctx.waitForEvent('page'), old.click('[data-a=mvgo]')]);
    await tab.waitForSelector('[data-a=rstgo]');
    await tab.click('[data-a=rstgo]'); await settle(tab);
    assert.strictEqual(await tab.evaluate(() => S.P.me.date), '2026-11-20');
    assert.deepStrictEqual(await marks(tab, 'me'), { carol: 'k', erin: 'r' });
    await ctx.close();
  },
  async 'a visitor with nothing saved on the old address is sent to the new one'(browser) {
    const ctx = await context(browser);
    const page = await ctx.newPage();
    await page.goto(OLD + '/');
    await page.waitForURL(NEW + '/');
    await ctx.close();
  },
  async 'cancelling the move changes nothing on either address'(browser) {
    const ctx = await context(browser);
    await seedOld(browser, ctx, p => importExport(p, { profile: 'me', fing: FING, fers: FERS }));
    const old = await open(ctx, OLD + '/');
    const [tab] = await Promise.all([ctx.waitForEvent('page'), old.click('[data-a=mvgo]')]);
    await tab.waitForSelector('[data-a=rstno]');
    await tab.click('[data-a=rstno]'); await settle(tab);
    assert.strictEqual(await tab.evaluate(() => mine().length), 0);
    assert.strictEqual(await old.evaluate(() => mvState), 'sending');
    assert.strictEqual(await old.evaluate(() => localStorage.getItem('ig_moved')), null);
    await ctx.close();
  },
};
