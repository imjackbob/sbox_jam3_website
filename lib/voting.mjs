export const VOTING_URL = "https://public.facepunch.com/sbox/jam/three/voting";

export function normalizeIdent(value) {
  const ident = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[a-z0-9_-]+\.[a-z0-9_-]+$/.test(ident) || ident.length > 200) {
    throw new Error(
      "Enter a package ident in the format organization.game_name.",
    );
  }
  return ident;
}

export function parseVoting(raw) {
  if (!raw || !Array.isArray(raw.Categories))
    throw new Error("Unexpected voting response.");
  return raw.Categories.map((category, index) => {
    if (
      !category ||
      typeof category.Title !== "string" ||
      (category.Tally != null && !Array.isArray(category.Tally))
    )
      throw new Error("Unexpected category response.");
    const tally = (category.Tally ?? []).map((entry) => {
      if (
        !entry ||
        typeof entry.Package !== "string" ||
        !Number.isSafeInteger(entry.Votes) ||
        entry.Votes < 0
      )
        throw new Error("Unexpected tally response.");
      return { package: normalizeIdent(entry.Package), votes: entry.Votes };
    });
    // Stable sort preserves the API's order within a tie.
    tally.sort((a, b) => b.votes - a.votes);
    return {
      id: String(category.Id ?? index),
      title: category.Title,
      slots:
        Number.isSafeInteger(category.Slots) && category.Slots > 0
          ? category.Slots
          : null,
      round: Number.isSafeInteger(category.Round) ? category.Round : null,
      roundEnds:
        typeof category.RoundEnds === "string" &&
        Number.isFinite(Date.parse(category.RoundEnds))
          ? category.RoundEnds
          : null,
      tally,
    };
  });
}

export function getStats(tally, ident) {
  const position = tally.findIndex((entry) => entry.package === ident);
  const found = position >= 0;
  const votes = found ? tally[position].votes : 0;
  const totalVotes = tally.reduce((sum, entry) => sum + entry.votes, 0);
  const others = tally.filter((entry) => entry.package !== ident);
  // Beat the fifth rival, so a boundary tie never promises a top-five slot.
  const target = others.length >= 5 ? others[4].votes + 1 : 1;
  const higher = tally.filter((entry) => entry.votes > votes);
  return {
    found,
    votes,
    position: found ? position + 1 : 0,
    rank: found ? higher.length + 1 : 0,
    tied: found ? tally.filter((entry) => entry.votes === votes).length : 0,
    totalVotes,
    entries: tally.length,
    share: totalVotes ? (votes / totalVotes) * 100 : 0,
    target,
    needed: Math.max(0, target - votes),
    toNext: higher.length ? higher[higher.length - 1].votes + 1 - votes : 0,
    toLead: others.length
      ? Math.max(0, others[0].votes + 1 - votes)
      : votes
        ? 0
        : 1,
    cutoff: tally[4]?.votes ?? null,
  };
}
