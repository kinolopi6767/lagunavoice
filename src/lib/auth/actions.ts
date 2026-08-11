"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createThrottle } from "@/lib/rate-limit/throttle";
import { claimReferral, registerReferralCode } from "@/lib/referrals/store";

export interface AuthActionState {
  error?: string;
  ok?: boolean;
}

/**
 * All actions degrade gracefully when Supabase is not configured:
 * they return a friendly error instead of crashing the form.
 */

/** brute-force / signup-spam throttle per IP */
const authThrottle = createThrottle({ max: 8, windowMs: 15 * 60 * 1_000 });
const signupThrottle = createThrottle({ max: 4, windowMs: 15 * 60 * 1_000 });

async function callerIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",").pop()?.trim() ?? "unknown";
}

function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (url) return url.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL must be set in production (auth redirects would point at localhost).");
  }
  return "http://localhost:3000";
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

  const ip = await callerIp();
  if (!authThrottle.check(ip).allowed) {
    return { error: "Too many attempts. Try again in a few minutes." };
  }

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

  const ip = await callerIp();
  if (!signupThrottle.check(ip).allowed) {
    return { error: "Too many sign-ups from this network. Try again later." };
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
    const { grantSignupBonus, grantReferralBonus } = await import("@/lib/credits/ledger");
    try {
      await grantSignupBonus(userId);
    } catch (err) {
      console.error("[auth] signup bonus failed", err);
    }
    const slug = email.split("@")[0]?.replace(/[^a-z0-9]+/gi, "").slice(0, 12) || "user";
    registerReferralCode(`${slug}-${userId.slice(0, 4)}`, userId);

    // optional referral claim from the signup form (?ref= or the input)
    const ref = String(formData.get("referral") ?? "").trim();
    if (ref) {
      const claim = claimReferral(ref, userId);
      if (claim.status === "claimed") {
        try {
          await grantReferralBonus(userId, claim.referrerId);
        } catch (err) {
          console.error("[auth] referral bonus failed", err);
        }
      }
    }
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
  const ip = await callerIp();
  if (!authThrottle.check(ip).allowed) {
    return { error: "Too many attempts. Try again in a few minutes." };
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