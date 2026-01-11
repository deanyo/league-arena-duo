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

function buildHighlight(me, duo) {
  const kills = (me.kills || 0) + (duo.kills || 0);
  const deaths = (me.deaths || 0) + (duo.deaths || 0);
  if (kills >= deaths + 6) return "out-traded the lobby";
  if (deaths >= kills + 4) return "scrapped hard, fell short";
  return "even trades, messy finish";
}

function toneCopy(tone) {
  const copy = {
    gentle: {
      firstTie: "both share the first deaths evenly. the data suggests mutual bravery.",
      firstLead: (leader, rate) => `${leader} takes the first nap in ${rate}. the data suggests early enthusiasm.`,
      ultTie: "both are saving ultimates for the perfect moment.",
      ultLead: (leader, count) => `${leader} held ultimate in ${count} rounds. patience, or optimism.`,
      comfortTie: (pick) => `${pick} appears on both sides. comfort pick energy.`,
      comfortLead: (pick, rate) => `${pick} shows up in ${rate}. leaning into what feels safe.`,
      clutch: (winRate) => `win rate sits at ${formatPercent(winRate)}. small sample size, but the duo feels ${winRate >= 0.55 ? "steady" : "swingy"}.`
    },
    classic: {
      firstTie: "both players trade first deaths evenly. the data suggests shared bravery.",
      firstLead: (leader, rate) => `${leader} is first down in ${rate}. the data suggests early enthusiasm.`,
      ultTie: "both players are saving ultimates for a future patch.",
      ultLead: (leader, count) => `${leader} ended ${count} games with ultimate unused. preservation society certified.`,
      comfortTie: (pick) => `${pick} shows up in both rotations. shared comfort pick energy.`,
      comfortLead: (pick, rate) => `${pick} shows up in ${rate}. comfort pick or lifestyle choice.`,
      clutch: (winRate) => `win rate sits at ${formatPercent(winRate)}. small sample size, but the duo looks ${winRate >= 0.55 ? "dangerous" : "swingy"}.`
    },
    savage: {
      firstTie: "both players speedrun the first death at equal pace. balance achieved.",
      firstLead: (leader, rate) => `${leader} hits the grey screen first in ${rate}. fearless, or just fast.`,
      ultTie: "both players are hoarding ultimates like collectibles.",
      ultLead: (leader, count) => `${leader} saved ultimate in ${count} rounds. museum curator energy.`,
      comfortTie: (pick) => `${pick} appears on both sides. commitment level: unshakable.`,
      comfortLead: (pick, rate) => `${pick} shows up in ${rate}. one-pick lifestyle confirmed.`,
      clutch: (winRate) => `win rate sits at ${formatPercent(winRate)}. small sample size, but the duo looks ${winRate >= 0.55 ? "dangerous" : "chaotic"}.`
    }
  };

  return copy[tone] || copy.classic;
}

function buildRoasts(summary, names, tone) {
  const copy = toneCopy(tone);
  const roasts = [];
  const firstLeader = summary.firstDeaths.me === summary.firstDeaths.duo
    ? "tied"
    : summary.firstDeaths.me > summary.firstDeaths.duo
      ? names.me
      : names.duo;
  const firstBody = firstLeader === "tied"
    ? copy.firstTie
    : copy.firstLead(firstLeader, summary.firstDeathRate);
  roasts.push({ title: "first death trophy", body: firstBody });

  const ultLeader = summary.unusedUlts.me === summary.unusedUlts.duo
    ? "tied"
    : summary.unusedUlts.me > summary.unusedUlts.duo
      ? names.me
      : names.duo;
  const ultCount = ultLeader === names.me ? summary.unusedUlts.me : summary.unusedUlts.duo;
  const ultBody = ultLeader === "tied"
    ? copy.ultTie
    : copy.ultLead(ultLeader, ultCount);
  roasts.push({ title: "ult hoarder", body: ultBody });

  const comfortBody = summary.comfortBias === "tied"
    ? copy.comfortTie(summary.comfortPick)
    : copy.comfortLead(summary.comfortPick, summary.comfortPickRate);
  roasts.push({ title: "comfort lock", body: comfortBody });

  roasts.push({
    title: "clutch window",
    body: copy.clutch(summary.winRate)
  });

  return roasts;
}

function buildVerdict(summary, names, tone, options = {}) {
  const winRate = formatPercent(summary.winRate);
  const avg = summary.avgPlacement.toFixed(1);
  const biasText = summary.comfortBias === "tied"
    ? `both lean on ${summary.comfortPick}`
    : `${summary.comfortBias} leans on ${summary.comfortPick}`;
  const templates = {
    gentle: [
      () => `${names.me} and ${names.duo} are winning ${winRate} of their arena games together with an average placement of ${avg}. the data suggests ${biasText}, while riot keeps the augment wheel spicy. small sample size, but the vibe says you are close to a clean run.`,
      () => `${names.me} and ${names.duo} are sitting at ${winRate} wins with an average placement of ${avg}. the data suggests ${biasText}, and riot provides the occasional plot twist. small sample size, but the climb feels within reach.`
    ],
    classic: [
      () => `${names.me} and ${names.duo} are winning ${winRate} of their arena games together with an average placement of ${avg}. the data suggests ${biasText}, while riot keeps the augment wheel spicy. small sample size, but the vibe says you are one good roll away from dominance.`,
      () => `${names.me} and ${names.duo} are landing at ${winRate} wins with an average placement of ${avg}. the data suggests ${biasText}, and riot keeps the chaos flowing. small sample size, but the energy says this duo is one streak away.`
    ],
    savage: [
      () => `${names.me} and ${names.duo} are winning ${winRate} of their arena games with an average placement of ${avg}. the data suggests ${biasText}, and riot keeps the augment wheel on hard mode. small sample size, but the comeback arc is still possible.`,
      () => `${names.me} and ${names.duo} are sitting at ${winRate} wins with an average placement of ${avg}. the data suggests ${biasText}, and riot keeps the chaos dialed up. small sample size, but the next streak could flip the story.`
    ]
  };
  const toneTemplates = templates[tone] || templates.classic;
  const seed = options.fresh ? null : Math.floor(summary.winRate * 1000) + summary.games * 7 + summary.firstDeaths.duo;
  const template = pickVariant(toneTemplates, seed);
  return template ? template() : "";
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
  const meInput = normalizeName(url.searchParams.get("me"), env.DEFAULT_ME || "hugegamer-EUW");
  const duoInput = normalizeName(url.searchParams.get("duo"), env.DEFAULT_DUO || "MichyeoHEY-EUW");
  const matches = Math.min(50, Math.max(5, safeNumber(url.searchParams.get("matches"), Number(env.DEFAULT_MATCHES) || 25)));
  const tone = normalizeTone(url.searchParams.get("tone"));
  const verdictRaw = (url.searchParams.get("verdict") || "auto").trim().toLowerCase();
  const verdictStyle = verdictRaw === "fresh" || verdictRaw === "manual" ? "fresh" : "auto";

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
  cacheKeyUrl.searchParams.set("tone", tone);
  cacheKeyUrl.searchParams.set("verdict", "auto");

  const cacheKey = new Request(cacheKeyUrl.toString(), req);
  const cached = await cache.match(cacheKey);
  if (cached) {
    if (verdictStyle === "fresh") {
      const data = await cached.clone().json();
      data.meta.source = "cache";
      data.verdict = buildVerdict(data.summary, data.meta.duo, tone, { fresh: true });
      return jsonResponse(data, 200, { "Cache-Control": "no-store" });
    }
    return cached;
  }

  const mePlayer = await resolvePlayer(meInput, platform, regional, env);
  const duoPlayer = await resolvePlayer(duoInput, platform, regional, env);

  const matchScanCount = Math.min(100, Math.max(matches * 3, 20));
  const matchIds = await getMatchIds(mePlayer.puuid, regional, matchScanCount, env);

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
    const meParticipant = participants.find((p) => p.puuid === mePlayer.puuid);
    const duoParticipant = participants.find((p) => p.puuid === duoPlayer.puuid);
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

  const names = { me: mePlayer.name || meInput, duo: duoPlayer.name || duoInput };
  const summary = buildSummary(stats, names, matches);
  const blame = buildBlame(summary, names);
  const roasts = buildRoasts(summary, names, tone);
  const verdict = buildVerdict(summary, names, tone, { fresh: verdictStyle === "fresh" });

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
  if (verdictStyle === "fresh") {
    const cachePayload = { ...payload, verdict: buildVerdict(summary, names, tone, { fresh: false }) };
    ctx.waitUntil(cache.put(cacheKey, jsonResponse(cachePayload, 200, headers)));
    return jsonResponse(payload, 200, { "Cache-Control": "no-store" });
  }
  const response = jsonResponse(payload, 200, headers);
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function handleDebug(req, env) {
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
        return await handleDebug(req, env);
      } catch (error) {
        return jsonResponse({ error: error.message || "Debug error" }, 500);
      }
    }
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
