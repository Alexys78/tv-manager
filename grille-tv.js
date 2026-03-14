(function grilleTvApp() {
  const appKeys = (window.SessionUtils && window.SessionUtils.APP_KEYS) || {};
  const DATE_GRID_KEY_PREFIX = appKeys.DATE_GRID_KEY_PREFIX || "tv_manager_date_grid_";
  const GRID_PUBLICATION_KEY_PREFIX = appKeys.GRID_PUBLICATION_KEY_PREFIX || "tv_manager_grid_publication_";
  const catalog = window.ProgramCatalog;
  const diffusionRules = window.DiffusionRules;
  const finance = window.FinanceEngine;
  const sessionUtils = window.SessionUtils;

  const PLANNING_DAYS_AHEAD = 14;
  const TABS_WINDOW_SIZE = 7;

  const session = sessionUtils && typeof sessionUtils.requireSession === "function"
    ? sessionUtils.requireSession({ redirectPath: "index.html", persist: true, allowEmailParam: true, clearSearch: true })
    : null;
  if (!session) return;

  const DAY_NAMES = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const DAY_LABELS = {
    lundi: "Lundi",
    mardi: "Mardi",
    mercredi: "Mercredi",
    jeudi: "Jeudi",
    vendredi: "Vendredi",
    samedi: "Samedi",
    dimanche: "Dimanche"
  };

  const DIFFUSION_LABELS = {
    direct: "En direct",
    inedit: "Inédit",
    rediffusion: "Rediffusion"
  };

  const DAY_START = Number(sessionUtils && sessionUtils.DAY_START_MINUTE) || (5 * 60);
  const DAY_END = Number(sessionUtils && sessionUtils.DAY_END_MINUTE) || (25 * 60);
  const SEGMENT = { id: "day", label: "Grille journée (05:00 - 01:00)", start: DAY_START, end: DAY_END };

  const PROGRAM_CATEGORIES = [
    { id: "information", name: "Informations", colorClass: "category-information", programs: ["JT Quotidien", "Le 6/8 Matin", "Journal de Midi", "JT National 13h", "Le Grand Débat", "Briefing International", "Éco Express", "Info Régions", "Édition spéciale"] },
    { id: "divertissement", name: "Divertissements", colorClass: "category-divertissement", programs: ["Soirée Stand-Up", "Le Grand Défi Live", "Famille en Jeu", "Quiz Arena", "Prime Spectacle", "Comedy Factory", "Talent Avenue", "Blind Test XXL"] },
    { id: "films", name: "Films", colorClass: "category-films", programs: ["Film Action Prime", "Comédie Romantique", "Thriller Urbain", "Cinéma Français", "Aventure Fantastique", "Film Historique", "Polar du Soir", "Classique du Dimanche"] },
    { id: "series", name: "Séries", colorClass: "category-series", programs: ["Unité 51", "Les Héritiers", "Police District", "Campus 24", "Chroniques Médicales", "Code Rouge", "Mystères en Ville", "Saga Familiale"] },
    { id: "magazines", name: "Magazines", colorClass: "category-magazines", programs: ["Consommation & Vous", "Maison et Déco", "Destination Évasion", "Santé Pratique", "Auto Passion", "Vivre Mieux", "Enquête Société", "Cuisine de Saison"] },
    { id: "jeunesse", name: "Jeunesse", colorClass: "category-jeunesse", programs: ["Les Aventuriers Mini", "Cartoon Planet", "Mission Collège", "Kids Quiz", "Studio Ados", "Les Petits Curieux", "Conte du Soir", "Science Junior"] },
    { id: "documentaires", name: "Documentaires", colorClass: "category-documentaires", programs: ["Terres Sauvages", "Planète Bleue", "Grands Inventeurs", "Histoire Secrète", "Les Routes du Monde", "Enquêtes Criminelles", "Civilisations", "Océans Extrêmes"] },
    { id: "realite", name: "Télé-réalité", colorClass: "category-realite", programs: ["Loft Rivals", "Objectif Cuisine", "Le Ranch des Célébrités", "Mariage Challenge", "Survivants Urbains", "Maison en Duel", "Coach Academy", "Nouvelle Vie"] },
    { id: "culture", name: "Culture & Musique", colorClass: "category-culture", programs: ["Scène Ouverte", "Concert Privé", "L'Invité Culture", "Backstage Live", "Découverte Arts", "Théâtre à la Une", "Session Acoustique", "Musiques du Monde"] }
  ];

  const SERIES_CATALOG = {
    "Unité 51": { seasons: 4, episodesPerSeason: 12 },
    "Les Héritiers": { seasons: 5, episodesPerSeason: 10 },
    "Police District": { seasons: 6, episodesPerSeason: 12 },
    "Campus 24": { seasons: 3, episodesPerSeason: 8 },
    "Chroniques Médicales": { seasons: 7, episodesPerSeason: 14 },
    "Code Rouge": { seasons: 4, episodesPerSeason: 10 },
    "Mystères en Ville": { seasons: 5, episodesPerSeason: 12 },
    "Saga Familiale": { seasons: 8, episodesPerSeason: 16 }
  };

  const DIVERTISSEMENT_CATALOG = {
    "Soirée Stand-Up": { seasons: 6, episodesPerSeason: 12 },
    "Le Grand Défi Live": { seasons: 8, episodesPerSeason: 10 },
    "Famille en Jeu": { seasons: 5, episodesPerSeason: 16 },
    "Quiz Arena": { seasons: 7, episodesPerSeason: 20 },
    "Prime Spectacle": { seasons: 10, episodesPerSeason: 8 },
    "Comedy Factory": { seasons: 4, episodesPerSeason: 14 },
    "Talent Avenue": { seasons: 9, episodesPerSeason: 12 },
    "Blind Test XXL": { seasons: 6, episodesPerSeason: 18 }
  };

  const EPISODIC_CATEGORY_IDS = new Set(["series", "divertissement", "magazines", "jeunesse", "realite"]);

  const CATEGORY_DURATION_OPTIONS = {
    information: [5, 15, 30, 45, 60],
    divertissement: [45, 60, 90, 120],
    films: [90, 120],
    series: [30, 45, 60],
    magazines: [30, 45, 60, 90, 120],
    jeunesse: [15, 30, 45, 60],
    documentaires: [45, 60, 90, 120],
    realite: [45, 60, 90, 120],
    culture: [30, 45, 60, 90]
  };

  const CATEGORY_INDEX = new Map();
  const PROGRAM_INDEX = new Map();

  function rebuildCategoryAndProgramIndexes() {
    CATEGORY_INDEX.clear();
    PROGRAM_INDEX.clear();
    PROGRAM_CATEGORIES.forEach((category) => {
      CATEGORY_INDEX.set(category.id, category);
      category.programs.forEach((title) => {
        PROGRAM_INDEX.set(title, category);
      });
    });
  }

  function injectCatalogProgramsFromCatalog() {
    if (!catalog || typeof catalog.getFullCategoriesForCurrentSession !== "function") return;
    const categories = catalog.getFullCategoriesForCurrentSession();
    if (!Array.isArray(categories)) return;
    categories.forEach((remoteCategory) => {
      if (!remoteCategory || !remoteCategory.id || !Array.isArray(remoteCategory.programs)) return;
      const localCategory = PROGRAM_CATEGORIES.find((category) => category.id === remoteCategory.id);
      if (!localCategory) return;
      remoteCategory.programs.forEach((title) => {
        if (typeof title !== "string" || !title.trim()) return;
        if (!localCategory.programs.includes(title)) {
          localCategory.programs.push(title);
        }
      });
    });
  }

  function injectOwnedProgramsFromCatalog() {
    if (!catalog || typeof catalog.getAvailableCategoriesForCurrentSession !== "function") return;
    const categories = catalog.getAvailableCategoriesForCurrentSession();
    if (!Array.isArray(categories)) return;
    const fallbackCategory = PROGRAM_CATEGORIES.find((category) => category.id === "films");
    categories.forEach((ownedCategory) => {
      if (!ownedCategory || !Array.isArray(ownedCategory.programs)) return;
      const localCategory = PROGRAM_CATEGORIES.find((category) => category.id === ownedCategory.id) || fallbackCategory;
      if (!localCategory) return;
      ownedCategory.programs.forEach((title) => {
        if (typeof title !== "string" || !title.trim()) return;
        if (!localCategory.programs.includes(title)) {
          localCategory.programs.push(title);
        }
      });
    });
  }

  injectCatalogProgramsFromCatalog();
  injectOwnedProgramsFromCatalog();

  PROGRAM_CATEGORIES.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "fr", { sensitivity: "base" }));
  rebuildCategoryAndProgramIndexes();

  function hashString(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  function isEpisodicCategory(categoryId) {
    if (diffusionRules && typeof diffusionRules.isEpisodicCategory === "function") {
      return diffusionRules.isEpisodicCategory(categoryId);
    }
    return EPISODIC_CATEGORY_IDS.has(categoryId);
  }

  function getEpisodicMeta(categoryId, title, dateKey) {
    if (!title || !isEpisodicCategory(categoryId)) return null;
    if (catalog && typeof catalog.getProgramMeta === "function") {
      const meta = catalog.getProgramMeta(title);
      if (
        meta
        && meta.categoryId === categoryId
        && Number(meta.seasons) > 0
        && Number(meta.episodesPerSeason) > 0
      ) {
        const enriched = {
          seasons: Number(meta.seasons),
          episodesPerSeason: Number(meta.episodesPerSeason)
        };
        if (catalog && typeof catalog.getProgramEpisodeAvailabilityForDateForCurrentSession === "function") {
          const availability = catalog.getProgramEpisodeAvailabilityForDateForCurrentSession(title, dateKey || "");
          if (availability && Number(availability.seasons) > 0 && Number(availability.episodesPerSeason) > 0) {
            enriched.seasons = Number(availability.seasons);
            enriched.episodesPerSeason = Number(availability.episodesPerSeason);
            enriched.availableEpisodes = new Set(
              (availability.availableEpisodes || []).map((item) => `S${Number(item.season) || 1}E${Number(item.episode) || 1}`)
            );
            enriched.availableBySeason = availability.availableBySeason || {};
          }
        }
        return enriched;
      }
    }
    if (categoryId === "series") return SERIES_CATALOG[title] || null;
    if (categoryId === "divertissement") return DIVERTISSEMENT_CATALOG[title] || null;
    return null;
  }

  function getProgramDuration(title, categoryId) {
    if (catalog && typeof catalog.getProgramMeta === "function") {
      const meta = catalog.getProgramMeta(title);
      if (meta && Number(meta.duration) > 0) return Number(meta.duration);
    }
    const options = CATEGORY_DURATION_OPTIONS[categoryId] || [60];
    return options[hashString(`${categoryId}:${title}:duration`) % options.length];
  }

  function playerId() {
    return session.email || session.username || "player";
  }

  function dateStorageKey() {
    return `${DATE_GRID_KEY_PREFIX}${playerId()}`;
  }

  function gridPublicationStorageKey() {
    return `${GRID_PUBLICATION_KEY_PREFIX}${playerId()}`;
  }

  function readGridPublicationMap() {
    try {
      const raw = localStorage.getItem(gridPublicationStorageKey());
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function normalizeText(value) {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  function capitalize(value) {
    if (!value) return "";
    return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
  }

  function createEmptyEntry(manualEmpty) {
    return {
      title: "",
      categoryId: "",
      productionMode: null,
      subtype: "",
      season: null,
      episode: null,
      fixedStartMinute: null,
      manualEmpty: Boolean(manualEmpty)
    };
  }

  function normalizeFixedStartMinute(value) {
    if (value === null || value === undefined || value === "") return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.max(0, Math.min((24 * 60) - 1, Math.floor(numeric)));
  }

  function cloneEntry(entry) {
    return {
      title: entry.title || "",
      categoryId: entry.categoryId || "",
      productionMode: entry.productionMode || null,
      subtype: entry.subtype || "",
      season: entry.season || null,
      episode: entry.episode || null,
      fixedStartMinute: normalizeFixedStartMinute(entry.fixedStartMinute),
      manualEmpty: Boolean(entry.manualEmpty)
    };
  }

  function normalizeEntry(raw) {
    if (!raw) return createEmptyEntry();
    if (typeof raw === "string") {
      const category = PROGRAM_INDEX.get(raw);
      const categoryId = category ? category.id : "";
      return {
        title: raw,
        categoryId,
        productionMode: null,
        subtype: "",
        season: isEpisodicCategory(categoryId) ? 1 : null,
        episode: isEpisodicCategory(categoryId) ? 1 : null,
        fixedStartMinute: null,
        manualEmpty: false
      };
    }

    const title = typeof raw.title === "string" ? raw.title : "";
    if (!title) return createEmptyEntry();

    const inferred = PROGRAM_INDEX.get(title);
    const categoryId = CATEGORY_INDEX.has(raw.categoryId) ? raw.categoryId : (inferred ? inferred.id : "");
    const isEpisodic = isEpisodicCategory(categoryId);
    const episodicMeta = isEpisodic ? getEpisodicMeta(categoryId, title) : null;
    const season = isEpisodic ? Math.max(1, Math.min(episodicMeta ? episodicMeta.seasons : 1, Number(raw.season) || 1)) : null;
    const episode = isEpisodic ? Math.max(1, Math.min(episodicMeta ? episodicMeta.episodesPerSeason : 1, Number(raw.episode) || 1)) : null;

    return {
      title,
      categoryId,
      productionMode: String(raw.productionMode || "").trim().toLowerCase() === "recorded"
        ? "recorded"
        : (String(raw.productionMode || "").trim().toLowerCase() === "direct" ? "direct" : null),
      subtype: String(raw.subtype || ""),
      season,
      episode,
      fixedStartMinute: normalizeFixedStartMinute(raw.fixedStartMinute),
      manualEmpty: Boolean(raw.manualEmpty)
    };
  }

  function getEntryDuration(entry) {
    if (!entry.title) return 0;
    return getProgramDuration(entry.title, entry.categoryId);
  }

  function isFixedEntry(entry) {
    if (!entry || !entry.title) return false;
    const fixed = normalizeFixedStartMinute(entry.fixedStartMinute);
    return Number.isFinite(fixed) && fixed >= SEGMENT.start;
  }

  function getInsertIndexForNewRow(dayData) {
    const entries = Array.isArray(dayData && dayData.day) ? dayData.day : [];
    let cursor = SEGMENT.start;
    for (let index = 0; index < entries.length; index += 1) {
      const normalized = normalizeEntry(entries[index]);
      const fixedStart = Number(normalized.fixedStartMinute);
      if (Number.isFinite(fixedStart) && fixedStart > cursor && fixedStart < SEGMENT.end) {
        return index;
      }
      const duration = getEntryDuration(normalized);
      cursor += duration;
      if (cursor >= SEGMENT.end) break;
    }
    return entries.length;
  }

  function removeEmptyEntriesBeforeFixed(dayData) {
    const entries = Array.isArray(dayData && dayData.day) ? dayData.day.slice() : [];
    const keep = new Array(entries.length).fill(true);
    let hasFixedAhead = false;

    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const normalized = normalizeEntry(entries[i]);
      if (normalized.title && isFixedEntry(normalized)) {
        hasFixedAhead = true;
        continue;
      }
      if (!normalized.title && hasFixedAhead) {
        if (!normalized.manualEmpty) {
          keep[i] = false;
        }
      }
    }

    dayData.day = entries.filter((_, index) => keep[index]);
  }

  function checkFixedProgramsIntegrity(entries) {
    const list = Array.isArray(entries) ? entries.map((entry) => normalizeEntry(entry)) : [];
    let cursor = SEGMENT.start;
    for (let i = 0; i < list.length; i += 1) {
      const entry = list[i];
      if (!entry || !entry.title) continue;
      const fixedStart = normalizeFixedStartMinute(entry.fixedStartMinute);
      if (Number.isFinite(fixedStart) && fixedStart >= SEGMENT.start) {
        if (cursor > fixedStart) {
          return {
            ok: false,
            blockedBy: entry.title,
            blockedAtMinute: fixedStart
          };
        }
        cursor = fixedStart;
      }
      cursor += getEntryDuration(entry);
      if (cursor >= SEGMENT.end) {
        cursor = SEGMENT.end;
      }
    }
    return { ok: true };
  }

  function tryApplyDayMutation(dayData, mutateFn, onSuccessMessage) {
    const snapshot = Array.isArray(dayData.day) ? dayData.day.map((entry) => normalizeEntry(entry)) : [];
    mutateFn();
    const check = checkFixedProgramsIntegrity(dayData.day);
    if (!check.ok) {
      dayData.day = snapshot;
      const blockedAt = formatMinute(check.blockedAtMinute || SEGMENT.start);
      setPlannerFeedback(`Impossible: ce programme décale un créneau verrouillé (${check.blockedBy} à ${blockedAt}).`, "error");
      return false;
    }
    if (onSuccessMessage) {
      setPlannerFeedback(onSuccessMessage, "success");
    }
    return true;
  }

  function createEmptyDay() {
    return { day: [] };
  }

  function normalizeDay(dayRaw) {
    if (!dayRaw) return createEmptyDay();

    if (Array.isArray(dayRaw.day)) {
      return { day: dayRaw.day.map(normalizeEntry) };
    }

    if (Array.isArray(dayRaw)) {
      return { day: dayRaw.map(normalizeEntry) };
    }

    if (Array.isArray(dayRaw.before) || Array.isArray(dayRaw.after)) {
      const before = Array.isArray(dayRaw.before) ? dayRaw.before : [];
      const after = Array.isArray(dayRaw.after) ? dayRaw.after : [];
      return { day: [...before.map(normalizeEntry), ...after.map(normalizeEntry)] };
    }

    const migrated = [];
    const slotKeys = Object.keys(dayRaw).filter((key) => key.startsWith("slot_"));
    slotKeys.sort((a, b) => {
      const av = a === "slot_00" ? 24 : Number(a.slice(5));
      const bv = b === "slot_00" ? 24 : Number(b.slice(5));
      return av - bv;
    });
    slotKeys.forEach((slotKey) => {
      const entry = normalizeEntry(dayRaw[slotKey]);
      if (entry.title) migrated.push(entry);
    });
    return { day: migrated };
  }

  function getMidnight(date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  function addDays(date, offset) {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + offset);
    return copy;
  }

  function toDateKey(date) {
    return sessionUtils.toDateKey(date);
  }

  function fromDateKey(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  }

  function getDayKeyFromDate(date) {
    return DAY_NAMES[date.getDay()];
  }

  function formatDateLong(date) {
    const parts = new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long"
    }).formatToParts(date);
    const weekday = (parts.find((part) => part.type === "weekday") || { value: "" }).value;
    const day = (parts.find((part) => part.type === "day") || { value: "" }).value;
    const month = (parts.find((part) => part.type === "month") || { value: "" }).value;
    return `${capitalize(weekday)} ${day} ${capitalize(month)}`.trim();
  }

  function formatDateTab(date) {
    const parts = new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "short"
    }).formatToParts(date);
    const weekday = (parts.find((part) => part.type === "weekday") || { value: "" }).value;
    const day = (parts.find((part) => part.type === "day") || { value: "" }).value;
    const month = (parts.find((part) => part.type === "month") || { value: "" }).value.replace(".", "");
    return { weekday: capitalize(weekday), date: `${day} ${capitalize(month)}` };
  }

  function formatMinute(total) {
    const hour = Math.floor(total / 60) % 24;
    const minute = total % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  function formatEuro(value) {
    return sessionUtils.formatEuro(Number(value) || 0);
  }

  function getTimeline() {
    const today = getMidnight(new Date());
    const items = [];
    for (let offset = -1; offset <= PLANNING_DAYS_AHEAD; offset += 1) {
      const date = addDays(today, offset);
      const key = toDateKey(date);
      items.push({
        key,
        date,
        dayKey: getDayKeyFromDate(date),
        isYesterday: offset === -1,
        isToday: offset === 0,
        isEditable: offset >= 0
      });
    }
    return items;
  }

  function readDateGrid(timeline) {
    const rawDateGrid = localStorage.getItem(dateStorageKey());
    if (rawDateGrid) {
      try {
        const parsed = JSON.parse(rawDateGrid);
        const normalized = {};
        timeline.forEach((item) => {
          normalized[item.key] = normalizeDay(parsed ? parsed[item.key] : null);
        });
        return normalized;
      } catch {
        // Fallback below.
      }
    }
    const empty = {};
    timeline.forEach((item) => {
      empty[item.key] = createEmptyDay();
    });
    localStorage.setItem(dateStorageKey(), JSON.stringify(empty));
    return empty;
  }

  function saveDateGrid() {
    localStorage.setItem(dateStorageKey(), JSON.stringify(state.dateGrid));
  }

  const state = {
    timeline: getTimeline(),
    selectedDateKey: null,
    tabStartIndex: 0,
    dateGrid: {},
    searchTerm: "",
    filters: {
      duration: "all",
      stars: "all",
      ageRating: "all",
      diffusionStatus: "all"
    },
    filtersCollapsed: true,
    collapsedCategories: PROGRAM_CATEGORIES.reduce((acc, category) => {
      acc[category.id] = true;
      return acc;
    }, {})
  };

  state.dateGrid = readDateGrid(state.timeline);
  const todayItem = state.timeline.find((item) => item.isToday) || state.timeline[0];
  state.selectedDateKey = todayItem ? todayItem.key : state.timeline[0].key;

  function reloadPlannerStateFromStorage() {
    const previousSelected = state.selectedDateKey;
    state.timeline = getTimeline();
    state.dateGrid = readDateGrid(state.timeline);
    const stillExists = state.timeline.some((item) => item.key === previousSelected);
    if (stillExists) {
      state.selectedDateKey = previousSelected;
    } else {
      const currentToday = state.timeline.find((item) => item.isToday) || state.timeline[0];
      state.selectedDateKey = currentToday ? currentToday.key : state.timeline[0].key;
    }
    const selectedIndex = dateIndex(state.selectedDateKey);
    state.tabStartIndex = Math.max(0, Math.min(selectedIndex, Math.max(0, state.timeline.length - TABS_WINDOW_SIZE)));
  }

  function setPlannerFeedback(message, type) {
    const feedback = document.getElementById("plannerFeedback");
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = `feedback ${type}`;
  }

  function getSelectedTimelineItem() {
    return state.timeline.find((item) => item.key === state.selectedDateKey) || null;
  }

  function getSelectedDayData() {
    state.dateGrid[state.selectedDateKey] = normalizeDay(state.dateGrid[state.selectedDateKey]);
    return state.dateGrid[state.selectedDateKey];
  }

  function isDatePublished(dateKey) {
    if (!finance || typeof finance.isGridPublished !== "function") return false;
    return finance.isGridPublished(session, dateKey);
  }

  function isSelectedDayEditable() {
    const item = getSelectedTimelineItem();
    if (!item || !item.isEditable) return false;
    return !isDatePublished(item.key);
  }

  function computeDayConsumedMinutes(dayData) {
    const entries = Array.isArray(dayData && dayData.day) ? dayData.day : [];
    return entries.reduce((sum, entry) => sum + getEntryDuration(normalizeEntry(entry)), 0);
  }

  function computeDayTotalCost(dateKey, dayData, diffusionMap) {
    if (!finance || typeof finance.estimateProgramCost !== "function") return 0;
    let totalCost = 0;
    const entries = Array.isArray(dayData && dayData.day) ? dayData.day : [];
    entries.forEach((rawEntry, index) => {
      const entry = normalizeEntry(rawEntry);
      if (!entry || !entry.title) return;
      const status = diffusionMap[`${dateKey}:day:${index}`] || "inedit";
      totalCost += Number(finance.estimateProgramCost(entry, status, session)) || 0;
    });
    return Math.max(0, Math.round(totalCost));
  }

  function dateIndex(dateKey) {
    return Math.max(0, state.timeline.findIndex((item) => item.key === dateKey));
  }

  function getDiffusionByEntry() {
    const map = {};
    const seen = new Set();
    state.timeline
      .slice()
      .sort((a, b) => (a.key < b.key ? -1 : 1))
      .forEach((item) => {
        const dayEntries = normalizeDay(state.dateGrid[item.key]).day;
        dayEntries.forEach((entry, index) => {
          if (!entry.title) {
            map[`${item.key}:day:${index}`] = null;
            return;
          }
          const status = diffusionRules && typeof diffusionRules.resolveStatus === "function"
            ? diffusionRules.resolveStatus(entry, seen)
            : (() => {
              if (entry.categoryId === "information") return "inedit";
              const key = isEpisodicCategory(entry.categoryId)
                ? `${entry.title}::S${entry.season || 1}E${entry.episode || 1}`
                : entry.title;
              const localStatus = seen.has(key) ? "rediffusion" : "inedit";
              seen.add(key);
              return localStatus;
            })();
          map[`${item.key}:day:${index}`] = status;
        });
      });
    return map;
  }

  function collectUsedEpisodes(categoryId, title, omitDateKey, omitIndex) {
    const used = new Set();
    state.timeline
      .slice()
      .sort((a, b) => (a.key < b.key ? -1 : 1))
      .forEach((item) => {
        const entries = normalizeDay(state.dateGrid[item.key]).day;
        entries.forEach((entry, index) => {
          if (!entry || entry.categoryId !== categoryId || entry.title !== title) return;
          if (omitDateKey === item.key && omitIndex === index) return;
          used.add(`S${entry.season || 1}E${entry.episode || 1}`);
        });
      });
    return used;
  }

  function collectUsedEpisodesExcludingDate(categoryId, title, excludedDateKey) {
    const used = new Set();
    state.timeline
      .slice()
      .sort((a, b) => (a.key < b.key ? -1 : 1))
      .forEach((item) => {
        if (item.key === excludedDateKey) return;
        const entries = normalizeDay(state.dateGrid[item.key]).day;
        entries.forEach((entry) => {
          if (!entry || entry.categoryId !== categoryId || entry.title !== title) return;
          used.add(`S${entry.season || 1}E${entry.episode || 1}`);
        });
      });
    return used;
  }

  function isEpisodeAvailable(meta, season, episode) {
    if (!meta || !meta.availableEpisodes || !(meta.availableEpisodes instanceof Set)) return true;
    return meta.availableEpisodes.has(`S${season}E${episode}`);
  }

  function getNextUndiffusedEpisodeFromUsed(categoryId, title, usedSet, dateKey) {
    const meta = getEpisodicMeta(categoryId, title, dateKey) || { seasons: 1, episodesPerSeason: 1 };
    for (let season = 1; season <= meta.seasons; season += 1) {
      for (let episode = 1; episode <= meta.episodesPerSeason; episode += 1) {
        const key = `S${season}E${episode}`;
        if (!isEpisodeAvailable(meta, season, episode)) continue;
        if (!usedSet.has(key)) return { season, episode, key };
      }
    }
    return null;
  }

  function buildCopiedDayWithFreshEpisodes(sourceEntries, targetDateKey) {
    const episodicUsedMap = new Map();
    return sourceEntries.map((entryRaw) => {
      const entry = normalizeEntry(entryRaw);
      if (!entry.title || !isEpisodicCategory(entry.categoryId)) return cloneEntry(entry);

      const mapKey = `${entry.categoryId}::${entry.title}`;
      let usedSet = episodicUsedMap.get(mapKey);
      if (!usedSet) {
        usedSet = collectUsedEpisodesExcludingDate(entry.categoryId, entry.title, targetDateKey);
        episodicUsedMap.set(mapKey, usedSet);
      }

      const next = getNextUndiffusedEpisodeFromUsed(entry.categoryId, entry.title, usedSet, targetDateKey);
      if (!next) {
        return cloneEntry(entry);
      }
      usedSet.add(next.key);
      return normalizeEntry({
        title: entry.title,
        categoryId: entry.categoryId,
        season: next.season,
        episode: next.episode
      });
    });
  }

  function mergeCopiedEntriesWithTargetFixed(copiedEntries, targetFixedEntries) {
    const queue = (Array.isArray(copiedEntries) ? copiedEntries : [])
      .map((entry) => normalizeEntry(entry))
      .filter((entry) => entry.title && !isFixedEntry(entry));
    const fixed = (Array.isArray(targetFixedEntries) ? targetFixedEntries : [])
      .map((entry) => normalizeEntry(entry))
      .filter((entry) => entry.title && isFixedEntry(entry))
      .sort((a, b) => Number(a.fixedStartMinute || 0) - Number(b.fixedStartMinute || 0));

    const result = [];
    let cursor = SEGMENT.start;

    fixed.forEach((lockedEntry) => {
      const lockStart = normalizeFixedStartMinute(lockedEntry.fixedStartMinute);
      if (!Number.isFinite(lockStart)) return;

      while (queue.length > 0) {
        const candidate = queue[0];
        const duration = getEntryDuration(candidate);
        if (!duration) {
          queue.shift();
          continue;
        }
        if ((cursor + duration) > lockStart) break;
        result.push(queue.shift());
        cursor += duration;
        if (cursor >= SEGMENT.end) break;
      }

      if (cursor < lockStart) cursor = lockStart;
      if (cursor >= SEGMENT.end) return;

      result.push(lockedEntry);
      cursor += getEntryDuration(lockedEntry);
      if (cursor > SEGMENT.end) cursor = SEGMENT.end;
    });

    while (queue.length > 0 && cursor < SEGMENT.end) {
      const candidate = queue.shift();
      const duration = getEntryDuration(candidate);
      if (!candidate || !candidate.title || !duration) continue;
      result.push(candidate);
      cursor += duration;
    }

    return result;
  }

  function fixedEntryKey(entry) {
    const normalized = normalizeEntry(entry);
    return [
      String(normalized.studioScheduleId || ""),
      String(normalized.title || ""),
      String(normalized.categoryId || ""),
      String(normalizeFixedStartMinute(normalized.fixedStartMinute))
    ].join("::");
  }

  function preservesTargetFixedEntries(targetFixedEntries, mergedEntries) {
    const targetKeys = (Array.isArray(targetFixedEntries) ? targetFixedEntries : [])
      .map((entry) => normalizeEntry(entry))
      .filter((entry) => entry.title && isFixedEntry(entry))
      .map((entry) => fixedEntryKey(entry));
    if (targetKeys.length === 0) return true;
    const mergedSet = new Set(
      (Array.isArray(mergedEntries) ? mergedEntries : [])
        .map((entry) => normalizeEntry(entry))
        .filter((entry) => entry.title && isFixedEntry(entry))
        .map((entry) => fixedEntryKey(entry))
    );
    return targetKeys.every((key) => mergedSet.has(key));
  }

  function getFirstUndiffusedEpisode(categoryId, title, omitDateKey, omitIndex, targetDateKey) {
    const meta = getEpisodicMeta(categoryId, title, targetDateKey) || { seasons: 1, episodesPerSeason: 1 };
    const used = collectUsedEpisodes(categoryId, title, omitDateKey, omitIndex);
    for (let season = 1; season <= meta.seasons; season += 1) {
      for (let episode = 1; episode <= meta.episodesPerSeason; episode += 1) {
        const key = `S${season}E${episode}`;
        if (!isEpisodeAvailable(meta, season, episode)) continue;
        if (!used.has(key)) return { season, episode };
      }
    }
    return null;
  }

  function getFallbackRediffusionEpisode(categoryId, title, targetDateKey) {
    const meta = getEpisodicMeta(categoryId, title, targetDateKey) || { seasons: 1, episodesPerSeason: 1 };
    if (isEpisodeAvailable(meta, 1, 1)) {
      return { season: 1, episode: 1 };
    }
    for (let season = 1; season <= meta.seasons; season += 1) {
      for (let episode = 1; episode <= meta.episodesPerSeason; episode += 1) {
        if (isEpisodeAvailable(meta, season, episode)) {
          return { season, episode };
        }
      }
    }
    return null;
  }

  function createEntryFromPayload(payload, indexToReplace) {
    if (isEpisodicCategory(payload.categoryId)) {
      const next = getFirstUndiffusedEpisode(
        payload.categoryId,
        payload.title,
        state.selectedDateKey,
        indexToReplace,
        state.selectedDateKey
      ) || getFallbackRediffusionEpisode(payload.categoryId, payload.title, state.selectedDateKey);
      if (!next) return null;
      return normalizeEntry({
        title: payload.title,
        categoryId: payload.categoryId,
        productionMode: payload.productionMode || null,
        subtype: payload.subtype || "",
        season: next.season,
        episode: next.episode
      });
    }
    return normalizeEntry({
      title: payload.title,
      categoryId: payload.categoryId,
      productionMode: payload.productionMode || null,
      subtype: payload.subtype || "",
      season: null,
      episode: null
    });
  }

  function renderDateTabs() {
    const tabs = document.getElementById("dayTabs");
    const prevBtn = document.getElementById("prevDatesBtn");
    const nextBtn = document.getElementById("nextDatesBtn");
    if (!tabs) return;

    const maxStart = Math.max(0, state.timeline.length - TABS_WINDOW_SIZE);
    state.tabStartIndex = Math.max(0, Math.min(maxStart, state.tabStartIndex));

    const visible = state.timeline.slice(state.tabStartIndex, state.tabStartIndex + TABS_WINDOW_SIZE);
    const buttons = visible.map((item) => {
      const tabLabel = formatDateTab(item.date);
      const published = isDatePublished(item.key);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `day-tab ${item.key === state.selectedDateKey ? "active" : ""} ${item.isToday ? "today" : ""} ${item.isYesterday ? "yesterday" : ""} ${published ? "published" : ""}`.trim();

      const line1 = document.createElement("span");
      line1.className = "day-tab-weekday";
      line1.textContent = tabLabel.weekday;
      const line2 = document.createElement("span");
      line2.className = "day-tab-date";
      line2.textContent = tabLabel.date;
      button.append(line1, line2);

      if (item.isToday || item.isYesterday) {
        const badge = document.createElement("span");
        badge.className = "day-tab-badge";
        badge.textContent = item.isToday ? "Aujourd'hui" : "Hier";
        button.appendChild(badge);
      }

      if (published) {
        const badge = document.createElement("span");
        badge.className = "day-tab-badge day-tab-published";
        badge.textContent = "Publiée";
        button.appendChild(badge);
      }

      button.addEventListener("click", () => {
        state.selectedDateKey = item.key;
        renderDateTabs();
        renderTargetDaySelect();
        renderDaySchedule();
      });
      return button;
    });

    tabs.replaceChildren(...buttons);

    if (prevBtn) prevBtn.disabled = state.tabStartIndex <= 0;
    if (nextBtn) nextBtn.disabled = state.tabStartIndex >= maxStart;
  }

  function renderTargetDaySelect() {
    const targetSelect = document.getElementById("targetDaySelect");
    if (!targetSelect) return;

    const editableTargets = state.timeline.filter((item) => (
      item.isEditable
      && item.key !== state.selectedDateKey
      && !isDatePublished(item.key)
    ));
    if (editableTargets.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Aucun jour disponible";
      targetSelect.replaceChildren(option);
      targetSelect.disabled = true;
      return;
    }

    const options = editableTargets.map((item) => {
      const option = document.createElement("option");
      option.value = item.key;
      option.textContent = formatDateLong(item.date);
      return option;
    });

    targetSelect.disabled = false;
    targetSelect.replaceChildren(...options);
  }

  function addProgramFromLibraryToDay(payload) {
    if (!payload || !payload.title || !payload.categoryId) return;
    if (!isSelectedDayEditable()) {
      setPlannerFeedback("Programmation impossible: journée non modifiable ou déjà publiée.", "error");
      return;
    }

    const dayData = getSelectedDayData();
    const firstEmptyIndex = dayData.day.findIndex((entry) => !normalizeEntry(entry).title);
    if (firstEmptyIndex >= 0) {
      const createdEntry = createEntryFromPayload(payload, firstEmptyIndex);
      if (!createdEntry) {
        setPlannerFeedback("Aucun épisode disponible à cette date pour ce programme.", "error");
        return;
      }
      const ok = tryApplyDayMutation(
        dayData,
        () => {
          dayData.day[firstEmptyIndex] = createdEntry;
        },
        `Programme ajouté à la première case vide (${firstEmptyIndex + 1}).`
      );
      if (ok) renderDaySchedule();
      return;
    }

    const createdEntry = createEntryFromPayload(payload);
    if (!createdEntry) {
      setPlannerFeedback("Aucun épisode disponible à cette date pour ce programme.", "error");
      return;
    }
    const ok = tryApplyDayMutation(
      dayData,
      () => {
        dayData.day.push(createdEntry);
      },
      "Aucune case vide : programme ajouté en fin de journée."
    );
    if (ok) renderDaySchedule();
  }

  function normalizeStarsCount(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0.5;
    const rounded = Math.round(numeric * 2) / 2;
    return Math.max(0.5, Math.min(5, rounded));
  }

  function createFilmStarsBadge(starsValue) {
    const stars = normalizeStarsCount(starsValue);
    const badge = document.createElement("span");
    badge.className = "film-class-badge stars";
    const fullCount = Math.floor(stars);
    const hasHalf = (stars - fullCount) >= 0.5;
    const emptyCount = Math.max(0, 5 - fullCount - (hasHalf ? 1 : 0));

    if (fullCount > 0) {
      const filled = document.createElement("span");
      filled.className = "stars-filled";
      filled.textContent = "★".repeat(fullCount);
      badge.appendChild(filled);
    }

    if (hasHalf) {
      const half = document.createElement("span");
      half.className = "stars-half";
      half.textContent = "★";
      badge.appendChild(half);
    }

    if (emptyCount > 0) {
      const empty = document.createElement("span");
      empty.className = "stars-empty";
      empty.textContent = "★".repeat(emptyCount);
      badge.appendChild(empty);
    }
    return badge;
  }

  function ageRatingToken(value) {
    if (value === "TP") return "tp";
    if (value === "-10") return "m10";
    if (value === "-12") return "m12";
    if (value === "-16") return "m16";
    if (value === "-18") return "m18";
    return "default";
  }

  function createLibraryCard(programTitle, category) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `library-card ${category.colorClass}`;
    card.draggable = true;

    const title = document.createElement("span");
    title.textContent = programTitle;
    const right = document.createElement("span");
    right.className = "program-meta-right";

    const duration = document.createElement("span");
    duration.className = "program-duration";
    duration.textContent = `${getProgramDuration(programTitle, category.id)} min`;
    right.appendChild(duration);

    let meta = null;
    if (catalog && typeof catalog.getProgramMeta === "function") {
      meta = catalog.getProgramMeta(programTitle);
      if (meta && Number(meta.stars) > 0) {
        right.appendChild(createFilmStarsBadge(meta.stars));
      }
      if (meta && meta.ageRating) {
        const age = document.createElement("span");
        age.className = "film-class-badge age";
        age.textContent = meta.ageRating;
        age.dataset.ageRating = ageRatingToken(meta.ageRating);
        right.appendChild(age);
      }
      if (meta && Number(meta.diffusionCount) > 0) {
        const diffusion = document.createElement("span");
        diffusion.className = "program-diffusions";
        diffusion.textContent = `${meta.diffusionCount} diff.`;
        right.appendChild(diffusion);
        card.title = `${programTitle} • ${meta.diffusionCount} diffusion${meta.diffusionCount > 1 ? "s" : ""}`;
      } else {
        card.title = programTitle;
      }
    } else {
      card.title = programTitle;
    }

    card.append(title, right);
    card.addEventListener("dragstart", (event) => {
      if (!event.dataTransfer) return;
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData(
        "text/plain",
        JSON.stringify({
          kind: "program",
          title: programTitle,
          categoryId: category.id,
          productionMode: meta && typeof meta.productionMode === "string" ? meta.productionMode : "",
          subtype: meta && typeof meta.productionSubtype === "string" ? meta.productionSubtype : ""
        })
      );
    });
    card.addEventListener("dblclick", () => {
      addProgramFromLibraryToDay({
        kind: "program",
        title: programTitle,
        categoryId: category.id,
        productionMode: meta && typeof meta.productionMode === "string" ? meta.productionMode : "",
        subtype: meta && typeof meta.productionSubtype === "string" ? meta.productionSubtype : ""
      });
    });
    return card;
  }

  function createCategorySection(category, filteredPrograms, forceExpand) {
    const section = document.createElement("section");
    section.className = `program-category ${category.colorClass}`;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "category-toggle";
    const isCollapsed = forceExpand ? false : state.collapsedCategories[category.id];
    toggle.setAttribute("aria-expanded", String(!isCollapsed));
    toggle.innerHTML = `<span>${category.name}</span><span>${filteredPrograms.length}</span>`;
    toggle.addEventListener("click", () => {
      state.collapsedCategories[category.id] = !state.collapsedCategories[category.id];
      renderLibrary();
    });

    const content = document.createElement("div");
    content.className = `category-content ${isCollapsed ? "collapsed" : ""}`;
    if (!Array.isArray(filteredPrograms) || filteredPrograms.length === 0) {
      const empty = document.createElement("p");
      empty.className = "market-program-meta";
      empty.textContent = "Aucun programme disponible";
      content.replaceChildren(empty);
    } else {
      const cards = filteredPrograms.map((title) => createLibraryCard(title, category));
      content.replaceChildren(...cards);
    }

    section.append(toggle, content);
    return section;
  }

  function getProgramMetaForLibrary(title, categoryId) {
    if (catalog && typeof catalog.getProgramMeta === "function") {
      const meta = catalog.getProgramMeta(title);
      if (meta && typeof meta === "object") {
        return {
          duration: Number(meta.duration) > 0 ? Number(meta.duration) : getProgramDuration(title, categoryId),
          stars: normalizeStarsCount(meta.stars),
          ageRating: typeof meta.ageRating === "string" ? meta.ageRating : "",
          diffusionCount: Number(meta.diffusionCount) > 0 ? Number(meta.diffusionCount) : 0
        };
      }
    }
    return {
      duration: getProgramDuration(title, categoryId),
      stars: 0.5,
      ageRating: "",
      diffusionCount: 0
    };
  }

  function matchesLibraryFilters(title, categoryId) {
    const meta = getProgramMetaForLibrary(title, categoryId);
    if (state.filters.duration !== "all" && meta.duration !== Number(state.filters.duration)) {
      return false;
    }

    const starsFilter = state.filters.stars;
    if (starsFilter !== "all" && meta.stars !== Number(starsFilter)) {
      return false;
    }

    const ageFilter = state.filters.ageRating;
    if (ageFilter !== "all" && meta.ageRating !== ageFilter) {
      return false;
    }

    const statusFilter = state.filters.diffusionStatus;
    if (statusFilter !== "all") {
      const computedStatus = categoryId === "information"
        ? "inedit"
        : (Number(meta.diffusionCount) > 0 ? "rediffusion" : "inedit");
      if (computedStatus !== statusFilter) return false;
    }

    return true;
  }

  function syncFilterButtons() {
    const ageContainer = document.getElementById("ageRatingFilters");
    if (ageContainer) {
      const buttons = ageContainer.querySelectorAll(".filter-chip[data-age-rating]");
      buttons.forEach((button) => {
        button.classList.toggle("active", button.dataset.ageRating === state.filters.ageRating);
      });
    }

    const starsContainer = document.getElementById("starsFilters");
    if (starsContainer) {
      const buttons = starsContainer.querySelectorAll(".filter-chip[data-stars]");
      buttons.forEach((button) => {
        button.classList.toggle("active", button.dataset.stars === state.filters.stars);
      });
    }

    const diffusionContainer = document.getElementById("diffusionStatusFilters");
    if (diffusionContainer) {
      const buttons = diffusionContainer.querySelectorAll(".filter-chip[data-diffusion-status]");
      buttons.forEach((button) => {
        button.classList.toggle("active", button.dataset.diffusionStatus === state.filters.diffusionStatus);
      });
    }

    const durationContainer = document.getElementById("durationFilters");
    if (durationContainer) {
      const buttons = durationContainer.querySelectorAll(".filter-chip[data-duration]");
      buttons.forEach((button) => {
        button.classList.toggle("active", button.dataset.duration === state.filters.duration);
      });
    }
  }

  function syncFiltersCollapseUi() {
    const body = document.getElementById("libraryFiltersBody");
    if (body) {
      body.classList.toggle("collapsed", state.filtersCollapsed);
    }
    const toggleBtn = document.getElementById("toggleLibraryFiltersBtn");
    if (toggleBtn) {
      toggleBtn.textContent = state.filtersCollapsed ? "Afficher" : "Rétracter";
    }
  }

  function renderLibrary() {
    const library = document.getElementById("programLibrary");
    if (!library) return;

    injectCatalogProgramsFromCatalog();
    injectOwnedProgramsFromCatalog();
    rebuildCategoryAndProgramIndexes();

    let ownedSet = null;
    if (catalog && typeof catalog.getAvailableCategoriesForCurrentSession === "function") {
      const categories = catalog.getAvailableCategoriesForCurrentSession();
      ownedSet = new Set();
      categories.forEach((category) => {
        category.programs.forEach((title) => ownedSet.add(title));
      });
    }

    syncFilterButtons();
    syncFiltersCollapseUi();

    const normalizedTerm = normalizeText(state.searchTerm);
    const hasSearch = normalizedTerm.length > 0;
    const hasActiveFilters = (
      state.filters.duration !== "all"
      || state.filters.stars !== "all"
      || state.filters.ageRating !== "all"
      || state.filters.diffusionStatus !== "all"
    );
    const sections = [];

    PROGRAM_CATEGORIES.forEach((category) => {
      if (category.id === "information") return;
      const filteredPrograms = category.programs.filter((title) => {
        if (ownedSet && !ownedSet.has(title)) return false;
        if (!matchesLibraryFilters(title, category.id)) return false;
        if (!hasSearch) return true;
        return normalizeText(title).includes(normalizedTerm);
      });
      if (filteredPrograms.length === 0) return;
      sections.push(createCategorySection(category, filteredPrograms, hasSearch || hasActiveFilters));
    });

    if (sections.length === 0) {
      const emptyState = document.createElement("p");
      emptyState.className = "library-empty";
      emptyState.textContent = "Aucun programme ne correspond à ta recherche.";
      library.replaceChildren(emptyState);
      return;
    }

    library.replaceChildren(...sections);
  }

  function getSeriesMeta(entry, dateKey) {
    if (!entry || !entry.title || !isEpisodicCategory(entry.categoryId)) return null;
    return getEpisodicMeta(entry.categoryId, entry.title, dateKey);
  }

  function buildSeriesSelects(dayData, index, entry, editable) {
    const wrapper = document.createElement("div");
    wrapper.className = "series-fields";
    const meta = getSeriesMeta(entry, state.selectedDateKey);
    if (!meta) return wrapper;

    const availableBySeason = meta.availableBySeason && typeof meta.availableBySeason === "object"
      ? meta.availableBySeason
      : null;
    const availableSeasons = Array.from({ length: meta.seasons }, (_, idx) => idx + 1).filter((season) => {
      if (!availableBySeason) return true;
      return Number(availableBySeason[season]) > 0;
    });
    if (availableSeasons.length === 0) {
      const locked = document.createElement("span");
      locked.className = "series-label";
      locked.textContent = "Indispo";
      wrapper.append(locked);
      return wrapper;
    }

    const seasonSelect = document.createElement("select");
    seasonSelect.className = "series-input";
    seasonSelect.disabled = !editable;

    const initialSeason = availableSeasons.includes(entry.season || 1)
      ? (entry.season || 1)
      : availableSeasons[0];
    for (let value = 1; value <= meta.seasons; value += 1) {
      if (!availableSeasons.includes(value)) continue;
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = String(value);
      if (initialSeason === value) option.selected = true;
      seasonSelect.appendChild(option);
    }

    const episodeSelect = document.createElement("select");
    episodeSelect.className = "series-input";
    episodeSelect.disabled = !editable;
    const fillEpisodes = (season) => {
      const maxEpisode = availableBySeason
        ? Math.max(0, Number(availableBySeason[season]) || 0)
        : meta.episodesPerSeason;
      episodeSelect.replaceChildren();
      if (maxEpisode <= 0) return 0;
      const currentEpisode = Number(dayData.day[index].episode) || (entry.episode || 1);
      const selectedEpisode = Math.min(Math.max(1, currentEpisode), maxEpisode);
      for (let value = 1; value <= maxEpisode; value += 1) {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = String(value);
        if (selectedEpisode === value) option.selected = true;
        episodeSelect.appendChild(option);
      }
      dayData.day[index].season = Number(season);
      dayData.day[index].episode = selectedEpisode;
      return maxEpisode;
    };
    fillEpisodes(initialSeason);

    seasonSelect.addEventListener("change", () => {
      dayData.day[index].season = Number(seasonSelect.value);
      fillEpisodes(Number(seasonSelect.value));
      renderDaySchedule();
    });

    episodeSelect.addEventListener("change", () => {
      dayData.day[index].episode = Number(episodeSelect.value);
      renderDaySchedule();
    });

    const sLabel = document.createElement("span");
    sLabel.className = "series-label";
    sLabel.textContent = "S";
    const eLabel = document.createElement("span");
    eLabel.className = "series-label";
    eLabel.textContent = "E";

    wrapper.append(sLabel, seasonSelect, eLabel, episodeSelect);
    return wrapper;
  }

  function tryReadProgramPayload(event) {
    if (!event.dataTransfer) return null;
    try {
      const payload = JSON.parse(event.dataTransfer.getData("text/plain"));
      return payload && payload.kind === "program" ? payload : null;
    } catch {
      return null;
    }
  }

  function buildEntryRow(dayData, index, entry, cursorStart, diffusionMap, editable) {
    const row = document.createElement("div");
    row.className = "slot-row";

    const duration = getEntryDuration(entry);
    const nextMinute = cursorStart + duration;
    const overflow = nextMinute > SEGMENT.end;

    const timeCell = document.createElement("div");
    timeCell.className = "slot-time";
    timeCell.textContent = `${formatMinute(cursorStart)} - ${formatMinute(Math.min(nextMinute, SEGMENT.end))}`;
    if (overflow) timeCell.classList.add("overflow-time");

    const programCell = document.createElement("div");
    const category = CATEGORY_INDEX.get(entry.categoryId);
    programCell.className = `slot-program ${category ? category.colorClass : ""}`;
    if (!entry.title) {
      programCell.classList.add("empty-slot");
      programCell.textContent = "Aucun programme";
    } else {
      if (!editable) {
        programCell.classList.add("validated-slot");
      }
      const title = document.createElement("span");
      title.className = "slot-program-title";
      title.textContent = entry.title;
      programCell.appendChild(title);

      if (isEpisodicCategory(entry.categoryId)) {
        const episodeControls = document.createElement("span");
        episodeControls.className = "slot-program-episode";
        if (editable && !isFixedEntry(entry)) {
          episodeControls.appendChild(buildSeriesSelects(dayData, index, entry, editable));
        } else {
          episodeControls.textContent = `S${entry.season || 1}E${entry.episode || 1}`;
        }
        programCell.appendChild(episodeControls);
      }

      if (catalog && typeof catalog.getProgramMeta === "function") {
        const filmMeta = catalog.getProgramMeta(entry.title);
        const seasonStars = filmMeta && filmMeta.seasonStars && entry.season
          ? Number(filmMeta.seasonStars[String(entry.season)] || filmMeta.seasonStars[entry.season] || 0)
          : 0;
        const displayedStars = seasonStars > 0 ? seasonStars : Number(filmMeta && filmMeta.stars);
        if (filmMeta && (displayedStars > 0 || filmMeta.ageRating)) {
          const inlineMeta = document.createElement("span");
          inlineMeta.className = "slot-program-inline-meta";
          if (displayedStars > 0) inlineMeta.appendChild(createFilmStarsBadge(displayedStars));
          if (filmMeta.ageRating) {
            const age = document.createElement("span");
            age.className = "film-class-badge age";
            age.textContent = filmMeta.ageRating;
            age.dataset.ageRating = ageRatingToken(filmMeta.ageRating);
            inlineMeta.appendChild(age);
          }
          programCell.appendChild(inlineMeta);
        }
        if (filmMeta && Number(filmMeta.diffusionCount) > 0) {
          programCell.title = `${entry.title} • ${filmMeta.diffusionCount} diffusion${filmMeta.diffusionCount > 1 ? "s" : ""}`;
        } else {
          programCell.title = entry.title;
        }
      } else {
        programCell.title = entry.title;
      }
    }

    const lockedByStudio = isFixedEntry(entry);
    if (lockedByStudio) {
      programCell.classList.add("locked");
    }
    if (editable && !lockedByStudio) {
      programCell.addEventListener("dragover", (event) => {
        event.preventDefault();
        programCell.classList.add("drag-over");
      });
      programCell.addEventListener("dragleave", () => {
        programCell.classList.remove("drag-over");
      });
      programCell.addEventListener("drop", (event) => {
        event.preventDefault();
        programCell.classList.remove("drag-over");
        const payload = tryReadProgramPayload(event);
        if (!payload) return;
        const nextEntry = createEntryFromPayload(payload, index);
        if (!nextEntry) {
          setPlannerFeedback("Aucun épisode disponible à cette date pour ce programme.", "error");
          return;
        }
        if (Number.isFinite(Number(entry.fixedStartMinute))) {
          nextEntry.fixedStartMinute = Math.floor(Number(entry.fixedStartMinute));
        }
        const ok = tryApplyDayMutation(
          dayData,
          () => {
            dayData.day[index] = nextEntry;
          },
          `Créneau ${formatMinute(cursorStart)} mis à jour.`
        );
        if (ok) renderDaySchedule();
      });
    }

    const metaCell = document.createElement("div");
    metaCell.className = "slot-meta";
    const status = diffusionMap[`${state.selectedDateKey}:day:${index}`];
    if (entry.title) {
      const badge = document.createElement("span");
      badge.className = `status-badge ${status || "neutral"}`;
      badge.textContent = (diffusionRules && typeof diffusionRules.getStatusLabel === "function")
        ? diffusionRules.getStatusLabel(status, entry.categoryId, entry)
        : (DIFFUSION_LABELS[status] || "-");
      metaCell.appendChild(badge);

      if (finance && typeof finance.estimateProgramCost === "function") {
        const costBadge = document.createElement("span");
        costBadge.className = "program-cost-badge";
        const resolvedStatus = status || "inedit";
        const cost = finance.estimateProgramCost(entry, resolvedStatus, session);
        costBadge.textContent = formatEuro(cost);
        costBadge.title = "Coût journalier du créneau";
        metaCell.appendChild(costBadge);
      }
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "slot-meta-empty";
      placeholder.textContent = "-";
      metaCell.appendChild(placeholder);
    }

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = `clear-slot-btn ${editable ? "" : "hidden-clear"} ${lockedByStudio ? "secondary-btn" : ""}`.trim();
    clearButton.textContent = lockedByStudio ? "Verrouillé" : "Effacer";
    clearButton.disabled = !editable || lockedByStudio;
    clearButton.addEventListener("click", () => {
      if (lockedByStudio) {
        setPlannerFeedback("Ce programme est verrouillé car planifié depuis le studio.", "error");
        return;
      }
      if (dayData.day[index] && dayData.day[index].title) {
        dayData.day[index] = createEmptyEntry(true);
        setPlannerFeedback("Le programme a été vidé.", "success");
      } else {
        dayData.day.splice(index, 1);
        setPlannerFeedback("La ligne vide a été supprimée.", "success");
      }
      renderDaySchedule();
    });

    row.append(timeCell, programCell, metaCell, clearButton);
    return { row, end: nextMinute };
  }

  function buildSegmentSection(dayData, diffusionMap, editable) {
    const wrapper = document.createElement("section");
    wrapper.className = "segment-block";

    const header = document.createElement("div");
    header.className = "segment-head";
    const title = document.createElement("h3");
    title.className = "segment-title";
    title.textContent = SEGMENT.label;

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "add-row-btn";
    addButton.textContent = "Ajouter une ligne";
    addButton.disabled = !editable;
    addButton.addEventListener("click", () => {
      const insertIndex = getInsertIndexForNewRow(dayData);
      dayData.day.splice(insertIndex, 0, createEmptyEntry(true));
      renderDaySchedule();
      setPlannerFeedback("Nouvelle ligne ajoutée.", "success");
    });

    if (!editable) {
      addButton.classList.add("hidden-clear");
    }
    header.append(title, addButton);

    const list = document.createElement("div");
    list.className = "segment-rows";
    let cursor = SEGMENT.start;

    dayData.day.forEach((entry, index) => {
      const normalized = normalizeEntry(entry);
      const fixedStart = Number(normalized.fixedStartMinute);
      if (Number.isFinite(fixedStart) && fixedStart > cursor && fixedStart < SEGMENT.end) cursor = fixedStart;

      const built = buildEntryRow(dayData, index, normalized, cursor, diffusionMap, editable);
      cursor = built.end;
      list.appendChild(built.row);
    });

    const consumed = dayData.day.reduce((sum, entry) => sum + getEntryDuration(normalizeEntry(entry)), 0);
    const capacity = SEGMENT.end - SEGMENT.start;
    const metricsRow = document.createElement("div");
    metricsRow.className = "segment-metrics-row";

    const freeMetric = document.createElement("div");
    freeMetric.className = "segment-metric";
    if (consumed < capacity) {
      freeMetric.textContent = `Temps libre: ${capacity - consumed} min`;
      freeMetric.classList.add("segment-remaining");
    } else if (consumed > capacity) {
      freeMetric.textContent = `Dépassement: +${consumed - capacity} min`;
      freeMetric.classList.add("summary-overflow");
    } else {
      freeMetric.textContent = "Segment rempli exactement";
      freeMetric.classList.add("segment-filled");
    }
    metricsRow.appendChild(freeMetric);

    const costMetric = document.createElement("div");
    costMetric.className = "segment-metric segment-cost";
    if (finance && typeof finance.estimateProgramCost === "function") {
      const totalCost = computeDayTotalCost(state.selectedDateKey, dayData, diffusionMap);
      costMetric.textContent = `Coût de grille du jour: ${formatEuro(totalCost)}`;
    } else {
      costMetric.textContent = "Coût de grille du jour: -";
    }
    metricsRow.appendChild(costMetric);

    wrapper.append(header, metricsRow, list);
    return wrapper;
  }

  function renderDaySchedule() {
    const title = document.getElementById("currentDayTitle");
    const slotsContainer = document.getElementById("dayScheduleSlots");
    const copyBtn = document.getElementById("copyToDayBtn");
    const resetBtn = document.getElementById("resetDayBtn");
    const saveBtn = document.getElementById("saveWeekBtn");
    const publishBtn = document.getElementById("publishDayBtn");
    if (!title || !slotsContainer) return;

    const timelineItem = getSelectedTimelineItem();
    if (!timelineItem) return;

    const published = isDatePublished(timelineItem.key);
    const editable = Boolean(timelineItem.isEditable && !published);
    const dayData = getSelectedDayData();
    const diffusionMap = getDiffusionByEntry();

    if (!Array.isArray(dayData.day)) dayData.day = [];
    if (dayData.day.length === 0) {
      dayData.day.push(createEmptyEntry(true));
    }

    title.textContent = `Grille du ${formatDateLong(timelineItem.date)}`;

    if (copyBtn) copyBtn.disabled = false;
    if (resetBtn) resetBtn.style.display = editable ? "" : "none";
    if (saveBtn) saveBtn.style.display = editable ? "" : "none";
    if (publishBtn) {
      publishBtn.style.display = timelineItem.isEditable ? "" : "none";
      publishBtn.disabled = !timelineItem.isEditable || published;
      publishBtn.textContent = published ? "Grille publiée" : "Publier la grille";
    }

    slotsContainer.replaceChildren(buildSegmentSection(dayData, diffusionMap, editable));
    saveDateGrid();
  }

  function resetSelectedDay() {
    if (!isSelectedDayEditable()) {
      setPlannerFeedback("Réinitialisation impossible: journée non modifiable ou déjà publiée.", "error");
      return;
    }
    const current = normalizeDay(state.dateGrid[state.selectedDateKey]).day;
    const keptLocked = current
      .map((entry) => normalizeEntry(entry))
      .filter((entry) => isFixedEntry(entry));
    state.dateGrid[state.selectedDateKey] = { day: keptLocked };
    renderDaySchedule();
    if (keptLocked.length > 0) {
      setPlannerFeedback("La journée a été réinitialisée (programmes verrouillés conservés).", "success");
    } else {
      setPlannerFeedback("La journée sélectionnée a été réinitialisée.", "success");
    }
  }

  function initDateNavigationButtons() {
    const prevBtn = document.getElementById("prevDatesBtn");
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        state.tabStartIndex = Math.max(0, state.tabStartIndex - 1);
        renderDateTabs();
      });
    }

    const nextBtn = document.getElementById("nextDatesBtn");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        const maxStart = Math.max(0, state.timeline.length - TABS_WINDOW_SIZE);
        state.tabStartIndex = Math.min(maxStart, state.tabStartIndex + 1);
        renderDateTabs();
      });
    }
  }

  renderDateTabs();
  renderTargetDaySelect();
  renderLibrary();
  renderDaySchedule();
  initDateNavigationButtons();

  const programSearchInput = document.getElementById("programSearchInput");
  if (programSearchInput) {
    programSearchInput.addEventListener("input", () => {
      state.searchTerm = programSearchInput.value || "";
      renderLibrary();
    });
  }

  const ageRatingFilters = document.getElementById("ageRatingFilters");
  if (ageRatingFilters) {
    ageRatingFilters.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest(".filter-chip[data-age-rating]") : null;
      if (!target) return;
      state.filters.ageRating = target.dataset.ageRating || "all";
      renderLibrary();
    });
  }

  const starsFilters = document.getElementById("starsFilters");
  if (starsFilters) {
    starsFilters.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest(".filter-chip[data-stars]") : null;
      if (!target) return;
      state.filters.stars = target.dataset.stars || "all";
      renderLibrary();
    });
  }

  const durationFilters = document.getElementById("durationFilters");
  if (durationFilters) {
    durationFilters.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest(".filter-chip[data-duration]") : null;
      if (!target) return;
      state.filters.duration = target.dataset.duration || "all";
      renderLibrary();
    });
  }

  const diffusionStatusFilters = document.getElementById("diffusionStatusFilters");
  if (diffusionStatusFilters) {
    diffusionStatusFilters.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest(".filter-chip[data-diffusion-status]") : null;
      if (!target) return;
      state.filters.diffusionStatus = target.dataset.diffusionStatus || "all";
      renderLibrary();
    });
  }

  const resetLibraryFiltersBtn = document.getElementById("resetLibraryFiltersBtn");
  if (resetLibraryFiltersBtn) {
    resetLibraryFiltersBtn.addEventListener("click", () => {
      state.searchTerm = "";
      state.filters.ageRating = "all";
      state.filters.stars = "all";
      state.filters.diffusionStatus = "all";
      state.filters.duration = "all";
      const search = document.getElementById("programSearchInput");
      if (search) search.value = "";
      renderLibrary();
    });
  }

  const toggleLibraryFiltersBtn = document.getElementById("toggleLibraryFiltersBtn");
  if (toggleLibraryFiltersBtn) {
    toggleLibraryFiltersBtn.addEventListener("click", () => {
      state.filtersCollapsed = !state.filtersCollapsed;
      syncFiltersCollapseUi();
    });
  }

  function getPlannerPublishElements() {
    return {
      modal: document.getElementById("plannerPublishModal"),
      body: document.getElementById("plannerPublishModalBody"),
      confirmBtn: document.getElementById("confirmPlannerPublishBtn"),
      cancelBtn: document.getElementById("cancelPlannerPublishBtn")
    };
  }

  function closePublishModal() {
    const { modal } = getPlannerPublishElements();
    if (!modal) return;
    modal.classList.add("hidden");
  }

  function openPublishModal() {
    const timelineItem = getSelectedTimelineItem();
    if (!timelineItem || !timelineItem.isEditable) {
      setPlannerFeedback("Publication impossible pour cette journée.", "error");
      return;
    }
    if (isDatePublished(timelineItem.key)) {
      setPlannerFeedback("Cette journée est déjà publiée.", "error");
      return;
    }

    const dayData = getSelectedDayData();
    const integrity = checkFixedProgramsIntegrity(dayData.day);
    if (!integrity.ok) {
      const blockedAt = formatMinute(integrity.blockedAtMinute || SEGMENT.start);
      setPlannerFeedback(`Publication impossible: conflit avec un créneau verrouillé (${integrity.blockedBy} à ${blockedAt}).`, "error");
      return;
    }

    const consumed = computeDayConsumedMinutes(dayData);
    const capacity = SEGMENT.end - SEGMENT.start;
    if (consumed > capacity) {
      setPlannerFeedback(`Publication impossible: la grille dépasse de ${consumed - capacity} min.`, "error");
      return;
    }

    const diffusionMap = getDiffusionByEntry();
    const totalCost = computeDayTotalCost(timelineItem.key, dayData, diffusionMap);
    const { modal, body } = getPlannerPublishElements();
    if (!modal || !body) return;

    body.innerHTML = "";
    const paragraph1 = document.createElement("p");
    paragraph1.textContent = `Tu vas publier la grille du ${formatDateLong(timelineItem.date)}.`;
    const paragraph2 = document.createElement("p");
    paragraph2.innerHTML = `Coût débité immédiatement: <strong>${formatEuro(totalCost)}</strong>.`;
    const paragraph3 = document.createElement("p");
    paragraph3.textContent = "Cette action est irrévocable pour le moment et verrouille la journée.";
    body.append(paragraph1, paragraph2, paragraph3);

    modal.classList.remove("hidden");
  }

  (function initPublishModalEvents() {
    const { modal, confirmBtn, cancelBtn } = getPlannerPublishElements();
    if (!modal) return;

    if (cancelBtn) {
      cancelBtn.addEventListener("click", closePublishModal);
    }

    modal.addEventListener("click", (event) => {
      if (event.target === modal) closePublishModal();
    });

    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => {
        const timelineItem = getSelectedTimelineItem();
        if (!timelineItem) return;
        if (!finance || typeof finance.publishGridForDate !== "function") {
          setPlannerFeedback("Publication indisponible: module finance non chargé.", "error");
          closePublishModal();
          return;
        }
        if (!timelineItem.isEditable) {
          setPlannerFeedback("Publication impossible pour cette journée.", "error");
          closePublishModal();
          return;
        }

        const dayData = getSelectedDayData();
        removeEmptyEntriesBeforeFixed(dayData);

        const consumed = computeDayConsumedMinutes(dayData);
        const capacity = SEGMENT.end - SEGMENT.start;
        if (consumed > capacity) {
          setPlannerFeedback(`Publication impossible: la grille dépasse de ${consumed - capacity} min.`, "error");
          closePublishModal();
          renderDaySchedule();
          return;
        }

        const diffusionMap = getDiffusionByEntry();
        const totalCost = computeDayTotalCost(timelineItem.key, dayData, diffusionMap);
        const result = finance.publishGridForDate(session, timelineItem.key, totalCost);
        if (!result || !result.ok) {
          setPlannerFeedback(result && result.message ? result.message : "Publication impossible.", "error");
          closePublishModal();
          return;
        }

        saveDateGrid();
        closePublishModal();
        setPlannerFeedback(`Grille publiée. ${formatEuro(result.paidCost || 0)} débités du compte.`, "success");
        renderDateTabs();
        renderTargetDaySelect();
        renderDaySchedule();
      });
    }
  })();

  const saveWeekBtn = document.getElementById("saveWeekBtn");
  if (saveWeekBtn) {
    saveWeekBtn.addEventListener("click", () => {
      const selected = getSelectedDayData();
      removeEmptyEntriesBeforeFixed(selected);
      saveDateGrid();
      renderDaySchedule();
      setPlannerFeedback("Grille sauvegardée.", "success");
    });
  }

  const copyToDayBtn = document.getElementById("copyToDayBtn");
  if (copyToDayBtn) {
    copyToDayBtn.addEventListener("click", () => {
      const targetSelect = document.getElementById("targetDaySelect");
      const targetDateKey = targetSelect ? targetSelect.value : "";
      const targetItem = state.timeline.find((item) => item.key === targetDateKey);
      if (!targetItem || !targetItem.isEditable || isDatePublished(targetDateKey)) {
        setPlannerFeedback("Jour cible invalide.", "error");
        return;
      }

      const source = normalizeDay(state.dateGrid[state.selectedDateKey]).day;
      const sourceEditable = source
        .map((entry) => normalizeEntry(entry))
        .filter((entry) => entry.title && !isFixedEntry(entry));
      const copiedEditable = buildCopiedDayWithFreshEpisodes(sourceEditable, targetDateKey);
      const targetFixed = normalizeDay(state.dateGrid[targetDateKey]).day
        .map((entry) => normalizeEntry(entry))
        .filter((entry) => entry.title && isFixedEntry(entry));
      const mergedDay = mergeCopiedEntriesWithTargetFixed(copiedEditable, targetFixed);
      if (!preservesTargetFixedEntries(targetFixed, mergedDay)) {
        setPlannerFeedback("Copie annulée: protection des programmes studio verrouillés.", "error");
        return;
      }
      state.dateGrid[targetDateKey] = { day: mergedDay };
      saveDateGrid();
      setPlannerFeedback(`Le ${formatDateLong(fromDateKey(state.selectedDateKey))} a été copié vers ${formatDateLong(targetItem.date)} (programmes studio verrouillés conservés).`, "success");
    });
  }

  const resetDayBtn = document.getElementById("resetDayBtn");
  if (resetDayBtn) {
    resetDayBtn.addEventListener("click", resetSelectedDay);
  }

  const publishDayBtn = document.getElementById("publishDayBtn");
  if (publishDayBtn) {
    publishDayBtn.addEventListener("click", openPublishModal);
  }

  if (typeof window.addEventListener === "function") {
    window.addEventListener("tvmanager:cloud-sync", (event) => {
      const detail = event && event.detail ? event.detail : null;
      if (!detail || !detail.ok || detail.mode !== "pull") return;
      reloadPlannerStateFromStorage();
      renderDateTabs();
      renderTargetDaySelect();
      renderLibrary();
      renderDaySchedule();
    });
  }

})();
