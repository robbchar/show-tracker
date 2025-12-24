"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
  setDoc,
  Timestamp,
  deleteDoc,
} from "firebase/firestore";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import styles from "./page.module.css";

import { useAuth } from "@/components/auth-provider";
import { useTheme } from "@/components/theme-provider";
import { signOut } from "@/lib/auth";
import { db } from "@/lib/firebase";

type UserShow = {
  id: string;
  title?: string | null;
  attentionState?: string | null; // TODO derive from episodes
  lastRefreshAt?: Timestamp | null;
  poster?: string | null;
  overview?: string | null;
  firstAired?: string | null;
  lastAired?: string | null;
  status?: string | null;
  network?: string | null;
  seasonCount?: number | null;
};

type ShowSearchResult = {
  id: string;
  title: string;
  year?: number | null;
};

type Episode = {
  id: string;
  title: string;
  seasonNumber: number;
  episodeNumber: number;
  overview?: string | null;
  airDate?: string | null;
  watched?: boolean;
};

type EpisodePayload = {
  id: string | number;
  seasonNumber?: number;
  season?: number;
  episodeNumber?: number;
  number?: number;
  title?: string;
  overview?: string | null;
  airDate?: string | null;
};

type SeasonState = {
  expanded: boolean;
  loading: boolean;
  error: string | null;
  episodes: Episode[];
};

type EpisodesState = Record<number, SeasonState>;
type ShowCache = {
  title?: string;
  poster?: string;
  overview?: string;
  firstAired?: string;
  lastAired?: string;
  status?: string;
  network?: string;
  hasAllEpisodes?: boolean;
};

type ToastVariant = "info" | "success" | "error";
type Toast = { id: string; message: string; variant: ToastVariant };

const useDebouncedValue = <T,>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
};

const safeYear = (iso?: string | null) => {
  if (!iso) return null;
  const year = new Date(iso).getFullYear();
  return Number.isFinite(year) ? year : null;
};

const formatYearRange = (
  firstAired?: string | null,
  lastAired?: string | null,
  status?: string | null
) => {
  const start = safeYear(firstAired);
  const end = safeYear(lastAired);
  const ongoing = status && status.toLowerCase() !== "ended";
  if (start && end) return `${start} - ${end}`;
  if (start && ongoing) return `${start} - *`;
  if (start) return `${start}`;
  if (ongoing) return `*`;
  return "?";
};

export default function Home() {
  const { user, loading } = useAuth();
  const { theme, toggle } = useTheme();
  const [shows, setShows] = useState<UserShow[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimers = useRef<NodeJS.Timeout[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ShowSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedShow, setSelectedShow] = useState<ShowSearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [episodesByShow, setEpisodesByShow] = useState<Record<string, EpisodesState>>({});
  const [showExpanded, setShowExpanded] = useState<Record<string, boolean>>({});
  const [showLoading, setShowLoading] = useState<Record<string, boolean>>({});
  const [seasonCounts, setSeasonCounts] = useState<Record<string, number>>({});
  const [removing, setRemoving] = useState<Record<string, boolean>>({});
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const orderedShows = useMemo(() => {
    const priority = (state?: string | null) => {
      if (state === "new-unwatched") return 0;
      if (state === "unwatched") return 1;
      if (state === "watched") return 2;
      return 3;
    };
    return [...shows].sort((a, b) => priority(a.attentionState) - priority(b.attentionState));
  }, [shows]);

  useEffect(() => {
    const timersRef = toastTimers.current;
    return () => {
      timersRef.forEach((t) => clearTimeout(t));
    };
  }, []);

  const attentionMeta = useCallback((state?: string | null) => {
    switch (state) {
      case "new-unwatched":
        return { label: "New", className: "tagNew" };
      case "unwatched":
        return { label: "Unwatched", className: "tagUnwatched" };
      default:
        return null;
    }
  }, []);

  const addToast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, variant }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
    toastTimers.current.push(timer);
  }, []);

  const functionsBaseUrl = useMemo(() => {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    return projectId ? `https://us-central1-${projectId}.cloudfunctions.net` : null;
  }, []);

  const loadShows = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    setError(null);
    try {
      const snap = await getDocs(collection(db, "show-tracker", user.uid, "shows"));
      const data: UserShow[] = await Promise.all(
        snap.docs.map(async (d) => {
          const val = d.data();
          const metaSnap = await getDoc(doc(db, "show-tracker", "cache", "shows", d.id));
          const meta = metaSnap.exists() ? (metaSnap.data() as ShowCache) : undefined;
          return {
            id: d.id,
            title: (val.title as string | undefined) ?? meta?.title ?? null,
            attentionState: (val.attentionState as string | undefined) ?? null,
            lastRefreshAt: (val.lastRefreshAt as Timestamp | undefined) ?? null,
            poster: meta?.poster ?? null,
            overview: meta?.overview ?? null,
            firstAired: meta?.firstAired ?? null,
            lastAired: meta?.lastAired ?? null,
            status: meta?.status ?? null,
            network: meta?.network ?? null,
            seasonCount: (val.seasonCount as number | undefined) ?? null,
          };
        })
      );
      setShows(data);
      const counts: Record<string, number> = {};
      data.forEach((s) => {
        if (typeof s.seasonCount === "number" && s.seasonCount > 0) {
          counts[s.id] = s.seasonCount;
        }
      });
      if (Object.keys(counts).length > 0) {
        setSeasonCounts((prev) => ({ ...counts, ...prev }));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setFetching(false);
    }
  }, [user]);

  const handleRefreshNow = useCallback(async () => {
    if (!user) return;
    if (shows.length === 0) {
      addToast("No shows to refresh", "info");
      return;
    }
    if (!functionsBaseUrl) {
      addToast("Missing project configuration for refresh.", "error");
      return;
    }
    setRefreshing(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${functionsBaseUrl}/refreshShowsNow`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload?.message || `Refresh failed (${res.status})`);
      }
      addToast("Library refreshed", "success");
      await loadShows();
    } catch (err) {
      addToast((err as Error).message, "error");
    } finally {
      setRefreshing(false);
    }
  }, [addToast, functionsBaseUrl, loadShows, shows.length, user]);

  const handleRemoveShow = async (tvdbId: string) => {
    if (!user) return;
    setRemoving((prev) => ({ ...prev, [tvdbId]: true }));
    try {
      const episodesSnap = await getDocs(
        collection(db, "show-tracker", user.uid, "shows", tvdbId, "episodes")
      );
      if (!episodesSnap.empty) {
        const batch = writeBatch(db);
        episodesSnap.docs.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }

      await deleteDoc(doc(db, "show-tracker", user.uid, "shows", tvdbId));

      setShows((prev) => prev.filter((s) => s.id !== tvdbId));
      setEpisodesByShow((prev) => {
        const next = { ...prev };
        delete next[tvdbId];
        return next;
      });
      setShowExpanded((prev) => {
        const next = { ...prev };
        delete next[tvdbId];
        return next;
      });
      setSeasonCounts((prev) => {
        const next = { ...prev };
        delete next[tvdbId];
        return next;
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRemoving((prev) => ({ ...prev, [tvdbId]: false }));
    }
  };

  const upsertEpisodesState = (
    showId: string,
    updater: (current: EpisodesState) => EpisodesState
  ) => {
    setEpisodesByShow((prev) => {
      const current = prev[showId] ?? {};
      return { ...prev, [showId]: updater(current) };
    });
  };

  const loadAllEpisodes = async (showId: string) => {
    if (!user || !functionsBaseUrl) return;
    setShowLoading((prev) => ({ ...prev, [showId]: true }));
    upsertEpisodesState(showId, (current) => {
      const next: EpisodesState = { ...current };
      Object.keys(next).forEach((key) => {
        next[Number(key)] = { ...next[Number(key)], loading: true, error: null };
      });
      if (Object.keys(next).length === 0) {
        next[0] = { expanded: false, loading: true, error: null, episodes: [] };
      }
      return next;
    });

    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `${functionsBaseUrl}/getEpisodes?tvdbId=${encodeURIComponent(showId)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload?.message || `Get episodes failed (${res.status})`);
      }
      const payload = (await res.json()) as { episodes?: EpisodePayload[] };
      const episodes = payload.episodes ?? [];

      const watchSnap = await getDocs(
        collection(db, "show-tracker", user.uid, "shows", showId, "episodes")
      );
      const watchedSet = new Set<string>(watchSnap.docs.map((d) => d.id));

      const grouped: Record<number, Episode[]> = {};
      episodes.forEach((raw) => {
        const seasonNumber = Number(raw.seasonNumber ?? raw.season ?? 0);
        const episodeNumber = Number(raw.episodeNumber ?? raw.number ?? 0);
        const id = String(raw.id);
        const episode: Episode = {
          id,
          title: (raw.title as string | undefined) ?? `Episode ${episodeNumber}`,
          seasonNumber,
          episodeNumber,
          overview: (raw.overview as string | undefined) ?? null,
          airDate: (raw.airDate as string | undefined) ?? null,
          watched: watchedSet.has(id),
        };
        if (!grouped[seasonNumber]) grouped[seasonNumber] = [];
        grouped[seasonNumber].push(episode);
      });

      Object.values(grouped).forEach((eps) =>
        eps.sort((a, b) => a.episodeNumber - b.episodeNumber)
      );

      upsertEpisodesState(showId, () => {
        const seasons: EpisodesState = {};
        Object.entries(grouped).forEach(([season, eps]) => {
          seasons[Number(season)] = { expanded: false, loading: false, error: null, episodes: eps };
        });
        return seasons;
      });
      setSeasonCounts((prev) => ({
        ...prev,
        [showId]: Object.keys(grouped)
          .map(Number)
          .filter((n) => n > 0).length,
      }));
      // Persist season count for this user/show so it is available on next load.
      const seasonCount = Object.keys(grouped)
        .map(Number)
        .filter((n) => n > 0).length;
      if (seasonCount > 0) {
        await setDoc(
          doc(db, "show-tracker", user.uid, "shows", showId),
          { seasonCount },
          { merge: true }
        );
      }
    } catch (err) {
      upsertEpisodesState(showId, (current) => {
        const next: EpisodesState = {};
        Object.keys(current).forEach((k) => {
          const s = current[Number(k)];
          next[Number(k)] = { ...s, loading: false, error: (err as Error).message };
        });
        return Object.keys(next).length
          ? next
          : { 0: { expanded: false, loading: false, error: (err as Error).message, episodes: [] } };
      });
    } finally {
      setShowLoading((prev) => ({ ...prev, [showId]: false }));
    }
  };

  const toggleEpisodeWatched = async (showId: string, episode: Episode) => {
    if (!user) return;
    const episodeRef = doc(db, "show-tracker", user.uid, "shows", showId, "episodes", episode.id);
    const willWatch = !episode.watched;
    try {
      if (willWatch) {
        await setDoc(episodeRef, {
          watchedAt: serverTimestamp(),
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
        });
      } else {
        await deleteDoc(episodeRef);
      }
      upsertEpisodesState(showId, (current) => {
        const seasons: EpisodesState = { ...current };
        const season = seasons[episode.seasonNumber];
        if (!season) return seasons;
        const updated = season.episodes.map((ep) =>
          ep.id === episode.id ? { ...ep, watched: willWatch } : ep
        );
        seasons[episode.seasonNumber] = { ...season, episodes: updated };
        return seasons;
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const toggleSeasonWatched = async (showId: string, seasonNumber: number) => {
    if (!user) return;
    const seasonState = episodesByShow[showId]?.[seasonNumber];
    if (!seasonState) return;
    const allWatched = seasonState.episodes.every((ep) => ep.watched);
    try {
      if (allWatched) {
        await Promise.all(
          seasonState.episodes.map((ep) =>
            deleteDoc(doc(db, "show-tracker", user.uid, "shows", showId, "episodes", ep.id))
          )
        );
      } else {
        await Promise.all(
          seasonState.episodes.map((ep) =>
            setDoc(
              doc(db, "show-tracker", user.uid, "shows", showId, "episodes", ep.id),
              {
                watchedAt: serverTimestamp(),
                seasonNumber: ep.seasonNumber,
                episodeNumber: ep.episodeNumber,
              },
              { merge: true }
            )
          )
        );
      }

      upsertEpisodesState(showId, (current) => {
        const seasons: EpisodesState = { ...current };
        const season = seasons[seasonNumber];
        if (!season) return seasons;
        seasons[seasonNumber] = {
          ...season,
          episodes: season.episodes.map((ep) => ({ ...ep, watched: !allWatched })),
        };
        return seasons;
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const toggleSeasonExpanded = (showId: string, seasonNumber: number) => {
    upsertEpisodesState(showId, (current) => {
      const seasons: EpisodesState = { ...current };
      const season = seasons[seasonNumber];
      if (!season) return seasons;
      seasons[seasonNumber] = { ...season, expanded: !season.expanded };
      return seasons;
    });
  };

  const toggleShowSeasons = async (showId: string) => {
    const isExpanded = !!showExpanded[showId];
    if (isExpanded) {
      setShowExpanded((prev) => ({ ...prev, [showId]: false }));
      return;
    }

    const hasSeasons =
      episodesByShow[showId] &&
      Object.keys(episodesByShow[showId])
        .map(Number)
        .filter((n) => n > 0).length > 0;

    if (!hasSeasons && !showLoading[showId]) {
      await loadAllEpisodes(showId);
    }
    setShowExpanded((prev) => ({ ...prev, [showId]: true }));
  };

  useEffect(() => {
    void loadShows();
  }, [loadShows]);

  useEffect(() => {
    if (!showAddDialog) return;
    const query = debouncedSearch.trim();
    if (!user || !functionsBaseUrl) {
      setSearchError("Missing project configuration for search.");
      return;
    }
    if (query.length < 2) {
      setSearchResults([]);
      setSelectedShow(null);
      setSearchError(null);
      return;
    }

    let canceled = false;
    const run = async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const token = await user.getIdToken();
        const res = await fetch(
          `${functionsBaseUrl}/searchShows?query=${encodeURIComponent(query)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(payload?.message || `Search failed (${res.status})`);
        }
        const payload = (await res.json()) as {
          results?: Array<{ id: string | number; name?: string; title?: string; year?: number }>;
        };
        const mapped =
          payload.results?.map((r) => ({
            id: String(r.id),
            title: r.title ?? r.name ?? "Untitled",
            year: typeof r.year === "number" ? r.year : null,
          })) ?? [];
        if (!canceled) {
          setSearchResults(mapped.slice(0, 15));
        }
      } catch (err) {
        if (!canceled) {
          setSearchError((err as Error).message);
        }
      } finally {
        if (!canceled) {
          setSearching(false);
        }
      }
    };

    void run();
    return () => {
      canceled = true;
    };
  }, [debouncedSearch, functionsBaseUrl, showAddDialog, user]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!selectedShow) {
      setError("Please choose a show to add");
      return;
    }
    setError(null);
    const tvdbId = selectedShow.id;
    try {
      if (!functionsBaseUrl) {
        throw new Error("Functions URL not configured");
      }
      const token = await user.getIdToken();
      const res = await fetch(`${functionsBaseUrl}/addShow`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tvdbId }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload?.message || `Add show failed (${res.status})`);
      }
      const payload = (await res.json()) as {
        show?: {
          id: string;
          name?: string;
          image?: string | null;
          overview?: string | null;
          firstAired?: string | null;
          lastAired?: string | null;
          status?: string | null;
          network?: string | null;
        };
      };
      const show = payload.show;
      const title = show?.name ?? selectedShow.title ?? null;

      setSearchQuery("");
      setSearchResults([]);
      setSelectedShow(null);
      setSearchError(null);
      setShows((prev) => {
        const existing = prev.find((s) => s.id === tvdbId);
        const next = existing
          ? prev.map((s) =>
              s.id === tvdbId
                ? {
                    ...s,
                    title,
                    poster: (show?.image as string | undefined) ?? s.poster ?? null,
                    overview: show?.overview ?? s.overview ?? null,
                    firstAired: show?.firstAired ?? s.firstAired ?? null,
                    lastAired: show?.lastAired ?? s.lastAired ?? null,
                    status: show?.status ?? s.status ?? null,
                    network: show?.network ?? s.network ?? null,
                  }
                : s
            )
          : [
              ...prev,
              {
                id: tvdbId,
                title,
                poster: (show?.image as string | undefined) ?? null,
                overview: show?.overview ?? null,
                firstAired: show?.firstAired ?? null,
                lastAired: show?.lastAired ?? null,
                status: show?.status ?? null,
                network: show?.network ?? null,
              },
            ];
        return next;
      });
      setShowAddDialog(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const openAddDialog = () => {
    setShowAddDialog(true);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedShow(null);
    setSearchError(null);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <main className={styles.main}>
        <p>Loading...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1>Show Tracker</h1>
            <p className={styles.muted}>Please sign in to manage your shows.</p>
          </div>
          <button className={styles.themeToggle} onClick={toggle} type="button">
            {theme === "light" ? "Dark mode" : "Light mode"}
          </button>
        </div>
        <div className={styles.card}>
          <h2>Welcome</h2>
          <p className={styles.muted}>Please sign in to manage your shows.</p>
          <Link href="/login">Go to login</Link>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1>Show Tracker</h1>
          <p>Signed in as {user.email}</p>
        </div>
        <div className={styles.actions}>
          <button className={styles.themeToggle} onClick={toggle} type="button">
            {theme === "light" ? "Dark mode" : "Light mode"}
          </button>
          <button className={styles.buttonSecondary} onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className={styles.sectionHeader}>
        <h2>Your shows</h2>
        <div className={styles.actions}>
          {refreshing && <span className={styles.tag}>Refreshing...</span>}
          {!refreshing && fetching && <span className={styles.tag}>Loading...</span>}
          <button
            className={styles.buttonSecondary}
            onClick={() => void handleRefreshNow()}
            type="button"
            disabled={refreshing || fetching || shows.length === 0}
          >
            Refresh library
          </button>
          <button className={styles.buttonPrimary} onClick={openAddDialog}>
            Add show
          </button>
        </div>
      </div>

      <section className={styles.card}>
        {orderedShows.length === 0 ? (
          <p>
            No shows yet.{" "}
            <button className={styles.linkButton} type="button" onClick={openAddDialog}>
              Add one
            </button>{" "}
            to get started.
          </p>
        ) : (
          <ul className={styles.list}>
            {orderedShows.map((show) => {
              const badge = attentionMeta(show.attentionState);
              return (
                <li key={show.id} className={styles.listItem}>
                  <div className={styles.showGrid}>
                    <div className={styles.showMain}>
                      <div className={styles.titleRow}>
                        <span className={styles.showTitleLarge}>{show.title || "Untitled"}</span>
                        <span className={styles.muted}>
                          {formatYearRange(show.firstAired, show.lastAired, show.status)}
                        </span>
                        {badge && (
                          <span
                            className={`${styles.tag} ${badge.className ? styles[badge.className] : ""}`}
                            aria-label={`Attention: ${badge.label}`}
                          >
                            {badge.label}
                          </span>
                        )}
                      </div>
                      {show.network && <div className={styles.muted}>{show.network}</div>}
                      <p className={styles.overview}>
                        {show.overview ?? "No description available."}
                      </p>
                      <div className={styles.meta}>
                        {show.lastRefreshAt && (
                          <span className={styles.muted}>
                            refreshed {show.lastRefreshAt.toDate().toLocaleString()}
                          </span>
                        )}
                        <button
                          className={styles.seasonToggle}
                          type="button"
                          onClick={() => void toggleShowSeasons(show.id)}
                        >
                          <span className={styles.chevron}>
                            {showExpanded[show.id] ? "▾" : "▸"}
                          </span>
                          {showLoading[show.id]
                            ? "loading..."
                            : (() => {
                                const countFromState = seasonCounts[show.id];
                                if (typeof countFromState === "number" && countFromState > 0) {
                                  return `${countFromState} Seasons`;
                                }
                                const seasonsState = episodesByShow[show.id];
                                const seasonCount = seasonsState
                                  ? Object.keys(seasonsState)
                                      .map(Number)
                                      .filter((n) => n > 0).length
                                  : 0;
                                return seasonCount > 0 ? `${seasonCount} Seasons` : "Seasons";
                              })()}
                        </button>
                      </div>
                    </div>
                    {show.poster && (
                      <Image
                        src={show.poster}
                        alt={`${show.title} poster`}
                        className={styles.poster}
                        width={120}
                        height={180}
                        sizes="(max-width: 640px) 100vw, 120px"
                      />
                    )}
                    <button
                      type="button"
                      className={styles.removeButton}
                      aria-label={`Remove ${show.title || "this show"}`}
                      onClick={() => void handleRemoveShow(show.id)}
                      disabled={removing[show.id]}
                    >
                      {removing[show.id] ? "…" : "×"}
                    </button>
                  </div>

                  {showExpanded[show.id] && episodesByShow[show.id] && (
                    <div className={styles.seasonsWrapper}>
                      {Object.keys(episodesByShow[show.id]).filter((s) => Number(s) > 0).length ===
                      0 ? (
                        <p className={styles.muted}>No episodes found.</p>
                      ) : (
                        <ul className={styles.seasonList}>
                          {Object.keys(episodesByShow[show.id])
                            .map(Number)
                            .filter((n) => n > 0)
                            .sort((a, b) => a - b)
                            .map((seasonNumber) => {
                              const season = episodesByShow[show.id][seasonNumber];
                              const seasonWatched =
                                season.episodes.length > 0 &&
                                season.episodes.every((ep) => ep.watched);
                              return (
                                <li key={`${show.id}-s${seasonNumber}`}>
                                  <div className={styles.seasonRow}>
                                    <button
                                      type="button"
                                      className={styles.chevronButton}
                                      aria-label={
                                        season.expanded ? "Collapse season" : "Expand season"
                                      }
                                      onClick={() => toggleSeasonExpanded(show.id, seasonNumber)}
                                    >
                                      <span className={styles.chevron}>
                                        {season.expanded ? "▾" : "▸"}
                                      </span>
                                    </button>
                                    <span className={styles.seasonTitle}>
                                      Season {seasonNumber}
                                    </span>
                                    <button
                                      type="button"
                                      className={styles.iconButton}
                                      onClick={() => toggleSeasonWatched(show.id, seasonNumber)}
                                      aria-label={
                                        seasonWatched
                                          ? "Mark season unwatched"
                                          : "Mark season watched"
                                      }
                                    >
                                      {seasonWatched ? "🙈" : "👁"}
                                    </button>
                                  </div>
                                  {season.error && <p className={styles.error}>{season.error}</p>}
                                  {season.expanded && (
                                    <ul className={styles.episodeList}>
                                      {season.loading && (
                                        <li className={styles.muted}>Loading episodes...</li>
                                      )}
                                      {!season.loading &&
                                        season.episodes.map((ep) => (
                                          <li key={ep.id} className={styles.episodeRow}>
                                            <div className={styles.episodeText}>
                                              <div className={styles.titleRow}>
                                                <span className={styles.showTitle}>
                                                  S{seasonNumber}E{ep.episodeNumber}: {ep.title}
                                                </span>
                                              </div>
                                              {ep.overview && (
                                                <span
                                                  className={styles.episodeOverview}
                                                  title={ep.overview}
                                                >
                                                  {ep.overview}
                                                </span>
                                              )}
                                            </div>
                                            <button
                                              type="button"
                                              className={styles.iconButton}
                                              onClick={() => toggleEpisodeWatched(show.id, ep)}
                                              aria-label={
                                                ep.watched ? "Mark unwatched" : "Mark watched"
                                              }
                                            >
                                              {ep.watched ? "🙈" : "👁"}
                                            </button>
                                          </li>
                                        ))}
                                    </ul>
                                  )}
                                </li>
                              );
                            })}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {error && <p className={styles.error}>{error}</p>}
      </section>

      {showAddDialog && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <div className={styles.sectionHeader}>
              <h3>Add show</h3>
              <button className={styles.buttonSecondary} onClick={() => setShowAddDialog(false)}>
                Close
              </button>
            </div>
            <form className={styles.form} onSubmit={handleAdd}>
              <label className={styles.label}>
                Search shows
                <input
                  className={styles.input}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type a show title"
                  autoFocus
                />
              </label>
              {searchError && <p className={styles.error}>{searchError}</p>}
              {searching && <p className={styles.muted}>Searching...</p>}
              {!searching &&
                searchQuery.trim().length >= 2 &&
                searchResults.length === 0 &&
                !searchError && <p className={styles.muted}>No results yet.</p>}
              <ul className={styles.searchList} role="listbox" aria-label="Search results">
                {searchResults.map((result) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      className={`${styles.searchItem} ${
                        selectedShow?.id === result.id ? styles.searchItemSelected : ""
                      }`}
                      onClick={() => setSelectedShow(result)}
                      aria-pressed={selectedShow?.id === result.id}
                    >
                      <div>
                        <div className={styles.titleRow}>
                          <span className={styles.showTitle}>{result.title}</span>
                          {result.year && <span className={styles.muted}>{result.year}</span>}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <div className={styles.actions}>
                <button
                  className={styles.buttonSecondary}
                  type="button"
                  onClick={() => setShowAddDialog(false)}
                >
                  Cancel
                </button>
                <button className={styles.buttonPrimary} type="submit" disabled={!selectedShow}>
                  Add to library
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className={styles.toastContainer} role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${styles.toast} ${
              toast.variant === "success"
                ? styles.toastSuccess
                : toast.variant === "error"
                  ? styles.toastError
                  : styles.toastInfo
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </main>
  );
}
