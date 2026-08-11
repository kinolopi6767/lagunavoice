"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CreditsChip } from "@/components/app/credits-chip";
import { LogoMark } from "@/components/app/logo-mark";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/studio", label: "Studio" },
  { href: "/voices", label: "Voices" },
  { href: "/voice-cloning", label: "Cloning" },
  { href: "/api-keys", label: "API keys" },
  { href: "/developers", label: "Developers" },
  { href: "/referrals", label: "Referrals" },
  { href: "/billing", label: "Credits" },
];

/**
 * Shared navigation for the app pages (studio, voices, keys, referrals,
 * docs, cloning, admin, test playground). The landing page keeps its own
 * marketing nav; this shell gives the product area a consistent way to
 * get around instead of relying on the browser back button.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-grad-a to-transparent" />
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex h-14 w-full items-center justify-between gap-2 px-4 sm:px-6">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2"
              aria-label="LugunaVoice home"
            >
              <LogoMark />
              <span className="hidden font-semibold sm:inline">LugunaVoice</span>
            </Link>

            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle />
              <CreditsChip />
              <Button variant="outline" size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button size="sm" className="hidden sm:inline-flex" asChild>
                <Link href="/signup">Sign up</Link>
              </Button>
            </div>
          </div>

          <nav className="flex items-center gap-0.5 overflow-x-auto px-4 pb-2 text-sm text-muted-foreground sm:px-6 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "shrink-0 rounded-md px-2 py-1 whitespace-nowrap hover:bg-muted hover:text-foreground",
                  isActive(l.href) && "bg-primary/10 font-medium text-primary",
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <nav className="hidden items-center gap-0.5 text-sm text-muted-foreground md:flex md:overflow-x-auto md:px-6 md:pb-2 [scrollbar-width:none] md:[&::-webkit-scrollbar]:hidden">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "shrink-0 rounded-md px-2 py-1 whitespace-nowrap transition-colors hover:bg-muted hover:text-foreground",
                  isActive(l.href) &&
                    "bg-gradient-to-br from-grad-a to-grad-b font-medium text-white shadow-xs shadow-grad-b/25",
                )}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
