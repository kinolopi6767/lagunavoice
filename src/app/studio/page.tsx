import type { Metadata } from "next";
import { StudioGenerator } from "@/components/studio/studio-generator";
import { LongFormPanel } from "@/components/studio/longform-panel";

export const metadata: Metadata = {
  title: "Studio — LugunaVoice",
  description:
    "Turn scripts into voiceovers: single-shot generation, long-form narration with SRT subtitles. Free, premium and flagship voices.",
};

export default function StudioPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Studio</h1>
        <p className="mt-2 text-muted-foreground">
          Script in, audio out. Free voices now — premium and flagship unlock with credits.
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Quick generation</h2>
          <StudioGenerator />
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold">Long-form narration</h2>
          <LongFormPanel />
        </section>
      </div>
    </main>
  );
}
