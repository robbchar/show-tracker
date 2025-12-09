import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { getTvdbApiKey, REFRESH_SCHEDULE, REGION } from "./config";
import { mapRefreshErrorToResponse, refreshAllUsers, refreshUser } from "./refresh";
import { admin } from "./firebase";

const HANDLER_REGION = { region: REGION };
const SCHEDULE_REGION = { region: REGION, schedule: REFRESH_SCHEDULE, timeZone: "Etc/UTC" };
const MANUAL_REFRESH_COOLDOWN_MS = 15 * 60 * 1000;

export const refreshShowsScheduled = onSchedule(SCHEDULE_REGION, async () => {
  const apiKey = getTvdbApiKey();
  if (!apiKey) {
    return;
  }

  logger.info("Scheduled refresh starting");
  const result = await refreshAllUsers(apiKey);
  logger.info("Scheduled refresh completed", result);
});

export const refreshShowsNow = onRequest({ ...HANDLER_REGION, concurrency: 10 }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = getTvdbApiKey();
  if (!apiKey) {
    res.status(500).json({ error: "TheTVDB API key not configured" });
    return;
  }

  // Enforce Firebase Auth via ID token in Authorization header.
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let userId: string;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    userId = decoded.uid;
  } catch (err) {
    res.status(401).json({ error: "Invalid auth token" });
    return;
  }

  // Per-user throttle
  const userRef = admin.firestore().collection("users").doc(userId);
  const snap = await userRef.get();
  const lastManual = snap.exists ? (snap.get("lastManualRefreshAt") as admin.firestore.Timestamp | undefined) : undefined;
  if (lastManual) {
    const diff = Date.now() - lastManual.toDate().getTime();
    if (diff < MANUAL_REFRESH_COOLDOWN_MS) {
      const retryAfter = Math.ceil((MANUAL_REFRESH_COOLDOWN_MS - diff) / 1000);
      res.set("Retry-After", String(retryAfter));
      res.status(429).json({ error: "Too many refresh requests", retryAfterSeconds: retryAfter });
      return;
    }
  }

  // Record the manual refresh request time up front.
  await userRef.set(
    { lastManualRefreshAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );

  const pin = (req.body?.pin as string | undefined) || undefined;

  try {
    const result = await refreshUser(userId, apiKey, pin, "manual");
    logger.info("Manual refresh requested", { userId, result });
    res.status(200).json({ ok: true, message: "Manual refresh", result });
  } catch (err) {
    const mapped = mapRefreshErrorToResponse(err);
    res.status(mapped.status).json({ error: mapped.code, message: mapped.message });
  }
});

