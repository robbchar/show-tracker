# Development Setup

## Prerequisites
- Node.js 20 LTS (Functions runtime target)
- Yarn (Berry) via Corepack or global, using node-modules linker
- Firebase CLI (available via `yarn workspace functions firebase-tools`)

## Install
```bash
yarn install
```

## Configure
- Update `.firebaserc` with your Firebase project id.
- Copy `functions/env.example` to `functions/.env` and add secrets (e.g., `THETVDB_API_KEY`).
- Set the same env vars in your deployment environment (Functions config or secrets).
- Firestore rules live in `firestore.rules` and are registered in `firebase.json`.

## Commands
- Build functions: `yarn workspace functions build`
- Emulators (functions/firestore/auth): `yarn workspace functions emulators`
- Functions only: `yarn workspace functions serve:functions`
- Deploy functions: `yarn workspace functions deploy` (after configuring project)
- Deploy rules: `firebase deploy --only firestore:rules`

## Notes
- Manual and scheduled refresh handlers are stubbed; they currently log and return placeholder responses until the refresh logic is implemented.
- TheTVDB PIN is required at login; we store PIN + token per user server-side to enable scheduled refreshes. Manual refresh can supply a PIN to refresh the token if needed.

