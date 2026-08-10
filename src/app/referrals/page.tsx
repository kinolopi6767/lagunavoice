import type { Metadata } from "next";
import { ReferralsPanel } from "@/components/referrals/referrals-panel";

export const metadata: Metadata = {
  title: "Referrals — LugunaVoice",
};

export default function ReferralsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Referrals</h1>
        <p className="mt-2 text-muted-foreground">Invite friends, earn 2,500 credits each.</p>
      </div>
      <ReferralsPanel />
    </main>
  );
}
