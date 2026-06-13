import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const C = {
  bg: '#06080f', surface: '#0d1220', card: '#111827', border: '#1a2640',
  accent: '#00e5b0', gold: '#f0c040', red: '#f04060', green: '#40d080',
  text: '#dce8f0', dim: '#607080',
};

function americanStr(o) { return o > 0 ? `+${o}` : `${o}`; }
function impliedProb(o) { return o < 0 ? Math.abs(o)/(Math.abs(o)+100) : 100/(o+100); }

function Stat({ label, val, col = C.text, sub }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 10, color: C.dim, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 20, color: col }}>{val}</div>
      {sub && <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── P&L CURVE ────────────────────────────────────────────────────────────────
function PnLCurve({ picks }) {
  const graded = picks.filter(p => p.graded).sort((a, b) => new Date(a.gradedAt) - new Date(b.gradedAt));
  if (graded.length < 2) return null;

  let running = 0;
  const points = graded.map((p, i) => { running += (p.pnl || 0); return { i, val: running, pick: p }; });
  const maxV = Math.max(...points.map(p => p.val), 0.001);
  const minV = Math.min(...points.map(p => p.val), -0.001);
  const range = maxV - minV || 0.01;
  const H = 90, W = 100;
  const finalPnl = points[points.length - 1].val;

  const toX = i => (i / (points.length - 1)) * W;
  const toY = v => H - ((v - minV) / range) * H;
  const zeroY = toY(0);

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(p.i).toFixed(1)},${toY(p.val).toFixed(1)}`).join(' ');
  const fillD = `${pathD} L${toX(points.length-1).toFixed(1)},${H} L0,${H} Z`;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: C.dim, fontWeight: 700 }}>📈 CUMULATIVE P&L</div>
        <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 16,
          color: finalPnl >= 0 ? C.green : C.red }}>
          {finalPnl >= 0 ? '+' : ''}{(finalPnl * 100).toFixed(2)} units
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 90, display: 'block', overflow: 'visible' }}>
        {/* Zero line */}
        {zeroY >= 0 && zeroY <= H && (
          <line x1="0" y1={zeroY} x2={W} y2={zeroY} stroke={C.dim} strokeWidth="0.5" strokeDasharray="2,2" opacity="0.5" />
        )}
        {/* Fill */}
        <path d={fillD} fill={finalPnl >= 0 ? C.green : C.red} opacity="0.08" />
        {/* Line */}
        <path d={pathD} fill="none" stroke={finalPnl >= 0 ? C.green : C.red} strokeWidth="1.5" />
        {/* Dots */}
        {points.map(p => (
          <circle key={p.i} cx={toX(p.i)} cy={toY(p.val)} r="2"
            fill={p.pick.won === true ? C.green : p.pick.won === false ? C.red : C.gold} />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.dim, marginTop: 4 }}>
        <span>{graded[0]?.matchDate}</span>
        <span>{graded[graded.length-1]?.matchDate}</span>
      </div>
    </div>
  );
}

// ── CALIBRATION ───────────────────────────────────────────────────────────────
function Calibration({ picks }) {
  const graded = picks.filter(p => p.graded && p.modelProb);
  if (graded.length < 3) return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14,
      textAlign: 'center', color: C.dim, fontSize: 12 }}>
      Grade {3 - graded.length} more pick{3 - graded.length !== 1 ? 's' : ''} to unlock calibration
    </div>
  );

  const buckets = [
    { label: '50–60%', min: 50, max: 60 },
    { label: '60–70%', min: 60, max: 70 },
    { label: '70–80%', min: 70, max: 80 },
    { label: '80%+',   min: 80, max: 100 },
  ].map(b => {
    const inBucket = graded.filter(p => p.modelProb >= b.min && p.modelProb < b.max);
    const wins = inBucket.filter(p => p.won === true).length;
    const mid = (b.min + Math.min(b.max, 95)) / 2;
    return { ...b, n: inBucket.length, wins, actual: inBucket.length > 0 ? wins / inBucket.length : null, mid };
  });

  const avgClaimed = graded.reduce((s, p) => s + (p.edge || 0), 0) / graded.length;
  const avgMktProb = graded.reduce((s, p) => s + impliedProb(p.odds), 0) / graded.length;
  const winRate = graded.filter(p => p.won === true).length / graded.filter(p => p.won !== 'push').length;
  const realizedEdge = (winRate - avgMktProb) * 100;

  return (
    <div>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: C.dim, fontWeight: 700, marginBottom: 10 }}>
          📐 CALIBRATION — When model says X%, what % actually won?
        </div>
        {buckets.map(b => {
          if (b.n === 0) return (
            <div key={b.label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 12, color: C.dim }}>Model {b.label}</span>
                <span style={{ fontSize: 11, color: C.dim, fontFamily: 'monospace' }}>0 picks</span>
              </div>
              <div style={{ height: 8, background: C.border, borderRadius: 4 }} />
            </div>
          );
          const actual = b.actual * 100;
          const diff = actual - b.mid;
          const barCol = Math.abs(diff) < 8 ? C.green : Math.abs(diff) < 15 ? C.gold : C.red;
          return (
            <div key={b.label} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>Model {b.label}</span>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: barCol }}>
                  {b.wins}/{b.n} = {actual.toFixed(0)}% actual {diff > 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(0)}pp
                </span>
              </div>
              <div style={{ position: 'relative', height: 10, background: C.border, borderRadius: 5 }}>
                {/* Expected midpoint marker */}
                <div style={{ position: 'absolute', left: `${b.mid}%`, top: -2, bottom: -2,
                  width: 2, background: C.dim, opacity: 0.5, borderRadius: 1 }} />
                {/* Actual bar */}
                <div style={{ width: `${actual}%`, height: '100%', background: barCol,
                  borderRadius: 5, transition: 'width 0.8s ease',
                  boxShadow: `0 0 6px ${barCol}66` }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.dim, marginTop: 2 }}>
                <span>0%</span>
                <span style={{ color: C.dim }}>expected ~{b.mid}%</span>
                <span>100%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edge reality check */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: C.dim, fontWeight: 700, marginBottom: 10 }}>⚡ CLAIMED EDGE vs REALITY</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div style={{ background: C.surface, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: C.dim }}>Avg Claimed Edge</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 20, color: C.gold }}>+{avgClaimed.toFixed(1)}%</div>
            <div style={{ fontSize: 10, color: C.dim }}>what model said before</div>
          </div>
          <div style={{ background: C.surface, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: C.dim }}>Realized Edge</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 20,
              color: realizedEdge >= 0 ? C.green : C.red }}>
              {realizedEdge >= 0 ? '+' : ''}{realizedEdge.toFixed(1)}%
            </div>
            <div style={{ fontSize: 10, color: C.dim }}>win rate vs implied odds</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.6, padding: '8px 10px',
          background: C.surface, borderRadius: 6, border: `1px solid ${C.border}` }}>
          {realizedEdge > avgClaimed * 0.6
            ? '✅ Model performing within range — realized edge tracking claimed edge well.'
            : realizedEdge > 0
            ? '⚠️ Positive edge but below claimed levels. Consider tightening model probability estimates.'
            : graded.length < 8
            ? '📊 Sample size too small to draw conclusions. Need 8+ graded picks for meaningful analysis.'
            : '🔴 Negative realized edge. Review: home bias, injury weighting, or odds shopping quality.'}
        </div>
      </div>

      {/* Bet type breakdown */}
      {(() => {
        const byType = {};
        graded.forEach(p => {
          const t = p.bet?.toLowerCase().includes('under') ? 'Unders'
            : p.bet?.toLowerCase().includes('over') ? 'Overs'
            : p.bet?.toLowerCase().includes('draw') ? 'Draws'
            : p.bet?.toLowerCase().includes('win') ? 'Moneylines'
            : p.bet?.toLowerCase().includes('ah') || p.bet?.toLowerCase().includes('handicap') ? 'AH'
            : 'Other';
          if (!byType[t]) byType[t] = { n: 0, w: 0, pnl: 0 };
          byType[t].n++;
          if (p.won === true) byType[t].w++;
          byType[t].pnl += (p.pnl || 0);
        });
        const rows = Object.entries(byType).sort((a, b) => b[1].n - a[1].n);
        if (rows.length === 0) return null;
        return (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, color: C.dim, fontWeight: 700, marginBottom: 10 }}>🗂 P&L BY BET TYPE</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Type', 'Record', 'Win%', 'P&L'].map(h => (
                    <th key={h} style={{ padding: '4px 8px', color: C.dim, textAlign: h === 'Type' ? 'left' : 'right', fontSize: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(([type, d]) => {
                  const wr = d.n > 0 ? d.w / d.n : 0;
                  const col = d.pnl >= 0 ? C.green : C.red;
                  return (
                    <tr key={type} style={{ borderBottom: `1px solid ${C.border}44` }}>
                      <td style={{ padding: '6px 8px', color: C.text, fontWeight: 700 }}>{type}</td>
                      <td style={{ padding: '6px 8px', color: C.dim, textAlign: 'right', fontFamily: 'monospace' }}>{d.w}-{d.n - d.w}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace',
                        color: wr > 0.55 ? C.green : wr > 0.45 ? C.gold : C.red }}>
                        {(wr * 100).toFixed(0)}%
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: col }}>
                        {d.pnl >= 0 ? '+' : ''}{(d.pnl * 100).toFixed(1)}u
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  );
}

// ── PICK ROW ─────────────────────────────────────────────────────────────────
function PickRow({ pick }) {
  const statusCol = !pick.graded ? C.dim
    : pick.won === true ? C.green : pick.won === false ? C.red : C.gold;
  const statusLabel = !pick.graded ? '⏳ Pending'
    : pick.won === true ? '✅ Win' : pick.won === false ? '❌ Loss' : '🤝 Push';

  return (
    <div style={{ background: C.card, border: `1px solid ${pick.graded ? statusCol + '40' : C.border}`,
      borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: C.dim, marginBottom: 3 }}>
            {pick.matchLabel} · {pick.matchDate}
            {pick.auto && <span style={{ marginLeft: 6, color: C.accent, fontSize: 10, fontWeight: 700 }}>AUTO</span>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>{pick.bet}</span>
            <span style={{ fontFamily: 'monospace', color: C.gold, fontWeight: 700 }}>{americanStr(pick.odds)}</span>
            {pick.edge > 0 && <span style={{ fontFamily: 'monospace', color: C.accent, fontSize: 11 }}>+{pick.edge}% edge</span>}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, color: C.dim, fontFamily: 'monospace' }}>
            <span>Model: {pick.modelProb}%</span>
            <span>½K: {(pick.kellyHalf * 100).toFixed(1)}%</span>
            {pick.graded && <span style={{ color: statusCol, fontWeight: 700 }}>Score: {pick.actualScore}</span>}
            {pick.pnl != null && (
              <span style={{ color: statusCol, fontWeight: 700 }}>
                P&L: {pick.pnl >= 0 ? '+' : ''}{(pick.pnl * 100).toFixed(2)}u
              </span>
            )}
          </div>
          {pick.notes && !pick.graded && (
            <div style={{ fontSize: 11, color: C.dim, marginTop: 4, lineHeight: 1.4 }}>{pick.notes}</div>
          )}
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <span style={{ background: statusCol + '22', color: statusCol, border: `1px solid ${statusCol}44`,
            borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 700, display: 'block', marginBottom: 4 }}>
            {statusLabel}
          </span>
          {pick.gradedBy === 'auto' && (
            <span style={{ fontSize: 9, color: C.dim }}>auto-graded</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function BacktestPage() {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [lastAction, setLastAction] = useState(null);
  const [tab, setTab] = useState('picks');

  const fetchPicks = useCallback(async () => {
    try {
      const res = await fetch('/api/picks');
      if (res.ok) setPicks(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  // On mount: auto-snap today's picks, then auto-grade pending ones
  useEffect(() => {
    const init = async () => {
      // 1. Snap today's picks
      try {
        const snap = await fetch('/api/autosnap', { method: 'POST' });
        if (snap.ok) {
          const data = await snap.json();
          if (data.snapped > 0) setLastAction(`📌 Auto-snapped ${data.snapped} pick${data.snapped !== 1 ? 's' : ''} for today`);
        }
      } catch {}

      // 2. Load picks
      await fetchPicks();

      // 3. Auto-grade any pending picks from past dates
      try {
        const grade = await fetch('/api/autograde', { method: 'POST' });
        if (grade.ok) {
          const data = await grade.json();
          if (data.graded > 0) {
            setLastAction(`✅ Auto-graded ${data.graded} pick${data.graded !== 1 ? 's' : ''}`);
            await fetchPicks(); // reload with new grades
          }
        }
      } catch {}
    };
    init();
  }, [fetchPicks]);

  async function manualSnap() {
    setSnapping(true);
    try {
      const res = await fetch('/api/autosnap', { method: 'POST' });
      const data = await res.json();
      setLastAction(data.snapped > 0 ? `📌 Snapped ${data.snapped} new picks` : '📌 All picks already snapped for today');
      await fetchPicks();
    } catch { setLastAction('❌ Snap failed'); }
    setSnapping(false);
  }

  async function manualGrade() {
    setGrading(true);
    try {
      const res = await fetch('/api/autograde', { method: 'POST' });
      const data = await res.json();
      setLastAction(data.graded > 0 ? `✅ Auto-graded ${data.graded} picks` : '⏳ No results available yet for pending picks');
      await fetchPicks();
    } catch { setLastAction('❌ Grade failed'); }
    setGrading(false);
  }

  async function deletePick(id) {
    await fetch('/api/picks', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setPicks(prev => prev.filter(p => p.id !== id));
  }

  const graded = picks.filter(p => p.graded);
  const pending = picks.filter(p => !p.graded);
  const wins = graded.filter(p => p.won === true).length;
  const losses = graded.filter(p => p.won === false).length;
  const pushes = graded.filter(p => p.won === 'push').length;
  const winRate = graded.length > 0 ? wins / Math.max(graded.filter(p => p.won !== 'push').length, 1) : 0;
  const totalPnl = graded.reduce((s, p) => s + (p.pnl || 0), 0);
  const totalStaked = graded.reduce((s, p) => s + (p.kellyHalf || 0), 0);
  const roi = totalStaked > 0 ? totalPnl / totalStaked : 0;

  const tabs = [
    { id: 'picks', label: `📋 Picks (${picks.length})` },
    { id: 'analysis', label: '📊 Analysis' },
  ];

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", color: C.text }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '10px 16px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <Link href="/" style={{ color: C.accent, fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>← Back</Link>
              <div style={{ fontSize: 18, fontWeight: 900, marginTop: 2 }}>📊 Auto Backtest</div>
              <div style={{ fontSize: 11, color: C.dim }}>Model auto-snaps picks · fetches results · grades itself</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={manualSnap} disabled={snapping}
                  style={{ background: C.accent + '22', color: C.accent, border: `1px solid ${C.accent}44`,
                    borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {snapping ? '...' : '📌 Snap'}
                </button>
                <button onClick={manualGrade} disabled={grading}
                  style={{ background: C.gold + '22', color: C.gold, border: `1px solid ${C.gold}44`,
                    borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {grading ? 'Grading...' : '⚡ Grade'}
                </button>
              </div>
              {lastAction && <div style={{ fontSize: 10, color: C.dim, textAlign: 'right' }}>{lastAction}</div>}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '14px 12px' }}>
        {/* How it works banner */}
        <div style={{ background: C.accent + '0a', border: `1px solid ${C.accent}20`, borderRadius: 10,
          padding: '10px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, marginBottom: 4 }}>🤖 FULLY AUTOMATED</div>
          <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.6 }}>
            On each page load: (1) model auto-snaps today's top picks from its Poisson + Monte Carlo output,
            (2) Claude searches the web for final scores on any pending past-date picks,
            (3) grades each bet automatically against the result, (4) updates P&L and calibration stats.
            No user input required.
          </div>
        </div>

        {/* Stats strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
          <Stat label="Record" val={graded.length > 0 ? `${wins}-${losses}-${pushes}` : '—'} col={C.text} sub="W-L-P" />
          <Stat label="Win Rate" val={graded.length > 0 ? `${(winRate*100).toFixed(0)}%` : '—'}
            col={winRate > 0.55 ? C.green : winRate > 0.45 ? C.gold : graded.length > 0 ? C.red : C.dim} />
          <Stat label="Total P&L" val={graded.length > 0 ? `${totalPnl >= 0 ? '+' : ''}${(totalPnl*100).toFixed(1)}u` : '—'}
            col={totalPnl >= 0 ? C.green : C.red} sub={graded.length > 0 ? `ROI ${roi >= 0 ? '+' : ''}${(roi*100).toFixed(0)}%` : ''} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 14, background: C.surface, borderRadius: 8, padding: 4, border: `1px solid ${C.border}` }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ flex: 1, padding: '8px 4px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700,
                background: tab === t.id ? C.accent : 'transparent',
                color: tab === t.id ? '#000' : C.dim }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'picks' && (
          <div>
            {loading ? (
              <div style={{ textAlign: 'center', color: C.dim, padding: 40 }}>Loading & auto-grading...</div>
            ) : picks.length === 0 ? (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
                padding: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
                <div style={{ color: C.dim, fontSize: 13 }}>No picks yet — model will auto-snap today's best bets on next load</div>
              </div>
            ) : (
              <>
                {pending.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, marginBottom: 8, letterSpacing: '0.08em' }}>
                      ⏳ PENDING ({pending.length})
                    </div>
                    {pending.sort((a,b) => new Date(a.matchDate) - new Date(b.matchDate)).map(p => <PickRow key={p.id} pick={p} />)}
                  </>
                )}
                {graded.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, color: C.dim, fontWeight: 700, marginBottom: 8, marginTop: 16, letterSpacing: '0.08em' }}>
                      ✅ GRADED ({graded.length})
                    </div>
                    {graded.sort((a,b) => new Date(b.gradedAt) - new Date(a.gradedAt)).map(p => <PickRow key={p.id} pick={p} />)}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'analysis' && (
          <div>
            <PnLCurve picks={picks} />
            <Calibration picks={picks} />
          </div>
        )}

        <div style={{ marginTop: 16, padding: '10px 14px', background: C.surface, borderRadius: 8, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: C.dim, lineHeight: 1.6 }}>
            Auto-snap runs on page load · Claude web-searches for final scores · betting logic grades each type automatically.
            Kelly sizing uses half-Kelly on all picks. P&L in bankroll units (1u = 1% bankroll).
            {' '}<strong style={{ color: C.red }}>Research tool only.</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
