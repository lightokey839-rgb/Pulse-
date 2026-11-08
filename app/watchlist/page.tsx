"use client";
import Link from "next/link";
import { useWatchlist } from "@/components/useWatchlist";
import { bandTone, short } from "@/lib/format";

export default function WatchlistPage() {
  const { items, toggle } = useWatchlist();
  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">SAVED IN THIS BROWSER</div>
          <h1>Watchlist</h1>
          <p className="lede">Tokens you're tracking. Scores update each time you open a token's dossier. Pulse runs only while it's open; there are no background alerts yet.</p>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="panel empty">
          <h3>Nothing watched yet</h3>
          <p className="muted">Open any token and press ☆ WATCH to keep it here.</p>
          <Link className="primary-button inline-btn" href="/">BROWSE NEW LAUNCHES →</Link>
        </div>
      ) : (
        <div className="table" role="table" aria-label="Watchlist">
          <div className="tr th watch-tr" role="row">
            <span role="columnheader">TOKEN</span>
            <span role="columnheader">LAST SCORE</span>
            <span role="columnheader">BAND</span>
            <span role="columnheader">ADDED</span>
            <span role="columnheader" />
          </div>
          {items.map((w) => (
            <div key={w.mint} className="tr watch-tr" role="row">
              <Link href={`/token/${w.mint}`} className="token-id" role="cell">
                {w.icon ? <img src={w.icon} alt="" width={30} height={30} referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.style.visibility = "hidden")} /> : <span className="token-blank" />}
                <span>
                  <strong>{w.symbol}</strong>
                  <small>{w.name.slice(0, 26)} · {short(w.mint)}</small>
                </span>
              </Link>
              <span role="cell" className="mono" data-label="Score">{w.score ?? "—"}</span>
              <span role="cell" className={`mono ${bandTone(w.band ?? "")}`} data-label="Band">{w.band ?? "—"}</span>
              <span role="cell" className="mono muted" data-label="Added">{new Date(w.addedAt).toLocaleDateString()}</span>
              <span role="cell" className="row-actions">
                <Link className="secondary-button" href={`/token/${w.mint}`}>RE-CHECK</Link>
                <button className="secondary-button" onClick={() => toggle(w)}>REMOVE</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
