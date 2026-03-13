(function audienceResultsInit() {
  const sessionUtils = window.SessionUtils;
  const appKeys = (window.SessionUtils && window.SessionUtils.APP_KEYS) || {};
  const RESULTS_KEY_PREFIX = appKeys.RESULTS_KEY_PREFIX || "tv_manager_audience_results_";
  const DATE_GRID_KEY_PREFIX = appKeys.DATE_GRID_KEY_PREFIX || "tv_manager_date_grid_";
  const GRID_PUBLICATION_KEY_PREFIX = appKeys.GRID_PUBLICATION_KEY_PREFIX || "tv_manager_grid_publication_";
  const PLAYER_REDIFF_STATS_KEY_PREFIX = appKeys.PLAYER_REDIFF_STATS_KEY_PREFIX || "tv_manager_player_rediff_stats_";
  const CALCULATION_TIME_MINUTE = (1 * 60) + 1; // 01:01

  function getPlayerId(sessionData) {
    if (sessionUtils && typeof sessionUtils.getPlayerId === "function") {
      return sessionUtils.getPlayerId(sessionData);
    }
    return sessionData.email || sessionData.username || "player";
  }

  function storageKey(sessionData) {
    return `${RESULTS_KEY_PREFIX}${getPlayerId(sessionData)}`;
  }

  function dateGridStorageKey(sessionData) {
    return `${DATE_GRID_KEY_PREFIX}${getPlayerId(sessionData)}`;
  }

  function rediffStatsStorageKey(sessionData) {
    return `${PLAYER_REDIFF_STATS_KEY_PREFIX}${getPlayerId(sessionData)}`;
  }

  function gridPublicationStorageKey(sessionData) {
    return `${GRID_PUBLICATION_KEY_PREFIX}${getPlayerId(sessionData)}`;
  }

  function getDateByOffset(offsetDays) {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return date;
  }

  function toDateKey(date) {
    return sessionUtils.toDateKey(date);
  }

  function getDateKeyByOffset(offsetDays) {
    return sessionUtils.getDateKeyByOffset(offsetDays);
  }

  function getDayKeyByDate(date) {
    const map = { 0: "dimanche", 1: "lundi", 2: "mardi", 3: "mercredi", 4: "jeudi", 5: "vendredi", 6: "samedi" };
    return map[date.getDay()];
  }

  function readStore(sessionData) {
    const raw = localStorage.getItem(storageKey(sessionData));
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function readGridPublicationStore(sessionData) {
    const raw = localStorage.getItem(gridPublicationStorageKey(sessionData));
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function isGridPublished(sessionData, dateKey) {
    const store = readGridPublicationStore(sessionData);
    const row = store[String(dateKey || "")];
    return Boolean(row && row.published);
  }

  function writeStore(sessionData, data) {
    localStorage.setItem(storageKey(sessionData), JSON.stringify(data));
  }

  function writeRediffStats(sessionData, dateKey, simulation) {
    if (!simulation || !simulation.playerRediffusionStats) return;
    const payload = {
      dateKey,
      updatedAt: new Date().toISOString(),
      stats: simulation.playerRediffusionStats
    };
    localStorage.setItem(rediffStatsStorageKey(sessionData), JSON.stringify(payload));
  }

  function readRediffStats(sessionData) {
    const raw = localStorage.getItem(rediffStatsStorageKey(sessionData));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function buildSimulation(sessionData, date) {
    const engine = window.AudienceEngine;
    if (!engine) return null;
    const dayKey = getDayKeyByDate(date);
    const dateKey = toDateKey(date);
    let playerDay = null;
    if (!isGridPublished(sessionData, dateKey)) {
      playerDay = [];
    }
    const rawDateGrid = localStorage.getItem(dateGridStorageKey(sessionData));
    if (rawDateGrid && !Array.isArray(playerDay)) {
      try {
        const parsed = JSON.parse(rawDateGrid);
        playerDay = parsed ? parsed[dateKey] : null;
      } catch {
        playerDay = null;
      }
    }
    if (!playerDay && !Array.isArray(playerDay)) {
      playerDay = [];
    }
    const playerChannelName = sessionUtils && typeof sessionUtils.getPlayerChannelName === "function"
      ? sessionUtils.getPlayerChannelName(sessionData)
      : (sessionData.username || "Ta chaîne");
    const simulation = engine.simulateDay(
      dayKey,
      playerChannelName,
      playerDay,
      { sessionData, dateKey }
    );
    return {
      dateKey: toDateKey(date),
      dayKey,
      computedAt: new Date().toISOString(),
      simulation
    };
  }

  function computeForOffset(sessionData, offsetDays, force) {
    const date = getDateByOffset(offsetDays);
    const key = toDateKey(date);
    const store = readStore(sessionData);
    if (!force && store[key]) return store[key];
    const result = buildSimulation(sessionData, date);
    if (!result) return null;
    store[key] = result;
    writeStore(sessionData, store);
    writeRediffStats(sessionData, key, result.simulation);
    return result;
  }

  function getResultByOffset(sessionData, offsetDays) {
    const store = readStore(sessionData);
    return store[getDateKeyByOffset(offsetDays)] || null;
  }

  function ensureYesterdayCalculated(sessionData) {
    const now = new Date();
    const minuteOfDay = (now.getHours() * 60) + now.getMinutes();
    if (minuteOfDay < CALCULATION_TIME_MINUTE) {
      return getResultByOffset(sessionData, -1);
    }
    return computeForOffset(sessionData, -1, false);
  }

  window.AudienceResults = {
    CALCULATION_TIME_MINUTE,
    getDateKeyByOffset,
    getResultByOffset,
    getPlayerRediffusionStats: function getPlayerRediffusionStats(sessionData) {
      return readRediffStats(sessionData);
    },
    ensureYesterdayCalculated,
    computeYesterdayNow: function computeYesterdayNow(sessionData, force) {
      return computeForOffset(sessionData, -1, Boolean(force));
    }
  };
})();
