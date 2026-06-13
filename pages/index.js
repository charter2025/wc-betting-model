// pages/index.js
import { useState, useEffect, useCallback } from 'react';
import { computeScoreMatrix, sumOutcomes, runMonteCarlo, kellyFraction, impliedProb, ALL_MATCHES } from '../lib/model';

// ─── DESIGN TOKENS ─────────────────────────────────────────────────────────
const C = {
  bg: '#06080f',
  surface: '#0d1220',
  card: '#111827',
  cardBorder: '#1a2640',
  accent: '#00e5b0',
  accentDim: '#00a882',
  gold: '#f0c040',
  red: '#f04060',
  blue: '#4090ff',
  purple: '#a070ff',
  text: '#dce8f0',
  dim: '#607080',
  mutedBorder: '#1e2d40',
};

// ─── UTILITIES ─────────────────────────────────────────────────────────────
function americanToStr(o) { return o > 0 ? `+${o}` : `${o}`; }

function edgeColor(e) {
  if (e >= 15) return C.accent;
  if (e >= 6) return C.gold;
  if (e >= 0) return C.dim;
  return C.red;
}

function groupColor(g) {
  const map = { A:'#e05050', B:'#e09020', C:'#40b060', D:'#4090e0', E:'#9060d0', F:'#e050a0', G:'#50b0b0', H:'#b09040', I:'#7090c0', J:'#c06080', K:'#60a080', L:'#a060c0' };
  return map[g] || C.accent;
}

function computeMatchModel(hXG, aXG) {
  const matrix = computeScoreMatrix(hXG, aXG);
  const probs = sumOutcomes(matrix);
  const mc = runMonteCarlo(hXG, aXG, 20000);
  return { ...probs, under25: mc.under25, over25: mc.over25, btts: mc.btts, topScores: mc.topScores, goalDist: mc.goalDist };
}

// ─── MINI SCORE BAR ────────────────────────────────────────────────────────
function WinBar({ home, draw, away, homeTeam, awayTeam }) {
  const hp = (home * 100).toFixed(0);
  const dp = (draw * 100).toFixed(0);
  const ap = (away * 100).toFixed(0);
  return (
    <div>
      <div style={{ display:'flex', height:8, borderRadius:4, overflow:'hidden', gap:1 }}>
        <div style={{ width:`${hp}%`, background: C.accent }} />
        <div style={{ width:`${dp}%`, background: C.gold }} />
        <div style={{ width:`${ap}%`, background: C.red }} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:4, fontSize:11, fontFamily:'monospace' }}>
        <span style={{ color:C.accent }}>{homeTeam?.split(' ').pop()} {hp}%</span>
        <span style={{ color:C.gold }}>D {dp}%</span>
        <span style={{ color:C.red }}>{awayTeam?.split(' ').pop()} {ap}%</span>
      </div>
    </div>
  );
}

// ─── SCORELINE CHIPS ───────────────────────────────────────────────────────
function ScoreChips({ topScores }) {
  if (!topScores) return null;
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>
      {topScores.map(({ score, prob }) => {
        const [a, b] = score.split('-').map(Number);
        const col = a > b ? C.accent : a === b ? C.gold : C.red;
        return (
          <div key={score} style={{ background: col + '18', border: `1px solid ${col}44`, borderRadius:5, padding:'3px 8px', textAlign:'center' }}>
            <div style={{ fontFamily:'monospace', fontWeight:800, color:col, fontSize:12, lineHeight:1 }}>{score}</div>
            <div style={{ fontSize:9, color:C.dim }}>{(prob*100).toFixed(1)}%</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── GOAL DISTRIBUTION ─────────────────────────────────────────────────────
function GoalBars({ goalDist }) {
  if (!goalDist) return null;
  const vals = [0,1,2,3,4,5,6].map(g => goalDist[g] || 0);
  const max = Math.max(...vals);
  const highlight = [0,1,2]; // under 2.5
  return (
    <div style={{ display:'flex', gap:3, alignItems:'flex-end', height:36 }}>
      {vals.map((p, g) => {
        const h = max > 0 ? (p / max) * 30 : 0;
        const isHl = highlight.includes(g);
        return (
          <div key={g} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
            <div style={{ width:'100%', height:h, background: isHl ? C.accent : C.mutedBorder, borderRadius:'2px 2px 0 0', transition:'height 0.6s ease', boxShadow: isHl ? `0 0 6px ${C.accent}66` : 'none' }} />
            <div style={{ fontSize:8, color: isHl ? C.accent : C.dim }}>{g}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── MATCH CARD ────────────────────────────────────────────────────────────
function MatchCard({ match, aiData, expanded, onToggle }) {
  const hXG = aiData?.adjustedHomeXG || match.hXG;
  const aXG = aiData?.adjustedAwayXG || match.aXG;
  const model = computeMatchModel(hXG, aXG);
  const gCol = groupColor(match.group);

  const edges = [
    { label: `${match.home} Win`, prob: model.home, mktOdds: null, mktProb: 0.45 },
    { label: 'Draw',              prob: model.draw,  mktOdds: null, mktProb: 0.28 },
    { label: `${match.away} Win`, prob: model.away,  mktOdds: null, mktProb: 0.28 },
    { label: 'Under 2.5 Goals',   prob: model.under25, mktOdds: aiData?.bestBet?.includes('Under') ? aiData.bestBetOdds : -115, mktProb: 0.50 },
  ];

  const bestEdge = aiData?.bestBet
    ? { label: aiData.bestBet, prob: (aiData.confidence || 55) / 100, odds: aiData.bestBetOdds, edge: aiData.confidence ? aiData.confidence - impliedProb(aiData.bestBetOdds || -115) * 100 : 8 }
    : null;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius:10, overflow:'hidden', marginBottom:12 }}>
      {/* Card header */}
      <div
        onClick={onToggle}
        style={{ padding:'12px 14px', cursor:'pointer', userSelect:'none',
          background: `linear-gradient(135deg, ${C.surface}, ${C.bg})`,
          borderBottom: expanded ? `1px solid ${C.cardBorder}` : 'none' }}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:4, flexWrap:'wrap' }}>
              <span style={{ background: gCol + '22', color: gCol, border:`1px solid ${gCol}44`, borderRadius:3, padding:'1px 6px', fontSize:10, fontWeight:700 }}>GRP {match.group}</span>
              <span style={{ fontSize:11, color:C.dim }}>{match.date} · {match.time}</span>
              {match.result && <span style={{ background: C.dim + '22', color: C.dim, borderRadius:3, padding:'1px 6px', fontSize:10, fontWeight:700 }}>FINAL: {match.result}</span>}
            </div>
            <div style={{ fontSize:15, fontWeight:800, color:C.text, letterSpacing:'-0.01em' }}>
              {match.home} <span style={{ color:C.dim, fontWeight:400 }}>vs</span> {match.away}
            </div>
            <div style={{ fontSize:11, color:C.dim, marginTop:2 }}>{match.venue}</div>
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontSize:10, color:C.dim }}>λH / λA</div>
            <div style={{ fontFamily:'monospace', color:C.accent, fontWeight:700, fontSize:13 }}>{hXG.toFixed(2)} / {aXG.toFixed(2)}</div>
          </div>
        </div>

        <div style={{ marginTop:8 }}>
          <WinBar home={model.home} draw={model.draw} away={model.away} homeTeam={match.home} awayTeam={match.away} />
        </div>

        {bestEdge && (
          <div style={{ marginTop:8, display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:11, color:C.dim }}>Best edge:</span>
            <span style={{ background: C.accent + '22', color: C.accent, border:`1px solid ${C.accent}44`, borderRadius:4, padding:'2px 8px', fontSize:11, fontWeight:700 }}>
              {bestEdge.label}
            </span>
            <span style={{ fontSize:11, color:C.gold, fontFamily:'monospace' }}>
              {bestEdge.odds ? americanToStr(bestEdge.odds) : ''} · {bestEdge.prob ? (bestEdge.prob * 100).toFixed(0) : '--'}% model
            </span>
            <span style={{ marginLeft:'auto', fontSize:11, color:C.dim }}>{expanded ? '▲' : '▼'}</span>
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding:14 }}>
          {/* AI intel */}
          {aiData && (
            <div style={{ marginBottom:12 }}>
              {aiData.keyEdge && (
                <div style={{ background: C.accent + '10', border:`1px solid ${C.accent}30`, borderRadius:7, padding:'8px 12px', marginBottom:8 }}>
                  <div style={{ fontSize:10, color:C.accentDim, fontWeight:700, marginBottom:3 }}>⚡ AI EDGE</div>
                  <div style={{ fontSize:13, color:C.text }}>{aiData.keyEdge}</div>
                </div>
              )}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {aiData.injuryNotes && (
                  <div style={{ background:C.surface, borderRadius:6, padding:'8px 10px', border:`1px solid ${C.cardBorder}` }}>
                    <div style={{ fontSize:10, color:C.dim, fontWeight:700, marginBottom:3 }}>🩹 INJURIES</div>
                    <div style={{ fontSize:12, color:C.text, lineHeight:1.5 }}>{aiData.injuryNotes}</div>
                  </div>
                )}
                {aiData.formNotes && (
                  <div style={{ background:C.surface, borderRadius:6, padding:'8px 10px', border:`1px solid ${C.cardBorder}` }}>
                    <div style={{ fontSize:10, color:C.dim, fontWeight:700, marginBottom:3 }}>📈 FORM</div>
                    <div style={{ fontSize:12, color:C.text, lineHeight:1.5 }}>{aiData.formNotes}</div>
                  </div>
                )}
              </div>
              {aiData.topFactors?.length > 0 && (
                <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:8 }}>
                  {aiData.topFactors.map(f => (
                    <span key={f} style={{ background:C.surface, border:`1px solid ${C.cardBorder}`, borderRadius:4, padding:'3px 8px', fontSize:11, color:C.dim }}>
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quant stats */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <div style={{ fontSize:10, color:C.dim, fontWeight:700, marginBottom:6 }}>SCORELINE PROBABILITIES</div>
              <ScoreChips topScores={model.topScores} />
            </div>
            <div>
              <div style={{ fontSize:10, color:C.dim, fontWeight:700, marginBottom:6 }}>GOALS DISTRIBUTION</div>
              <GoalBars goalDist={model.goalDist} />
              <div style={{ display:'flex', gap:6, marginTop:8 }}>
                <div style={{ flex:1, background:C.surface, borderRadius:5, padding:'6px 8px', textAlign:'center', border:`1px solid ${model.under25 > 0.55 ? C.accent + '44' : C.cardBorder}` }}>
                  <div style={{ fontSize:10, color:C.dim }}>U 2.5</div>
                  <div style={{ fontSize:14, fontWeight:800, color: model.under25 > 0.55 ? C.accent : C.text, fontFamily:'monospace' }}>{(model.under25*100).toFixed(0)}%</div>
                </div>
                <div style={{ flex:1, background:C.surface, borderRadius:5, padding:'6px 8px', textAlign:'center', border:`1px solid ${C.cardBorder}` }}>
                  <div style={{ fontSize:10, color:C.dim }}>BTTS</div>
                  <div style={{ fontSize:14, fontWeight:800, color:C.text, fontFamily:'monospace' }}>{(model.btts*100).toFixed(0)}%</div>
                </div>
                <div style={{ flex:1, background:C.surface, borderRadius:5, padding:'6px 8px', textAlign:'center', border:`1px solid ${C.cardBorder}` }}>
                  <div style={{ fontSize:10, color:C.dim }}>O 2.5</div>
                  <div style={{ fontSize:14, fontWeight:800, color:C.text, fontFamily:'monospace' }}>{(model.over25*100).toFixed(0)}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Kelly */}
          {aiData?.bestBetOdds && (
            <div style={{ marginTop:10, display:'flex', gap:8, alignItems:'center', padding:'8px 10px', background:C.surface, borderRadius:6, border:`1px solid ${C.cardBorder}` }}>
              <div style={{ fontSize:11, color:C.dim }}>Kelly fraction (full):</div>
              <div style={{ fontFamily:'monospace', color:C.gold, fontWeight:700 }}>
                {(kellyFraction((aiData.confidence || 55) / 100, aiData.bestBetOdds) * 100).toFixed(1)}% bankroll
              </div>
              <div style={{ fontSize:10, color:C.dim }}>→ half-Kelly recommended: {(kellyFraction((aiData.confidence || 55) / 100, aiData.bestBetOdds) * 50).toFixed(1)}%</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SCHEDULE TIMELINE ─────────────────────────────────────────────────────
function Timeline({ matches, selectedDate, onSelectDate }) {
  const dates = [...new Set(matches.map(m => m.date))].sort();
  return (
    <div style={{ display:'flex', gap:4, overflowX:'auto', paddingBottom:4, marginBottom:16 }}>
      <button onClick={() => onSelectDate('ALL')}
        style={{ flexShrink:0, padding:'5px 12px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:700,
          background: selectedDate === 'ALL' ? C.accent : C.surface,
          color: selectedDate === 'ALL' ? '#000' : C.dim }}>
        All
      </button>
      {dates.map(d => {
        const label = new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month:'short', day:'numeric' });
        const isSelected = selectedDate === d;
        return (
          <button key={d} onClick={() => onSelectDate(d)}
            style={{ flexShrink:0, padding:'5px 10px', borderRadius:6, border:'none', cursor:'pointer', fontSize:11, fontWeight:700,
              background: isSelected ? C.accent : C.surface,
              color: isSelected ? '#000' : C.dim }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────────────
export default function Home() {
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [selectedDate, setSelectedDate] = useState('ALL');
  const [filterGroup, setFilterGroup] = useState('ALL');
  const [lastRefresh, setLastRefresh] = useState(null);
  const [cacheAge, setCacheAge] = useState(null);

  const fetchAnalysis = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = force ? '/api/analysis?force=1' : '/api/analysis';
      const res = await fetch(url);
      if (!res.ok) throw new Error('API request failed');
      const data = await res.json();
      setAnalysisData(data);
      setLastRefresh(new Date());
      if (data.cacheAge) setCacheAge(data.cacheAge);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalysis();
    // Re-fetch every 24h
    const interval = setInterval(() => fetchAnalysis(), CACHE_TTL_MS);
    return () => clearInterval(interval);
  }, [fetchAnalysis]);

  const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

  const aiMatchMap = {};
  (analysisData?.matches || []).forEach(m => { if (m.id) aiMatchMap[m.id] = m; });

  // Filter matches
  const today = new Date().toISOString().split('T')[0];
  let visibleMatches = ALL_MATCHES;
  if (selectedDate !== 'ALL') visibleMatches = visibleMatches.filter(m => m.date === selectedDate);
  if (filterGroup !== 'ALL') visibleMatches = visibleMatches.filter(m => m.group === filterGroup);

  // Default: show upcoming first
  const upcoming = visibleMatches.filter(m => !m.result && m.date >= today);
  const completed = visibleMatches.filter(m => m.result || m.date < today);
  const ordered = [...upcoming, ...completed];

  const groups = [...new Set(ALL_MATCHES.map(m => m.group))].sort();

  return (
    <div style={{ background:C.bg, minHeight:'100vh', fontFamily:"'Inter', system-ui, -apple-system, sans-serif", color:C.text }}>
      {/* HEADER */}
      <div style={{ background: `linear-gradient(180deg, ${C.surface} 0%, ${C.bg} 100%)`,
        borderBottom:`1px solid ${C.cardBorder}`, padding:'16px 16px 12px', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ maxWidth:800, margin:'0 auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <div>
              <div style={{ fontSize:10, color:C.accent, fontWeight:700, letterSpacing:'0.1em' }}>⚽ WORLD CUP 2026</div>
              <div style={{ fontSize:20, fontWeight:900, letterSpacing:'-0.03em', lineHeight:1.1 }}>
                Quant Betting <span style={{ color:C.accent }}>Model</span>
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <button onClick={() => fetchAnalysis(true)}
                style={{ background: loading ? C.surface : C.accent, color: loading ? C.dim : '#000',
                  border:'none', borderRadius:6, padding:'7px 12px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                {loading ? '⟳ Refreshing...' : '↻ Refresh'}
              </button>
              {lastRefresh && (
                <div style={{ fontSize:9, color:C.dim, marginTop:3 }}>
                  Updated {lastRefresh.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                  {cacheAge ? ` · ${cacheAge}m old` : ''}
                </div>
              )}
            </div>
          </div>

          {/* AI insight banner */}
          {analysisData?.tournamentInsight && (
            <div style={{ background:C.accent + '10', border:`1px solid ${C.accent}25`, borderRadius:7, padding:'7px 12px', fontSize:12, color:C.text, lineHeight:1.5 }}>
              <span style={{ color:C.accent, fontWeight:700 }}>📊 </span>
              {analysisData.tournamentInsight}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth:800, margin:'0 auto', padding:'16px 12px' }}>
        {/* Filters */}
        <Timeline matches={ALL_MATCHES} selectedDate={selectedDate} onSelectDate={setSelectedDate} />

        <div style={{ display:'flex', gap:4, overflowX:'auto', paddingBottom:4, marginBottom:16 }}>
          <button onClick={() => setFilterGroup('ALL')}
            style={{ flexShrink:0, padding:'4px 10px', borderRadius:5, border:'none', cursor:'pointer', fontSize:11, fontWeight:700,
              background: filterGroup === 'ALL' ? C.gold : C.surface, color: filterGroup === 'ALL' ? '#000' : C.dim }}>
            All Groups
          </button>
          {groups.map(g => (
            <button key={g} onClick={() => setFilterGroup(g)}
              style={{ flexShrink:0, padding:'4px 8px', borderRadius:5, border:'none', cursor:'pointer', fontSize:11, fontWeight:700,
                background: filterGroup === g ? groupColor(g) : C.surface,
                color: filterGroup === g ? '#000' : C.dim }}>
              {g}
            </button>
          ))}
        </div>

        {/* Stats strip */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, marginBottom:16 }}>
          {[
            { label:'Matches Analyzed', val: ALL_MATCHES.length },
            { label:'MC Trials/Match', val:'20,000' },
            { label:'Refresh Cycle', val:'24 hrs' },
          ].map(({ label, val }) => (
            <div key={label} style={{ background:C.surface, border:`1px solid ${C.cardBorder}`, borderRadius:8, padding:'10px 12px', textAlign:'center' }}>
              <div style={{ fontSize:18, fontWeight:900, color:C.accent, fontFamily:'monospace' }}>{val}</div>
              <div style={{ fontSize:10, color:C.dim, marginTop:2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Match cards */}
        {error && (
          <div style={{ background:'#3a1020', border:`1px solid ${C.red}44`, borderRadius:8, padding:'12px 14px', marginBottom:16, fontSize:13 }}>
            ⚠️ AI analysis unavailable — showing base model data. ({error})
          </div>
        )}

        {ordered.length === 0 && !loading && (
          <div style={{ textAlign:'center', color:C.dim, padding:40 }}>No matches found for this filter.</div>
        )}

        {ordered.map(match => (
          <MatchCard
            key={match.id}
            match={match}
            aiData={aiMatchMap[match.id]}
            expanded={expandedId === match.id}
            onToggle={() => setExpandedId(expandedId === match.id ? null : match.id)}
          />
        ))}

        {/* Footer */}
        <div style={{ marginTop:24, padding:'12px 14px', background:C.surface, borderRadius:8, border:`1px solid ${C.cardBorder}` }}>
          <div style={{ fontSize:11, color:C.dim, lineHeight:1.7 }}>
            <strong style={{ color:C.text }}>Methodology:</strong> Independent Poisson scoring model with Dixon-Coles low-score correction.
            Attack (λ) and defense rates from last 10 competitive matches, weighted by recency.
            AI layer (Claude Sonnet) refreshes injury intel, form data, and market edges every 24 hours.
            Kelly criterion assumes 2% base unit. Half-Kelly sizing recommended. 20,000 Monte Carlo trials per match.
            {' '}<strong style={{ color:C.red }}>This is a research tool. Gamble responsibly. Not financial advice.</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
