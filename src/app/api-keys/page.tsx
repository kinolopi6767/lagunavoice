import type { Metadata } from "next";
import { ApiKeysPanel } from "@/components/api-keys/api-keys-panel";

export const metadata: Metadata = {
  title: "API keys — LugunaVoice",
  robots: { index: false, follow: false },
};

export default function ApiKeysPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">API keys</h1>
        <p className="mt-2 text-muted-foreground">
          Developer API keys for the REST API. Base URL: <code>https://api.lugunavoice.com/v1</code>
        </p>
      </div>
      <ApiKeysPanel />
    </main>
  );
}
