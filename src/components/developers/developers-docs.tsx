import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeBlock } from "@/components/developers/code-block";

const CODE_BLOCK = `curl https://api.lugunavoice.com/v1/tts/generations \\
  -X POST \\
  -H "Authorization: Bearer $LUGUNA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "text": "Hello, this is LugunaVoice.",
    "voice": "fs_voice_edge_en-US-AriaNeural",
    "style": "cheerful"
  }'
# → 202 { "id": "gen_...", "status": "processing" }`;

const POLL_BLOCK = `curl https://api.lugunavoice.com/v1/generations/gen_... \\
  -H "Authorization: Bearer $LUGUNA_API_KEY"
# → { "id": "gen_...", "status": "completed",
#     "audioBase64": "...", "mimeType": "audio/mpeg", "durationMs": 2140 }`;

const JS_BLOCK = `import { LugunaVoice } from "@lugunavoice/sdk";

const client = new LugunaVoice(process.env.LUGUNA_API_KEY);
const gen = await client.generateAndWait({
  text: "Hello, this is LugunaVoice.",
  voice: "fs_voice_edge_en-US-AriaNeural",
  style: "cheerful",
});
// gen.audioBase64 → MP3 audio`;

const PY_BLOCK = `from lugunavoice import LugunaVoice

client = LugunaVoice("lug_...")
gen = client.generate_and_wait(
    "Hello, this is LugunaVoice.",
    voice="fs_voice_edge_en-US-AriaNeural",
    style="cheerful",
)
audio = client.audio_bytes(gen)  # MP3 bytes`;

const ENDPOINTS = [
  {
    method: "POST",
    path: "/v1/tts/generations",
    desc: "Create a generation. Async — returns an id, poll for the result. Send an Idempotency-Key so retries never double-charge.",
  },
  {
    method: "GET",
    path: "/v1/generations/:id",
    desc: "Poll a generation: processing → completed (audioBase64 + durationMs) | failed.",
  },
  {
    method: "GET",
    path: "/v1/voices",
    desc: "List the voice catalog. Query: q, language, gender, tier, provider, limit, offset.",
  },
  {
    method: "GET",
    path: "/v1/me",
    desc: "Your account: balance, keys, recent ledger entries.",
  },
];

const CODES = [
  ["401", "invalid_api_key"],
  ["402", "insufficient_credits"],
  ["429", "rate_limited"],
  ["503", "voice_engine_unavailable"],
];

export function DevelopersDocs() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="REST API"
        title="Developer documentation"
        description={
          <>
            Generate speech from your own backend. Create a{" "}
            <Link href="/api-keys" className="underline underline-offset-4">scoped API key</Link>,
            send text and a voice id, then poll until the audio is ready. Every request is
            billed idempotently — retries never double-charge you.
          </>
        }
      />

      <div>
        <h2 className="mb-1 text-xl font-semibold">Quickstart</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Base URL: <code className="rounded bg-muted px-1.5 py-0.5">https://api.lugunavoice.com/v1</code>{" "}
          · Bearer auth · Idempotency-Key header
        </p>
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">1 · Create a generation</CardTitle>
              <CardDescription>
                <code>POST /v1/tts/generations</code>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock code={CODE_BLOCK} label />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">2 · Poll for the result</CardTitle>
              <CardDescription>
                <code>GET /v1/generations/:id</code> — poll every 1 second, up to 40
                seconds. A retry with the same <code>Idempotency-Key</code> returns the
                original generation (never double-charges).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock code={POLL_BLOCK} label />
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xl font-semibold">Request parameters</h2>
        <div className="space-y-2">
          {[
            {
              param: "text",
              type: "string · required",
              desc: "The text to speak, up to 10,000 characters.",
            },
            {
              param: "voice",
              type: "string · required",
              desc: "A voice id from the catalog — list them via GET /v1/voices.",
            },
            {
              param: "style",
              type: "string · optional",
              desc: "Delivery style: neutral (default), cheerful, calm, serious, excited.",
            },
            {
              param: "rate",
              type: "number · optional",
              desc: "Speed multiplier, 0.5–2.0 (default 1.0).",
            },
            {
              param: "pitch",
              type: "number · optional",
              desc: "Pitch shift in semitones, −12 to +12 (default 0).",
            },
            {
              param: "Idempotency-Key",
              type: "header · recommended",
              desc: "Any unique string (e.g. uuidgen). Replaying a request with the same key returns the original result without charging again.",
            },
          ].map((p) => (
            <div key={p.param} className="grid gap-1 rounded-lg border p-3 text-sm sm:grid-cols-[220px_1fr]">
              <div>
                <code className="font-medium">{p.param}</code>
                <Badge variant="secondary" className="ml-2 text-[10px]">{p.type}</Badge>
              </div>
              <p className="text-muted-foreground">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xl font-semibold">SDKs</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">JavaScript / TypeScript</CardTitle>
              <CardDescription>
                <code>npm install @lugunavoice/sdk</code> — generate, poll, generateAndWait,
                listVoices, me
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock code={JS_BLOCK} label />
            </CardContent>
          </Card>
          <Card className="min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Python</CardTitle>
              <CardDescription>
                <code>pip install lugunavoice</code> — same surface, thin httpx client
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock code={PY_BLOCK} label />
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xl font-semibold">Endpoints</h2>
        <div className="space-y-2">
          {ENDPOINTS.map((e) => (
            <div key={e.path} className="flex gap-3 rounded-lg border p-3 text-sm">
              <span
                className={`shrink-0 self-start rounded px-1.5 py-0.5 text-xs font-medium ${
                  e.method === "GET"
                    ? "bg-primary/10 text-primary"
                    : "bg-primary/15 text-primary"
                }`}
              >
                {e.method}
              </span>
              <div className="min-w-0">
                <code className="font-medium">{e.path}</code>
                <p className="mt-0.5 text-muted-foreground">{e.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xl font-semibold">Error codes</h2>
        <div className="flex flex-wrap gap-2">
          {CODES.map(([status, code]) => (
            <span key={code} className="rounded-full border px-2.5 py-1 text-xs">
              <b>{status}</b> {code}
            </span>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          OpenAPI spec: <a href="/openapi.json" className="underline underline-offset-4">/openapi.json</a>{" "}
          · want to try it without a server? Use the{" "}
          <Link href="/test" className="underline underline-offset-4">local test playground</Link>.
        </p>
      </div>
    </div>
  );
}