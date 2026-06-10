import { describe, expect, it } from "vitest";
import { GeminiError, geminiFlash } from "../src/gemini/client";

const mockEnv = { GEMINI_API_KEY: "test-api-key" };
const noDelay = async (_ms: number) => {};

type MockResponse = { ok: boolean; status: number; json(): Promise<unknown> };

function ok(text: string): MockResponse {
  return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }) };
}
function fail(status: number): MockResponse {
  return { ok: false, status, json: async () => ({}) };
}

describe("geminiFlash", () => {
  it("retorna texto da resposta em sucesso", async () => {
    const result = await geminiFlash("prompt", mockEnv, {
      _fetch: async () => ok("olá lead"),
      _delay: noDelay,
    });
    expect(result).toBe("olá lead");
  });

  it("retenta em HTTP 429 e retorna sucesso na 3ª tentativa", async () => {
    let calls = 0;
    const result = await geminiFlash("prompt", mockEnv, {
      retries: 3,
      _fetch: async () => (++calls < 3 ? fail(429) : ok("sucesso")),
      _delay: noDelay,
    });
    expect(calls).toBe(3);
    expect(result).toBe("sucesso");
  });

  it("retenta em HTTP 500 e lança GeminiError após esgotar retries", async () => {
    await expect(
      geminiFlash("prompt", mockEnv, { retries: 2, _fetch: async () => fail(500), _delay: noDelay }),
    ).rejects.toBeInstanceOf(GeminiError);
  });

  it("lança GeminiError se resposta não tiver texto", async () => {
    await expect(
      geminiFlash("prompt", mockEnv, {
        retries: 1,
        _fetch: async () => ({ ok: true, status: 200, json: async () => ({ candidates: [] }) }),
        _delay: noDelay,
      }),
    ).rejects.toBeInstanceOf(GeminiError);
  });

  it("lança GeminiError com status quando esgota retries", async () => {
    await expect(
      geminiFlash("prompt", mockEnv, { retries: 1, _fetch: async () => fail(503), _delay: noDelay }),
    ).rejects.toThrow(/503/);
  });
});
