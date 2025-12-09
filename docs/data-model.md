# Data Model (draft)

## Collections

- `users/{userId}`
  - `displayName`, `email`, `createdAt`, `settings` (notification opt-in, refresh prefs), `deviceTokens` (FCM).
  - TVDB auth: `tvdbPin`, `tvdbToken`, `tvdbTokenExpiresAt` (server-stored per user to allow scheduled refresh).
  - Refresh timestamps: `lastManualRefreshAt`, `lastScheduledRefreshAt`.
- `shows/{tvdbId}`
  - Cached show metadata: `title`, `poster`, `network`, `status`, `lastAirDate`, `seasons` (ids/numbers), `updatedAt`.
  - Subcollection `episodes/{episodeId}` with minimal fields: `seasonNumber`, `episodeNumber`, `airDate`, `title`, `absoluteNumber`, `updatedAt`.
- `userShows/{userId}/shows/{tvdbId}`
  - Per-user state: `addedAt`, `pinned`, `attentionState` (new-unwatched | unwatched | watched), `lastManualRefresh`, `lastScheduledRefresh`.
  - Subcollection `episodes/{episodeId}` with watch state: `watchedAt`, `source` (manual/auto).
- `refreshLogs/{userId}/logs/{logId}`
  - Optional: `startedAt`, `finishedAt`, `status`, `message`.

## Access Model (rules)
- Users can read/write their own `users/{userId}` doc, `userShows/{userId}/...`, and `refreshLogs/{userId}`.
- `shows` and `shows/*/episodes` are read-only to clients; writes are via backend (admin SDK bypasses rules).

## Notes
- Episode docs are cached minimally to reduce storage; avoid full TVDB mirror.
- Attention state is derived during refresh; watched marks clear new/unwatched highlights.
- Future indexes: likely compound on `userShows/{userId}/shows` by `attentionState` and `addedAt` for ordering.

