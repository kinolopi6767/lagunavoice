import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const metadata: Metadata = {
  title: "Admin — LugunaVoice",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="mt-2 text-muted-foreground">
          Manual credits, order confirmation, abuse flags, provider kill-switches and COGS.
        </p>
      </div>
      <AdminDashboard />
    </main>
  );
}
