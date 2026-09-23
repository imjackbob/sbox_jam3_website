"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getStats, normalizeIdent } from "../lib/voting.mjs";

const EXAMPLE = "sunless.risk_of_observation";
const number = (value) => value.toLocaleString("en-US");
const gameName = (ident) =>
  ident.split(".")[1]?.replace(/[_-]+/g, " ") || ident;
const gameUrl = (ident) =>
  `https://sbox.game/${ident.split(".").map(encodeURIComponent).join("/")}`;

function Icon({ name, ...props }) {
  const paths = {
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" />
      </>
    ),
    trophy: (
      <>
        <path d="M8 3h8v6a4 4 0 0 1-8 0V3ZM12 13v6M8 21h8M8 5H4v3a4 4 0 0 0 4 4M16 5h4v3a4 4 0 0 1-4 4" />
      </>
    ),
    external: (
      <>
        <path d="M14 4h6v6M20 4l-9 9M10 4H4v16h16v-6" />
      </>
    ),
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

export default function Home() {
  const [input, setInput] = useState("");
  const [ident, setIdent] = useState("");
  const [data, setData] = useState(null);
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inputError, setInputError] = useState("");
  const [allEntries, setAllEntries] = useState(false);
  const request = useRef(null);

  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/voting", {
        signal: controller.signal,
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || "Unable to load nominations.");
      setData(result);
    } catch (err) {
      if (err.name !== "AbortError")
        setError(err.message || "Unable to connect. Please try again.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    return () => request.current?.abort();
  }, [refresh]);

  const lookup = useCallback((value) => {
    const normalized = normalizeIdent(value);
    setInput(normalized);
    setIdent(normalized);
    setInputError("");
    return normalized;
  }, []);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: "look_up_jam_game",
            title: "Look up a jam game",
            description:
              "Select a package ident in the nomination tracker and return its current statistics.",
            inputSchema: {
              type: "object",
              properties: { ident: { type: "string" } },
              required: ["ident"],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: true },
            async execute(value) {
              if (!data) throw new Error("Voting data is not loaded yet.");
              const normalized = lookup(value?.ident);
              const selected =
                data.categories.find((c) => c.id === categoryId) ||
                data.categories.find((c) => c.tally.length) ||
                data.categories[0];
              if (!selected) throw new Error("No voting categories available.");
              await new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              );
              return {
                ident: normalized,
                category: selected.title,
                ...getStats(selected.tally, normalized),
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* Optional enhancement; the visible form works without WebMCP. */
    }
    return () => lifecycle.abort();
  }, [data, categoryId, lookup]);

  const category =
    data?.categories.find((c) => c.id === categoryId) ||
    data?.categories.find((c) => c.tally.length) ||
    data?.categories[0];
  const tally = category?.tally ?? [];
  const stats = ident && category ? getStats(tally, ident) : null;
  const total = tally.reduce((sum, entry) => sum + entry.votes, 0);
  const shown = allEntries ? tally : tally.slice(0, 10);
  const closed =
    category?.roundEnds &&
    data &&
    Date.parse(category.roundEnds) <= Date.parse(data.fetchedAt);

  function submit(event) {
    event.preventDefault();
    try {
      lookup(input);
      if (!data && !loading) refresh();
    } catch (err) {
      setInputError(err.message);
    }
  }

  function row(entry, index) {
    const selected = entry.package === ident;
    return (
      <tr key={entry.package} className={selected ? "selected-row" : ""}>
        <td>
          <span className={`place ${index < 5 ? "top-place" : ""}`}>
            {String(index + 1).padStart(2, "0")}
          </span>
        </td>
        <td>
          <button className="game-button" onClick={() => lookup(entry.package)}>
            <span className="game-avatar" aria-hidden="true">
              {entry.package.split(".")[1].slice(0, 2).toUpperCase()}
            </span>
            <span className="game-label">
              <strong>{gameName(entry.package)}</strong>
              <span>{entry.package}</span>
            </span>
            {selected && <span className="you-tag">Selected</span>}
          </button>
        </td>
        <td className="vote-cell">
          <span className="vote-bar" aria-hidden="true">
            <span
              style={{
                width: `${tally[0]?.votes ? (entry.votes / tally[0].votes) * 100 : 0}%`,
              }}
            />
          </span>
          <strong>{number(entry.votes)}</strong>
        </td>
        <td className="share-cell">
          {total ? ((entry.votes / total) * 100).toFixed(1) : "0.0"}%
        </td>
      </tr>
    );
  }

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="/" aria-label="Jam III home">
            <span className="brand-mark">III</span>
            <span>
              jam<span className="muted">tracker</span>
            </span>
          </a>
          <nav aria-label="Main navigation">
            <a className="active" href="#main">
              Game Jam III
            </a>
            <a href="https://sbox.game" target="_blank" rel="noreferrer">
              s&box <Icon name="external" width="15" height="15" />
            </a>
          </nav>
          <span className="unofficial">Community tool</span>
        </div>
      </header>

      <main id="main" className="container">
        <section className="intro">
          <div>
            <div className="eyebrow">
              <span className="tiny-mark">III</span> S&BOX GAME JAM
            </div>
            <h1>
              Every nomination<span> counts.</span>
            </h1>
            <p>
              Find your game. Check your place. See how close you are to the top
              five.
            </p>
          </div>
          <span className="edition" aria-hidden="true">
            03<span>ONE MORE ROUND</span>
          </span>
        </section>

        <section className="lookup-panel" aria-label="Game lookup">
          <form onSubmit={submit} noValidate>
            <label htmlFor="ident">Your game’s package ident</label>
            <div className="search-row">
              <div className="input-wrap">
                <Icon name="search" />
                <input
                  id="ident"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="organization.game_name"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  maxLength={200}
                  aria-invalid={!!inputError}
                  aria-describedby={inputError ? "input-error" : "input-help"}
                />
              </div>
              <button className="primary" type="submit">
                Find my game <Icon name="arrow" />
              </button>
            </div>
            {inputError ? (
              <p className="form-error" role="alert" id="input-error">
                {inputError}
              </p>
            ) : (
              <p id="input-help" className="input-help">
                Try it with{" "}
                <button type="button" onClick={() => lookup(EXAMPLE)}>
                  {EXAMPLE}
                </button>
              </p>
            )}
          </form>
        </section>

        <div className="data-toolbar">
          <div className="category-control">
            {data?.categories.length > 1 ? (
              <>
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  value={category?.id || ""}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setAllEntries(false);
                  }}
                >
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <Icon name="trophy" />
                <strong>{category?.title || "Nominations"}</strong>
              </>
            )}
            <span className="badge">
              {closed ? "Round ended" : "Nomination tally"}
            </span>
          </div>
          <div className="refresh-area">
            <span>
              {loading
                ? "Fetching nominations…"
                : data
                  ? `Updated ${new Date(data.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : "Not connected"}
            </span>
            <button
              className="icon-button"
              onClick={refresh}
              disabled={loading}
              aria-label="Refresh nominations"
            >
              <Icon name="refresh" className={loading ? "spinning" : ""} />
            </button>
          </div>
        </div>

        {error && (
          <div className="error-banner" role="alert">
            <span>
              {error} {data && "Showing the last successful snapshot."}
            </span>
            <button onClick={refresh} disabled={loading}>
              Try again
            </button>
          </div>
        )}
        {!data && (
          <section className="empty-state" role="status">
            <Icon
              name={loading ? "refresh" : "trophy"}
              width="32"
              height="32"
            />
            <h2>
              {loading
                ? "Loading the nomination board"
                : "The board couldn’t be loaded"}
            </h2>
            <p>
              {loading
                ? "Getting the latest tally from Facepunch."
                : "Use refresh to reconnect to the voting service."}
            </p>
          </section>
        )}
        {data && !category && (
          <section className="empty-state">
            <h2>No categories yet</h2>
            <p>The API hasn’t published a voting category. Check back soon.</p>
          </section>
        )}

        {stats && (
          <section
            className="result"
            aria-label="Your game statistics"
            aria-live="polite"
          >
            <div className="result-heading">
              <div>
                <span className="eyebrow">YOUR GAME</span>
                <h2>{gameName(ident)}</h2>
                <p className="mono">{ident}</p>
              </div>
              <a
                className="text-link"
                href={gameUrl(ident)}
                target="_blank"
                rel="noreferrer"
              >
                View on s&box <Icon name="external" width="16" height="16" />
              </a>
            </div>
            {!stats.found && (
              <p className="notice">
                This ident isn’t in the published tally. It may have no
                nominations, be outside this category, or be incorrect. The API
                can’t confirm which.
              </p>
            )}
            <div className="stat-grid">
              <article className="stat-card">
                <span>Current position</span>
                <strong>
                  {stats.position ? (
                    <>
                      <small>#</small>
                      {number(stats.position)}
                    </>
                  ) : (
                    "—"
                  )}
                </strong>
                <p>
                  {stats.found
                    ? `of ${number(stats.entries)} listed entries`
                    : "Not ranked in this tally"}
                </p>
              </article>
              <article className="stat-card">
                <span>Nominations</span>
                <strong>{number(stats.votes)}</strong>
                <p>{stats.share.toFixed(2)}% of category votes</p>
              </article>
              <article className="stat-card accent">
                <span>Votes to reach top 5</span>
                <strong>
                  {number(stats.needed)}
                  <Icon name="arrow" width="28" height="28" />
                </strong>
                <p>
                  {stats.needed === 0
                    ? "Above the current top-five threshold"
                    : "More to beat the fifth-highest rival"}
                </p>
              </article>
              <article className="stat-card">
                <span>Votes to take the lead</span>
                <strong>{number(stats.toLead)}</strong>
                <p>
                  {stats.toLead === 0
                    ? "You have the outright lead"
                    : "More to take an outright lead"}
                </p>
              </article>
            </div>
            <div className="progress-panel">
              <div className="progress-title">
                <strong>
                  {stats.needed === 0
                    ? "You’re above the cutoff"
                    : "The road to the top five"}
                </strong>
                <span>
                  {number(stats.votes)} / {number(stats.target)} nominations
                </span>
              </div>
              <progress
                value={Math.min(stats.votes, stats.target)}
                max={stats.target}
                aria-label="Progress to top five"
              />
              <p>
                Target: {number(stats.target)} votes to beat the fifth-highest
                other entry. Ties aren’t a guaranteed slot; this assumes
                everyone else’s totals stay the same.
              </p>
            </div>
            <div className="detail-strip">
              <span>
                Vote rank{" "}
                <strong>
                  {stats.rank
                    ? `#${stats.rank}${stats.tied > 1 ? ` · tied with ${stats.tied - 1} others` : ""}`
                    : "Unranked"}
                </strong>
              </span>
              <span>
                To pass the next higher vote total{" "}
                <strong>
                  {stats.toNext
                    ? `${number(stats.toNext)} votes`
                    : stats.found
                      ? "At the highest vote total"
                      : "No higher total yet"}
                </strong>
              </span>
            </div>
          </section>
        )}

        {category && (
          <div className="board-layout">
            <section className="leaderboard">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">THE NOMINATION BOARD</span>
                  <h2>See where everyone stands.</h2>
                </div>
                <span className="count-label">
                  {number(tally.length)} entries
                </span>
              </div>
              <p className="board-caption">
                Sorted by votes. Equal totals keep the API’s order.
              </p>
              {tally.length ? (
                <>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th scope="col">Place</th>
                          <th scope="col">Game</th>
                          <th scope="col" className="right">
                            Votes
                          </th>
                          <th scope="col" className="right share-cell">
                            Share
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map(row)}
                        {!allEntries && stats?.position > 10 && (
                          <>
                            <tr className="gap-row">
                              <td colSpan="4">···</td>
                            </tr>
                            {row(tally[stats.position - 1], stats.position - 1)}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {tally.length > 10 && (
                    <button
                      className="show-all"
                      onClick={() => setAllEntries(!allEntries)}
                    >
                      {allEntries
                        ? "Show top 10"
                        : `View all ${number(tally.length)} entries`}{" "}
                      <span aria-hidden="true">{allEntries ? "−" : "+"}</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="empty-state">
                  <h3>No nominations yet</h3>
                  <p>This category has no published tally entries.</p>
                </div>
              )}
            </section>
            <aside className="jam-info">
              <span className="eyebrow">AT A GLANCE</span>
              <h2>Game Jam III</h2>
              <dl>
                <div>
                  <dt>Total nominations</dt>
                  <dd>{number(total)}</dd>
                </div>
                <div>
                  <dt>Entries in the tally</dt>
                  <dd>{number(tally.length)}</dd>
                </div>
                <div>
                  <dt>Nomination slots</dt>
                  <dd>{category.slots ?? "Not provided"}</dd>
                </div>
                <div>
                  <dt>Fifth-place total</dt>
                  <dd>
                    {tally[4]
                      ? `${number(tally[4].votes)} votes`
                      : "Not set yet"}
                  </dd>
                </div>
              </dl>
              {category.roundEnds && (
                <div className="deadline">
                  <span>{closed ? "Round ended" : "Round ends"}</span>
                  <strong>
                    {new Date(category.roundEnds).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </strong>
                  <span>
                    {new Date(category.roundEnds).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZoneName: "short",
                    })}
                  </span>
                </div>
              )}
              <div className="how-it-works">
                <strong>A snapshot, not a final result.</strong>
                <p>
                  Only entries returned by the voting API are counted. Unvoted
                  games may be missing. Tally positions don’t resolve voting
                  ties.
                </p>
                <a
                  href="https://public.facepunch.com/sbox/jam/three/voting"
                  target="_blank"
                  rel="noreferrer"
                >
                  View source data{" "}
                  <Icon name="external" width="14" height="14" />
                </a>
              </div>
            </aside>
          </div>
        )}
        <footer>
          <span>
            <span className="footer-mark">III</span> Made for the s&box
            community.
          </span>
          <span>Unofficial · Not affiliated with Facepunch</span>
        </footer>
      </main>
    </>
  );
}
