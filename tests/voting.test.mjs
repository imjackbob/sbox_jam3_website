import test from "node:test";
import assert from "node:assert/strict";
import { getStats, normalizeIdent, parseVoting } from "../lib/voting.mjs";
import { GET } from "../app/api/voting/route.js";

const tally = [100, 90, 80, 70, 60, 60, 10].map((votes, i) => ({
  package: `studio.game_${i}`,
  votes,
}));

test("idents are case insensitive and reject malformed input", () => {
  assert.equal(
    normalizeIdent("  Sunless.Risk_Of_Observation "),
    "sunless.risk_of_observation",
  );
  assert.equal(normalizeIdent("studio.game-name"), "studio.game-name");
  for (const value of ["", "game", "a.b.c", "<script>.a", null])
    assert.throws(() => normalizeIdent(value));
});

test("top-five target beats the cutoff rather than just tying it", () => {
  const stats = getStats(tally, "studio.game_6");
  assert.equal(stats.position, 7);
  assert.equal(stats.needed, 51);
  assert.equal(stats.target, 61);
  assert.equal(stats.totalVotes, 470);
});

test("fifth and sixth tied entries both need one vote to secure a slot", () => {
  const fifth = getStats(tally, "studio.game_4");
  const sixth = getStats(tally, "studio.game_5");
  assert.equal(fifth.position, 5);
  assert.equal(sixth.position, 6);
  assert.equal(fifth.rank, 5);
  assert.equal(sixth.rank, 5);
  assert.equal(fifth.needed, 1);
  assert.equal(sixth.needed, 1);
  assert.equal(sixth.tied, 2);
  assert.equal(sixth.toNext, 11);
});

test("a top-five entry above the boundary needs no extra votes", () => {
  assert.equal(getStats(tally, "studio.game_0").needed, 0);
  assert.equal(getStats(tally, "studio.game_0").toLead, 0);
});

test("missing entry is unranked, and an empty tally has no NaN values", () => {
  const absent = getStats(tally, "studio.missing");
  assert.equal(absent.found, false);
  assert.equal(absent.position, 0);
  assert.equal(absent.votes, 0);
  assert.equal(absent.needed, 61);
  const empty = getStats([], "studio.missing");
  assert.equal(empty.share, 0);
  assert.equal(empty.target, 1);
  assert.equal(empty.cutoff, null);
});

test("fewer than five rivals only requires a first nomination", () => {
  assert.equal(getStats(tally.slice(0, 4), "studio.new").needed, 1);
  assert.equal(getStats(tally.slice(0, 5), "studio.game_4").needed, 0);
});

test("parses all categories, supports missing tallies, preserves tie ordering", () => {
  const result = parseVoting({
    Categories: [
      { Id: 1, Title: "Empty", Tally: null },
      {
        Id: 2,
        Title: "Best Game",
        Slots: 5,
        RoundEnds: "2026-09-27T20:00:00Z",
        Tally: [
          { Package: "a.low", Votes: 1 },
          { Package: "A.First", Votes: 5 },
          { Package: "a.second", Votes: 5 },
        ],
      },
    ],
  });
  assert.deepEqual(result[0].tally, []);
  assert.equal(result[1].slots, 5);
  assert.deepEqual(
    result[1].tally.map((e) => e.package),
    ["a.first", "a.second", "a.low"],
  );
});

test("malformed upstream responses cannot silently become zero votes", () => {
  assert.throws(() => parseVoting({}));
  assert.throws(() =>
    parseVoting({
      Categories: [{ Title: "Best", Tally: [{ Package: "a.b", Votes: "10" }] }],
    }),
  );
  assert.throws(() =>
    parseVoting({
      Categories: [{ Title: "Best", Tally: [{ Package: "a.b", Votes: -2 }] }],
    }),
  );
});

test("API returns timestamped data and cache headers", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ Categories: [{ Title: "Best", Tally: [] }] }),
  );
  const response = await GET();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Cache-Control"), /s-maxage=30/);
  const result = await response.json();
  assert.equal(result.categories[0].title, "Best");
  assert.ok(Number.isFinite(Date.parse(result.fetchedAt)));
});

test("API failures return a recoverable error without success cache headers", async (t) => {
  t.mock.method(console, "error", () => {});
  for (const upstream of [
    () => new Response("", { status: 503 }),
    () => Response.json({ broken: true }),
    () => {
      throw new Error("network timeout");
    },
  ]) {
    const mock = t.mock.method(globalThis, "fetch", async () => upstream());
    const response = await GET();
    assert.equal(response.status, 502);
    assert.equal(response.headers.get("Cache-Control"), null);
    assert.match((await response.json()).error, /try again/i);
    mock.mock.restore();
  }
});
