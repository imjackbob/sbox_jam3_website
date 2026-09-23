import { normalizeIdent } from "../../../lib/voting.mjs";
import { parseRatings } from "../../../lib/ratings.mjs";

export const dynamic = "force-dynamic";

export async function GET(request) {
  let ident;
  try {
    ident = normalizeIdent(new URL(request.url).searchParams.get("ident"));
  } catch {
    return Response.json(
      { error: "Enter a valid package ident." },
      { status: 400 },
    );
  }
  try {
    const response = await fetch(
      `https://public.facepunch.com/sbox/package/get/2/${encodeURIComponent(ident)}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
        headers: { Accept: "application/json" },
      },
    );
    if (response.status === 404)
      return Response.json(
        { error: "This game’s ratings could not be found." },
        { status: 404 },
      );
    if (!response.ok)
      throw new Error(`Package API returned ${response.status}`);
    return Response.json(
      {
        ...parseRatings(await response.json(), ident),
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "Game ratings are unavailable right now. Please try again." },
      { status: 502 },
    );
  }
}
