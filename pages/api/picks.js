// pages/api/picks.js
// Persistent pick storage using a simple JSON file in /tmp (Vercel ephemeral)
// For production persistence, swap the file store with a KV store (Vercel KV / Upstash)

import fs from 'fs';
import path from 'path';

const PICKS_FILE = path.join('/tmp', 'wc_picks.json');

function loadPicks() {
  try {
    if (fs.existsSync(PICKS_FILE)) {
      return JSON.parse(fs.readFileSync(PICKS_FILE, 'utf8'));
    }
  } catch {}
  return [];
}

function savePicks(picks) {
  fs.writeFileSync(PICKS_FILE, JSON.stringify(picks, null, 2));
}

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — return all picks
  if (req.method === 'GET') {
    return res.status(200).json(loadPicks());
  }

  // POST — save a new pick snapshot
  if (req.method === 'POST') {
    const picks = loadPicks();
    const newPick = {
      id: `pick_${Date.now()}`,
      savedAt: new Date().toISOString(),
      ...req.body,
      result: null,      // filled in later
      pnl: null,
      graded: false,
    };
    picks.push(newPick);
    savePicks(picks);
    return res.status(200).json(newPick);
  }

  // PUT — grade a pick (fill in actual result)
  if (req.method === 'PUT') {
    const picks = loadPicks();
    const { id, result, actualScore, won } = req.body;
    const idx = picks.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Pick not found' });

    picks[idx] = {
      ...picks[idx],
      result,
      actualScore,
      won,
      graded: true,
      gradedAt: new Date().toISOString(),
      // PnL in units (1 unit = 1% bankroll)
      pnl: won
        ? picks[idx].kellyHalf * (picks[idx].decimalOdds - 1)
        : -picks[idx].kellyHalf,
    };
    savePicks(picks);
    return res.status(200).json(picks[idx]);
  }

  // DELETE — remove a pick
  if (req.method === 'DELETE') {
    const picks = loadPicks();
    const { id } = req.body;
    savePicks(picks.filter(p => p.id !== id));
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
