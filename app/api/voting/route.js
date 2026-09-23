import { parseVoting, VOTING_URL } from "../../../lib/voting.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const upstream = await fetch(VOTING_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
      headers: { Accept: "application/json" },
    });
    if (!upstream.ok) throw new Error(`Voting API returned ${upstream.status}`);
    const categories = parseVoting(await upstream.json());
    return Response.json(
      { categories, fetchedAt: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30",
        },
      },
    );
  } catch (error) {
    console.error("Voting fetch failed:", error.message);
    return Response.json(
      {
        error:
          "The voting service is unavailable right now. Please try again shortly.",
      },
      { status: 502 },
    );
  }
}
