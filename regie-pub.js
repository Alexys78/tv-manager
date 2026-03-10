(function adRegieApp() {
  const appKeys = (window.SessionUtils && window.SessionUtils.APP_KEYS) || {};
  const DATE_GRID_KEY_PREFIX = appKeys.DATE_GRID_KEY_PREFIX || "tv_manager_date_grid_";
  const LEGAL_DAILY_AD_CAP_MINUTES = 216;
  const LEGAL_HOURLY_AD_CAP_MINUTES = 12;
  const DAY_WINDOW_START_MINUTE = Number(window.SessionUtils && window.SessionUtils.DAY_START_MINUTE) || (5 * 60);
  const DAY_WINDOW_END_MINUTE = Number(window.SessionUtils && window.SessionUtils.DAY_END_MINUTE) || (25 * 60);
  const AD_CATEGORY_MINUTES_PER_HOUR = {
    information: 4,
    divertissement: 8,
    films: 10,
    series: 8,
    magazines: 6,
    jeunesse: 5,
    documentaires: 6,
    realite: 8,
    culture: 6
  };
  const finance = window.FinanceEngine;
  const diffusionRules = window.DiffusionRules;
  const catalog = window.ProgramCatalog;
  const sessionUtils = window.SessionUtils;
  const session = sessionUtils && typeof sessionUtils.requireSession === "function"
    ? sessionUtils.requireSession({ redirectPath: "index.html", persist: true, allowEmailParam: true, clearSearch: true })
    : null;
  if (!session) return;

  if (!finance) return;

  function formatEuro(value) {
    return sessionUtils.formatEuro(Number(value) || 0);
  }

  function setGridFeedback(message, type) {
    const node = document.getElementById("adGridFeedback");
    if (!node) return;
    node.textContent = String(message || "");
    node.className = `feedback ${type || ""}`.trim();
  }

  function readSettings() {
    return typeof finance.getAdSettings === "function"
      ? finance.getAdSettings(session)
      : { pressure: "balanced", blockedPrograms: {}, activeContract: null };
  }

  function renderPressure() {
    const wrap = document.getElementById("adPressureButtons");
    if (!wrap) return;
    const settings = readSettings();
    const options = [
      { id: "soft", label: "Soft", desc: "Utilise 60% du temps pub disponible." },
      { id: "balanced", label: "Équilibré", desc: "Utilise 80% du temps pub disponible." },
      { id: "intense", label: "Intensif", desc: "Utilise 100% du temps pub disponible." }
    ];
    const buttons = options.map((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `filter-chip ${settings.pressure === item.id ? "active" : ""}`.trim();
      btn.textContent = item.label;
      btn.title = item.desc;
      btn.addEventListener("click", () => {
        if (typeof finance.setAdPressure === "function") finance.setAdPressure(session, item.id);
        renderAll();
      });
      return btn;
    });
    wrap.replaceChildren(...buttons);
  }

  function toDateKey(date) {
    return sessionUtils.toDateKey(date);
  }

  function parseDateKey(value) {
    return sessionUtils.parseDateKey(value);
  }

  function addDays(dateKey, delta) {
    return sessionUtils.addDaysToDateKey(dateKey, delta);
  }

  function dateGridStorageKey() {
    const playerId = session.email || session.username || "player";
    return `${DATE_GRID_KEY_PREFIX}${playerId}`;
  }

  function readDateGridMap() {
    const raw = localStorage.getItem(dateGridStorageKey());
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function isDatePublished(dateKey) {
    if (!finance || typeof finance.isGridPublished !== "function") return true;
    return finance.isGridPublished(session, String(dateKey || ""));
  }

  function renderGridPublicationHint(targets) {
    const hint = document.getElementById("adGridPublicationHint");
    if (!hint) return;
    hint.textContent = "Pas de modification possible sur une grille non publiée.";
  }

  function normalizeEntry(raw) {
    if (!raw) return null;
    if (typeof raw === "string") {
      return {
        title: raw,
        categoryId: "",
        season: null,
        episode: null,
        duration: null,
        subtype: "",
        productionSubtype: "",
        fixedStartMinute: null
      };
    }
    const title = String(raw.title || "").trim();
    if (!title) return null;
    return {
      title,
      categoryId: String(raw.categoryId || "").trim(),
      season: Number(raw.season) > 0 ? Number(raw.season) : null,
      episode: Number(raw.episode) > 0 ? Number(raw.episode) : null,
      duration: Number(raw.duration) > 0 ? Number(raw.duration) : null,
      subtype: String(raw.subtype || "").trim(),
      productionSubtype: String(raw.productionSubtype || "").trim(),
      fixedStartMinute: Number.isFinite(Number(raw.fixedStartMinute)) ? Number(raw.fixedStartMinute) : null
    };
  }

  function normalizeDay(rawDay) {
    if (!rawDay) return [];
    if (Array.isArray(rawDay)) return rawDay.map(normalizeEntry).filter(Boolean);
    if (Array.isArray(rawDay.day)) return rawDay.day.map(normalizeEntry).filter(Boolean);
    if (Array.isArray(rawDay.before) || Array.isArray(rawDay.after)) {
      const before = Array.isArray(rawDay.before) ? rawDay.before : [];
      const after = Array.isArray(rawDay.after) ? rawDay.after : [];
      return [...before, ...after].map(normalizeEntry).filter(Boolean);
    }
    return [];
  }

  function resolveCategoryId(entry) {
    if (entry && entry.categoryId) return entry.categoryId;
    if (catalog && typeof catalog.getProgramMeta === "function") {
      const meta = catalog.getProgramMeta(entry && entry.title ? entry.title : "");
      if (meta && meta.categoryId) return String(meta.categoryId);
    }
    return "culture";
  }

  function resolveDuration(entry) {
    const explicit = Number(entry && entry.duration);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    if (catalog && typeof catalog.getProgramMeta === "function") {
      const meta = catalog.getProgramMeta(entry && entry.title ? entry.title : "");
      const duration = Number(meta && meta.duration);
      if (Number.isFinite(duration) && duration > 0) return duration;
    }
    return 60;
  }

  function resolveSubtype(entry) {
    if (entry && typeof entry.subtype === "string" && entry.subtype.trim()) return entry.subtype.trim();
    if (catalog && typeof catalog.getProgramMeta === "function") {
      const meta = catalog.getProgramMeta(entry && entry.title ? entry.title : "");
      if (meta && typeof meta.productionSubtype === "string" && meta.productionSubtype.trim()) {
        return meta.productionSubtype.trim();
      }
    }
    return "";
  }

  function isAdForbiddenForProgram(entry, categoryId, duration, subtype) {
    if (finance && typeof finance.isProgramAdForbidden === "function") {
      return Boolean(finance.isProgramAdForbidden({
        title: entry && entry.title ? entry.title : "",
        categoryId,
        duration,
        subtype,
        productionSubtype: subtype
      }));
    }
    const infoJt = categoryId === "information" && String(subtype || "").trim().toLowerCase() === "jt";
    return infoJt || categoryId === "jeunesse" || duration < 15;
  }

  function getPressureFillRate() {
    const settings = readSettings();
    const pressure = String(settings && settings.pressure ? settings.pressure : "balanced");
    if (pressure === "soft") return 0.6;
    if (pressure === "intense") return 1;
    return 0.8;
  }

  function splitIntervalByClockHour(startMinute, endMinute) {
    const chunks = [];
    let cursor = Math.max(0, Number(startMinute) || 0);
    const end = Math.max(cursor, Number(endMinute) || cursor);
    while (cursor < end) {
      const hourIndex = Math.floor(cursor / 60);
      const hourEnd = Math.min(end, (hourIndex + 1) * 60);
      chunks.push({
        hourIndex,
        minutes: Math.max(0, hourEnd - cursor)
      });
      cursor = hourEnd;
    }
    return chunks;
  }

  function computeFilmInternalBreakCap(duration) {
    const safeDuration = Math.max(0, Number(duration) || 0);
    if (safeDuration < 20) return 0;
    if (safeDuration < 40) return 6;
    return 12;
  }

  function computeAvailableAdMinutesForEntries(entries, dateKey) {
    const fillRate = getPressureFillRate();
    const hourBuckets = new Map();
    const cuts = (finance && typeof finance.getAdCutsForDate === "function")
      ? finance.getAdCutsForDate(session, String(dateKey || finance.getDateKeyByOffset(0)))
      : { disabledPrograms: {}, disabledBreaks: {} };
    const disabledPrograms = cuts && cuts.disabledPrograms ? cuts.disabledPrograms : {};
    const disabledBreaks = cuts && cuts.disabledBreaks ? cuts.disabledBreaks : {};
    let cursor = DAY_WINDOW_START_MINUTE;

    entries.forEach((entry, index) => {
      const categoryId = resolveCategoryId(entry);
      const duration = resolveDuration(entry);
      const subtype = resolveSubtype(entry);
      const safeDuration = Math.max(0, Number(duration) || 0);
      if (safeDuration <= 0) return;

      const fixedStart = Number(entry && entry.fixedStartMinute);
      const hasFixedStart = Number.isFinite(fixedStart);
      const start = Math.max(cursor, hasFixedStart ? fixedStart : cursor);
      if (start >= DAY_WINDOW_END_MINUTE) return;
      const end = Math.min(DAY_WINDOW_END_MINUTE, start + safeDuration);
      if (end <= start) return;
      cursor = end;

      const runtime = end - start;
      const baseRatePerHour = AD_CATEGORY_MINUTES_PER_HOUR[categoryId] || 6;
      const adProgramKey = (finance && typeof finance.buildAdProgramKey === "function")
        ? finance.buildAdProgramKey(entry, start)
        : `P:${start}:${String(entry.title || "")}:S${Number(entry.season) || 0}:E${Number(entry.episode) || 0}`;
      const adBreakKey = (finance && typeof finance.buildAdBreakKey === "function")
        ? finance.buildAdBreakKey(entry, start)
        : `B:${adProgramKey}`;
      const candidateMinutes = (runtime / 60) * baseRatePerHour * fillRate;
      let inProgramMinutes = isAdForbiddenForProgram(entry, categoryId, runtime, subtype) ? 0 : (candidateMinutes * 0.75);
      if (categoryId === "films" || categoryId === "series") {
        inProgramMinutes = Math.min(inProgramMinutes, computeFilmInternalBreakCap(runtime));
      }
      inProgramMinutes = Math.max(0, inProgramMinutes);
      let betweenMinutes = index < (entries.length - 1) ? Math.max(0, candidateMinutes - inProgramMinutes) : 0;
      if (adProgramKey && disabledPrograms[adProgramKey]) inProgramMinutes = 0;
      if (adBreakKey && disabledBreaks[adBreakKey]) betweenMinutes = 0;
      const effectiveMinutes = inProgramMinutes + betweenMinutes;
      if (effectiveMinutes <= 0) return;

      const chunks = splitIntervalByClockHour(start, end);
      const totalChunkMinutes = Math.max(1, chunks.reduce((sum, chunk) => sum + chunk.minutes, 0));
      chunks.forEach((chunk) => {
        const allocated = effectiveMinutes * (chunk.minutes / totalChunkMinutes);
        hourBuckets.set(chunk.hourIndex, (hourBuckets.get(chunk.hourIndex) || 0) + allocated);
      });
    });

    let afterHourlyCap = 0;
    hourBuckets.forEach((minutes) => {
      afterHourlyCap += Math.min(LEGAL_HOURLY_AD_CAP_MINUTES, Math.max(0, Number(minutes) || 0));
    });
    return Math.max(0, Math.min(LEGAL_DAILY_AD_CAP_MINUTES, afterHourlyCap));
  }

  function buildSeenBeforeDate(dateKey, gridMap) {
    const seen = new Set();
    Object.keys(gridMap)
      .filter((key) => key < dateKey)
      .sort()
      .forEach((key) => {
        const entries = normalizeDay(gridMap[key]);
        entries.forEach((entry) => {
          const categoryId = resolveCategoryId(entry);
          const normalized = { ...entry, categoryId };
          if (diffusionRules && typeof diffusionRules.getTrackingKey === "function") {
            const track = diffusionRules.getTrackingKey(normalized);
            if (track) seen.add(track);
          } else if (normalized.title) {
            seen.add(normalized.title);
          }
        });
      });
    return seen;
  }

  function formatShortDate(dateKey) {
    const date = parseDateKey(dateKey);
    if (!date) return dateKey;
    return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "2-digit", month: "long" }).format(date);
  }

  function renderThreeDayGrid() {
    const wrap = document.getElementById("adThreeDayGrid");
    if (!wrap) return;
    const gridMap = readDateGridMap();
    const baseDateKey = (finance && typeof finance.getDateKeyByOffset === "function")
      ? finance.getDateKeyByOffset(0)
      : toDateKey(new Date());
    const targets = [
      { offset: -1, label: "Hier" },
      { offset: 0, label: "Aujourd'hui" },
      { offset: 1, label: "Demain" }
    ].map((item) => {
      const key = addDays(baseDateKey, item.offset);
      return { ...item, dateKey: key, isPublished: isDatePublished(key) };
    });
    renderGridPublicationHint(targets);

    const columns = targets.map((target) => {
      const card = document.createElement("div");
      card.className = "ad-day-card";

      const head = document.createElement("div");
      head.className = "today-head";
      const rawEntries = normalizeDay(gridMap[target.dateKey]);
      const availableAdMinutes = target.isPublished
        ? Math.round(computeAvailableAdMinutesForEntries(rawEntries, target.dateKey))
        : 0;
      const title = document.createElement("h3");
      title.textContent = target.label;
      const badges = document.createElement("div");
      badges.className = "day-badge-group";
      const minutesBadge = document.createElement("span");
      minutesBadge.className = "day-badge";
      minutesBadge.textContent = `${availableAdMinutes} min pub`;
      badges.appendChild(minutesBadge);
      if (!target.isPublished) {
        const publicationBadge = document.createElement("span");
        publicationBadge.className = "day-badge day-badge-warning";
        publicationBadge.textContent = "Grille non publiée";
        badges.appendChild(publicationBadge);
      }
      head.replaceChildren(title, badges);
      card.appendChild(head);

      const list = document.createElement("div");
      list.className = "today-list";
      const seen = buildSeenBeforeDate(target.dateKey, gridMap);
      if (!rawEntries.length) {
        const empty = document.createElement("div");
        empty.className = "today-row";
        empty.innerHTML = `<span class="empty-slot">Aucun programme</span>`;
        list.appendChild(empty);
      } else {
        let rowCursor = DAY_WINDOW_START_MINUTE;
        rawEntries.forEach((entry, index) => {
          const categoryId = resolveCategoryId(entry);
          const duration = resolveDuration(entry);
          const subtype = resolveSubtype(entry);
          const normalized = { ...entry, categoryId };
          if (diffusionRules && typeof diffusionRules.resolveStatus === "function") {
            diffusionRules.resolveStatus(normalized, seen);
          }
          const row = document.createElement("div");
          row.className = "today-row ad-day-row";
          const program = document.createElement("span");
          program.className = `today-program category-${categoryId}`.trim();
          const canEdit = target.offset >= 0 && target.isPublished;
          const fs = Number(entry && entry.fixedStartMinute);
          const hs = Number.isFinite(fs);
          const rowStartMinute = Math.max(rowCursor, hs ? fs : rowCursor);
          rowCursor = Math.min(DAY_WINDOW_END_MINUTE, rowStartMinute + Math.max(0, Number(duration) || 0));
          const adProgramKey = (finance && typeof finance.buildAdProgramKey === "function")
            ? finance.buildAdProgramKey(normalized, rowStartMinute)
            : `P:${rowStartMinute}:${String(normalized.title || "")}:S${Number(normalized.season) || 0}:E${Number(normalized.episode) || 0}`;
          const adBreakKey = (finance && typeof finance.buildAdBreakKey === "function")
            ? finance.buildAdBreakKey(normalized, rowStartMinute)
            : `B:${adProgramKey}`;
          const dateCuts = (finance && typeof finance.getAdCutsForDate === "function")
            ? finance.getAdCutsForDate(session, target.dateKey)
            : { disabledPrograms: {}, disabledBreaks: {} };
          const isProgramDisabled = Boolean(dateCuts && dateCuts.disabledPrograms && dateCuts.disabledPrograms[adProgramKey]);
          const pubInline = document.createElement("span");
          const adForbidden = isAdForbiddenForProgram(normalized, categoryId, duration, subtype);
          pubInline.className = `ad-inline-pub${adForbidden ? " forbidden" : ""}${isProgramDisabled ? " off" : ""}`.trim();
          pubInline.textContent = adForbidden ? "Pub interdite" : "Pub";
          if (canEdit && !adForbidden) {
            pubInline.classList.add("clickable");
            pubInline.addEventListener("click", (event) => {
              event.stopPropagation();
              if (finance && typeof finance.setAdSlotDisabled === "function") {
                finance.setAdSlotDisabled(session, target.dateKey, "program", adProgramKey, !isProgramDisabled);
                renderThreeDayGrid();
                renderCompliance();
              }
            });
          } else if (!canEdit && target.offset >= 0 && !adForbidden && !target.isPublished) {
            pubInline.classList.add("control-locked");
            pubInline.title = "Publie d'abord la grille TV pour modifier la pub.";
            pubInline.addEventListener("click", (event) => {
              event.stopPropagation();
              setGridFeedback(`Impossible de modifier la pub sur ${target.label.toLowerCase()} : grille non publiée.`, "error");
            });
          }
          const titleInline = document.createElement("span");
          titleInline.className = "ad-inline-title";
          titleInline.textContent = normalized.title;
          program.appendChild(titleInline);
          program.appendChild(pubInline);
          row.appendChild(program);
          list.appendChild(row);

          if (index < rawEntries.length - 1) {
            const adBreakRow = document.createElement("div");
            adBreakRow.className = "today-row ad-break-row";
            const isBreakDisabled = Boolean(dateCuts && dateCuts.disabledBreaks && dateCuts.disabledBreaks[adBreakKey]);
            adBreakRow.innerHTML = `
              <span class="today-program ad-break-pill${isBreakDisabled ? " off" : ""}">Plage pub</span>
            `;
            if (canEdit) {
              const breakBadge = adBreakRow.querySelector(".ad-break-pill");
              if (breakBadge) {
                breakBadge.classList.add("clickable");
                breakBadge.addEventListener("click", (event) => {
                  event.stopPropagation();
                  if (finance && typeof finance.setAdSlotDisabled === "function") {
                    finance.setAdSlotDisabled(session, target.dateKey, "break", adBreakKey, !isBreakDisabled);
                    renderThreeDayGrid();
                    renderCompliance();
                  }
                });
              }
            } else if (target.offset >= 0 && !target.isPublished) {
              const breakBadge = adBreakRow.querySelector(".ad-break-pill");
              if (breakBadge) {
                breakBadge.classList.add("control-locked");
                breakBadge.title = "Publie d'abord la grille TV pour modifier la pub.";
                breakBadge.addEventListener("click", (event) => {
                  event.stopPropagation();
                  setGridFeedback(`Impossible de modifier la plage pub sur ${target.label.toLowerCase()} : grille non publiée.`, "error");
                });
              }
            }
            list.appendChild(adBreakRow);
          }
        });
      }
      card.appendChild(list);
      return card;
    });

    wrap.replaceChildren(...columns);
  }

  function forEachEditableAdSlot(callback) {
    const gridMap = readDateGridMap();
    const baseDateKey = (finance && typeof finance.getDateKeyByOffset === "function")
      ? finance.getDateKeyByOffset(0)
      : toDateKey(new Date());
    const targetKeys = [baseDateKey, addDays(baseDateKey, 1)];
    targetKeys.forEach((dateKey) => {
      if (!isDatePublished(dateKey)) return;
      const entries = normalizeDay(gridMap[dateKey]);
      let cursor = DAY_WINDOW_START_MINUTE;
      entries.forEach((entry, index) => {
        const duration = resolveDuration(entry);
        const fs = Number(entry && entry.fixedStartMinute);
        const hs = Number.isFinite(fs);
        const startMinute = Math.max(cursor, hs ? fs : cursor);
        cursor = Math.min(DAY_WINDOW_END_MINUTE, startMinute + Math.max(0, Number(duration) || 0));
        const normalized = { ...entry, categoryId: resolveCategoryId(entry) };
        const programKey = (finance && typeof finance.buildAdProgramKey === "function")
          ? finance.buildAdProgramKey(normalized, startMinute)
          : `P:${startMinute}:${String(normalized.title || "")}:S${Number(normalized.season) || 0}:E${Number(normalized.episode) || 0}`;
        const breakKey = (finance && typeof finance.buildAdBreakKey === "function")
          ? finance.buildAdBreakKey(normalized, startMinute)
          : `B:${programKey}`;
        callback({
          dateKey,
          index,
          hasNext: index < (entries.length - 1),
          programKey,
          breakKey
        });
      });
    });
  }

  function renderCompliance() {
    const wrap = document.getElementById("adComplianceKpi");
    if (!wrap) return;
    const result = typeof finance.ensureYesterdayClosed === "function"
      ? finance.ensureYesterdayClosed(session)
      : null;
    const details = result && result.revenue && result.revenue.adsDetails
      ? result.revenue.adsDetails
      : null;
    if (!details) {
      wrap.replaceChildren();
      return;
    }
    const metrics = [
      { label: "Revenu pub veille", value: formatEuro(result.revenue.ads || 0) },
      { label: "Après cap 12 min/h", value: `${Number(details.afterHourlyCapMinutes || 0).toFixed(1)} min` },
      { label: "Après cap 216 min/j", value: `${Number(details.appliedDailyCapMinutes || 0).toFixed(1)} min` },
      { label: "Pub pendant", value: `${Number(details.inProgramMinutes || 0).toFixed(1)} min` },
      { label: "Pub entre programmes", value: `${Number(details.betweenProgramMinutes || 0).toFixed(1)} min` },
      { label: "Programmes bloqués", value: `${Number(details.blockedProgramsCount || 0)}` }
    ];
    const cards = metrics.map((metric) => {
      const card = document.createElement("div");
      card.className = "finance-kpi";
      card.innerHTML = `<span class="finance-kpi-label">${metric.label}</span><strong>${metric.value}</strong>`;
      return card;
    });
    wrap.replaceChildren(...cards);
  }

  function bindEvents() {
    const validateBtn = document.getElementById("adValidateGridBtn");
    const disableAllBtn = document.getElementById("adDisableAllBtn");
    const enableAllBtn = document.getElementById("adEnableAllBtn");

    if (validateBtn) {
      validateBtn.addEventListener("click", () => {
        setGridFeedback("Grille pub validée.", "success");
      });
    }

    if (disableAllBtn) {
      disableAllBtn.addEventListener("click", () => {
        if (!finance || typeof finance.setAdSlotDisabled !== "function") return;
        let touched = 0;
        forEachEditableAdSlot((slot) => {
          touched += 1;
          finance.setAdSlotDisabled(session, slot.dateKey, "program", slot.programKey, true);
          if (slot.hasNext) finance.setAdSlotDisabled(session, slot.dateKey, "break", slot.breakKey, true);
        });
        if (touched === 0) {
          setGridFeedback("Aucune journée publiée à modifier (Aujourd'hui / Demain).", "error");
          return;
        }
        renderThreeDayGrid();
        renderCompliance();
        setGridFeedback("Toutes les pubs d'Aujourd'hui et de Demain sont désactivées.", "success");
      });
    }

    if (enableAllBtn) {
      enableAllBtn.addEventListener("click", () => {
        if (!finance || typeof finance.setAdSlotDisabled !== "function") return;
        let touched = 0;
        forEachEditableAdSlot((slot) => {
          touched += 1;
          finance.setAdSlotDisabled(session, slot.dateKey, "program", slot.programKey, false);
          if (slot.hasNext) finance.setAdSlotDisabled(session, slot.dateKey, "break", slot.breakKey, false);
        });
        if (touched === 0) {
          setGridFeedback("Aucune journée publiée à modifier (Aujourd'hui / Demain).", "error");
          return;
        }
        renderThreeDayGrid();
        renderCompliance();
        setGridFeedback("Toutes les pubs d'Aujourd'hui et de Demain sont réactivées.", "success");
      });
    }
  }

  function renderAll() {
    renderPressure();
    renderThreeDayGrid();
    renderCompliance();
  }

  bindEvents();
  renderAll();
})();
