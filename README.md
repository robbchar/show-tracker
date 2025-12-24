# Show Tracker

Track TV shows, cache metadata from TheTVDB, and mark episodes watched. Web app (Next.js) + Firebase Functions + Firestore.

## Stack

- Web: Next.js/React (TypeScript)
- Backend: Firebase Functions (Node 20), Firestore
- Auth: Firebase Auth
- TV metadata: TheTVDB API

## Firestore layout (namespaced)

- `show-tracker/{uid}`: user doc (tvdbPin, tvdbToken, refresh timestamps, optional profile)
  - `shows/{tvdbId}`: per-user show entry (title, addedAt, seasonCount, future attention state)
    - `episodes/{episodeId}`: per-user watch state (watchedAt, seasonNumber, episodeNumber)
- `show-tracker/cache/shows/{tvdbId}`: shared show cache (title, poster, overview, first/last aired, status, network, hasAllEpisodes, timestamps)
  - `episodes/{episodeId}`: cached episode fields (seasonNumber, episodeNumber, airDate, absoluteNumber, title, overview)

## Functions (HTTPS)

- `searchShows` (GET): search TVDB for series (requires auth + stored PIN).
- `addShow` (POST): fetch + cache show metadata, upsert user show doc.
- `getEpisodes` (GET): fetch + cache all episodes for a show, return cached episodes.
- `saveTvdbPin` (POST): store TVDB PIN for the user.
- `refreshShowsNow` / `refreshShowsScheduled`: refresh stubs; refresh logic is partial.

## Setup

1. Install: `yarn install`
2. Env:
   - `functions/.env`: set `THETVDB_API_KEY=...`
   - `apps/web/.env.local`: Firebase client config (`NEXT_PUBLIC_FIREBASE_*`)
3. Firebase project: set `.firebaserc` to your project id.

## Develop

- Functions emulators: `yarn workspace functions emulators`
- Web dev: `yarn workspace web dev`

## Deploy

- Functions: `yarn workspace functions deploy:functions`
- Firestore rules: `yarn deploy:rules`

## Notes / UX

- Shows are added via `addShow` and cached; seasons/episodes load on demand and persist season count per user.
- Remove show: deletes user show + watch-state docs; cache remains shared.

## Handy Root commands

- Deploy Firestore functions: `yarn deploy:functions`
- Deploy Firestore rules: `yarn deploy:rules`
