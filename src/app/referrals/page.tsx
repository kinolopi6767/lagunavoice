import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { PageHeader } from "@/components/app/page-header";
import { ReferralsPanel } from "@/components/referrals/referrals-panel";

export const metadata: Metadata = {
  title: "Referrals — LugunaVoice",
};

export default function ReferralsPage() {
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <PageHeader
          eyebrow="Referral program"
          title="Referrals"
          description="Share your code, earn 2,500 bonus credits for every friend who claims it."
        />
        <ReferralsPanel />
      </main>
    </AppShell>
  );
}
