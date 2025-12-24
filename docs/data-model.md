# Data Model (current)

All app data lives under the `show-tracker` namespace in Firestore.

## Collections

- `show-tracker/{userId}`
  - User profile/auth data for this app: `tvdbPin`, `tvdbToken`, `tvdbTokenExpiresAt`, `lastManualRefreshAt`, `lastScheduledRefreshAt` (others like displayName/email optional).
  - Subcollection `shows/{tvdbId}`
    - Per-user show state: `title`, `addedAt`, `seasonCount`, `attentionState` (computed during refresh), etc.
    - Subcollection `episodes/{episodeId}`
      - Per-user watch state: `watchedAt`, `seasonNumber`, `episodeNumber`, optional `source`.

- `show-tracker/cache/shows/{tvdbId}` (read-only to clients; written by Functions/admin)
  - Cached show metadata: `title`, `poster`, `overview`, `firstAired`, `lastAired`, `status`, `network`, `updatedAt`, `hasAllEpisodes`, `episodesUpdatedAt`.
  - Subcollection `episodes/{episodeId}`
    - Cached episode fields: `title`, `seasonNumber`, `episodeNumber`, `airDate`, `absoluteNumber`, `overview`, `updatedAt`.

## Access Model (rules)

- Authenticated users can read/write only their own `show-tracker/{uid}/**`.
- `show-tracker/cache/**` is readable by clients and write-protected (Functions/admin only).
- Everything else is denied by default.

## Notes

- We cache minimal show/episode fields; no full TVDB mirror.
- Season count is persisted per-user on their `shows/{tvdbId}` once episodes are fetched.
- Attention state is intended to be derived from episodes/watch state during refresh (future refinement).
