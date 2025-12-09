# Show Tracker – Plan

## Goals
- Web + Expo (iOS/Android) app to track shows, mark episodes/seasons watched, and surface unwatched/new items prominently.
- Leverage TheTVDB for metadata; avoid full mirroring—cache only what is needed.
- Firebase backend with minimal cost: auth, data, scheduled checks (~2x/day) plus user-triggered refresh.
- Highlight new/unwatched items in UI; mobile push notifications; no email initially.

## Non-Goals (MVP)
- No full data mirror of TheTVDB.
- No email notifications.
- No advanced social/sharing features.

## User Stories (MVP)
- As a user, I can search TheTVDB for a show and add it to my library.
- I can view my shows ordered by attention: new-unwatched > unwatched > watched.
- I can mark episodes and entire seasons watched.
- I can trigger a manual refresh; background refresh runs ~2x/day.
- I receive a clear UI highlight for new episodes; on mobile I can receive push notifications.
- My library stays in sync across web and mobile (same account).

## Platforms & Stack
- Web: React/Next.js (or Vite React) with TypeScript.
- Mobile: Expo React Native targeting iOS/Android.
- Backend: Firebase (Auth, Firestore, Cloud Functions; Cloud Messaging for push; Scheduled Functions/Tasks for polling).
- CI: lightweight (GitHub Actions) for lint/test/build as feasible.
- Runtime/tooling: Node 20 LTS (Functions runtime target); Yarn Berry with node-modules linker.

## Cost & Limits (keep it cheap)
- Favor Firestore + Cloud Functions in free/low tiers; monitor reads/writes from scheduled jobs.
- Cache only minimal show/season/episode metadata needed for user libraries to reduce reads/writes.
- Throttle “refresh now” to prevent abuse/rate overages.

## External API (TheTVDB)
- Store API key securely (env/config in Functions); never expose to client.
- Use per-request client token flow as recommended; respect rate limits.
- Cache minimal fields: show basics, season list, episode list with air dates/ids; dedupe across users when possible.
- Consider freshness expectations: 2x/day schedule; manual refresh path for user immediacy.

## Data Model (initial sketch)
- users: { profile, settings (refresh preferences, notification opt-in), tvdbPin, tvdbToken, tvdbTokenExpiresAt }
- shows: { tvdbId, title, poster, network, status, lastAirDate, seasons[] cached }
- userShows: per-user link { showRef, addedAt, pinned?, attentionState }
- episodes: { tvdbId, seasonNumber, episodeNumber, airDate, title } (cached minimal)
- watchState: per-user per-episode { watchedAt }; season-level derived from episodes.
- refreshLogs: per-user or global for last sync timestamps and errors.
- See `docs/data-model.md` for draft collection shapes and access rules.

## Sync & Refresh Flow
- Scheduled job (~2x/day): for each active user show, fetch deltas from TheTVDB; update cached metadata; compute attention state (new-unwatched/unwatched/watched).
- Manual “refresh now”: user-triggered; throttled; same logic as scheduled.
- Failure handling: log per-show errors; surface lightweight status to user (e.g., “refresh failed, tap to retry”).

## Notification & Attention Model
- Priority levels: new-unwatched > unwatched > watched (de-emphasize watched).
- Web: visual prominence (ordering, badges, highlight).
- Mobile: push via FCM; respect user opt-in; rate-limit to avoid spam.
- Clearable: marking episodes watched clears alerts.

## Security & Privacy
- Firebase Auth required; data scoped per user; Firestore rules enforce ownership.
- Store TheTVDB secrets only in backend; client uses callable/HTTPS Functions for API-backed actions.
- Audit logging for refresh operations (minimal, cost-aware).

## Testing Approach
- Unit: data mappers, attention state computation, refresh orchestration logic (with mocks for TheTVDB).
- Integration: callable functions (happy/error paths), Firestore rules tests.
- UI: key states (new-unwatched, unwatched, watched); prefer queries by text/role.

## Milestones / Phases
1) Repo setup + plan review (this doc).
2) Backend skeleton: Firebase config, Auth, Firestore rules draft, Functions scaffolding with TheTVDB client.
3) Data model + refresh logic: schedule 2x/day, manual refresh endpoint, minimal caching.
4) Web MVP: auth flow, search/add show, library list with attention ordering, mark watched.
5) Mobile (Expo) MVP: auth, library view, mark watched, push opt-in; basic push wiring.
6) Polish: error handling, throttling, UI highlights, minimal analytics.
7) Hardening: tests, perf/cost checks, docs update.

## Workflow Expectations
- Work on a feature branch after initial setup; small commits per plan bullets; open PRs for review.
- Keep docs updated alongside changes (especially data model and flows).

