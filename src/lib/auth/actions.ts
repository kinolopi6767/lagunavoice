"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { registerReferralCode } from "@/lib/referrals/store";

export interface AuthActionState {
  error?: string;
  ok?: boolean;
}

/**
 * All actions degrade gracefully when Supabase is not configured:
 * they return a friendly error instead of crashing the form.
 */

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

/** Email + password sign in */
export async function signInWithEmail(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Authentication is not configured yet — try on the deployed app or use the local test playground." };
  }
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message === "Invalid login credentials" ? "Wrong email or password." : error.message };
  }

  revalidatePath("/", "layout");
  redirect("/studio");
}

/** Email + password sign up (profile row is created by the DB trigger) */
export async function signUpWithEmail(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Sign-up is not configured yet — try on the deployed app or use the local test playground." };
  }
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appUrl()}/auth/callback`,
    },
  });
  if (error) {
    return { error: error.message };
  }

  // wire the signup bonus + personal referral code (safe in memory/DB modes)
  if (data.user) {
    const userId = data.user.id;
    const { grantSignupBonus } = await import("@/lib/credits/ledger");
    try {
      await grantSignupBonus(userId);
    } catch (err) {
      console.error("[auth] signup bonus failed", err);
    }
    const slug = email.split("@")[0]?.replace(/[^a-z0-9]+/gi, "").slice(0, 12) || "user";
    registerReferralCode(`${slug}-${userId.slice(0, 4)}`, userId);
  }

  return { ok: true };
}

/** Google OAuth — returns the provider redirect URL */
export async function signInWithGoogle(): Promise<AuthActionState & { url?: string }> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { error: "Google sign-in is not configured yet — try on the deployed app or use the local test playground." };
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${appUrl()}/auth/callback`,
    },
  });
  if (error || !data.url) {
    return { error: error?.message ?? "Could not start Google sign-in." };
  }
  return { ok: true, url: data.url };
}

/** Sign out */
export async function signOut(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // not signed in — nothing to do
  }
  revalidatePath("/", "layout");
  redirect("/");
}