/**
 * Content moderation for TTS input — OpenAI Moderation API.
 * Every text submitted for synthesis passes through here before any
 * provider call (plan: research/08 §C, build-plan security workstream).
 *
 * No-op (allow) when OPENAI_API_KEY is not configured.
 */

export type ModerationVerdict = "allow" | "block";

export interface ModerationResult {
  verdict: ModerationVerdict;
  /** which categories flagged, e.g. ["hate","harassment"] */
  flaggedCategories: string[];
  scores: Record<string, number>;
}

const MODERATION_URL = "https://api.openai.com/v1/moderations";

export async function moderateText(
  text: string,
  inputId?: string,
): Promise<ModerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return { verdict: "allow", flaggedCategories: [], scores: {} };
  }

  try {
    const res = await fetch(MODERATION_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "omni-moderation-latest",
        input: text.slice(0, 32_000),
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      // fail-open on moderation service errors (log; do not block the product)
      console.error(`[moderation] API error ${res.status}${inputId ? ` (${inputId})` : ""}`);
      return { verdict: "allow", flaggedCategories: [], scores: {} };
    }

    const data = (await res.json()) as {
      results?: Array<{ flagged: boolean; categories?: Record<string, boolean>; category_scores?: Record<string, number> }>;
    };

    const result = data.results?.[0];
    if (!result) return { verdict: "allow", flaggedCategories: [], scores: {} };

    const flaggedCategories = Object.entries(result.categories ?? {})
      .filter(([, v]) => v)
      .map(([k]) => k);

    return {
      verdict: result.flagged ? "block" : "allow",
      flaggedCategories,
      scores: result.category_scores ?? {},
    };
  } catch (err) {
    console.error("[moderation] request failed", err);
    return { verdict: "allow", flaggedCategories: [], scores: {} };
  }
}
