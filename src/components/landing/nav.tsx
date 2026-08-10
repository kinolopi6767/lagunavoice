import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            LV
          </span>
          <span className="font-semibold">LugunaVoice</span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-muted-foreground sm:flex">
          <Link href="/voices" className="hover:text-foreground">Voice library</Link>
          <Link href="/studio" className="hover:text-foreground">Studio</Link>
          <Link href="/developers" className="hover:text-foreground">Developers</Link>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
        </nav>

        <div className="flex items-center gap-2">
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
