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
    // Status filters are separate: Kept is plain keeps only, Super kept is only those.
    assert.deepStrictEqual(await page.evaluate(() => { S.f.st = ['k']; return view(); }), []);
    assert.deepStrictEqual(await page.evaluate(() => { S.f.st = ['k', 'K']; return view(); }), ['alice']);
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
  async 'Requests and Blocked tabs always show, with a hint when empty'(browser) {
    const { context, page } = await openDevice(browser);
    await importExport(page, { profile: 'me', fing: FING, fers: FERS });
    const tabs = await page.$$eval('#tb button', bs => bs.map(b => b.dataset.t));
    assert.ok(tabs.includes('pend') && tabs.includes('bl'), tabs.join());
    await page.click('[data-a=tab][data-t=bl]');
    assert.ok(/whole Instagram zip/.test(await page.textContent('#list .empty')));
    await context.close();
  },
  async 'development copy shows only the example profile and saves nothing'(browser) {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      window.UC_DEV = true;
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('ig_idx', JSON.stringify(['real']));
        localStorage.setItem('ig_real', JSON.stringify({ name: 'real', date: '2026-11-01', fing: { x: 1 }, fers: {}, log: [], sa: 1 }));
      }
    });
    const { page } = await openDevice(browser, null, context);
    assert.deepStrictEqual(await page.evaluate(() => Object.keys(S.P)), ['example_user']);
    assert.ok(/Development copy/.test(await page.textContent('#hb')));
    await importExport(page, { profile: 'test', fing: FING, fers: FERS });
    await mark(page, 'alice', 'k'); await settle(page);
    const keys = await page.evaluate(() => Object.keys(localStorage).sort());
    assert.deepStrictEqual(keys, ['ig_idx', 'ig_real'], 'nothing new written');
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('ig_idx')), JSON.stringify(['real']));
    await context.close();
  },
  async 'unfollowing someone who does not follow you keeps the mark and is not logged as a reset'(browser) {
    const { context, page } = await openDevice(browser);
    // alice: unfollower (you unfollow her) · carol: unfollower who follows back later · bob: mutual you unfollow
    await importExport(page, { profile: 'me', fing: FING, fers: FERS, date: '2026-11-01' });
    await mark(page, 'alice', 'r'); await mark(page, 'carol', 'r');
    await page.click('[data-a=tab][data-t=fb]'); await mark(page, 'bob', 'k');
    await importExport(page, { profile: 'me', fing: { carol: T + 20 }, fers: { bob: T + 15, dave: T + 25, carol: T + 40 }, date: '2026-11-15' });
    const g = await page.evaluate(() => S.P.me.log[0]);
    assert.deepStrictEqual(g.fr.sort(), ['alice', 'bob']);
    // carol followed back and bob still follows you after you unfollowed him: both need a look.
    assert.deepStrictEqual(g.rs.sort(), ['bob', 'carol']);
    assert.deepStrictEqual(await marks(page, 'me'), { alice: 'r' });
    assert.strictEqual((await meta(page, 'alice')).s, 'r', 'mark kept');
    await context.close();
  },
  async 'the import message stays until you close it'(browser) {
    const { context, page } = await openDevice(browser);
    await importExport(page, { profile: 'me', fing: FING, fers: FERS });
    await page.waitForTimeout(4500);
    assert.strictEqual(await page.isVisible('#msg'), true);
    assert.ok(/Imported the/.test(await page.textContent('#msg')));
    await page.click('#msg [data-a=msgx]');
    assert.strictEqual(await page.isVisible('#msg'), false);
    // Short messages still go away on their own.
    await mark(page, 'alice', 'k');
    await context.close();
  },
  async 'a super keep reads as kept everywhere'(browser) {
    const { context, page } = await openDevice(browser);
    await importExport(page, { profile: 'me', fing: FING, fers: FERS });
    await openChecker(page, []);
    await page.click('[data-a=ckm]'); await page.click('.kmenu [data-k=K]'); await after(page);
    await page.click('[data-a=back]').catch(() => page.evaluate(() => ckAct('back')));
    await page.evaluate(() => ckAct('back')); await after(page);
    assert.ok(/^Kept/.test(await page.textContent('#kc button.tag')), await page.textContent('#kc button.tag'));
    await page.click('[data-a=ckclose]');
    assert.ok(await page.$('[data-a=mk][data-u="alice"].on2'), 'Keep button shows as on');
    assert.ok(await page.$('.r.sk .uc a[href*="alice"]'), 'row shows as kept');
    assert.strictEqual(await page.evaluate(() => { const v = cp().meta.alice; return st(v); }), 'k');
    await context.close();
  },
  async 'tapping Keep on a super kept account keeps the star'(browser) {
    const { context, page } = await openDevice(browser);
    await importExport(page, { profile: 'me', fing: FING, fers: FERS });
    await openChecker(page, []);
    await page.click('[data-a=ckm]'); await page.click('.kmenu [data-k=K]'); await after(page);
    await page.evaluate(() => ckAct('back')); await after(page);
    await page.click('#ck [data-a=ck][data-k=k]'); await after(page);
    assert.strictEqual((await meta(page, 'alice')).sk, 1);
    await page.click('[data-a=ckclose]');
    await page.evaluate(() => { S.info = 'alice'; render(); });
    await page.click('#modal [data-a=mk]');
    assert.strictEqual((await meta(page, 'alice')).sk, 1, 'details Keep leaves it too');
    await page.click('#modal [data-a=msk]');
    const m = await meta(page, 'alice');
    assert.ok(!m.sk && !m.s, 'the star button is how you take it off');
    await context.close();
  },
  async 'going back in the checker lights up the button it was marked with'(browser) {
    const { context, page } = await openDevice(browser);
    await importExport(page, { profile: 'me', fing: FING, fers: FERS });
    await openChecker(page, []);
    assert.strictEqual(await page.$('#kc ~ .kb .rb.on'), null, 'nothing lit on an unchecked account');
    await page.click('#ck [data-a=ck][data-k=k]'); await after(page);
    await page.click('#ck [data-a=ck][data-k=r]'); await after(page);
    await page.evaluate(() => ckAct('back'));
    assert.strictEqual(await cardName(page), 'carol');
    assert.ok(await page.$('#ck .rb.x.on'), 'Remove is lit'); assert.strictEqual(await page.$('#ck .rb.g.on'), null);
    await page.evaluate(() => ckAct('back'));
    assert.ok(await page.$('#ck .rb.g.on'), 'Keep is lit'); assert.strictEqual(await page.$('#ck .rb.x.on'), null);
    await context.close();
  },
  async 'deleted and deactivated accounts cannot be kept or removed'(browser) {
    const { context, page } = await openDevice(browser);
    const D = '__deleted__x1';
    await importExport(page, { profile: 'me', fing: Object.assign({ [D]: T + 5 }, FING), fers: FERS });
    await openChecker(page, ['del', 'u']);
    assert.strictEqual(await cardName(page), 'Deleted account');
    assert.strictEqual(await page.$eval('#ck [data-k=k]', b => b.disabled), true);
    assert.strictEqual(await page.$eval('#ck [data-k=r]', b => b.disabled), true);
    await page.evaluate(() => ckAct('k')); await after(page);
    assert.strictEqual(await cardName(page), 'Deleted account', 'no move, no mark');
    assert.deepStrictEqual(await meta(page, D), {});
    await page.evaluate(() => ckAct('skip')); await after(page);
    // alice: mark deactivated, then Keep/Remove are blocked until unmarked.
    await page.click('[data-a=ckm]'); await page.click('.kmenu [data-k=d]'); await after(page);
    await page.evaluate(() => ckAct('back'));
    assert.strictEqual(await page.$eval('#ck [data-k=k]', b => b.disabled), true);
    await page.click('[data-a=ckm]');
    assert.strictEqual(await page.$('.kmenu [data-k=K]'), null, 'no super keep either');
    await page.click('[data-a=ckclose]');
    assert.strictEqual(await page.$eval('[data-a=mk][data-u="alice"]', b => b.disabled), true);
    await page.evaluate(() => { const b = document.querySelector('[data-a=mr][data-u="alice"]'); b.disabled = false; b.click(); });
    assert.strictEqual((await meta(page, 'alice')).s, 'd', 'still deactivated');
    // Bulk keep skips both.
    await page.evaluate(D => { S.sel = new Set([D, 'alice', 'carol']); document.querySelector('body').dispatchEvent(new Event('x')); }, D);
    await page.evaluate(() => { const b = document.createElement('button'); b.dataset.a = 'bk'; document.body.appendChild(b); b.click(); b.remove(); });
    assert.strictEqual((await meta(page, 'alice')).s, 'd');
    assert.deepStrictEqual(await meta(page, D), {});
    assert.strictEqual((await meta(page, 'carol')).s, 'k');
    await context.close();
  },
  async 'Deleted is a status filter and request lists are not filters'(browser) {
    const { context, page } = await openDevice(browser);
    const D = '__deleted__x1';
    await importExport(page, { profile: 'me', fing: Object.assign({ [D]: T + 5 }, FING), fers: FERS });
    const r = await page.evaluate(() => ({
      usr: FSEC.find(x => x.k === 'usr').o.map(x => x[0]),
      st: FSEC.find(x => x.k === 'st').o.map(x => x[0]),
      flg: FSEC.find(x => x.k === 'flg').o.map(x => x[0]) }));
    assert.ok(!r.usr.includes('del')); assert.ok(r.st.includes('del'));
    assert.ok(!r.flg.includes('pend') && !r.flg.includes('req'));
    assert.deepStrictEqual(await page.evaluate(() => { S.f.st = ['del']; return view(); }), ['__deleted__x1']);
    assert.ok(!(await page.evaluate(() => { S.f.st = ['u']; return view(); })).includes(D), 'deleted is not also Unchecked');
    await context.close();
  },
  async 'filters carry over between the tabs and the checker'(browser) {
    const { context, page } = await openDevice(browser);
    await importExport(page, { profile: 'me', fing: FING, fers: FERS });
    await page.click('#msg [data-a=msgx]');
    await page.click('[data-a=lf]');
    await page.check('[data-f=st][value=u]');
    await page.click('[data-a=check]').catch(() => page.evaluate(() => ckOpen()));
    await page.waitForSelector('#kc');
    assert.deepStrictEqual(await page.evaluate(() => S.cks.st), ['u'], 'tab filter shows in the checker');
    await page.click('[data-a=ckf]');
    await page.check('[data-ck=usr][value=digits]');
    await page.click('.kfp [data-a=ckf]');
    assert.strictEqual(await page.$('.kfp'), null, 'Done closes the filters');
    await page.click('[data-a=ckclose]');
    assert.deepStrictEqual(await page.evaluate(() => [S.f.st, S.f.usr]), [['u'], ['digits']], 'checker filter shows in the tabs');
    await context.close();
  },
};
