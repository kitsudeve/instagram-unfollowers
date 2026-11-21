// Shared helpers for the browser tests. Each "device" is a fresh browser
// context (its own localStorage). An optional fake Claude database lives in
// Node and is shared by every device given the same `db` object.
const { chromium } = require('playwright');
const path = require('path');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');

function makeDb() {
  return { docs: new Map(), failWrites: false, writes: 0 };
}

async function launch() {
  return chromium.launch();
}

// Open the app as one device. `db` (from makeDb) turns on the fake Claude
// account; leave it out for the plain browser-storage version (Vercel).
async function openDevice(browser, db, ctx) {
  const context = ctx || (await browser.newContext());
  // Keep the tests offline-safe: the font is cosmetic.
  await context.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  if (db && !ctx) {
    await context.exposeBinding('__dbGet', (_, k) => (db.docs.has(k) ? JSON.parse(db.docs.get(k)) : null));
    await context.exposeBinding('__dbSet', (_, k, v) => {
      if (db.failWrites) throw new Error('database unavailable');
      db.writes++;
      db.docs.set(k, JSON.stringify(v));
    });
    await context.exposeBinding('__dbDel', (_, k) => {
      if (db.failWrites) throw new Error('database unavailable');
      db.docs.delete(k);
    });
    await context.addInitScript(() => {
      const doc = full => ({
        get: async () => { const v = await window.__dbGet(full); return { exists: v != null, data: () => v }; },
        set: async v => { await window.__dbSet(full, v); },
        delete: async () => { await window.__dbDel(full); },
      });
      window.claude = {
        use: async k => k === 'user' ? { id: async () => 'u1' }
          : k === 'db' ? { collection: p => ({ doc: id => doc(p + '/' + id) }) }
          : null,
      };
    });
  }
  const page = await context.newPage();
  page.on('pageerror', e => { page.__errors = (page.__errors || []).concat(String(e)); });
  await page.goto(APP);
  await page.waitForFunction(() => ready === true);
  return { context, page };
}

async function reload(page) {
  await page.reload();
  await page.waitForFunction(() => ready === true);
}

// Instagram export shapes.
const followersJson = m => JSON.stringify(Object.entries(m).map(([u, t]) => ({
  title: '', media_list_data: [], string_list_data: [{ href: 'https://www.instagram.com/' + u, value: u, timestamp: t }],
})));
const followingJson = m => JSON.stringify({ relationships_following: Object.entries(m).map(([u, t]) => ({
  title: u, string_list_data: [{ href: 'https://www.instagram.com/_u/' + u, timestamp: t }],
})) });

// Import through the real Upload dialog.
async function importExport(page, { profile, fing, fers, date }) {
  await page.click('[data-a=up]');
  const opts = await page.$$eval('#pf option', os => os.map(o => o.value));
  if (opts.includes(profile)) await page.selectOption('#pf', profile);
  else { await page.selectOption('#pf', '__new'); await page.fill('#un', profile); }
  if (date) await page.fill('#dt', date);
  const files = [];
  if (fing) files.push({ name: 'following.json', mimeType: 'application/json', buffer: Buffer.from(followingJson(fing)) });
  if (fers) files.push({ name: 'followers_1.json', mimeType: 'application/json', buffer: Buffer.from(followersJson(fers)) });
  await page.setInputFiles('#fl', files);
  await page.click('[data-a=go]');
  await page.waitForFunction(() => !S.up);
  await settle(page);
}

// Let debounced saves (400 ms) and async db writes finish.
const settle = page => page.waitForTimeout(700);

const marks = (page, profile) => page.evaluate(n => {
  const m = S.P[n] && S.P[n].meta || {}, o = {};
  Object.keys(m).forEach(u => { const s = m[u].s || (m[u].k ? 'k' : m[u].x ? 'r' : ''); if (s) o[u] = s; });
  return o;
}, profile);

const mark = (page, u, v) => page.click('[data-a=' + (v === 'k' ? 'mk' : 'mr') + '][data-u="' + u + '"]');

async function switchProfile(page, n) { await page.selectOption('[data-p]', n); }

module.exports = { launch, openDevice, reload, makeDb, importExport, settle, marks, mark, switchProfile };
