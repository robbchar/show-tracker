import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";

const REGION = "us-central1";
const SCHEDULE = "every 12 hours"; // ~2x/day

const getTvdbApiKey = (): string | undefined => {
  const apiKey = process.env.THETVDB_API_KEY;
  if (!apiKey) {
    logger.warn("THETVDB_API_KEY not configured; refresh operations will be skipped");
  }
  return apiKey;
};

export const refreshShowsScheduled = onSchedule(
  { region: REGION, schedule: SCHEDULE, timeZone: "Etc/UTC" },
  async () => {
    const apiKey = getTvdbApiKey();
    if (!apiKey) {
      return;
    }

    logger.info("Scheduled refresh starting");
    // TODO: fetch shows to refresh, call TheTVDB for deltas, update Firestore state.
    logger.info("Scheduled refresh completed (stub)");
  }
);

export const refreshShowsNow = onRequest(
  { region: REGION, concurrency: 10 },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const apiKey = getTvdbApiKey();
    if (!apiKey) {
      res.status(500).json({ error: "TheTVDB API key not configured" });
      return;
    }

    // TODO: enforce auth, per-user throttling, and delegate to refresh worker logic.
    logger.info("Manual refresh requested");
    res.status(200).json({ ok: true, message: "Manual refresh stub" });
  }
);

