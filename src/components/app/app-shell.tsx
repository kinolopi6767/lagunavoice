import Link from "next/link";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/studio", label: "Studio" },
  { href: "/voices", label: "Voices" },
  { href: "/voice-cloning", label: "Cloning" },
  { href: "/api-keys", label: "API keys" },
  { href: "/developers", label: "Developers" },
  { href: "/referrals", label: "Referrals" },
];

/**
 * Shared navigation for the app pages (studio, voices, keys, referrals,
 * docs, cloning, admin, test playground). The landing page keeps its own
 * marketing nav; this shell gives the product area a consistent way to
 * get around instead of relying on the browser back button.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex h-14 w-full items-center justify-between gap-2 px-4 sm:px-6">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2"
              aria-label="LugunaVoice home"
            >
              <span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                LV
              </span>
              <span className="hidden font-semibold sm:inline">LugunaVoice</span>
            </Link>

            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/signup">Sign up</Link>
              </Button>
            </div>
          </div>

          <nav className="flex items-center gap-0.5 overflow-x-auto px-4 pb-2 text-sm text-muted-foreground sm:px-6 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="shrink-0 rounded-md px-2 py-1 whitespace-nowrap hover:bg-muted hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <nav className="hidden items-center gap-0.5 text-sm text-muted-foreground md:flex md:px-6 md:pb-2">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="shrink-0 rounded-md px-2 py-1 whitespace-nowrap hover:bg-muted hover:text-foreground"
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