import { useRouter } from 'next/router';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ALL_MATCHES, computeScoreMatrix, sumOutcomes, runMonteCarlo, kellyFraction, impliedProb } from '../../lib/model';
import { MATCH_INTEL, TEAM_PROFILES } from '../../lib/matchIntel';

const C = {
  bg: '#06080f', surface: '#0d1220', card: '#111827', border: '#1a2640',
  accent: '#00e5b0', gold: '#f0c040', red: '#f04060', blue: '#4090ff',
  text: '#dce8f0', dim: '#607080', mutedBorder: '#1e2d40',
};

function americanStr(o) { return o > 0 ? `+${o}` : `${o}`; }
function edgeColor(e) { return e >= 12 ? C.accent : e >= 5 ? C.gold : e >= 0 ? C.dim : C.red; }

function Pill({ children, color = C.accent }) {
  return (
    <span style={{ background: color + '1a', color, border: `1px solid ${color}40`,
      borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>
      {children}
    </span>
  );
}

function WinBar({ home, draw, away, homeTeam, awayTeam }) {
  return (
    <div>
      <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', gap: 1 }}>
        <div style={{ width: `${home * 100}%`, background: C.accent, boxShadow: `0 0 8px ${C.accent}66` }} />
        <div style={{ width: `${draw * 100}%`, background: C.gold }} />
        <div style={{ width: `${away * 100}%`, background: C.red }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontFamily: 'monospace', fontWeight: 800, fontSize: 13 }}>
        <span style={{ color: C.accent }}>{homeTeam} {(home * 100).toFixed(1)}%</span>
        <span style={{ color: C.gold }}>Draw {(draw * 100).toFixed(1)}%</span>
        <span style={{ color: C.red }}>{awayTeam} {(away * 100).toFixed(1)}%</span>
      </div>
    </div>
  );
}

function ScoreHeatmap({ matrix }) {
  let maxP = 0;
  for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5; b++) maxP = Math.max(maxP, matrix[a]?.[b] || 0);
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 2 }}>
        {Array.from({ length: 6 }, (_, a) => Array.from({ length: 6 }, (_, b) => {
          const p = matrix[a]?.[b] || 0;
          const int = p / maxP;
          const bg = a > b ? `rgba(0,229,176,${int * 0.85 + 0.05})` : a === b ? `rgba(240,192,64,${int * 0.85 + 0.05})` : `rgba(240,64,96,${int * 0.85 + 0.05})`;
          return (
            <div key={`${a}-${b}`} title={`${(p * 100).toFixed(2)}%`}
              style={{ background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontFamily: 'monospace', color: '#fff', border: '1px solid rgba(255,255,255,0.06)', minHeight: 22 }}>
              {p > 0.005 ? `${(p * 100).toFixed(1)}` : ''}
            </div>
          );
        }))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.dim, marginTop: 4 }}>
        {[0,1,2,3,4,5].map(n => <span key={n}>{n}g</span>)}
      </div>
    </div>
  );
}

function GoalBars({ gd }) {
  const vals = [0,1,2,3,4,5,6].map(g => gd[g] || 0);
  const max = Math.max(...vals);
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 52 }}>
      {vals.map((p, g) => {
        const h = max > 0 ? (p / max) * 44 : 0;
        const hl = g <= 2;
        return (
          <div key={g} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ fontSize: 10, color: hl ? C.accent : C.dim, fontFamily: 'monospace', fontWeight: hl ? 800 : 400 }}>{(p * 100).toFixed(0)}%</div>
            <div style={{ width: '100%', height: h, background: hl ? C.accent : C.mutedBorder, borderRadius: '2px 2px 0 0', boxShadow: hl ? `0 0 6px ${C.accent}66` : 'none' }} />
            <div style={{ fontSize: 9, color: hl ? C.accent : C.dim }}>{g}g</div>
          </div>
        );
      })}
    </div>
  );
}

function TeamCard({ name }) {
  const p = TEAM_PROFILES[name] || {};
  const formLetters = (p.recentForm || '').split('-');
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{p.flag || '⚽'}</div>
      <div style={{ fontWeight: 800, fontSize: 14, color: C.text, marginBottom: 6 }}>{name}</div>
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 2 }}>FIFA Rank: <span style={{ color: C.text, fontWeight: 700 }}>#{p.rank || '—'}</span></div>
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 2 }}>Style: <span style={{ color: C.text }}>{p.style || '—'}</span></div>
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>Key Player: <span style={{ color: C.gold, fontWeight: 700 }}>{p.keyPlayer || '—'}</span></div>
      <div style={{ display: 'flex', gap: 3 }}>
        {formLetters.map((l, i) => (
          <span key={i} style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
            color: l === 'W' ? C.accent : l === 'D' ? C.gold : C.red,
            background: (l === 'W' ? C.accent : l === 'D' ? C.gold : C.red) + '22',
            borderRadius: 3, padding: '2px 5px' }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

export default function MatchPage() {
  const router = useRouter();
  const { id } = router.query;
  const [model, setModel] = useState(null);
  const [tab, setTab] = useState('overview');

  const match = ALL_MATCHES.find(m => m.id === id);
  const intel = MATCH_INTEL[id] || {};

  useEffect(() => {
    if (!match) return;
    const matrix = computeScoreMatrix(match.hXG, match.aXG);
    const probs = sumOutcomes(matrix);
    const mc = runMonteCarlo(match.hXG, match.aXG, 40000);
    const avgHome = (probs.home + mc.home) / 2;
    const avgDraw = (probs.draw + mc.draw) / 2;
    const avgAway = (probs.away + mc.away) / 2;
    setModel({ matrix, probs, mc, avgHome, avgDraw, avgAway });
  }, [match]);

  if (!match) return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.dim, fontFamily: 'sans-serif' }}>
      {id ? 'Match not found.' : 'Loading...'}
    </div>
  );

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'intel', label: '🔬 Intel' },
    { id: 'scorelines', label: '⚽ Scores' },
    { id: 'bets', label: '💰 Bets' },
  ];

  // Build bet list with edge calculations
  const bets = model ? [
    { label: `${match.home} Win`, prob: model.avgHome, mktOdds: intel.bestBetOdds && intel.bestBet?.includes(match.home.split(' ')[0]) ? intel.bestBetOdds : (model.avgHome > 0.5 ? -150 : +130) },
    { label: 'Draw', prob: model.avgDraw, mktOdds: +240 },
    { label: `${match.away} Win`, prob: model.avgAway, mktOdds: intel.bestBetOdds && intel.bestBet?.includes(match.away.split(' ')[0]) ? intel.bestBetOdds : (model.avgAway > 0.5 ? -150 : +280) },
    { label: 'Under 2.5 Goals', prob: model.mc.under25, mktOdds: -115 },
    { label: 'Over 2.5 Goals', prob: model.mc.over25, mktOdds: -105 },
    { label: 'Both Teams Score', prob: model.mc.btts, mktOdds: +100 },
  ].map(b => ({
    ...b,
    mktProb: impliedProb(b.mktOdds),
    edge: ((b.prob - impliedProb(b.mktOdds)) / impliedProb(b.mktOdds)) * 100,
    kelly: kellyFraction(b.prob, b.mktOdds),
  })).sort((a, b) => b.edge - a.edge) : [];

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", color: C.text }}>
      {/* Top nav */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '10px 16px' }}>
        <Link href="/" style={{ color: C.accent, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
          ← All Matches
        </Link>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '16px 12px' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 4 }}>
            ⚽ GROUP {match.group} · {match.date} · {match.time}
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>
            {TEAM_PROFILES[match.home]?.flag || '⚽'} {match.home} <span style={{ color: C.dim, fontWeight: 400, fontSize: 18 }}>vs</span> {TEAM_PROFILES[match.away]?.flag || '⚽'} {match.away}
          </div>
          <div style={{ fontSize: 12, color: C.dim }}>{match.venue}</div>

          {match.result && (
            <div style={{ marginTop: 8 }}>
              <Pill color={C.gold}>FINAL: {match.result}</Pill>
            </div>
          )}

          {model && (
            <div style={{ marginTop: 12 }}>
              <WinBar home={model.avgHome} draw={model.avgDraw} away={model.avgAway} homeTeam={match.home.split(' ')[0]} awayTeam={match.away.split(' ')[0]} />
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <Pill color={C.dim}>λ {match.hXG} / {match.aXG}</Pill>
            <Pill color={C.dim}>40K MC Trials</Pill>
            {intel.bestBet && <Pill color={C.accent}>Top Bet: {intel.bestBet}</Pill>}
          </div>
        </div>

        {/* Best bet banner */}
        {intel.keyEdge && (
          <div style={{ background: C.accent + '10', border: `1px solid ${C.accent}30`, borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: C.accent, fontWeight: 700, marginBottom: 4 }}>⚡ KEY EDGE</div>
            <div style={{ fontSize: 14, color: C.text, lineHeight: 1.5 }}>{intel.keyEdge}</div>
            {intel.bestBet && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.accent }}>{intel.bestBet}</span>
                {intel.bestBetOdds && <Pill color={C.gold}>{americanStr(intel.bestBetOdds)}</Pill>}
                {intel.bestBetEdge && <Pill color={C.accent}>+{intel.bestBetEdge}% EDGE</Pill>}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 16, background: C.surface, borderRadius: 8, padding: 4, border: `1px solid ${C.border}` }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex: 1, padding: '7px 4px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700,
                background: tab === t.id ? C.accent : 'transparent',
                color: tab === t.id ? '#000' : C.dim }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && model && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <TeamCard name={match.home} />
              <TeamCard name={match.away} />
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.dim, fontWeight: 700, marginBottom: 10 }}>SCORE PROBABILITY HEATMAP</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                <Pill color={C.accent} >Home wins →</Pill>
                <Pill color={C.red}>Away wins ↓</Pill>
                <Pill color={C.gold}>Draw diagonal</Pill>
              </div>
              <ScoreHeatmap matrix={model.matrix} />
            </div>

            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.dim, fontWeight: 700, marginBottom: 10 }}>GOALS DISTRIBUTION (40K MC) — highlighted = under 2.5</div>
              <GoalBars gd={model.mc.goalDist} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 12 }}>
                {[
                  { label: 'Under 2.5', val: model.mc.under25, hl: model.mc.under25 > 0.55 },
                  { label: 'BTTS', val: model.mc.btts, hl: false },
                  { label: 'Over 2.5', val: model.mc.over25, hl: model.mc.over25 > 0.60 },
                ].map(({ label, val, hl }) => (
                  <div key={label} style={{ background: C.surface, borderRadius: 7, padding: '10px 12px', textAlign: 'center',
                    border: `1px solid ${hl ? C.accent + '44' : C.border}` }}>
                    <div style={{ fontSize: 10, color: C.dim }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: hl ? C.accent : C.text, fontFamily: 'monospace' }}>{(val * 100).toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── INTEL TAB ── */}
        {tab === 'intel' && (
          <div>
            {intel.tacticalNote && (
              <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.dim, fontWeight: 700, marginBottom: 8 }}>📋 TACTICAL ANALYSIS</div>
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7 }}>{intel.tacticalNote}</div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              {intel.homeFlags?.length > 0 && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, marginBottom: 8 }}>🏠 {match.home.toUpperCase()}</div>
                  {intel.homeFlags.map((f, i) => (
                    <div key={i} style={{ fontSize: 12, color: C.text, padding: '5px 0', borderBottom: `1px solid ${C.border}44`, lineHeight: 1.4 }}>{f}</div>
                  ))}
                </div>
              )}
              {intel.awayFlags?.length > 0 && (
                <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 11, color: C.red, fontWeight: 700, marginBottom: 8 }}>✈️ {match.away.toUpperCase()}</div>
                  {intel.awayFlags.map((f, i) => (
                    <div key={i} style={{ fontSize: 12, color: C.text, padding: '5px 0', borderBottom: `1px solid ${C.border}44`, lineHeight: 1.4 }}>{f}</div>
                  ))}
                </div>
              )}
            </div>
            {/* Model inputs */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, color: C.dim, fontWeight: 700, marginBottom: 10 }}>📐 MODEL INPUTS</div>
              {[
                { label: `${match.home} Attack λ`, val: match.hXG.toFixed(2), col: C.accent },
                { label: `${match.away} Attack λ`, val: match.aXG.toFixed(2), col: C.red },
                { label: 'Expected Total Goals', val: (match.hXG + match.aXG).toFixed(2), col: C.gold },
                { label: 'MC Trials', val: '40,000', col: C.dim },
                { label: 'Correction', val: 'Dixon-Coles', col: C.dim },
              ].map(({ label, val, col }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.border}44` }}>
                  <span style={{ fontSize: 12, color: C.dim }}>{label}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: col }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SCORELINES TAB ── */}
        {tab === 'scorelines' && model && (
          <div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.dim, fontWeight: 700, marginBottom: 12 }}>TOP SCORELINE PROBABILITIES</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {model.mc.topScores.map(({ score, prob }) => {
                  const [a, b] = score.split('-').map(Number);
                  const col = a > b ? C.accent : a === b ? C.gold : C.red;
                  return (
                    <div key={score} style={{ background: col + '18', border: `1px solid ${col}44`, borderRadius: 8, padding: '10px 14px', textAlign: 'center', minWidth: 64 }}>
                      <div style={{ fontFamily: 'monospace', fontWeight: 900, color: col, fontSize: 18 }}>{score}</div>
                      <div style={{ fontSize: 11, color: C.dim }}>{(prob * 100).toFixed(1)}%</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, color: C.dim, fontWeight: 700, marginBottom: 10 }}>FULL POISSON MATRIX (%)</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'monospace' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '4px 8px', color: C.dim, textAlign: 'left' }}>H↓ A→</th>
                      {[0,1,2,3,4,5].map(b => <th key={b} style={{ padding: '4px 8px', color: C.red }}>{b}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[0,1,2,3,4,5].map(a => (
                      <tr key={a}>
                        <td style={{ padding: '4px 8px', color: C.accent, fontWeight: 700 }}>{a}</td>
                        {[0,1,2,3,4,5].map(b => {
                          const p = model.matrix[a]?.[b] || 0;
                          const col = a > b ? C.accent : a === b ? C.gold : C.red;
                          return (
                            <td key={b} style={{ padding: '4px 8px', color: p > 0.07 ? col : C.dim,
                              fontWeight: p > 0.07 ? 800 : 400, background: p > 0.07 ? col + '18' : 'transparent' }}>
                              {(p * 100).toFixed(1)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── BETS TAB ── */}
        {tab === 'bets' && model && (
          <div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.dim, fontWeight: 700, marginBottom: 14 }}>ALL MARKETS — MODEL vs MARKET</div>
              {bets.map(({ label, prob, mktOdds, mktProb, edge, kelly: k }) => {
                const col = edgeColor(edge);
                const barW = Math.min(Math.abs(edge) / 30 * 100, 100);
                return (
                  <div key={label} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 4 }}>
                      <span style={{ fontSize: 13, color: C.text, fontWeight: 700 }}>{label}</span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: C.dim, fontFamily: 'monospace' }}>mkt {(mktProb * 100).toFixed(1)}%</span>
                        <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 800, color: C.text }}>→ {(prob * 100).toFixed(1)}%</span>
                        <Pill color={col}>{edge >= 0 ? '+' : ''}{edge.toFixed(1)}%</Pill>
                      </div>
                    </div>
                    <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${barW}%`, height: '100%', background: col, borderRadius: 3 }} />
                    </div>
                    {k > 0.01 && (
                      <div style={{ fontSize: 10, color: C.gold, marginTop: 3, fontFamily: 'monospace' }}>
                        Kelly: {(k * 100).toFixed(1)}% · half-Kelly: {(k * 50).toFixed(1)}% @ {americanStr(mktOdds)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Top ranked plays */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 11, color: C.dim, fontWeight: 700, marginBottom: 12 }}>🎯 RANKED PLAYS</div>
              {bets.filter(b => b.edge > 2).slice(0, 4).map(({ label, prob, mktOdds, edge, kelly: k }, i) => (
                <div key={label} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.border}`, alignItems: 'flex-start' }}>
                  <div style={{ fontFamily: 'monospace', fontWeight: 900, color: edgeColor(edge), fontSize: 20, minWidth: 20 }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4, alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{label}</span>
                      <Pill color={C.gold}>{americanStr(mktOdds)}</Pill>
                      <Pill color={edgeColor(edge)}>+{edge.toFixed(1)}% EDGE</Pill>
                      {k > 0.01 && <Pill color={C.gold}>Kelly {(k * 100).toFixed(1)}%</Pill>}
                    </div>
                    <div style={{ fontSize: 11, color: C.dim, fontFamily: 'monospace' }}>
                      Model {(prob * 100).toFixed(1)}% · Implied {(impliedProb(mktOdds) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, padding: '10px 14px', background: C.surface, borderRadius: 8, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: C.dim }}>
            Poisson model · Dixon-Coles corrected · 40K Monte Carlo trials · Kelly criterion sizing.
            {' '}<strong style={{ color: C.red }}>Research only. Bet responsibly.</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
