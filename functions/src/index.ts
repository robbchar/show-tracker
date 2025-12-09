import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { getTvdbApiKey, REFRESH_SCHEDULE, REGION } from "./config";
import { refreshAllUsers, refreshUser } from "./refresh";

export const refreshShowsScheduled = onSchedule(
  { region: REGION, schedule: REFRESH_SCHEDULE, timeZone: "Etc/UTC" },
  async () => {
    const apiKey = getTvdbApiKey();
    if (!apiKey) {
      return;
    }

    logger.info("Scheduled refresh starting");
    const result = await refreshAllUsers(apiKey);
    logger.info("Scheduled refresh completed", result);
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

    // TODO: enforce auth, identify userId, and enforce per-user throttling.
    const userId = "stub-user";
    const pin = (req.body?.pin as string | undefined) || undefined;

    const result = await refreshUser(userId, apiKey, pin);

    logger.info("Manual refresh requested", { userId, result });
    res.status(200).json({ ok: true, message: "Manual refresh stub", result });
  }
);

