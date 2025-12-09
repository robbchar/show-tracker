import { logger } from "firebase-functions";
import { TvdbClient } from "./tvdb/client";
import { db, admin } from "./firebase";

const TOKEN_TTL_DAYS = 25; // TVDB tokens last ~30 days; refresh a bit early.

export interface RefreshSummary {
  updatedShows: number;
  updatedEpisodes: number;
  failures: number;
}

interface UserAuthData {
  tvdbPin?: string;
  tvdbToken?: string;
  tvdbTokenExpiresAt?: admin.firestore.Timestamp;
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

const getUserAuth = async (userId: string): Promise<UserAuthData> => {
  const snap = await db.collection("users").doc(userId).get();
  return (snap.exists ? (snap.data() as UserAuthData) : {}) || {};
};

const persistAuth = async (userId: string, pin: string, token: string) => {
  await db
    .collection("users")
    .doc(userId)
    .set(
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
    throw new Error("PIN required for TVDB login");
  }

  const client = new TvdbClient(tvdbApiKey, pinToUse, auth.tvdbToken);

  if (!auth.tvdbToken || isExpired(auth.tvdbTokenExpiresAt)) {
    const token = await client.login();
    await persistAuth(userId, pinToUse, token);
  }

  return client;
};

export const refreshAllUsers = async (tvdbApiKey: string): Promise<RefreshSummary> => {
  const users = await db.collection("users").get();
  let updatedShows = 0;
  let updatedEpisodes = 0;
  let failures = 0;

  for (const doc of users.docs) {
    const userId = doc.id;
    try {
      const client = await prepareClientForUser(userId, tvdbApiKey);
      await client.fetchShow("1").catch((err) => {
        logger.warn("TVDB probe failed for user", { userId, error: (err as Error).message });
      });
      // TODO: real refresh logic per user.
    } catch (err) {
      failures += 1;
      logger.warn("Skipping user; PIN/token unavailable", { userId, error: (err as Error).message });
    }
  }

  logger.info("Refresh stub executed (all users)", { updatedShows, updatedEpisodes, failures });
  return { updatedShows, updatedEpisodes, failures };
};

export const refreshUser = async (
  userId: string,
  tvdbApiKey: string,
  pin?: string
): Promise<RefreshSummary> => {
  const client = await prepareClientForUser(userId, tvdbApiKey, pin);
  // TODO: fetch a user's shows, check for deltas, and update watch/attention state.
  await client.fetchShow("1").catch((err) => {
    logger.warn("TVDB probe failed for user refresh (expected in stubs if ID invalid)", {
      userId,
      error: (err as Error).message,
    });
  });

  logger.info("Refresh stub executed", { userId });
  return { updatedShows: 0, updatedEpisodes: 0, failures: 0 };
};

