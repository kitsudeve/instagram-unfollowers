# Unfollower Checker

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
5. Download the export, then drop the whole zip into the page.

The export date is read from the files: from the zip's name, otherwise from
the dates stamped on the files. An export older than the one a profile
already has is refused, so it can't scramble the changes log.

The zip's other files add labels to accounts, so uploading only the
followers and following files leaves them out:
`close_friends`, `pending_follow_requests`, `recently_unfollowed_profiles`,
`profiles_you've_favorited`, `blocked_profiles`, `recent_follow_requests`.

## Web address

https://unfollower-checker-kitsudeve.vercel.app

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

The `tests` folder holds automatic checks. Each one opens the app in a hidden
browser, clicks through it the way a person would (uploading an export,
marking accounts, restoring a backup and so on) and checks the result is
right. They exist so that a change can't quietly break something that used to
work: every bug that has been fixed has a check that would fail if it came
back.

You don't need to run them to use the app. To run them on a computer with
Node.js installed:

    cd tests
    npm install
    npm test

Each check prints `ok` or `FAIL` with its name, for example
"bug 1: a mark is saved even if you switch profile straight away".
