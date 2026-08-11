import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/app/logo-mark";

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <LogoMark />
          <span className="hidden font-semibold sm:inline">LugunaVoice</span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
          <Link href="/voices" className="transition-colors hover:text-foreground">Voice library</Link>
          <Link href="/studio" className="transition-colors hover:text-foreground">Studio</Link>
          <Link href="/developers" className="transition-colors hover:text-foreground">Developers</Link>
          <a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a>
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="hidden text-muted-foreground lg:inline-flex">
            <Link href="/test">Test locally</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/signup">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
