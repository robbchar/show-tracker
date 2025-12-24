import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

const mockUser = {
  uid: "user-1",
  email: "test@example.com",
  getIdToken: jest.fn().mockResolvedValue("token-123"),
};

jest.mock("@/lib/firebase", () => ({
  auth: {},
  db: {},
}));

jest.mock("@/lib/auth", () => ({
  signOut: jest.fn(),
}));

jest.mock("@/components/auth-provider", () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
  }),
}));

jest.mock("@/components/theme-provider", () => ({
  useTheme: () => ({
    theme: "light",
    toggle: jest.fn(),
  }),
}));

import Home from "./page";

const mockGetDocs = jest.fn();
const mockGetDoc = jest.fn();

jest.mock("firebase/firestore", () => {
  return {
    collection: (...args: unknown[]) => args,
    doc: (...args: unknown[]) => ({ id: args[args.length - 1], args }),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    getDoc: (...args: unknown[]) => mockGetDoc(...args),
    writeBatch: () => ({
      delete: jest.fn(),
      commit: jest.fn(),
    }),
    serverTimestamp: () => new Date(),
    setDoc: jest.fn(),
    deleteDoc: jest.fn(),
  };
});

const mockFetch = jest.fn();

beforeEach(() => {
  mockGetDocs.mockReset();
  mockGetDoc.mockReset();
  mockGetDocs.mockResolvedValue({ docs: [] });
  mockGetDoc.mockResolvedValue({ exists: () => false });
  const original = global.crypto;
  // Provide a typed randomUUID for tests to satisfy ts-jest expectations.
  global.crypto = {
    ...original,
    randomUUID: () => "toast-id-0000-0000-0000-000000000000",
  } as Crypto;
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-project";
  // Override fetch for this suite.
  (global.fetch as unknown as jest.Mock).mockImplementation(mockFetch);
});

const buildShowDoc = (
  id: string,
  attentionState: string | null,
  overrides: Record<string, unknown> = {}
) => ({
  id,
  data: () => ({
    title: `Show ${id}`,
    attentionState,
    ...overrides,
  }),
});

describe("Home refresh", () => {
  it("posts refresh and shows success toast when shows exist", async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [buildShowDoc("1", "unwatched")],
    });
    mockGetDocs.mockResolvedValue({
      docs: [buildShowDoc("1", "unwatched")],
    });
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);

    render(<Home />);

    await screen.findByText(/Your shows/i);

    const refreshBtn = screen.getByRole("button", { name: /Refresh library/i });
    await userEvent.click(refreshBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/refreshShowsNow"),
        expect.objectContaining({ method: "POST" })
      );
    });

    await screen.findByText(/Library refreshed/i);
  });

  it("shows error toast when refresh fails", async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [buildShowDoc("1", "unwatched")],
    });
    mockGetDocs.mockResolvedValue({
      docs: [buildShowDoc("1", "unwatched")],
    });
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ message: "Too many refresh requests" }),
    } as Response);

    render(<Home />);

    await screen.findByText(/Your shows/i);

    const refreshBtn = screen.getByRole("button", { name: /Refresh library/i });
    await userEvent.click(refreshBtn);

    await screen.findByText(/Too many refresh requests/i);
  });

  it("shows info toast and skips refresh when no shows", async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    render(<Home />);
    await screen.findByText(/Your shows/i);

    const refreshBtn = screen.getByRole("button", { name: /Refresh library/i });
    expect(refreshBtn).toBeDisabled();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("Show interactions", () => {
  it("adds a show via search dialog", async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/searchShows")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ results: [{ id: "123", name: "My Show", year: 2024 }] }),
        } as Response);
      }
      if (url.includes("/addShow")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            show: { id: "123", name: "My Show", image: null, overview: "desc" },
          }),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected fetch ${url}`));
    });

    render(<Home />);
    await screen.findByText(/No shows yet/i);

    await userEvent.click(screen.getByRole("button", { name: /Add show/i }));
    await userEvent.type(screen.getByPlaceholderText(/Type a show title/i), "My");
    await screen.findByRole("button", { name: /My Show/i });
    await userEvent.click(screen.getByRole("button", { name: /My Show/i }));
    await userEvent.click(screen.getByRole("button", { name: /Add to library/i }));

    await screen.findByText(/My Show/i);
  });

  it("expands a show and toggles episode watched", async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [buildShowDoc("1", "unwatched", { title: "My Show" })],
    });
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const episodesPayload = {
      episodes: [
        { id: "e1", seasonNumber: 1, episodeNumber: 1, title: "Pilot" },
        { id: "e2", seasonNumber: 1, episodeNumber: 2, title: "Next" },
      ],
    };
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/getEpisodes")) {
        return Promise.resolve({ ok: true, json: async () => episodesPayload } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
    });

    render(<Home />);
    await screen.findByText(/My Show/);

    await userEvent.click(screen.getByRole("button", { name: /Seasons/i }));
    // Expand season within the seasons list.
    await userEvent.click(screen.getByRole("button", { name: /Expand season/i }));
    await screen.findByText(/S1E1/i);

    const toggle = screen.getAllByRole("button", { name: /Mark watched/i })[0];
    await userEvent.click(toggle);
    // The UI toggle should flip to "Mark unwatched" after click.
    await screen.findByRole("button", { name: /Mark unwatched/i });
  });

  it("marks a season watched and then unwatched", async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [buildShowDoc("1", "unwatched", { title: "My Show" })],
    });
    mockGetDoc.mockResolvedValue({ exists: () => false });
    const episodesPayload = {
      episodes: [
        { id: "e1", seasonNumber: 1, episodeNumber: 1, title: "Pilot" },
        { id: "e2", seasonNumber: 1, episodeNumber: 2, title: "Next" },
      ],
    };
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/getEpisodes")) {
        return Promise.resolve({ ok: true, json: async () => episodesPayload } as Response);
      }
      return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
    });

    render(<Home />);
    await screen.findByText(/My Show/);

    await userEvent.click(screen.getByRole("button", { name: /Seasons/i }));
    await userEvent.click(screen.getByRole("button", { name: /Expand season/i }));
    await screen.findByText(/S1E1/i);

    const seasonToggle = screen.getByRole("button", { name: /Mark season watched/i });
    await userEvent.click(seasonToggle);
    await screen.findAllByRole("button", { name: /Mark unwatched/i });

    // Now toggle back to unwatched.
    const seasonToggleBack = screen.getByRole("button", { name: /Mark season unwatched/i });
    await userEvent.click(seasonToggleBack);
    await screen.findAllByRole("button", { name: /Mark watched/i });
  });

  it("removes a show and clears it from the list", async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [buildShowDoc("1", "unwatched", { title: "My Show" })],
    });
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) } as Response);

    render(<Home />);
    await screen.findByText(/My Show/);

    await userEvent.click(screen.getByRole("button", { name: /Remove My Show/i }));
    expect(screen.queryByText(/My Show/)).not.toBeInTheDocument();
  });
});

describe("Attention ordering", () => {
  it("orders shows new-unwatched > unwatched > watched", async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        buildShowDoc("3", "watched"),
        buildShowDoc("1", "new-unwatched"),
        buildShowDoc("2", "unwatched"),
      ],
    });
    mockGetDoc.mockResolvedValue({ exists: () => false });

    render(<Home />);

    await screen.findByText(/Show 1/);

    const items = screen.getAllByRole("listitem");
    const titles = items.map((item) => item.querySelector("span")?.textContent);

    expect(titles).toEqual(["Show 1", "Show 2", "Show 3"]);
  });
});
