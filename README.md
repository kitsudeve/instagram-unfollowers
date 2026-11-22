# Instagram Unfollowers

A single-page tool for working through your Instagram data export: who doesn't
follow you back, who follows you that you don't follow, what changed between
exports, and pending follow requests.

Your export is read in the browser. Nothing is uploaded anywhere.

## Using it

1. In Instagram: **Settings and activity → Accounts Centre → Your information
   and permissions → Export your information → Create export**.
2. Choose your profile, then **Export to device**.
3. Under **Customize information**, clear every section and tick **Followers
   and following** only.
4. Date range **All time**, format **JSON** (HTML also works).
5. Download the export, then drop the zip (or the files from it) into the page.

The export date is read from the files: from the zip's name, otherwise from
the dates stamped on the files. An export older than the one a profile
already has is refused, so it can't scramble the changes log.

The other files in that folder are optional and add labels to accounts:
`close_friends`, `pending_follow_requests`, `recently_unfollowed_profiles`,
`profiles_you've_favorited`, `blocked_profiles`, `recent_follow_requests`.

## Where data lives

Everything is kept in the browser's local storage for the site, and the page
asks the browser to make that storage persistent. Clearing site data will
remove it, so Settings offers a full JSON backup and a restore, plus a CSV
export that can be imported back. Until a backup has been downloaded in the
last 14 days, and the browser hasn't promised to keep the data, the page shows
a reminder. If the browser refuses to save (storage full, private browsing) a
red warning appears and leaving the page asks first.

Restoring asks before changing anything. For each profile the newer export's
lists win, marks are combined account by account keeping the most recent, and
the restore can be undone.

## Development

`index.html` is the whole app: no build step, no dependencies to install.
Open it in a browser, or serve the folder with any static server.

JSZip (for reading the export zip) loads from a CDN at runtime; everything
else is inline.

## Tests

Browser tests live in `tests/` and drive the real page in headless Chromium
with Playwright. The saving tests use a fake Claude database shared between
several "devices" (separate browser contexts), so two-device and failed-sync
cases can be checked without a Claude account.

    cd tests
    npm install
    npm test            # or: node run.js "bug 2" to run matching tests only

`tests/safety.test.js` covers restoring, failed saves and export dates.

Each data-loss fix has its own test in `tests/saving.test.js`.
