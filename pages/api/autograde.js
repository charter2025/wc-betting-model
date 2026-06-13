// pages/api/autograde.js
// Auto-grades pending picks by:
// 1. Fetching live/final scores via Claude (web search)
// 2. Parsing the actual result against the bet type
// 3. Updating picks in storage automatically

import fs from 'fs';
import path from 'path';

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

// Determine if a bet won given the actual score and bet type
function gradeBet(bet, homeScore, awayScore) {
  const total = homeScore + awayScore;
  const b = bet.toLowerCase();

  if (b.includes('under 2.5')) return total <= 2 ? 'win' : 'loss';
  if (b.includes('over 2.5')) return total >= 3 ? 'win' : 'loss';
  if (b.includes('under 1.5')) return total <= 1 ? 'win' : 'loss';
  if (b.includes('over 1.5')) return total >= 2 ? 'win' : 'loss';
  if (b.includes('under 3.5')) return total <= 3 ? 'win' : 'loss';
  if (b.includes('over 3.5')) return total >= 4 ? 'win' : 'loss';
  if (b.includes('btts') || b.includes('both teams score')) return (homeScore >= 1 && awayScore >= 1) ? 'win' : 'loss';

  // Home win (first team in matchLabel)
  if (b.includes('win') && !b.includes('draw') && !b.includes('away')) {
    // Try to figure out if it's home or away team
    // Bet label typically "TeamName Win" or "TeamName -1.5 AH"
    if (homeScore > awayScore) return 'win';
    if (homeScore < awayScore) return 'loss';
    return 'push'; // draw
  }

  // Draw
  if (b.includes('draw') || b === 'x') {
    if (homeScore === awayScore) return 'win';
    return 'loss';
  }

  // AH -1.5 (home)
  if (b.includes('-1.5')) {
    if (homeScore - awayScore >= 2) return 'win';
    if (homeScore - awayScore === 1) return 'loss'; // didn't cover
    return 'loss';
  }

  // AH +0.75 / +1 (away team gets handicap)
  if (b.includes('+0.75')) {
    const margin = awayScore - homeScore;
    if (margin > 0) return 'win'; // away wins outright
    if (margin === 0) return 'win'; // half win on push half
    if (margin === -1) return 'push'; // half win half loss → count as push
    return 'loss';
  }

  // DNB / Draw No Bet
  if (b.includes('dnb') || b.includes('draw no bet')) {
    if (homeScore > awayScore) return 'win';
    if (homeScore < awayScore) return 'loss';
    return 'push';
  }

  return null; // can't auto-grade
}

async function fetchResultFromClaude(matchLabel, matchDate) {
  const prompt = `What was the final score of the World Cup 2026 match: ${matchLabel} on ${matchDate}?
  
Respond ONLY with a JSON object, no other text:
{
  "found": true,
  "homeScore": 2,
  "awayScore": 1,
  "status": "final"
}

If the match hasn't finished or you can't find the result:
{
  "found": false,
  "status": "pending"
}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }],
      system: 'You are a sports data assistant. Search for the match result and respond ONLY with the JSON object specified. No markdown, no explanation.',
    }),
  });

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);
  const data = await response.json();

  // Extract text from response (may include tool use blocks)
  const textBlock = data.content?.find(b => b.type === 'text');
  if (!textBlock) return { found: false, status: 'no_response' };

  const cleaned = textBlock.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  // Find JSON in the response
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { found: false, status: 'parse_error' };

  return JSON.parse(jsonMatch[0]);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const picks = loadPicks();
  const pending = picks.filter(p => !p.graded);

  if (pending.length === 0) {
    return res.status(200).json({ graded: 0, message: 'No pending picks to grade' });
  }

  const results = [];
  let gradedCount = 0;

  for (const pick of pending) {
    // Skip if match date is in the future (can't have a result yet)
    const today = new Date().toISOString().split('T')[0];
    if (pick.matchDate > today) {
      results.push({ id: pick.id, status: 'future', matchLabel: pick.matchLabel });
      continue;
    }

    try {
      const scoreData = await fetchResultFromClaude(pick.matchLabel, pick.matchDate);

      if (!scoreData.found) {
        results.push({ id: pick.id, status: 'pending', matchLabel: pick.matchLabel });
        continue;
      }

      const { homeScore, awayScore } = scoreData;
      const grade = gradeBet(pick.bet, homeScore, awayScore);

      if (!grade) {
        results.push({ id: pick.id, status: 'ungraded', matchLabel: pick.matchLabel, reason: 'Bet type not auto-recognizable' });
        continue;
      }

      const won = grade === 'win' ? true : grade === 'loss' ? false : 'push';
      const pnl = won === true
        ? pick.kellyHalf * (pick.decimalOdds - 1)
        : won === false
        ? -pick.kellyHalf
        : 0;

      const idx = picks.findIndex(p => p.id === pick.id);
      picks[idx] = {
        ...picks[idx],
        actualScore: `${homeScore}-${awayScore}`,
        won,
        graded: true,
        gradedAt: new Date().toISOString(),
        gradedBy: 'auto',
        pnl,
        result: grade,
      };

      gradedCount++;
      results.push({
        id: pick.id, status: 'graded', matchLabel: pick.matchLabel,
        score: `${homeScore}-${awayScore}`, bet: pick.bet, result: grade, pnl,
      });

    } catch (err) {
      results.push({ id: pick.id, status: 'error', matchLabel: pick.matchLabel, error: err.message });
    }
  }

  savePicks(picks);
  return res.status(200).json({ graded: gradedCount, total: pending.length, results });
}
