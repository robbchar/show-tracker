import { logger } from "firebase-functions";

export const REGION = "us-central1";
export const REFRESH_SCHEDULE = "every 12 hours"; // ~2x/day

export const getTvdbApiKey = (): string | undefined => {
  const apiKey = process.env.THETVDB_API_KEY;
  if (!apiKey) {
    logger.warn("THETVDB_API_KEY not configured; you cannot get information from the TVDB");
  }
  return apiKey;
};
