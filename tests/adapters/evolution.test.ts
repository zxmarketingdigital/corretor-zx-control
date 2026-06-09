import { describe, expect, it } from "vitest";
import { EvolutionAdapter, WhatsAppError } from "../../src/adapters/whatsapp/evolution";

const mockEnv = {
  EVOLUTION_URL: "https://evo.example.com",
  EVOLUTION_INSTANCE: "corretor1",
  EVOLUTION_API_KEY: "secret-key",
};

type MockResponse = { ok: boolean; status: number; json(): Promise<unknown> };
function httpOk(body: unknown = {}): MockResponse {
  return { ok: true, status: 200, json: async () => body };
}
function httpFail(status: number): MockResponse {
  return { ok: false, status, json: async () => ({}) };
}

// ── send ──────────────────────────────────────────────────────────────────
describe("EvolutionAdapter.send", () => {
  it("envia POST com URL, headers e body corretos", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit = {};
    const _fetch = async (url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedInit = init;
      return httpOk();
    };
    const adapter = new EvolutionAdapter(mockEnv, _fetch);
    await adapter.send("5511999990001", "Olá!");

    expect(capturedUrl).toBe("https://evo.example.com/message/sendText/corretor1");
    expect(capturedInit.method).toBe("POST");
    const headers = capturedInit.headers as Record<string, string>;
    expect(headers["apikey"]).toBe("secret-key");
    const body = JSON.parse(capturedInit.body as string) as { number: string; text: string };
    expect(body.number).toBe("5511999990001");
    expect(body.text).toBe("Olá!");
  });

  it("lança WhatsAppError em resposta HTTP não-ok", async () => {
    const adapter = new EvolutionAdapter(mockEnv, async () => httpFail(401));
    await expect(adapter.send("5511999990001", "Olá!")).rejects.toBeInstanceOf(WhatsAppError);
  });
});

// ── status ────────────────────────────────────────────────────────────────
describe("EvolutionAdapter.status", () => {
  it("retorna 'connected' quando instância está ativa", async () => {
    const body = [{ instance: { instanceName: "corretor1", status: "open" } }];
    const adapter = new EvolutionAdapter(mockEnv, async () => httpOk(body));
    expect(await adapter.status()).toBe("connected");
  });

  it("retorna 'disconnected' quando instância não encontrada", async () => {
    const adapter = new EvolutionAdapter(mockEnv, async () => httpOk([]));
    expect(await adapter.status()).toBe("disconnected");
  });

  it("retorna 'qr_needed' quando status é connecting", async () => {
    const body = [{ instance: { instanceName: "corretor1", status: "connecting" } }];
    const adapter = new EvolutionAdapter(mockEnv, async () => httpOk(body));
    expect(await adapter.status()).toBe("qr_needed");
  });

  // Evolution v2.x — formato plano {name, connectionStatus} (o que o servidor real retorna)
  it("retorna 'connected' no formato v2 (name/connectionStatus)", async () => {
    const body = [{ name: "corretor1", connectionStatus: "open" }];
    const adapter = new EvolutionAdapter(mockEnv, async () => httpOk(body));
    expect(await adapter.status()).toBe("connected");
  });

  it("retorna 'qr_needed' no formato v2 quando connecting", async () => {
    const body = [{ name: "corretor1", connectionStatus: "connecting" }];
    const adapter = new EvolutionAdapter(mockEnv, async () => httpOk(body));
    expect(await adapter.status()).toBe("qr_needed");
  });
});

// ── parseWebhook ──────────────────────────────────────────────────────────
describe("EvolutionAdapter.parseWebhook", () => {
  it("extrai from/text/messageId de payload válido", () => {
    const adapter = new EvolutionAdapter(mockEnv);
    const payload = {
      event: "messages.upsert",
      data: {
        key: { remoteJid: "5511999990001@s.whatsapp.net", id: "MSG123" },
        message: { conversation: "quero comprar" },
      },
    };
    const msg = adapter.parseWebhook(payload);
    expect(msg).toEqual({ from: "5511999990001", text: "quero comprar", messageId: "MSG123" });
  });

  it("retorna null para payload inválido", () => {
    const adapter = new EvolutionAdapter(mockEnv);
    expect(adapter.parseWebhook(null)).toBeNull();
    expect(adapter.parseWebhook({ event: "status.update" })).toBeNull();
    expect(adapter.parseWebhook({})).toBeNull();
  });

  it("extrai texto de mensagem extendedTextMessage", () => {
    const adapter = new EvolutionAdapter(mockEnv);
    const payload = {
      event: "messages.upsert",
      data: {
        key: { remoteJid: "5511999990002@s.whatsapp.net", id: "MSG456" },
        message: { extendedTextMessage: { text: "tenho interesse" } },
      },
    };
    const msg = adapter.parseWebhook(payload);
    expect(msg?.text).toBe("tenho interesse");
  });
});
