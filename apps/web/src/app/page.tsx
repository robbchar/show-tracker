"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import { useAuth } from "@/components/auth-provider";
import { useTheme } from "@/components/theme-provider";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { signOut } from "@/lib/auth";

type UserShow = {
  id: string;
  title?: string | null;
  attentionState?: string | null;
  lastRefreshAt?: Timestamp;
};

type ShowSearchResult = {
  id: string;
  title: string;
  year?: number | null;
};

const useDebouncedValue = <T,>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
};

export default function Home() {
  const { user, loading } = useAuth();
  const { theme, toggle } = useTheme();
  const [shows, setShows] = useState<UserShow[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ShowSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedShow, setSelectedShow] = useState<ShowSearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
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

  const functionsBaseUrl = useMemo(() => {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    return projectId ? `https://us-central1-${projectId}.cloudfunctions.net` : null;
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setFetching(true);
      setError(null);
      try {
        const snap = await getDocs(collection(db, "show-tracker", user.uid, "shows"));
        const data: UserShow[] = snap.docs.map((d) => {
          const val = d.data();
          return {
            id: d.id,
            title: (val.title as string | undefined) ?? null,
            attentionState: (val.attentionState as string | undefined) ?? null,
            lastRefreshAt: val.lastRefreshAt as Timestamp | undefined,
          };
        });
        setShows(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setFetching(false);
      }
    };
    void load();
  }, [user]);

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
    const title = selectedShow.title || null;
    try {
      await setDoc(
        doc(db, "show-tracker", user.uid, "shows", tvdbId),
        {
          title,
          attentionState: "unwatched",
          addedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setSearchQuery("");
      setSearchResults([]);
      setSelectedShow(null);
      setSearchError(null);
      setShows((prev) => {
        const existing = prev.find((s) => s.id === tvdbId);
        const next = existing
          ? prev.map((s) =>
              s.id === tvdbId ? { ...s, title, attentionState: "unwatched" } : s
            )
          : [...prev, { id: tvdbId, title, attentionState: "unwatched" }];
        return next;
      });
      setShowAddDialog(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const markWatched = async (tvdbId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "show-tracker", user.uid, "shows", tvdbId), {
        attentionState: "watched",
        updatedAt: serverTimestamp(),
      });
      setShows((prev) =>
        prev.map((s) => (s.id === tvdbId ? { ...s, attentionState: "watched" } : s))
      );
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
          {fetching && <span className={styles.tag}>Refreshing...</span>}
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
            {orderedShows.map((show) => (
              <li key={show.id} className={styles.listItem}>
                <div>
                  <div className={styles.titleRow}>
                    <span className={styles.showTitle}>{show.title || show.id}</span>
                    <span className={styles.muted}>ID: {show.id}</span>
                  </div>
                  <div className={styles.meta}>
                    <span className={styles.tag}>
                      {show.attentionState ? show.attentionState : "unknown"}
                    </span>
                    {show.lastRefreshAt && (
                      <span className={styles.muted}>
                        refreshed {show.lastRefreshAt.toDate().toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.actions}>
                  <button
                    className={styles.buttonSecondary}
                    onClick={() => markWatched(show.id)}
                    disabled={show.attentionState === "watched"}
                  >
                    Mark watched
                  </button>
                </div>
              </li>
            ))}
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
              {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && !searchError && (
                <p className={styles.muted}>No results yet.</p>
              )}
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
                <button className={styles.buttonSecondary} type="button" onClick={() => setShowAddDialog(false)}>
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
    </main>
  );
}
