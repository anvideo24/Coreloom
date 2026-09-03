import { describe, expect, test } from "vitest";

import { appendQuoteEmailConfig, parseQuoteEmailSetup } from "@/lib/setup/local-environment";

describe("quote email local configuration", () => {
  test("adds only a sending API key and the onboarding test sender", () => {
    const values = parseQuoteEmailSetup({ apiKey: "re_example" });

    expect(appendQuoteEmailConfig("DATABASE_URL=example\n", values)).toBe('DATABASE_URL=example\nRESEND_API_KEY="re_example"\nCORELOOM_QUOTE_FROM="onboarding@resend.dev"\n');
  });
});
