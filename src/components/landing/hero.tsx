import { DemoGenerator } from "@/components/landing/demo-generator";

export function Hero() {
  return (
    <section id="demo" className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-24">
      <div>
        <p className="text-sm font-medium text-primary">AI voice studio for creators</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Turn words into voices.
        </h1>
        <p className="mt-4 max-w-lg text-lg text-muted-foreground">
          Free, premium and flagship AI voices in one place. Long-form narration,
          voice cloning, subtitles and a developer API — no booth, no talent
          booking, no re-record because one line changed.
        </p>
        <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
          <li>✓ 1,100+ voices across 30+ languages</li>
          <li>✓ Unlimited free voices with Edge TTS</li>
          <li>✓ Premium credits never expire</li>
          <li>✓ SRT subtitles, streaming, voice cloning</li>
        </ul>
      </div>

      <DemoGenerator />
    </section>
  );
}
