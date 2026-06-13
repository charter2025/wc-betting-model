// lib/model.js
// Poisson + Monte Carlo betting model for World Cup 2026

// ─── FULL TOURNAMENT SCHEDULE ────────────────────────────────────────────────
// All 48 group stage matches with base xG priors.
// Attack/Defense values are composites from:
//   qualifying xG, recent friendlies, FIFA rankings, and injury-adjusted squad depth.
// These are seeded priors — the AI analysis layer enriches them on each 24h refresh.

export const ALL_MATCHES = [
  // ── GROUP A ──
  { id: "mex_sa",   date: "2026-06-11", home: "Mexico",       away: "South Africa", group: "A", hXG: 1.85, aXG: 0.70, venue: "Mexico City",    time: "1:00 PM CT",   result: "2-0" },
  { id: "kor_cze",  date: "2026-06-11", home: "South Korea",  away: "Czechia",      group: "A", hXG: 1.55, aXG: 1.30, venue: "Guadalajara",    time: "8:00 PM CT",   result: "2-1" },
  { id: "mex_kor",  date: "2026-06-17", home: "Mexico",       away: "South Korea",  group: "A", hXG: 1.60, aXG: 1.45, venue: "Dallas",         time: "TBD" },
  { id: "cze_sa",   date: "2026-06-17", home: "Czechia",      away: "South Africa", group: "A", hXG: 1.50, aXG: 0.85, venue: "Toronto",        time: "TBD" },
  { id: "mex_cze",  date: "2026-06-22", home: "Mexico",       away: "Czechia",      group: "A", hXG: 1.65, aXG: 1.25, venue: "Dallas",         time: "TBD" },
  { id: "kor_sa",   date: "2026-06-22", home: "South Korea",  away: "South Africa", group: "A", hXG: 1.55, aXG: 0.75, venue: "Kansas City",    time: "TBD" },

  // ── GROUP B ──
  { id: "can_bih",  date: "2026-06-12", home: "Canada",       away: "Bosnia",       group: "B", hXG: 1.55, aXG: 1.35, venue: "Toronto",        time: "3:00 PM ET" },
  { id: "qat_sui",  date: "2026-06-13", home: "Qatar",        away: "Switzerland",  group: "B", hXG: 0.45, aXG: 1.82, venue: "Santa Clara",    time: "3:00 PM ET" },
  { id: "sui_bih",  date: "2026-06-18", home: "Switzerland",  away: "Bosnia",       group: "B", hXG: 1.70, aXG: 1.25, venue: "Seattle",        time: "TBD" },
  { id: "qat_can",  date: "2026-06-18", home: "Qatar",        away: "Canada",       group: "B", hXG: 0.60, aXG: 1.65, venue: "Houston",        time: "TBD" },
  { id: "sui_can",  date: "2026-06-24", home: "Switzerland",  away: "Canada",       group: "B", hXG: 1.55, aXG: 1.50, venue: "Atlanta",        time: "TBD" },
  { id: "bih_qat",  date: "2026-06-24", home: "Bosnia",       away: "Qatar",        group: "B", hXG: 1.55, aXG: 0.55, venue: "Vancouver",      time: "TBD" },

  // ── GROUP C ──
  { id: "bra_mar",  date: "2026-06-13", home: "Brazil",       away: "Morocco",      group: "C", hXG: 0.94, aXG: 0.72, venue: "MetLife (NJ)",   time: "6:00 PM ET" },
  { id: "hai_sco",  date: "2026-06-13", home: "Haiti",        away: "Scotland",     group: "C", hXG: 0.68, aXG: 1.78, venue: "Gillette (BOS)", time: "9:00 PM ET" },
  { id: "bra_hai",  date: "2026-06-20", home: "Brazil",       away: "Haiti",        group: "C", hXG: 2.10, aXG: 0.50, venue: "Philadelphia",   time: "TBD" },
  { id: "mar_sco",  date: "2026-06-19", home: "Morocco",      away: "Scotland",     group: "C", hXG: 1.30, aXG: 1.55, venue: "Atlanta",        time: "TBD" },
  { id: "sco_bra",  date: "2026-06-24", home: "Scotland",     away: "Brazil",       group: "C", hXG: 1.10, aXG: 1.65, venue: "Dallas",         time: "TBD" },
  { id: "hai_mar",  date: "2026-06-24", home: "Haiti",        away: "Morocco",      group: "C", hXG: 0.55, aXG: 1.55, venue: "MetLife (NJ)",   time: "TBD" },

  // ── GROUP D ──
  { id: "usa_par",  date: "2026-06-12", home: "USA",          away: "Paraguay",     group: "D", hXG: 1.70, aXG: 1.05, venue: "Los Angeles",    time: "9:00 PM ET" },
  { id: "aus_tur",  date: "2026-06-14", home: "Australia",    away: "Türkiye",      group: "D", hXG: 1.20, aXG: 1.45, venue: "Vancouver",      time: "12:00 AM ET" },
  { id: "usa_aus",  date: "2026-06-19", home: "USA",          away: "Australia",    group: "D", hXG: 1.80, aXG: 1.10, venue: "Houston",        time: "TBD" },
  { id: "par_tur",  date: "2026-06-19", home: "Paraguay",     away: "Türkiye",      group: "D", hXG: 1.10, aXG: 1.40, venue: "Kansas City",    time: "TBD" },
  { id: "tur_usa",  date: "2026-06-25", home: "Türkiye",      away: "USA",          group: "D", hXG: 1.35, aXG: 1.75, venue: "Dallas",         time: "TBD" },
  { id: "par_aus",  date: "2026-06-25", home: "Paraguay",     away: "Australia",    group: "D", hXG: 1.10, aXG: 1.20, venue: "San Francisco",  time: "TBD" },

  // ── GROUP E ──
  { id: "ger_cur",  date: "2026-06-14", home: "Germany",      away: "Curaçao",      group: "E", hXG: 2.40, aXG: 0.25, venue: "Houston",        time: "1:00 PM ET" },
  { id: "civ_ecu",  date: "2026-06-14", home: "Ivory Coast",  away: "Ecuador",      group: "E", hXG: 1.45, aXG: 1.30, venue: "Philadelphia",   time: "7:00 PM ET" },
  { id: "ger_civ",  date: "2026-06-20", home: "Germany",      away: "Ivory Coast",  group: "E", hXG: 1.90, aXG: 1.25, venue: "Toronto",        time: "TBD" },
  { id: "ecu_cur",  date: "2026-06-20", home: "Ecuador",      away: "Curaçao",      group: "E", hXG: 1.65, aXG: 0.35, venue: "Kansas City",    time: "TBD" },
  { id: "ecu_ger",  date: "2026-06-25", home: "Ecuador",      away: "Germany",      group: "E", hXG: 1.05, aXG: 2.00, venue: "MetLife (NJ)",   time: "TBD" },
  { id: "cur_civ",  date: "2026-06-25", home: "Curaçao",      away: "Ivory Coast",  group: "E", hXG: 0.45, aXG: 1.65, venue: "Seattle",        time: "TBD" },

  // ── GROUP F ──
  { id: "ned_jpn",  date: "2026-06-14", home: "Netherlands",  away: "Japan",        group: "F", hXG: 1.80, aXG: 1.55, venue: "Dallas",         time: "4:00 PM ET" },
  { id: "swe_tun",  date: "2026-06-14", home: "Sweden",       away: "Tunisia",      group: "F", hXG: 1.55, aXG: 1.10, venue: "Monterrey",      time: "10:00 PM ET" },
  { id: "ned_swe",  date: "2026-06-20", home: "Netherlands",  away: "Sweden",       group: "F", hXG: 1.70, aXG: 1.45, venue: "Houston",        time: "TBD" },
  { id: "tun_jpn",  date: "2026-06-20", home: "Tunisia",      away: "Japan",        group: "F", hXG: 1.05, aXG: 1.60, venue: "Monterrey",      time: "TBD" },
  { id: "jpn_swe",  date: "2026-06-25", home: "Japan",        away: "Sweden",       group: "F", hXG: 1.50, aXG: 1.55, venue: "Dallas",         time: "TBD" },
  { id: "tun_ned",  date: "2026-06-25", home: "Tunisia",      away: "Netherlands",  group: "F", hXG: 1.00, aXG: 1.90, venue: "Kansas City",    time: "TBD" },

  // ── GROUP G ──
  { id: "bel_egy",  date: "2026-06-15", home: "Belgium",      away: "Egypt",        group: "G", hXG: 1.85, aXG: 0.95, venue: "Seattle",        time: "3:00 PM ET" },
  { id: "ira_nzl",  date: "2026-06-15", home: "Iran",         away: "New Zealand",  group: "G", hXG: 1.20, aXG: 0.85, venue: "Los Angeles",    time: "9:00 PM ET" },
  { id: "bel_ira",  date: "2026-06-21", home: "Belgium",      away: "Iran",         group: "G", hXG: 1.90, aXG: 0.95, venue: "Los Angeles",    time: "TBD" },
  { id: "nzl_egy",  date: "2026-06-21", home: "New Zealand",  away: "Egypt",        group: "G", hXG: 0.85, aXG: 1.10, venue: "Vancouver",      time: "TBD" },
  { id: "egy_ira",  date: "2026-06-26", home: "Egypt",        away: "Iran",         group: "G", hXG: 1.15, aXG: 1.10, venue: "Seattle",        time: "TBD" },
  { id: "nzl_bel",  date: "2026-06-26", home: "New Zealand",  away: "Belgium",      group: "G", hXG: 0.60, aXG: 2.10, venue: "Vancouver",      time: "TBD" },

  // ── GROUP H ──
  { id: "esp_cpv",  date: "2026-06-15", home: "Spain",        away: "Cape Verde",   group: "H", hXG: 2.15, aXG: 0.60, venue: "Atlanta",        time: "12:00 PM ET" },
  { id: "ksa_uru",  date: "2026-06-15", home: "Saudi Arabia", away: "Uruguay",      group: "H", hXG: 1.05, aXG: 1.55, venue: "Miami",          time: "6:00 PM ET" },
  { id: "esp_ksa",  date: "2026-06-21", home: "Spain",        away: "Saudi Arabia", group: "H", hXG: 2.20, aXG: 0.85, venue: "Los Angeles",    time: "TBD" },
  { id: "uru_cpv",  date: "2026-06-21", home: "Uruguay",      away: "Cape Verde",   group: "H", hXG: 1.70, aXG: 0.70, venue: "Dallas",         time: "TBD" },
  { id: "ksa_cpv",  date: "2026-06-26", home: "Saudi Arabia", away: "Cape Verde",   group: "H", hXG: 1.45, aXG: 0.75, venue: "Seattle",        time: "TBD" },
  { id: "uru_esp",  date: "2026-06-26", home: "Uruguay",      away: "Spain",        group: "H", hXG: 1.20, aXG: 1.85, venue: "Houston",        time: "TBD" },

  // ── GROUP I ──
  { id: "fra_sen",  date: "2026-06-16", home: "France",       away: "Senegal",      group: "I", hXG: 2.05, aXG: 1.10, venue: "MetLife (NJ)",   time: "3:00 PM ET" },
  { id: "irq_nor",  date: "2026-06-16", home: "Iraq",         away: "Norway",       group: "I", hXG: 0.90, aXG: 1.65, venue: "Gillette (BOS)", time: "6:00 PM ET" },
  { id: "fra_irq",  date: "2026-06-22", home: "France",       away: "Iraq",         group: "I", hXG: 2.30, aXG: 0.55, venue: "Dallas",         time: "TBD" },
  { id: "nor_sen",  date: "2026-06-22", home: "Norway",       away: "Senegal",      group: "I", hXG: 1.55, aXG: 1.20, venue: "Philadelphia",   time: "TBD" },
  { id: "nor_fra",  date: "2026-06-27", home: "Norway",       away: "France",       group: "I", hXG: 1.30, aXG: 1.90, venue: "Atlanta",        time: "TBD" },
  { id: "irq_sen",  date: "2026-06-27", home: "Iraq",         away: "Senegal",      group: "I", hXG: 0.85, aXG: 1.35, venue: "Houston",        time: "TBD" },

  // ── GROUP J ──
  { id: "arg_alg",  date: "2026-06-16", home: "Argentina",    away: "Algeria",      group: "J", hXG: 2.10, aXG: 0.85, venue: "Kansas City",    time: "9:00 PM ET" },
  { id: "aut_jor",  date: "2026-06-16", home: "Austria",      away: "Jordan",       group: "J", hXG: 1.70, aXG: 0.80, venue: "Santa Clara",    time: "12:00 AM ET" },
  { id: "arg_aut",  date: "2026-06-22", home: "Argentina",    away: "Austria",      group: "J", hXG: 1.90, aXG: 1.40, venue: "Dallas",         time: "TBD" },
  { id: "jor_alg",  date: "2026-06-22", home: "Jordan",       away: "Algeria",      group: "J", hXG: 0.90, aXG: 1.20, venue: "Seattle",        time: "TBD" },
  { id: "aut_alg",  date: "2026-06-27", home: "Austria",      away: "Algeria",      group: "J", hXG: 1.55, aXG: 1.05, venue: "Miami",          time: "TBD" },
  { id: "jor_arg",  date: "2026-06-27", home: "Jordan",       away: "Argentina",    group: "J", hXG: 0.60, aXG: 2.20, venue: "Los Angeles",    time: "TBD" },

  // ── GROUP K ──
  { id: "por_alb",  date: "2026-06-17", home: "Portugal",     away: "Albania",      group: "K", hXG: 2.10, aXG: 0.70, venue: "Kansas City",    time: "TBD" },
  { id: "chn_uga",  date: "2026-06-17", home: "China",        away: "Uganda",       group: "K", hXG: 1.20, aXG: 0.90, venue: "Seattle",        time: "TBD" },
  { id: "por_chn",  date: "2026-06-23", home: "Portugal",     away: "China",        group: "K", hXG: 2.00, aXG: 0.85, venue: "Boston",         time: "TBD" },
  { id: "uga_alb",  date: "2026-06-23", home: "Uganda",       away: "Albania",      group: "K", hXG: 0.85, aXG: 1.20, venue: "Atlanta",        time: "TBD" },
  { id: "chn_alb",  date: "2026-06-27", home: "China",        away: "Albania",      group: "K", hXG: 1.15, aXG: 1.25, venue: "Houston",        time: "TBD" },
  { id: "uga_por",  date: "2026-06-27", home: "Uganda",       away: "Portugal",     group: "K", hXG: 0.55, aXG: 2.15, venue: "Dallas",         time: "TBD" },

  // ── GROUP L ──
  { id: "eng_tun2", date: "2026-06-17", home: "England",      away: "Tunisia",      group: "L", hXG: 1.95, aXG: 0.90, venue: "Miami",          time: "TBD" },
  { id: "gha_pan",  date: "2026-06-17", home: "Ghana",        away: "Panama",       group: "L", hXG: 1.30, aXG: 1.05, venue: "Los Angeles",    time: "TBD" },
  { id: "eng_gha",  date: "2026-06-23", home: "England",      away: "Ghana",        group: "L", hXG: 2.00, aXG: 0.95, venue: "Philadelphia",   time: "TBD" },
  { id: "pan_tun2", date: "2026-06-23", home: "Panama",       away: "Tunisia",      group: "L", hXG: 1.00, aXG: 1.20, venue: "Vancouver",      time: "TBD" },
  { id: "eng_pan",  date: "2026-06-27", home: "England",      away: "Panama",       group: "L", hXG: 2.10, aXG: 0.70, venue: "Kansas City",    time: "TBD" },
  { id: "gha_tun2", date: "2026-06-27", home: "Ghana",        away: "Tunisia",      group: "L", hXG: 1.25, aXG: 1.10, venue: "Houston",        time: "TBD" },
];

// ─── POISSON ENGINE ───────────────────────────────────────────────────────────
function poissonPMF(lambda, k) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 1; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

export function computeScoreMatrix(lambdaA, lambdaB, maxGoals = 7) {
  const matrix = [];
  for (let a = 0; a <= maxGoals; a++) {
    matrix[a] = [];
    for (let b = 0; b <= maxGoals; b++) {
      // Dixon-Coles correction for low-scoring cells
      let rho = 1.0;
      if (a === 0 && b === 0) rho = 1 - lambdaA * lambdaB * 0.05;
      else if (a === 1 && b === 0) rho = 1 + lambdaB * 0.05;
      else if (a === 0 && b === 1) rho = 1 + lambdaA * 0.05;
      else if (a === 1 && b === 1) rho = 1 - 0.05;
      matrix[a][b] = rho * poissonPMF(lambdaA, a) * poissonPMF(lambdaB, b);
    }
  }
  return matrix;
}

export function sumOutcomes(matrix, maxGoals = 7) {
  let home = 0, draw = 0, away = 0;
  for (let a = 0; a <= maxGoals; a++) {
    for (let b = 0; b <= maxGoals; b++) {
      const p = matrix[a][b];
      if (a > b) home += p;
      else if (a === b) draw += p;
      else away += p;
    }
  }
  const total = home + draw + away;
  return { home: home / total, draw: draw / total, away: away / total };
}

export function impliedProb(americanOdds) {
  if (americanOdds < 0) return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  return 100 / (americanOdds + 100);
}

export function americanToDecimal(odds) {
  if (odds < 0) return 1 + 100 / Math.abs(odds);
  return 1 + odds / 100;
}

export function kellyFraction(modelProb, americanOdds) {
  const dec = americanToDecimal(americanOdds);
  const b = dec - 1;
  const q = 1 - modelProb;
  const k = (b * modelProb - q) / b;
  return Math.max(0, k);
}

export function samplePoisson(lambda) {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

export function runMonteCarlo(lambdaA, lambdaB, n = 30000) {
  let home = 0, draw = 0, away = 0;
  const goalDist = {};
  const scorelines = {};
  let btts = 0;

  for (let i = 0; i < n; i++) {
    const a = samplePoisson(lambdaA);
    const b = samplePoisson(lambdaB);
    if (a > b) home++;
    else if (a === b) draw++;
    else away++;
    const t = a + b;
    goalDist[t] = (goalDist[t] || 0) + 1;
    const key = `${a}-${b}`;
    scorelines[key] = (scorelines[key] || 0) + 1;
    if (a >= 1 && b >= 1) btts++;
  }

  const topScores = Object.entries(scorelines)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([score, count]) => ({ score, prob: count / n }));

  const under25 = Object.entries(goalDist)
    .filter(([k]) => parseInt(k) <= 2)
    .reduce((s, [, v]) => s + v / n, 0);

  return {
    home: home / n, draw: draw / n, away: away / n,
    goalDist: Object.fromEntries(Object.entries(goalDist).map(([k, v]) => [k, v / n])),
    topScores,
    under25,
    over25: 1 - under25,
    btts: btts / n,
  };
}
