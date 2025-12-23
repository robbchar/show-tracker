import "@testing-library/jest-dom";
import "whatwg-fetch";
import { webcrypto } from "crypto";

// Provide crypto.randomUUID for environments that lack it in jsdom.
if (!global.crypto) {
  global.crypto = webcrypto as unknown as Crypto;
} else if (!("randomUUID" in global.crypto)) {
  // @ts-expect-error allow mutation in test env
  global.crypto.randomUUID = webcrypto.randomUUID.bind(webcrypto);
}

// Fail fast if an unmocked fetch is called in tests to avoid real network.
const originalFetch = global.fetch;

beforeAll(() => {
  global.fetch = jest.fn(async (...args: Parameters<typeof fetch>) => {
    throw new Error(`Unmocked fetch in tests: ${JSON.stringify(args[0])}`);
  }) as typeof fetch;
});

beforeEach(() => {
  jest.clearAllMocks();
  (global.fetch as jest.Mock).mockReset();
  (global.fetch as jest.Mock).mockImplementation(async (...args: Parameters<typeof fetch>) => {
    throw new Error(`Unmocked fetch in tests: ${JSON.stringify(args[0])}`);
  });
});

afterAll(() => {
  global.fetch = originalFetch;
});

