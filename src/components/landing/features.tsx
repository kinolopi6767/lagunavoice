import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
      <h2 className="text-center text-3xl font-bold tracking-tight">Everything a voice studio needs</h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
        The feature set professionals expect — with honest engine labeling and
        credits that never expire.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Card key={f.title}>
            <CardHeader>
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
