import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const metadata: Metadata = {
  title: "Admin — LugunaVoice",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <AdminDashboard />
      </main>
    </AppShell>
  );
}
