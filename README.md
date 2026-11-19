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
5. Download the export, then drop the files into the page.

The other files in that folder are optional and add labels to accounts:
`close_friends`, `pending_follow_requests`, `recently_unfollowed_profiles`,
`profiles_you've_favorited`, `blocked_profiles`, `recent_follow_requests`.

## Where data lives

Everything is kept in the browser's local storage for the site, and the page
asks the browser to make that storage persistent. Clearing site data will
remove it, so Settings offers a full JSON backup and a restore, plus a CSV
export that can be imported back.

## Development

`index.html` is the whole app: no build step, no dependencies to install.
Open it in a browser, or serve the folder with any static server.

JSZip (for reading the export zip) loads from a CDN at runtime; everything
else is inline.
