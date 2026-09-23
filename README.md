# Game Jam III nomination tracker

A small s&box-inspired nomination dashboard for Game Jam III. Built with Next.js and React, ready to deploy to Vercel. This is an unofficial community tool, not affiliated with Facepunch.

## Run locally

Use Node.js 22 or later and npm.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. Enter a package ident such as `sunless.risk_of_observation`, or select a game in the leaderboard. Use the refresh button to fetch a new snapshot.

```sh
npm test
npm run build
npm start
```

## Deploy to Vercel

1. Push this project to https://github.com/imjackbob/sbox_jam3_website.
2. In Vercel, choose **Add New → Project**, then import that repository.
3. Keep the **Next.js** framework preset and repository root directory. Build command: `npm run build`. Leave the output directory at its default. Use Node.js 22 or later.
4. Deploy. No API keys, environment variables, or database are required.

Keep server support enabled: do not use a static export or GitHub Pages, because `/api/voting` fetches the upstream data on the server. Subsequent pushes to the production branch deploy through Vercel's Git integration.

## Data and calculations

Source: https://public.facepunch.com/sbox/jam/three/voting

- **Position** is the one-based index in the vote-sorted tally, matching the provided C# approach. Equal totals retain upstream ordering; the API does not explain its tie breaker.
- **Vote rank** uses competition ranking: one plus the number of entries with more votes. Equal totals share a rank.
- **Votes to reach top 5** is the number needed to strictly beat the fifth-highest _other_ game. Excluding the selected game also handles entries already inside the top five. If fewer than five rivals are listed, one vote is the target. This is a snapshot calculation, assuming other totals stay unchanged, not a prediction or an official qualification guarantee.
- **Vote share** is the selected game's votes divided by all votes in the selected category. Votes are not unique voters.
- **Next higher total** and **outright lead** both require beating the relevant vote total by one.
- **Entries** counts only the API's tally, not all jam submissions. An absent ident displays zero published votes and no rank; it could be unvoted, outside the category, or invalid. The API cannot distinguish those cases.
- **Nomination slots** and **round end time** come from the selected category. Dates appear in the viewer's local timezone. The top-five metric stays top five even if a category's slot count differs.
- All returned categories can be selected. The first nonempty category is the default. Empty categories and unavailable data have explicit states.
- Display names are derived from package idents, not fetched game titles. This endpoint does not supply thumbnails, play counts, game descriptions, or historical trends.

The server route validates the upstream response, times out after 10 seconds, and returns a friendly 502 error on failure. Successful responses permit 30 seconds of shared caching plus 30 seconds of stale-while-revalidate on a supporting CDN. The displayed timestamp is when the server fetched the data. Refresh is manual, and may still return a recently cached snapshot. A refresh failure preserves the last successful snapshot with a warning.

## Project structure

### Game ratings

Selecting a game also fetches its overall thumbs-up/down totals and review breakdown from `https://public.facepunch.com/sbox/package/get/2/{ident}` through `/api/ratings?ident=...`. Ratings load independently of the jam tally; a missing package or upstream failure is shown as unavailable, not as zero votes. Refresh updates both sources. Switching games cancels the previous ratings request.

Thumbs-up/down (`VotesUp`/`VotesDown`) are separate from written review counts (`ReviewStats`). The review score matches [Facepunch's implementation](https://github.com/Facepunch/sbox-public/blob/master/engine/Sandbox.Services/Api/Models/PackageReviewStats.cs): `(positive × 100 + has-potential × 50) / total reviews`. The panel also shows each review type's count and percentage. No reviews displays “No reviews yet” with no percentage; missing review data is labeled separately. The API omits zero-valued count fields. Only the selected game's ratings are fetched, rather than requesting every package in the leaderboard.

- `app/game-ratings.js` — independent ratings panel with loading, retry, and empty states.
- `app/api/ratings/route.js` — validated, fixed-origin package API proxy.
- `lib/ratings.mjs` — thumbs and review normalization and score calculation.

- `app/page.js` — lookup, results, leaderboard, category selector, and optional feature-detected WebMCP lookup tool.
- `app/globals.css` — responsive navy-and-blue styling with the Sen typeface (Google Fonts, with a local sans-serif fallback).
- `app/api/voting/route.js` — same-origin server proxy for Facepunch's public voting endpoint.
- `lib/voting.mjs` — validation and ranking calculations.
- `tests/voting.test.mjs` — boundary ties, absent games, sparse tallies, validation, and upstream failure tests.

Dependencies are pinned and `package-lock.json` is committed. `.gitignore` excludes builds, dependencies, Vercel metadata, and environment files.
