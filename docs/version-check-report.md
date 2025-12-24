# Dependency Version Check Report

Generated: January 2025

This report compares the currently installed versions with the latest available versions from npm.

## Summary

Several packages have updates available, including **2 major version updates** that may require code changes:

### ⚠️ Major Updates Available (Breaking Changes Possible)

1. **firebase-admin**: `^12.0.0` → `13.6.0` (functions)
2. **jest**: `^29.7.0` → `30.2.0` (web)

### 📦 Minor/Patch Updates Available

- **next**: `16.0.8` → `16.1.1` (web)
- **react**: `19.2.1` → `19.2.3` (web)
- **react-dom**: `19.2.1` → `19.2.3` (web)
- **firebase**: `^12.6.0` → `12.7.0` (web)
- **firebase-functions**: `^7.0.1` → `7.0.2` (functions)
- **@testing-library/react**: `^16.1.0` → `16.3.1` (web)

### ✅ Up to Date

- **typescript**: `5.9.3` (both web and functions) - Latest: `5.9.3`

---

## Detailed Comparison

### Web App (`apps/web/package.json`)

| Package                  | Current   | Latest   | Status    | Notes                                  |
| ------------------------ | --------- | -------- | --------- | -------------------------------------- |
| `next`                   | `16.0.8`  | `16.1.1` | ⬆️ Minor  | Patch release, safe to update          |
| `react`                  | `19.2.1`  | `19.2.3` | ⬆️ Patch  | Bug fixes, safe to update              |
| `react-dom`              | `19.2.1`  | `19.2.3` | ⬆️ Patch  | Bug fixes, safe to update              |
| `firebase`               | `^12.6.0` | `12.7.0` | ⬆️ Minor  | Compatible with current range          |
| `typescript`             | `^5`      | `5.9.3`  | ✅ Latest | Already at latest (5.9.3 installed)    |
| `jest`                   | `^29.7.0` | `30.2.0` | ⚠️ Major  | **Breaking changes** - see notes below |
| `@testing-library/react` | `^16.1.0` | `16.3.1` | ⬆️ Minor  | Safe to update                         |

### Functions (`functions/package.json`)

| Package              | Current   | Latest   | Status    | Notes                                  |
| -------------------- | --------- | -------- | --------- | -------------------------------------- |
| `firebase-admin`     | `^12.0.0` | `13.6.0` | ⚠️ Major  | **Breaking changes** - see notes below |
| `firebase-functions` | `^7.0.1`  | `7.0.2`  | ⬆️ Patch  | Bug fixes, safe to update              |
| `typescript`         | `^5.6.3`  | `5.9.3`  | ✅ Latest | Already at latest (5.9.3 installed)    |

---

## Important Notes on Major Updates

### Jest 30 (29.7.0 → 30.2.0)

**Breaking Changes:**

- Drops support for Node 14, 16, 19, and 21
- Minimum supported Node version: **18.x** (✅ You're using Node 20, so this is fine)
- Minimum TypeScript version: **5.4** (✅ You're using 5.9.3, so this is fine)

**Migration Steps:**

1. Update Jest: `yarn workspace web add -D jest@^30.2.0`
2. Update related packages:
   - `ts-jest`: Ensure compatibility with Jest 30
   - `jest-environment-jsdom`: Update to latest version
3. Review Jest 30 release notes for any API changes
4. Run tests to ensure compatibility

**Reference:** [Jest 30 Upgrade Guide](https://github.com/jestjs/jest/blob/main/docs/UpgradingToJest30.md)

### Firebase Admin 13 (12.0.0 → 13.6.0)

**Breaking Changes:**

- Check Firebase Admin 13 release notes for breaking changes
- Review API changes in authentication, Firestore, and other services
- Test all Firebase Functions thoroughly after upgrade

**Migration Steps:**

1. Review [Firebase Admin Node.js SDK changelog](https://github.com/firebase/firebase-admin-node/releases)
2. Update: `yarn workspace functions add firebase-admin@^13.6.0`
3. Test all Cloud Functions endpoints
4. Verify Firestore operations work correctly
5. Check authentication flows

---

## Recommended Update Strategy

### Phase 1: Safe Updates (No Breaking Changes)

Update these packages first as they have no breaking changes:

```bash
# Web app
yarn workspace web add next@^16.1.1 react@^19.2.3 react-dom@^19.2.3 firebase@^12.7.0 @testing-library/react@^16.3.1

# Functions
yarn workspace functions add firebase-functions@^7.0.2
```

### Phase 2: Major Updates (Requires Testing)

Update these after Phase 1 is verified:

```bash
# Web app - Jest 30
yarn workspace web add -D jest@^30.2.0

# Functions - Firebase Admin 13
yarn workspace functions add firebase-admin@^13.6.0
```

After each major update:

1. Run all tests
2. Test critical user flows
3. Check for deprecation warnings
4. Review changelogs for any API changes

---

## Next Steps

1. ✅ Review this report
2. ✅ Create a feature branch for updates
3. ✅ Apply Phase 1 updates (safe updates)
4. ✅ Run tests and verify functionality
5. ⬜ Apply Phase 2 updates (major versions)
6. ⬜ Comprehensive testing
7. ⬜ Update documentation if needed
8. ⬜ Create PR for review

---

## References

- [Next.js Releases](https://github.com/vercel/next.js/releases)
- [React Releases](https://github.com/facebook/react/releases)
- [Firebase JS SDK Changelog](https://github.com/firebase/firebase-js-sdk/blob/main/packages/firebase/CHANGELOG.md)
- [Firebase Admin Node.js SDK](https://github.com/firebase/firebase-admin-node)
- [Jest 30 Upgrade Guide](https://github.com/jestjs/jest/blob/main/docs/UpgradingToJest30.md)
- [TypeScript Releases](https://github.com/microsoft/TypeScript/releases)
