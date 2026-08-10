import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { CloneStudio } from "@/components/voice-cloning/clone-studio";

export const metadata: Metadata = {
  title: "Voice cloning — LugunaVoice",
  description:
    "Clone a voice from a 5–150 second recording with consent. Your clone speaks 37 languages and is private to your account.",
};

export default function VoiceCloningPage() {
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Voice cloning</h1>
        <p className="mt-2 text-muted-foreground">
          Clone any voice you own the rights to. Clones cost premium credits to
          generate and are private to your account.
        </p>
      </div>
      <CloneStudio />
    </main>
    </AppShell>
  );
}
