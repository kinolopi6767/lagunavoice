/**
 * LugunaVoice JS SDK — thin client for the developer API.
 * Base URL configurable (defaults to https://api.lugunavoice.com/v1).
 */

export interface Voice {
  id: string;
  provider: "edge" | "typecast" | "deepgram";
  modelVersion?: string;
  name: string;
  language: string;
  gender?: string;
  tier: "free" | "premium" | "flagship";
  useCases?: string[];
}

export interface GenerationRequest {
  text: string;
  voice: string;
  style?: "neutral" | "cheerful" | "calm" | "serious" | "excited";
  pitch?: number;
  rate?: number;
}

export interface Generation {
  id: string;
  status: "processing" | "completed" | "failed";
  voice?: string;
  provider?: string;
  tier?: string;
  textLength?: number;
  creditsCharged?: number;
  audioBase64?: string;
  mimeType?: string;
  durationMs?: number;
  error?: string;
}

export interface VoicePage {
  voices: Voice[];
  total: number;
  languages: string[];
  stats: { total: number; free: number; premium: number; flagship: number };
}

export interface Account {
  userId: string;
  creditsBalance: number;
  keys: Array<{ id: string; name: string; keyPrefix: string; scopes: string[]; revokedAt?: number }>;
  recentLedger: Array<{ type: string; amount: number; balanceAfter: number; description?: string }>;
}

export interface SDKOptions {
  baseUrl?: string;
}

export class LugunaVoiceError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "LugunaVoiceError";
    this.code = code;
    this.status = status;
  }
}

export class LugunaVoice {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, opts: SDKOptions = {}) {
    if (!apiKey) throw new Error("LugunaVoice SDK requires an API key (create one in the dashboard)");
    this.apiKey = apiKey;
    this.baseUrl = (opts.baseUrl ?? "https://api.lugunavoice.com/v1").replace(/\/$/, "");
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string; code?: string } | null;
      throw new LugunaVoiceError(data?.error ?? `HTTP ${res.status}`, data?.code ?? "api_error", res.status);
    }
    return (await res.json()) as T;
  }

  /** list the voice catalog */
  async listVoices(opts: { q?: string; language?: string; tier?: string; limit?: number; offset?: number } = {}): Promise<VoicePage> {
    const params = new URLSearchParams();
    if (opts.q) params.set("q", opts.q);
    if (opts.language) params.set("language", opts.language);
    if (opts.tier) params.set("tier", opts.tier);
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.offset) params.set("offset", String(opts.offset));
    return this.request<VoicePage>(`/voices?${params}`);
  }

  /** create a generation — returns the id to poll */
  async generate(req: GenerationRequest, idempotencyKey?: string): Promise<{ id: string; status: string; estimatedCredits: number }> {
    return this.request("/tts/generations", {
      method: "POST",
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      body: JSON.stringify(req),
    });
  }

  /** poll a generation */
  async getGeneration(id: string): Promise<Generation> {
    return this.request<Generation>(`/tts/generations/${id}`);
  }

  /**
   * Generate + wait for completion (polls internally).
   * @param pollIntervalMs delay between polls (default 1500)
   * @param timeoutMs give up after this long (default 120_000)
   */
  async generateAndWait(req: GenerationRequest, opts: { pollIntervalMs?: number; timeoutMs?: number; idempotencyKey?: string } = {}): Promise<Generation> {
    const interval = opts.pollIntervalMs ?? 1_500;
    const timeout = opts.timeoutMs ?? 120_000;
    const created = await this.generate(req, opts.idempotencyKey);
    const started = Date.now();

    for (;;) {
      const generation = await this.getGeneration(created.id);
      if (generation.status === "completed" || generation.status === "failed") return generation;
      if (Date.now() - started > timeout) {
        throw new LugunaVoiceError("Generation timed out", "timeout", 408);
      }
      await new Promise((r) => setTimeout(r, interval));
    }
  }

  /** account, balance and key info */
  async me(): Promise<Account> {
    return this.request<Account>("/me");
  }
}
