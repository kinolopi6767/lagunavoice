import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { StudioGenerator } from "@/components/studio/studio-generator";
import { LongFormPanel } from "@/components/studio/longform-panel";

export const metadata: Metadata = {
  title: "Studio — LugunaVoice",
  description:
    "Turn scripts into voiceovers: single-shot generation, long-form narration with SRT subtitles. Free, premium and flagship voices.",
};

export default function StudioPage() {
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <PageHeader
          eyebrow="Text to speech"
          title="Studio"
          description="Script in, audio out. Free voices now — premium and flagship unlock with credits."
        />

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
    </AppShell>
  );
}
