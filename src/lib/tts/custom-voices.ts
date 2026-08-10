import type { VoiceRecord } from "@/lib/tts/types";

/**
 * Custom (cloned) voices registry — in-memory, owner-scoped.
 *
 * M6 stand-in: voices + consent are stored in process memory until the
 * Supabase DB arrives (then `voices` with owner_user_id + the immutable
 * `cloned_voice_consents` table take over — same shapes, same rules).
 *
 * Typecast clone rule (research/07 pitfall ③): a `uc_` voice can only be
 * synthesized by the account's own key — so our single shared key CAN speak
 * any clone; the owner-scoping is enforced here (owner-only visibility and
 * owner-only usage in the Studio/API routes).
 */

interface CustomVoiceEntry {
  voice: VoiceRecord;
  ownerUserId: string;
  createdAt: number;
  sampleHash?: string;
}

interface ConsentRecord {
  userId: string;
  voiceId: string;
  sampleHash: string;
  attestation: string;
  language?: string;
  ip?: string;
  userAgent?: string;
  createdAt: number;
}

const customVoices = new Map<string, CustomVoiceEntry>();
const consents: ConsentRecord[] = [];
const MAX_CLONE_SLOTS = 50;

export function registerCustomVoice(
  voice: VoiceRecord,
  ownerUserId: string,
  sampleHash?: string,
): void {
  customVoices.set(voice.id, {
    voice: { ...voice, isCustom: true, ownerUserId },
    ownerUserId,
    createdAt: Date.now(),
    sampleHash,
  });
}

export function listCustomVoices(ownerUserId: string): VoiceRecord[] {
  return [...customVoices.values()]
    .filter((e) => e.ownerUserId === ownerUserId)
    .map((e) => e.voice);
}

export function getCustomVoice(id: string, ownerUserId: string): VoiceRecord | null {
  const entry = customVoices.get(id);
  if (!entry || entry.ownerUserId !== ownerUserId) return null;
  return entry.voice;
}

export function deleteCustomVoice(id: string, ownerUserId: string): boolean {
  const entry = customVoices.get(id);
  if (!entry || entry.ownerUserId !== ownerUserId) return false;
  customVoices.delete(id);
  return true;
}

export function cloneSlotsUsed(ownerUserId: string): number {
  return [...customVoices.values()].filter((e) => e.ownerUserId === ownerUserId).length;
}

export function slotsRemaining(ownerUserId: string): number {
  return Math.max(0, MAX_CLONE_SLOTS - cloneSlotsUsed(ownerUserId));
}

/** immutable consent attestation — always recorded before a clone is created */
export function recordConsent(record: Omit<ConsentRecord, "createdAt">): void {
  consents.push({ ...record, createdAt: Date.now() });
}

export function consentForVoice(voiceId: string): ConsentRecord | undefined {
  return consents.find((c) => c.voiceId === voiceId);
}
