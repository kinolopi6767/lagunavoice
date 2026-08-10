import type { Metadata } from "next";
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
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Local test playground</h1>
        <p className="mt-2 text-muted-foreground">
          Same dashboard as the Studio, wired to every endpoint — sandbox sessions, v1 API keys,
          all TTS engines, credits &amp; payments. Runs without a database (in-memory). Temporary.
        </p>
      </div>

      <div className="space-y-8">
        <TestPlayground />
      </div>
    </main>
  );
}