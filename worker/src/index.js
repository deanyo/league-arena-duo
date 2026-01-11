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

function normalizeName(value, fallback) {
  const cleaned = (value || "").trim();
  return cleaned ? cleaned : fallback;
}

function normalizeRegion(value, fallback) {
  const cleaned = (value || "").trim().toLowerCase();
  return PLATFORM_BY_REGION[cleaned] ? cleaned : fallback;
}

function safeNumber(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatPercent(value) {
  return Math.round(value * 100) + "%";
}

function formatChampion(name) {
  if (!name) return "unknown";
  return name.replace(/([a-z])([A-Z])/g, "$1 $2");
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
    throw new Error("rate limit");
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

async function getMatchIds(puuid, region, count, env) {
  const url = `https://${region}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=${count}`;
  return riotFetch(url, env);
}

async function getMatch(matchId, region, env) {
  const url = `https://${region}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
  return riotFetch(url, env);
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

function buildHighlight(me, duo) {
  const kills = (me.kills || 0) + (duo.kills || 0);
  const deaths = (me.deaths || 0) + (duo.deaths || 0);
  if (kills >= deaths + 6) return "out-traded the lobby";
  if (deaths >= kills + 4) return "scrapped hard, fell short";
  return "even trades, messy finish";
}

function buildRoasts(summary, names) {
  const roasts = [];
  const firstLeader = summary.firstDeaths.me === summary.firstDeaths.duo
    ? "tied"
    : summary.firstDeaths.me > summary.firstDeaths.duo
      ? names.me
      : names.duo;
  const firstBody = firstLeader === "tied"
    ? `both players trade first deaths evenly. the data suggests shared bravery.`
    : `${firstLeader} is first down in ${summary.firstDeathRate}. the data suggests early enthusiasm.`;
  roasts.push({ title: "first death trophy", body: firstBody });

  const ultLeader = summary.unusedUlts.me === summary.unusedUlts.duo
    ? "tied"
    : summary.unusedUlts.me > summary.unusedUlts.duo
      ? names.me
      : names.duo;
  const ultCount = ultLeader === names.me ? summary.unusedUlts.me : summary.unusedUlts.duo;
  const ultBody = ultLeader === "tied"
    ? "both players are saving ultimates for a future patch."
    : `${ultLeader} ended ${ultCount} games with ultimate unused. preservation society certified.`;
  roasts.push({ title: "ult hoarder", body: ultBody });

  const comfortBody = summary.comfortBias === "tied"
    ? `${summary.comfortPick} shows up in both rotations. shared comfort pick energy.`
    : `${summary.comfortPick} shows up in ${summary.comfortPickRate}. comfort pick or lifestyle choice.`;
  roasts.push({ title: "comfort lock", body: comfortBody });

  roasts.push({
    title: "clutch window",
    body: `win rate sits at ${formatPercent(summary.winRate)}. small sample size, but the duo looks ${summary.winRate >= 0.55 ? "dangerous" : "swingy"}.`
  });

  return roasts;
}

function buildVerdict(summary, names) {
  const winRate = formatPercent(summary.winRate);
  const avg = summary.avgPlacement.toFixed(1);
  return `${names.me} and ${names.duo} are winning ${winRate} of their arena games together with an average placement of ${avg}. the data suggests ${summary.comfortBias} leans on ${summary.comfortPick}, while riot keeps the augment wheel spicy. small sample size, but the vibe says you are one good roll away from dominance.`;
}

function buildBlame(summary, names) {
  if (summary.games === 0) {
    return {
      me: { share: 0.33, reason: "no data yet" },
      duo: { share: 0.33, reason: "no data yet" },
      riot: { share: 0.34, reason: "no data yet" }
    };
  }

  const losses = summary.games - summary.wins;
  const meScore = 1 + summary.firstDeaths.me * 1.3 + summary.unusedUlts.me * 1.2;
  const duoScore = 1 + summary.firstDeaths.duo * 1.3 + summary.unusedUlts.duo * 1.2;
  const riotScore = 1 + losses * 0.8 + (1 - summary.winRate) * 3;
  const total = meScore + duoScore + riotScore;

  const meReason = summary.unusedUlts.me > 0 ? "ult collector" : summary.firstDeaths.me > summary.firstDeaths.duo ? "first to fall" : "overconfident engages";
  const duoReason = summary.unusedUlts.duo > 0 ? "ult collector" : summary.firstDeaths.duo > summary.firstDeaths.me ? "first to fall" : "combo addict";
  const riotReason = summary.winRate < 0.5 ? "augment rng" : "balance patch vibes";

  return {
    me: { share: meScore / total, reason: meReason },
    duo: { share: duoScore / total, reason: duoReason },
    riot: { share: riotScore / total, reason: riotReason }
  };
}

function buildSummary(stats, names, matchCount) {
  const games = stats.games;
  const wins = stats.wins;
  const winRate = games > 0 ? wins / games : 0;
  const avgPlacement = games > 0 ? stats.placementTotal / games : 0;

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
    firstDeaths: stats.firstDeaths,
    firstDeathRate: formatPercent(firstDeathRate),
    unusedUlts: stats.unusedUlts,
    comfortBias,
    comfortPick: formatChampion(comfortPick || "unknown"),
    comfortPickRate: formatPercent(Math.max(meComfortRate, duoComfortRate)),
    duoIdentity: buildDuoIdentity(winRate, avgPlacement),
    matchCount
  };
}

async function handleDuo(req, env, ctx) {
  if (!env.RIOT_API_KEY) {
    return jsonResponse({ error: "Missing RIOT_API_KEY secret." }, 500);
  }

  const url = new URL(req.url);
  const region = normalizeRegion(url.searchParams.get("region"), env.DEFAULT_REGION || "euw");
  const meInput = normalizeName(url.searchParams.get("me"), env.DEFAULT_ME || "deanyo");
  const duoInput = normalizeName(url.searchParams.get("duo"), env.DEFAULT_DUO || "cerri");
  const matches = Math.min(50, Math.max(5, safeNumber(url.searchParams.get("matches"), Number(env.DEFAULT_MATCHES) || 25)));

  const platform = PLATFORM_BY_REGION[region];
  const regional = REGION_BY_PLATFORM[platform];
  if (!platform || !regional) {
    return jsonResponse({ error: "Unsupported region." }, 400);
  }

  const cache = caches.default;
  const cacheKeyUrl = new URL(url.origin + "/duo");
  cacheKeyUrl.searchParams.set("region", region);
  cacheKeyUrl.searchParams.set("me", meInput.toLowerCase());
  cacheKeyUrl.searchParams.set("duo", duoInput.toLowerCase());
  cacheKeyUrl.searchParams.set("matches", String(matches));
  cacheKeyUrl.searchParams.set("tone", url.searchParams.get("tone") || "classic");
  cacheKeyUrl.searchParams.set("verdict", url.searchParams.get("verdict") || "auto");

  const cacheKey = new Request(cacheKeyUrl.toString(), req);
  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }

  const meSummoner = await getSummonerByName(meInput, platform, env);
  const duoSummoner = await getSummonerByName(duoInput, platform, env);

  const matchScanCount = Math.min(100, Math.max(matches * 3, 20));
  const matchIds = await getMatchIds(meSummoner.puuid, regional, matchScanCount, env);

  const stats = {
    games: 0,
    wins: 0,
    placementTotal: 0,
    firstDeaths: { me: 0, duo: 0 },
    unusedUlts: { me: 0, duo: 0 },
    champions: { me: {}, duo: {} }
  };

  const matchesOut = [];

  for (const matchId of matchIds) {
    if (stats.games >= matches) break;
    const match = await getMatch(matchId, regional, env);
    if (!isArenaMatch(match.info)) continue;

    const participants = match.info.participants || [];
    const meParticipant = participants.find((p) => p.puuid === meSummoner.puuid);
    const duoParticipant = participants.find((p) => p.puuid === duoSummoner.puuid);
    if (!meParticipant || !duoParticipant) continue;

    stats.games += 1;
    stats.placementTotal += meParticipant.placement || 0;
    if ((meParticipant.placement || 0) <= 2) {
      stats.wins += 1;
    }

    const meDeaths = meParticipant.deaths || 0;
    const duoDeaths = duoParticipant.deaths || 0;
    if (meDeaths > duoDeaths) {
      stats.firstDeaths.me += 1;
    } else if (duoDeaths > meDeaths) {
      stats.firstDeaths.duo += 1;
    }

    if ((meParticipant.spell4Casts || 0) === 0 && meDeaths > 0) {
      stats.unusedUlts.me += 1;
    }
    if ((duoParticipant.spell4Casts || 0) === 0 && duoDeaths > 0) {
      stats.unusedUlts.duo += 1;
    }

    const meChamp = meParticipant.championName || "unknown";
    const duoChamp = duoParticipant.championName || "unknown";
    stats.champions.me[meChamp] = (stats.champions.me[meChamp] || 0) + 1;
    stats.champions.duo[duoChamp] = (stats.champions.duo[duoChamp] || 0) + 1;

    matchesOut.push({
      result: (meParticipant.placement || 0) <= 2 ? "win" : "loss",
      placement: meParticipant.placement || 0,
      champs: `${formatChampion(meChamp)} + ${formatChampion(duoChamp)}`,
      highlight: buildHighlight(meParticipant, duoParticipant)
    });
  }

  const names = { me: meSummoner.name || meInput, duo: duoSummoner.name || duoInput };
  const summary = buildSummary(stats, names, matches);
  const blame = buildBlame(summary, names);
  const roasts = buildRoasts(summary, names);
  const verdict = buildVerdict(summary, names);

  const payload = {
    meta: {
      source: "api",
      updatedAt: new Date().toISOString(),
      matchCount: matches,
      duo: { me: names.me, duo: names.duo, region }
    },
    summary,
    blame,
    roasts,
    matches: matchesOut,
    verdict
  };

  const headers = { "Cache-Control": `public, max-age=${safeNumber(env.CACHE_TTL_SECONDS, 3600)}` };
  const response = jsonResponse(payload, 200, headers);
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    const url = new URL(req.url);
    if (url.pathname === "/duo") {
      try {
        return await handleDuo(req, env, ctx);
      } catch (error) {
        return jsonResponse({ error: error.message || "Server error" }, 500);
      }
    }

    return jsonResponse({ error: "Not found" }, 404);
  }
};
