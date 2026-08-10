# LugunaVoice — Plain-English Glossary & Concepts

> Written for a non-technical founder. Every term below appears in the planning docs. If you meet a word you don't know, look here first.

## The product
- **TTS (text-to-speech)** — software that reads written text out loud. "Synthesis" = the act of generating the audio. "Engine"/"provider" = the company/model that does the actual reading (we use three).
- **Voice tiers** — our three quality levels:
  - **Free (Edge TTS)** — Microsoft Edge's built-in read-aloud voices. Free for us, but unofficial (could break; we never depend on it for money).
  - **Premium (Typecast)** — Korean company's voice models (ssfm = their model family). We buy wholesale credits (~$0.08/1,000 characters) and resell them.
  - **Flagship (Deepgram)** — US speech-AI company. Fastest, best for streaming; costs ~$0.03/1,000 characters. English-focused.
- **Reseller model** — we don't build our own TTS models; we rent capacity from these three at wholesale prices and sell it with our own UI + API + extras.

## Money & billing
- **Credits** — pre-paid units in our app. 1 credit = 1 character of premium (Typecast) voice; 2 credits = 1 character of flagship (Deepgram) voice; free tier costs 0 credits. We set these ratios so every sale is profitable.
- **Wholesale vs retail** — wholesale = what we pay the provider; retail = what users pay us. Margin = the difference (~60–80%).
- **Razorpay** — Indian payment gateway (like a bank's card machine for websites). Accepts UPI + international cards. We must have a registered business (entity + GST) to use it.
- **Webhook** — a "phone number" for servers. Razorpay calls our server to say "payment succeeded". We verify it with a **signature (HMAC)** so nobody can fake it, and dedupe so it can't credit us twice.
- **Chargeback** — customer asks their bank to reverse a payment. We must monitor and respond, or we lose money.

## Security words
- **API key** — a secret password your code sends to prove who it is. We store only a scrambled version (hash) so even a database leak doesn't expose real keys.
- **RLS (Row-Level Security)** — database rules: "a user may only see their own rows". We turn this on for every table.
- **Rate limiting** — slowing down requests (e.g., max 10 per minute per user). Stops bots and abusers.
- **Token bucket** — a rate-limiting technique: users get a bucket of tokens that refills over time; each request spends one.
- **Turnstile** — Cloudflare's free CAPTCHA ("prove you're human") shown on signup and the demo.
- **Moderation API (OpenAI)** — free service that scans text and flags toxic/abusive content before we send it to a voice engine.
- **Fingerprinting** — recognizing the same device across accounts (via browser signals) to catch people creating many fake accounts for free credits.
- **CAPTCHA** — the "I'm not a robot" test.
- **3DS** — extra card-verification step for online payments (the redirect to your bank app). Keeps fraud liability with the bank, not us.
- **PII** — personally identifiable information (email, IP, name). We minimize and delete it.
- **DPA / GDPR** — data-protection agreements and EU privacy law. Basics: only collect what you need, tell people what you do with it, delete on request.

## Audio words
- **MP3 / WAV** — audio file formats. MP3 small (web), WAV big (studio quality).
- **SRT** — the standard subtitle file format (text + start/end times). We generate it for videos.
- **Word timestamps** — the exact time each word starts/ends. Needed to build SRT. Typecast and Edge TTS give us this directly; **Deepgram TTS doesn't — so we run our Deepgram audio back through Deepgram's speech-to-text (STT), which gives timestamps for free, and convert them to SRT with their official `@deepgram/captions` tool** (a "round-trip": audio → listen → words → SRT). Costs ~$0.0043 per minute.
- **STT (speech-to-text)** — the reverse of TTS: audio in, text out. Deepgram's (Nova-3) gives us subtitles for flagship audio, and later a "upload audio → transcript" studio tool.
- **COGS (cost of goods sold)** — what a sale costs *us* at wholesale. Deepgram lets us attach a **tag** to every request and query an exact per-tag cost report, so our admin dashboard knows precisely how much each user costs us.
- **Callback** — a provider (Deepgram) can call *our* webhook when a job finishes instead of us repeatedly asking ("polling"). Saves work; we still keep polling as a backup.
- **Voice Agent API** — Deepgram's product for realtime AI voice assistants (hears you, thinks with an LLM, talks back). Wholesale $4.50/hour; we can resell it later as our "custom agents" product.
- **Text Intelligence** — Deepgram's API for analyzing text alone (summaries, sentiment, topics). A future "script assistant" feature.
- **Loudness / LUFS** — how loud audio is. We normalize everything to the same loudness (-16 LUFS) so switching voices doesn't jump in volume.
- **ffmpeg** — the Swiss-army-knife free tool for editing audio (join clips, adjust loudness, convert formats). We run it server-side.
- **Crossfade / clicks at joins** — when you stitch audio clips, you can hear pops; we add small silence + normalize to avoid it.
- **Streaming TTS** — audio arrives in small chunks as it's being generated (instead of one big file after waiting). Feels realtime (<1s). Used for typing preview and future voice agents.
- **WebSocket (WS)** — a two-way live connection between browser and server (vs normal request/response). Needed for streaming audio.
- **IPA (International Phonetic Alphabet)** — the pronunciation alphabet. Deepgram lets us fix mispronunciations by providing IPA overrides (e.g., how to say "GIF", names, brands).
- **SSML** — markup language for pronunciation control. Full SSML isn't supported by our providers; we ship "SSML-lite" = emotion tags and presets.

## Voice cloning
- **Voice cloning** — creating a digital copy of a voice from a recording sample. Typecast does this for us (5–150 second sample). We must store the user's **consent** (proof they own the voice).
- **Custom voice / cloned voice** — a `uc_` voice belonging to one user; only that user can use it.
- **Public-figure refusal** — refusing to clone celebrities/politicians' voices (legal/ethical risk).
- **Watermarking / provenance** — embedding a hidden marker in audio proving it's AI-generated. A v2 feature (EU AI Act requires disclosure from Aug 2026).

## Long-form generation
- **Chunking** — splitting very long text into pieces under each provider's per-request limit (Typecast 2,000 chars; Deepgram 2,000; Edge 10,000), then stitching the audio back together.
- **Voice consistency** — keeping the same voice, model, settings, and loudness across chunks so a 2-hour audiobook sounds like one take.
- **Seed** — a number that makes the same input produce the same output (like a recipe code). Not all providers support it (Typecast does).
- **Batch/queue** — doing work in the background (a "worker" processes chunks) instead of making the user wait.

## Infrastructure words
- **Next.js** — the web framework we build the app with (the house, not the furniture).
- **Supabase** — the "backend-in-a-box": database (Postgres), login (Auth), file storage, all with security rules built in.
- **Postgres / Drizzle** — Postgres = the database type; Drizzle = the tool we use to write database code safely in TypeScript.
- **Vercel** — where the app runs (hosting). **Cloudflare** — sits in front: CDN, bot protection, CAPTCHA, DNS.
- **ORM / migrations** — ORM = writing database queries in code; migrations = version-controlled schema changes (like git for the database).
- **Transaction / ACID** — a database operation that's all-or-nothing. Critical so debiting credits + creating the generation can never half-complete (that's how double-billing or lost credits are prevented).
- **Ledger** — an append-only book of every credit movement (like a bank statement). Never edited — only new entries added.
- **Idempotency** — "same request twice = same result". The `Idempotency-Key` header makes retries safe.
- **CI (GitHub Actions)** — automatic checks (lint, types, tests) that run on every code push, so bugs get caught before deployment.
- **Presigned URL** — a temporary link (e.g., 1 hour) to a private file, so the file stays private but downloads still work.

## Business words
- **MRR** — monthly recurring revenue.
- **Churn** — customers who stop paying.
- **Referral program** — users earn credits by inviting friends; a cheap growth engine.
- **MoR (Merchant of Record)** — a company (Paddle/Lemon Squeezy) that becomes the seller of record and handles global taxes for us (a v2 option).
