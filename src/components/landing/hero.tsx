import { DemoGenerator } from "@/components/landing/demo-generator";

export function Hero() {
  return (
    <section
      id="demo"
      className="relative mx-auto grid w-full max-w-6xl gap-10 overflow-hidden px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-24"
    >
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
        <div className="absolute -top-32 left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-grad-a/15 blur-3xl" />
        <div className="absolute top-24 -right-24 h-72 w-72 rounded-full bg-grad-b/15 blur-3xl" />
      </div>

      <div>
        <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
          <span className="size-1.5 rounded-full bg-gradient-to-br from-grad-a to-grad-b" />
          Free to start · No credit card
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
          Turn words into{" "}
          <span className="text-gradient">voices.</span>
        </h1>
        <p className="mt-4 max-w-lg text-lg text-muted-foreground">
          Free, premium and flagship AI voices in one place. Long-form narration,
          voice cloning, subtitles and a developer API — no booth, no talent
          booking, no re-record because one line changed.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <a
            href="/studio"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-gradient-to-br from-grad-a to-grad-b px-5 text-sm font-medium text-white shadow-sm shadow-grad-b/30 transition-all hover:shadow-md hover:shadow-grad-b/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
          >
            Try the studio free
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </a>
          <a
            href="/voices"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-background px-5 text-sm font-medium shadow-xs transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Browse 1,100+ voices
          </a>
        </div>
        <ul className="mt-7 space-y-2 text-sm text-muted-foreground">
          {[
            "1,100+ voices across 30+ languages",
            "Unlimited free voices with Edge TTS",
            "Premium credits never expire",
            "SRT subtitles, streaming, voice cloning",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="m5 13 4 4L19 7" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-grad-a/70 via-border/40 to-grad-b/70 p-px shadow-2xl shadow-grad-b/15">
        <DemoGenerator />
      </div>
    </section>
  );
}
