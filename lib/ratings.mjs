import { normalizeIdent } from "./voting.mjs";

export function parseRatings(raw, ident) {
  if (
    !raw?.Org?.Ident ||
    !raw.Ident ||
    normalizeIdent(`${raw.Org.Ident}.${raw.Ident}`) !== ident
  ) {
    throw new Error("Unexpected package response.");
  }
  // Facepunch omits default-valued integer fields from its JSON responses.
  function count(value) {
    if (value === undefined) return 0;
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error("Unexpected rating count.");
    return value;
  }
  const thumbsUp = count(raw.VotesUp);
  const thumbsDown = count(raw.VotesDown);
  let reviews = null;
  if (raw.ReviewStats != null) {
    if (typeof raw.ReviewStats !== "object" || Array.isArray(raw.ReviewStats))
      throw new Error("Unexpected review response.");
    const positive = count(raw.ReviewStats.p);
    const negative = count(raw.ReviewStats.n);
    const potential = count(raw.ReviewStats.o);
    const total = positive + negative + potential;
    reviews = {
      positive,
      negative,
      potential,
      total,
      score: total ? (positive * 100 + potential * 50) / total : null,
      positivePercent: total ? (positive / total) * 100 : null,
      negativePercent: total ? (negative / total) * 100 : null,
      potentialPercent: total ? (potential / total) * 100 : null,
    };
  }
  return { ident, thumbsUp, thumbsDown, reviews };
}
