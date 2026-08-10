"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AuthActionState {
  error?: string;
  ok?: boolean;
}

/** Email + password sign in */
export async function signInWithEmail(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const supabase = await createClient();
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
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });
  if (error) {
    return { error: error.message };
  }

  return { ok: true };
}

/** Google OAuth — returns the provider redirect URL */
export async function signInWithGoogle(): Promise<AuthActionState & { url?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });
  if (error || !data.url) {
    return { error: error?.message ?? "Could not start Google sign-in." };
  }
  return { ok: true, url: data.url };
}

/** Sign out */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
