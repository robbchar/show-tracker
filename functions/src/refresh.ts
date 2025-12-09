import { logger } from "firebase-functions";
import { TvdbClient } from "./tvdb/client";
import { db, admin } from "./firebase";

const TOKEN_TTL_DAYS = 25; // TVDB tokens last ~30 days; refresh a bit early.

export interface RefreshSummary {
  updatedShows: number;
  updatedEpisodes: number;
  failures: number;
}

export type RefreshTrigger = "manual" | "scheduled";

interface UserAuthData {
  tvdbPin?: string;
  tvdbToken?: string;
  tvdbTokenExpiresAt?: admin.firestore.Timestamp;
}

export class RefreshError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const isExpired = (ts?: admin.firestore.Timestamp): boolean => {
  if (!ts) return true;
  return ts.toDate().getTime() <= Date.now();
};

const computeExpiry = () => {
  const expires = new Date();
  expires.setDate(expires.getDate() + TOKEN_TTL_DAYS);
  return admin.firestore.Timestamp.fromDate(expires);
};

const usersCollection = db.collection("users");
const userShowsCollection = (userId: string) => db.collection("userShows").doc(userId).collection("shows");
const showsCollection = db.collection("shows");

class MissingPinError extends Error {
  code = "MISSING_PIN";
  constructor() {
    super("PIN required for TVDB login");
  }
}

const getUserAuth = async (userId: string): Promise<UserAuthData> => {
  const snap = await usersCollection.doc(userId).get();
  return (snap.exists ? (snap.data() as UserAuthData) : {}) || {};
};

const persistAuth = async (userId: string, pin: string, token: string) => {
  await usersCollection.doc(userId).set(
    {
      tvdbPin: pin,
      tvdbToken: token,
      tvdbTokenExpiresAt: computeExpiry(),
    },
    { merge: true }
  );
};

const prepareClientForUser = async (
  userId: string,
  tvdbApiKey: string,
  pinFromRequest?: string
): Promise<TvdbClient> => {
  const auth = await getUserAuth(userId);
  const pinToUse = pinFromRequest ?? auth.tvdbPin;
  if (!pinToUse) {
    throw new MissingPinError();
  }

  const client = new TvdbClient(tvdbApiKey, pinToUse, auth.tvdbToken);

  if (!auth.tvdbToken || isExpired(auth.tvdbTokenExpiresAt)) {
    const token = await client.login();
    await persistAuth(userId, pinToUse, token);
  }

  return client;
};

const recordRefreshTimestamp = async (userId: string, trigger: RefreshTrigger) => {
  const field =
    trigger === "scheduled"
      ? { lastScheduledRefreshAt: admin.firestore.FieldValue.serverTimestamp() }
      : { lastManualRefreshAt: admin.firestore.FieldValue.serverTimestamp() };

  await usersCollection.doc(userId).set(field, { merge: true });
};

const 
refreshUserShows = async (
  userId: string,
  client: TvdbClient
): Promise<{ updatedShows: number; updatedEpisodes: number }> => {
  const userShowsSnap = await userShowsCollection(userId).get();
  if (userShowsSnap.empty) {
    logger.info("No user shows to refresh", { userId });
    return { updatedShows: 0, updatedEpisodes: 0 };
  }

  let updatedShows = 0;
  let updatedEpisodes = 0;

  for (const doc of userShowsSnap.docs) {
    const tvdbId = doc.id;
    try {
      const show = await client.fetchShow(tvdbId);
      const episodes = await client.fetchEpisodes(tvdbId);

      await showsCollection.doc(tvdbId).set(
        {
          tvdbId: show.id,
          title: show.name,
          poster: show.image ?? null,
          status: show.status ?? null,
          lastAirDate: show.lastAired ?? null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          latestEpisodeAirDate: episodes
            .map((e) => e.airDate)
            .filter(Boolean)
            .sort()
            .at(-1) ?? null,
        },
        { merge: true }
      );

      await userShowsCollection(userId)
        .doc(tvdbId)
        .set(
          {
            lastRefreshAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      updatedShows += 1;
      updatedEpisodes += episodes.length;
    } catch (err) {
      logger.warn("Failed to refresh show", { userId, tvdbId, error: (err as Error).message });
    }
  }

  return { updatedShows, updatedEpisodes };
};

export const refreshAllUsers = async (tvdbApiKey: string): Promise<RefreshSummary> => {
  const users = await usersCollection.get();
  let updatedShows = 0;
  let updatedEpisodes = 0;
  let failures = 0;

  for (const doc of users.docs) {
    const userId = doc.id;
    try {
      const client = await prepareClientForUser(userId, tvdbApiKey);
      const result = await refreshUserShows(userId, client);
      await recordRefreshTimestamp(userId, "scheduled");
      updatedShows += result.updatedShows;
      updatedEpisodes += result.updatedEpisodes;
    } catch (err) {
      failures += 1;
      const error = err as Error;
      const isMissingPin = error instanceof MissingPinError;
      const level = isMissingPin ? logger.warn : logger.error;
      level("Skipping user refresh", {
        userId,
        code: isMissingPin ? "MISSING_PIN" : "REFRESH_USER_ERROR",
        error: error.message,
      });
    }
  }

  logger.info("Refresh stub executed (all users)", { updatedShows, updatedEpisodes, failures });
  return { updatedShows, updatedEpisodes, failures };
};

export const refreshUser = async (
  userId: string,
  tvdbApiKey: string,
  pin: string | undefined,
  trigger: RefreshTrigger = "manual"
): Promise<RefreshSummary> => {
  const client = await prepareClientForUser(userId, tvdbApiKey, pin);
  const result = await refreshUserShows(userId, client);
  await recordRefreshTimestamp(userId, trigger);

  logger.info("Refresh executed", { userId, trigger, result });
  return { updatedShows: result.updatedShows, updatedEpisodes: result.updatedEpisodes, failures: 0 };
};

export const mapRefreshErrorToResponse = (err: unknown) => {
  if (err instanceof MissingPinError) {
    return new RefreshError("MISSING_PIN", err.message, 400);
  }
  const e = err as Error;
  return new RefreshError("REFRESH_FAILED", e.message || "Refresh failed", 500);
};

