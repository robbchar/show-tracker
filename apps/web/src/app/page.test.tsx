import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

const mockFetch = jest.spyOn(global, "fetch");

beforeEach(() => {
  mockGetDocs.mockReset();
  mockGetDoc.mockReset();
  mockFetch.mockReset();
  mockGetDocs.mockResolvedValue({ docs: [] });
  mockGetDoc.mockResolvedValue({ exists: () => false });
  const original = global.crypto;
  // Provide a typed randomUUID for tests to satisfy ts-jest expectations.
  global.crypto = {
    ...original,
    randomUUID: () => "toast-id-0000-0000-0000-000000000000",
  } as Crypto;
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-project";
});

const buildShowDoc = (id: string, attentionState: string | null, overrides: Record<string, unknown> = {}) => ({
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

