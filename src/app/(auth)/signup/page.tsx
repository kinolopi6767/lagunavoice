"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpWithEmail, signInWithGoogle, type AuthActionState } from "@/lib/auth/actions";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
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
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>Get 2,000 free premium credits on signup</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@example.com" required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
            <Button className="w-full" type="submit" disabled={isPending}>
              {isPending ? "Creating account…" : "Sign up"}
            </Button>
          </form>

          <div className="relative my-4 text-center text-xs text-muted-foreground">
            <span className="bg-card px-2">or</span>
          </div>

          <Button variant="outline" className="w-full" type="button" onClick={onGoogle} disabled={isPending}>
            Continue with Google
          </Button>
        </CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <a href="/login" className="ml-1 font-medium text-foreground underline underline-offset-4">
            Sign in
          </a>
        </CardFooter>
      </Card>
    </main>
  );
}
