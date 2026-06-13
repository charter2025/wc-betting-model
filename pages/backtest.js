import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ALL_MATCHES } from '../lib/model';
import { MATCH_INTEL } from '../lib/matchIntel';

const C = {
  bg: '#06080f', surface: '#0d1220', card: '#111827', border: '#1a2640',
  accent: '#00e5b0', gold: '#f0c040', red: '#f04060', green: '#40d080',
  text: '#dce8f0', dim: '#607080', mutedBorder: '#1e2d40',
  win: '#40d080', loss: '#f04060', push: '#f0c040',
};

function americanStr(o) { return o > 0 ? `+${o}` : `${o}`; }
function americanToDecimal(o) { return o < 0 ? 1 + 100 / Math.abs(o) : 1 + o / 100; }
function impliedProb(o) { return o < 0 ? Math.abs(o) / (Math.abs(o) + 100) : 100 / (o + 100); }

function Pill({ children, color = C.accent, size = 11 }) {
  return (
    <span style={{ background: color + '1a', color, border: `1px solid ${color}40`,
      borderRadius: 4, padding: '2px 8px', fontSize: size, fontWeight: 700, fontFamily: 'monospace' }}>
      {children}
    </span>
  );
}

// ── PICK SNAPSHOT MODAL ──────────────────────────────────────────────────────
function SavePickModal({ match, intel, onSave, onClose }) {
  const [bet, setBet] = useState(intel?.bestBet || '');
  const [odds, setOdds] = useState(intel?.bestBetOdds || '');
  const [edge, setEdge] = useState(intel?.bestBetEdge || '');
  const [modelProb, setModelProb] = useState('');
  const [notes, setNotes] = useState(intel?.keyEdge || '');
  const [unit, setUnit] = useState('1');

  const dec = odds ? americanToDecimal(Number(odds)) : 1;
  const kelly = modelProb && odds
    ? Math.max(0, ((dec - 1) * (Number(modelProb) / 100) - (1 - Number(modelProb) / 100)) / (dec - 1))
    : 0;
  const halfKelly = kelly / 2;

  function handleSave() {
    onSave({
      matchId: match.id,
      matchLabel: `${match.home} vs ${match.away}`,
      matchDate: match.date,
      group: match.group,
      venue: match.venue,
      bet,
      odds: Number(odds),
      decimalOdds: dec,
      edge: Number(edge),
      modelProb: Number(modelProb),
      kellyFull: kelly,
      kellyHalf: halfKelly,
      unitSize: Number(unit),
      notes,
    });
    onClose();
  }

  const inputStyle = {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
    color: C.text, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box',
    outline: 'none', fontFamily: 'monospace',
  };
  const labelStyle = { fontSize: 11, color: C.dim, marginBottom: 4, display: 'block', fontWeight: 700 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
        width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 20 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>📌 SNAPSHOT PICK</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginTop: 2 }}>{match.home} vs {match.away}</div>
            <div style={{ fontSize: 11, color: C.dim }}>{match.date} · Group {match.group}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>BET / MARKET</label>
            <input style={inputStyle} value={bet} onChange={e => setBet(e.target.value)} placeholder="e.g. USA Win, Under 2.5 Goals" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>ODDS (American)</label>
              <input style={inputStyle} type="number" value={odds} onChange={e => setOdds(e.target.value)} placeholder="-110 or +240" />
            </div>
            <div>
              <label style={labelStyle}>MODEL EDGE %</label>
              <input style={inputStyle} type="number" value={edge} onChange={e => setEdge(e.target.value)} placeholder="16.8" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>MODEL WIN PROB %</label>
              <input style={inputStyle} type="number" value={modelProb} onChange={e => setModelProb(e.target.value)} placeholder="57" />
            </div>
            <div>
              <label style={labelStyle}>UNIT SIZE (%)</label>
              <input style={inputStyle} type="number" value={unit} onChange={e => setUnit(e.target.value)} placeholder="1" />
            </div>
          </div>

          {kelly > 0 && (
            <div style={{ background: C.accent + '10', border: `1px solid ${C.accent}30`, borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, marginBottom: 4 }}>KELLY SIZING</div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div><div style={{ fontSize: 10, color: C.dim }}>Full Kelly</div><div style={{ fontFamily: 'monospace', color: C.text, fontWeight: 700 }}>{(kelly * 100).toFixed(1)}%</div></div>
                <div><div style={{ fontSize: 10, color: C.dim }}>Half Kelly (rec.)</div><div style={{ fontFamily: 'monospace', color: C.accent, fontWeight: 700 }}>{(halfKelly * 100).toFixed(1)}%</div></div>
                <div><div style={{ fontSize: 10, color: C.dim }}>Decimal Odds</div><div style={{ fontFamily: 'monospace', color: C.text, fontWeight: 700 }}>{dec.toFixed(3)}</div></div>
              </div>
            </div>
          )}

          <div>
            <label style={labelStyle}>NOTES / KEY EDGE</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${C.border}`,
                background: 'transparent', color: C.dim, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              Cancel
            </button>
            <button onClick={handleSave}
              style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none',
                background: C.accent, color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 800 }}>
              📌 Save Pick
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── GRADE MODAL ──────────────────────────────────────────────────────────────
function GradeModal({ pick, onGrade, onClose }) {
  const [score, setScore] = useState('');
  const [won, setWon] = useState(null);

  const inputStyle = {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
    color: C.text, padding: '8px 10px', fontSize: 13, width: '100%', boxSizing: 'border-box', outline: 'none',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, width: '100%', maxWidth: 420, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: C.gold, fontWeight: 700 }}>✏️ GRADE PICK</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginTop: 2 }}>{pick.bet}</div>
            <div style={{ fontSize: 11, color: C.dim }}>{pick.matchLabel}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: C.dim, fontWeight: 700, display: 'block', marginBottom: 4 }}>ACTUAL SCORE</label>
          <input style={inputStyle} value={score} onChange={e => setScore(e.target.value)} placeholder="e.g. 2-1, 0-0" />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: C.dim, fontWeight: 700, display: 'block', marginBottom: 8 }}>RESULT</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { val: true, label: '✅ WIN', col: C.green },
              { val: false, label: '❌ LOSS', col: C.red },
              { val: 'push', label: '🤝 PUSH', col: C.gold },
            ].map(({ val, label, col }) => (
              <button key={String(val)} onClick={() => setWon(val)}
                style={{ flex: 1, padding: '10px 8px', borderRadius: 8, border: `2px solid ${won === val ? col : C.border}`,
                  background: won === val ? col + '22' : 'transparent', color: won === val ? col : C.dim,
                  cursor: 'pointer', fontSize: 12, fontWeight: 800 }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {won !== null && (
          <div style={{ background: (won === true ? C.green : won === false ? C.red : C.gold) + '15',
            border: `1px solid ${(won === true ? C.green : won === false ? C.red : C.gold)}30`,
            borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 2 }}>P&L (half-Kelly units)</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 18,
              color: won === true ? C.green : won === false ? C.red : C.gold }}>
              {won === true
                ? `+${(pick.kellyHalf * (pick.decimalOdds - 1) * 100).toFixed(2)} units`
                : won === false
                ? `-${(pick.kellyHalf * 100).toFixed(2)} units`
                : '0 units (push)'}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${C.border}`,
              background: 'transparent', color: C.dim, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            Cancel
          </button>
          <button onClick={() => won !== null && onGrade({ result: score, actualScore: score, won })}
            disabled={won === null}
            style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none',
              background: won !== null ? C.gold : C.dim, color: '#000',
              cursor: won !== null ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 800 }}>
            ✏️ Grade Pick
          </button>
        </div>
      </div>
    </div>
  );
}

// ── STATS PANEL ──────────────────────────────────────────────────────────────
function StatsPanel({ picks }) {
  const graded = picks.filter(p => p.graded);
  const wins = graded.filter(p => p.won === true).length;
  const losses = graded.filter(p => p.won === false).length;
  const pushes = graded.filter(p => p.won === 'push').length;
  const winRate = graded.length > 0 ? wins / (graded.length - pushes) : 0;
  const totalPnl = graded.reduce((s, p) => s + (p.pnl || 0), 0);
  const roi = graded.length > 0 ? totalPnl / graded.reduce((s, p) => s + p.kellyHalf, 0) : 0;

  // Calibration — how well do model probs match outcomes
  const calibBuckets = { '50-60': { n: 0, w: 0 }, '60-70': { n: 0, w: 0 }, '70-80': { n: 0, w: 0 }, '80+': { n: 0, w: 0 } };
  graded.filter(p => p.modelProb).forEach(p => {
    const mp = p.modelProb;
    const key = mp >= 80 ? '80+' : mp >= 70 ? '70-80' : mp >= 60 ? '60-70' : '50-60';
    calibBuckets[key].n++;
    if (p.won === true) calibBuckets[key].w++;
  });

  // Edge vs reality
  const avgEdgeClaimed = graded.length > 0 ? graded.reduce((s, p) => s + (p.edge || 0), 0) / graded.length : 0;
  const actualEdge = graded.length > 0 ? (winRate - graded.reduce((s, p) => s + impliedProb(p.odds), 0) / graded.length) * 100 : 0;

  return (
    <div>
      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 16 }}>
        {[
          { label: 'Total Picks', val: picks.length, col: C.text },
          { label: 'Graded', val: graded.length, col: C.text },
          { label: 'Win Rate', val: graded.length > 0 ? `${(winRate * 100).toFixed(1)}%` : '—', col: winRate > 0.55 ? C.green : winRate > 0.45 ? C.gold : C.red },
          { label: 'Record', val: graded.length > 0 ? `${wins}W-${losses}L-${pushes}P` : '—', col: C.text },
          { label: 'Total P&L', val: graded.length > 0 ? `${totalPnl >= 0 ? '+' : ''}${(totalPnl * 100).toFixed(2)}u` : '—', col: totalPnl >= 0 ? C.green : C.red },
          { label: 'ROI', val: graded.length > 0 ? `${roi >= 0 ? '+' : ''}${(roi * 100).toFixed(1)}%` : '—', col: roi >= 0 ? C.green : C.red },
        ].map(({ label, val, col }) => (
          <div key={label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: C.dim, marginBottom: 4 }}>{label}</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 18, color: col }}>{val}</div>
          </div>
        ))}
      </div>

      {graded.length >= 3 && (
        <>
          {/* Model calibration */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.dim, fontWeight: 700, marginBottom: 10 }}>📐 MODEL CALIBRATION</div>
            <div style={{ fontSize: 11, color: C.dim, marginBottom: 8, lineHeight: 1.5 }}>
              When model says X% probability, what % of those actually won? A well-calibrated model = bars match the diagonal.
            </div>
            {Object.entries(calibBuckets).map(([bucket, { n, w }]) => {
              const actual = n > 0 ? w / n : null;
              const midpoint = bucket === '80+' ? 85 : bucket === '70-80' ? 75 : bucket === '60-70' ? 65 : 55;
              const diff = actual !== null ? (actual * 100 - midpoint) : 0;
              return (
                <div key={bucket} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, color: C.text }}>Model {bucket}%</span>
                    <span style={{ fontSize: 12, fontFamily: 'monospace', color: C.dim }}>
                      {n > 0 ? `${w}/${n} = ${(actual * 100).toFixed(0)}% actual` : `0 picks`}
                    </span>
                  </div>
                  {n > 0 && (
                    <div style={{ position: 'relative', height: 8, background: C.border, borderRadius: 4 }}>
                      {/* Expected */}
                      <div style={{ position: 'absolute', left: `${midpoint}%`, width: 2, height: '100%', background: C.dim, opacity: 0.5 }} />
                      {/* Actual */}
                      <div style={{ width: `${actual * 100}%`, height: '100%',
                        background: Math.abs(diff) < 8 ? C.green : Math.abs(diff) < 15 ? C.gold : C.red,
                        borderRadius: 4, transition: 'width 0.6s ease' }} />
                    </div>
                  )}
                  {n > 0 && (
                    <div style={{ fontSize: 10, color: Math.abs(diff) < 8 ? C.green : C.gold, marginTop: 2 }}>
                      {diff > 0 ? `Outperforming model by ${diff.toFixed(0)}pp` : diff < 0 ? `Underperforming model by ${Math.abs(diff).toFixed(0)}pp` : 'Perfectly calibrated'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Edge claimed vs actual */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.dim, fontWeight: 700, marginBottom: 10 }}>⚡ CLAIMED EDGE vs REALIZED EDGE</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: C.surface, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: C.dim }}>Avg Claimed Edge</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 20, color: C.gold }}>+{avgEdgeClaimed.toFixed(1)}%</div>
                <div style={{ fontSize: 10, color: C.dim }}>what model said</div>
              </div>
              <div style={{ background: C.surface, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: C.dim }}>Realized Edge</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 20, color: actualEdge >= 0 ? C.green : C.red }}>
                  {actualEdge >= 0 ? '+' : ''}{actualEdge.toFixed(1)}%
                </div>
                <div style={{ fontSize: 10, color: C.dim }}>vs market implied</div>
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: C.dim, lineHeight: 1.6 }}>
              {actualEdge > avgEdgeClaimed * 0.7
                ? '✅ Model is performing well — realized edge within expected range of claimed edge.'
                : actualEdge > 0
                ? '⚠️ Model has positive realized edge but below claimed levels — may need recalibration on probability estimates.'
                : '🔴 Negative realized edge — review model inputs for systematic bias (e.g. home bias, overweighting injuries).'}
            </div>
          </div>

          {/* P&L curve */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.dim, fontWeight: 700, marginBottom: 10 }}>📈 CUMULATIVE P&L</div>
            {(() => {
              let running = 0;
              const points = graded.map((p, i) => {
                running += (p.pnl || 0);
                return { i, val: running };
              });
              const maxVal = Math.max(...points.map(p => p.val), 0.01);
              const minVal = Math.min(...points.map(p => p.val), -0.01);
              const range = maxVal - minVal;
              const h = 80;
              return (
                <div style={{ position: 'relative', height: h + 20, paddingTop: 10 }}>
                  {/* Zero line */}
                  <div style={{ position: 'absolute', left: 0, right: 0,
                    top: 10 + ((maxVal / range) * h),
                    borderTop: `1px dashed ${C.dim}`, opacity: 0.4 }} />
                  {/* Points */}
                  <svg width="100%" height={h} style={{ display: 'block' }}>
                    {points.length > 1 && (
                      <polyline
                        points={points.map(p => {
                          const x = (p.i / (points.length - 1)) * 100;
                          const y = h - ((p.val - minVal) / range) * h;
                          return `${x}%,${y}`;
                        }).join(' ')}
                        fill="none"
                        stroke={running >= 0 ? C.green : C.red}
                        strokeWidth="2"
                      />
                    )}
                    {points.map(p => {
                      const x = points.length > 1 ? (p.i / (points.length - 1)) * 100 : 50;
                      const y = h - ((p.val - minVal) / range) * h;
                      return <circle key={p.i} cx={`${x}%`} cy={y} r={4}
                        fill={p.val >= 0 ? C.green : C.red} />;
                    })}
                  </svg>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.dim, marginTop: 4 }}>
                    <span>Pick 1</span>
                    <span style={{ color: running >= 0 ? C.green : C.red, fontFamily: 'monospace', fontWeight: 700 }}>
                      {running >= 0 ? '+' : ''}{(running * 100).toFixed(2)} units
                    </span>
                    <span>Pick {graded.length}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </>
      )}

      {graded.length < 3 && graded.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, textAlign: 'center', color: C.dim, fontSize: 13 }}>
          Grade {3 - graded.length} more pick{3 - graded.length !== 1 ? 's' : ''} to unlock calibration analysis
        </div>
      )}
    </div>
  );
}

// ── PICK ROW ─────────────────────────────────────────────────────────────────
function PickRow({ pick, onGrade, onDelete }) {
  const statusCol = pick.graded
    ? pick.won === true ? C.green : pick.won === false ? C.red : C.gold
    : C.dim;
  const statusLabel = pick.graded
    ? pick.won === true ? '✅ WIN' : pick.won === false ? '❌ LOSS' : '🤝 PUSH'
    : '⏳ PENDING';

  return (
    <div style={{ background: C.card, border: `1px solid ${pick.graded ? statusCol + '40' : C.border}`,
      borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: C.dim }}>GRP {pick.group}</span>
            <span style={{ fontSize: 12, color: C.dim }}>{pick.matchLabel}</span>
            <span style={{ fontSize: 10, color: C.dim }}>· {pick.matchDate}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{pick.bet}</span>
            <span style={{ fontFamily: 'monospace', color: C.gold, fontWeight: 700, fontSize: 13 }}>{americanStr(pick.odds)}</span>
            {pick.edge > 0 && <span style={{ fontFamily: 'monospace', color: C.accent, fontSize: 11 }}>+{pick.edge}% edge</span>}
          </div>
          {pick.notes && <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.4, marginBottom: 4 }}>{pick.notes}</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: C.dim, fontFamily: 'monospace' }}>Model: {pick.modelProb}%</span>
            <span style={{ fontSize: 10, color: C.dim, fontFamily: 'monospace' }}>½K: {(pick.kellyHalf * 100).toFixed(1)}%</span>
            {pick.graded && pick.actualScore && <span style={{ fontSize: 10, color: statusCol, fontFamily: 'monospace', fontWeight: 700 }}>Score: {pick.actualScore}</span>}
            {pick.pnl != null && (
              <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: statusCol }}>
                P&L: {pick.pnl >= 0 ? '+' : ''}{(pick.pnl * 100).toFixed(2)}u
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
          <span style={{ background: statusCol + '22', color: statusCol, border: `1px solid ${statusCol}44`,
            borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>
            {statusLabel}
          </span>
          {!pick.graded && (
            <button onClick={() => onGrade(pick)}
              style={{ background: C.gold + '22', color: C.gold, border: `1px solid ${C.gold}44`,
                borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              Grade ✏️
            </button>
          )}
          <button onClick={() => onDelete(pick.id)}
            style={{ background: 'transparent', color: C.dim, border: 'none', fontSize: 11, cursor: 'pointer', padding: '2px' }}>
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}

// ── TODAY'S PICKS QUICK-ADD ──────────────────────────────────────────────────
function TodaysPicks({ onSavePick }) {
  const today = new Date().toISOString().split('T')[0];
  const todayMatches = ALL_MATCHES.filter(m => m.date === today && !m.result);
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const tomorrowMatches = ALL_MATCHES.filter(m => m.date === tomorrowStr && !m.result);
  const upcoming = [...todayMatches, ...tomorrowMatches];

  if (upcoming.length === 0) return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, textAlign: 'center', color: C.dim, fontSize: 13 }}>
      No matches today or tomorrow — use "All Matches" tab to add picks for future games
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: 11, color: C.dim, fontWeight: 700, marginBottom: 10, letterSpacing: '0.08em' }}>
        TODAY & TOMORROW — CLICK TO ADD PICK
      </div>
      {upcoming.map(m => {
        const intel = MATCH_INTEL[m.id] || {};
        return (
          <div key={m.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: C.dim, marginBottom: 2 }}>Group {m.group} · {m.date} · {m.time}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 4 }}>{m.home} vs {m.away}</div>
                {intel.bestBet && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: C.accent }}>⚡ {intel.bestBet}</span>
                    {intel.bestBetOdds && <span style={{ fontFamily: 'monospace', color: C.gold, fontSize: 11, fontWeight: 700 }}>{americanStr(intel.bestBetOdds)}</span>}
                    {intel.bestBetEdge && <span style={{ fontFamily: 'monospace', color: C.accent, fontSize: 11 }}>+{intel.bestBetEdge}%</span>}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button onClick={() => onSavePick(m, intel)}
                  style={{ background: C.accent, color: '#000', border: 'none', borderRadius: 8,
                    padding: '7px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  📌 Add Pick
                </button>
                <Link href={`/match/${m.id}`}
                  style={{ textAlign: 'center', fontSize: 11, color: C.accent, textDecoration: 'none' }}>
                  View Analysis
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function BacktestPage() {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('add');
  const [saveModal, setSaveModal] = useState(null); // { match, intel }
  const [gradeModal, setGradeModal] = useState(null); // pick
  const [filter, setFilter] = useState('ALL'); // ALL, PENDING, GRADED

  const fetchPicks = useCallback(async () => {
    try {
      const res = await fetch('/api/picks');
      if (res.ok) setPicks(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchPicks(); }, [fetchPicks]);

  async function handleSavePick(data) {
    try {
      const res = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const newPick = await res.json();
        setPicks(prev => [...prev, newPick]);
      }
    } catch {}
  }

  async function handleGrade(pickId, gradeData) {
    try {
      const res = await fetch('/api/picks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pickId, ...gradeData }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPicks(prev => prev.map(p => p.id === pickId ? updated : p));
      }
    } catch {}
    setGradeModal(null);
  }

  async function handleDelete(id) {
    try {
      await fetch('/api/picks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setPicks(prev => prev.filter(p => p.id !== id));
    } catch {}
  }

  const filteredPicks = picks.filter(p =>
    filter === 'ALL' ? true : filter === 'PENDING' ? !p.graded : p.graded
  ).sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

  const pending = picks.filter(p => !p.graded).length;
  const graded = picks.filter(p => p.graded).length;

  const mainTabs = [
    { id: 'add', label: '📌 Add Picks' },
    { id: 'picks', label: `📋 My Picks (${picks.length})` },
    { id: 'stats', label: '📊 Analysis' },
  ];

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", color: C.text }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '10px 16px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Link href="/" style={{ color: C.accent, fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>← Back</Link>
            <div style={{ fontSize: 18, fontWeight: 900, marginTop: 2 }}>📊 Backtest Tracker</div>
            <div style={{ fontSize: 11, color: C.dim }}>Snap picks · Grade results · Analyze model performance</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {pending > 0 && <div style={{ fontSize: 11, color: C.gold, fontWeight: 700 }}>{pending} pending grade{pending !== 1 ? 's' : ''}</div>}
            {graded > 0 && <div style={{ fontSize: 11, color: C.dim }}>{graded} graded</div>}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '14px 12px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 16, background: C.surface, borderRadius: 8, padding: 4, border: `1px solid ${C.border}` }}>
          {mainTabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex: 1, padding: '8px 4px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700,
                background: tab === t.id ? C.accent : 'transparent',
                color: tab === t.id ? '#000' : C.dim }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ADD PICKS */}
        {tab === 'add' && (
          <TodaysPicks onSavePick={(match, intel) => setSaveModal({ match, intel })} />
        )}

        {/* MY PICKS */}
        {tab === 'picks' && (
          <div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              {['ALL', 'PENDING', 'GRADED'].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 700,
                    background: filter === f ? C.accent : C.surface,
                    color: filter === f ? '#000' : C.dim }}>
                  {f}
                </button>
              ))}
            </div>
            {loading ? (
              <div style={{ textAlign: 'center', color: C.dim, padding: 40 }}>Loading picks...</div>
            ) : filteredPicks.length === 0 ? (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📌</div>
                <div style={{ color: C.dim, fontSize: 13 }}>No picks yet — go to "Add Picks" to snapshot today's best bets</div>
              </div>
            ) : (
              filteredPicks.map(p => (
                <PickRow key={p.id} pick={p}
                  onGrade={pick => setGradeModal(pick)}
                  onDelete={handleDelete} />
              ))
            )}
          </div>
        )}

        {/* STATS */}
        {tab === 'stats' && (
          picks.length === 0 ? (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
              <div style={{ color: C.dim, fontSize: 13 }}>Add and grade picks to see model performance analysis</div>
            </div>
          ) : (
            <StatsPanel picks={picks} />
          )
        )}
      </div>

      {/* Modals */}
      {saveModal && (
        <SavePickModal
          match={saveModal.match}
          intel={saveModal.intel}
          onSave={handleSavePick}
          onClose={() => setSaveModal(null)}
        />
      )}
      {gradeModal && (
        <GradeModal
          pick={gradeModal}
          onGrade={data => handleGrade(gradeModal.id, data)}
          onClose={() => setGradeModal(null)}
        />
      )}
    </div>
  );
}
