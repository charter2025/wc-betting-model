// pages/api/analysis.js
// Calls Claude every 24h to refresh World Cup betting analysis.
// Cache stored in /tmp (Vercel ephemeral) with timestamp check.

import { ALL_MATCHES } from '../../lib/model';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory cache (persists within same serverless instance lifetime)
let memCache = null;
let cacheTimestamp = 0;

function getTodayMatches() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  return ALL_MATCHES.filter(m => {
    if (m.result) return false; // skip completed
    return m.date === todayStr || m.date === tomorrowStr;
  }).slice(0, 6); // limit to 6 upcoming
}

function buildPrompt(matches) {
  const today = new Date().toISOString().split('T')[0];
  const matchList = matches.map(m =>
    `- ${m.home} vs ${m.away} (Group ${m.group}) | ${m.venue} | ${m.time} | Base xG: ${m.hXG} home / ${m.aXG} away`
  ).join('\n');

  return `You are a quantitative sports betting analyst for the 2026 FIFA World Cup. Today is ${today}.

Analyze these upcoming World Cup matches and provide sharp, data-driven betting edges. For each match, search your knowledge for:
1. Latest injury news and lineup changes (as of ${today})
2. Recent form (last 5 matches with scores)
3. Head-to-head record
4. Weather/venue factors
5. Tactical mismatches
6. Any market inefficiencies vs the base xG priors

MATCHES TO ANALYZE:
${matchList}

For each match, respond with JSON only (no preamble, no markdown fences):
{
  "lastUpdated": "${today}",
  "matches": [
    {
      "id": "match_id_from_list",
      "homeTeam": "Team Name",
      "awayTeam": "Team Name",
      "adjustedHomeXG": 1.23,
      "adjustedAwayXG": 0.87,
      "injuryNotes": "brief injury summary",
      "formNotes": "brief recent form",
      "keyEdge": "one-sentence sharpest betting edge",
      "bestBet": "e.g. Under 2.5 Goals",
      "bestBetOdds": -120,
      "confidence": 72,
      "topFactors": ["factor1", "factor2", "factor3"]
    }
  ],
  "tournamentInsight": "2-3 sentence macro view on tournament trends and value"
}

Use the match IDs: ${matches.map(m => m.id).join(', ')}
Base xG values are priors — adjust UP or DOWN based on injuries, form, and tactical intel.
Confidence = model win probability for the bestBet (0-100).`;
}

export default async function handler(req, res) {
  // Allow CORS for same-origin
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Check cache
  const now = Date.now();
  if (memCache && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return res.status(200).json({ ...memCache, fromCache: true, cacheAge: Math.floor((now - cacheTimestamp) / 60000) });
  }

  const matches = getTodayMatches();

  if (matches.length === 0) {
    // No upcoming matches — return all remaining group stage matches
    const upcoming = ALL_MATCHES.filter(m => !m.result).slice(0, 6);
    if (upcoming.length === 0) {
      return res.status(200).json({ matches: [], tournamentInsight: "Group stage complete.", lastUpdated: new Date().toISOString() });
    }
    matches.push(...upcoming.slice(0, 6));
  }

  try {
    const prompt = buildPrompt(matches);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
        system: 'You are a quantitative sports betting analyst. Respond ONLY with valid JSON. No markdown, no preamble, no explanation outside the JSON structure.'
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.content?.[0]?.text || '{}';

    // Strip any accidental markdown fences
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Merge parsed AI analysis back with full match data
    const enriched = parsed.matches?.map(aiMatch => {
      const base = ALL_MATCHES.find(m => m.id === aiMatch.id) || {};
      return { ...base, ...aiMatch };
    }) || [];

    const result = {
      ...parsed,
      matches: enriched,
      allMatches: ALL_MATCHES,
      fromCache: false,
      generatedAt: new Date().toISOString(),
    };

    // Store in memory cache
    memCache = result;
    cacheTimestamp = now;

    return res.status(200).json(result);

  } catch (err) {
    console.error('Analysis API error:', err);

    // Fallback: return base model data without AI enrichment
    const fallback = {
      matches: matches,
      allMatches: ALL_MATCHES,
      tournamentInsight: "Live AI analysis temporarily unavailable. Showing base Poisson model data.",
      lastUpdated: new Date().toISOString(),
      fromCache: false,
      error: err.message,
    };
    return res.status(200).json(fallback);
  }
}
