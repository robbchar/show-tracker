# Web App Test Plan (Next Steps)

## Home Page (`apps/web/src/app/page.tsx`)

- Add show dialog
  - Validation: clicking “Add to library” with no selection shows “Please choose a show”.
  - Search error: mock `searchShows` 500 → shows error message in dialog.
  - Add success: search → select → add → show appears with title; dialog closes.
  - Add failure: `addShow` 500 → error toast/message shown; show not added.
- Episodes load
  - Error path: `getEpisodes` 500 → season area shows error message; no episodes rendered.
  - Cached season count: when `seasonCount` exists on user show doc, the season badge shows that count without fetching.
- Manual refresh
  - Missing config: no `NEXT_PUBLIC_FIREBASE_PROJECT_ID` → refresh shows error toast and no fetch call.
  - Throttle response: mock 429 on refresh → error toast with server message.
- Episode/season actions
  - Mark all watched/unwatched per season already covered; add error path: Firestore write fails → error toast/state unchanged.
  - Episode toggle error: Firestore delete/set rejection → error toast and UI reverts.
- Remove show
  - Error path: Firestore delete fails → show remains, error shown.

## Login Page (`apps/web/src/app/login/page.tsx`)

- Sign-up flow
  - Switch to “Create account”, submit, uses `signUp`, saves PIN, redirects to `/`.
  - Sign-up failure: `signUp` rejects → error message shown, no fetch.
- Authenticated redirect
  - `useAuth` returns user → calls `router.replace("/")`, form not rendered.
- Functions config missing
  - No project ID → error message shown, no fetch.
- PIN required (already covered) but also: whitespace-only PIN → shows validation error.

## Providers

- AuthProvider
  - Mocks `onAuthStateChanged` to emit user, ensures children render user state.
  - Loading state: while pending, shows loading content.
- ThemeProvider
  - Toggle switches theme value/class; initial default is light.

## Test Harness Hardening

- Global fetch guard is in place; ensure any new test suites attach their own fetch mocks.
- Consider a shared helper to mock functions base URL and common MSW handlers for `searchShows`, `addShow`, `getEpisodes`, `refreshShowsNow`, `saveTvdbPin`.
