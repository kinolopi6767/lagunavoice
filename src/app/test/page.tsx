import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { TestPlayground } from "@/components/test/test-playground";

export const metadata: Metadata = {
  title: "Local test playground — LugunaVoice",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Local testing facility (temporary): the same dashboard layout as /studio —
 * sandbox sessions, browser-saved API keys for the v1 developer API, all TTS
 * endpoints, referral codes and the manual payment flow. No database needed.
 */
export default function TestPage() {
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <PageHeader
          eyebrow="Developer tools"
          title="Local test playground"
          description="Same dashboard as the Studio, wired to every endpoint — sandbox sessions, v1 API keys, all TTS engines, credits & payments. Runs without a database (in-memory). Temporary."
        />

      <div className="space-y-8">
        <TestPlayground />
      </div>
    </main>
    </AppShell>
  );
}