(function studioApp() {
  const appKeys = (window.SessionUtils && window.SessionUtils.APP_KEYS) || {};
  const STUDIO_KEY_PREFIX = appKeys.STUDIO_KEY_PREFIX || "tv_manager_studio_";
  const STUDIO_SCHEDULE_KEY_PREFIX = appKeys.STUDIO_SCHEDULE_KEY_PREFIX || "tv_manager_studio_schedule_";
  const DATE_GRID_KEY_PREFIX = appKeys.DATE_GRID_KEY_PREFIX || "tv_manager_date_grid_";
  const DAY_START_MINUTE = Number(window.SessionUtils && window.SessionUtils.DAY_START_MINUTE) || (5 * 60);
  const DAY_END_MINUTE = Number(window.SessionUtils && window.SessionUtils.DAY_END_MINUTE) || (25 * 60);
  const bank = window.PlayerBank;
  const programCatalog = window.ProgramCatalog;
  const presenterEngine = window.PresenterEngine;
  const financeEngine = window.FinanceEngine;
  const sessionUtils = window.SessionUtils;
  let pendingDeleteEntry = null;
  let pendingEditEntryId = null;
  let pendingDetailsEntryId = null;
  let planningFilter = "all";
  let planningCalendarOffset = 0;
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
    ]
  };
  const UPGRADE_TREES = {
    decor: {
      label: "Décor",
      levels: [
        { name: "Fond vert standard", price: 0 },
        { name: "Habillage modulable multi-formats", price: 120000 },
        { name: "Décor semi-permanent acoustique", price: 280000 },
        { name: "Plateau premium multi-zones", price: 650000 }
      ]
    },
    lights: {
      label: "Lumières",
      levels: [
        { name: "Kit LED 3 points basique", price: 0 },
        { name: "Grille LED broadcast + contrôle DMX", price: 140000 },
        { name: "Éclairage broadcast renforcé + redondance", price: 320000 },
        { name: "Grille motorisée à presets automatiques", price: 700000 }
      ]
    },
    cameras: {
      label: "Cameras",
      levels: [
        { name: "2 cameras PTZ HD", price: 0 },
        { name: "3 cameras studio 4K + optiques broadcast", price: 280000 },
        { name: "4 cameras 4K + regie vision avancee", price: 650000 },
        { name: "4 cameras cinema TV + robotique de plateau", price: 1300000 }
      ]
    },
    regie: {
      label: "Régie",
      levels: [
        { name: "Régie compacte HD 2 sources", price: 0 },
        { name: "Régie broadcast 4 sources + habillage live", price: 480000 },
        { name: "Régie multicaméra 8 sources + automatisation", price: 1250000 },
        { name: "Régie premium IP + redondance complète", price: 2900000 }
      ]
    },
    son: {
      label: "Son",
      levels: [
        { name: "Kit audio plateau basique", price: 0 },
        { name: "Réseau micros HF + mixage numérique", price: 220000 },
        { name: "Traitement voix broadcast + backup", price: 520000 },
        { name: "Chaîne audio premium + redondance complète", price: 1250000 }
      ]
    },
    prompteur: {
      label: "Prompteur",
      levels: [
        { name: "Prompteur manuel simple", price: 0 },
        { name: "Prompteur dual-opérateur newsroom", price: 160000 },
        { name: "Prompteur synchronisé scripts/live", price: 390000 },
        { name: "Prompteur intelligent + workflows IA", price: 980000 }
      ]
    }
  };
  const PRODUCTION_COST_BASE = 35000;
  const WEEKLY_MAX_WORK_MINUTES = 39 * 60;
  const OFF_AIR_MINUTES_BY_DURATION = Object.freeze({
    5: 25,
    15: 45,
    30: 60,
    45: 75,
    60: 90,
    90: 120,
    120: 150
  });
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
  const SUBTYPE_SPECIALTY_MAP = {
    JT: ["jt"],
    "Météo": ["jt", "matinale"],
    "Économie": ["eco"],
    Politique: ["debat", "societe"],
    Matinale: ["matinale"],
    International: ["international"],
    "Faits divers": ["faits divers"],
    Culture: ["culture"],
    "Santé": ["societe"],
    "Sport flash": ["jt", "societe"]
  };
  const WEEKDAY_LABELS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const session = sessionUtils && typeof sessionUtils.requireSession === "function"
    ? sessionUtils.requireSession({ redirectPath: "index.html", persist: true, allowEmailParam: true, clearSearch: true })
    : null;
  if (!session) return;

  function formatEuro(value) {
    return sessionUtils.formatEuro(value);
  }

  function normalizeStudioStars(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0.5;
    return Math.max(0.5, Math.min(5, numeric));
  }

  function getStudioProductionCostMultiplier() {
    const state = sanitizeState(loadState());
    const keys = Object.keys(UPGRADE_TREES);
    let totalLevels = 0;
    let totalCurrent = 0;
    keys.forEach((key) => {
      const max = Math.max(0, UPGRADE_TREES[key].levels.length - 1);
      totalLevels += max;
      totalCurrent += Math.max(0, Math.min(max, Number(state[key]) || 0));
    });
    if (totalLevels <= 0) return 1;
    const ratio = totalCurrent / totalLevels;
    return 1 + (ratio * 1.4);
  }

  function getProductionLaunchCost(duration, subtype) {
    const safeDuration = Math.max(5, Number(duration) || 60);
    const subtypeFactor = PRODUCTION_SUBTYPE_MULTIPLIER[String(subtype || "")] || 1;
    const equipmentFactor = getStudioProductionCostMultiplier();
    return Math.round(PRODUCTION_COST_BASE * (safeDuration / 60) * subtypeFactor * equipmentFactor);
  }

  function refreshProductionCostPreview() {
    const setupCostPreview = document.getElementById("productionSetupCostPreview");
    const perRunCostPreview = document.getElementById("productionPerRunCostPreview");
    const durationSelect = document.getElementById("productionDurationSelect");
    const subtypeSelect = document.getElementById("productionSubtypeSelect");
    if (!setupCostPreview || !perRunCostPreview || !durationSelect || !subtypeSelect) return;
    const duration = Number(durationSelect.value) || 60;
    const subtype = String(subtypeSelect.value || "");
    const setupCost = getProductionLaunchCost(duration, subtype);
    setupCostPreview.textContent = `${formatEuro(setupCost)} (payé au lancement)`;

    let perRunCost = Math.round(1200 * Math.max(0.2, duration / 60) * getStudioProductionCostMultiplier());
    const financeEngine = window.FinanceEngine;
    if (financeEngine && typeof financeEngine.estimateProgramCost === "function") {
      perRunCost = financeEngine.estimateProgramCost(
        {
          title: "Production studio TV",
          categoryId: "information",
          duration,
          productionSubtype: subtype
        },
        "inedit",
        session
      );
    }
    perRunCostPreview.textContent = `${formatEuro(perRunCost)} / diffusion`;
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


  function defaultState() {
    return { decor: 0, lights: 0, cameras: 0, regie: 0, son: 0, prompteur: 0 };
  }

  function loadState() {
    const raw = localStorage.getItem(studioStateKey());
    if (!raw) return defaultState();
    try {
      const parsed = JSON.parse(raw);
      return {
        decor: Number.isFinite(Number(parsed.decor)) ? Math.max(0, Math.floor(Number(parsed.decor))) : 0,
        lights: Number.isFinite(Number(parsed.lights)) ? Math.max(0, Math.floor(Number(parsed.lights))) : 0,
        cameras: Number.isFinite(Number(parsed.cameras)) ? Math.max(0, Math.floor(Number(parsed.cameras))) : 0,
        regie: Number.isFinite(Number(parsed.regie)) ? Math.max(0, Math.floor(Number(parsed.regie))) : 0,
        son: Number.isFinite(Number(parsed.son)) ? Math.max(0, Math.floor(Number(parsed.son))) : 0,
        prompteur: Number.isFinite(Number(parsed.prompteur)) ? Math.max(0, Math.floor(Number(parsed.prompteur))) : 0
      };
    } catch {
      return defaultState();
    }
  }

  function sanitizeState(state) {
    const safe = { ...defaultState(), ...state };
    Object.keys(UPGRADE_TREES).forEach((key) => {
      const maxLevel = UPGRADE_TREES[key].levels.length - 1;
      safe[key] = Math.min(maxLevel, Math.max(0, Math.floor(Number(safe[key]) || 0)));
    });
    return safe;
  }

  function saveState(state) {
    localStorage.setItem(studioStateKey(), JSON.stringify(sanitizeState(state)));
  }

  function setFeedback(message, type) {
    const node = document.getElementById("studioUpgradeFeedback");
    if (!node) return;
    node.textContent = message;
    node.className = `feedback ${type}`;
  }

  function setProductionFeedback(message, type) {
    const node = document.getElementById("studioProductionFeedback");
    if (!node) return;
    node.textContent = message;
    node.className = `feedback ${type}`;
  }

  function setPresentersFeedback(message, type) {
    const node = document.getElementById("studioPresentersFeedback");
    if (!node) return;
    node.textContent = message;
    node.className = `feedback ${type}`;
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

  function listOwnedPresenters() {
    if (!presenterEngine || typeof presenterEngine.getOwnedPresentersForCurrentSession !== "function") return [];
    return presenterEngine.getOwnedPresentersForCurrentSession();
  }

  function listMarketPresenters() {
    if (!presenterEngine || typeof presenterEngine.getMarketPresentersForCurrentSession !== "function") return [];
    return presenterEngine.getMarketPresentersForCurrentSession();
  }

  function formatStarBonusLabel(value) {
    const safe = Math.max(0, Math.min(1, Number(value) || 0));
    const text = Number.isInteger(safe) ? String(safe) : String(safe).replace(".", ",");
    return `+${text}★`;
  }

  function normalizeToken(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function presenterMatchesSubtype(presenter, subtype) {
    const subtypeKey = Object.keys(SUBTYPE_SPECIALTY_MAP).find((key) => normalizeToken(key) === normalizeToken(subtype));
    const required = subtypeKey ? SUBTYPE_SPECIALTY_MAP[subtypeKey] : [];
    if (!required.length) return false;
    const specialty = normalizeToken(presenter && presenter.specialty);
    return required.some((item) => specialty === normalizeToken(item));
  }

  function computeEffectivePresenterBonus(presenter, subtype) {
    if (!presenterMatchesSubtype(presenter, subtype)) return 0;
    return Math.max(0, Math.min(1, Number(presenter && presenter.starBonus) || 0));
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

  function normalizeSingleStaffId(value) {
    const id = String(value || "").trim();
    return id ? [id] : [];
  }

  function getEntryPresenterDisplayName(entry) {
    if (!entry) return "-";
    if (Array.isArray(entry.presenterNames) && entry.presenterNames.length > 0) {
      return entry.presenterNames.join(", ");
    }
    return String(entry.presenterName || "-");
  }

  function getEntrySingleStaffDisplayName(entry, role) {
    if (!entry) return "-";
    const safeRole = String(role || "").trim();
    if (safeRole === "directors") return String(entry.directorName || "-");
    if (safeRole === "producers") return String(entry.producerName || "-");
    return "-";
  }

  function openProductionModal() {
    const modal = document.getElementById("studioProductionModal");
    if (!modal) return;
    modal.classList.remove("hidden");
  }

  function applyProductionFormMode(entry) {
    const modalTitle = document.getElementById("studioProductionModalTitle");
    const submitBtn = document.querySelector("#studioProductionForm button[type='submit']");
    const recurrenceModeSelect = document.getElementById("productionRecurrenceModeSelect");
    const dateInput = document.getElementById("productionDateInput");
    const recurringStartInput = document.getElementById("productionRecurringStartDateInput");
    const durationSelect = document.getElementById("productionDurationSelect");
    const subtypeSelect = document.getElementById("productionSubtypeSelect");
    const runsSelect = document.getElementById("productionDailyRunsSelect");
    const secondStartInput = document.getElementById("productionSecondStartInput");
    const typeLabel = document.getElementById("productionTypeLabel");
    const typeStatic = document.getElementById("productionTypeStatic");
    const subtypeLabel = document.getElementById("productionSubtypeLabel");
    const durationLabel = document.getElementById("productionDurationLabel");
    const recurrenceModeLabel = document.getElementById("productionRecurrenceModeLabel");
    const setupCostLabel = document.getElementById("productionSetupCostLabel");
    const setupCostPreview = document.getElementById("productionSetupCostPreview");
    const perRunCostLabel = document.getElementById("productionPerRunCostLabel");
    const perRunCostPreview = document.getElementById("productionPerRunCostPreview");
    const costHelp = document.getElementById("studioCostHelp");
    const formActions = document.querySelector(".studio-form-actions");
    if (
      !modalTitle || !submitBtn || !recurrenceModeSelect || !dateInput || !recurringStartInput
      || !durationSelect || !subtypeSelect || !runsSelect || !secondStartInput
      || !typeLabel || !typeStatic || !subtypeLabel || !durationLabel || !recurrenceModeLabel
      || !setupCostLabel || !setupCostPreview || !perRunCostLabel || !perRunCostPreview || !costHelp || !formActions
    ) return;

    const editing = Boolean(entry);
    modalTitle.textContent = editing ? "Modifier la production" : "Nouvelle production";
    submitBtn.textContent = editing ? "Enregistrer les modifications" : "Planifier la production";

    recurrenceModeSelect.disabled = editing;
    dateInput.disabled = editing;
    recurringStartInput.disabled = editing;
    durationSelect.disabled = editing;
    subtypeSelect.disabled = editing;
    runsSelect.disabled = editing;
    secondStartInput.disabled = editing;

    // En mode modification, on ne laisse visibles que les champs modifiables.
    [typeLabel, typeStatic, subtypeLabel, subtypeSelect, durationLabel, durationSelect, recurrenceModeLabel, recurrenceModeSelect].forEach((node) => {
      node.classList.toggle("hidden", editing);
    });
    [setupCostLabel, setupCostPreview, perRunCostLabel, perRunCostPreview, costHelp].forEach((node) => {
      node.classList.toggle("hidden", editing);
    });
    formActions.classList.toggle("editing-mode", editing);
  }

  function closeProductionModal() {
    const modal = document.getElementById("studioProductionModal");
    if (!modal) return;
    modal.classList.add("hidden");
    pendingEditEntryId = null;
  }

  function closeDeleteModal() {
    const modal = document.getElementById("studioDeleteModal");
    if (!modal) return;
    modal.classList.add("hidden");
    pendingDeleteEntry = null;
  }

  function closeDetailsModal() {
    const modal = document.getElementById("studioDetailsModal");
    if (!modal) return;
    modal.classList.add("hidden");
    pendingDetailsEntryId = null;
  }

  function getTodayDateKey() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return formatDateKey(today);
  }

  function getYesterdayDateKey() {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - 1);
    return formatDateKey(day);
  }

  function getTomorrowDateKey() {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + 1);
    return formatDateKey(day);
  }

  function getNextDateKey(dateKey) {
    const date = parseDateKey(dateKey);
    if (!date) return "";
    const copy = new Date(date);
    copy.setDate(copy.getDate() + 1);
    return formatDateKey(copy);
  }

  function isDatePublished(dateKey) {
    const safeDateKey = String(dateKey || "");
    if (!safeDateKey) return false;
    if (!financeEngine || typeof financeEngine.isGridPublished !== "function") return false;
    return financeEngine.isGridPublished(session, safeDateKey);
  }

  function collectPublishedRecurringOccurrencesFrom(entry, fromDateKey) {
    if (!entry || entry.recurrenceMode !== "recurring") return [];
    const fromKey = String(fromDateKey || "");
    if (!fromKey) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const blocked = [];
    for (let offset = 0; offset <= 14; offset += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);
      const dateKey = formatDateKey(date);
      if (dateKey < fromKey) continue;
      if (!recurringOccursOnDate(entry, dateKey)) continue;
      if (isDatePublished(dateKey)) blocked.push(dateKey);
    }
    return blocked;
  }

  function isPastYesterday(dateKey) {
    if (!dateKey) return false;
    return String(dateKey) < getYesterdayDateKey();
  }

  function isDateInRecurringWindow(entry, dateKey) {
    if (!entry || entry.recurrenceMode !== "recurring" || !dateKey) return false;
    const start = String(entry.recurrenceStartDate || "");
    const end = String(entry.recurrenceEndDate || "");
    if (!start || dateKey < start) return false;
    if (end && dateKey > end) return false;
    const date = parseDateKey(dateKey);
    if (!date) return false;
    const weekday = date.getDay();
    return Array.isArray(entry.recurrenceDays) && entry.recurrenceDays.includes(weekday);
  }

  function isSingleEntryLockedForDelete(entry) {
    if (!entry || entry.recurrenceMode !== "single") return false;
    const dateKey = String(entry.dateKey || "");
    if (!dateKey) return false;
    const yesterday = getYesterdayDateKey();
    return dateKey === yesterday;
  }

  function hasRecurringStarted(entry) {
    if (!entry || entry.recurrenceMode !== "recurring") return false;
    const start = String(entry.recurrenceStartDate || "");
    if (!start) return false;
    return start <= getTodayDateKey();
  }

  function removeSingleEntryFromDateGrid(entry) {
    if (!entry || entry.recurrenceMode !== "single" || !entry.dateKey) return;
    const raw = localStorage.getItem(dateGridKey());
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      const dayRaw = parsed[entry.dateKey];
      if (!dayRaw) return;
      const day = normalizeDateGridDay(dayRaw);
      const title = String(entry.title || "");
      const startMinute = Number(entry.startMinute);
      day.day = day.day.filter((row) => {
        if (!row || !row.title) return true;
        const rowScheduleId = String(row.studioScheduleId || "");
        if (rowScheduleId && rowScheduleId === String(entry.id || "")) return false;
        if (row.title !== title) return true;
        if (String(row.categoryId || "") !== String(entry.categoryId || "")) return true;
        const rowStart = Number(row.fixedStartMinute);
        if (Number.isFinite(startMinute) && Number.isFinite(rowStart)) {
          return rowStart !== startMinute;
        }
        return false;
      });
      parsed[entry.dateKey] = day;
      localStorage.setItem(dateGridKey(), JSON.stringify(parsed));
    } catch {
      // Ignore malformed store.
    }
  }

  function trimRecurringEntryFromDateGrid(entry, endDateKey) {
    if (!entry || entry.recurrenceMode !== "recurring") return;
    const raw = localStorage.getItem(dateGridKey());
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      const title = String(entry.title || "");
      const startMinute = Number(entry.startMinute);
      const safeEndDateKey = String(endDateKey || "");
      Object.keys(parsed).forEach((dateKey) => {
        if (!dateKey || (safeEndDateKey && dateKey <= safeEndDateKey)) return;
        const day = normalizeDateGridDay(parsed[dateKey]);
        day.day = day.day.filter((row) => {
          if (!row || !row.title) return true;
          const rowScheduleId = String(row.studioScheduleId || "");
          if (rowScheduleId && rowScheduleId === String(entry.id || "")) return false;
          if (row.title !== title) return true;
          if (String(row.categoryId || "") !== String(entry.categoryId || "")) return true;
          const rowStart = Number(row.fixedStartMinute);
          if (Number.isFinite(startMinute) && Number.isFinite(rowStart)) {
            return rowStart !== startMinute;
          }
          return false;
        });
        parsed[dateKey] = day;
      });
      localStorage.setItem(dateGridKey(), JSON.stringify(parsed));
    } catch {
      // Ignore malformed store.
    }
  }

  function removeScheduleEntryFromDateGrid(entry, options) {
    if (!entry) return;
    const opts = options && typeof options === "object" ? options : {};
    const fromDateKey = String(opts.fromDateKey || "");
    const raw = localStorage.getItem(dateGridKey());
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;
      const title = String(entry.title || "");
      const startMinute = Number(entry.startMinute);
      const scheduleId = String(entry.id || "");
      Object.keys(parsed).forEach((dateKey) => {
        if (!dateKey) return;
        if (fromDateKey && dateKey < fromDateKey) return;
        if (entry.recurrenceMode === "single" && dateKey !== String(entry.dateKey || "")) return;
        if (entry.recurrenceMode === "recurring" && !isDateInRecurringWindow(entry, dateKey)) return;
        const day = normalizeDateGridDay(parsed[dateKey]);
        day.day = day.day.filter((row) => {
          if (!row || !row.title) return true;
          const rowScheduleId = String(row.studioScheduleId || "");
          if (scheduleId && rowScheduleId === scheduleId) return false;
          if (row.title !== title) return true;
          if (String(row.categoryId || "") !== String(entry.categoryId || "")) return true;
          const rowStart = Number(row.fixedStartMinute);
          if (Number.isFinite(startMinute) && Number.isFinite(rowStart)) {
            return rowStart !== startMinute;
          }
          return false;
        });
        parsed[dateKey] = day;
      });
      localStorage.setItem(dateGridKey(), JSON.stringify(parsed));
    } catch {
      // Ignore malformed store.
    }
  }

  function cleanupExpiredRecurringEntries() {
    const current = loadSchedule();
    if (!Array.isArray(current) || current.length === 0) return;
    const expired = current.filter((entry) => entry.recurrenceMode === "recurring" && isPastYesterday(entry.recurrenceEndDate));
    if (expired.length === 0) return;

    const remaining = current.filter((entry) => !expired.some((candidate) => candidate.id === entry.id));
    saveSchedule(remaining);

    expired.forEach((entry) => {
      trimRecurringEntryFromDateGrid(entry, entry.recurrenceEndDate);
      const stillUsed = remaining.some((candidate) => candidate && candidate.title === entry.title);
      if (!stillUsed && programCatalog && typeof programCatalog.deleteProducedProgramForCurrentSession === "function") {
        programCatalog.deleteProducedProgramForCurrentSession(entry.title, { ignoreScheduling: true });
      }
    });
  }

  function computeStudioProductionStars() {
    const state = sanitizeState(loadState());
    const keys = Object.keys(UPGRADE_TREES);
    const levels = keys.map((key) => {
      const max = Math.max(0, UPGRADE_TREES[key].levels.length - 1);
      return Math.max(0, Math.min(max, Number(state[key]) || 0));
    });
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

  function getUpgradeLockLevel(state, nextLevel) {
    if (!Number.isFinite(nextLevel) || nextLevel <= 1) return 0;
    const requiredLevel = nextLevel - 1;
    const safe = sanitizeState(state);
    const keys = Object.keys(UPGRADE_TREES);
    const blocked = keys.some((candidateKey) => Number(safe[candidateKey]) < requiredLevel);
    return blocked ? requiredLevel : 0;
  }

  function openDeleteModal(entry) {
    const modal = document.getElementById("studioDeleteModal");
    const body = document.getElementById("studioDeleteModalBody");
    const closeBtn = document.getElementById("closeStudioDeleteModalBtn");
    const cancelBtn = document.getElementById("cancelStudioDeleteModalBtn");
    const confirmBtn = document.getElementById("confirmStudioDeleteModalBtn");
    if (!modal || !body || !closeBtn || !cancelBtn || !confirmBtn) return;

    const isSingle = entry && entry.recurrenceMode === "single";
    const isRecurring = entry && entry.recurrenceMode === "recurring";
    const singleLocked = isSingle && isSingleEntryLockedForDelete(entry);
    const singlePublished = isSingle && isDatePublished(String(entry.dateKey || ""));
    const scheduling = (!isSingle && !isRecurring && programCatalog && typeof programCatalog.getProgramSchedulingForCurrentSession === "function")
      ? programCatalog.getProgramSchedulingForCurrentSession(entry.title)
      : { isScheduled: false, dateKeys: [] };

    pendingDeleteEntry = entry;
    body.replaceChildren();

    if (singleLocked || singlePublished) {
      const intro = document.createElement("p");
      intro.textContent = singlePublished
        ? "Suppression impossible : la journée est publiée."
        : "Suppression impossible pour un programme prévu hier.";
      body.append(intro);
      closeBtn.classList.remove("hidden");
      cancelBtn.classList.add("hidden");
      confirmBtn.classList.add("hidden");
    } else if (isRecurring) {
      if (!hasRecurringStarted(entry)) {
        const intro = document.createElement("p");
        intro.textContent = `Tu es sûr de vouloir supprimer « ${entry.title} » ?`;
        body.append(intro);
      } else {
        const intro = document.createElement("p");
        intro.textContent = `Choisis la date de fin de récurrence pour « ${entry.title} ».`;
        const label = document.createElement("label");
        label.setAttribute("for", "studioRecurringEndDateInput");
        label.textContent = "Date de fin";
        const input = document.createElement("input");
        input.type = "date";
        input.id = "studioRecurringEndDateInput";
        input.min = getTodayDateKey();
        input.value = String(entry.recurrenceEndDate || getTodayDateKey());
        body.append(intro, label, input);
      }
      closeBtn.classList.add("hidden");
      cancelBtn.classList.remove("hidden");
      confirmBtn.classList.remove("hidden");
    } else if (scheduling && scheduling.isScheduled && Array.isArray(scheduling.dateKeys) && scheduling.dateKeys.length > 0) {
      const intro = document.createElement("p");
      intro.textContent = "Suppression impossible : le programme est déjà planifié :";
      const list = document.createElement("ul");
      list.className = "modal-list";
      scheduling.dateKeys.forEach((dateKey) => {
        const li = document.createElement("li");
        li.textContent = `- ${formatDateLabel(dateKey)}`;
        list.appendChild(li);
      });
      body.append(intro, list);
      closeBtn.classList.remove("hidden");
      cancelBtn.classList.add("hidden");
      confirmBtn.classList.add("hidden");
    } else {
      const message = document.createElement("p");
      message.textContent = `Tu es sûr de vouloir supprimer « ${entry.title} » ?`;
      body.appendChild(message);
      closeBtn.classList.add("hidden");
      cancelBtn.classList.remove("hidden");
      confirmBtn.classList.remove("hidden");
    }

    modal.classList.remove("hidden");
  }

  function bindProductionModal() {
    const modal = document.getElementById("studioProductionModal");
    const openBtn = document.getElementById("openStudioProductionModalBtn");
    if (!modal) return;

    if (openBtn) {
      openBtn.addEventListener("click", () => {
        const navPath = String(openBtn.dataset.navPath || "").trim();
        if (navPath) {
          // Keep navigation robust on local file URLs.
          window.location.href = navPath;
          return;
        }
        pendingEditEntryId = null;
        applyProductionFormMode(null);
        setProductionFeedback("", "");
        populatePresenterSelect();
        syncMultiRunsUi();
        refreshProductionCostPreview();
        openProductionModal();
      });
    }

    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeProductionModal();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.classList.contains("hidden")) {
        closeProductionModal();
      }
    });
  }

  function bindStudioCardToggle() {
    const toggleBtn = document.getElementById("toggleStudioCardBtn");
    const cardBody = document.getElementById("studioCardBody");
    if (!toggleBtn || !cardBody) return;

    toggleBtn.addEventListener("click", () => {
      const isHidden = cardBody.classList.toggle("hidden");
      toggleBtn.textContent = isHidden ? "Déplier" : "Réduire";
      toggleBtn.setAttribute("aria-expanded", isHidden ? "false" : "true");
    });
  }

  function bindDetailsModal() {
    const modal = document.getElementById("studioDetailsModal");
    const closeBtn = document.getElementById("closeStudioDetailsModalBtn");
    const editBtn = document.getElementById("editStudioDetailsModalBtn");
    const deleteBtn = document.getElementById("deleteStudioDetailsModalBtn");
    if (!modal || !closeBtn || !editBtn || !deleteBtn) return;

    closeBtn.addEventListener("click", closeDetailsModal);
    editBtn.addEventListener("click", () => {
      if (!pendingDetailsEntryId) {
        closeDetailsModal();
        return;
      }
      const entry = loadSchedule().find((candidate) => candidate.id === pendingDetailsEntryId);
      if (!entry) {
        setProductionFeedback("Programme introuvable.", "error");
        closeDetailsModal();
        return;
      }
      closeDetailsModal();
      openEditProduction(entry);
    });
    deleteBtn.addEventListener("click", () => {
      if (!pendingDetailsEntryId) {
        closeDetailsModal();
        return;
      }
      const entry = loadSchedule().find((candidate) => candidate.id === pendingDetailsEntryId);
      if (!entry) {
        setProductionFeedback("Programme introuvable.", "error");
        closeDetailsModal();
        return;
      }
      closeDetailsModal();
      openDeleteModal(entry);
    });

    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeDetailsModal();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.classList.contains("hidden")) {
        closeDetailsModal();
      }
    });
  }

  function bindDeleteModal() {
    const modal = document.getElementById("studioDeleteModal");
    const closeBtn = document.getElementById("closeStudioDeleteModalBtn");
    const cancelBtn = document.getElementById("cancelStudioDeleteModalBtn");
    const confirmBtn = document.getElementById("confirmStudioDeleteModalBtn");
    if (!modal || !closeBtn || !cancelBtn || !confirmBtn) return;

    closeBtn.addEventListener("click", closeDeleteModal);
    cancelBtn.addEventListener("click", closeDeleteModal);

    confirmBtn.addEventListener("click", async () => {
      if (!pendingDeleteEntry) {
        closeDeleteModal();
        return;
      }
      if (!programCatalog || typeof programCatalog.deleteProducedProgramForCurrentSession !== "function") {
        setProductionFeedback("Module catalogue indisponible.", "error");
        closeDeleteModal();
        return;
      }
      const isSingle = pendingDeleteEntry.recurrenceMode === "single";
      const isRecurring = pendingDeleteEntry.recurrenceMode === "recurring";
      if (isRecurring) {
        const recurringStarted = hasRecurringStarted(pendingDeleteEntry);
        const endInput = document.getElementById("studioRecurringEndDateInput");
        const endDateKey = recurringStarted
          ? String(endInput && endInput.value ? endInput.value : "")
          : "";
        if (recurringStarted) {
          if (!endDateKey) {
            setProductionFeedback("Date de fin requise.", "error");
            return;
          }
          if (endDateKey < getTodayDateKey()) {
            setProductionFeedback("La date de fin doit être aujourd'hui au minimum.", "error");
            return;
          }
        }
        const removeFromDateKey = recurringStarted
          ? (endDateKey === getTodayDateKey() ? getTodayDateKey() : getNextDateKey(endDateKey))
          : getTodayDateKey();
        const publishedRecurringDates = collectPublishedRecurringOccurrencesFrom(pendingDeleteEntry, removeFromDateKey);
        if (publishedRecurringDates.length > 0) {
          setProductionFeedback(
            `Suppression impossible : ${formatDateLabel(publishedRecurringDates[0])} est publiée.`,
            "error"
          );
          return;
        }
        const current = loadSchedule();
        if (!recurringStarted) {
          removeScheduleEntryFromDateGrid(pendingDeleteEntry, { fromDateKey: removeFromDateKey });
          const remaining = current.filter((entry) => entry.id !== pendingDeleteEntry.id);
          saveSchedule(remaining);
          const stillUsed = remaining.some((entry) => entry && entry.title === pendingDeleteEntry.title);
          if (!stillUsed) {
            programCatalog.deleteProducedProgramForCurrentSession(pendingDeleteEntry.title, { ignoreScheduling: true });
          }
          setProductionFeedback("Récurrence supprimée.", "success");
          await forceCloudPushBestEffort();
        } else {
          const effectiveEndDateKey = endDateKey === getTodayDateKey()
            ? getYesterdayDateKey()
            : endDateKey;
          const next = current.map((entry) => (
            entry.id === pendingDeleteEntry.id
              ? { ...entry, recurrenceEndDate: effectiveEndDateKey }
              : entry
          ));
          removeScheduleEntryFromDateGrid(pendingDeleteEntry, { fromDateKey: removeFromDateKey });
          if (isPastYesterday(effectiveEndDateKey)) {
            const remaining = next.filter((entry) => entry.id !== pendingDeleteEntry.id);
            saveSchedule(remaining);
            const stillUsed = remaining.some((entry) => entry && entry.title === pendingDeleteEntry.title);
            if (!stillUsed) {
              programCatalog.deleteProducedProgramForCurrentSession(pendingDeleteEntry.title, { ignoreScheduling: true });
            }
            setProductionFeedback("Programme récurrent arrêté et supprimé.", "success");
            await forceCloudPushBestEffort();
          } else {
            saveSchedule(next);
            if (endDateKey === getTodayDateKey()) {
              setProductionFeedback("Récurrence arrêtée à partir d'aujourd'hui.", "success");
            } else {
              setProductionFeedback(`Récurrence programmée jusqu'au ${formatDateLabel(endDateKey)}.`, "success");
            }
            await forceCloudPushBestEffort();
          }
        }
        closeDeleteModal();
        renderSchedule();
        return;
      }

      if (isSingle) {
        const singleDateKey = String(pendingDeleteEntry.dateKey || "");
        if (isDatePublished(singleDateKey)) {
          setProductionFeedback("Suppression impossible : la journée est publiée.", "error");
          return;
        }
        const current = loadSchedule();
        const groupId = String(pendingDeleteEntry.productionGroupId || "");
        const groupedEntries = current.filter((entry) => {
          if (!entry || entry.recurrenceMode !== "single") return false;
          if (groupId) return String(entry.productionGroupId || "") === groupId;
          return (
            String(entry.title || "") === String(pendingDeleteEntry.title || "")
            && String(entry.dateKey || "") === String(pendingDeleteEntry.dateKey || "")
          );
        });
        const entriesToDelete = groupedEntries.length ? groupedEntries : [pendingDeleteEntry];

        entriesToDelete.forEach((entry) => removeSingleEntryFromDateGrid(entry));
        const next = current.filter((entry) => !entriesToDelete.some((toDelete) => toDelete.id === entry.id));
        saveSchedule(next);

        const stillUsed = next.some((entry) => entry && entry.title === pendingDeleteEntry.title);
        if (!stillUsed) {
          const result = programCatalog.deleteProducedProgramForCurrentSession(
            pendingDeleteEntry.title,
            { ignoreScheduling: true }
          );
          if (!result || !result.ok) {
            const reason = result && result.message ? result.message : "Suppression du programme impossible.";
            setProductionFeedback(reason, "error");
            closeDeleteModal();
            return;
          }
        }

        setProductionFeedback("Programme supprimé du studio TV et de vos programmes.", "success");
        await forceCloudPushBestEffort();
        closeDeleteModal();
        renderSchedule();
        return;
      }

      const result = programCatalog.deleteProducedProgramForCurrentSession(
        pendingDeleteEntry.title,
        undefined
      );
      if (!result || !result.ok) {
        const reason = result && result.message ? result.message : "Suppression du programme impossible.";
        setProductionFeedback(reason, "error");
        closeDeleteModal();
        return;
      }
      const next = loadSchedule().filter((candidate) => candidate.id !== pendingDeleteEntry.id);
      saveSchedule(next);
      setProductionFeedback("Programme supprimé du studio TV et de vos programmes.", "success");
      await forceCloudPushBestEffort();
      closeDeleteModal();
      renderSchedule();
    });

    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeDeleteModal();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.classList.contains("hidden")) {
        closeDeleteModal();
      }
    });
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

  function parseDateKey(value) {
    return sessionUtils.parseDateKey(value);
  }

  function formatDateKey(date) {
    if (!(date instanceof Date)) return "";
    return sessionUtils.toDateKey(date);
  }

  function normalizeDateGridDay(raw) {
    if (!raw) return { day: [] };
    if (Array.isArray(raw)) {
      return {
        day: raw
          .map((entry) => {
            if (!entry) return null;
            if (typeof entry === "string") return { title: entry, categoryId: "information", season: null, episode: null };
            const title = String(entry.title || "");
            if (!title) return null;
            return {
              title,
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
            };
          })
          .filter(Boolean)
      };
    }
    if (Array.isArray(raw.day)) {
      return normalizeDateGridDay(raw.day);
    }
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
    const incomingMode = String(programEntry && programEntry.productionMode || "").trim().toLowerCase();
    const shouldProtectRecorded = incomingMode === "direct";
    const hasProtectedOverlap = shouldProtectRecorded && timed.some((item) => {
      const existingMode = String(item && item.entry && item.entry.productionMode || "").trim().toLowerCase();
      if (existingMode !== "recorded") return false;
      return item.start < targetEnd && targetStart < item.end;
    });
    if (hasProtectedOverlap) {
      return timed.map((item) => item.entry);
    }

    const keptTimed = timed
      .filter((item) => item.end <= targetStart || item.start >= targetEnd)
      .map((item) => item.entry)
      .filter((entry) => {
        const forcedId = String(programEntry.studioScheduleId || "");
        if (forcedId && String(entry.studioScheduleId || "") === forcedId) return false;
        const sameScheduledSlot = (
          !forcedId
          && entry.title === programEntry.title
          && entry.categoryId === programEntry.categoryId
          && Number(entry.fixedStartMinute) === targetStart
        );
        return !sameScheduledSlot;
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
    if (!inserted) {
      next.push({ ...programEntry, fixedStartMinute: targetStart });
    }

    const nextTimed = buildTimedDayEntries(next);
    return nextTimed.map((item) => item.entry);
  }

  function minProductionDate() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }

  function minProductionDateKey() {
    return formatDateKey(minProductionDate());
  }

  function maxProductionDate() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    now.setDate(now.getDate() + 14);
    return now;
  }

  function maxProductionDateKey() {
    return formatDateKey(maxProductionDate());
  }

  function isBeforeMinProductionDate(dateKey) {
    if (!dateKey) return true;
    return String(dateKey) < minProductionDateKey();
  }

  function isAfterMaxProductionDate(dateKey) {
    if (!dateKey) return false;
    return String(dateKey) > maxProductionDateKey();
  }

  function listRecurringDateKeys(startDateKey, selectedWeekdays, endDateKey, fromDateKey) {
    const startDate = parseDateKey(startDateKey);
    if (!startDate) return [];
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const keys = [];
    for (let offset = 0; offset <= 14; offset += 1) {
      const date = new Date(startOfToday);
      date.setDate(startOfToday.getDate() + offset);
      if (date < startDate) continue;
      if (!selectedWeekdays.includes(date.getDay())) continue;
      const key = formatDateKey(date);
      if (fromDateKey && key < fromDateKey) continue;
      if (endDateKey && key > endDateKey) continue;
      keys.push(key);
    }
    return keys;
  }

  function syncStudioProductionToDateGrid(scheduleEntry, options) {
    const opts = options && typeof options === "object" ? options : {};
    const fromDateKey = String(opts.fromDateKey || "");
    const raw = localStorage.getItem(dateGridKey());
    let dateGrid = {};
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") dateGrid = parsed;
      } catch {
        dateGrid = {};
      }
    }

    const targetDates = scheduleEntry.recurrenceMode === "recurring"
      ? listRecurringDateKeys(
        scheduleEntry.recurrenceStartDate,
        scheduleEntry.recurrenceDays || [],
        scheduleEntry.recurrenceEndDate || "",
        fromDateKey
      )
      : [scheduleEntry.dateKey].filter((dateKey) => !fromDateKey || (dateKey && dateKey >= fromDateKey));

    targetDates.forEach((dateKey) => {
      if (!dateKey) return;
      const day = normalizeDateGridDay(dateGrid[dateKey]);
      day.day = syncDayWithForcedProgram(
        day.day,
        {
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
        },
        scheduleEntry.startMinute
      );
      dateGrid[dateKey] = day;
    });

    localStorage.setItem(dateGridKey(), JSON.stringify(dateGrid));
  }

  function formatMinute(minuteValue) {
    const minute = Math.max(0, Math.min((24 * 60) - 1, Number(minuteValue) || 0));
    const hh = Math.floor(minute / 60);
    const mm = minute % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  function formatDateLabel(dateKey) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
    if (!match) return dateKey;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit"
    }).format(date);
  }

  function formatRecurringDays(days) {
    if (!Array.isArray(days) || days.length === 0) return "-";
    return days
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
      .sort((a, b) => a - b)
      .map((value) => WEEKDAY_LABELS[value] || String(value))
      .join(", ");
  }

  function sanitizeProgramTitle(value) {
    return String(value || "")
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
  }

  function normalizeScheduleEntry(raw) {
    if (!raw || typeof raw !== "object") return null;
    const dateKey = String(raw.dateKey || "");
    const title = sanitizeProgramTitle(raw.title);
    const categoryId = String(raw.categoryId || "");
    const subtype = String(raw.subtype || "");
    const productionModeRaw = String(raw.productionMode || "").trim().toLowerCase();
    const productionMode = productionModeRaw === "recorded" ? "recorded" : "direct";
    const startMinute = Number(raw.startMinute);
    const shootStartMinute = Number(raw.shootStartMinute);
    const duration = Number(raw.duration);
    const endMinute = Number(raw.endMinute);
    const recurrenceMode = raw.recurrenceMode === "recurring" ? "recurring" : "single";
    const recurrenceStartDate = String(raw.recurrenceStartDate || "");
    const recurrenceDays = Array.isArray(raw.recurrenceDays)
      ? raw.recurrenceDays.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
      : [];
    const recurrenceEndDate = String(raw.recurrenceEndDate || "");
    const productionGroupId = String(raw.productionGroupId || "");
    const ageRating = typeof raw.ageRating === "string" ? raw.ageRating : "TP";
    const presenterId = String(raw.presenterId || "").trim();
    const presenterName = String(raw.presenterName || "").trim();
    const presenterStarBonus = Number(raw.presenterStarBonus);
    const presenterIds = normalizePresenterIds(raw.presenterIds, presenterId);
    const presenterNames = normalizePresenterNames(raw.presenterNames, presenterName);
    const presenterStarBonuses = Array.isArray(raw.presenterStarBonuses)
      ? raw.presenterStarBonuses.map((value) => Math.max(0, Math.min(1, Number(value) || 0)))
      : [];
    const directorId = String(raw.directorId || "").trim();
    const directorName = String(raw.directorName || "").trim();
    const producerId = String(raw.producerId || "").trim();
    const producerName = String(raw.producerName || "").trim();
    const studioId = String(raw.studioId || "studio_1").trim() || "studio_1";
    const studioName = String(raw.studioName || "Studio TV 1").trim() || "Studio TV 1";
    const presentersCount = Math.max(
      1,
      Math.floor(Number(raw.presentersCount) || presenterIds.length || (presenterId ? 1 : 0) || 1)
    );
    const guestsCount = Math.max(0, Math.floor(Number(raw.guestsCount) || 0));
    const maxPeopleOnSet = Math.max(1, Math.floor(Number(raw.maxPeopleOnSet) || 3));
    if (!title || !categoryId) return null;
    if (recurrenceMode === "single" && !dateKey) return null;
    if (recurrenceMode === "recurring" && (!recurrenceStartDate || recurrenceDays.length === 0)) return null;
    if (recurrenceMode === "recurring" && recurrenceEndDate && recurrenceEndDate < recurrenceStartDate) return null;
    if (!Number.isFinite(startMinute) || !Number.isFinite(duration) || !Number.isFinite(endMinute)) return null;
    if (duration <= 0 || endMinute <= startMinute) return null;
    return {
      id: String(raw.id || `${dateKey}_${startMinute}_${title}`),
      productionGroupId,
      dateKey,
      title,
      categoryId,
      productionMode,
      subtype,
      startMinute,
      shootStartMinute: Number.isFinite(shootStartMinute)
        ? Math.max(0, Math.min((24 * 60) - 1, Math.floor(shootStartMinute)))
        : null,
      duration,
      endMinute,
      recurrenceMode,
      recurrenceStartDate,
      recurrenceEndDate,
      recurrenceDays: recurrenceDays.slice(0, 5),
      ageRating,
      presenterId: presenterId || "",
      presenterName: presenterName || "",
      presenterStarBonus: Number.isFinite(presenterStarBonus)
        ? Math.max(0, Math.min(1, presenterStarBonus))
        : 0,
      presenterIds,
      presenterNames,
      presenterStarBonuses,
      directorId,
      directorName,
      producerId,
      producerName,
      studioId,
      studioName,
      presentersCount: Math.min(maxPeopleOnSet, presentersCount),
      guestsCount: Math.min(maxPeopleOnSet, guestsCount),
      maxPeopleOnSet
    };
  }

  function loadSchedule() {
    const raw = localStorage.getItem(studioScheduleKey());
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(normalizeScheduleEntry)
        .filter(Boolean)
        .sort((a, b) => {
          const aKey = a.recurrenceMode === "recurring" ? a.recurrenceStartDate : a.dateKey;
          const bKey = b.recurrenceMode === "recurring" ? b.recurrenceStartDate : b.dateKey;
          if (aKey !== bKey) return aKey.localeCompare(bKey);
          return getStudioOccupiedRange(a).start - getStudioOccupiedRange(b).start;
        });
    } catch {
      return [];
    }
  }

  function saveSchedule(entries) {
    const clean = Array.isArray(entries) ? entries.map(normalizeScheduleEntry).filter(Boolean) : [];
    localStorage.setItem(studioScheduleKey(), JSON.stringify(clean));
  }

  function dateToWeekday(dateKey) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return date.getDay();
  }

  function hasTimeOverlap(a, b) {
    const rangeA = getStudioOccupiedRange(a);
    const rangeB = getStudioOccupiedRange(b);
    return rangeA.start < rangeB.end && rangeB.start < rangeA.end;
  }

  function getDiffusionRange(entry) {
    const duration = Math.max(5, Number(entry && entry.duration) || 0);
    const start = Number.isFinite(Number(entry && entry.startMinute))
      ? Number(entry.startMinute)
      : 0;
    return {
      start,
      end: start + duration
    };
  }

  function hasDiffusionOverlap(a, b) {
    const rangeA = getDiffusionRange(a);
    const rangeB = getDiffusionRange(b);
    return rangeA.start < rangeB.end && rangeB.start < rangeA.end;
  }

  function hasOccupancyOrDiffusionOverlap(a, b) {
    return hasTimeOverlap(a, b) || hasDiffusionOverlap(a, b);
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
    if (!entry || entry.recurrenceMode !== "recurring" || !dateKey) return false;
    if (dateKey < String(entry.recurrenceStartDate || "")) return false;
    if (entry.recurrenceEndDate && dateKey > String(entry.recurrenceEndDate)) return false;
    const weekday = dateToWeekday(dateKey);
    return entry.recurrenceDays.includes(weekday);
  }

  function getNextOccurrenceDateKey(entry, fromDateKey) {
    if (!entry) return "";
    const start = String(fromDateKey || getTodayDateKey());
    if (entry.recurrenceMode === "single") {
      const dateKey = String(entry.dateKey || "");
      return dateKey && dateKey >= start ? dateKey : "";
    }
    if (entry.recurrenceMode !== "recurring") return "";
    for (let offset = 0; offset <= 14; offset += 1) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + offset);
      const key = formatDateKey(date);
      if (key < start) continue;
      if (recurringOccursOnDate(entry, key)) return key;
    }
    return "";
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

  function getEntryStaffIdsByRole(entry, role) {
    if (!entry) return [];
    const safeRole = String(role || "").trim();
    if (safeRole === "directors") return normalizeSingleStaffId(entry.directorId);
    if (safeRole === "producers") return normalizeSingleStaffId(entry.producerId);
    return normalizePresenterIds(entry.presenterIds, entry.presenterId);
  }

  function getOffAirMinutes(duration) {
    const safe = Math.max(5, Math.round(Number(duration) || 0));
    if (Object.prototype.hasOwnProperty.call(OFF_AIR_MINUTES_BY_DURATION, safe)) {
      return OFF_AIR_MINUTES_BY_DURATION[safe];
    }
    return Math.max(30, Math.round(safe * 1.25));
  }

  function getEntryTotalWorkMinutes(entry) {
    const duration = Math.max(5, Math.round(Number(entry && entry.duration) || 60));
    return duration + getOffAirMinutes(duration);
  }

  function occursOnDate(entry, dateKey) {
    if (!entry || !dateKey) return false;
    if (entry.recurrenceMode === "single") {
      return String(entry.dateKey || "") === dateKey;
    }
    if (entry.recurrenceMode === "recurring") {
      return recurringOccursOnDate(entry, dateKey);
    }
    return false;
  }

  function listDateKeysFromToday(days) {
    const safeDays = Math.max(1, Math.floor(Number(days) || 1));
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    const keys = [];
    for (let offset = 0; offset < safeDays; offset += 1) {
      const date = new Date(base);
      date.setDate(base.getDate() + offset);
      keys.push(formatDateKey(date));
    }
    return keys;
  }

  function formatWorkMinutes(value) {
    const minutes = Math.max(0, Math.round(Number(value) || 0));
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `${hours}h${String(rest).padStart(2, "0")}`;
  }

  function computeMaxWeeklyWorkMinutes(entries, staffId, role) {
    const safeEntries = Array.isArray(entries) ? entries.filter(Boolean) : [];
    const dateKeys = listDateKeysFromToday(21);
    const dailyMinutes = dateKeys.map((dateKey) => {
      let total = 0;
      safeEntries.forEach((entry) => {
        if (!getEntryStaffIdsByRole(entry, role).includes(staffId)) return;
        if (!occursOnDate(entry, dateKey)) return;
        total += getEntryTotalWorkMinutes(entry);
      });
      return total;
    });

    let max = 0;
    for (let start = 0; start < dailyMinutes.length; start += 1) {
      let sum = 0;
      for (let index = start; index < Math.min(start + 7, dailyMinutes.length); index += 1) {
        sum += dailyMinutes[index];
      }
      if (sum > max) max = sum;
    }
    return { minutes: max };
  }

  function checkStaffWeeklyLimit(entries, candidates, selectedStaffIds, staffNamesById, role, fallbackName) {
    const staffIds = Array.isArray(selectedStaffIds)
      ? selectedStaffIds.map((id) => String(id || "").trim()).filter(Boolean)
      : [];
    const safeRole = String(role || "").trim();
    const safeFallback = String(fallbackName || "Intervenant");
    const allEntries = [...(Array.isArray(entries) ? entries : []), ...(Array.isArray(candidates) ? candidates : [])];
    for (let i = 0; i < staffIds.length; i += 1) {
      const staffId = staffIds[i];
      const workdays = new Set();
      allEntries.forEach((entry) => {
        if (!getEntryStaffIdsByRole(entry, safeRole).includes(staffId)) return;
        if (entry.recurrenceMode === "recurring") {
          (Array.isArray(entry.recurrenceDays) ? entry.recurrenceDays : [])
            .forEach((weekday) => workdays.add(Number(weekday)));
          return;
        }
        if (entry.recurrenceMode === "single") {
          const weekday = dateToWeekday(entry.dateKey);
          if (Number.isInteger(weekday)) workdays.add(weekday);
        }
      });
      if (workdays.size > 5) {
        const name = staffNamesById[staffId] || safeFallback;
        return {
          ok: false,
          message: `${name} dépasse la limite de 5 jours d'antenne par semaine.`
        };
      }
      const weeklyLoad = computeMaxWeeklyWorkMinutes(allEntries, staffId, safeRole);
      if (weeklyLoad.minutes > WEEKLY_MAX_WORK_MINUTES) {
        const name = staffNamesById[staffId] || safeFallback;
        return {
          ok: false,
          message: `${name} dépasse la limite de 39h/semaine (${formatWorkMinutes(weeklyLoad.minutes)} sur 7 jours).`
        };
      }
    }
    return { ok: true };
  }

  function hasScheduleConflict(entries, candidate, ignoredId) {
    return entries.some((entry) => {
      if (!entry) return false;
      if (ignoredId && entry.id === ignoredId) return false;
      if (!hasOccupancyOrDiffusionOverlap(candidate, entry)) return false;

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

  function getDurationOptionsForType(type) {
    const options = (programCatalog && programCatalog.CATEGORY_DURATION_OPTIONS && programCatalog.CATEGORY_DURATION_OPTIONS[type])
      ? programCatalog.CATEGORY_DURATION_OPTIONS[type]
      : (type === "information" ? [5, 15, 30, 45, 60, 90, 120] : [30, 45, 60, 90]);
    return options.slice().sort((a, b) => a - b);
  }

  function populateProductionOptions() {
    const typeSelect = document.getElementById("productionTypeSelect");
    const subtypeSelect = document.getElementById("productionSubtypeSelect");
    const durationSelect = document.getElementById("productionDurationSelect");
    if (!typeSelect || !subtypeSelect || !durationSelect) return;

    const type = "information";
    const subtypeOptions = PRODUCTION_SUBTYPES[type] || [];
    const durationOptions = getDurationOptionsForType(type);

    subtypeSelect.replaceChildren(
      ...subtypeOptions.map((label) => {
        const option = document.createElement("option");
        option.value = label;
        option.textContent = label;
        return option;
      })
    );
    durationSelect.replaceChildren(
      ...durationOptions.map((value) => {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = `${value} min`;
        return option;
      })
    );
  }

  function getSelectedRecurringDays() {
    const wrap = document.getElementById("productionRecurringDaysWrap");
    if (!wrap) return [];
    const checked = Array.from(wrap.querySelectorAll('input[type="checkbox"]:checked'));
    return checked.map((input) => Number(input.value)).filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
  }

  function syncRecurringUi() {
    const modeSelect = document.getElementById("productionRecurrenceModeSelect");
    const singleDateLabel = document.getElementById("productionDateLabel");
    const singleDateInput = document.getElementById("productionDateInput");
    const recurringStartLabel = document.getElementById("productionRecurringStartLabel");
    const recurringStartInput = document.getElementById("productionRecurringStartDateInput");
    const recurringDaysLabel = document.getElementById("productionRecurringDaysLabel");
    const recurringDaysWrap = document.getElementById("productionRecurringDaysWrap");
    if (!modeSelect || !singleDateLabel || !singleDateInput || !recurringStartLabel || !recurringStartInput || !recurringDaysLabel || !recurringDaysWrap) return;

    const isRecurring = modeSelect.value === "recurring";
    const editing = Boolean(pendingEditEntryId);
    singleDateLabel.classList.toggle("hidden", isRecurring || editing);
    singleDateInput.classList.toggle("hidden", isRecurring || editing);
    singleDateInput.required = !isRecurring && !editing;
    recurringStartLabel.classList.toggle("hidden", !isRecurring || editing);
    recurringStartInput.classList.toggle("hidden", !isRecurring || editing);
    recurringStartInput.required = isRecurring && !editing;
    recurringDaysLabel.classList.toggle("hidden", !isRecurring);
    recurringDaysWrap.classList.toggle("hidden", !isRecurring);
  }

  function syncSubtypeUi() {
    const subtypeSelect = document.getElementById("productionSubtypeSelect");
    const ageLabel = document.getElementById("productionAgeRatingLabel");
    const ageSelect = document.getElementById("productionAgeRatingSelect");
    if (!subtypeSelect || !ageLabel || !ageSelect) return;
    const isFaitsDivers = subtypeSelect.value === "Faits divers";
    const editing = Boolean(pendingEditEntryId);
    ageLabel.classList.toggle("hidden", !isFaitsDivers);
    ageSelect.classList.toggle("hidden", !isFaitsDivers);
    ageSelect.required = isFaitsDivers;
    if (editing) {
      ageLabel.classList.add("hidden");
      ageSelect.classList.add("hidden");
      ageSelect.required = false;
    }
    if (!isFaitsDivers) ageSelect.value = "TP";
  }

  function syncMultiRunsUi() {
    const durationSelect = document.getElementById("productionDurationSelect");
    const runsLabel = document.getElementById("productionRunsLabel");
    const runsSelect = document.getElementById("productionDailyRunsSelect");
    const secondStartLabel = document.getElementById("productionSecondStartLabel");
    const secondStartInput = document.getElementById("productionSecondStartInput");
    if (!durationSelect || !runsLabel || !runsSelect || !secondStartLabel || !secondStartInput) return;

    const editing = Boolean(pendingEditEntryId);
    const isFiveMinutes = !editing && Number(durationSelect.value) === 5;
    runsLabel.classList.toggle("hidden", !isFiveMinutes);
    runsSelect.classList.toggle("hidden", !isFiveMinutes);
    if (!isFiveMinutes) {
      runsSelect.value = "1";
    }
    const withTwoRuns = isFiveMinutes && runsSelect.value === "2";
    secondStartLabel.classList.toggle("hidden", !withTwoRuns);
    secondStartInput.classList.toggle("hidden", !withTwoRuns);
    secondStartInput.required = withTwoRuns;
    if (!withTwoRuns) secondStartInput.value = "";
  }

  function bindRecurringDaysLimit() {
    const wrap = document.getElementById("productionRecurringDaysWrap");
    if (!wrap) return;
    wrap.addEventListener("change", (event) => {
      const target = event.target;
      if (!target || target.tagName !== "INPUT") return;
      const selected = getSelectedRecurringDays();
      if (selected.length <= 5) return;
      target.checked = false;
      setProductionFeedback("Tu peux sélectionner 5 jours maximum.", "error");
    });
  }

  function fillProductionFormFromEntry(entry) {
    const recurrenceModeSelect = document.getElementById("productionRecurrenceModeSelect");
    const nameInput = document.getElementById("productionNameInput");
    const dateInput = document.getElementById("productionDateInput");
    const recurringStartInput = document.getElementById("productionRecurringStartDateInput");
    const timeInput = document.getElementById("productionStartInput");
    const subtypeSelect = document.getElementById("productionSubtypeSelect");
    const durationSelect = document.getElementById("productionDurationSelect");
    const ageRatingSelect = document.getElementById("productionAgeRatingSelect");
    const runsSelect = document.getElementById("productionDailyRunsSelect");
    const secondStartInput = document.getElementById("productionSecondStartInput");
    const presenterSelect = document.getElementById("productionPresenterSelect");
    if (
      !entry || !recurrenceModeSelect || !nameInput || !dateInput || !recurringStartInput
      || !timeInput || !subtypeSelect || !durationSelect || !ageRatingSelect || !runsSelect || !secondStartInput || !presenterSelect
    ) return;

    recurrenceModeSelect.value = entry.recurrenceMode === "recurring" ? "recurring" : "single";
    nameInput.value = String(entry.title || "");
    dateInput.value = String(entry.dateKey || "");
    recurringStartInput.value = String(entry.recurrenceStartDate || "");
    timeInput.value = formatMinute(entry.startMinute);
    if (entry.subtype) subtypeSelect.value = entry.subtype;
    durationSelect.value = String(entry.duration || 60);
    ageRatingSelect.value = entry.subtype === "Faits divers" ? String(entry.ageRating || "TP") : "TP";
    runsSelect.value = "1";
    secondStartInput.value = "";
    populatePresenterSelect(entry.presenterId || "");

    const checks = Array.from(document.querySelectorAll("#productionRecurringDaysWrap input[type='checkbox']"));
    checks.forEach((input) => {
      const day = Number(input.value);
      input.checked = Array.isArray(entry.recurrenceDays) && entry.recurrenceDays.includes(day);
    });
  }

  function openEditProduction(entry) {
    pendingEditEntryId = entry.id;
    applyProductionFormMode(entry);
    fillProductionFormFromEntry(entry);
    syncRecurringUi();
    syncSubtypeUi();
    syncMultiRunsUi();
    refreshProductionCostPreview();
    setProductionFeedback("", "");
    openProductionModal();
  }

  function openDetailsModal(entry) {
    const modal = document.getElementById("studioDetailsModal");
    const body = document.getElementById("studioDetailsModalBody");
    if (!modal || !body || !entry) return;

    pendingDetailsEntryId = entry.id;
    const recurrenceModeLabel = entry.recurrenceMode === "recurring" ? "Récurrent" : "Non récurrent";
    const meta = programCatalog && typeof programCatalog.getProgramMeta === "function"
      ? programCatalog.getProgramMeta(entry.title)
      : null;
    const typeLabel = entry.categoryId === "information" ? "Informations" : String(entry.categoryId || "-");
    const subtypeLabel = String(entry.subtype || (meta && meta.productionSubtype) || "-");
    const durationValue = Number(entry.duration) > 0
      ? Number(entry.duration)
      : (Number(meta && meta.duration) > 0 ? Number(meta.duration) : 0);
    const ratingLabel = subtypeLabel === "Faits divers"
      ? String(entry.ageRating || "TP")
      : "TP";
    const occupied = getStudioOccupiedRange(entry);
    const isRecorded = String(entry.productionMode || "").trim().toLowerCase() === "recorded";

    body.replaceChildren();
    const addDetailRow = (label, value) => {
      const paragraph = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = `${label} :`;
      paragraph.append(strong, ` ${String(value || "-")}`);
      body.appendChild(paragraph);
    };

    addDetailRow("Nom", sanitizeProgramTitle(entry.title) || "-");
    addDetailRow("Type", typeLabel);
    addDetailRow("Sous-type", subtypeLabel);
    addDetailRow("Durée", `${durationValue} min`);
    if (isRecorded) {
      addDetailRow("Tournage", `${formatMinute(occupied.start)} - ${formatMinute(occupied.end)}`);
      addDetailRow("Diffusion", `${formatMinute(entry.startMinute)} - ${formatMinute(entry.endMinute)}`);
    } else {
      addDetailRow("Heure", `${formatMinute(entry.startMinute)} - ${formatMinute(entry.endMinute)}`);
    }
    addDetailRow("Récurrence", recurrenceModeLabel);
    if (entry.recurrenceMode === "single") {
      addDetailRow("Date de diffusion", formatDateLabel(entry.dateKey));
    } else {
      addDetailRow("Premier jour", formatDateLabel(entry.recurrenceStartDate));
      addDetailRow("Jours récurrents", formatRecurringDays(entry.recurrenceDays));
      addDetailRow("Fin de récurrence", entry.recurrenceEndDate ? formatDateLabel(entry.recurrenceEndDate) : "Aucune");
    }
    addDetailRow("Classification", ratingLabel);
    addDetailRow("Journaliste(s)", getEntryPresenterDisplayName(entry));
    addDetailRow("Réalisateur", getEntrySingleStaffDisplayName(entry, "directors"));
    addDetailRow("Producteur", getEntrySingleStaffDisplayName(entry, "producers"));
    addDetailRow("Studio TV", String(entry.studioName || "Studio TV 1"));
    addDetailRow(
      "Plateau",
      `${Math.max(1, Number(entry.presentersCount) || 1)} journaliste(s), ${Math.max(0, Number(entry.guestsCount) || 0)} invité(s), max ${Math.max(1, Number(entry.maxPeopleOnSet) || 3)}`
    );
    addDetailRow("Impact étoiles", formatStarBonusLabel(entry.presenterStarBonus));

    modal.classList.remove("hidden");
  }

  function buildPlanningCalendar(entries, fromDateKey) {
    const baseDate = parseDateKey(fromDateKey);
    if (!baseDate) return null;
    const calendar = document.createElement("section");
    calendar.className = "studio-planning-calendar";

    const maxOffset = 7;
    const safeOffset = Math.max(0, Math.min(maxOffset, Number(planningCalendarOffset) || 0));
    planningCalendarOffset = safeOffset;

    const grid = document.createElement("div");
    grid.className = "studio-planning-calendar-grid";

    for (let offset = 0; offset < 7; offset += 1) {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() + safeOffset + offset);
      const dateKey = formatDateKey(date);
      const dayCard = document.createElement("article");
      dayCard.className = "studio-planning-day";

      const dayHead = document.createElement("header");
      dayHead.className = "studio-planning-day-head";
      const dayLabel = document.createElement("strong");
      dayLabel.textContent = new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit"
      }).format(date);
      dayHead.appendChild(dayLabel);

      const rows = entries
        .filter((entry) => {
          if (entry.recurrenceMode === "recurring") return recurringOccursOnDate(entry, dateKey);
          return String(entry.dateKey || "") === dateKey;
        })
        .sort((a, b) => getStudioOccupiedRange(a).start - getStudioOccupiedRange(b).start);

      const count = document.createElement("span");
      count.className = "studio-planning-day-count";
      count.textContent = `${rows.length}`;
      dayHead.appendChild(count);

      const dayBody = document.createElement("div");
      dayBody.className = "studio-planning-day-body";
      if (!rows.length) {
        const empty = document.createElement("p");
        empty.className = "studio-planning-day-empty";
        empty.textContent = "Aucune diffusion";
        dayBody.appendChild(empty);
      } else {
        rows.forEach((entry) => {
          const item = document.createElement("button");
          item.type = "button";
          item.className = `studio-planning-event ${entry.recurrenceMode === "recurring" ? "recurring" : "single"}`;
          const hour = document.createElement("span");
          hour.className = "studio-planning-event-hour";
          const occupied = getStudioOccupiedRange(entry);
          hour.textContent = `${formatMinute(occupied.start)}-${formatMinute(occupied.end)}`;
          const name = document.createElement("span");
          name.className = "studio-planning-event-title";
          name.textContent = entry.title;
          item.addEventListener("click", () => {
            openDetailsModal(entry);
          });
          item.append(hour, name);
          dayBody.appendChild(item);
        });
      }

      dayCard.append(dayHead, dayBody);
      grid.appendChild(dayCard);
    }

    calendar.appendChild(grid);
    return calendar;
  }

  function renderPlanningFilters(fromDateKey) {
    const wrap = document.getElementById("studioPlanningFilters");
    if (!wrap) return;
    const maxOffset = 7;
    const safeOffset = Math.max(0, Math.min(maxOffset, Number(planningCalendarOffset) || 0));
    planningCalendarOffset = safeOffset;

    const baseDate = parseDateKey(fromDateKey || getTodayDateKey());
    const startDate = baseDate ? new Date(baseDate) : new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() + safeOffset);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const toolbar = document.createElement("div");
    toolbar.className = "studio-planning-toolbar";

    const nav = document.createElement("div");
    nav.className = "studio-planning-nav";

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "secondary-btn";
    prevBtn.textContent = "◀";
    prevBtn.disabled = safeOffset <= 0;
    prevBtn.addEventListener("click", () => {
      planningCalendarOffset = Math.max(0, planningCalendarOffset - 1);
      renderSchedule();
    });

    const rangeText = document.createElement("span");
    rangeText.className = "studio-planning-range";
    rangeText.textContent = `${formatDateLabel(formatDateKey(startDate))} - ${formatDateLabel(formatDateKey(endDate))}`;

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "secondary-btn";
    nextBtn.textContent = "▶";
    nextBtn.disabled = safeOffset >= maxOffset;
    nextBtn.addEventListener("click", () => {
      planningCalendarOffset = Math.min(maxOffset, planningCalendarOffset + 1);
      renderSchedule();
    });
    nav.append(prevBtn, rangeText, nextBtn);

    const filterGroup = document.createElement("div");
    filterGroup.className = "studio-planning-filter-buttons";
    const items = [
      { key: "all", label: "Tous" },
      { key: "single", label: "Uniques" },
      { key: "recurring", label: "Récurrents" }
    ];
    const buttons = items.map((item) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `secondary-btn ${planningFilter === item.key ? "active-menu" : ""}`.trim();
      btn.textContent = item.label;
      btn.addEventListener("click", () => {
        planningFilter = item.key;
        renderSchedule();
      });
      return btn;
    });
    filterGroup.append(...buttons);
    toolbar.append(nav, filterGroup);
    wrap.replaceChildren(toolbar);
  }

  function renderSchedule() {
    const wrap = document.getElementById("studioPlanningList");
    if (!wrap) return;
    cleanupExpiredRecurringEntries();
    const entries = loadSchedule();
    const todayKey = getTodayDateKey();
    renderPlanningFilters(todayKey);
    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "studio-planning-empty";
      empty.textContent = "Aucune production planifiée.";
      wrap.replaceChildren(empty);
      return;
    }

    const filtered = entries.filter((entry) => (
      planningFilter === "all"
      || (planningFilter === "single" && entry.recurrenceMode === "single")
      || (planningFilter === "recurring" && entry.recurrenceMode === "recurring")
    ));

    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "studio-planning-empty";
      empty.textContent = "Aucune production ne correspond au filtre.";
      wrap.replaceChildren(empty);
      return;
    }
    const prepared = filtered.map((entry) => {
      const nextDateKey = getNextOccurrenceDateKey(entry, todayKey);
      return { entry, nextDateKey };
    }).sort((a, b) => {
      const dateA = a.nextDateKey || "9999-12-31";
      const dateB = b.nextDateKey || "9999-12-31";
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const startA = getStudioOccupiedRange(a.entry).start;
      const startB = getStudioOccupiedRange(b.entry).start;
      if (startA !== startB) return startA - startB;
      return String(a.entry.title || "").localeCompare(String(b.entry.title || ""), "fr");
    });
    const calendarView = buildPlanningCalendar(prepared.map((item) => item.entry), todayKey);
    if (calendarView) {
      wrap.replaceChildren(calendarView);
    } else {
      const empty = document.createElement("div");
      empty.className = "studio-planning-empty";
      empty.textContent = "Aucune production à afficher.";
      wrap.replaceChildren(empty);
    }
  }

  function populatePresenterSelect(selectedId) {
    const select = document.getElementById("productionPresenterSelect");
    if (!select) return;
    const presenters = listOwnedPresenters();
    if (!Array.isArray(presenters) || presenters.length === 0) {
      select.innerHTML = '<option value="">Aucun journaliste recruté</option>';
      select.value = "";
      return;
    }
    const options = presenters.map((presenter) => {
      const option = document.createElement("option");
      option.value = presenter.id;
      option.textContent = `${presenter.fullName} (${presenter.specialty} · ${formatStarBonusLabel(presenter.starBonus)})`;
      return option;
    });
    select.replaceChildren(...options);
    const safeSelected = String(selectedId || "");
    const exists = presenters.some((presenter) => presenter.id === safeSelected);
    select.value = exists ? safeSelected : presenters[0].id;
  }

  function renderPresenters() {
    const ownedWrap = document.getElementById("studioPresentersOwnedList");
    const marketWrap = document.getElementById("studioPresentersMarketList");
    if (!ownedWrap || !marketWrap) return;

    const owned = listOwnedPresenters();
    const market = listMarketPresenters();

    if (!owned.length) {
      const empty = document.createElement("p");
      empty.className = "studio-presenter-empty";
      empty.textContent = "Aucun journaliste en CDI. Recrute dans le casting pour lancer des productions.";
      ownedWrap.replaceChildren(empty);
    } else {
      const rows = owned.map((presenter) => {
        const row = document.createElement("div");
        row.className = "studio-presenter-row";

        const main = document.createElement("div");
        main.className = "studio-presenter-main";
        const name = document.createElement("div");
        name.className = "studio-presenter-name";
        name.textContent = presenter.fullName;
        const meta = document.createElement("div");
        meta.className = "studio-presenter-meta";
        const badges = [
          `${presenter.specialty}`,
          `Édito ${presenter.editorial}`,
          `Charisme ${presenter.charisma}`,
          `Notoriété ${presenter.notoriety}`
        ];
        badges.forEach((label) => {
          const badge = document.createElement("span");
          badge.className = "studio-presenter-badge";
          badge.textContent = label;
          meta.appendChild(badge);
        });
        const starBadge = document.createElement("span");
        starBadge.className = "studio-presenter-badge strong";
        starBadge.textContent = `Impact ${formatStarBonusLabel(presenter.starBonus)}`;
        meta.appendChild(starBadge);
        main.append(name, meta);

        const salary = document.createElement("span");
        salary.className = "studio-presenter-badge warn";
        salary.textContent = `${formatEuro(presenter.salaryMonthly || presenter.salaryDaily || 0)} / mois`;
        row.append(main, salary);
        return row;
      });
      ownedWrap.replaceChildren(...rows);
    }

    if (!market.length) {
      const empty = document.createElement("p");
      empty.className = "studio-presenter-empty";
      empty.textContent = "Casting vide pour le moment.";
      marketWrap.replaceChildren(empty);
    } else {
      const rows = market.map((presenter) => {
        const row = document.createElement("div");
        row.className = "studio-presenter-row";

        const main = document.createElement("div");
        main.className = "studio-presenter-main";
        const name = document.createElement("div");
        name.className = "studio-presenter-name";
        name.textContent = presenter.fullName;
        const meta = document.createElement("div");
        meta.className = "studio-presenter-meta";
        const specialty = document.createElement("span");
        specialty.className = "studio-presenter-badge";
        specialty.textContent = presenter.specialty;
        const impact = document.createElement("span");
        impact.className = "studio-presenter-badge strong";
        impact.textContent = `Impact ${formatStarBonusLabel(presenter.starBonus)}`;
        const salary = document.createElement("span");
        salary.className = "studio-presenter-badge warn";
        salary.textContent = `${formatEuro(presenter.salaryMonthly || presenter.salaryDaily || 0)} / mois`;
        meta.append(specialty, impact, salary);
        main.append(name, meta);

        const action = document.createElement("button");
        action.type = "button";
        action.className = "secondary-btn";
        action.textContent = `Recruter (${formatEuro(presenter.signingBonus)})`;
        action.addEventListener("click", () => {
          if (!presenterEngine || typeof presenterEngine.hirePresenterForCurrentSession !== "function") {
            setPresentersFeedback("Module présentateurs indisponible.", "error");
            return;
          }
          const result = presenterEngine.hirePresenterForCurrentSession(presenter.id);
          if (!result || !result.ok) {
            setPresentersFeedback(result && result.message ? result.message : "Recrutement impossible.", "error");
            return;
          }
          setPresentersFeedback(result.message || "Présentateur recruté.", "success");
          renderPresenters();
          populatePresenterSelect();
        });
        row.append(main, action);
        return row;
      });
      marketWrap.replaceChildren(...rows);
    }
  }

  function bindProductionForm() {
    const form = document.getElementById("studioProductionForm");
    const typeSelect = document.getElementById("productionTypeSelect");
    const recurrenceModeSelect = document.getElementById("productionRecurrenceModeSelect");
    const nameInput = document.getElementById("productionNameInput");
    const dateInput = document.getElementById("productionDateInput");
    const recurringStartInput = document.getElementById("productionRecurringStartDateInput");
    const timeInput = document.getElementById("productionStartInput");
    const subtypeSelect = document.getElementById("productionSubtypeSelect");
    const durationSelect = document.getElementById("productionDurationSelect");
    const ageRatingSelect = document.getElementById("productionAgeRatingSelect");
    const runsSelect = document.getElementById("productionDailyRunsSelect");
    const secondStartInput = document.getElementById("productionSecondStartInput");
    const presenterSelect = document.getElementById("productionPresenterSelect");
    const editCancelBtn = document.getElementById("studioEditCancelBtn");
    if (
      !form || !typeSelect || !recurrenceModeSelect || !nameInput || !dateInput || !recurringStartInput
      || !timeInput || !subtypeSelect || !durationSelect || !ageRatingSelect || !runsSelect || !secondStartInput || !presenterSelect || !editCancelBtn
    ) return;


    const minDateKey = minProductionDateKey();
    const maxDateKey = maxProductionDateKey();
    dateInput.min = minDateKey;
    dateInput.max = maxDateKey;
    recurringStartInput.min = minDateKey;
    recurringStartInput.max = maxDateKey;
    dateInput.value = minDateKey;
    recurringStartInput.value = minDateKey;
    timeInput.value = "08:00";
    secondStartInput.value = "";
    runsSelect.value = "1";
    typeSelect.value = "information";
    populateProductionOptions();
    populatePresenterSelect();
    applyProductionFormMode(null);
    syncRecurringUi();
    syncSubtypeUi();
    syncMultiRunsUi();
    bindRecurringDaysLimit();
    refreshProductionCostPreview();

    recurrenceModeSelect.addEventListener("change", () => {
      syncRecurringUi();
      setProductionFeedback("", "");
    });
    subtypeSelect.addEventListener("change", () => {
      syncSubtypeUi();
      refreshProductionCostPreview();
    });
    durationSelect.addEventListener("change", () => {
      syncMultiRunsUi();
      refreshProductionCostPreview();
    });
    runsSelect.addEventListener("change", syncMultiRunsUi);
    editCancelBtn.addEventListener("click", () => {
      closeProductionModal();
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const editingEntry = pendingEditEntryId
        ? loadSchedule().find((entry) => entry.id === pendingEditEntryId)
        : null;
      const categoryId = "information";
      const subtype = String(subtypeSelect.value || "").trim();
      const title = sanitizeProgramTitle(nameInput.value);
      const dateKey = String(dateInput.value || "");
      const recurrenceMode = editingEntry
        ? editingEntry.recurrenceMode
        : (recurrenceModeSelect.value === "recurring" ? "recurring" : "single");
      const recurrenceStartDate = editingEntry
        ? String(editingEntry.recurrenceStartDate || "")
        : String(recurringStartInput.value || "");
      const recurrenceDays = recurrenceMode === "recurring"
        ? getSelectedRecurringDays()
        : [];
      const duration = editingEntry ? Number(editingEntry.duration) : Number(durationSelect.value);
      const startMinute = parseTimeToMinutes(timeInput.value);
      const secondStartMinute = parseTimeToMinutes(secondStartInput.value);
      const presenterId = String(presenterSelect.value || "").trim();
      const presenter = presenterId && presenterEngine && typeof presenterEngine.getPresenterByIdForCurrentSession === "function"
        ? presenterEngine.getPresenterByIdForCurrentSession(presenterId)
        : null;
      const presenterName = presenter ? String(presenter.fullName || "") : "";
      const presenterStarBonus = presenter ? computeEffectivePresenterBonus(presenter, subtype) : 0;
      const requestedRuns = editingEntry
        ? 1
        : ((Number(duration) === 5 && runsSelect.value === "2") ? 2 : 1);
      const ageRating = subtype === "Faits divers"
        ? String(ageRatingSelect.value || "TP")
        : (editingEntry ? String(editingEntry.ageRating || "TP") : "TP");
      if (!title) {
        setProductionFeedback("Nom du programme requis.", "error");
        return;
      }
      if (title.length < 2) {
        setProductionFeedback("Nom trop court (2 caractères minimum).", "error");
        return;
      }
      if (!presenterId || !presenter) {
        setProductionFeedback("Sélectionne un journaliste en CDI pour lancer cette production.", "error");
        return;
      }
      nameInput.value = title;
      if (recurrenceMode === "single" && !dateKey) {
        setProductionFeedback("Date requise.", "error");
        return;
      }
      if (!editingEntry && recurrenceMode === "single" && isBeforeMinProductionDate(dateKey)) {
        setProductionFeedback("La diffusion ne peut pas commencer avant aujourd'hui.", "error");
        return;
      }
      if (!editingEntry && recurrenceMode === "single" && isAfterMaxProductionDate(dateKey)) {
        setProductionFeedback("La diffusion unique doit être dans la fenêtre des 15 jours.", "error");
        return;
      }
      if (recurrenceMode === "recurring" && !recurrenceStartDate) {
        setProductionFeedback("Premier jour de diffusion requis.", "error");
        return;
      }
      if (!editingEntry && recurrenceMode === "recurring" && isBeforeMinProductionDate(recurrenceStartDate)) {
        setProductionFeedback("Le premier jour de récurrence doit être aujourd'hui au minimum.", "error");
        return;
      }
      if (!editingEntry && recurrenceMode === "recurring" && isAfterMaxProductionDate(recurrenceStartDate)) {
        setProductionFeedback("Le premier jour de récurrence doit être dans la fenêtre des 15 jours.", "error");
        return;
      }
      if (recurrenceMode === "recurring" && recurrenceDays.length === 0) {
        setProductionFeedback("Sélectionnez au moins un jour récurrent.", "error");
        return;
      }
      if (recurrenceMode === "recurring" && recurrenceDays.length > 5) {
        setProductionFeedback("Tu peux sélectionner 5 jours maximum.", "error");
        return;
      }
      if (!Number.isFinite(startMinute)) {
        setProductionFeedback("Heure de début invalide.", "error");
        return;
      }
      if (!Number.isFinite(duration) || duration <= 0) {
        setProductionFeedback("Durée invalide.", "error");
        return;
      }
      const endMinute = startMinute + duration;
      if (endMinute > (24 * 60)) {
        setProductionFeedback("La production dépasse minuit. Choisissez un autre horaire.", "error");
        return;
      }
      if (requestedRuns === 2) {
        if (!Number.isFinite(secondStartMinute)) {
          setProductionFeedback("Heure du 2e passage invalide.", "error");
          return;
        }
        const secondEndMinute = secondStartMinute + duration;
        if (secondEndMinute > (24 * 60)) {
          setProductionFeedback("Le 2e passage dépasse minuit. Choisissez un autre horaire.", "error");
          return;
        }
        if (Math.abs(secondStartMinute - startMinute) < duration) {
          setProductionFeedback("Les deux passages se chevauchent. Choisissez des horaires différents.", "error");
          return;
        }
      }

      const current = loadSchedule();
      const creationGroupId = (!editingEntry && recurrenceMode === "single")
        ? `grp_${Date.now()}_${Math.floor(Math.random() * 10000)}`
        : "";
      const directorId = editingEntry ? String(editingEntry.directorId || "").trim() : "";
      const directorName = editingEntry ? String(editingEntry.directorName || "").trim() : "";
      const producerId = editingEntry ? String(editingEntry.producerId || "").trim() : "";
      const producerName = editingEntry ? String(editingEntry.producerName || "").trim() : "";
      const basePayload = {
        dateKey: recurrenceMode === "single"
          ? (editingEntry ? String(editingEntry.dateKey || "") : dateKey)
          : "",
        title,
        categoryId,
        subtype,
        duration,
        recurrenceMode,
        recurrenceStartDate: recurrenceMode === "recurring" ? recurrenceStartDate : "",
        recurrenceEndDate: editingEntry ? String(editingEntry.recurrenceEndDate || "") : "",
        recurrenceDays: recurrenceMode === "recurring" ? recurrenceDays : [],
        ageRating,
        productionGroupId: editingEntry ? String(editingEntry.productionGroupId || "") : creationGroupId,
        studioId: editingEntry ? String(editingEntry.studioId || "studio_1") : "studio_1",
        studioName: editingEntry ? String(editingEntry.studioName || "Studio TV 1") : "Studio TV 1",
        maxPeopleOnSet: editingEntry ? Math.max(1, Number(editingEntry.maxPeopleOnSet) || 3) : 3,
        presenterId,
        presenterName,
        presenterStarBonus,
        directorId,
        directorName,
        producerId,
        producerName
      };
      const candidates = [
        {
          ...basePayload,
          id: editingEntry ? editingEntry.id : `${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          startMinute,
          endMinute
        }
      ];
      if (!editingEntry && requestedRuns === 2) {
        candidates.push({
          ...basePayload,
          id: `${Date.now()}_${Math.floor(Math.random() * 10000)}_2`,
          startMinute: secondStartMinute,
          endMinute: secondStartMinute + duration
        });
      }
      const hasAnyConflict = candidates.some((candidate) => hasScheduleConflict(current, candidate, editingEntry ? editingEntry.id : null))
        || (candidates.length > 1 && hasOccupancyOrDiffusionOverlap(candidates[0], candidates[1]));
      if (hasAnyConflict) {
        setProductionFeedback("Conflit de planning : le studio TV est déjà occupé sur ce créneau.", "error");
        return;
      }
      const presenterNamesById = {};
      if (presenterId) {
        presenterNamesById[presenterId] = presenterName || "Journaliste";
      }
      const workloadEntries = editingEntry
        ? current.filter((entry) => entry && entry.id !== editingEntry.id)
        : current;
      const workloadValidation = checkStaffWeeklyLimit(
        workloadEntries,
        candidates,
        presenterId ? [presenterId] : [],
        presenterNamesById,
        "journalists",
        "Journaliste"
      );
      if (!workloadValidation.ok) {
        setProductionFeedback(workloadValidation.message, "error");
        return;
      }
      if (directorId) {
        const directorValidation = checkStaffWeeklyLimit(
          workloadEntries,
          candidates,
          [directorId],
          { [directorId]: directorName || "Réalisateur" },
          "directors",
          "Réalisateur"
        );
        if (!directorValidation.ok) {
          setProductionFeedback(directorValidation.message, "error");
          return;
        }
      }
      if (producerId) {
        const producerValidation = checkStaffWeeklyLimit(
          workloadEntries,
          candidates,
          [producerId],
          { [producerId]: producerName || "Producteur" },
          "producers",
          "Producteur"
        );
        if (!producerValidation.ok) {
          setProductionFeedback(producerValidation.message, "error");
          return;
        }
      }

      if (!programCatalog || typeof programCatalog.createProducedProgramForCurrentSession !== "function") {
        setProductionFeedback("Module catalogue indisponible.", "error");
        return;
      }
      const creation = programCatalog.createProducedProgramForCurrentSession({
        title,
        categoryId,
        subtype,
        duration,
        ageRating,
        presenterId,
        presenterName,
        presenterStarBonus,
        directorId,
        directorName,
        producerId,
        producerName,
        starsOverride: Math.max(0.5, Math.min(5, computeStudioProductionStars() + presenterStarBonus))
      });
      if (!creation || !creation.ok) {
        setProductionFeedback(creation && creation.message ? creation.message : "Création impossible.", "error");
        return;
      }
      if (programCatalog && typeof programCatalog.setProducedProgramPresenterForCurrentSession === "function") {
        programCatalog.setProducedProgramPresenterForCurrentSession(title, {
          presenterId,
          presenterName,
          presenterStarBonus,
          directorId,
          directorName,
          producerId,
          producerName
        });
      }

      if (editingEntry) {
        const candidate = candidates[0];
        const next = current.map((entry) => (entry.id === editingEntry.id ? candidate : entry));
        saveSchedule(next);
        if (editingEntry.recurrenceMode === "recurring") {
          const tomorrowKey = getTomorrowDateKey();
          removeScheduleEntryFromDateGrid(editingEntry, { fromDateKey: tomorrowKey });
          syncStudioProductionToDateGrid(candidate, { fromDateKey: tomorrowKey });
        } else {
          removeScheduleEntryFromDateGrid(editingEntry);
          syncStudioProductionToDateGrid(candidate);
        }

        if (editingEntry.title !== title && programCatalog && typeof programCatalog.getProgramSchedulingForCurrentSession === "function") {
          const oldScheduling = programCatalog.getProgramSchedulingForCurrentSession(editingEntry.title);
          if (!oldScheduling || !oldScheduling.isScheduled) {
            programCatalog.deleteProducedProgramForCurrentSession(editingEntry.title, { ignoreScheduling: true });
          }
        }
        await forceCloudPushBestEffort();
        setProductionFeedback("Programme mis à jour.", "success");
      } else {
        const launchCost = getProductionLaunchCost(duration, subtype);
        if (!bank || typeof bank.getBalance !== "function" || typeof bank.add !== "function") {
          setProductionFeedback("Module bancaire indisponible.", "error");
          return;
        }
        if (bank.getBalance() < launchCost) {
          setProductionFeedback(`Fonds insuffisants pour lancer cette production (${formatEuro(launchCost)}).`, "error");
          return;
        }
        bank.add(-launchCost, {
          category: "production_studio",
          label: `Lancement production: ${title}`
        });

        candidates.forEach((candidate) => current.push(candidate));
        saveSchedule(current);
        candidates.forEach((candidate) => syncStudioProductionToDateGrid(candidate));
        await forceCloudPushBestEffort();
        if (creation && /déjà existant|deja existant/i.test(String(creation.message || ""))) {
          setProductionFeedback("Production planifiée. Programme existant réutilisé.", "success");
        } else {
          setProductionFeedback("Production planifiée et programme ajouté à vos programmes.", "success");
        }
      }
      renderSchedule();
      nameInput.value = "";
      recurrenceModeSelect.value = "single";
      syncRecurringUi();
      const dayChecks = document.querySelectorAll("#productionRecurringDaysWrap input[type='checkbox']");
      dayChecks.forEach((input) => {
        input.checked = false;
      });
      runsSelect.value = "1";
      secondStartInput.value = "";
      subtypeSelect.value = subtypeSelect.options.length > 0 ? subtypeSelect.options[0].value : "";
      populatePresenterSelect();
      syncSubtypeUi();
      syncMultiRunsUi();
      refreshProductionCostPreview();
      applyProductionFormMode(null);
      closeProductionModal();
    });
  }

  function renderUpgrades() {
    const container = document.getElementById("studioUpgradesList");
    if (!container) return;
    const state = sanitizeState(loadState());

    const rows = Object.entries(UPGRADE_TREES).map(([key, config]) => {
      const currentLevel = state[key];
      const current = config.levels[currentLevel];
      const next = config.levels[currentLevel + 1] || null;
      const maxLevel = Math.max(0, config.levels.length - 1);
      const progressPercent = maxLevel > 0 ? Math.round((currentLevel / maxLevel) * 100) : 100;
      const row = document.createElement("div");
      row.className = "studio-upgrade-row";

      const left = document.createElement("div");
      left.className = "studio-upgrade-main";

      const title = document.createElement("h3");
      title.className = "studio-upgrade-title";
      title.textContent = config.label;

      const progressLine = document.createElement("div");
      progressLine.className = "studio-upgrade-progress-line";

      const progressLevel = document.createElement("span");
      progressLevel.className = "studio-upgrade-progress-level";
      progressLevel.textContent = `Niveau ${currentLevel}/${maxLevel}`;

      const progressValue = document.createElement("span");
      progressValue.className = "studio-upgrade-progress-value";
      progressValue.textContent = `${progressPercent}%`;

      progressLine.append(progressLevel, progressValue);

      const progressBar = document.createElement("div");
      progressBar.className = "studio-upgrade-progress-bar";

      const progressFill = document.createElement("span");
      progressFill.className = "studio-upgrade-progress-fill";
      if (currentLevel >= maxLevel) progressFill.classList.add("max");
      progressFill.style.width = `${Math.max(0, Math.min(100, progressPercent))}%`;
      progressBar.appendChild(progressFill);

      const currentLine = document.createElement("div");
      currentLine.className = "studio-upgrade-current";
      currentLine.textContent = `Actuel: ${current.name}`;

      const nextLine = document.createElement("div");
      nextLine.className = "studio-upgrade-next";
      nextLine.textContent = next
        ? `Suivant: ${next.name} (${formatEuro(next.price)})`
        : "Niveau maximum atteint";

      left.append(title, progressLine, progressBar, currentLine, nextLine);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary-btn studio-upgrade-btn";
      if (!next) {
        button.disabled = true;
        button.textContent = "Max";
      } else {
        const nextLevel = currentLevel + 1;
        const lockLevel = getUpgradeLockLevel(state, nextLevel);
        const locked = lockLevel > 0;
        button.textContent = locked ? "Verrouillé" : "Améliorer";
        button.disabled = locked;
        if (locked) {
          nextLine.textContent = `Débloquer: toutes les options au niveau ${lockLevel} requis`;
        }
        button.addEventListener("click", async () => {
          if (locked) {
            setFeedback(`Passe toutes les options au niveau ${lockLevel} avant de débloquer le niveau ${nextLevel}.`, "error");
            return;
          }
          if (!bank || typeof bank.getBalance !== "function" || typeof bank.add !== "function") {
            setFeedback("Module bancaire indisponible.", "error");
            return;
          }
          const balance = bank.getBalance();
          if (balance < next.price) {
            setFeedback(`Fonds insuffisants pour ${config.label.toLowerCase()} (${formatEuro(next.price)}).`, "error");
            return;
          }
          const updated = sanitizeState(loadState());
          updated[key] = Math.min(updated[key] + 1, config.levels.length - 1);
          saveState(updated);
          bank.add(-next.price, {
            category: "amelioration_studio",
            label: `Amelioration studio TV: ${config.label}`
          });
          setFeedback(`${config.label} amélioré : ${config.levels[updated[key]].name}.`, "success");
          renderUpgrades();
          await forceCloudPushBestEffort();
        });
      }

      row.append(left, button);
      return row;
    });

    container.replaceChildren(...rows);
  }

  renderUpgrades();
  renderPresenters();
  bindStudioCardToggle();
  bindProductionModal();
  bindDetailsModal();
  bindDeleteModal();
  bindProductionForm();
  renderSchedule();

  window.addEventListener("tvmanager:cloud-sync", (event) => {
    const detail = event && event.detail ? event.detail : null;
    if (!detail || !detail.ok || detail.mode !== "pull") return;
    renderUpgrades();
    renderPresenters();
    renderSchedule();
    populatePresenterSelect();
    refreshProductionCostPreview();
  });
})();
