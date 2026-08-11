import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { BillingDashboard } from "@/components/billing/billing-dashboard";

export const metadata: Metadata = {
  title: "Credits & billing — LugunaVoice",
  description:
    "Your credit balance, top-up packs, order history and ledger activity. Premium voices cost 1 credit per character, flagship 2.",
};

export default function BillingPage() {
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Credits &amp; billing</h1>
          <p className="mt-2 text-muted-foreground">
            Packs never expire. Premium voices use 1 credit per character, flagship voices 2 —
            failed generations are refunded automatically.
          </p>
        </div>
        <BillingDashboard />
      </main>
    </AppShell>
  );
}
