import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ICONS = [
  // three tiers — layered waveforms
  <svg key="tiers" viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
    <rect x="4" y="10" width="2.4" height="4" rx="1.2" />
    <rect x="8.4" y="7" width="2.4" height="10" rx="1.2" />
    <rect x="12.8" y="9" width="2.4" height="6" rx="1.2" />
    <rect x="17.2" y="5" width="2.4" height="14" rx="1.2" />
  </svg>,
  // long-form — stacked pages
  <svg key="longform" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3v5h5M9.5 13h5M9.5 16.5h5" />
  </svg>,
  // cloning — copy badge
  <svg key="clone" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>,
  // subtitles — caption bars
  <svg key="srt" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M7 12h6m-6 3.5h10" />
  </svg>,
  // pronunciation — text cursor
  <svg key="pron" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 7V4h16v3M9 20h6M12 4v16" />
  </svg>,
  // API — code brackets
  <svg key="api" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m8 8-4 4 4 4m8-8 4 4-4 4M14 5l-4 14" />
  </svg>,
];

const FEATURES = [
  {
    title: "Three voice tiers",
    body: "Free Edge TTS voices, premium Typecast voices with emotion control, and flagship Deepgram voices with sub-200ms real-time playback.",
  },
  {
    title: "Long-form narration",
    body: "Paste 100,000 characters — we chunk, synthesize in parallel, and stitch one clean MP3 with consistent voice and loudness.",
  },
  {
    title: "Voice cloning",
    body: "Clone a voice from a 5–150 second sample (with consent). Your clone speaks 37 languages and only you can use it.",
  },
  {
    title: "Subtitles included",
    body: "Word-timed SRT export for every generation, so your videos ship with captions from the same script.",
  },
  {
    title: "Pronunciation control",
    body: "Fix any name, brand or jargon with per-word overrides — money, dates and codes read correctly every time.",
  },
  {
    title: "Developer API",
    body: "REST + streaming endpoints, scoped API keys, idempotent billing and JS/Python SDKs. Build voice into your product.",
  },
];

export function Features() {
  return (
    <section id="voices" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <h2 className="text-center text-3xl font-bold tracking-tight">
        Everything a <span className="text-gradient">voice studio</span> needs
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
        The feature set professionals expect — with honest engine labeling and
        credits that never expire.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Card key={f.title} className="transition-colors hover:border-primary/30 hover:bg-primary/[0.02]">
            <CardHeader>
              <span className="mb-2 flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-grad-a to-grad-b text-white shadow-sm shadow-grad-b/25">
                {ICONS[i]}
              </span>
              <CardTitle className="text-lg">{f.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm leading-6">{f.body}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
