import type { Metadata } from "next";
import { TestPlayground } from "@/components/test/test-playground";

export const metadata: Metadata = {
  title: "Local test playground — LugunaVoice",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Local testing facility (temporary): exercises every API and flow without
 * Supabase/Postgres — sandbox sessions, browser-saved API keys, all TTS
 * endpoints, referral codes and the manual payment flow.
 */
export default function TestPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <div className="mb-6 rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Local test playground</p>
        <p>
          Temporary testing UI — works without a database (in-memory stores + sandbox
          cookie session). Removed before launch.
        </p>
      </div>
      <TestPlayground />
    </main>
  );
}