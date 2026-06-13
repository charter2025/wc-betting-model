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
function BestBetsPage() {
  const allBets = ALL_MATCHES
    .filter(m => !m.result && MATCH_INTEL[m.id]?.bestBet)
    .map(m => {
      const intel = MATCH_INTEL[m.id];
      return {
        match: m,
        bet: intel.bestBet,
        odds: intel.bestBetOdds,
        edge: intel.bestBetEdge,
        note: intel.keyEdge,
      };
    })
    .filter(b => b.edge)
    .sort((a, b) => b.edge - a.edge);

  return (
    <div>
      <div style={{ background: C.accent + '10', border: `1px solid ${C.accent}25`, borderRadius: 10,
        padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, marginBottom: 4 }}>
          📊 MODEL METHODOLOGY
        </div>
        <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.6 }}>
          Edges calculated using Poisson scoring model with Dixon-Coles correction, 40K Monte Carlo trials per match.
          Injury/form/venue adjustments applied manually from scouting intel. Sorted by model edge — highest value bets first.
        </div>
      </div>

      {allBets.map(({ match, bet, odds, edge, note }, i) => {
        const gCol = groupColor(match.group);
        const col = edgeColor(edge);
        return (
          <Link key={match.id} href={`/match/${match.id}`} style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{ background: C.card, border: `1px solid ${edge >= 12 ? C.accent + '44' : C.border}`,
              borderRadius: 10, padding: '14px 16px', marginBottom: 10, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
              onMouseLeave={e => e.currentTarget.style.borderColor = edge >= 12 ? C.accent + '44' : C.border}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ fontFamily: 'monospace', fontWeight: 900, color: col, fontSize: 24, minWidth: 28, lineHeight: 1 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
                    <span style={{ background: gCol + '22', color: gCol, border: `1px solid ${gCol}44`,
                      borderRadius: 3, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>GRP {match.group}</span>
                    <span style={{ fontSize: 12, color: C.dim }}>{match.home} vs {match.away}</span>
                    <span style={{ fontSize: 11, color: C.dim }}>· {match.date}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 16, fontWeight: 900, color: C.text }}>{bet}</span>
                    {odds && <span style={{ background: C.gold + '22', color: C.gold, border: `1px solid ${C.gold}44`,
                      borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>
                      {americanStr(odds)}
                    </span>}
                    <span style={{ background: col + '22', color: col, border: `1px solid ${col}44`,
                      borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>
                      +{edge}% EDGE
                    </span>
                  </div>
                  {note && <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5 }}>{note}</div>}
                  <div style={{ marginTop: 6, fontSize: 11, color: C.accent }}>Click for full analysis →</div>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
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
          <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
            Poisson + Monte Carlo · Dixon-Coles · Kelly Sizing · AI-Refreshed Every 24h
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
