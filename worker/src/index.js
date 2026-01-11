const PLATFORM_BY_REGION = {
  na: "na1",
  euw: "euw1",
  eune: "eun1",
  kr: "kr",
  br: "br1",
  la1: "la1",
  la2: "la2",
  oc1: "oc1",
  tr: "tr1",
  ru: "ru"
};

const REGION_BY_PLATFORM = {
  na1: "americas",
  br1: "americas",
  la1: "americas",
  la2: "americas",
  oc1: "americas",
  euw1: "europe",
  eun1: "europe",
  tr1: "europe",
  ru: "europe",
  kr: "asia",
  jp1: "asia"
};

const ARENA_QUEUES = new Set([1700, 1701, 1702, 1710]);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

function jsonResponse(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
      ...extraHeaders
    }
  });
}

async function probeRiotStatus(platform, env) {
  if (!env.RIOT_API_KEY) {
    return { ok: false, status: 0, error: "missing key" };
  }
  const url = `https://${platform}.api.riotgames.com/lol/status/v4/platform-data`;
  try {
    const response = await fetch(url, {
      headers: { "X-Riot-Token": env.RIOT_API_KEY }
    });
    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    const payload = { ok: response.ok, status: response.status };
    if (!response.ok) {
      payload.body = body;
    }
    return payload;
  } catch (error) {
    return { ok: false, status: 0, error: error.message || "probe failed" };
  }
}

async function probeSummoner(platform, env, name) {
  if (!env.RIOT_API_KEY) {
    return { ok: false, status: 0, error: "missing key" };
  }
  const safeName = (name || "").trim();
  if (!safeName) {
    return { ok: false, status: 0, error: "missing summoner name" };
  }
  const url = `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-name/${encodeURIComponent(safeName)}`;
  try {
    const response = await fetch(url, {
      headers: { "X-Riot-Token": env.RIOT_API_KEY }
    });
    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    const payload = { ok: response.ok, status: response.status };
    if (!response.ok) {
      payload.body = body;
    } else {
      payload.body = { name: body?.name, puuid: body?.puuid };
    }
    return payload;
  } catch (error) {
    return { ok: false, status: 0, error: error.message || "probe failed" };
  }
}

async function probeAccountByRiotId(region, env, riotId) {
  if (!env.RIOT_API_KEY) {
    return { ok: false, status: 0, error: "missing key" };
  }
  const parsed = parseRiotId(riotId);
  if (!parsed) {
    return { ok: false, status: 0, error: "invalid riot id" };
  }
  const url = `https://${region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(parsed.gameName)}/${encodeURIComponent(parsed.tagLine)}`;
  try {
    const response = await fetch(url, {
      headers: { "X-Riot-Token": env.RIOT_API_KEY }
    });
    const text = await response.text();
    let body = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    const payload = { ok: response.ok, status: response.status };
    if (!response.ok) {
      payload.body = body;
    } else {
      payload.body = { gameName: body?.gameName, tagLine: body?.tagLine, puuid: body?.puuid };
    }
    return payload;
  } catch (error) {
    return { ok: false, status: 0, error: error.message || "probe failed" };
  }
}

function normalizeName(value, fallback) {
  const cleaned = (value || "").trim();
  return cleaned ? cleaned : fallback;
}

function normalizeRegion(value, fallback) {
  const cleaned = (value || "").trim().toLowerCase();
  return PLATFORM_BY_REGION[cleaned] ? cleaned : fallback;
}

function normalizeTone(value) {
  const cleaned = (value || "").trim().toLowerCase();
  if (cleaned === "gentle" || cleaned === "savage") return cleaned;
  return "classic";
}

function parseRiotId(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;
  if (trimmed.includes("#")) {
    const [gameName, tagLine] = trimmed.split("#");
    if (gameName && tagLine) {
      return { gameName: gameName.trim(), tagLine: tagLine.trim() };
    }
  }
  const dashIndex = trimmed.lastIndexOf("-");
  if (dashIndex > 0) {
    const gameName = trimmed.slice(0, dashIndex).trim();
    const tagLine = trimmed.slice(dashIndex + 1).trim();
    if (gameName && /^[A-Za-z0-9]{2,5}$/.test(tagLine)) {
      return { gameName, tagLine };
    }
  }
  return null;
}

function safeNumber(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatPercent(value) {
  return Math.round(value * 100) + "%";
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString("en-US");
}

function formatChampion(name) {
  if (!name) return "unknown";
  return name.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function pickVariant(list, seed) {
  if (!list || list.length === 0) return "";
  if (Number.isFinite(seed)) {
    const index = Math.abs(Math.floor(seed)) % list.length;
    return list[index];
  }
  return list[Math.floor(Math.random() * list.length)];
}

function hashString(value) {
  const text = String(value || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const ANVIL_CHAMPION_KEYS = new Set([
  "twistedfate",
  "ornn",
  "pyke",
  "gangplank"
]);

function formatFirsts(count) {
  const safe = Number.isFinite(count) ? count : 0;
  if (safe === 0) return "no first-place finishes yet";
  if (safe === 1) return "1 first-place finish";
  return `${safe} first-place finishes`;
}

function countItems(participant) {
  let count = 0;
  for (let slot = 0; slot <= 5; slot += 1) {
    const id = participant[`item${slot}`] || 0;
    if (id > 0) count += 1;
  }
  return count;
}

function isAnvilChampion(name) {
  const key = normalizeChampionKey(name);
  return ANVIL_CHAMPION_KEYS.has(key);
}

function pickTopAnvilChampion(counts) {
  let top = { name: "", count: 0 };
  Object.entries(counts || {}).forEach(([name, count]) => {
    if (!isAnvilChampion(name)) return;
    if (count > top.count) {
      top = { name, count };
    }
  });
  return top;
}

function smallSamplePrefix(games) {
  if (!Number.isFinite(games) || games < 8) return "small sample size, but ";
  return "";
}

function buildFallbackInsights(summary, matches) {
  const placements = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
  let top4Streak = 0;
  let bottom4Streak = 0;
  let currentTop4 = 0;
  let currentBottom4 = 0;

  (matches || []).forEach((match) => {
    const placement = match.placement || 0;
    if (placement >= 1 && placement <= 8) {
      placements[placement] = (placements[placement] || 0) + 1;
    }
    if (placement > 0 && placement <= 4) {
      currentTop4 += 1;
      currentBottom4 = 0;
      if (currentTop4 > top4Streak) top4Streak = currentTop4;
    } else if (placement >= 5) {
      currentBottom4 += 1;
      currentTop4 = 0;
      if (currentBottom4 > bottom4Streak) bottom4Streak = currentBottom4;
    }
  });

  return {
    placements,
    streaks: { top4: top4Streak, bottom4: bottom4Streak },
    kills: { me: 0, duo: 0, total: 0 },
    assists: { me: 0, duo: 0, total: 0 },
    deaths: { me: 0, duo: 0, total: 0 },
    damage: { me: 0, duo: 0, total: 0 },
    damageTaken: { me: 0, duo: 0, total: 0 },
    healing: { me: 0, duo: 0, total: 0 },
    shielding: { me: 0, duo: 0, total: 0 },
    support: { me: 0, duo: 0, total: 0 },
    gold: { me: 0, duo: 0, total: 0 },
    shares: {
      kills: { me: 0, duo: 0 },
      assists: { me: 0, duo: 0 },
      deaths: { me: 0, duo: 0 },
      damage: { me: 0, duo: 0 },
      tank: { me: 0, duo: 0 },
      healing: { me: 0, duo: 0 },
      shielding: { me: 0, duo: 0 },
      support: { me: 0, duo: 0 }
    },
    perGame: {
      damage: 0,
      damageTaken: 0,
      deaths: 0,
      kills: 0,
      assists: 0
    },
    diversity: { me: 0, duo: 0, combined: 0 },
    meta: null,
    items: { meAvg: 0, duoAvg: 0, lowRate: { me: 0, duo: 0 } },
    anvil: { meRate: 0, duoRate: 0, meTop: "", duoTop: "" },
    flags: { hasCombatStats: false }
  };
}

function normalizeCachedPayload(data) {
  if (!data || !data.summary) return data;
  const summary = data.summary;
  const matches = Array.isArray(data.matches) ? data.matches : [];
  const games = Number.isFinite(summary.games) ? summary.games : matches.length;
  const firsts = Number.isFinite(summary.firsts)
    ? summary.firsts
    : matches.filter((match) => (match.placement || 0) === 1).length;
  summary.games = games;
  summary.firsts = firsts;
  summary.firstRate = formatPercent(games > 0 ? firsts / games : 0);
  if (!Number.isFinite(summary.comfortPickRateValue)) {
    const parsedRate = Number.parseInt(summary.comfortPickRate, 10);
    summary.comfortPickRateValue = Number.isFinite(parsedRate) ? parsedRate / 100 : 0;
  }
  if (!data.insights) {
    data.insights = buildFallbackInsights(summary, matches);
  }
  const insights = data.insights;
  if (!insights.shielding) {
    insights.shielding = { me: 0, duo: 0, total: 0 };
  }
  const supportMe = (insights.healing?.me || 0) + (insights.shielding?.me || 0);
  const supportDuo = (insights.healing?.duo || 0) + (insights.shielding?.duo || 0);
  const supportTotal = supportMe + supportDuo;
  if (!insights.support) {
    insights.support = { me: supportMe, duo: supportDuo, total: supportTotal };
  }
  if (!insights.shares) {
    insights.shares = {
      kills: { me: 0, duo: 0 },
      assists: { me: 0, duo: 0 },
      deaths: { me: 0, duo: 0 },
      damage: { me: 0, duo: 0 },
      tank: { me: 0, duo: 0 },
      healing: { me: 0, duo: 0 },
      shielding: { me: 0, duo: 0 },
      support: { me: 0, duo: 0 }
    };
  }
  if (!insights.shares.healing) {
    const healTotal = insights.healing?.total || 0;
    insights.shares.healing = {
      me: healTotal > 0 ? (insights.healing?.me || 0) / healTotal : 0,
      duo: healTotal > 0 ? (insights.healing?.duo || 0) / healTotal : 0
    };
  }
  if (!insights.shares.shielding) {
    const shieldTotal = insights.shielding?.total || 0;
    insights.shares.shielding = {
      me: shieldTotal > 0 ? (insights.shielding?.me || 0) / shieldTotal : 0,
      duo: shieldTotal > 0 ? (insights.shielding?.duo || 0) / shieldTotal : 0
    };
  }
  if (!insights.shares.support) {
    insights.shares.support = {
      me: supportTotal > 0 ? supportMe / supportTotal : 0,
      duo: supportTotal > 0 ? supportDuo / supportTotal : 0
    };
  }
  const names = data.meta?.duo || { me: "me", duo: "duo" };
  data.blame = buildBlame(summary, names, data.insights);
  if (!Number.isFinite(summary.top4Streak) || !Number.isFinite(summary.bottom4Streak)) {
    const fallbackStreaks = data.insights?.streaks || { top4: 0, bottom4: 0 };
    summary.top4Streak = Number.isFinite(summary.top4Streak) ? summary.top4Streak : fallbackStreaks.top4;
    summary.bottom4Streak = Number.isFinite(summary.bottom4Streak) ? summary.bottom4Streak : fallbackStreaks.bottom4;
  }
  return data;
}

function buildVerdictFingerprint(summary, insights, tone) {
  const avgPlacement = Number.isFinite(summary.avgPlacement) ? summary.avgPlacement.toFixed(2) : "0.00";
  const deathsShare = insights?.shares?.deaths || {};
  return [
    tone,
    summary.games || 0,
    summary.wins || 0,
    summary.firsts || 0,
    avgPlacement,
    deathsShare.me || 0,
    deathsShare.duo || 0,
    insights?.shares?.support?.me || 0,
    insights?.shares?.support?.duo || 0,
    String(summary.comfortBias || "").toLowerCase(),
    String(summary.comfortPick || "").toLowerCase(),
    summary.comfortPickRate || ""
  ].join("|");
}

function buildRoastFingerprint(summary, insights, tone) {
  const avgPlacement = Number.isFinite(summary.avgPlacement) ? summary.avgPlacement.toFixed(2) : "0.00";
  const placements = insights?.placements
    ? Object.values(insights.placements).join(",")
    : "";
  const metaKey = insights?.meta
    ? `${insights.meta.me?.metaRate || 0}:${insights.meta.me?.sRate || 0}:${insights.meta.me?.offMetaRate || 0}:${insights.meta.duo?.metaRate || 0}:${insights.meta.duo?.sRate || 0}:${insights.meta.duo?.offMetaRate || 0}`
    : "";
  return [
    tone,
    summary.games || 0,
    summary.wins || 0,
    summary.firsts || 0,
    avgPlacement,
    insights?.streaks?.top4 || 0,
    insights?.streaks?.bottom4 || 0,
    insights?.damage?.total || 0,
    insights?.damageTaken?.total || 0,
    insights?.healing?.total || 0,
    insights?.shielding?.total || 0,
    insights?.kills?.total || 0,
    insights?.assists?.total || 0,
    insights?.deaths?.total || 0,
    insights?.diversity?.combined || 0,
    placements,
    metaKey,
    insights?.items?.meAvg || 0,
    insights?.items?.duoAvg || 0,
    insights?.items?.lowRate?.me || 0,
    insights?.items?.lowRate?.duo || 0,
    insights?.anvil?.meRate || 0,
    insights?.anvil?.duoRate || 0
  ].join("|");
}

function buildInsights(stats, summary, metaStats) {
  const games = summary.games || 0;
  const sum = (pair) => (pair?.me || 0) + (pair?.duo || 0);
  const share = (value, total) => (total > 0 ? value / total : 0);

  const killsTotal = sum(stats.kills);
  const assistsTotal = sum(stats.assists);
  const deathsTotal = sum(stats.deaths);
  const damageTotal = sum(stats.damage);
  const damageTakenTotal = sum(stats.damageTaken);
  const healingTotal = sum(stats.healing);
  const shieldingTotal = sum(stats.shielding);
  const supportTotal = healingTotal + shieldingTotal;
  const goldTotal = sum(stats.gold);
  const hasCombatStats = damageTotal > 0 || killsTotal > 0 || assistsTotal > 0 || deathsTotal > 0;

  const uniqueMe = Object.keys(stats.champions.me || {}).length;
  const uniqueDuo = Object.keys(stats.champions.duo || {}).length;
  const combinedUnique = new Set([
    ...Object.keys(stats.champions.me || {}),
    ...Object.keys(stats.champions.duo || {})
  ]).size;

  const itemsMeAvg = games > 0 ? stats.items.me / games : 0;
  const itemsDuoAvg = games > 0 ? stats.items.duo / games : 0;
  const lowItemMeRate = games > 0 ? stats.lowItems.me / games : 0;
  const lowItemDuoRate = games > 0 ? stats.lowItems.duo / games : 0;
  const anvilMeRate = games > 0 ? stats.anvilChamps.me / games : 0;
  const anvilDuoRate = games > 0 ? stats.anvilChamps.duo / games : 0;
  const anvilMeTop = pickTopAnvilChampion(stats.champions.me);
  const anvilDuoTop = pickTopAnvilChampion(stats.champions.duo);

  const perGame = (value) => (games > 0 ? Math.round(value / games) : 0);

  return {
    placements: stats.placements,
    streaks: { top4: stats.top4Streak, bottom4: stats.bottom4Streak },
    kills: { me: stats.kills.me, duo: stats.kills.duo, total: killsTotal },
    assists: { me: stats.assists.me, duo: stats.assists.duo, total: assistsTotal },
    deaths: { me: stats.deaths.me, duo: stats.deaths.duo, total: deathsTotal },
    damage: { me: stats.damage.me, duo: stats.damage.duo, total: damageTotal },
    damageTaken: { me: stats.damageTaken.me, duo: stats.damageTaken.duo, total: damageTakenTotal },
    healing: { me: stats.healing.me, duo: stats.healing.duo, total: healingTotal },
    shielding: { me: stats.shielding.me, duo: stats.shielding.duo, total: shieldingTotal },
    support: {
      me: (stats.healing.me || 0) + (stats.shielding.me || 0),
      duo: (stats.healing.duo || 0) + (stats.shielding.duo || 0),
      total: supportTotal
    },
    gold: { me: stats.gold.me, duo: stats.gold.duo, total: goldTotal },
    shares: {
      kills: { me: share(stats.kills.me, killsTotal), duo: share(stats.kills.duo, killsTotal) },
      assists: { me: share(stats.assists.me, assistsTotal), duo: share(stats.assists.duo, assistsTotal) },
      deaths: { me: share(stats.deaths.me, deathsTotal), duo: share(stats.deaths.duo, deathsTotal) },
      damage: { me: share(stats.damage.me, damageTotal), duo: share(stats.damage.duo, damageTotal) },
      tank: { me: share(stats.damageTaken.me, damageTakenTotal), duo: share(stats.damageTaken.duo, damageTakenTotal) },
      healing: { me: share(stats.healing.me, healingTotal), duo: share(stats.healing.duo, healingTotal) },
      shielding: { me: share(stats.shielding.me, shieldingTotal), duo: share(stats.shielding.duo, shieldingTotal) },
      support: {
        me: share((stats.healing.me || 0) + (stats.shielding.me || 0), supportTotal),
        duo: share((stats.healing.duo || 0) + (stats.shielding.duo || 0), supportTotal)
      }
    },
    perGame: {
      damage: perGame(damageTotal),
      damageTaken: perGame(damageTakenTotal),
      deaths: perGame(deathsTotal),
      kills: perGame(killsTotal),
      assists: perGame(assistsTotal)
    },
    diversity: { me: uniqueMe, duo: uniqueDuo, combined: combinedUnique },
    meta: metaStats,
    items: {
      meAvg: Math.round(itemsMeAvg * 10) / 10,
      duoAvg: Math.round(itemsDuoAvg * 10) / 10,
      lowRate: { me: lowItemMeRate, duo: lowItemDuoRate }
    },
    anvil: {
      meRate: anvilMeRate,
      duoRate: anvilDuoRate,
      meTop: formatChampion(anvilMeTop.name || ""),
      duoTop: formatChampion(anvilDuoTop.name || "")
    },
    flags: { hasCombatStats }
  };
}

function extractJsonBlock(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function normalizeAiRoasts(roasts, fallback) {
  if (!Array.isArray(roasts)) return fallback;
  const cleaned = [];
  const seen = new Set();
  roasts.forEach((roast) => {
    const title = collapseWhitespace(roast?.title || "");
    const body = collapseWhitespace(roast?.body || "");
    if (!title || !body) return;
    const key = title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    cleaned.push({ title: title.toLowerCase(), body });
  });
  if (cleaned.length < 3) return fallback;
  return cleaned.slice(0, 4);
}

function seededRandom(seed) {
  let value = Math.floor(seed) % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function shuffleWithSeed(list, seed) {
  const output = list.slice();
  const random = Number.isFinite(seed) ? seededRandom(seed) : Math.random;
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

function parseJsonLenient(raw) {
  if (!raw) throw new Error("empty json");
  try {
    return JSON.parse(raw);
  } catch (error) {
    const block = extractJsonBlock(raw);
    const text = block || raw;
    const cleaned = text.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(cleaned);
  }
}

function collapseWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

async function generateAiVerdict(summary, names, tone, insights, env) {
  const model = env.OPENAI_MODEL || "gpt-4o-mini";
  const games = summary.games || 0;
  const wins = summary.wins || 0;
  const losses = Math.max(games - wins, 0);
  const avgPlacement = Number.isFinite(summary.avgPlacement) ? Number(summary.avgPlacement.toFixed(2)) : 0;
  const shares = insights?.shares || {};
  const deaths = insights?.deaths || {};
  const hasCombatStats = Boolean(insights?.flags?.hasCombatStats);
  const support = insights?.support || {};
  const promptPayload = {
    players: [names.me, names.duo],
    tone,
    arenaContext: "2v2v2v2v2v2v2v2, 8 teams, top 4 is a win, 1st is the crown",
    facts: {
      games,
      top4Wins: wins,
      bottom4Losses: losses,
      top4Rate: formatPercent(summary.winRate),
      firsts: summary.firsts || 0,
      avgPlacement,
      deaths: hasCombatStats
        ? {
            me: deaths.me || 0,
            duo: deaths.duo || 0,
            share: {
              me: formatPercent(shares.deaths?.me || 0),
              duo: formatPercent(shares.deaths?.duo || 0)
            }
          }
        : null,
      shares: hasCombatStats
        ? {
            damage: {
              me: formatPercent(shares.damage?.me || 0),
              duo: formatPercent(shares.damage?.duo || 0)
            },
            tank: {
              me: formatPercent(shares.tank?.me || 0),
              duo: formatPercent(shares.tank?.duo || 0)
            },
            support: support.total > 0
              ? {
                  me: formatPercent(shares.support?.me || 0),
                  duo: formatPercent(shares.support?.duo || 0)
                }
              : null
          }
        : null,
      supportTotals: support.total > 0
        ? {
            me: support.me || 0,
            duo: support.duo || 0
          }
        : null,
      comfortBias: summary.comfortBias,
      comfortPick: summary.comfortPick
    }
  };

  const system = [
    "You write short, playful verdicts for League of Legends Arena duos.",
    "Arena is 2v2v2v2 with 8 teams; top 4 is a win; 1st place is the crown.",
    "Use the provided facts only; do not invent numbers, events, or qualitative claims.",
    "Do not imply stats that are not explicitly provided.",
    "Never mention first deaths, first blood, or 'first death' language.",
    "Use deaths only if facts.deaths is present.",
    "Tank share indicates damage taken; support share indicates healing + shielding.",
    "2-4 sentences, banter not toxic, no profanity or slurs.",
    "Always share blame with Riot or RNG in a light way.",
    "Avoid 'small sample size' unless games < 8."
  ].join(" ");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Stats JSON:\n${JSON.stringify(promptPayload, null, 2)}` }
      ],
      temperature: 0.8,
      max_tokens: 140
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`openai error: ${response.status} ${text}`);
  }
  const data = await response.json();
  const text = collapseWhitespace(data.choices?.[0]?.message?.content || "");
  if (!text) {
    throw new Error("openai empty response");
  }
  return text;
}

async function getAiVerdict(summary, names, tone, insights, env, ctx, url) {
  if (!env.OPENAI_API_KEY) {
    return { verdict: buildVerdict(summary, names, tone, { fresh: true }), source: "ai-fallback" };
  }

  const ttl = safeNumber(env.AI_VERDICT_TTL_SECONDS, 86400);
  const fingerprint = buildVerdictFingerprint(summary, insights, tone);
  const cache = caches.default;
  const cacheUrl = new URL(url.origin + "/verdict/ai");
  cacheUrl.searchParams.set("key", fingerprint);
  cacheUrl.searchParams.set("tone", tone);
  cacheUrl.searchParams.set("me", normalizeName(names.me, "").toLowerCase());
  cacheUrl.searchParams.set("duo", normalizeName(names.duo, "").toLowerCase());
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) {
    const cachedData = await cached.json();
    if (cachedData && cachedData.verdict) {
      return { verdict: cachedData.verdict, source: "ai-cache" };
    }
  }

  try {
    const verdict = await generateAiVerdict(summary, names, tone, insights, env);
    const cacheResponse = new Response(JSON.stringify({ verdict }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${ttl}`
      }
    });
    ctx.waitUntil(cache.put(cacheKey, cacheResponse.clone()));
    return { verdict, source: "ai" };
  } catch (error) {
    return { verdict: buildVerdict(summary, names, tone, { fresh: true }), source: "ai-fallback" };
  }
}

async function generateAiRoasts(summary, names, tone, insights, env) {
  const model = env.OPENAI_MODEL || "gpt-4o-mini";
  const games = summary.games || 0;
  const wins = summary.wins || 0;
  const losses = Math.max(games - wins, 0);
  const avgPlacement = Number.isFinite(summary.avgPlacement) ? Number(summary.avgPlacement.toFixed(2)) : 0;
  const shares = insights?.shares || {};
  const hasCombatStats = Boolean(insights?.flags?.hasCombatStats);
  const streaks = insights?.streaks || { top4: 0, bottom4: 0 };
  const diversity = insights?.diversity || { combined: 0 };
  const placements = insights?.placements || {};
  const meta = insights?.meta || null;
  const items = insights?.items || null;
  const anvil = insights?.anvil || null;
  const deaths = insights?.deaths || {};
  const support = insights?.support || {};
  const promptPayload = {
    players: [names.me, names.duo],
    tone,
    arenaContext: "2v2v2v2v2v2v2v2, 8 teams, top 4 is a win, 1st is the crown",
    facts: {
      games,
      top4Wins: wins,
      bottom4Losses: losses,
      top4Rate: formatPercent(summary.winRate),
      firsts: summary.firsts || 0,
      avgPlacement,
      deaths: hasCombatStats
        ? {
            me: deaths.me || 0,
            duo: deaths.duo || 0,
            share: {
              me: formatPercent(shares.deaths?.me || 0),
              duo: formatPercent(shares.deaths?.duo || 0)
            }
          }
        : null,
      comfortPick: summary.comfortPick,
      comfortBias: summary.comfortBias,
      placements,
      streaks,
      shares: hasCombatStats
        ? {
            kills: {
              me: formatPercent(shares.kills?.me || 0),
              duo: formatPercent(shares.kills?.duo || 0)
            },
            assists: {
              me: formatPercent(shares.assists?.me || 0),
              duo: formatPercent(shares.assists?.duo || 0)
            },
            deaths: {
              me: formatPercent(shares.deaths?.me || 0),
              duo: formatPercent(shares.deaths?.duo || 0)
            },
            damage: {
              me: formatPercent(shares.damage?.me || 0),
              duo: formatPercent(shares.damage?.duo || 0)
            },
            tank: {
              me: formatPercent(shares.tank?.me || 0),
              duo: formatPercent(shares.tank?.duo || 0)
            },
            support: support.total > 0
              ? {
                  me: formatPercent(shares.support?.me || 0),
                  duo: formatPercent(shares.support?.duo || 0)
                }
              : null
          }
        : null,
      availability: {
        combatShares: hasCombatStats,
        support: support.total > 0,
        meta: Boolean(meta),
        items: Boolean(items),
        anvil: Boolean(anvil)
      },
      diversity: {
        combined: diversity.combined || 0
      },
      meta: meta
        ? {
            meMetaRate: formatPercent(meta.me?.metaRate || 0),
            duoMetaRate: formatPercent(meta.duo?.metaRate || 0),
            meOffMetaRate: formatPercent(meta.me?.offMetaRate || 0),
            duoOffMetaRate: formatPercent(meta.duo?.offMetaRate || 0)
          }
        : null,
      items: items
        ? {
            meAvg: items.meAvg || 0,
            duoAvg: items.duoAvg || 0,
            meLowRate: formatPercent(items.lowRate?.me || 0),
            duoLowRate: formatPercent(items.lowRate?.duo || 0)
          }
        : null,
      anvil: anvil
        ? {
            meRate: formatPercent(anvil.meRate || 0),
            duoRate: formatPercent(anvil.duoRate || 0),
            meTop: anvil.meTop || "",
            duoTop: anvil.duoTop || ""
          }
        : null
    }
  };

  const system = [
    "You generate 4 roast cards for League of Legends Arena duos.",
    "Arena is 2v2v2v2 with 8 teams; top 4 is a win; 1st place is the crown.",
    "Output JSON only with schema: {\"roasts\":[{\"title\":\"...\",\"body\":\"...\"}]}",
    "Titles: 2-4 words, lowercase. Bodies: 1-2 sentences.",
    "Use only the provided facts and numbers; do not invent or infer extra stats.",
    "Do not use comparative claims unless the exact percentage is provided.",
    "Never mention first deaths, first blood, or 'first death' language.",
    "Use deaths only if facts.deaths is present.",
    "Only mention combat share stats if facts.availability.combatShares is true.",
    "Tank share signals frontline work; support share is healing + shielding. Don't frame tank share as bad unless impact is low.",
    "Avoid repeating the same fact across cards.",
    "Mention each player at least once across the set.",
    "Include a meta/off-meta card if meta data is present.",
    "No profanity or slurs. Avoid 'small sample size' unless games < 8."
  ].join(" ");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Stats JSON:\n${JSON.stringify(promptPayload, null, 2)}` }
      ],
      temperature: 0.9,
      max_tokens: 220,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`openai error: ${response.status} ${text}`);
  }
  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || "";
  let parsed;
  try {
    parsed = parseJsonLenient(raw);
  } catch (error) {
    throw new Error(error.message || "openai invalid json");
  }
  if (!parsed || !Array.isArray(parsed.roasts)) {
    throw new Error("openai invalid roasts");
  }
  return parsed.roasts;
}

async function getAiRoasts(summary, names, tone, insights, fallback, env, ctx, url, options = {}) {
  if (!env.OPENAI_API_KEY) {
    return { roasts: fallback, source: "ai-fallback", error: options.debug ? "missing OPENAI_API_KEY" : undefined };
  }
  if (!insights) {
    return { roasts: fallback, source: "ai-fallback", error: options.debug ? "missing insights" : undefined };
  }

  const ttl = safeNumber(env.AI_ROASTS_TTL_SECONDS, 86400);
  const version = env.AI_ROASTS_VERSION || "v1";
  const fingerprint = buildRoastFingerprint(summary, insights, tone);
  const cache = caches.default;
  const cacheUrl = new URL(url.origin + "/roasts/ai");
  cacheUrl.searchParams.set("v", version);
  cacheUrl.searchParams.set("key", fingerprint);
  cacheUrl.searchParams.set("tone", tone);
  cacheUrl.searchParams.set("me", normalizeName(names.me, "").toLowerCase());
  cacheUrl.searchParams.set("duo", normalizeName(names.duo, "").toLowerCase());
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) {
    const cachedData = await cached.json();
    if (cachedData && Array.isArray(cachedData.roasts)) {
      return { roasts: normalizeAiRoasts(cachedData.roasts, fallback), source: "ai-cache" };
    }
  }

  try {
    const rawRoasts = await generateAiRoasts(summary, names, tone, insights, env);
    const roasts = normalizeAiRoasts(rawRoasts, fallback);
    const source = roasts === fallback ? "ai-fallback" : "ai";
    if (source === "ai") {
      const cacheResponse = new Response(JSON.stringify({ roasts }), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${ttl}`
        }
      });
      ctx.waitUntil(cache.put(cacheKey, cacheResponse.clone()));
    }
    return { roasts, source, error: options.debug ? null : undefined };
  } catch (error) {
    return { roasts: fallback, source: "ai-fallback", error: options.debug ? (error.message || "ai roasts error") : undefined };
  }
}

function normalizeChampionKey(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function fetchTierList(env, ctx) {
  const url = env.TIERLIST_URL || "https://raw.githubusercontent.com/deanyo/league-arena-duo/main/tierlist.json";
  const ttl = safeNumber(env.TIERLIST_TTL_SECONDS, 86400);
  const cache = caches.default;
  const cacheKey = new Request(url, { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached.json();
  }

  const response = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!response.ok) {
    throw new Error(`tierlist fetch error: ${response.status}`);
  }
  const data = await response.json();
  const cacheResponse = new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${ttl}`
    }
  });
  ctx.waitUntil(cache.put(cacheKey, cacheResponse.clone()));
  return data;
}

function buildTierMap(data) {
  if (!data || typeof data !== "object") return null;
  const tiers = data.tiers && typeof data.tiers === "object" ? data.tiers : data;
  const map = {};
  const aliasMap = {
    wukong: "monkeyking",
    nunuwillump: "nunu",
    nunuandwillump: "nunu"
  };
  let total = 0;
  ["S", "A", "B", "C", "D"].forEach((tier) => {
    const entries = tiers[tier] || tiers[tier.toLowerCase()] || [];
    if (!Array.isArray(entries)) return;
    entries.forEach((name) => {
      const key = normalizeChampionKey(name);
      if (!key) return;
      const mappedKey = aliasMap[key] || key;
      map[mappedKey] = tier;
      total += 1;
    });
  });
  return { map, total };
}

function buildMetaStats(championCounts, tierInfo) {
  if (!tierInfo || !tierInfo.map || tierInfo.total < 10) return null;

  function compute(counts) {
    let total = 0;
    let s = 0;
    let a = 0;
    let b = 0;
    let c = 0;
    let d = 0;
    let unknown = 0;
    Object.entries(counts).forEach(([champ, count]) => {
      total += count;
      const tier = tierInfo.map[normalizeChampionKey(champ)] || "U";
      if (tier === "S") s += count;
      else if (tier === "A") a += count;
      else if (tier === "B") b += count;
      else if (tier === "C") c += count;
      else if (tier === "D") d += count;
      else unknown += count;
    });
    if (total === 0) {
      return { total: 0, sRate: 0, metaRate: 0, offMetaRate: 0 };
    }
    const meta = s + a;
    const offMeta = c + d + unknown;
    return {
      total,
      sRate: s / total,
      metaRate: meta / total,
      offMetaRate: offMeta / total
    };
  }

  return {
    me: compute(championCounts.me),
    duo: compute(championCounts.duo)
  };
}

function buildMetaRoast(metaStats, names, tone) {
  if (!metaStats) return null;
  const me = metaStats.me;
  const duo = metaStats.duo;
  if (me.total === 0 && duo.total === 0) return null;

  const highMeta = 0.65;
  const highS = 0.45;
  const offMeta = 0.55;
  const gapCallout = 0.14;

  const copy = {
    gentle: {
      metaLead: (leader, rate) => `${leader} leans on S/A tiers in ${formatPercent(rate)} of games. safe picks, soft landing.`,
      sLead: (leader, rate) => `${leader} is in S-tier ${formatPercent(rate)} of the time. comfort is a strategy.`,
      offBoth: (rate) => `both skip S/A tiers in ${formatPercent(rate)} of games. creative duo energy.`,
      offLead: (leader, rate) => `${leader} skips S/A tiers in ${formatPercent(rate)} of games. off-meta pride.`,
      metaGap: (leader, rate, otherRate) => `${leader} leans meta at ${formatPercent(rate)} vs ${formatPercent(otherRate)}. tier list tilt detected.`,
      metaMix: (rate) => `S/A usage sits around ${formatPercent(rate)}. balanced picks, balanced risks.`
    },
    classic: {
      metaLead: (leader, rate) => `${leader} locks S/A tiers in ${formatPercent(rate)} of games. meta loyalty program member.`,
      sLead: (leader, rate) => `${leader} is on S-tier ${formatPercent(rate)} of the time. tier list scout reporting in.`,
      offBoth: (rate) => `both skip S/A tiers in ${formatPercent(rate)} of games. off-meta respect.`,
      offLead: (leader, rate) => `${leader} skips S/A tiers in ${formatPercent(rate)} of games. off-meta pride.`,
      metaGap: (leader, rate, otherRate) => `${leader} leans meta at ${formatPercent(rate)} vs ${formatPercent(otherRate)}. tier list habits showing.`,
      metaMix: (rate) => `S/A usage hovers around ${formatPercent(rate)}. balanced draft energy.`
    },
    savage: {
      metaLead: (leader, rate) => `${leader} locks S/A tiers in ${formatPercent(rate)} of games. tier list disciple behavior.`,
      sLead: (leader, rate) => `${leader} is on S-tier ${formatPercent(rate)} of the time. only the finest labels.`,
      offBoth: (rate) => `both skip S/A tiers in ${formatPercent(rate)} of games. off-meta chaos enjoyers.`,
      offLead: (leader, rate) => `${leader} skips S/A tiers in ${formatPercent(rate)} of games. off-meta gremlin energy.`,
      metaGap: (leader, rate, otherRate) => `${leader} leans meta at ${formatPercent(rate)} vs ${formatPercent(otherRate)}. tier list dependency flagged.`,
      metaMix: (rate) => `S/A usage sits at ${formatPercent(rate)}. balanced picks, unbalanced results.`
    }
  };

  const toneCopy = copy[tone] || copy.classic;
  const leader = me.metaRate >= duo.metaRate ? { name: names.me, data: me } : { name: names.duo, data: duo };
  const offLeader = me.offMetaRate >= duo.offMetaRate ? { name: names.me, data: me } : { name: names.duo, data: duo };
  const avgOffMeta = (me.offMetaRate + duo.offMetaRate) / 2;

  if (leader.data.metaRate >= highMeta) {
    const body = leader.data.sRate >= highS
      ? toneCopy.sLead(leader.name, leader.data.sRate)
      : toneCopy.metaLead(leader.name, leader.data.metaRate);
    return { title: "tier list habits", body };
  }

  if (me.offMetaRate >= offMeta && duo.offMetaRate >= offMeta) {
    return { title: "off-meta props", body: toneCopy.offBoth(avgOffMeta) };
  }

  if (offLeader.data.offMetaRate >= offMeta) {
    return { title: "off-meta props", body: toneCopy.offLead(offLeader.name, offLeader.data.offMetaRate) };
  }

  const metaGap = Math.abs(me.metaRate - duo.metaRate);
  if (metaGap >= gapCallout) {
    const metaLeader = me.metaRate >= duo.metaRate ? names.me : names.duo;
    const leaderRate = Math.max(me.metaRate, duo.metaRate);
    const otherRate = Math.min(me.metaRate, duo.metaRate);
    return { title: "tier list habits", body: toneCopy.metaGap(metaLeader, leaderRate, otherRate) };
  }

  const avgMeta = (me.metaRate + duo.metaRate) / 2;
  return { title: "tier list habits", body: toneCopy.metaMix(avgMeta) };
}

function isArenaMatch(info) {
  if (!info) return false;
  if (info.gameMode === "CHERRY") return true;
  if (ARENA_QUEUES.has(info.queueId)) return true;
  return false;
}

async function riotFetch(url, env) {
  const response = await fetch(url, {
    headers: {
      "X-Riot-Token": env.RIOT_API_KEY
    }
  });
  if (response.status === 429) {
    throw new Error("riot rate limit");
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error("riot api error: " + response.status + " " + text);
  }
  return response.json();
}

async function getSummonerByName(name, platform, env) {
  const url = `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-name/${encodeURIComponent(name)}`;
  return riotFetch(url, env);
}

async function getAccountByRiotId(gameName, tagLine, region, env) {
  const url = `https://${region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  return riotFetch(url, env);
}

async function getMatchIds(puuid, region, count, env) {
  const url = `https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=${count}`;
  return riotFetch(url, env);
}

async function getMatch(matchId, region, env) {
  const url = `https://${region}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
  return riotFetch(url, env);
}

async function resolvePlayer(input, platform, region, env) {
  const riotId = parseRiotId(input);
  if (riotId) {
    const account = await getAccountByRiotId(riotId.gameName, riotId.tagLine, region, env);
    return { puuid: account.puuid, name: account.gameName || input };
  }
  const summoner = await getSummonerByName(input, platform, env);
  return { puuid: summoner.puuid, name: summoner.name || input };
}

function pickTopChampion(counts) {
  let top = { name: "", count: 0 };
  Object.entries(counts).forEach(([name, count]) => {
    if (count > top.count) {
      top = { name, count };
    }
  });
  return top;
}

function buildDuoIdentity(winRate, avgPlacement) {
  if (winRate >= 0.62) return "overconfident climbers";
  if (winRate >= 0.52) return "coinflip specialists";
  if (avgPlacement <= 2.2) return "scrappy finalists";
  return "chaos enjoyers";
}

function buildHighlight(me, duo, placement, seed) {
  const kills = (me.kills || 0) + (duo.kills || 0);
  const deaths = (me.deaths || 0) + (duo.deaths || 0);
  const assists = (me.assists || 0) + (duo.assists || 0);
  const damage = (me.totalDamageDealtToChampions || 0) + (duo.totalDamageDealtToChampions || 0);
  const damageTaken = (me.totalDamageTaken || 0) + (duo.totalDamageTaken || 0);
  const healing = (me.totalHeal || 0) + (duo.totalHeal || 0);
  const shielding = (me.totalDamageShieldedOnTeammates || 0) + (duo.totalDamageShieldedOnTeammates || 0);
  const support = healing + shielding;
  const ultCasts = (me.spell4Casts || 0) + (duo.spell4Casts || 0);
  const meItems = countItems(me);
  const duoItems = countItems(duo);
  const lowItems = meItems <= 2 || duoItems <= 2;
  const anvilChamp = isAnvilChampion(me.championName) || isAnvilChampion(duo.championName);
  const candidates = [];
  const add = (text) => {
    if (!text || candidates.includes(text)) return;
    candidates.push(text);
  };

  if (placement === 1) {
    add("crown secured");
    add("first place sealed");
    add("crown run completed");
  } else if (placement > 0 && placement <= 4) {
    add("top 4 secured");
    add("ticket punched for top 4");
    add("survived the bracket");
  } else if (placement >= 5) {
    add("bottom 4 exit");
    add("early exit ticket");
    add("lobby ended the run");
  }

  if (kills >= deaths + 8) add("out-traded the lobby");
  if (deaths >= kills + 8) add("scrapped hard, fell short");
  if (damage >= damageTaken * 1.3 && damage >= 18000) add("damage diff posted");
  if (damageTaken >= damage * 1.3 && damageTaken >= 20000) add("frontline tax paid");
  if (assists >= kills + 8) add("setup for days");
  if (kills >= assists + 8) add("finisher instincts");
  if (support >= 9000) add("sustain clinic");
  if (ultCasts === 0) add("ultimates on vacation");
  if (ultCasts >= 12) add("ults on cooldown");
  if (placement <= 4 && deaths > kills) add("survived the chaos");
  if (placement >= 5 && kills > deaths) add("could not close the trades");
  if (lowItems && placement >= 5) add("build never came online");
  if (anvilChamp && placement >= 6) add("anvil run stalled");

  if (candidates.length === 0) {
    if (kills >= deaths + 6) return "out-traded the lobby";
    if (deaths >= kills + 4) return "scrapped hard, fell short";
    return "even trades, messy finish";
  }

  return pickVariant(candidates, seed);
}

function toneCopy(tone) {
  const copy = {
    gentle: {
      deathTie: "deaths are split almost evenly. shared pain, shared growth.",
      comfortTie: (pick) => `${pick} appears on both sides. comfort pick energy.`,
      comfortLead: (pick, rate) => `${pick} shows up in ${rate}. leaning into what feels safe.`,
      damageLead: (leader, share) => `${leader} handles ${formatPercent(share)} of duo damage. steady carry energy.`,
      damageTie: "damage is split almost evenly. shared workload, shared glory.",
      tankLead: (leader, share) => `${leader} absorbs ${formatPercent(share)} of the damage. frontline heart.`,
      supportLead: (leader, share) => `${leader} covers ${formatPercent(share)} of healing + shielding. lifeguard energy.`,
      supportTie: "healing + shielding is split evenly. shared sustain.",
      assistLead: (leader, share) => `${leader} owns ${formatPercent(share)} of the assists. setup artist energy.`,
      killLead: (leader, share) => `${leader} claims ${formatPercent(share)} of the kills. finisher instincts.`,
      deathLead: (leader, share) => `${leader} holds ${formatPercent(share)} of the deaths. brave positioning.`,
      streakHot: (streak) => `top 4 streak hit ${streak}. momentum is real.`,
      streakCold: (streak) => `bottom 4 streak hit ${streak}. the lobby has been rough.`,
      champPoolSmall: (count) => `only ${count} champions in rotation. comfort zone cozy.`,
      champPoolWide: (count) => `${count} champions across the scan. variety pack energy.`,
      crownCount: (firsts) => `${firsts} first-place finishes in the trophy case.`,
      lowItems: (leader, rate) => `${leader} ends ${formatPercent(rate)} of games with 3 or fewer items. the build never shows up.`,
      anvilLead: (leader, rate, champ) => `${leader} runs the anvil economy in ${formatPercent(rate)} of games${champ ? ` on ${champ}` : ""}.`,
      anvilFail: (leader, champ) => `${leader} tried the anvil economy${champ ? ` on ${champ}` : ""} and still went bottom 4. financial advice revoked.`,
      anvilDouble: (rate) => `both lean into anvils in ${formatPercent(rate)} of games. double gamba, double stress.`,
      clutch: (summary) => {
        const firsts = formatFirsts(summary.firsts);
        const prefix = smallSamplePrefix(summary.games);
        return `top 4 rate sits at ${formatPercent(summary.winRate)} with ${firsts}. ${prefix}the duo feels ${summary.winRate >= 0.55 ? "steady" : "swingy"}.`;
      }
    },
    classic: {
      deathTie: "deaths are split down the middle. shared suffering, shared blame.",
      comfortTie: (pick) => `${pick} shows up in both rotations. shared comfort pick energy.`,
      comfortLead: (pick, rate) => `${pick} shows up in ${rate}. comfort pick or lifestyle choice.`,
      damageLead: (leader, share) => `${leader} deals ${formatPercent(share)} of duo damage. backpack tax applied.`,
      damageTie: "damage is split down the middle. shared workload, shared blame.",
      tankLead: (leader, share) => `${leader} absorbs ${formatPercent(share)} of incoming damage. frontline tax payer.`,
      supportLead: (leader, share) => `${leader} handles ${formatPercent(share)} of healing + shielding. support diff noted.`,
      supportTie: "healing + shielding is split down the middle. shared sustain.",
      assistLead: (leader, share) => `${leader} owns ${formatPercent(share)} of the assists. setup artist energy.`,
      killLead: (leader, share) => `${leader} takes ${formatPercent(share)} of the kills. finisher aura.`,
      deathLead: (leader, share) => `${leader} holds ${formatPercent(share)} of the deaths. grey screen familiar.`,
      streakHot: (streak) => `top 4 streak hit ${streak}. the duo can chain wins.`,
      streakCold: (streak) => `bottom 4 streak hit ${streak}. the lobby took turns.`,
      champPoolSmall: (count) => `only ${count} champions in rotation. comfort zone locked.`,
      champPoolWide: (count) => `${count} champs across the scan. variety pack duo.`,
      crownCount: (firsts) => `${firsts} first-place finishes on the shelf. crown collection growing.`,
      lowItems: (leader, rate) => `${leader} ends ${formatPercent(rate)} of games with 3 or fewer items. the build never showed.`,
      anvilLead: (leader, rate, champ) => `${leader} runs the anvil economy in ${formatPercent(rate)} of games${champ ? ` on ${champ}` : ""}.`,
      anvilFail: (leader, champ) => `${leader} tried the anvil economy${champ ? ` on ${champ}` : ""} and still hit bottom 4. finance diff.`,
      anvilDouble: (rate) => `both lean into anvils in ${formatPercent(rate)} of games. double gamba, double stress.`,
      clutch: (summary) => {
        const firsts = formatFirsts(summary.firsts);
        const prefix = smallSamplePrefix(summary.games);
        return `top 4 rate sits at ${formatPercent(summary.winRate)} with ${firsts}. ${prefix}the duo looks ${summary.winRate >= 0.55 ? "dangerous" : "swingy"}.`;
      }
    },
    savage: {
      deathTie: "deaths are split evenly. equal opportunity pain.",
      comfortTie: (pick) => `${pick} appears on both sides. commitment level: unshakable.`,
      comfortLead: (pick, rate) => `${pick} shows up in ${rate}. one-pick lifestyle confirmed.`,
      damageLead: (leader, share) => `${leader} delivers ${formatPercent(share)} of duo damage. backpack surcharge applied.`,
      damageTie: "damage is split evenly. co-op blame agreement signed.",
      tankLead: (leader, share) => `${leader} absorbs ${formatPercent(share)} of the damage. frontline tax paid in full.`,
      supportLead: (leader, share) => `${leader} handles ${formatPercent(share)} of healing + shielding. support diff confirmed.`,
      supportTie: "healing + shielding split evenly. no carry in sight.",
      assistLead: (leader, share) => `${leader} owns ${formatPercent(share)} of the assists. setup bot energy.`,
      killLead: (leader, share) => `${leader} takes ${formatPercent(share)} of the kills. finisher privileges.`,
      deathLead: (leader, share) => `${leader} holds ${formatPercent(share)} of the deaths. grey screen loyalist.`,
      streakHot: (streak) => `top 4 streak hit ${streak}. hot streak unlocked.`,
      streakCold: (streak) => `bottom 4 streak hit ${streak}. spiral lore unlocked.`,
      champPoolSmall: (count) => `only ${count} champions in rotation. comfort cage secured.`,
      champPoolWide: (count) => `${count} champions across the scan. chaos buffet.`,
      crownCount: (firsts) => `${firsts} first-place finishes in the cabinet. still room for more.`,
      lowItems: (leader, rate) => `${leader} ends ${formatPercent(rate)} of games with 3 or fewer items. inventory poverty arc.`,
      anvilLead: (leader, rate, champ) => `${leader} runs the anvil economy in ${formatPercent(rate)} of games${champ ? ` on ${champ}` : ""}.`,
      anvilFail: (leader, champ) => `${leader} tried the anvil economy${champ ? ` on ${champ}` : ""} and still went bottom 4. budget nerfed.`,
      anvilDouble: (rate) => `both lean into anvils in ${formatPercent(rate)} of games. double gamba, double grief.`,
      clutch: (summary) => {
        const firsts = formatFirsts(summary.firsts);
        const prefix = smallSamplePrefix(summary.games);
        return `top 4 rate sits at ${formatPercent(summary.winRate)} with ${firsts}. ${prefix}the duo looks ${summary.winRate >= 0.55 ? "dangerous" : "chaotic"}.`;
      }
    }
  };

  return copy[tone] || copy.classic;
}

function buildRoasts(summary, names, tone, metaStats, insights) {
  const copy = toneCopy(tone);
  const pool = [];
  const fallback = [];
  const targetCount = 4;

  function addUnique(list, roast) {
    if (!roast) return;
    if (list.some((item) => item.title === roast.title)) return;
    list.push(roast);
  }

  const deathsShare = insights?.shares?.deaths || null;
  if (deathsShare) {
    const diff = Math.abs((deathsShare.me || 0) - (deathsShare.duo || 0));
    const deathsLeader = (deathsShare.me || 0) >= (deathsShare.duo || 0) ? names.me : names.duo;
    const shareValue = (deathsShare.me || 0) >= (deathsShare.duo || 0) ? deathsShare.me : deathsShare.duo;
    const deathsBody = diff <= 0.08
      ? copy.deathTie
      : copy.deathLead(deathsLeader, formatPercent(shareValue));
    const deathsRoast = { title: "death share", body: deathsBody };
    addUnique(fallback, deathsRoast);
    addUnique(pool, deathsRoast);
  }

  const comfortBody = summary.comfortBias === "tied"
    ? copy.comfortTie(summary.comfortPick)
    : copy.comfortLead(summary.comfortPick, summary.comfortPickRate);
  const comfortRoast = { title: "comfort lock", body: comfortBody };
  addUnique(fallback, comfortRoast);
  if ((summary.comfortPickRateValue || 0) >= 0.35) {
    addUnique(pool, comfortRoast);
  }

  const streaks = insights?.streaks;
  if (streaks?.top4 >= 3 && streaks.top4 >= (streaks.bottom4 || 0)) {
    const streakRoast = { title: "streak watch", body: copy.streakHot(streaks.top4) };
    addUnique(fallback, streakRoast);
    addUnique(pool, streakRoast);
  } else if (streaks?.bottom4 >= 3) {
    const streakRoast = { title: "streak watch", body: copy.streakCold(streaks.bottom4) };
    addUnique(fallback, streakRoast);
    addUnique(pool, streakRoast);
  }

  const metaRoast = buildMetaRoast(metaStats, names, tone);
  if (metaRoast) {
    addUnique(pool, metaRoast);
  }

  const shares = insights?.shares;
  const dominantThreshold = 0.6;
  const balancedDelta = 0.12;

  const pickDominant = (share) => {
    if (!share) return null;
    if (share.me >= dominantThreshold) return { name: names.me, share: share.me };
    if (share.duo >= dominantThreshold) return { name: names.duo, share: share.duo };
    return null;
  };
  const isBalanced = (share) => share && Math.abs((share.me || 0) - (share.duo || 0)) <= balancedDelta;

  const damageLeader = pickDominant(shares?.damage);
  if (damageLeader) {
    addUnique(pool, { title: "damage share", body: copy.damageLead(damageLeader.name, damageLeader.share) });
  } else if (isBalanced(shares?.damage)) {
    addUnique(pool, { title: "damage split", body: copy.damageTie });
  }

  const tankLeader = pickDominant(shares?.tank);
  if (tankLeader) {
    addUnique(pool, { title: "frontline tax", body: copy.tankLead(tankLeader.name, tankLeader.share) });
  }
  const supportTotal = insights?.support?.total || 0;
  const supportPerGame = summary.games > 0 ? supportTotal / summary.games : 0;
  const supportRelevant = supportPerGame >= 1200;
  const supportLeader = supportRelevant ? pickDominant(shares?.support) : null;
  if (supportLeader) {
    const supportRoast = { title: "support diff", body: copy.supportLead(supportLeader.name, supportLeader.share) };
    addUnique(pool, supportRoast);
    addUnique(fallback, supportRoast);
  } else if (supportRelevant && isBalanced(shares?.support)) {
    addUnique(pool, { title: "support split", body: copy.supportTie });
  }

  const killLeader = pickDominant(shares?.kills);
  if (killLeader) {
    addUnique(pool, { title: "finisher bias", body: copy.killLead(killLeader.name, killLeader.share) });
  }

  const assistLeader = pickDominant(shares?.assists);
  if (assistLeader) {
    addUnique(pool, { title: "setup artist", body: copy.assistLead(assistLeader.name, assistLeader.share) });
  }

  const diversity = insights?.diversity?.combined || 0;
  if (diversity > 0 && diversity <= 4) {
    addUnique(pool, { title: "champion pool", body: copy.champPoolSmall(diversity) });
  } else if (diversity >= 10) {
    addUnique(pool, { title: "champion pool", body: copy.champPoolWide(diversity) });
  }

  const items = insights?.items;
  if (items) {
    const lowLeader = items.lowRate.me >= items.lowRate.duo
      ? { name: names.me, rate: items.lowRate.me }
      : { name: names.duo, rate: items.lowRate.duo };
    if (lowLeader.rate >= 0.4) {
      addUnique(pool, { title: "empty inventory", body: copy.lowItems(lowLeader.name, lowLeader.rate) });
    }
  }

  const anvil = insights?.anvil;
  if (anvil) {
    const bothAnvil = anvil.meRate >= 0.3 && anvil.duoRate >= 0.3;
    if (bothAnvil) {
      addUnique(pool, { title: "double anvil", body: copy.anvilDouble((anvil.meRate + anvil.duoRate) / 2) });
    } else {
      const leader = anvil.meRate >= anvil.duoRate
        ? { name: names.me, rate: anvil.meRate, champ: anvil.meTop }
        : { name: names.duo, rate: anvil.duoRate, champ: anvil.duoTop };
      if (leader.rate >= 0.3) {
        if (summary.winRate < 0.5 || summary.avgPlacement >= 4.6) {
          addUnique(pool, { title: "anvil economics", body: copy.anvilFail(leader.name, leader.champ) });
        } else {
          addUnique(pool, { title: "anvil economics", body: copy.anvilLead(leader.name, leader.rate, leader.champ) });
        }
      }
    }
  }

  if (summary.firsts >= 2) {
    addUnique(pool, { title: "crown count", body: copy.crownCount(summary.firsts) });
  }

  const clutchRoast = { title: "clutch window", body: copy.clutch(summary) };
  addUnique(fallback, clutchRoast);
  addUnique(pool, clutchRoast);

  const seed = Math.floor(summary.winRate * 1000) + summary.games * 13 + summary.firsts * 19 + (insights?.deaths?.duo || 0) * 7;
  const shuffled = shuffleWithSeed(pool, seed);
  const selected = [];
  shuffled.forEach((roast) => {
    if (selected.length < targetCount) addUnique(selected, roast);
  });

  if (selected.length < targetCount) {
    fallback.forEach((roast) => {
      if (selected.length < targetCount) addUnique(selected, roast);
    });
  }

  return selected.slice(0, targetCount);
}

function buildVerdict(summary, names, tone, options = {}) {
  const games = Number.isFinite(summary.games) ? summary.games : 0;
  if (games === 0) {
    return `${names.me} and ${names.duo} have no shared arena games in this window. widen the match scan or double-check spellings.`;
  }
  const winRate = formatPercent(summary.winRate);
  const avg = summary.avgPlacement.toFixed(1);
  const firstsCount = Number.isFinite(summary.firsts) ? summary.firsts : 0;
  const firsts = formatFirsts(firstsCount);
  const gamesText = games === 1 ? "1 arena game" : `${games} arena games`;
  const arenaContext = "arena scoring: top 4 of 8 teams is a win, first place is the crown";
  const samplePrefix = smallSamplePrefix(games);
  const biasText = summary.comfortBias === "tied"
    ? `both lean on ${summary.comfortPick}`
    : `${summary.comfortBias} leans on ${summary.comfortPick}`;
  const templates = {
    gentle: [
      () => `${names.me} and ${names.duo} are landing top 4 in ${winRate} across ${gamesText}, with ${firsts} and an average placement of ${avg}. ${arenaContext}. the data suggests ${biasText}, while riot keeps the augment wheel spicy. ${samplePrefix}the vibe says you are close to a clean run.`,
      () => `${names.me} and ${names.duo} are sitting at a ${winRate} top 4 rate across ${gamesText}, with ${firsts} and an average placement of ${avg}. ${arenaContext}. the data suggests ${biasText}, and riot provides the occasional plot twist. ${samplePrefix}the climb feels within reach.`
    ],
    classic: [
      () => `${names.me} and ${names.duo} are landing top 4 in ${winRate} across ${gamesText}, with ${firsts} and an average placement of ${avg}. ${arenaContext}. the data suggests ${biasText}, while riot keeps the augment wheel spicy. ${samplePrefix}the vibe says you are one good roll away from dominance.`,
      () => `${names.me} and ${names.duo} are sitting at a ${winRate} top 4 rate across ${gamesText}, with ${firsts} and an average placement of ${avg}. ${arenaContext}. the data suggests ${biasText}, and riot keeps the chaos flowing. ${samplePrefix}the energy says this duo is one streak away.`
    ],
    savage: [
      () => `${names.me} and ${names.duo} are landing top 4 in ${winRate} across ${gamesText}, with ${firsts} and an average placement of ${avg}. ${arenaContext}. the data suggests ${biasText}, and riot keeps the augment wheel on hard mode. ${samplePrefix}the comeback arc is still possible.`,
      () => `${names.me} and ${names.duo} are sitting at a ${winRate} top 4 rate across ${gamesText}, with ${firsts} and an average placement of ${avg}. ${arenaContext}. the data suggests ${biasText}, and riot keeps the chaos dialed up. ${samplePrefix}the next streak could flip the story.`
    ]
  };
  const toneTemplates = templates[tone] || templates.classic;
  const seed = options.fresh ? null : Math.floor(summary.winRate * 1000) + summary.games * 7 + summary.firstDeaths.duo;
  const template = pickVariant(toneTemplates, seed);
  return template ? template() : "";
}

function calcPlacementStdDev(placements, avgPlacement, games) {
  if (!games) return 0;
  let variance = 0;
  for (let i = 1; i <= 8; i += 1) {
    const count = placements?.[i] || 0;
    variance += count * Math.pow(i - avgPlacement, 2);
  }
  variance = variance / games;
  return Math.sqrt(variance);
}

function buildBlame(summary, names, insights) {
  if (summary.games === 0) {
    return {
      me: { share: 0.33, reason: "no data yet", breakdown: [] },
      duo: { share: 0.33, reason: "no data yet", breakdown: [] },
      riot: { share: 0.34, reason: "no data yet", breakdown: [] }
    };
  }

  const games = summary.games || 0;
  const deathsMe = insights?.deaths?.me || 0;
  const deathsDuo = insights?.deaths?.duo || 0;
  const totalDeaths = deathsMe + deathsDuo;
  const shares = insights?.shares || {};
  const items = insights?.items || null;
  const meta = insights?.meta || null;
  const anvil = insights?.anvil || null;
  const hasCombatStats = Boolean(insights?.flags?.hasCombatStats);
  const placements = insights?.placements || {};
  const avgPlacement = Number.isFinite(summary.avgPlacement) ? summary.avgPlacement : 0;
  const placementStdDev = calcPlacementStdDev(placements, avgPlacement, games);
  const closeExits = (placements[5] || 0) + (placements[6] || 0);
  const earlyExits = (placements[7] || 0) + (placements[8] || 0);
  const closeRate = games > 0 ? closeExits / games : 0;
  const earlyRate = games > 0 ? earlyExits / games : 0;

  const executionScore = (share) => (hasCombatStats ? Math.max((share || 0) - 0.5, 0) * 12 : 0);
  const impactShare = (damageShare, supportShare) => Math.max(damageShare || 0, supportShare || 0);
  const impactScore = (share) => (hasCombatStats ? Math.max(0.5 - (share || 0), 0) * 10 : 0);
  const frontlineCredit = (share) => (hasCombatStats ? Math.max((share || 0) - 0.5, 0) * 4 : 0);
  const frontlinePenalty = (tankShare, impactShareValue) =>
    hasCombatStats && tankShare >= 0.68 && impactShareValue <= 0.32 ? 1.0 : 0;
  const economyScore = (rate) => (rate || 0) * 6;
  const metaScore = (rate) => {
    if (!Number.isFinite(rate) || summary.winRate >= 0.5) return 0;
    if (rate >= 0.65) return 1.8;
    if (rate <= 0.45) return 1.6;
    return 0.8;
  };
  const anvilScore = (rate) => (summary.winRate < 0.5 && rate >= 0.3 ? 1.4 : 0);

  const meImpactShare = impactShare(shares.damage?.me, shares.support?.me);
  const duoImpactShare = impactShare(shares.damage?.duo, shares.support?.duo);
  const meScores = {
    execution: executionScore(shares.deaths?.me),
    impact: impactScore(meImpactShare),
    economy: economyScore(items?.lowRate?.me),
    meta: metaScore(meta?.me?.metaRate),
    anvil: anvilScore(anvil?.meRate)
  };
  const duoScores = {
    execution: executionScore(shares.deaths?.duo),
    impact: impactScore(duoImpactShare),
    economy: economyScore(items?.lowRate?.duo),
    meta: metaScore(meta?.duo?.metaRate),
    anvil: anvilScore(anvil?.duoRate)
  };

  const meScore = Math.max(
    0.2,
    1 +
      meScores.execution +
      meScores.impact +
      meScores.economy +
      meScores.meta +
      meScores.anvil +
      frontlinePenalty(shares.tank?.me || 0, meImpactShare) -
      frontlineCredit(shares.tank?.me || 0)
  );
  const duoScore = Math.max(
    0.2,
    1 +
      duoScores.execution +
      duoScores.impact +
      duoScores.economy +
      duoScores.meta +
      duoScores.anvil +
      frontlinePenalty(shares.tank?.duo || 0, duoImpactShare) -
      frontlineCredit(shares.tank?.duo || 0)
  );

  const volatilityScore = placementStdDev >= 1.8 ? 3 : placementStdDev >= 1.4 ? 2 : placementStdDev >= 1.1 ? 1 : 0;
  const closeScore = closeRate >= 0.4 ? 2 : closeRate >= 0.25 ? 1 : 0;
  const riotScore = 1 + volatilityScore + closeScore + (summary.winRate < 0.5 ? 1.2 : 0.6);

  const total = meScore + duoScore + riotScore;

  const topReason = (scores, fallback) => {
    const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const top = entries[0];
    return top && top[1] > 0 ? top[0] : fallback;
  };

  const reasonMap = {
    execution: "death share",
    impact: "damage debt",
    economy: "economy grief",
    meta: "meta habits",
    anvil: "anvil gamble"
  };

  const formatShare = (value) => (Number.isFinite(value) ? formatPercent(value) : "--");
  const deathShare = (count) => (totalDeaths > 0 ? formatPercent(count / totalDeaths) : "0%");

  const reasonWithStat = (key, side) => {
    if (key === "execution") {
      return `death share (${deathShare(side === "me" ? deathsMe : deathsDuo)})`;
    }
    if (key === "impact") {
      const shareValue = side === "me" ? shares.damage?.me : shares.damage?.duo;
      return `damage share (${formatShare(shareValue)})`;
    }
    if (key === "economy") {
      const rate = side === "me" ? items?.lowRate?.me : items?.lowRate?.duo;
      return Number.isFinite(rate) ? `low items (${formatPercent(rate)})` : reasonMap[key];
    }
    if (key === "meta") {
      const rate = side === "me" ? meta?.me?.metaRate : meta?.duo?.metaRate;
      return Number.isFinite(rate) ? `meta habits (${formatPercent(rate)})` : reasonMap[key];
    }
    if (key === "anvil") {
      const rate = side === "me" ? anvil?.meRate : anvil?.duoRate;
      return Number.isFinite(rate) ? `anvil gamble (${formatPercent(rate)})` : reasonMap[key];
    }
    return reasonMap[key] || "coinflip energy";
  };

  const meReasonKey = topReason(meScores, "coinflip energy");
  const duoReasonKey = topReason(duoScores, "coinflip energy");
  const meReason = reasonWithStat(meReasonKey, "me");
  const duoReason = reasonWithStat(duoReasonKey, "duo");
  const riotReason = closeRate >= 0.4
    ? "close exits"
    : placementStdDev >= 1.4
      ? "volatility tax"
      : summary.winRate < 0.5
        ? "chaos factor"
        : "balance patch vibes";
  const supportLine = (label, count, share) => {
    if (!Number.isFinite(count) || count <= 0) return `no ${label} data`;
    return `${label} ${formatNumber(count)} (${formatShare(share)})`;
  };
  const economyLine = (rate, anvilRate) => {
    if (!Number.isFinite(rate)) return "no item data";
    const base = `low items ${formatPercent(rate)}`;
    if (Number.isFinite(anvilRate) && anvilRate >= 0.3) {
      return `${base}; anvil ${formatPercent(anvilRate)}`;
    }
    return base;
  };

  const meBreakdown = [
    { label: "execution", value: `deaths ${deathsMe} (${deathShare(deathsMe)})` },
    {
      label: "impact",
      value: hasCombatStats
        ? `damage ${formatNumber(insights?.damage?.me || 0)} (${formatShare(shares.damage?.me)})`
        : "no combat data"
    },
    { label: "healing", value: supportLine("healing", insights?.healing?.me, shares.healing?.me) },
    { label: "shielding", value: supportLine("shielding", insights?.shielding?.me, shares.shielding?.me) },
    { label: "economy", value: economyLine(items?.lowRate?.me, anvil?.meRate) },
    { label: "meta", value: meta ? `S/A picks ${formatShare(meta.me?.metaRate)}` : "meta offline" }
  ];
  const duoBreakdown = [
    { label: "execution", value: `deaths ${deathsDuo} (${deathShare(deathsDuo)})` },
    {
      label: "impact",
      value: hasCombatStats
        ? `damage ${formatNumber(insights?.damage?.duo || 0)} (${formatShare(shares.damage?.duo)})`
        : "no combat data"
    },
    { label: "healing", value: supportLine("healing", insights?.healing?.duo, shares.healing?.duo) },
    { label: "shielding", value: supportLine("shielding", insights?.shielding?.duo, shares.shielding?.duo) },
    { label: "economy", value: economyLine(items?.lowRate?.duo, anvil?.duoRate) },
    { label: "meta", value: meta ? `S/A picks ${formatShare(meta.duo?.metaRate)}` : "meta offline" }
  ];
  const riotBreakdown = [
    { label: "volatility", value: `placement swing ${placementStdDev.toFixed(2)} (higher = swingier)` },
    { label: "close exits", value: `5th-6th finishes ${closeExits} (${formatPercent(closeRate)})` },
    { label: "early exits", value: `7th-8th finishes ${earlyExits} (${formatPercent(earlyRate)})` }
  ];

  return {
    me: { share: meScore / total, reason: meReason, breakdown: meBreakdown },
    duo: { share: duoScore / total, reason: duoReason, breakdown: duoBreakdown },
    riot: { share: riotScore / total, reason: riotReason, breakdown: riotBreakdown }
  };
}

function buildSummary(stats, names, matchCount) {
  const games = stats.games;
  const wins = stats.wins;
  const winRate = games > 0 ? wins / games : 0;
  const avgPlacement = games > 0 ? stats.placementTotal / games : 0;
  const firsts = Number.isFinite(stats.firsts) ? stats.firsts : 0;
  const firstRate = games > 0 ? firsts / games : 0;

  const meTop = pickTopChampion(stats.champions.me);
  const duoTop = pickTopChampion(stats.champions.duo);
  const meComfortRate = games > 0 ? meTop.count / games : 0;
  const duoComfortRate = games > 0 ? duoTop.count / games : 0;

  let comfortBias = names.me;
  let comfortPick = meTop.name;
  if (duoComfortRate > meComfortRate) {
    comfortBias = names.duo;
    comfortPick = duoTop.name;
  }
  if (duoComfortRate === meComfortRate) {
    comfortBias = "tied";
    comfortPick = meTop.name || duoTop.name || "unknown";
  }

  const firstDeathRate = games > 0 ? Math.max(stats.firstDeaths.me, stats.firstDeaths.duo) / games : 0;

  return {
    games,
    wins,
    winRate,
    avgPlacement,
    firsts,
    firstRate: formatPercent(firstRate),
    firstDeaths: stats.firstDeaths,
    firstDeathRate: formatPercent(firstDeathRate),
    comfortBias,
    comfortPick: formatChampion(comfortPick || "unknown"),
    comfortPickRate: formatPercent(Math.max(meComfortRate, duoComfortRate)),
    comfortPickRateValue: Math.max(meComfortRate, duoComfortRate),
    duoIdentity: buildDuoIdentity(winRate, avgPlacement),
    top4Streak: stats.top4Streak,
    bottom4Streak: stats.bottom4Streak,
    matchCount
  };
}

async function handleDuo(req, env, ctx) {
  if (!env.RIOT_API_KEY) {
    return jsonResponse({ error: "Missing RIOT_API_KEY secret." }, 500);
  }

  const url = new URL(req.url);
  const region = normalizeRegion(url.searchParams.get("region"), env.DEFAULT_REGION || "euw");
  const meInput = normalizeName(url.searchParams.get("me"), env.DEFAULT_ME || "hugegamer-EUW");
  const duoInput = normalizeName(url.searchParams.get("duo"), env.DEFAULT_DUO || "MichyeoHEY-EUW");
  const matches = Math.min(50, Math.max(5, safeNumber(url.searchParams.get("matches"), Number(env.DEFAULT_MATCHES) || 25)));
  const tone = normalizeTone(url.searchParams.get("tone"));
  const verdictRaw = (url.searchParams.get("verdict") || "auto").trim().toLowerCase();
  const verdictStyle = verdictRaw === "fresh" || verdictRaw === "manual"
    ? "fresh"
    : verdictRaw === "ai"
      ? "ai"
      : "auto";

  const platform = PLATFORM_BY_REGION[region];
  const regional = REGION_BY_PLATFORM[platform];
  if (!platform || !regional) {
    return jsonResponse({ error: "Unsupported region." }, 400);
  }

  const cache = caches.default;
  const cacheKeyUrl = new URL(url.origin + "/duo");
  const cacheVersion = env.CACHE_VERSION || "v1";
  cacheKeyUrl.searchParams.set("v", cacheVersion);
  cacheKeyUrl.searchParams.set("region", region);
  cacheKeyUrl.searchParams.set("me", meInput.toLowerCase());
  cacheKeyUrl.searchParams.set("duo", duoInput.toLowerCase());
  cacheKeyUrl.searchParams.set("matches", String(matches));
  cacheKeyUrl.searchParams.set("tone", tone);
  cacheKeyUrl.searchParams.set("verdict", "auto");

  const cacheKey = new Request(cacheKeyUrl.toString(), req);
  const cached = await cache.match(cacheKey);
  if (cached) {
    const data = normalizeCachedPayload(await cached.clone().json());
    data.meta.source = "cache";
    data.insights = data.insights || buildFallbackInsights(data.summary, data.matches || []);
    const metaStats = data.insights?.meta || null;
    const roastsAuto = buildRoasts(data.summary, data.meta.duo, tone, metaStats, data.insights);

    const headers = { "Cache-Control": `public, max-age=${safeNumber(env.CACHE_TTL_SECONDS, 3600)}` };
    const canonicalVerdict = buildVerdict(data.summary, data.meta.duo, tone, { fresh: false });
    const canonical = {
      ...data,
      roasts: roastsAuto,
      verdict: canonicalVerdict,
      meta: { ...data.meta, verdictSource: "auto", roastsSource: "auto" }
    };
    ctx.waitUntil(cache.put(cacheKey, jsonResponse(canonical, 200, headers)));

    if (verdictStyle === "fresh") {
      data.meta.verdictSource = "fresh";
      data.meta.roastsSource = "auto";
      data.roasts = roastsAuto;
      data.verdict = buildVerdict(data.summary, data.meta.duo, tone, { fresh: true });
      return jsonResponse(data, 200, { "Cache-Control": "no-store" });
    }

    if (verdictStyle === "ai") {
      const [aiVerdict, aiRoasts] = await Promise.all([
        getAiVerdict(data.summary, data.meta.duo, tone, data.insights, env, ctx, url),
        getAiRoasts(data.summary, data.meta.duo, tone, data.insights, roastsAuto, env, ctx, url)
      ]);
      data.meta.verdictSource = aiVerdict.source;
      data.meta.roastsSource = aiRoasts.source;
      data.verdict = aiVerdict.verdict;
      data.roasts = aiRoasts.roasts;
      return jsonResponse(data, 200, { "Cache-Control": "no-store" });
    }

    return jsonResponse(canonical, 200, headers);
  }

  const mePlayer = await resolvePlayer(meInput, platform, regional, env);
  const duoPlayer = await resolvePlayer(duoInput, platform, regional, env);

  const matchScanCount = Math.min(100, Math.max(matches * 3, 20));
  const matchIds = await getMatchIds(mePlayer.puuid, regional, matchScanCount, env);

  const stats = {
    games: 0,
    wins: 0,
    firsts: 0,
    placementTotal: 0,
    firstDeaths: { me: 0, duo: 0 },
    champions: { me: {}, duo: {} },
    kills: { me: 0, duo: 0 },
    assists: { me: 0, duo: 0 },
    deaths: { me: 0, duo: 0 },
    damage: { me: 0, duo: 0 },
    damageTaken: { me: 0, duo: 0 },
    healing: { me: 0, duo: 0 },
    shielding: { me: 0, duo: 0 },
    gold: { me: 0, duo: 0 },
    placements: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 },
    top4Streak: 0,
    bottom4Streak: 0,
    items: { me: 0, duo: 0 },
    lowItems: { me: 0, duo: 0 },
    anvilChamps: { me: 0, duo: 0 }
  };
  let currentTop4Streak = 0;
  let currentBottom4Streak = 0;

  const matchesOut = [];

  for (const matchId of matchIds) {
    if (stats.games >= matches) break;
    const match = await getMatch(matchId, regional, env);
    if (!isArenaMatch(match.info)) continue;

    const participants = match.info.participants || [];
    const meParticipant = participants.find((p) => p.puuid === mePlayer.puuid);
    const duoParticipant = participants.find((p) => p.puuid === duoPlayer.puuid);
    if (!meParticipant || !duoParticipant) continue;

    stats.games += 1;
    const placement = meParticipant.placement || 0;
    stats.placementTotal += placement;
    if (placement >= 1 && placement <= 8) {
      stats.placements[placement] = (stats.placements[placement] || 0) + 1;
    }
    if (placement <= 4) {
      stats.wins += 1;
      currentTop4Streak += 1;
      currentBottom4Streak = 0;
      if (currentTop4Streak > stats.top4Streak) {
        stats.top4Streak = currentTop4Streak;
      }
    } else {
      currentBottom4Streak += 1;
      currentTop4Streak = 0;
      if (currentBottom4Streak > stats.bottom4Streak) {
        stats.bottom4Streak = currentBottom4Streak;
      }
    }
    if (placement === 1) {
      stats.firsts += 1;
    }

    const meDeaths = meParticipant.deaths || 0;
    const duoDeaths = duoParticipant.deaths || 0;
    stats.deaths.me += meDeaths;
    stats.deaths.duo += duoDeaths;
    if (meDeaths > duoDeaths) {
      stats.firstDeaths.me += 1;
    } else if (duoDeaths > meDeaths) {
      stats.firstDeaths.duo += 1;
    }

    const meKills = meParticipant.kills || 0;
    const duoKills = duoParticipant.kills || 0;
    stats.kills.me += meKills;
    stats.kills.duo += duoKills;
    stats.assists.me += meParticipant.assists || 0;
    stats.assists.duo += duoParticipant.assists || 0;
    stats.damage.me += meParticipant.totalDamageDealtToChampions || 0;
    stats.damage.duo += duoParticipant.totalDamageDealtToChampions || 0;
    stats.damageTaken.me += meParticipant.totalDamageTaken || 0;
    stats.damageTaken.duo += duoParticipant.totalDamageTaken || 0;
    stats.healing.me += meParticipant.totalHeal || 0;
    stats.healing.duo += duoParticipant.totalHeal || 0;
    stats.shielding.me += meParticipant.totalDamageShieldedOnTeammates || 0;
    stats.shielding.duo += duoParticipant.totalDamageShieldedOnTeammates || 0;
    stats.gold.me += meParticipant.goldEarned || 0;
    stats.gold.duo += duoParticipant.goldEarned || 0;
    const meItemCount = countItems(meParticipant);
    const duoItemCount = countItems(duoParticipant);
    stats.items.me += meItemCount;
    stats.items.duo += duoItemCount;
    if (meItemCount <= 3) stats.lowItems.me += 1;
    if (duoItemCount <= 3) stats.lowItems.duo += 1;
    if (isAnvilChampion(meParticipant.championName)) stats.anvilChamps.me += 1;
    if (isAnvilChampion(duoParticipant.championName)) stats.anvilChamps.duo += 1;

    const meChamp = meParticipant.championName || "unknown";
    const duoChamp = duoParticipant.championName || "unknown";
    stats.champions.me[meChamp] = (stats.champions.me[meChamp] || 0) + 1;
    stats.champions.duo[duoChamp] = (stats.champions.duo[duoChamp] || 0) + 1;

    const resultType = placement === 1 ? "first" : placement <= 4 ? "top4" : "bottom4";
    const resultLabel = resultType === "first" ? "1st" : resultType === "top4" ? "top 4" : "bottom 4";
    const highlightSeed = hashString(matchId) + placement * 13;

    matchesOut.push({
      result: resultType,
      resultLabel,
      placement,
      champs: `${formatChampion(meChamp)} + ${formatChampion(duoChamp)}`,
      highlight: buildHighlight(meParticipant, duoParticipant, placement, highlightSeed)
    });
  }

  const names = { me: mePlayer.name || meInput, duo: duoPlayer.name || duoInput };
  const summary = buildSummary(stats, names, matches);
  let metaStats = null;
  try {
    const tierData = await fetchTierList(env, ctx);
    const tierInfo = buildTierMap(tierData);
    metaStats = buildMetaStats(stats.champions, tierInfo);
  } catch (error) {
    metaStats = null;
  }

  const insights = buildInsights(stats, summary, metaStats);
  const blame = buildBlame(summary, names, insights);
  const roastsAuto = buildRoasts(summary, names, tone, metaStats, insights);
  const headers = { "Cache-Control": `public, max-age=${safeNumber(env.CACHE_TTL_SECONDS, 3600)}` };

  let verdictSource = verdictStyle === "fresh" ? "fresh" : "auto";
  let verdict = buildVerdict(summary, names, tone, { fresh: verdictStyle === "fresh" });
  let roastsSource = "auto";
  let roasts = roastsAuto;
  if (verdictStyle === "ai") {
    const [aiVerdict, aiRoasts] = await Promise.all([
      getAiVerdict(summary, names, tone, insights, env, ctx, url),
      getAiRoasts(summary, names, tone, insights, roastsAuto, env, ctx, url)
    ]);
    verdictSource = aiVerdict.source;
    verdict = aiVerdict.verdict;
    roastsSource = aiRoasts.source;
    roasts = aiRoasts.roasts;
  }

  const payload = {
    meta: {
      source: "api",
      updatedAt: new Date().toISOString(),
      matchCount: matches,
      duo: { me: names.me, duo: names.duo, region },
      verdictSource,
      roastsSource
    },
    summary,
    blame,
    insights,
    roasts,
    matches: matchesOut,
    verdict
  };

  if (verdictStyle === "fresh" || verdictStyle === "ai") {
    const cachePayload = {
      ...payload,
      verdict: buildVerdict(summary, names, tone, { fresh: false }),
      roasts: roastsAuto,
      meta: { ...payload.meta, verdictSource: "auto", roastsSource: "auto" }
    };
    ctx.waitUntil(cache.put(cacheKey, jsonResponse(cachePayload, 200, headers)));
    return jsonResponse(payload, 200, { "Cache-Control": "no-store" });
  }

  const response = jsonResponse(payload, 200, headers);
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function handleDebug(req, env, ctx) {
  const url = new URL(req.url);
  const region = normalizeRegion(url.searchParams.get("region"), env.DEFAULT_REGION || "euw");
  const platform = PLATFORM_BY_REGION[region];
  const regional = REGION_BY_PLATFORM[platform];
  const payload = {
    ok: true,
    hasKey: Boolean(env.RIOT_API_KEY),
    keyLength: env.RIOT_API_KEY ? env.RIOT_API_KEY.length : 0,
    defaults: {
      region: env.DEFAULT_REGION || "euw",
      me: env.DEFAULT_ME || "",
      duo: env.DEFAULT_DUO || "",
      matches: env.DEFAULT_MATCHES || ""
    },
    region,
    platform,
    regional
  };

  if (url.searchParams.get("probe") === "1" && platform) {
    payload.probe = await probeRiotStatus(platform, env);
    const probeName = url.searchParams.get("name");
    if (probeName) {
      payload.summonerProbe = await probeSummoner(platform, env, probeName);
    }
    const probeRiotId = url.searchParams.get("riotId");
    if (probeRiotId && regional) {
      payload.accountProbe = await probeAccountByRiotId(regional, env, probeRiotId);
    }
  }

  if (url.searchParams.get("ai") === "roasts") {
    const tone = normalizeTone(url.searchParams.get("tone"));
    const meInput = normalizeName(url.searchParams.get("me"), env.DEFAULT_ME || "hugegamer-EUW");
    const duoInput = normalizeName(url.searchParams.get("duo"), env.DEFAULT_DUO || "MichyeoHEY-EUW");
    const matches = Math.min(50, Math.max(5, safeNumber(url.searchParams.get("matches"), Number(env.DEFAULT_MATCHES) || 25)));
    const debugUrl = new URL(url.origin + "/duo");
    debugUrl.searchParams.set("region", region);
    debugUrl.searchParams.set("me", meInput);
    debugUrl.searchParams.set("duo", duoInput);
    debugUrl.searchParams.set("matches", String(matches));
    debugUrl.searchParams.set("tone", tone);
    debugUrl.searchParams.set("verdict", "auto");

    try {
      const duoResponse = await handleDuo(new Request(debugUrl.toString(), req), env, ctx);
      const duoData = await duoResponse.json();
      const insights = duoData.insights || buildFallbackInsights(duoData.summary, duoData.matches || []);
      const metaStats = insights.meta || null;
      const roastsAuto = buildRoasts(duoData.summary, duoData.meta.duo, tone, metaStats, insights);
      const aiRoasts = await getAiRoasts(
        duoData.summary,
        duoData.meta.duo,
        tone,
        insights,
        roastsAuto,
        env,
        ctx,
        url,
        { debug: true }
      );
      payload.aiRoasts = {
        source: aiRoasts.source,
        error: aiRoasts.error || null,
        sample: aiRoasts.roasts
      };
    } catch (error) {
      payload.aiRoasts = {
        source: "ai-fallback",
        error: error.message || "ai roasts debug error"
      };
    }
  }

  return jsonResponse(payload, 200);
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(req.url);
    if (url.pathname === "/debug") {
      try {
        return await handleDebug(req, env, ctx);
      } catch (error) {
        return jsonResponse({ error: error.message || "Debug error" }, 500);
      }
    }
    if (url.pathname === "/duo") {
      try {
        return await handleDuo(req, env, ctx);
      } catch (error) {
        const message = error?.message || "Server error";
        if (message === "riot rate limit" || message === "rate limit") {
          return jsonResponse({ error: "riot rate limit" }, 429);
        }
        return jsonResponse({ error: message }, 500);
      }
    }

    return jsonResponse({ error: "Not found" }, 404);
  }
};
