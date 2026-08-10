"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithEmail, signInWithGoogle, type AuthActionState } from "@/lib/auth/actions";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const state: AuthActionState = await signInWithEmail({}, formData);
      if (state.error) setError(state.error);
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
      <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in to your LugunaVoice account</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="you@example.com" required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" required autoComplete="current-password" />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button className="w-full" type="submit" disabled={isPending}>
                {isPending ? "Signing in…" : "Sign in"}
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
          </CardContent>
          <CardFooter className="justify-center text-sm text-muted-foreground">
            New here?{" "}
            <a href="/signup" className="ml-1 font-medium text-foreground underline underline-offset-4">
              Create an account
            </a>
          </CardFooter>
        </Card>
      </div>
    </main>
    </AppShell>
  );
}
