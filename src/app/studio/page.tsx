import type { Metadata } from "next";
import { StudioGenerator } from "@/components/studio/studio-generator";

export const metadata: Metadata = {
  title: "Studio — LugunaVoice",
  description:
    "Turn scripts into voiceovers. Free AI voices today; premium, flagship, long-form and cloning arriving with credits.",
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
      <StudioGenerator />
    </main>
  );
}
