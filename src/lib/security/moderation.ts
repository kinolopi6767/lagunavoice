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

/** modapi input limit is 32k chars per call — scan long texts in chunks */
const CHUNK_CHARS = 32_000;

export async function moderateText(
  text: string,
  inputId?: string,
): Promise<ModerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return { verdict: "allow", flaggedCategories: [], scores: {} };
  }

  try {
    const chunks = [];
    for (let i = 0; i < text.length; i += CHUNK_CHARS) {
      chunks.push(text.slice(i, i + CHUNK_CHARS));
    }

    for (let i = 0; i < chunks.length; i++) {
      const res = await fetch(MODERATION_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "omni-moderation-latest",
          input: chunks[i],
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

      if (result.flagged) {
        const flaggedCategories = Object.entries(result.categories ?? {})
          .filter(([, v]) => v)
          .map(([k]) => k);
        return { verdict: "block", flaggedCategories, scores: result.category_scores ?? {} };
      }
    }

    return { verdict: "allow", flaggedCategories: [], scores: {} };
  } catch (err) {
    console.error("[moderation] request failed", err);
    return { verdict: "allow", flaggedCategories: [], scores: {} };
  }
}
