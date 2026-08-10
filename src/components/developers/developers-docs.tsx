import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

const POLL_BLOCK = `curl https://api.lugunavoice.com/v1/tts/generations/gen_... \\
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
    path: "/v1/tts/generations/:id",
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
  ["409", "idempotency_conflict"],
  ["429", "rate_limited"],
  ["503", "voice_engine_unavailable"],
];

export function DevelopersDocs() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Developer documentation</h1>
        <p className="mt-2 text-muted-foreground">
          Generate speech from your own backend. Authenticate with a bearer API key
          (create one in your <Link href="/api-keys" className="underline underline-offset-4">API keys page</Link>),
          send text + a voice id, then poll until the audio is ready.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-xl font-semibold">Quickstart</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Create a generation</CardTitle>
            <CardDescription>
              Base URL <code>https://api.lugunavoice.com/v1</code> · Bearer auth · Idempotency-Key
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs leading-5">
              <code>{CODE_BLOCK}</code>
            </pre>
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-sm">Poll for the result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs leading-5">
              <code>{POLL_BLOCK}</code>
            </pre>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-xl font-semibold">SDKs</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">JavaScript / TypeScript</CardTitle>
              <CardDescription>
                <code>npm install @lugunavoice/sdk</code> — generate, poll, generateAndWait, listVoices, me
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs leading-5">
                <code>{JS_BLOCK}</code>
              </pre>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Python</CardTitle>
              <CardDescription>
                <code>pip install lugunavoice</code> — same surface, thin httpx client
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-md bg-muted p-4 text-xs leading-5">
                <code>{PY_BLOCK}</code>
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xl font-semibold">Endpoints</h2>
        <div className="space-y-2">
          {ENDPOINTS.map((e) => (
            <div key={e.path} className="flex gap-3 rounded-md border p-3 text-sm">
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${e.method === "GET" ? "bg-blue-500/10 text-blue-600" : "bg-emerald-500/10 text-emerald-600"}`}>
                {e.method}
              </span>
              <div>
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
          OpenAPI spec: <a href="/openapi.json" className="underline underline-offset-4">/openapi.json</a>
        </p>
      </div>
    </div>
  );
}
