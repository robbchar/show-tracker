import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import React from "react";

import LoginPage from "./page";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

const pushMock = jest.fn();
const replaceMock = jest.fn();
(useRouter as jest.Mock).mockReturnValue({ push: pushMock, replace: replaceMock });

jest.mock("@/components/auth-provider", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
  }),
}));

jest.mock("@/lib/auth", () => ({
  signIn: jest.fn(),
  signUp: jest.fn(),
}));

const mockFetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "demo-project";
  (global.fetch as unknown as jest.Mock).mockImplementation(mockFetch);
});

describe("LoginPage", () => {
  it("signs in and saves PIN", async () => {
    const fakeCred = {
      user: { getIdToken: jest.fn().mockResolvedValue("token-123") },
    };
    const signIn = jest.requireMock("@/lib/auth").signIn as jest.Mock;
    signIn.mockResolvedValue(fakeCred);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText(/Email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/^Password/i), "pass");
    await userEvent.type(screen.getByLabelText(/TheTVDB PIN/i), "1234");
    await userEvent.click(screen.getByRole("button", { name: /Sign in/i }));

    expect(signIn).toHaveBeenCalledWith("a@b.com", "pass");
    expect(await screen.findByRole("button", { name: /Sign in/i })).toBeEnabled();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/saveTvdbPin"),
      expect.objectContaining({ method: "POST" })
    );
    expect(pushMock).toHaveBeenCalledWith("/");
  });

  it("shows error when PIN missing", async () => {
    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText(/Email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/^Password/i), "pass");
    // Provide whitespace so it passes required but fails trim check.
    await userEvent.type(screen.getByLabelText(/TheTVDB PIN/i), "   ");
    await userEvent.click(screen.getByRole("button", { name: /Sign in/i }));

    await screen.findByText(/PIN is required/i, undefined, { timeout: 3000 });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shows backend error when save pin fails", async () => {
    const fakeCred = {
      user: { getIdToken: jest.fn().mockResolvedValue("token-123") },
    };
    const signIn = jest.requireMock("@/lib/auth").signIn as jest.Mock;
    signIn.mockResolvedValue(fakeCred);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "boom" }),
    } as Response);

    render(<LoginPage />);

    await userEvent.type(screen.getByLabelText(/Email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/^Password/i), "pass");
    await userEvent.type(screen.getByLabelText(/TheTVDB PIN/i), "1234");
    await userEvent.click(screen.getByRole("button", { name: /Sign in/i }));

    await screen.findByText(/boom/i);
    expect(pushMock).not.toHaveBeenCalled();
  });
});
