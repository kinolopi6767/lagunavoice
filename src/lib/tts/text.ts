/**
 * Text splitting for provider char limits.
 *
 * Code-point safe (Array.from) so surrogate pairs (emoji, some CJK) never
 * get split mid-character. Splits at sentence boundaries when possible, then
 * word boundaries, then code points — a single paragraph longer than
 * `maxChars` can never produce an oversized chunk.
 */

export function countChars(text: string): number {
  return Array.from(text).length;
}

/** hard-split one piece at word boundaries near the limit (code points last) */
function hardSplit(text: string, maxChars: number): string[] {
  const units = Array.from(text);
  if (units.length <= maxChars) return [text];

  const out: string[] = [];
  let start = 0;
  while (start < units.length) {
    let end = Math.min(start + maxChars, units.length);
    if (end < units.length) {
      // walk back to a space at least 20% into the chunk
      const minWalkBack = Math.max(start + Math.floor(maxChars * 0.2), start);
      for (let i = end; i > minWalkBack; i--) {
        if (units[i] === " ") {
          end = i + 1;
          break;
        }
      }
    }
    out.push(units.slice(start, end).join(""));
    start = end;
  }
  return out;
}

/** sentence-aware chunks, each ≤ maxChars; keeps sentence pieces intact when possible */
export function splitText(text: string, maxChars: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const boundaryRe = /(?<=[.!?;:])\s+|\s+(?=[,])|,\s+(?=and\s|but\s|or\s)/g;
  const pieces: string[] = [];
  let last = 0;
  for (const match of normalized.matchAll(boundaryRe)) {
    pieces.push(normalized.slice(last, match.index! + match[0].length));
    last = match.index! + match[0].length;
  }
  pieces.push(normalized.slice(last));

  const chunks: string[] = [];
  let buffer = "";
  for (const piece of pieces) {
    // a single piece can exceed maxChars (huge sentence/paragraph) — hard-split it
    const pieceUnits = Array.from(piece).length;
    if (pieceUnits > maxChars) {
      if (buffer.trim()) chunks.push(buffer.trim());
      buffer = "";
      chunks.push(...hardSplit(piece, maxChars));
      continue;
    }
    if (buffer && Array.from(buffer).length + pieceUnits > maxChars) {
      chunks.push(buffer.trim());
      buffer = piece;
    } else {
      buffer += piece;
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim());

  return chunks.filter((c) => countChars(c) > 0);
}
