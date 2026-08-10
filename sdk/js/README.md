# @lugunavoice/sdk

LugunaVoice developer SDK (TypeScript/JavaScript).

```bash
npm install @lugunavoice/sdk
```

## Quickstart

```ts
import { LugunaVoice } from "@lugunavoice/sdk";

const client = new LugunaVoice("lug_..."); // create a key in the dashboard

// find a voice
const { voices } = await client.listVoices({ tier: "free", limit: 5 });

// generate + wait (polls internally, 1.5s interval)
const gen = await client.generateAndWait({
  text: "Hello from LugunaVoice!",
  voice: voices[0].id,
  style: "cheerful",
});

if (gen.status === "completed" && gen.audioBase64) {
  const audio = Buffer.from(gen.audioBase64, "base64");
  // save or play
}
```

## Async pattern (explicit polling)

```ts
const created = await client.generate({ text: "Hello", voice: "fs_voice_..." }, "idem-key-1");
const gen = await client.getGeneration(created.id); // poll until completed
```

## Idempotency

Pass an `Idempotency-Key` on `generate()` — retries with the same key never
double-charge you.

## Errors

All failures throw `LugunaVoiceError` with `.code` (e.g. `invalid_api_key`,
`rate_limited`, `insufficient_credits`) and `.status`.

## API reference

- `listVoices({ q, language, tier, limit, offset })`
- `generate(req, idempotencyKey?)`
- `getGeneration(id)`
- `generateAndWait(req, { pollIntervalMs, timeoutMs, idempotencyKey })`
- `me()`
