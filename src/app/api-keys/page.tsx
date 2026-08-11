import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { ApiKeysPanel } from "@/components/api-keys/api-keys-panel";

export const metadata: Metadata = {
  title: "API keys — LugunaVoice",
  robots: { index: false, follow: false },
};

export default function ApiKeysPage() {
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <PageHeader
          eyebrow="Developer API"
          title="API keys"
          description={
            <>
              Developer API keys for the REST API. Base URL:{" "}
              <code>https://api.lugunavoice.com/v1</code> — see the{" "}
              <a href="/developers" className="underline underline-offset-4">developer docs</a>{" "}
              for usage.
            </>
          }
        />
        <ApiKeysPanel />
      </main>
    </AppShell>
  );
}
