import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { DevelopersDocs } from "@/components/developers/developers-docs";

export const metadata: Metadata = {
  title: "Developers — LugunaVoice API",
  description:
    "Generate speech from your own backend with a REST API. Bearer API keys, idempotent billing, async generation with polling, JS + Python SDKs.",
};

export default function DevelopersPage() {
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <DevelopersDocs />
      </main>
    </AppShell>
  );
}
