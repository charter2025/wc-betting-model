// pages/api/autosnap.js
// Auto-snapshots today's top model picks at startup / on schedule
// Called on page load if no picks exist for today yet

import fs from 'fs';
import path from 'path';
import { ALL_MATCHES, computeScoreMatrix, sumOutcomes, runMonteCarlo, kellyFraction } from '../../lib/model';
import { MATCH_INTEL } from '../../lib/matchIntel';

const PICKS_FILE = path.join('/tmp', 'wc_picks.json');

function loadPicks() {
  try {
    if (fs.existsSync(PICKS_FILE)) return JSON.parse(fs.readFileSync(PICKS_FILE, 'utf8'));
  } catch {}
  return [];
}

function savePicks(picks) {
  fs.writeFileSync(PICKS_FILE, JSON.stringify(picks, null, 2));
}

function americanToDecimal(o) {
  return o < 0 ? 1 + 100 / Math.abs(o) : 1 + o / 100;
}

function impliedProb(o) {
  return o < 0 ? Math.abs(o) / (Math.abs(o) + 100) : 100 / (o + 100);
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Get today + tomorrow matches with intel
  const candidates = ALL_MATCHES.filter(m =>
    (m.date === today || m.date === tomorrowStr) &&
    !m.result &&
    MATCH_INTEL[m.id]?.bestBet &&
    MATCH_INTEL[m.id]?.bestBetEdge
  );

  if (candidates.length === 0) {
    return res.status(200).json({ snapped: 0, message: 'No matches to snap today' });
  }

  const picks = loadPicks();

  // Check which matches already have a pick snapped today
  const alreadySnapped = new Set(
    picks
      .filter(p => p.snapDate === today)
      .map(p => p.matchId)
  );

  const newPicks = [];

  for (const match of candidates) {
    if (alreadySnapped.has(match.id)) continue;

    const intel = MATCH_INTEL[match.id];
    const odds = intel.bestBetOdds;
    const modelProb = intel.bestBetEdge
      ? (impliedProb(odds) * 100) + intel.bestBetEdge  // reconstruct modelProb from edge
      : 55;

    const dec = americanToDecimal(odds);
    const b = dec - 1;
    const p = modelProb / 100;
    const kellyFull = Math.max(0, (b * p - (1 - p)) / b);
    const kellyHalf = kellyFull / 2;

    // Run Poisson model to get proper model probability
    const matrix = computeScoreMatrix(match.hXG, match.aXG);
    const probs = sumOutcomes(matrix);
    const mc = runMonteCarlo(match.hXG, match.aXG, 20000);

    // Pick the right model probability for this bet type
    const bet = intel.bestBet.toLowerCase();
    let derivedModelProb = modelProb;
    if (bet.includes('under 2.5')) derivedModelProb = mc.under25 * 100;
    else if (bet.includes('over 2.5')) derivedModelProb = mc.over25 * 100;
    else if (bet.includes('draw')) derivedModelProb = ((probs.draw + mc.draw) / 2) * 100;
    else if (bet.includes(match.home.toLowerCase().split(' ')[0].toLowerCase()) || bet.includes('win') && !bet.includes('away')) {
      derivedModelProb = ((probs.home + mc.home) / 2) * 100;
    } else if (bet.includes(match.away.toLowerCase().split(' ')[0].toLowerCase())) {
      derivedModelProb = ((probs.away + mc.away) / 2) * 100;
    }

    const newPick = {
      id: `auto_${match.id}_${today}`,
      savedAt: new Date().toISOString(),
      snapDate: today,
      auto: true,
      matchId: match.id,
      matchLabel: `${match.home} vs ${match.away}`,
      matchDate: match.date,
      group: match.group,
      venue: match.venue,
      bet: intel.bestBet,
      odds,
      decimalOdds: dec,
      edge: intel.bestBetEdge,
      modelProb: parseFloat(derivedModelProb.toFixed(1)),
      kellyFull,
      kellyHalf,
      unitSize: 1,
      notes: intel.keyEdge,
      // Model output snapshot
      modelSnapshot: {
        homeWin: parseFloat(((probs.home + mc.home) / 2 * 100).toFixed(1)),
        draw: parseFloat(((probs.draw + mc.draw) / 2 * 100).toFixed(1)),
        awayWin: parseFloat(((probs.away + mc.away) / 2 * 100).toFixed(1)),
        under25: parseFloat((mc.under25 * 100).toFixed(1)),
        over25: parseFloat((mc.over25 * 100).toFixed(1)),
        btts: parseFloat((mc.btts * 100).toFixed(1)),
        hLambda: match.hXG,
        aLambda: match.aXG,
      },
      result: null,
      pnl: null,
      graded: false,
    };

    picks.push(newPick);
    newPicks.push(newPick);
  }

  savePicks(picks);
  return res.status(200).json({ snapped: newPicks.length, picks: newPicks });
}
