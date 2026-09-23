import test from "node:test";
import assert from "node:assert/strict";
import { parseRatings } from "../lib/ratings.mjs";
import { GET } from "../app/api/ratings/route.js";

const packageData = {
  Org: { Ident: "test" },
  Ident: "game",
  VotesUp: 104,
  VotesDown: 34,
  ReviewStats: { p: 35, n: 4, o: 6 },
};
const request = () =>
  new Request("http://localhost/api/ratings?ident=test.game");

test("review score matches Facepunch weighting and stays separate from thumbs", () => {
  const result = parseRatings(packageData, "test.game");
  assert.equal(result.thumbsUp, 104);
  assert.equal(result.thumbsDown, 34);
  assert.equal(result.reviews.total, 45);
  assert.equal(result.reviews.score, 3800 / 45);
  assert.equal(result.reviews.positivePercent, (35 / 45) * 100);
});

test("omitted zero counts, no reviews, and missing review data are distinct", () => {
  const base = { Org: { Ident: "test" }, Ident: "game" };
  assert.equal(parseRatings(base, "test.game").reviews, null);
  const empty = parseRatings({ ...base, ReviewStats: {} }, "test.game");
  assert.equal(empty.thumbsDown, 0);
  assert.equal(empty.reviews.total, 0);
  assert.equal(empty.reviews.score, null);
  assert.equal(
    parseRatings({ ...base, ReviewStats: { p: 1 } }, "test.game").reviews.score,
    100,
  );
  assert.equal(
    parseRatings({ ...base, ReviewStats: { o: 1 } }, "test.game").reviews.score,
    50,
  );
});

test("rejects malformed counts and mismatched package data", () => {
  assert.throws(() => parseRatings(packageData, "wrong.game"));
  assert.throws(() =>
    parseRatings({ ...packageData, VotesUp: -1 }, "test.game"),
  );
  assert.throws(() =>
    parseRatings({ ...packageData, ReviewStats: { p: "5" } }, "test.game"),
  );
});

test("ratings route validates input before making requests", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", () => {
    throw new Error("Should not fetch");
  });
  const response = await GET(
    new Request("http://localhost/api/ratings?ident=invalid"),
  );
  assert.equal(response.status, 400);
  assert.equal(fetch.mock.callCount(), 0);
});

test("ratings route returns normalized data with a timestamp", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json(packageData));
  const response = await GET(request());
  assert.equal(response.status, 200);
  assert.equal((await response.json()).reviews.total, 45);
});

test("missing packages and network errors do not display fake zero ratings", async (t) => {
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("", { status: 404 }),
  );
  assert.equal((await GET(request())).status, 404);
  fetch.mock.restore();
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Timeout");
  });
  const response = await GET(request());
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /unavailable/);
});
