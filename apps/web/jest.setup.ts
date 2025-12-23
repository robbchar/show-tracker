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

