import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:justify-between">
        <div>
          <p className="font-semibold">LugunaVoice</p>
          <p className="mt-1 text-sm text-muted-foreground">AI voice studio for creators</p>
        </div>
        <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm text-muted-foreground sm:grid-cols-3">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Product</p>
            <Link href="/voices" className="block hover:text-foreground">Voice library</Link>
            <Link href="/studio" className="block hover:text-foreground">Studio</Link>
            <a href="#pricing" className="block hover:text-foreground">Pricing</a>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Account</p>
            <Link href="/login" className="block hover:text-foreground">Sign in</Link>
            <Link href="/signup" className="block hover:text-foreground">Create account</Link>
            <Link href="/api-keys" className="block hover:text-foreground">API keys</Link>
            <Link href="/referrals" className="block hover:text-foreground">Referrals</Link>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Developers</p>
            <Link href="/developers" className="block hover:text-foreground">API docs</Link>
            <Link href="/api-keys" className="block hover:text-foreground">API keys</Link>
            <Link href="/openapi.json" className="block hover:text-foreground">OpenAPI spec</Link>
          </div>
        </nav>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} LugunaVoice · Free voices by Microsoft Edge TTS · Premium by Typecast · Flagship by Deepgram
      </div>
    </footer>
  );
}
