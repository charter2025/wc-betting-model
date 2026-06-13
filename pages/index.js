import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { computeScoreMatrix, sumOutcomes, runMonteCarlo, kellyFraction, impliedProb, ALL_MATCHES } from '../lib/model';
import { MATCH_INTEL, TEAM_PROFILES } from '../lib/matchIntel';

const C = {
  bg: '#060a14', surface: '#0d1422', card: '#121c2e', border: '#1a2840',
  accent: '#00e5b0', gold: '#f0c040', red: '#f04060', blue: '#4090ff',
  text: '#dce8f0', dim: '#607080', mutedBg: '#0f1828',
};

function groupColor(g) {
  const map = { A:'#e05050',B:'#e09020',C:'#40b060',D:'#4090e0',E:'#9060d0',F:'#e050a0',G:'#50b0b0',H:'#b09040',I:'#7090c0',J:'#c06080',K:'#60a080',L:'#a060c0' };
  return map[g] || C.accent;
}

function edgeColor(e) { return e >= 12 ? C.accent : e >= 5 ? C.gold : C.dim; }
function americanStr(o) { return o > 0 ? `+${o}` : `${o}`; }

function computeQuickModel(m) {
  const matrix = computeScoreMatrix(m.hXG, m.aXG);
  const probs = sumOutcomes(matrix);
  const mc = runMonteCarlo(m.hXG, m.aXG, 10000);
  return {
    home: (probs.home + mc.home) / 2,
    draw: (probs.draw + mc.draw) / 2,
    away: (probs.away + mc.away) / 2,
    under25: mc.under25,
    over25: mc.over25,
    btts: mc.btts,
  };
}

// ── MATCH CARD ──────────────────────────────────────────────────────────────
function MatchCard({ match }) {
  const intel = MATCH_INTEL[match.id] || {};
  const gCol = groupColor(match.group);
  const hProf = TEAM_PROFILES[match.home] || {};
  const aProf = TEAM_PROFILES[match.away] || {};
  const [model, setModel] = useState(null);

  useEffect(() => {
    setModel(computeQuickModel(match));
  }, [match.id]);

  const hp = model ? (model.home * 100).toFixed(0) : '--';
  const dp = model ? (model.draw * 100).toFixed(0) : '--';
  const ap = model ? (model.away * 100).toFixed(0) : '--';

  return (
    <Link href={`/match/${match.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden',
        marginBottom: 10, cursor: 'pointer', transition: 'border-color 0.15s',
        ':hover': { borderColor: C.accent } }}
        onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
        onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>

        <div style={{ padding: '12px 14px' }}>
          {/* Meta row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ background: gCol + '22', color: gCol, border: `1px solid ${gCol}44`,
                borderRadius: 3, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>GRP {match.group}</span>
              <span style={{ fontSize: 11, color: C.dim }}>{match.date} · {match.time}</span>
              {match.result && <span style={{ background: C.dim + '22', color: C.dim, borderRadius: 3, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>FINAL: {match.result}</span>}
            </div>
            <span style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>View Analysis →</span>
          </div>

          {/* Teams */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
              {hProf.flag || '⚽'} {match.home}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: C.dim }}>vs</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text, textAlign: 'right' }}>
              {match.away} {aProf.flag || '⚽'}
            </div>
          </div>

          {/* Win bar */}
          {model && (
            <div>
              <div style={{ display: 'flex', height: 7, borderRadius: 4, overflow: 'hidden', gap: 1, marginBottom: 4 }}>
                <div style={{ width: `${model.home * 100}%`, background: C.accent }} />
                <div style={{ width: `${model.draw * 100}%`, background: C.gold }} />
                <div style={{ width: `${model.away * 100}%`, background: C.red }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: 'monospace' }}>
                <span style={{ color: C.accent }}>{hp}%</span>
                <span style={{ color: C.gold }}>D {dp}%</span>
                <span style={{ color: C.red }}>{ap}%</span>
              </div>
            </div>
          )}

          {/* Best bet strip */}
          {intel.bestBet && (
            <div style={{ marginTop: 10, padding: '7px 10px', background: C.accent + '0d',
              border: `1px solid ${C.accent}25`, borderRadius: 6,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: C.text }}>
                <span style={{ color: C.accent, fontWeight: 700 }}>⚡ </span>{intel.bestBet}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {intel.bestBetOdds && <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.gold, fontWeight: 700 }}>{americanStr(intel.bestBetOdds)}</span>}
                {intel.bestBetEdge && <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.accent, fontWeight: 700 }}>+{intel.bestBetEdge}%</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── BEST BETS PAGE ───────────────────────────────────────────────────────────
function BetCard({ match, bet, odds, edge, note, rank, expired, promoted, onPromote, onDemote }) {
  const gCol = groupColor(match.group);
  const col = edgeColor(edge);
  const dim = expired;
  return (
    <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', marginBottom: 10 }}>
      {/* Promote/demote button column */}
      {!expired && (
        <button onClick={onDemote} title="Move to past"
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px 0 0 10px',
            borderRight: 'none', padding: '0 10px', cursor: 'pointer', color: C.dim, fontSize: 14,
            display: 'flex', alignItems: 'center' }}>
          ↓
        </button>
      )}
      {expired && (
        <button onClick={onPromote} title="Bring back to active"
          style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px 0 0 10px',
            borderRight: 'none', padding: '0 10px', cursor: 'pointer', color: C.accent, fontSize: 14,
            display: 'flex', alignItems: 'center' }}>
          ↑
        </button>
      )}
      <Link href={`/match/${match.id}`} style={{ textDecoration: 'none', flex: 1 }}>
        <div style={{
          background: dim ? C.surface : C.card,
          border: `1px solid ${expired ? C.border : edge >= 12 ? C.accent + '44' : C.border}`,
          borderRadius: '0 10px 10px 0', padding: '12px 14px', cursor: 'pointer',
          opacity: dim ? 0.6 : 1,
        }}
          onMouseEnter={e => !dim && (e.currentTarget.style.borderColor = C.accent)}
          onMouseLeave={e => !dim && (e.currentTarget.style.borderColor = edge >= 12 ? C.accent + '44' : C.border)}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ fontFamily: 'monospace', fontWeight: 900, color: dim ? C.dim : col, fontSize: 22, minWidth: 24, lineHeight: 1 }}>
              {expired ? '✓' : rank}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 5, alignItems: 'center' }}>
                <span style={{ background: gCol + '22', color: gCol, border: `1px solid ${gCol}44`,
                  borderRadius: 3, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>GRP {match.group}</span>
                <span style={{ fontSize: 12, color: C.dim }}>{match.home} vs {match.away} · {match.date}</span>
                {(match.result || expired) && (
                  <span style={{ background: C.dim + '22', color: C.dim, borderRadius: 3, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>
                    {match.result ? `FINAL: ${match.result}` : 'EXPIRED'}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 15, fontWeight: 900, color: dim ? C.dim : C.text }}>{bet}</span>
                {odds && <span style={{ background: C.gold + '22', color: C.gold, border: `1px solid ${C.gold}44`,
                  borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>
                  {americanStr(odds)}
                </span>}
                {!expired && <span style={{ background: col + '22', color: col, border: `1px solid ${col}44`,
                  borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>
                  +{edge}% EDGE
                </span>}
              </div>
              {note && !expired && <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5 }}>{note}</div>}
              {!expired && <div style={{ marginTop: 5, fontSize: 11, color: C.accent }}>Full analysis →</div>}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

function BestBetsPage() {
  const today = new Date().toISOString().split('T')[0];

  // All bets with intel, split into active vs expired by date/result
  const allRaw = ALL_MATCHES
    .filter(m => MATCH_INTEL[m.id]?.bestBet)
    .map(m => {
      const intel = MATCH_INTEL[m.id];
      return {
        match: m,
        bet: intel.bestBet,
        odds: intel.bestBetOdds,
        edge: intel.bestBetEdge,
        note: intel.keyEdge,
        isExpired: !!(m.result || m.date < today),
      };
    })
    .filter(b => b.edge);

  // Track which expired items have been manually promoted back
  const [promoted, setPromoted] = useState(new Set());
  // Track which active items have been manually demoted
  const [demoted, setDemoted] = useState(new Set());
  const [showPast, setShowPast] = useState(false);

  const active = allRaw.filter(b =>
    (!b.isExpired || promoted.has(b.match.id)) && !demoted.has(b.match.id)
  ).sort((a, b) => b.edge - a.edge);

  const expired = allRaw.filter(b =>
    (b.isExpired || demoted.has(b.match.id)) && !promoted.has(b.match.id)
  ).sort((a, b) => new Date(b.match.date) - new Date(a.match.date));

  return (
    <div>
      <div style={{ background: C.accent + '10', border: `1px solid ${C.accent}25`, borderRadius: 10,
        padding: '10px 14px', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, marginBottom: 2 }}>📊 MODEL METHODOLOGY</div>
        <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5 }}>
          Poisson + Dixon-Coles · 40K Monte Carlo trials · Sorted by model edge.
          Use ↓ to archive a pick, ↑ to restore. Expired games auto-move to Past section.
        </div>
      </div>

      {/* Active bets */}
      {active.length === 0 ? (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20,
          textAlign: 'center', color: C.dim, marginBottom: 14 }}>
          No active bets — restore picks from past section using ↑
        </div>
      ) : (
        active.map(({ match, bet, odds, edge, note }, i) => (
          <BetCard key={match.id} match={match} bet={bet} odds={odds} edge={edge} note={note}
            rank={i + 1} expired={false}
            onDemote={() => setDemoted(prev => new Set([...prev, match.id]))}
            onPromote={() => {}} />
        ))
      )}

      {/* Past / expired section */}
      {expired.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setShowPast(p => !p)}
            style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
              padding: '10px 14px', cursor: 'pointer', color: C.dim, fontSize: 12, fontWeight: 700,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>📁 Past / Expired Picks ({expired.length})</span>
            <span style={{ fontSize: 14 }}>{showPast ? '▲' : '▼'}</span>
          </button>

          {showPast && (
            <div style={{ marginTop: 8 }}>
              {expired.map(({ match, bet, odds, edge, note }) => (
                <BetCard key={match.id} match={match} bet={bet} odds={odds} edge={edge} note={note}
                  rank={0} expired={true}
                  onPromote={() => {
                    setPromoted(prev => new Set([...prev, match.id]));
                    setDemoted(prev => { const s = new Set(prev); s.delete(match.id); return s; });
                  }}
                  onDemote={() => {}} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function Home() {
  const [tab, setTab] = useState('best');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [groupFilter, setGroupFilter] = useState('ALL');

  const today = new Date().toISOString().split('T')[0];
  const dates = [...new Set(ALL_MATCHES.map(m => m.date))].sort();
  const groups = [...new Set(ALL_MATCHES.map(m => m.group))].sort();

  let visible = ALL_MATCHES;
  if (dateFilter !== 'ALL') visible = visible.filter(m => m.date === dateFilter);
  if (groupFilter !== 'ALL') visible = visible.filter(m => m.group === groupFilter);
  const upcoming = visible.filter(m => !m.result && m.date >= today);
  const completed = visible.filter(m => m.result || m.date < today);

  const mainTabs = [
    { id: 'best', label: '🔥 Best Bets' },
    { id: 'matches', label: '📅 All Matches' },
  ];

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", color: C.text }}>
      {/* HEADER */}
      <div style={{ background: `linear-gradient(180deg, ${C.surface} 0%, ${C.bg} 100%)`,
        borderBottom: `1px solid ${C.border}`, padding: '14px 16px 12px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 2 }}>
            ⚽ WORLD CUP 2026 · QUANTITATIVE BETTING MODEL
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.02em' }}>
            WC26 Edge Finder <span style={{ color: C.accent }}>↗</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
            <div style={{ fontSize: 11, color: C.dim }}>
              Poisson + Monte Carlo · Dixon-Coles · Kelly Sizing · AI-Refreshed Every 24h
            </div>
            <Link href="/backtest"
              style={{ background: C.gold + '22', color: C.gold, border: `1px solid ${C.gold}44`,
                borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 800, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              📊 Backtest
            </Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '14px 12px' }}>
        {/* Main tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: C.surface,
          borderRadius: 8, padding: 4, border: `1px solid ${C.border}` }}>
          {mainTabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex: 1, padding: '9px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 800,
                background: tab === t.id ? C.accent : 'transparent',
                color: tab === t.id ? '#000' : C.dim }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'best' && <BestBetsPage />}

        {tab === 'matches' && (
          <div>
            {/* Date filters */}
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4, marginBottom: 10 }}>
              <button onClick={() => setDateFilter('ALL')}
                style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 700, background: dateFilter === 'ALL' ? C.accent : C.surface, color: dateFilter === 'ALL' ? '#000' : C.dim }}>
                All Dates
              </button>
              {dates.map(d => {
                const label = new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return (
                  <button key={d} onClick={() => setDateFilter(d)}
                    style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 700, background: dateFilter === d ? C.accent : C.surface, color: dateFilter === d ? '#000' : C.dim }}>
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Group filters */}
            <div style={{ display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 4, marginBottom: 16 }}>
              <button onClick={() => setGroupFilter('ALL')}
                style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 700, background: groupFilter === 'ALL' ? C.gold : C.surface, color: groupFilter === 'ALL' ? '#000' : C.dim }}>
                All
              </button>
              {groups.map(g => (
                <button key={g} onClick={() => setGroupFilter(g)}
                  style={{ flexShrink: 0, padding: '4px 8px', borderRadius: 5, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 700, background: groupFilter === g ? groupColor(g) : C.surface, color: groupFilter === g ? '#000' : C.dim }}>
                  {g}
                </button>
              ))}
            </div>

            {upcoming.length > 0 && (
              <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, marginBottom: 8, letterSpacing: '0.08em' }}>
                UPCOMING ({upcoming.length})
              </div>
            )}
            {upcoming.map(m => <MatchCard key={m.id} match={m} />)}

            {completed.length > 0 && (
              <div style={{ fontSize: 11, color: C.dim, fontWeight: 700, marginBottom: 8, marginTop: 20, letterSpacing: '0.08em' }}>
                COMPLETED ({completed.length})
              </div>
            )}
            {completed.map(m => <MatchCard key={m.id} match={m} />)}
          </div>
        )}

        <div style={{ marginTop: 20, padding: '10px 14px', background: C.surface, borderRadius: 8, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: C.dim, lineHeight: 1.6 }}>
            Poisson model with Dixon-Coles correction · 40K Monte Carlo trials per match · Kelly criterion sizing.
            AI analysis layer refreshes injury/form intel every 24 hours. Edges are model estimates, not guarantees.
            {' '}<strong style={{ color: C.red }}>Research only. Gamble responsibly.</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
