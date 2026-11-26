// Close friends, favourites and the other lists from the export's extra files.
const assert = require('assert');
const JSZip = require('jszip');
const { openDevice, importExport, settle, followersJson, followingJson } = require('./helpers');

const T = 1600000000;
const DIR = 'connections/followers_and_following/';
// Instagram's list files: { relationships_x: [{ title, string_list_data: [{ href, value, timestamp }] }] }
const list = (key, users, shape) => JSON.stringify({ [key]: users.map(u => (
  shape === 'href-only'
    ? { title: '', media_list_data: [], string_list_data: [{ href: 'https://www.instagram.com/_u/' + u, timestamp: T }] }
    : { title: '', media_list_data: [], string_list_data: [{ href: 'https://www.instagram.com/' + u, value: u, timestamp: T }] })) });

async function importZip(page, files, profile = 'me') {
  const z = new JSZip();
  Object.entries(files).forEach(([n, t]) => z.file(DIR + n, t));
  const buf = await z.generateAsync({ type: 'nodebuffer' });
  await page.click('[data-a=up]');
  const opts = await page.$$eval('#pf option', os => os.map(o => o.value));
  if (opts.includes(profile)) await page.selectOption('#pf', profile);
  else { await page.selectOption('#pf', '__new'); await page.fill('#un', profile); }
  await page.setInputFiles('#fl', { name: 'instagram-' + profile + '-2026-11-12-AbCd.zip', mimeType: 'application/zip', buffer: buf });
  await page.click('[data-a=go]');
  await page.waitForFunction(() => !S.up);
  const msg = await page.textContent('#msg');
  await settle(page);
  return msg;
}
const badges = (page, u) => page.$$eval('.r', (rs, u) => {
  const r = rs.find(x => (x.querySelector('.uc a') || {}).textContent === u);
  return r ? [...r.querySelectorAll('.bdg')].map(b => b.textContent) : null;
}, u);

module.exports = {
  async 'close friends and favourites from the zip show as labels'(browser) {
    const { context, page } = await openDevice(browser);
    const msg = await importZip(page, {
      'followers_1.json': followersJson({ bob: T }), 'following.json': followingJson({ alice: T, bob: T }),
      'close_friends.json': list('relationships_close_friends', ['bob']),
      "profiles_you've_favorited.json": list('relationships_feed_favorites', ['alice']),
    });
    assert.ok(msg.includes('close friends'), msg);
    assert.deepStrictEqual(await badges(page, 'alice'), ['Favourite']);
    await page.click('[data-a=tab][data-t=fb]');
    assert.deepStrictEqual(await badges(page, 'bob'), ['Close friend']);
    await context.close();
  },
  async 'a list file with the username only in the link is still read'(browser) {
    const { context, page } = await openDevice(browser);
    await importZip(page, {
      'followers_1.json': followersJson({ bob: T }), 'following.json': followingJson({ alice: T, bob: T }),
      'close_friends.json': list('relationships_close_friends', ['bob'], 'href-only'),
    });
    assert.deepStrictEqual(await page.evaluate(() => Object.keys(S.P.me.fl.cf)), ['bob']);
    await context.close();
  },
  async 'uploading only followers and following says the lists are missing'(browser) {
    const { context, page } = await openDevice(browser);
    await page.click('[data-a=up]');
    await page.selectOption('#pf', '__new'); await page.fill('#un', 'me');
    await page.evaluate(([a, b]) => pickFiles([new File([a], 'followers_1.json'), new File([b], 'following.json')]),
      [followersJson({ bob: T }), followingJson({ alice: T })]);
    await page.click('[data-a=go]'); await page.waitForFunction(() => !S.up);
    const msg = await page.textContent('#msg');
    assert.ok(msg.includes('upload the whole zip'), msg);
    await context.close();
  },
  async 'labels stay when a later export is uploaded without them'(browser) {
    const { context, page } = await openDevice(browser);
    await importZip(page, {
      'followers_1.json': followersJson({ bob: T }), 'following.json': followingJson({ alice: T, bob: T }),
      'close_friends.json': list('relationships_close_friends', ['bob']),
    });
    await importExport(page, { profile: 'me', fing: { alice: T, bob: T }, fers: { bob: T }, date: '2026-11-20' });
    assert.deepStrictEqual(await page.evaluate(() => Object.keys(S.P.me.fl.cf)), ['bob']);
    await context.close();
  },
  // The shape of Instagram's newer exports (checked against a real 2025 export,
  // rebuilt here with made-up accounts): a bare list of label_values entries,
  // where URL is the person's own website.
  async 'newer export lists (label_values) fill close friends, favourites, requests and blocked'(browser) {
    const { context, page } = await openDevice(browser);
    const lv = (users, site) => JSON.stringify(users.map((u, i) => ({ timestamp: T + i, media: [], label_values: [
      { label: 'URL', value: site && i === 0 ? 'https://example.com/shop' : '' },
      { label: 'Name', value: i ? 'Someone ' + i : '' },
      { label: 'Username', value: u }] })));
    const msg = await importZip(page, {
      'followers_1.json': followersJson({ bob: T, carol: T }), 'following.json': followingJson({ alice: T, bob: T, carol: T }),
      'close_friends.json': lv(['bob', 'carol'], true),
      "profiles_you've_favorited.json": lv(['alice']),
      'pending_follow_requests.json': lv(['dan_private', 'erin.private']),
      'blocked_profiles.json': lv(['spam.bot']),
      'removed_suggestions.json': lv(['ignored_one']),
    });
    const fl = await page.evaluate(() => S.P.me.fl);
    assert.deepStrictEqual(Object.keys(fl.cf).sort(), ['bob', 'carol']);
    assert.deepStrictEqual(Object.keys(fl.fav), ['alice']);
    assert.deepStrictEqual(Object.keys(fl.pend).sort(), ['dan_private', 'erin.private']);
    assert.deepStrictEqual(Object.keys(fl.bl), ['spam.bot']);
    assert.strictEqual(fl.pend.dan_private, T, 'keeps the request date');
    assert.ok(/close friends/.test(msg) && /blocked/.test(msg), msg);
    const tabs = await page.$$eval('#tb button', bs => bs.map(b => b.textContent));
    assert.ok(tabs.includes('Requests2') && tabs.includes('Blocked1'), tabs.join());
    await context.close();
  },
};
