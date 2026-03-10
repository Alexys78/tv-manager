(function gameApp() {
  const appKeys = (window.SessionUtils && window.SessionUtils.APP_KEYS) || {};
  const DATE_GRID_KEY_PREFIX = appKeys.DATE_GRID_KEY_PREFIX || "tv_manager_date_grid_";
  const engine = window.AudienceEngine;
  const resultsStore = window.AudienceResults;
  const financeStore = window.FinanceEngine;
  const diffusionRules = window.DiffusionRules;
  const sessionUtils = window.SessionUtils;
  const session = sessionUtils && typeof sessionUtils.requireSession === "function"
    ? sessionUtils.requireSession({ redirectPath: "index.html", persist: true, allowEmailParam: true, clearSearch: true })
    : null;
  if (!session) return;

  const DAY_START = Number(sessionUtils && sessionUtils.DAY_START_MINUTE) || (5 * 60);
  const DAY_END = Number(sessionUtils && sessionUtils.DAY_END_MINUTE) || (25 * 60);

  function getPlayerId() {
    if (sessionUtils && typeof sessionUtils.getPlayerId === "function") {
      return sessionUtils.getPlayerId(session);
    }
    return session.email || session.username || "player";
  }

  function dateGridStorageKey() {
    return `${DATE_GRID_KEY_PREFIX}${getPlayerId()}`;
  }

  function toDateKey(date) {
    return sessionUtils.toDateKey(date);
  }

  function getTodayDateKey() {
    return toDateKey(new Date());
  }

  function readDateGridDay(dateKey) {
    const raw = localStorage.getItem(dateGridStorageKey());
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      const row = parsed ? parsed[dateKey] : null;
      if (Array.isArray(row)) return row;
      if (row && Array.isArray(row.day)) return row.day;
      return [];
    } catch {
      return [];
    }
  }

  function normalizeDateGridDay(rawDay) {
    if (!rawDay) return [];
    if (Array.isArray(rawDay)) return rawDay;
    if (rawDay && Array.isArray(rawDay.day)) return rawDay.day;
    if (rawDay && (Array.isArray(rawDay.before) || Array.isArray(rawDay.after))) {
      const before = Array.isArray(rawDay.before) ? rawDay.before : [];
      const after = Array.isArray(rawDay.after) ? rawDay.after : [];
      return [...before, ...after];
    }
    return [];
  }

  function buildSeenSetBeforeDate(dateKey) {
    const raw = localStorage.getItem(dateGridStorageKey());
    if (!raw) return new Set();
    const seen = new Set();
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return seen;
      Object.keys(parsed)
        .filter((key) => key < dateKey)
        .sort()
        .forEach((key) => {
          const entries = normalizeDateGridDay(parsed[key]);
          entries.forEach((entry) => {
            if (!entry || !entry.title) return;
            if (diffusionRules && typeof diffusionRules.getTrackingKey === "function") {
              const trackKey = diffusionRules.getTrackingKey(entry);
              if (trackKey) seen.add(trackKey);
              return;
            }
            const fallback = entry.categoryId === "series"
              ? `${entry.title}::S${entry.season || 1}E${entry.episode || 1}`
              : entry.title;
            if (fallback) seen.add(fallback);
          });
        });
    } catch {
      return seen;
    }
    return seen;
  }

  function getStatusesForDateEntries(dateKey, entries) {
    const list = Array.isArray(entries) ? entries : [];
    const seen = buildSeenSetBeforeDate(dateKey);
    return list.map((entry) => {
      if (!entry || !entry.title) return null;
      if (diffusionRules && typeof diffusionRules.resolveStatus === "function") {
        return diffusionRules.resolveStatus(entry, seen);
      }
      if (entry.categoryId === "information") return "inedit";
      const fallback = entry.categoryId === "series"
        ? `${entry.title}::S${entry.season || 1}E${entry.episode || 1}`
        : entry.title;
      const status = fallback && seen.has(fallback) ? "rediffusion" : "inedit";
      if (fallback) seen.add(fallback);
      return status;
    });
  }

  function isGridPublished(dateKey) {
    if (!financeStore || typeof financeStore.isGridPublished !== "function") return false;
    return financeStore.isGridPublished(session, dateKey);
  }

  function getDayKeyByOffset(offsetDays) {
    const map = { 0: "dimanche", 1: "lundi", 2: "mardi", 3: "mercredi", 4: "jeudi", 5: "vendredi", 6: "samedi" };
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return map[date.getDay()];
  }

  function formatDateByOffset(offsetDays) {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    const parts = new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long"
    }).formatToParts(date);
    const weekday = (parts.find((part) => part.type === "weekday") || { value: "" }).value;
    const day = (parts.find((part) => part.type === "day") || { value: "" }).value;
    const month = (parts.find((part) => part.type === "month") || { value: "" }).value;
    const cap = (value) => (value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value);
    return `${cap(weekday)} ${day} ${cap(month)}`.trim();
  }

  function getTodayKey() {
    return getDayKeyByOffset(0);
  }

  function createStatusBadge(label, kind) {
    const badge = document.createElement("span");
    badge.className = `status-badge ${kind || "neutral"}`;
    badge.textContent = label;
    return badge;
  }

  function appendProgramRow(target, startMinute, endMinute, label, colorClass, statusKind, categoryId) {
    const row = document.createElement("div");
    row.className = "today-row";

    const time = document.createElement("span");
    time.className = "today-time";
    time.textContent = `${engine.formatMinute(startMinute)} - ${engine.formatMinute(endMinute)}`;

    const program = document.createElement("span");
    program.className = `today-program ${colorClass || ""}`;
    program.textContent = label || "Aucun programme";
    if (!label || label === "Aucun programme") {
      program.classList.add("empty-slot");
    }

    const status = document.createElement("span");
    status.className = "today-status";
    if (!statusKind) {
      status.appendChild(createStatusBadge("-", "neutral"));
    } else {
      const statusLabel = (diffusionRules && typeof diffusionRules.getStatusLabel === "function")
        ? diffusionRules.getStatusLabel(statusKind, categoryId)
        : ((categoryId === "information" && statusKind === "inedit")
          ? "En direct"
          : engine.DIFFUSION_LABELS[statusKind]);
      status.appendChild(createStatusBadge(statusLabel, statusKind));
    }

    row.append(time, program, status);
    target.appendChild(row);
  }

  function renderTodaySchedule(simulation, statusByDay, isPublishedToday) {
    const list = document.getElementById("todayScheduleList");
    const todayLabel = document.getElementById("todayLabel");
    if (!list || !todayLabel) return;

    const formattedDate = formatDateByOffset(0);
    todayLabel.textContent = formattedDate;
    list.replaceChildren();

    appendProgramRow(list, 1 * 60, DAY_START, "Programme de nuit", "", null, "");

    if (!isPublishedToday) {
      appendProgramRow(list, DAY_START, DAY_END, "Aucune diffusion (grille non publiée)", "", null, "");
      return;
    }

    const playerChannel = simulation.channels.find((channel) => channel.id === "player");
    const detailByStart = new Map();
    simulation.details.forEach((slot) => detailByStart.set(slot.start, slot));

    let cursor = DAY_START;
    const statuses = Array.isArray(statusByDay) ? statusByDay : [];
    playerChannel.schedule.forEach((entry, index) => {
      const label = entry.categoryId === "series" && entry.season && entry.episode
        ? `${entry.title} - S${entry.season}E${entry.episode}`
        : entry.title;
      const colorClass = engine.CATEGORY_COLOR_CLASSES[entry.categoryId] || "";
      const status = statuses[index] || (detailByStart.get(entry.start) ? detailByStart.get(entry.start).shares.player.status : null);
      appendProgramRow(list, entry.start, entry.end, label, colorClass, status, entry.categoryId || "");
      cursor = entry.end;
    });

    if (cursor < DAY_END) {
      appendProgramRow(list, cursor, DAY_END, "Temps libre", "", null, "");
    }
  }

  function renderDailyRanking(simulation, dayKey, dateText) {
    const rankingContainer = document.getElementById("dailyRanking");
    if (!rankingContainer) return;
    const rankingLabel = document.getElementById("rankingLabel");
    if (rankingLabel) {
      rankingLabel.textContent = dateText;
    }

    if (!simulation || !Array.isArray(simulation.ranking)) {
      const empty = document.createElement("div");
      empty.className = "ranking-row";
      empty.textContent = "Audiences de la veille non encore calculées.";
      rankingContainer.replaceChildren(empty);
      return;
    }

    const rows = simulation.ranking.map((row, index) => {
      const line = document.createElement("div");
      line.className = `ranking-row ${row.id === "player" ? "player-row" : ""}`;

      const rank = document.createElement("span");
      rank.className = "ranking-rank";
      rank.textContent = `#${index + 1}`;

      const name = document.createElement("span");
      name.className = "ranking-name";
      name.textContent = row.name;

      const share = document.createElement("span");
      share.className = "ranking-share";
      share.textContent = `${row.share.toFixed(1)}%`;

      line.append(rank, name, share);
      return line;
    });

    rankingContainer.replaceChildren(...rows);
  }

  function formatEuro(value) {
    return sessionUtils.formatEuro(Number(value) || 0);
  }

  function renderFinanceSummary(financeResult, dateText) {
    const wrap = document.getElementById("financeSummary");
    const label = document.getElementById("financeLabel");
    if (!wrap || !label) return;
    label.textContent = dateText;

    if (!financeResult) {
      const empty = document.createElement("div");
      empty.className = "ranking-row";
      empty.textContent = "Résultat de la veille non disponible.";
      wrap.replaceChildren(empty);
      return;
    }

    const items = [
      { title: "Revenus", value: formatEuro(financeResult.totalRevenue), tone: "neutral" },
      { title: "Dépenses", value: formatEuro(financeResult.totalCosts), tone: "neutral" },
      { title: "Résultat", value: formatEuro(financeResult.netResult), tone: Number(financeResult.netResult) >= 0 ? "positive" : "negative" }
    ];
    const cards = items.map((item) => {
      const card = document.createElement("div");
      card.className = `finance-summary-item ${item.tone}`.trim();
      const t = document.createElement("span");
      t.className = "finance-summary-title";
      t.textContent = item.title;
      const v = document.createElement("strong");
      v.className = "finance-summary-value";
      v.textContent = item.value;
      card.append(t, v);
      return card;
    });
    wrap.replaceChildren(...cards);
  }

  const welcomeTitle = document.getElementById("welcomeTitle");
  if (welcomeTitle && session.username) {
    welcomeTitle.textContent = `Bienvenue, ${session.username}`;
  }

  if (engine) {
    const todayKey = getTodayKey();
    const todayDateKey = getTodayDateKey();
    const publishedToday = isGridPublished(todayDateKey);
    const todayDayEntries = publishedToday ? readDateGridDay(todayDateKey) : [];
    const todayStatuses = publishedToday ? getStatusesForDateEntries(todayDateKey, todayDayEntries) : [];
    const programSimulation = engine.simulateDay(
      todayKey,
      session.username ? `${session.username} TV` : "Ta chaîne",
      todayDayEntries
    );
    let rankingSimulation = null;
    let rankingDayKey = getDayKeyByOffset(-1);
    if (resultsStore) {
      const ensured = resultsStore.ensureYesterdayCalculated(session);
      rankingSimulation = ensured ? ensured.simulation : null;
      rankingDayKey = ensured && ensured.dayKey ? ensured.dayKey : rankingDayKey;
    } else {
      const yesterdayKey = getDayKeyByOffset(-1);
      rankingSimulation = engine.simulateDay(
        yesterdayKey,
        session.username ? `${session.username} TV` : "Ta chaîne",
        playerWeek[yesterdayKey]
      );
      rankingDayKey = yesterdayKey;
    }
    const financeYesterday = financeStore && typeof financeStore.ensureYesterdayClosed === "function"
      ? financeStore.ensureYesterdayClosed(session)
      : null;
    renderTodaySchedule(programSimulation, todayStatuses, publishedToday);
    renderDailyRanking(rankingSimulation, rankingDayKey, formatDateByOffset(-1));
    renderFinanceSummary(financeYesterday, formatDateByOffset(-1));
  } else {
    const list = document.getElementById("todayScheduleList");
    if (list) {
      const fallback = document.createElement("div");
      fallback.className = "today-row";
      fallback.textContent = "Le moteur d'audience n'a pas chargé. Recharge la page.";
      list.replaceChildren(fallback);
    }
    renderFinanceSummary(null, formatDateByOffset(-1));
  }

})();
