(function productionStudioPage() {
  const sessionUtils = window.SessionUtils;
  const appKeys = (sessionUtils && sessionUtils.APP_KEYS) || {};
  const STUDIO_KEY_PREFIX = appKeys.STUDIO_KEY_PREFIX || "tv_manager_studio_";
  const STUDIO_SCHEDULE_KEY_PREFIX = appKeys.STUDIO_SCHEDULE_KEY_PREFIX || "tv_manager_studio_schedule_";
  const DATE_GRID_KEY_PREFIX = appKeys.DATE_GRID_KEY_PREFIX || "tv_manager_date_grid_";
  const DAY_START_MINUTE = Number(window.SessionUtils && window.SessionUtils.DAY_START_MINUTE) || (5 * 60);
  const DAY_END_MINUTE = Number(window.SessionUtils && window.SessionUtils.DAY_END_MINUTE) || (25 * 60);
  const DEFAULT_MAX_SET_PEOPLE = 3;
  const STUDIO_OPTIONS = [
    {
      id: "studio_1",
      name: "Studio TV 1",
      maxPeopleOnSet: 3,
      allowedCategoryIds: ["information", "magazines"]
    }
  ];
  const bank = window.PlayerBank;
  const programCatalog = window.ProgramCatalog;
  const presenterEngine = window.PresenterEngine;
  const financeEngine = window.FinanceEngine;
  const PRODUCTION_SUBTYPES = {
    information: [
      "JT",
      "Météo",
      "Économie",
      "Politique",
      "Matinale",
      "International",
      "Faits divers",
      "Culture",
      "Santé",
      "Sport flash"
    ],
    divertissement: ["Jeu", "Variété", "Humour", "Talk-show", "Prime", "Talent-show"],
    magazines: ["Société", "Conso", "Culture", "Santé", "Lifestyle", "Investigation"],
    jeunesse: ["Éducatif", "Animation", "Jeu", "Aventure", "Découverte"],
    documentaires: ["Nature", "Histoire", "Science", "Société", "Investigation"],
    realite: ["Compétition", "Vie quotidienne", "Aventure", "Cuisine", "Dating"],
    culture: ["Concert", "Théâtre", "Opéra", "Danse", "Arts visuels"]
  };
  const PRODUCTION_SUBTYPE_MULTIPLIER = {
    JT: 1.25,
    "Météo": 0.75,
    "Économie": 1.05,
    Politique: 1.1,
    Matinale: 1.35,
    International: 1.15,
    "Faits divers": 1.0,
    Culture: 0.95,
    "Santé": 1.0,
    "Sport flash": 0.85
  };
  const STAFF_ROLE_BY_TYPE = Object.freeze({
    information: "journalists",
    divertissement: "presenters",
    documentaires: "presenters",
    jeunesse: "presenters",
    magazines: "presenters",
    realite: "presenters",
    culture: "presenters"
  });
  const STAFF_UI_BY_ROLE = Object.freeze({
    journalists: {
      singular: "journaliste",
      singularTitle: "Journaliste",
      plural: "journalistes",
      pluralTitle: "Journalistes",
      coPrefix: "Co-journaliste"
    },
    presenters: {
      singular: "présentateur",
      singularTitle: "Présentateur",
      plural: "présentateurs",
      pluralTitle: "Présentateurs",
      coPrefix: "Co-présentateur"
    }
  });
  const SUBTYPE_SPECIALTY_MAP = {
    JT: ["jt"],
    "Météo": ["meteo"],
    "Économie": ["economie"],
    Politique: ["politique"],
    Matinale: ["matinale"],
    International: ["international"],
    "Faits divers": ["faits divers"],
    Culture: ["culture"],
    "Santé": ["sante"],
    "Sport flash": ["sport flash"],
    "Talk-show": ["talk-show"],
    "Société": ["societe"],
    "Culture": ["culture"],
    "Investigation": ["investigation"],
    "Conso": ["consommation", "conso"],
    "Jeu": ["jeu tv", "jeu"],
    "Variété": ["variete"],
    "Prime": ["prime"],
    "Talent-show": ["talent-show", "talent show", "talent"],
    "Lifestyle": ["lifestyle"],
    "Éducatif": ["educatif"],
    "Animation": ["animation"],
    "Aventure": ["aventure"],
    "Découverte": ["decouverte"],
    "Nature": ["nature"],
    "Histoire": ["histoire"],
    "Science": ["science"],
    "Compétition": ["competition"],
    "Vie quotidienne": ["vie quotidienne"],
    "Cuisine": ["cuisine"],
    "Dating": ["dating"],
    "Concert": ["concert"],
    "Théâtre": ["theatre"],
    "Opéra": ["opera"],
    "Danse": ["danse"],
    "Arts visuels": ["arts visuels"]
  };
  const DEFAULT_TYPE_DEFINITIONS = [
    { id: "information", name: "Informations" },
    { id: "magazines", name: "Magazines" }
  ];
  const EXCLUDED_STUDIO_TYPES = new Set(["films", "series"]);
  const WEEKDAY_OPTIONS = [
    { value: 1, label: "Lundi" },
    { value: 2, label: "Mardi" },
    { value: 3, label: "Mercredi" },
    { value: 4, label: "Jeudi" },
    { value: 5, label: "Vendredi" },
    { value: 6, label: "Samedi" },
    { value: 0, label: "Dimanche" }
  ];
  const UPGRADE_KEYS = ["decor", "lights", "cameras", "regie", "son", "prompteur"];
  const PRODUCTION_COST_BASE = 35000;
  const session = sessionUtils && typeof sessionUtils.requireSession === "function"
    ? sessionUtils.requireSession({ redirectPath: "index.html", persist: true, allowEmailParam: true, clearSearch: true })
    : null;
  if (!session) return;

  function formatEuro(value) {
    return sessionUtils.formatEuro(Number(value) || 0);
  }

  function getStudioById(studioId) {
    const safeId = String(studioId || "").trim();
    return STUDIO_OPTIONS.find((studio) => studio.id === safeId) || STUDIO_OPTIONS[0];
  }

  function setFeedback(message, type) {
    const node = document.getElementById("studioProductionFeedback");
    if (!node) return;
    node.textContent = String(message || "");
    node.className = `feedback ${type || ""}`.trim();
  }

  async function forceCloudPushBestEffort() {
    const syncApi = window.TVManagerCloudSync;
    if (!syncApi || typeof syncApi.forcePush !== "function") return;
    try {
      await syncApi.forcePush();
    } catch {
      // Best effort only.
    }
  }

  function playerId() {
    return session.email || session.username || "player";
  }

  function studioStateKey() {
    return `${STUDIO_KEY_PREFIX}${playerId()}`;
  }

  function studioScheduleKey() {
    return `${STUDIO_SCHEDULE_KEY_PREFIX}${playerId()}`;
  }

  function dateGridKey() {
    return `${DATE_GRID_KEY_PREFIX}${playerId()}`;
  }

  function parseDateKey(value) {
    return sessionUtils.parseDateKey(value);
  }

  function formatDateKey(date) {
    return sessionUtils.toDateKey(date);
  }

  function parseTimeToMinutes(text) {
    const match = /^(\d{2}):(\d{2})$/.exec(String(text || ""));
    if (!match) return null;
    const hh = Number(match[1]);
    const mm = Number(match[2]);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return (hh * 60) + mm;
  }

  function dateToWeekday(dateKey) {
    const date = parseDateKey(dateKey);
    if (!date) return null;
    return date.getDay();
  }

  function sanitizeStudioState(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const state = {};
    UPGRADE_KEYS.forEach((key) => {
      state[key] = Math.max(0, Math.min(3, Math.floor(Number(source[key]) || 0)));
    });
    return state;
  }

  function loadStudioState() {
    try {
      const raw = localStorage.getItem(studioStateKey());
      if (!raw) return sanitizeStudioState({});
      return sanitizeStudioState(JSON.parse(raw));
    } catch {
      return sanitizeStudioState({});
    }
  }

  function computeStudioProductionStars() {
    const state = loadStudioState();
    const levels = UPGRADE_KEYS.map((key) => Math.max(0, Math.min(3, Number(state[key]) || 0)));
    if (levels.length === 0) return 1;
    const halfCount = Math.ceil(levels.length / 2);
    const countAtLeast = (level) => levels.filter((value) => value >= level).length;
    const allAtLeast = (level) => levels.every((value) => value >= level);
    if (allAtLeast(3)) return 3;
    if (allAtLeast(2)) {
      if (countAtLeast(3) >= halfCount) return 2.5;
      return 2;
    }
    if (allAtLeast(1)) {
      if (countAtLeast(2) >= halfCount) return 1.5;
      return 1;
    }
    return 0.5;
  }

  function getStudioProductionCostMultiplier() {
    const state = loadStudioState();
    const totalCurrent = UPGRADE_KEYS.reduce((sum, key) => sum + (Number(state[key]) || 0), 0);
    const totalMax = UPGRADE_KEYS.length * 3;
    if (totalMax <= 0) return 1;
    const ratio = totalCurrent / totalMax;
    return 1 + (ratio * 1.4);
  }

  function getProductionLaunchCost(duration, subtype) {
    const safeDuration = Math.max(5, Number(duration) || 60);
    const subtypeFactor = PRODUCTION_SUBTYPE_MULTIPLIER[String(subtype || "")] || 1;
    return Math.round(PRODUCTION_COST_BASE * (safeDuration / 60) * subtypeFactor * getStudioProductionCostMultiplier());
  }

  function normalizePresenterIds(value, fallbackId) {
    const ids = Array.isArray(value)
      ? value.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const fallback = String(fallbackId || "").trim();
    if (ids.length === 0 && fallback) ids.push(fallback);
    return Array.from(new Set(ids));
  }

  function normalizePresenterNames(value, fallbackName) {
    const names = Array.isArray(value)
      ? value.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const fallback = String(fallbackName || "").trim();
    if (names.length === 0 && fallback) names.push(fallback);
    return names;
  }

  function normalizeScheduleEntry(raw) {
    if (!raw || typeof raw !== "object") return null;
    const title = String(raw.title || "").trim();
    const categoryId = String(raw.categoryId || "").trim() || "information";
    const productionModeRaw = String(raw.productionMode || "").trim().toLowerCase();
    const productionMode = productionModeRaw === "recorded" ? "recorded" : "direct";
    const recurrenceMode = raw.recurrenceMode === "recurring" ? "recurring" : "single";
    const startMinute = Number(raw.startMinute);
    const endMinute = Number(raw.endMinute);
    const shootStartMinute = Number(raw.shootStartMinute);
    const duration = Number(raw.duration);
    if (!title || !Number.isFinite(startMinute) || !Number.isFinite(endMinute) || !Number.isFinite(duration)) return null;
    if (duration <= 0 || endMinute <= startMinute) return null;
    const presenterId = String(raw.presenterId || "").trim();
    const presenterName = String(raw.presenterName || "").trim();
    const presenterStarBonus = Math.max(0, Math.min(2, Number(raw.presenterStarBonus) || 0));
    const presenterIds = normalizePresenterIds(raw.presenterIds, presenterId);
    const presenterNames = normalizePresenterNames(raw.presenterNames, presenterName);
    const presenterStarBonuses = Array.isArray(raw.presenterStarBonuses)
      ? raw.presenterStarBonuses.map((value) => Math.max(0, Math.min(2, Number(value) || 0)))
      : [];
    const studioId = String(raw.studioId || "studio_1").trim() || "studio_1";
    const studio = getStudioById(studioId);
    const studioName = String(raw.studioName || studio.name || "Studio TV 1");
    const presentersCount = Math.max(1, Math.floor(Number(raw.presentersCount) || presenterIds.length || (presenterId ? 1 : 0) || 1));
    const guestsCount = Math.max(0, Math.floor(Number(raw.guestsCount) || 0));
    const maxPeopleOnSet = Math.max(1, Math.floor(Number(raw.maxPeopleOnSet) || studio.maxPeopleOnSet || DEFAULT_MAX_SET_PEOPLE));

    return {
      id: String(raw.id || `${Date.now()}_${Math.floor(Math.random() * 10000)}`),
      title,
      categoryId,
      productionMode,
      subtype: String(raw.subtype || ""),
      duration: Math.floor(duration),
      startMinute: Math.floor(startMinute),
      endMinute: Math.floor(endMinute),
      shootStartMinute: Number.isFinite(shootStartMinute)
        ? Math.max(0, Math.min((24 * 60) - 1, Math.floor(shootStartMinute)))
        : null,
      recurrenceMode,
      dateKey: String(raw.dateKey || ""),
      recurrenceStartDate: String(raw.recurrenceStartDate || ""),
      recurrenceEndDate: String(raw.recurrenceEndDate || ""),
      recurrenceDays: Array.isArray(raw.recurrenceDays)
        ? raw.recurrenceDays.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 0 && value <= 6).slice(0, 5)
        : [],
      ageRating: String(raw.ageRating || "TP"),
      productionGroupId: String(raw.productionGroupId || ""),
      presenterId,
      presenterName,
      presenterStarBonus,
      presenterIds,
      presenterNames,
      presenterStarBonuses,
      studioId: studio.id,
      studioName,
      presentersCount: Math.min(maxPeopleOnSet, presentersCount),
      guestsCount: Math.min(maxPeopleOnSet, guestsCount),
      maxPeopleOnSet
    };
  }

  function loadSchedule() {
    try {
      const raw = localStorage.getItem(studioScheduleKey());
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeScheduleEntry).filter(Boolean);
    } catch {
      return [];
    }
  }

  function saveSchedule(entries) {
    const safe = Array.isArray(entries) ? entries.map(normalizeScheduleEntry).filter(Boolean) : [];
    localStorage.setItem(studioScheduleKey(), JSON.stringify(safe));
  }

  function hasTimeOverlap(a, b) {
    const rangeA = getStudioOccupiedRange(a);
    const rangeB = getStudioOccupiedRange(b);
    return rangeA.start < rangeB.end && rangeB.start < rangeA.end;
  }

  function getStudioOccupiedRange(entry) {
    const duration = Math.max(5, Number(entry && entry.duration) || 0);
    const productionMode = String(entry && entry.productionMode || "").trim().toLowerCase();
    const diffusionStart = Number(entry && entry.startMinute);
    const shootStart = Number(entry && entry.shootStartMinute);
    const start = (productionMode === "recorded" && Number.isFinite(shootStart))
      ? shootStart
      : (Number.isFinite(diffusionStart) ? diffusionStart : 0);
    return {
      start,
      end: start + duration
    };
  }

  function recurringOccursOnDate(entry, dateKey) {
    if (!entry || entry.recurrenceMode !== "recurring") return false;
    const start = String(entry.recurrenceStartDate || "");
    const end = String(entry.recurrenceEndDate || "");
    if (!start || dateKey < start) return false;
    if (end && dateKey > end) return false;
    const weekday = dateToWeekday(dateKey);
    return Array.isArray(entry.recurrenceDays) && entry.recurrenceDays.includes(weekday);
  }

  function recurringRangesCanOverlap(a, b) {
    const aStart = String(a.recurrenceStartDate || "");
    const bStart = String(b.recurrenceStartDate || "");
    const aEnd = String(a.recurrenceEndDate || "9999-12-31");
    const bEnd = String(b.recurrenceEndDate || "9999-12-31");
    if (aEnd < bStart || bEnd < aStart) return false;
    const overlapDays = a.recurrenceDays.filter((day) => b.recurrenceDays.includes(day));
    return overlapDays.length > 0;
  }

  function hasScheduleConflict(entries, candidate) {
    return entries.some((entry) => {
      if (!entry) return false;
      if (!hasTimeOverlap(candidate, entry)) return false;

      if (candidate.recurrenceMode === "single" && entry.recurrenceMode === "single") {
        return entry.dateKey === candidate.dateKey;
      }
      if (candidate.recurrenceMode === "recurring" && entry.recurrenceMode === "single") {
        return recurringOccursOnDate(candidate, entry.dateKey);
      }
      if (candidate.recurrenceMode === "single" && entry.recurrenceMode === "recurring") {
        return recurringOccursOnDate(entry, candidate.dateKey);
      }
      return recurringRangesCanOverlap(candidate, entry);
    });
  }

  function getEntryPresenterIds(entry) {
    if (!entry) return [];
    const ids = normalizePresenterIds(entry.presenterIds, entry.presenterId);
    return ids;
  }

  function getEntryWeekdays(entry) {
    if (!entry) return [];
    if (entry.recurrenceMode === "recurring") {
      return Array.isArray(entry.recurrenceDays)
        ? entry.recurrenceDays.filter((value) => Number.isInteger(Number(value))).map((value) => Number(value))
        : [];
    }
    if (entry.recurrenceMode === "single") {
      const weekday = dateToWeekday(entry.dateKey);
      return Number.isInteger(weekday) ? [weekday] : [];
    }
    return [];
  }

  function checkPresenterWeeklyLimit(entries, candidates, selectedPresenterIds, presenterNamesById) {
    const presenterIds = Array.isArray(selectedPresenterIds) ? selectedPresenterIds : [];
    for (let i = 0; i < presenterIds.length; i += 1) {
      const presenterId = presenterIds[i];
      const workdays = new Set();

      entries.forEach((entry) => {
        if (!getEntryPresenterIds(entry).includes(presenterId)) return;
        getEntryWeekdays(entry).forEach((weekday) => workdays.add(weekday));
      });
      candidates.forEach((entry) => {
        if (!getEntryPresenterIds(entry).includes(presenterId)) return;
        getEntryWeekdays(entry).forEach((weekday) => workdays.add(weekday));
      });

      if (workdays.size > 5) {
        const name = presenterNamesById[presenterId] || "Intervenant";
        return {
          ok: false,
          message: `${name} dépasse la limite de 5 jours d'antenne par semaine.`
        };
      }
    }
    return { ok: true };
  }

  function normalizeDateGridDay(raw) {
    if (!raw) return { day: [] };
    if (Array.isArray(raw)) return { day: raw };
    if (Array.isArray(raw.day)) return { day: raw.day };
    return { day: [] };
  }

  function getProgramDuration(categoryId, title) {
    if (programCatalog && typeof programCatalog.getProgramMeta === "function") {
      const meta = programCatalog.getProgramMeta(title);
      if (meta && Number(meta.duration) > 0) return Number(meta.duration);
    }
    const options = (programCatalog && programCatalog.CATEGORY_DURATION_OPTIONS && programCatalog.CATEGORY_DURATION_OPTIONS[categoryId])
      ? programCatalog.CATEGORY_DURATION_OPTIONS[categoryId]
      : [60];
    return options[0] || 60;
  }

  function getEntryAbsoluteStart(entry, cursor) {
    const fixed = Number(entry && entry.fixedStartMinute);
    if (Number.isFinite(fixed) && fixed >= cursor) return fixed;
    return cursor;
  }

  function buildTimedDayEntries(dayEntries) {
    const entries = Array.isArray(dayEntries) ? dayEntries : [];
    const timed = [];
    let cursor = DAY_START_MINUTE;
    entries.forEach((entry) => {
      if (!entry || !entry.title) return;
      if (cursor >= DAY_END_MINUTE) return;
      const start = Math.max(DAY_START_MINUTE, getEntryAbsoluteStart(entry, cursor));
      if (start >= DAY_END_MINUTE) return;
      const duration = Math.max(5, Number(getProgramDuration(entry.categoryId || "information", entry.title || "")) || 60);
      const end = Math.min(DAY_END_MINUTE, start + duration);
      timed.push({
        entry: {
          title: String(entry.title || ""),
          categoryId: String(entry.categoryId || "information"),
          productionMode: String(entry.productionMode || "").trim().toLowerCase() === "recorded"
            ? "recorded"
            : (String(entry.productionMode || "").trim().toLowerCase() === "direct" ? "direct" : null),
          subtype: String(entry.subtype || ""),
          season: Number(entry.season) > 0 ? Number(entry.season) : null,
          episode: Number(entry.episode) > 0 ? Number(entry.episode) : null,
          studioScheduleId: String(entry.studioScheduleId || ""),
          fixedStartMinute: Number.isFinite(Number(entry.fixedStartMinute))
            ? Math.max(0, Math.min((24 * 60) - 1, Math.floor(Number(entry.fixedStartMinute))))
            : null
        },
        start,
        end
      });
      cursor = end;
    });
    return timed;
  }

  function syncDayWithForcedProgram(dayEntries, programEntry, targetStartMinute) {
    const timed = buildTimedDayEntries(dayEntries);
    const targetDuration = Math.max(5, Number(getProgramDuration(programEntry.categoryId || "information", programEntry.title || "")) || 60);
    const targetStart = Math.max(DAY_START_MINUTE, Math.min(DAY_END_MINUTE - 5, Number(targetStartMinute) || DAY_START_MINUTE));
    const targetEnd = Math.min(DAY_END_MINUTE, targetStart + targetDuration);
    const keptTimed = timed
      .filter((item) => item.end <= targetStart || item.start >= targetEnd)
      .map((item) => item.entry)
      .filter((entry) => {
        const forcedId = String(programEntry.studioScheduleId || "");
        if (forcedId && String(entry.studioScheduleId || "") === forcedId) return false;
        if (!forcedId && entry.title === programEntry.title && entry.categoryId === programEntry.categoryId && Number(entry.fixedStartMinute) === targetStart) return false;
        return true;
      });

    const next = [];
    let inserted = false;
    keptTimed.forEach((entry) => {
      const fixed = Number(entry.fixedStartMinute);
      const anchor = Number.isFinite(fixed) ? fixed : Number.POSITIVE_INFINITY;
      if (!inserted && targetStart < anchor) {
        next.push({ ...programEntry, fixedStartMinute: targetStart });
        inserted = true;
      }
      next.push(entry);
    });
    if (!inserted) next.push({ ...programEntry, fixedStartMinute: targetStart });
    return buildTimedDayEntries(next).map((item) => item.entry);
  }

  function listRecurringDateKeys(startDateKey, selectedWeekdays, endDateKey) {
    const startDate = parseDateKey(startDateKey);
    if (!startDate) return [];
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    const keys = [];
    for (let offset = 0; offset <= 14; offset += 1) {
      const date = new Date(base);
      date.setDate(base.getDate() + offset);
      if (date < startDate) continue;
      if (!selectedWeekdays.includes(date.getDay())) continue;
      const key = formatDateKey(date);
      if (endDateKey && key > endDateKey) continue;
      keys.push(key);
    }
    return keys;
  }

  function syncStudioProductionToDateGrid(scheduleEntry) {
    let dateGrid = {};
    try {
      const raw = localStorage.getItem(dateGridKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") dateGrid = parsed;
      }
    } catch {
      dateGrid = {};
    }

    const targetDates = scheduleEntry.recurrenceMode === "recurring"
      ? listRecurringDateKeys(scheduleEntry.recurrenceStartDate, scheduleEntry.recurrenceDays || [], scheduleEntry.recurrenceEndDate || "")
      : [scheduleEntry.dateKey];

    targetDates.forEach((dateKey) => {
      if (!dateKey) return;
      const day = normalizeDateGridDay(dateGrid[dateKey]);
      day.day = syncDayWithForcedProgram(day.day, {
        title: scheduleEntry.title,
        categoryId: String(scheduleEntry.categoryId || "information"),
        productionMode: String(scheduleEntry.productionMode || "").trim().toLowerCase() === "recorded"
          ? "recorded"
          : "direct",
        subtype: String(scheduleEntry.subtype || ""),
        season: null,
        episode: null,
        studioScheduleId: scheduleEntry.id,
        fixedStartMinute: scheduleEntry.startMinute
      }, scheduleEntry.startMinute);
      dateGrid[dateKey] = day;
    });

    localStorage.setItem(dateGridKey(), JSON.stringify(dateGrid));
  }

  function minProductionDate() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }

  function maxProductionDate() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    now.setDate(now.getDate() + 14);
    return now;
  }

  function minProductionDateKey() {
    return formatDateKey(minProductionDate());
  }

  function maxProductionDateKey() {
    return formatDateKey(maxProductionDate());
  }

  function sanitizeProgramTitle(value) {
    return String(value || "")
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
  }

  function getStaffRoleForType(typeId) {
    const safeType = String(typeId || "").trim();
    return STAFF_ROLE_BY_TYPE[safeType] || "journalists";
  }

  function listOwnedStaffByRole(role) {
    const safeRole = String(role || "").trim();
    if (!presenterEngine) return [];
    if (typeof presenterEngine.getOwnedStaffByRoleForCurrentSession === "function") {
      return presenterEngine.getOwnedStaffByRoleForCurrentSession(safeRole);
    }
    if (safeRole === "journalists" && typeof presenterEngine.getOwnedJournalistsForCurrentSession === "function") {
      return presenterEngine.getOwnedJournalistsForCurrentSession();
    }
    if (safeRole === "presenters" && typeof presenterEngine.getOwnedPresentersForCurrentSession === "function") {
      return presenterEngine.getOwnedPresentersForCurrentSession();
    }
    return [];
  }

  function normalizeToken(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function formatStaffStarBonusLabel(value) {
    const safe = Math.max(0.5, Math.min(2, Number(value) || 0.5));
    const text = Number.isInteger(safe) ? String(safe) : String(safe).replace(".", ",");
    return `+${text}★`;
  }

  function presenterMatchesSubtype(presenter, subtype) {
    const subtypeKey = Object.keys(SUBTYPE_SPECIALTY_MAP).find((key) => normalizeToken(key) === normalizeToken(subtype));
    const required = subtypeKey ? SUBTYPE_SPECIALTY_MAP[subtypeKey] : [];
    if (!required.length) return false;
    const specialty = normalizeToken(presenter && presenter.specialty);
    return required.some((item) => specialty.includes(normalizeToken(item)));
  }

  function computeEffectivePresenterBonus(presenter, subtype) {
    if (!presenterMatchesSubtype(presenter, subtype)) return 0;
    return Math.max(0, Math.min(2, Number(presenter && presenter.starBonus) || 0));
  }

  function computeTeamPresenterBonusForSubtype(selectedPresenters, subtype) {
    if (!Array.isArray(selectedPresenters) || selectedPresenters.length === 0) return 0;
    const bonuses = selectedPresenters.map((presenter) => computeEffectivePresenterBonus(presenter, subtype));
    if (bonuses.length === 1) return bonuses[0];
    const allAtLeastOne = bonuses.every((value) => value >= 1);
    if (!allAtLeastOne) return 0;
    const allAtLeastTwo = bonuses.every((value) => value >= 2);
    return allAtLeastTwo ? 2 : 1;
  }

  function getDurationOptionsForType(type) {
    const options = (programCatalog && programCatalog.CATEGORY_DURATION_OPTIONS && programCatalog.CATEGORY_DURATION_OPTIONS[type])
      ? programCatalog.CATEGORY_DURATION_OPTIONS[type]
      : [5, 15, 30, 45, 60, 90, 120];
    return options.slice().sort((a, b) => a - b);
  }

  const form = document.getElementById("studioProductionPageForm");
  const studioSelect = document.getElementById("productionStudioSelect");
  const modeSelect = document.getElementById("productionModeSelect");
  const modeButtons = document.getElementById("productionModeButtons");
  const typeSelect = document.getElementById("productionTypeSelect");
  const typeButtons = document.getElementById("productionTypeButtons");
  const subtypeSelect = document.getElementById("productionSubtypeSelect");
  const subtypeButtons = document.getElementById("productionSubtypeButtons");
  const durationSelect = document.getElementById("productionDurationSelect");
  const durationButtons = document.getElementById("productionDurationButtons");
  const recurrenceModeSelect = document.getElementById("productionRecurrenceModeSelect");
  const recurrenceButtons = document.getElementById("productionRecurrenceButtons");
  const nameInput = document.getElementById("productionNameInput");
  const dateInput = document.getElementById("productionDateInput");
  const recurringStartInput = document.getElementById("productionRecurringStartDateInput");
  const recurringStartLabel = document.getElementById("productionRecurringStartLabel");
  const recurringDaysWrap = document.getElementById("productionRecurringDaysWrap");
  const timeInput = document.getElementById("productionStartInput");
  const shootStartInput = document.getElementById("productionShootStartInput");
  const startLabel = document.getElementById("productionStartLabel");
  const runsSelect = document.getElementById("productionDailyRunsSelect");
  const runsButtons = document.getElementById("productionDailyRunsButtons");
  const secondStartInput = document.getElementById("productionSecondStartInput");
  const secondShootStartInput = document.getElementById("productionSecondShootStartInput");
  const ageRatingSelect = document.getElementById("productionAgeRatingSelect");
  const ageRatingButtons = document.getElementById("productionAgeRatingButtons");
  const presentersCountSelect = document.getElementById("productionPresentersCountSelect");
  const presentersCountButtons = document.getElementById("productionPresentersCountButtons");
  const guestsCountSelect = document.getElementById("productionGuestsCountSelect");
  const guestsCountButtons = document.getElementById("productionGuestsCountButtons");
  const presentersWrap = document.getElementById("productionPresentersSelectWrap");
  const setupCostPreview = document.getElementById("productionSetupCostPreview");
  const perRunCostPreview = document.getElementById("productionPerRunCostPreview");
  const starsPreview = document.getElementById("productionStarsPreview");
  const peoplePreview = document.getElementById("productionSetPeoplePreview");
  const capacityHelp = document.getElementById("studioCapacityHelp");
  const backBtn = document.getElementById("studioProductionBackBtn");
  const singleDateLabel = document.getElementById("productionDateLabel");
  const recurringDaysLabel = document.getElementById("productionRecurringDaysLabel");
  const ageRatingLabel = document.getElementById("productionAgeRatingLabel");
  const runsLabel = document.getElementById("productionRunsLabel");
  const secondStartLabel = document.getElementById("productionSecondStartLabel");
  const shootStartLabel = document.getElementById("productionShootStartLabel");
  const secondShootStartLabel = document.getElementById("productionSecondShootStartLabel");
  const presentersCountLabel = document.getElementById("productionPresentersCountLabel");
  const presentersListLabel = document.getElementById("productionPresentersListLabel");
  if (
    !form || !studioSelect || !modeSelect || !modeButtons || !typeSelect || !typeButtons || !subtypeSelect || !subtypeButtons || !durationSelect || !durationButtons
    || !recurrenceModeSelect || !recurrenceButtons || !nameInput || !dateInput || !recurringStartInput
    || !recurringStartLabel || !recurringDaysWrap || !timeInput || !shootStartInput || !startLabel || !runsSelect || !runsButtons || !secondStartInput || !secondShootStartInput
    || !ageRatingSelect || !ageRatingButtons || !presentersCountSelect || !presentersCountButtons || !guestsCountSelect
    || !guestsCountButtons || !presentersWrap || !setupCostPreview || !perRunCostPreview || !starsPreview
    || !peoplePreview || !singleDateLabel || !recurringDaysLabel || !ageRatingLabel || !runsLabel || !secondStartLabel || !shootStartLabel || !secondShootStartLabel
    || !presentersCountLabel || !presentersListLabel
  ) return;

  const studioAllowedTypeIds = new Set(
    STUDIO_OPTIONS
      .flatMap((studio) => (Array.isArray(studio.allowedCategoryIds) ? studio.allowedCategoryIds : []))
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );

  const typeDefinitions = (() => {
    if (programCatalog && typeof programCatalog.getFullCategoriesForCurrentSession === "function") {
      const full = programCatalog.getFullCategoriesForCurrentSession();
      if (Array.isArray(full) && full.length > 0) {
        return full
          .map((category) => ({ id: String(category.id || ""), name: String(category.name || category.id || "") }))
          .filter((category) => (
            category.id
            && !EXCLUDED_STUDIO_TYPES.has(category.id)
            && studioAllowedTypeIds.has(category.id)
          ));
      }
    }
    return DEFAULT_TYPE_DEFINITIONS.filter((category) => studioAllowedTypeIds.has(category.id));
  })();
  const recurringDays = new Set();
  let durationOptions = [];

  function getSelectedStudio() {
    return getStudioById(studioSelect.value);
  }

  function getCurrentStaffRole() {
    return getStaffRoleForType(typeSelect.value || "information");
  }

  function getCurrentStaffUi() {
    return STAFF_UI_BY_ROLE[getCurrentStaffRole()] || STAFF_UI_BY_ROLE.journalists;
  }

  function refreshStaffRoleLabels() {
    const ui = getCurrentStaffUi();
    presentersCountLabel.textContent = `Nombre de ${ui.plural}`;
    presentersListLabel.textContent = `${ui.pluralTitle} sélectionnés`;
  }

  function getAllowedTypeIdsForStudio() {
    const studio = getSelectedStudio();
    const source = Array.isArray(studio.allowedCategoryIds) ? studio.allowedCategoryIds : ["information"];
    return new Set(source.map((value) => String(value || "").trim()).filter(Boolean));
  }

  function setActiveChip(container, value) {
    const safe = String(value || "");
    Array.from(container.querySelectorAll("button[data-value]")).forEach((button) => {
      button.classList.toggle("active", String(button.dataset.value || "") === safe);
    });
  }

  function syncRecurrenceButtonsUi() {
    setActiveChip(recurrenceButtons, recurrenceModeSelect.value);
  }

  function syncRunsButtonsUi() {
    setActiveChip(runsButtons, runsSelect.value);
  }

  function syncModeButtonsUi() {
    setActiveChip(modeButtons, modeSelect.value);
  }

  function renderTypeButtons() {
    const allowed = getAllowedTypeIdsForStudio();
    typeSelect.replaceChildren(
      ...typeDefinitions.map((type) => {
        const option = document.createElement("option");
        option.value = type.id;
        option.textContent = type.name;
        return option;
      })
    );
    const allIds = typeDefinitions.map((type) => type.id);
    const allowedIds = allIds.filter((typeId) => allowed.has(typeId));
    if (!allIds.includes(typeSelect.value)) typeSelect.value = "";
    if (!typeSelect.value || !allowed.has(typeSelect.value)) {
      typeSelect.value = allowedIds[0] || allIds[0] || "information";
    }

    const buttons = typeDefinitions.map((type) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-chip";
      button.dataset.value = type.id;
      button.textContent = type.name;
      const unavailable = !allowed.has(type.id);
      if (unavailable) {
        button.disabled = true;
        button.classList.add("studio-chip-disabled");
      }
      button.classList.toggle("active", typeSelect.value === type.id);
      button.addEventListener("click", () => {
        if (button.disabled) return;
        typeSelect.value = type.id;
        renderSubtypeButtons();
        renderDurationControl();
        refreshStaffRoleLabels();
        refreshStudioCapacityHelp();
        initPeopleControls();
        syncSubtypeUi();
        syncRunsUi();
        refreshSimulation();
      });
      return button;
    });
    typeButtons.replaceChildren(...buttons);
  }

  function renderSubtypeButtons() {
    const selectedType = String(typeSelect.value || "information");
    const options = Array.isArray(PRODUCTION_SUBTYPES[selectedType]) && PRODUCTION_SUBTYPES[selectedType].length > 0
      ? PRODUCTION_SUBTYPES[selectedType]
      : ["Général"];

    subtypeSelect.replaceChildren(
      ...options.map((label) => {
        const option = document.createElement("option");
        option.value = label;
        option.textContent = label;
        return option;
      })
    );
    if (!options.includes(subtypeSelect.value)) subtypeSelect.value = options[0];

    const buttons = options.map((label) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-chip";
      button.dataset.value = label;
      button.textContent = label;
      button.classList.toggle("active", subtypeSelect.value === label);
      button.addEventListener("click", () => {
        subtypeSelect.value = label;
        setActiveChip(subtypeButtons, subtypeSelect.value);
        syncSubtypeUi();
        refreshSimulation();
      });
      return button;
    });
    subtypeButtons.replaceChildren(...buttons);
  }

  function renderDurationControl() {
    const selectedType = String(typeSelect.value || "information");
    durationOptions = getDurationOptionsForType(selectedType);
    if (!Array.isArray(durationOptions) || durationOptions.length === 0) durationOptions = [60];

    durationSelect.replaceChildren(
      ...durationOptions.map((value) => {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = `${value} min`;
        return option;
      })
    );
    if (!durationOptions.includes(Number(durationSelect.value))) {
      durationSelect.value = String(durationOptions[0]);
    }
    const buttons = durationOptions.map((value) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-chip";
      button.dataset.value = String(value);
      button.textContent = `${value} min`;
      button.classList.toggle("active", String(durationSelect.value) === String(value));
      button.addEventListener("click", () => {
        durationSelect.value = String(value);
        setActiveChip(durationButtons, durationSelect.value);
        syncRunsUi();
        refreshSimulation();
      });
      return button;
    });
    durationButtons.replaceChildren(...buttons);
  }

  function syncRecurringUi() {
    const recurring = recurrenceModeSelect.value === "recurring";
    singleDateLabel.textContent = recurring ? "Date de la première diffusion" : "Date de diffusion";
    dateInput.classList.remove("hidden");
    dateInput.required = true;
    recurringStartLabel.classList.add("hidden");
    recurringStartInput.classList.add("hidden");
    recurringStartInput.required = false;
    recurringDaysLabel.classList.toggle("hidden", !recurring);
    recurringDaysWrap.classList.toggle("hidden", !recurring);
    syncRecurrenceButtonsUi();
  }

  function syncSubtypeUi() {
    const selectedType = String(typeSelect.value || "");
    const faitsDivers = selectedType === "information" && subtypeSelect.value === "Faits divers";
    ageRatingLabel.classList.toggle("hidden", !faitsDivers);
    ageRatingButtons.classList.toggle("hidden", !faitsDivers);
    ageRatingSelect.classList.toggle("hidden", true);
    ageRatingSelect.required = faitsDivers;
    if (!faitsDivers) {
      ageRatingSelect.value = "TP";
    }
    setActiveChip(ageRatingButtons, ageRatingSelect.value);
  }

  function syncRunsUi() {
    const fiveMinutes = Number(durationSelect.value) === 5;
    runsLabel.classList.toggle("hidden", !fiveMinutes);
    runsButtons.classList.toggle("hidden", !fiveMinutes);
    if (!fiveMinutes) runsSelect.value = "1";
    syncRunsButtonsUi();
    const withTwoRuns = fiveMinutes && runsSelect.value === "2";
    secondStartLabel.classList.toggle("hidden", !withTwoRuns);
    secondStartInput.classList.toggle("hidden", !withTwoRuns);
    secondStartInput.required = withTwoRuns;
    if (!withTwoRuns) {
      secondStartInput.value = "";
      secondShootStartInput.value = "";
    }
    startLabel.textContent = withTwoRuns ? "Heure de la première diffusion" : "Heure de diffusion";
    secondStartLabel.textContent = "Heure de la 2e diffusion";
    syncProductionModeUi();
  }

  function syncProductionModeUi() {
    const recorded = modeSelect.value === "recorded";
    const withTwoRuns = Number(durationSelect.value) === 5 && runsSelect.value === "2";
    shootStartLabel.classList.toggle("hidden", !recorded);
    shootStartInput.classList.toggle("hidden", !recorded);
    shootStartInput.required = recorded;
    secondShootStartLabel.classList.toggle("hidden", !(recorded && withTwoRuns));
    secondShootStartInput.classList.toggle("hidden", !(recorded && withTwoRuns));
    secondShootStartInput.required = recorded && withTwoRuns;
    if (!recorded) {
      shootStartInput.value = "";
      secondShootStartInput.value = "";
    }
    syncModeButtonsUi();
  }

  function getCurrentSetCapacity() {
    const studio = getSelectedStudio();
    return Math.max(1, Number(studio.maxPeopleOnSet) || DEFAULT_MAX_SET_PEOPLE);
  }

  function refreshStudioCapacityHelp() {
    if (!capacityHelp) return;
    const studio = getSelectedStudio();
    const capacity = getCurrentSetCapacity();
    const ui = getCurrentStaffUi();
    capacityHelp.textContent = `Limite ${studio.name}: ${capacity} personnes max sur le plateau (${ui.plural} + invités). Chaque ${ui.singular} est limité à 5 jours d'antenne par semaine. Les étoiles viennent du studio TV (max 3) + du niveau des ${ui.plural} (max 2). Avec plusieurs ${ui.plural}, le bonus étoiles est accordé seulement si tous atteignent le niveau requis.`;
  }

  function getSelectedRecurringDays() {
    return Array.from(recurringDays).sort((a, b) => a - b);
  }

  function renderRecurringDaysButtons() {
    const buttons = WEEKDAY_OPTIONS.map((day) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-chip";
      button.dataset.value = String(day.value);
      button.textContent = day.label;
      button.classList.toggle("active", recurringDays.has(day.value));
      button.addEventListener("click", () => {
        if (recurringDays.has(day.value)) {
          recurringDays.delete(day.value);
        } else if (recurringDays.size >= 5) {
          setFeedback("Tu peux sélectionner 5 jours maximum.", "error");
          return;
        } else {
          recurringDays.add(day.value);
        }
        renderRecurringDaysButtons();
      });
      return button;
    });
    recurringDaysWrap.replaceChildren(...buttons);
  }

  function populateStudioSelect() {
    studioSelect.replaceChildren(
      ...STUDIO_OPTIONS.map((studio) => {
        const option = document.createElement("option");
        option.value = studio.id;
        option.textContent = studio.name;
        return option;
      })
    );
    studioSelect.value = STUDIO_OPTIONS[0] ? STUDIO_OPTIONS[0].id : "studio_1";
    refreshStaffRoleLabels();
    refreshStudioCapacityHelp();
  }

  function getOwnedPresentersMap() {
    const list = listOwnedStaffByRole(getCurrentStaffRole());
    const map = {};
    list.forEach((presenter) => {
      map[presenter.id] = presenter;
    });
    return map;
  }

  function renderCountButtons(select, container, formatter) {
    const format = typeof formatter === "function" ? formatter : ((value) => String(value));
    const options = Array.from(select.options).map((option) => Number(option.value)).filter((value) => Number.isFinite(value));
    const current = Number(select.value);
    const buttons = options.map((value) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-chip";
      button.dataset.value = String(value);
      button.textContent = format(value);
      button.classList.toggle("active", current === value);
      button.addEventListener("click", () => {
        select.value = String(value);
        setActiveChip(container, String(value));
        if (select === presentersCountSelect) {
          updateGuestsCountOptions();
          renderPresenterSelectors();
        }
        refreshSimulation();
      });
      return button;
    });
    container.replaceChildren(...buttons);
  }

  function updateGuestsCountOptions() {
    const presentersCount = Math.max(1, Number(presentersCountSelect.value) || 1);
    const maxGuests = Math.max(0, getCurrentSetCapacity() - presentersCount);
    const current = Math.max(0, Number(guestsCountSelect.value) || 0);
    const next = [];
    for (let guests = 0; guests <= maxGuests; guests += 1) {
      next.push(guests);
    }
    guestsCountSelect.replaceChildren(
      ...next.map((value) => {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = String(value);
        return option;
      })
    );
    guestsCountSelect.value = String(Math.min(current, maxGuests));
    renderCountButtons(guestsCountSelect, guestsCountButtons, (value) => `${value}`);
  }

  function presenterSlotLabel(index) {
    const ui = getCurrentStaffUi();
    return index === 0 ? ui.singularTitle : `${ui.coPrefix} ${index}`;
  }

  function buildPresenterSelect(index, selectedId, presenters) {
    const wrapper = document.createElement("div");
    wrapper.className = "studio-production-presenter-slot";

    const label = document.createElement("label");
    label.textContent = presenterSlotLabel(index);

    const select = document.createElement("select");
    select.dataset.slotIndex = String(index);
    const options = presenters.map((presenter) => {
      const option = document.createElement("option");
      option.value = presenter.id;
      option.textContent = `${presenter.fullName} (${presenter.specialty} · ${formatStaffStarBonusLabel(presenter.starBonus)})`;
      return option;
    });
    select.replaceChildren(...options);
    if (selectedId && presenters.some((presenter) => presenter.id === selectedId)) {
      select.value = selectedId;
    } else if (presenters[index]) {
      select.value = presenters[index].id;
    }
    wrapper.append(label, select);
    return wrapper;
  }

  function getSelectedPresenterIds() {
    const selects = Array.from(presentersWrap.querySelectorAll("select"));
    return selects
      .map((select) => String(select.value || "").trim())
      .filter(Boolean);
  }

  function renderPresenterSelectors() {
    const presenters = listOwnedStaffByRole(getCurrentStaffRole());
    const count = Math.max(1, Number(presentersCountSelect.value) || 1);
    const ui = getCurrentStaffUi();
    if (presenters.length === 0) {
      presentersWrap.innerHTML = `<p class="studio-presenter-empty">Aucun ${ui.singular} recruté. Recrute dans Personnels &gt; Recrutement.</p>`;
      return;
    }
    const previous = getSelectedPresenterIds();
    const rows = [];
    for (let index = 0; index < count; index += 1) {
      rows.push(buildPresenterSelect(index, previous[index], presenters));
    }
    presentersWrap.replaceChildren(...rows);
  }

  function validateSelectedPresenters(presentersMap) {
    const ui = getCurrentStaffUi();
    const selectedIds = getSelectedPresenterIds();
    const expected = Math.max(1, Number(presentersCountSelect.value) || 1);
    const available = Object.keys(presentersMap || {}).length;
    if (available < expected) {
      return { ok: false, message: `Tu as ${available} ${ui.plural} recruté(s), il en faut ${expected}.` };
    }
    if (selectedIds.length !== expected) {
      return { ok: false, message: `Sélectionne tous les ${ui.plural} requis.` };
    }
    const uniqueIds = Array.from(new Set(selectedIds));
    if (uniqueIds.length !== selectedIds.length) {
      return { ok: false, message: `Un ${ui.singular} ne peut être sélectionné qu'une seule fois sur le même programme.` };
    }
    const selected = uniqueIds.map((id) => presentersMap[id]).filter(Boolean);
    if (selected.length !== expected) {
      return { ok: false, message: `Sélection de ${ui.singular} invalide.` };
    }
    return { ok: true, selectedIds: uniqueIds, selected };
  }

  function refreshSimulation() {
    const selectedType = String(typeSelect.value || "information");
    const subtype = String(subtypeSelect.value || "");
    const duration = Number(durationSelect.value) || 60;
    const guests = Math.max(0, Number(guestsCountSelect.value) || 0);
    const presentersMap = getOwnedPresentersMap();
    const selectedIds = getSelectedPresenterIds();
    const selected = selectedIds.map((id) => presentersMap[id]).filter(Boolean);
    const presentersCount = Math.max(1, Number(presentersCountSelect.value) || 1);
    const peopleUsed = presentersCount + guests;
    const maxPeople = getCurrentSetCapacity();
    const teamBonus = computeTeamPresenterBonusForSubtype(selected, subtype);
    const stars = Math.max(0.5, Math.min(5, computeStudioProductionStars() + teamBonus));
    const setupCost = getProductionLaunchCost(duration, subtype);

    let perRunCost = Math.round(1200 * Math.max(0.2, duration / 60) * getStudioProductionCostMultiplier());
    if (financeEngine && typeof financeEngine.estimateProgramCost === "function") {
      perRunCost = financeEngine.estimateProgramCost(
        {
          title: "Production studio TV",
          categoryId: selectedType,
          duration,
          productionSubtype: subtype
        },
        "inedit",
        session
      );
    }

    starsPreview.textContent = `${String(stars).replace(".", ",")}★`;
    setupCostPreview.textContent = formatEuro(setupCost);
    perRunCostPreview.textContent = `${formatEuro(perRunCost)} / diffusion`;
    peoplePreview.textContent = `${peopleUsed}/${maxPeople} personnes`;
    if (peopleUsed > maxPeople) {
      peoplePreview.classList.add("kpi-negative");
      peoplePreview.classList.remove("kpi-positive");
    } else {
      peoplePreview.classList.remove("kpi-negative");
      peoplePreview.classList.add("kpi-positive");
    }
  }

  function initPeopleControls() {
    refreshStaffRoleLabels();
    refreshStudioCapacityHelp();
    const presenters = listOwnedStaffByRole(getCurrentStaffRole());
    const maxPresenters = Math.max(1, getCurrentSetCapacity());
    const current = Math.max(1, Math.min(maxPresenters, Number(presentersCountSelect.value) || 1));
    presentersCountSelect.replaceChildren(
      ...Array.from({ length: maxPresenters }, (_, idx) => {
        const value = idx + 1;
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = String(value);
        return option;
      })
    );
    presentersCountSelect.value = String(current);
    renderCountButtons(presentersCountSelect, presentersCountButtons, (value) => `${value}`);
    updateGuestsCountOptions();
    renderPresenterSelectors();
  }

  function initFormDefaults() {
    const minDate = minProductionDateKey();
    const maxDate = maxProductionDateKey();
    dateInput.min = minDate;
    dateInput.max = maxDate;
    dateInput.value = minDate;
    recurringStartInput.min = minDate;
    recurringStartInput.max = maxDate;
    recurringStartInput.value = minDate;
    timeInput.value = "08:00";
    modeSelect.value = "direct";
    runsSelect.value = "1";
    secondStartInput.value = "";
    shootStartInput.value = "";
    secondShootStartInput.value = "";
    ageRatingSelect.value = "TP";
    recurrenceModeSelect.value = "single";
    recurringDays.clear();
    renderRecurringDaysButtons();
  }

  function validateDateRange(dateKey) {
    if (!dateKey) return false;
    return dateKey >= minProductionDateKey() && dateKey <= maxProductionDateKey();
  }

  function goBackStudio() {
    // Keep navigation robust on local file URLs.
    window.location.href = "studio.html";
  }

  if (backBtn) {
    backBtn.addEventListener("click", goBackStudio);
  }

  recurrenceButtons.addEventListener("click", (event) => {
    const button = event.target && event.target.closest("button[data-value]") ? event.target.closest("button[data-value]") : null;
    if (!button) return;
    recurrenceModeSelect.value = String(button.dataset.value || "single");
    syncRecurringUi();
    setFeedback("", "");
  });
  modeButtons.addEventListener("click", (event) => {
    const button = event.target && event.target.closest("button[data-value]") ? event.target.closest("button[data-value]") : null;
    if (!button) return;
    modeSelect.value = String(button.dataset.value || "direct");
    syncProductionModeUi();
    refreshSimulation();
  });
  runsButtons.addEventListener("click", (event) => {
    const button = event.target && event.target.closest("button[data-value]") ? event.target.closest("button[data-value]") : null;
    if (!button) return;
    runsSelect.value = String(button.dataset.value || "1");
    syncRunsUi();
    refreshSimulation();
  });
  ageRatingButtons.addEventListener("click", (event) => {
    const button = event.target && event.target.closest("button[data-value]") ? event.target.closest("button[data-value]") : null;
    if (!button) return;
    ageRatingSelect.value = String(button.dataset.value || "TP");
    setActiveChip(ageRatingButtons, ageRatingSelect.value);
    refreshSimulation();
  });
  studioSelect.addEventListener("change", () => {
    refreshStaffRoleLabels();
    refreshStudioCapacityHelp();
    renderTypeButtons();
    renderSubtypeButtons();
    renderDurationControl();
    syncSubtypeUi();
    syncRunsUi();
    syncProductionModeUi();
    initPeopleControls();
    refreshSimulation();
  });
  presentersWrap.addEventListener("change", refreshSimulation);

  populateStudioSelect();
  renderTypeButtons();
  renderSubtypeButtons();
  renderDurationControl();
  initPeopleControls();
  initFormDefaults();
  syncRecurringUi();
  syncSubtypeUi();
  syncRunsUi();
  syncProductionModeUi();
  refreshSimulation();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFeedback("", "");

    const presentersMap = getOwnedPresentersMap();
    const selectedValidation = validateSelectedPresenters(presentersMap);
    if (!selectedValidation.ok) {
      setFeedback(selectedValidation.message, "error");
      return;
    }
    const selectedPresenters = selectedValidation.selected;
    const selectedPresenterIds = selectedValidation.selectedIds;
    const selectedPresenterNames = selectedPresenters.map((presenter) => String(presenter.fullName || "").trim()).filter(Boolean);
    const selectedType = String(typeSelect.value || "information").trim();
    const subtype = String(subtypeSelect.value || "").trim();
    const productionMode = modeSelect.value === "recorded" ? "recorded" : "direct";
    const selectedPresenterBonuses = selectedPresenters.map((presenter) => Math.max(0, Math.min(2, Number(presenter.starBonus) || 0)));
    const teamBonus = computeTeamPresenterBonusForSubtype(selectedPresenters, subtype);
    const title = sanitizeProgramTitle(nameInput.value);
    const recurrenceMode = recurrenceModeSelect.value === "recurring" ? "recurring" : "single";
    const dateKey = String(dateInput.value || "");
    const recurrenceStartDate = String(dateInput.value || "");
    const recurrenceDays = recurrenceMode === "recurring" ? getSelectedRecurringDays() : [];
    const duration = Number(durationSelect.value) || 60;
    const startMinute = parseTimeToMinutes(timeInput.value);
    const shootStartMinute = parseTimeToMinutes(shootStartInput.value);
    const requestedRuns = (Number(duration) === 5 && runsSelect.value === "2") ? 2 : 1;
    const secondStartMinute = parseTimeToMinutes(secondStartInput.value);
    const secondShootStartMinute = parseTimeToMinutes(secondShootStartInput.value);
    const guestsCount = Math.max(0, Number(guestsCountSelect.value) || 0);
    const presentersCount = Math.max(1, Number(presentersCountSelect.value) || 1);
    const totalPeople = presentersCount + guestsCount;
    const maxPeople = getCurrentSetCapacity();
    const ageRating = (selectedType === "information" && subtype === "Faits divers")
      ? String(ageRatingSelect.value || "TP")
      : "TP";

    if (!title || title.length < 2) {
      setFeedback("Nom du programme invalide (minimum 2 caractères).", "error");
      return;
    }
    if (totalPeople > maxPeople) {
      setFeedback(`Plateau dépassé: ${totalPeople}/${maxPeople}.`, "error");
      return;
    }
    if (recurrenceMode === "single") {
      if (!dateKey) {
        setFeedback("Date de diffusion requise.", "error");
        return;
      }
      if (!validateDateRange(dateKey)) {
        setFeedback("La diffusion unique doit être dans la fenêtre des 15 jours.", "error");
        return;
      }
    } else {
      if (!recurrenceStartDate || !validateDateRange(recurrenceStartDate)) {
        setFeedback("Le premier jour de récurrence doit être dans la fenêtre des 15 jours.", "error");
        return;
      }
      if (recurrenceDays.length === 0) {
        setFeedback("Sélectionne au moins un jour récurrent.", "error");
        return;
      }
      if (recurrenceDays.length > 5) {
        setFeedback("Tu peux sélectionner 5 jours maximum.", "error");
        return;
      }
    }
    if (!Number.isFinite(startMinute)) {
      setFeedback("Heure de début invalide.", "error");
      return;
    }
    const endMinute = startMinute + duration;
    if (endMinute > (24 * 60)) {
      setFeedback("La production dépasse minuit. Choisis un autre horaire.", "error");
      return;
    }
    if (requestedRuns === 2) {
      if (!Number.isFinite(secondStartMinute)) {
        setFeedback("Heure du 2e passage invalide.", "error");
        return;
      }
      const secondEnd = secondStartMinute + duration;
      if (secondEnd > (24 * 60)) {
        setFeedback("Le 2e passage dépasse minuit.", "error");
        return;
      }
      if (Math.abs(secondStartMinute - startMinute) < duration) {
        setFeedback("Les deux passages se chevauchent.", "error");
        return;
      }
    }
    if (productionMode === "recorded") {
      if (!Number.isFinite(shootStartMinute)) {
        setFeedback("Heure de tournage invalide.", "error");
        return;
      }
      const shootEndMinute = shootStartMinute + duration;
      if (shootEndMinute > (24 * 60)) {
        setFeedback("Le tournage dépasse minuit.", "error");
        return;
      }
      if ((startMinute - shootEndMinute) < 60) {
        setFeedback("Il faut au moins 1h entre la fin du tournage et la diffusion.", "error");
        return;
      }
      if (requestedRuns === 2) {
        if (!Number.isFinite(secondShootStartMinute)) {
          setFeedback("Heure du 2e tournage invalide.", "error");
          return;
        }
        const secondShootEndMinute = secondShootStartMinute + duration;
        if (secondShootEndMinute > (24 * 60)) {
          setFeedback("Le 2e tournage dépasse minuit.", "error");
          return;
        }
        if ((secondStartMinute - secondShootEndMinute) < 60) {
          setFeedback("Il faut au moins 1h entre la fin du 2e tournage et la 2e diffusion.", "error");
          return;
        }
        if (Math.abs(secondShootStartMinute - shootStartMinute) < duration) {
          setFeedback("Les deux tournages se chevauchent.", "error");
          return;
        }
      }
    }

    const currentSchedule = loadSchedule();
    const firstPresenter = selectedPresenters[0];
    const basePayload = {
      title,
      categoryId: selectedType,
      productionMode,
      subtype,
      duration,
      recurrenceMode,
      dateKey: recurrenceMode === "single" ? dateKey : "",
      recurrenceStartDate: recurrenceMode === "recurring" ? recurrenceStartDate : "",
      recurrenceEndDate: "",
      recurrenceDays: recurrenceMode === "recurring" ? recurrenceDays : [],
      ageRating,
      productionGroupId: recurrenceMode === "single" ? `grp_${Date.now()}_${Math.floor(Math.random() * 10000)}` : "",
      presenterId: firstPresenter ? firstPresenter.id : "",
      presenterName: firstPresenter ? String(firstPresenter.fullName || "") : "",
      presenterStarBonus: teamBonus,
      presenterIds: selectedPresenterIds,
      presenterNames: selectedPresenterNames,
      presenterStarBonuses: selectedPresenterBonuses,
      studioId: getSelectedStudio().id,
      studioName: getSelectedStudio().name,
      presentersCount,
      guestsCount,
      maxPeopleOnSet: maxPeople,
      shootStartMinute: productionMode === "recorded" ? shootStartMinute : null
    };
    const candidates = [
      normalizeScheduleEntry({
        ...basePayload,
        id: `${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        startMinute,
        endMinute
      })
    ].filter(Boolean);
    if (requestedRuns === 2) {
      candidates.push(
        normalizeScheduleEntry({
          ...basePayload,
        id: `${Date.now()}_${Math.floor(Math.random() * 10000)}_2`,
        startMinute: secondStartMinute,
        endMinute: secondStartMinute + duration,
        shootStartMinute: productionMode === "recorded" ? secondShootStartMinute : null
      })
    );
    }
    if (candidates.length === 0) {
      setFeedback("Impossible de créer la production.", "error");
      return;
    }
    const hasConflict = candidates.some((candidate) => hasScheduleConflict(currentSchedule, candidate))
      || (candidates.length > 1 && hasTimeOverlap(candidates[0], candidates[1]));
    if (hasConflict) {
      setFeedback("Conflit de planning : le studio TV est déjà occupé sur ce créneau.", "error");
      return;
    }

    const presenterNamesById = {};
    selectedPresenters.forEach((presenter) => {
      presenterNamesById[presenter.id] = presenter.fullName;
    });
    const weeklyValidation = checkPresenterWeeklyLimit(currentSchedule, candidates, selectedPresenterIds, presenterNamesById);
    if (!weeklyValidation.ok) {
      setFeedback(weeklyValidation.message, "error");
      return;
    }

    if (!programCatalog || typeof programCatalog.createProducedProgramForCurrentSession !== "function") {
      setFeedback("Module catalogue indisponible.", "error");
      return;
    }
    const starsOverride = Math.max(0.5, Math.min(5, computeStudioProductionStars() + teamBonus));
    const creation = programCatalog.createProducedProgramForCurrentSession({
      title,
      categoryId: selectedType,
      subtype,
      duration,
      ageRating,
      productionMode,
      presenterId: firstPresenter ? firstPresenter.id : "",
      presenterName: firstPresenter ? String(firstPresenter.fullName || "") : "",
      presenterStarBonus: teamBonus,
      presenterIds: selectedPresenterIds,
      presenterNames: selectedPresenterNames,
      presentersCount,
      guestsCount,
      starsOverride
    });
    if (!creation || !creation.ok) {
      setFeedback(creation && creation.message ? creation.message : "Création impossible.", "error");
      return;
    }
    if (programCatalog && typeof programCatalog.setProducedProgramPresenterForCurrentSession === "function") {
      programCatalog.setProducedProgramPresenterForCurrentSession(title, {
        presenterId: firstPresenter ? firstPresenter.id : "",
        presenterName: firstPresenter ? String(firstPresenter.fullName || "") : "",
        presenterStarBonus: teamBonus,
        presenterIds: selectedPresenterIds,
        presenterNames: selectedPresenterNames,
        presenterStarBonuses: selectedPresenterBonuses
      });
    }

    const launchCost = getProductionLaunchCost(duration, subtype);
    if (!bank || typeof bank.getBalance !== "function" || typeof bank.add !== "function") {
      setFeedback("Module bancaire indisponible.", "error");
      return;
    }
    if (bank.getBalance() < launchCost) {
      setFeedback(`Fonds insuffisants pour lancer cette production (${formatEuro(launchCost)}).`, "error");
      return;
    }
    bank.add(-launchCost, {
      category: "production_studio",
      label: `Lancement production: ${title}`
    });

    const nextSchedule = [...currentSchedule, ...candidates];
    saveSchedule(nextSchedule);
    candidates.forEach((entry) => syncStudioProductionToDateGrid(entry));
    await forceCloudPushBestEffort();

    setFeedback("Production planifiée et ajoutée à votre grille.", "success");
    nameInput.value = "";
    runsSelect.value = "1";
    secondStartInput.value = "";
    recurringDays.clear();
    renderRecurringDaysButtons();
    syncRunsUi();
    syncRecurringUi();
    refreshSimulation();
  });
})();
