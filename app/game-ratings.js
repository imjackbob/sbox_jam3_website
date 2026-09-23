"use client";

import { useEffect, useState } from "react";

const count = (value) => value.toLocaleString("en-US");
const percent = (value) => `${value.toFixed(1)}%`;

export default function GameRatings({ ident, refreshKey }) {
  const [state, setState] = useState({ loading: true });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true });
    async function load() {
      try {
        const response = await fetch(
          `/api/ratings?ident=${encodeURIComponent(ident)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Unable to load ratings.");
        if (!controller.signal.aborted) setState({ data });
      } catch (error) {
        if (!controller.signal.aborted) setState({ error: error.message });
      }
    }
    load();
    return () => controller.abort();
  }, [ident, refreshKey, retry]);

  const data = state.data;
  const reviews = data?.reviews;
  return (
    <section
      className="ratings-panel"
      aria-label="Game ratings"
      aria-live="polite"
      aria-busy={!!state.loading}
    >
      <div className="ratings-heading">
        <div>
          <span className="eyebrow">PLAYER FEEDBACK</span>
          <h2>Game ratings</h2>
        </div>
        <a
          className="text-link"
          href={`https://sbox.game/${ident.split(".").join("/")}/reviews`}
          target="_blank"
          rel="noreferrer"
        >
          Read reviews ↗
        </a>
      </div>
      <p className="ratings-context">
        {ident} · Overall game feedback, separate from jam nominations.
      </p>
      {state.loading && (
        <p role="status" className="ratings-context">
          Loading game ratings…
        </p>
      )}
      {state.error && (
        <div className="error-banner" role="alert">
          <span>{state.error}</span>
          <button onClick={() => setRetry((value) => value + 1)}>
            Retry ratings
          </button>
        </div>
      )}
      {data && (
        <>
          <div className="ratings-grid">
            <article className="stat-card">
              <span>
                <span aria-hidden="true">👍</span> Thumbs up
              </span>
              <strong>{count(data.thumbsUp)}</strong>
              <p>Positive package votes</p>
            </article>
            <article className="stat-card">
              <span>
                <span aria-hidden="true">👎</span> Thumbs down
              </span>
              <strong>{count(data.thumbsDown)}</strong>
              <p>Negative package votes</p>
            </article>
            <article className="stat-card">
              <span>Review score</span>
              <strong>
                {reviews?.score != null ? percent(reviews.score) : "—"}
              </strong>
              <p>
                {reviews
                  ? reviews.total
                    ? `From ${count(reviews.total)} ${reviews.total === 1 ? 'review' : 'reviews'}`
                    : "No reviews yet"
                  : "Review data not provided"}
              </p>
            </article>
          </div>
          {!!reviews?.total && (
            <div className="review-breakdown">
              <span>
                Positive{" "}
                <strong>
                  {count(reviews.positive)} · {percent(reviews.positivePercent)}
                </strong>
              </span>
              <span>
                Has potential{" "}
                <strong>
                  {count(reviews.potential)} ·{" "}
                  {percent(reviews.potentialPercent)}
                </strong>
              </span>
              <span>
                Negative{" "}
                <strong>
                  {count(reviews.negative)} · {percent(reviews.negativePercent)}
                </strong>
              </span>
            </div>
          )}
          <p className="ratings-context ratings-note">
            The s&box review score counts positive reviews as 100%, “has
            potential” as 50%, and negative as 0%. Thumbs-up/down totals are a
            separate voting system.
          </p>
        </>
      )}
    </section>
  );
}
