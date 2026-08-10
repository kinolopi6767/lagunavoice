import type { Metadata } from "next";
import { VoiceLibrary } from "@/components/voice-library/voice-library";

export const metadata: Metadata = {
  title: "Voice library — LugunaVoice",
  description:
    "Browse 500+ free AI voices and hundreds of premium and flagship voices. Search, filter, audition previews and find your sound.",
};

export default function VoiceLibraryPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Voice library</h1>
        <p className="mt-2 text-muted-foreground">
          Free Edge TTS voices today. Premium (Typecast) and flagship (Deepgram)
          voices unlock with credits.
        </p>
      </div>
      <VoiceLibrary />
    </main>
  );
}
