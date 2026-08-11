"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { LogoMark } from "@/components/app/logo-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpWithEmail, signInWithGoogle, type AuthActionState } from "@/lib/auth/actions";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [referral, setReferral] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("ref") ?? "";
  });
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    if (referral.trim()) formData.set("referral", referral.trim());
    startTransition(async () => {
      const state: AuthActionState = await signUpWithEmail({}, formData);
      if (state.error) {
        setError(state.error);
      } else {
        setError(null);
        setMessage("Check your inbox to confirm your email, then sign in.");
      }
    });
  }

  function onGoogle() {
    startTransition(async () => {
      const state = await signInWithGoogle();
      if (state.url) {
        router.push(state.url);
      } else if (state.error) {
        setError(state.error);
      }
    });
  }

  return (
    <AppShell>
      <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_50%_45%_at_50%_0%,black,transparent)]" />
          <div className="absolute -top-24 left-1/2 h-64 w-[30rem] -translate-x-1/2 rounded-full bg-grad-a/15 blur-3xl" />
          <div className="absolute -bottom-24 right-0 h-56 w-56 rounded-full bg-grad-b/15 blur-3xl" />
        </div>

        <div className="relative w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <LogoMark className="size-12 rounded-xl" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Create your <span className="text-gradient">account</span>
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Get 2,000 free premium credits on signup
              </p>
            </div>
          </div>

          <Card className="rounded-2xl border-primary/10 shadow-lg shadow-grad-b/5">
            <CardHeader className="px-6 pt-6 pb-2">
              <CardTitle className="text-lg">Sign up</CardTitle>
              <CardDescription>
                One account for the studio, voice library and developer API.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <form action={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" placeholder="you@example.com" required autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="referral">Referral code (optional)</Label>
                  <Input
                    id="referral"
                    name="referral"
                    value={referral}
                    onChange={(e) => setReferral(e.target.value)}
                    placeholder="e.g. alex-8f2k"
                    autoCapitalize="none"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    You and your friend each earn 2,500 credits when it&apos;s claimed.
                  </p>
                </div>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                {message ? <p className="text-sm text-primary">{message}</p> : null}
                <Button className="w-full" type="submit" disabled={isPending}>
                  {isPending ? "Creating account…" : "Sign up"}
                </Button>
              </form>

              <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <span>or</span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <Button variant="outline" className="w-full" type="button" onClick={onGoogle} disabled={isPending}>
                Continue with Google
              </Button>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <a href="/login" className="font-medium text-primary underline underline-offset-4">
                  Sign in
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </AppShell>
  );
}
