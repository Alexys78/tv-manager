(function audienceEngineInit() {
  const diffusionRules = window.DiffusionRules;
  const programCatalog = window.ProgramCatalog;
  const presenterEngine = window.PresenterEngine;
  const sessionUtils = window.SessionUtils;
  const appKeys = (sessionUtils && sessionUtils.APP_KEYS) || {};
  const DAY_START = Number(sessionUtils && sessionUtils.DAY_START_MINUTE) || (5 * 60);
  const DAY_END = Number(sessionUtils && sessionUtils.DAY_END_MINUTE) || (25 * 60);
  const SLOT_SIZE = 30;
  const DAYS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
  const DATE_GRID_KEY_PREFIX = appKeys.DATE_GRID_KEY_PREFIX || "tv_manager_date_grid_";

  const DIFFUSION_LABELS = {
    direct: "En direct",
    inedit: "Inédit",
    rediffusion: "Rediffusion"
  };

  const PROGRAM_CATEGORIES = [
    { id: "information", programs: ["JT Quotidien", "Le 6/8 Matin", "Journal de Midi", "JT National 13h", "Le Grand Débat", "Briefing International", "Éco Express", "Info Régions", "Édition spéciale"] },
    { id: "divertissement", programs: ["Soirée Stand-Up", "Le Grand Défi Live", "Famille en Jeu", "Quiz Arena", "Prime Spectacle", "Comedy Factory", "Talent Avenue", "Blind Test XXL"] },
    { id: "films", programs: ["Film Action Prime", "Comédie Romantique", "Thriller Urbain", "Cinéma Français", "Aventure Fantastique", "Film Historique", "Polar du Soir", "Classique du Dimanche"] },
    { id: "series", programs: ["Unité 51", "Les Héritiers", "Police District", "Campus 24", "Chroniques Médicales", "Code Rouge", "Mystères en Ville", "Saga Familiale"] },
    { id: "magazines", programs: ["Consommation & Vous", "Maison et Déco", "Destination Évasion", "Santé Pratique", "Auto Passion", "Vivre Mieux", "Enquête Société", "Cuisine de Saison"] },
    { id: "jeunesse", programs: ["Les Aventuriers Mini", "Cartoon Planet", "Mission Collège", "Kids Quiz", "Studio Ados", "Les Petits Curieux", "Conte du Soir", "Science Junior"] },
    { id: "documentaires", programs: ["Terres Sauvages", "Planète Bleue", "Grands Inventeurs", "Histoire Secrète", "Les Routes du Monde", "Enquêtes Criminelles", "Civilisations", "Océans Extrêmes"] },
    { id: "realite", programs: ["Loft Rivals", "Objectif Cuisine", "Le Ranch des Célébrités", "Mariage Challenge", "Survivants Urbains", "Maison en Duel", "Coach Academy", "Nouvelle Vie"] },
    { id: "culture", programs: ["Scène Ouverte", "Concert Privé", "L'Invité Culture", "Backstage Live", "Découverte Arts", "Théâtre à la Une", "Session Acoustique", "Musiques du Monde"] }
  ];

  const CATEGORY_DURATION_OPTIONS = {
    information: [5, 15, 30, 45, 60, 90, 120],
    divertissement: [45, 60, 90, 120],
    films: [90, 120],
    series: [30, 45, 60],
    magazines: [30, 45, 60, 90, 120],
    jeunesse: [15, 30, 45, 60],
    documentaires: [45, 60, 90, 120],
    realite: [45, 60, 90, 120],
    culture: [30, 45, 60, 90]
  };

  const CATEGORY_BY_PROGRAM = new Map();
  const PROGRAMS_BY_CATEGORY = new Map();
  PROGRAM_CATEGORIES.forEach((category) => {
    PROGRAMS_BY_CATEGORY.set(category.id, category.programs.slice());
    category.programs.forEach((title) => CATEGORY_BY_PROGRAM.set(title, category.id));
  });

  const CATEGORY_AUDIENCE = {
    information: 1.0,
    divertissement: 1.1,
    films: 1.28,
    series: 1.2,
    magazines: 0.92,
    jeunesse: 0.82,
    documentaires: 0.95,
    realite: 1.05,
    culture: 0.88
  };

  const COMPETITORS = [
    { id: "comp_gen_1", name: "Réseau Horizon", type: "generaliste", weights: { information: 1.05, divertissement: 1.1, films: 1.02, series: 1.08, magazines: 0.95 } },
    { id: "comp_gen_2", name: "Canal 7", type: "generaliste", weights: { information: 0.98, divertissement: 1.08, films: 1.06, series: 1.1, magazines: 1.0 } },
    { id: "comp_film", name: "CinéMax+", type: "films", weights: { films: 1.45, series: 0.8, information: 0.6, magazines: 0.6, culture: 0.9 } },
    { id: "comp_music", name: "Pulse Music", type: "musical", weights: { culture: 1.45, divertissement: 1.1, information: 0.7, films: 0.65, magazines: 0.85 } },
    { id: "comp_mag", name: "Mag 360", type: "magazine", weights: { magazines: 1.5, information: 1.02, documentaires: 1.15, divertissement: 0.82, films: 0.65 } }
  ];

  const PROFILE_PROGRAM_POOLS = {
    generaliste: ["information", "divertissement", "series", "films", "magazines", "documentaires"],
    films: ["films", "films", "films", "series", "culture", "information"],
    musical: ["culture", "culture", "divertissement", "information", "magazines"],
    magazine: ["magazines", "magazines", "documentaires", "information", "culture"]
  };

  const PROGRAM_STARS_CACHE = new Map();
  const PROGRAM_RUNTIME_META_CACHE = new Map();
  const STAFF_MEMBER_CACHE = new Map();

  const DEFAULT_STAFF_AUDIENCE_TUNING = Object.freeze({
    adjustment: Object.freeze({
      min: -0.08,
      max: 0.15,
      scale: 0.15
    }),
    signal: Object.freeze({
      baseline: 65,
      range: 30,
      notorietyBaseline: 60,
      notorietyRange: 30,
      qualityWeight: 0.88,
      notorietyWeight: 0.12
    }),
    specialtyFit: Object.freeze({
      categoryMissPenalty: 0.08,
      subtypeMissPenalty: 0.12,
      minFactor: 0.75
    }),
    baseWeights: Object.freeze({
      information: Object.freeze({
        journalists: 0.5,
        presenters: 0.14,
        directors: 0.2,
        producers: 0.16
      }),
      default: Object.freeze({
        presenters: 0.45,
        journalists: 0.08,
        directors: 0.2,
        producers: 0.27
      })
    }),
    modeWeightMultipliers: Object.freeze({
      direct: Object.freeze({
        journalists: 1.15,
        presenters: 1.12,
        directors: 0.9,
        producers: 0.9
      }),
      recorded: Object.freeze({
        journalists: 0.9,
        presenters: 0.9,
        directors: 1.12,
        producers: 1.15
      })
    })
  });

  function pickNumber(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }

  function normalizeRoleWeightMap(raw, fallback) {
    const source = raw && typeof raw === "object" ? raw : {};
    return {
      journalists: Math.max(0, pickNumber(source.journalists, fallback.journalists)),
      presenters: Math.max(0, pickNumber(source.presenters, fallback.presenters)),
      directors: Math.max(0, pickNumber(source.directors, fallback.directors)),
      producers: Math.max(0, pickNumber(source.producers, fallback.producers))
    };
  }

  function readStaffAudienceTuning() {
    const root = window.TVManagerTuning && typeof window.TVManagerTuning === "object"
      ? window.TVManagerTuning
      : {};
    const raw = root.staffAudience && typeof root.staffAudience === "object"
      ? root.staffAudience
      : {};
    const d = DEFAULT_STAFF_AUDIENCE_TUNING;
    const adjustmentRaw = raw.adjustment && typeof raw.adjustment === "object" ? raw.adjustment : {};
    const signalRaw = raw.signal && typeof raw.signal === "object" ? raw.signal : {};
    const fitRaw = raw.specialtyFit && typeof raw.specialtyFit === "object" ? raw.specialtyFit : {};
    const baseWeightsRaw = raw.baseWeights && typeof raw.baseWeights === "object" ? raw.baseWeights : {};
    const modeMultRaw = raw.modeWeightMultipliers && typeof raw.modeWeightMultipliers === "object"
      ? raw.modeWeightMultipliers
      : {};

    const min = pickNumber(adjustmentRaw.min, d.adjustment.min);
    const max = pickNumber(adjustmentRaw.max, d.adjustment.max);
    const safeMin = Math.min(min, max);
    const safeMax = Math.max(min, max);

    return {
      adjustment: {
        min: safeMin,
        max: safeMax,
        scale: Math.max(0, pickNumber(adjustmentRaw.scale, d.adjustment.scale))
      },
      signal: {
        baseline: pickNumber(signalRaw.baseline, d.signal.baseline),
        range: Math.max(0.0001, pickNumber(signalRaw.range, d.signal.range)),
        notorietyBaseline: pickNumber(signalRaw.notorietyBaseline, d.signal.notorietyBaseline),
        notorietyRange: Math.max(0.0001, pickNumber(signalRaw.notorietyRange, d.signal.notorietyRange)),
        qualityWeight: Math.max(0, pickNumber(signalRaw.qualityWeight, d.signal.qualityWeight)),
        notorietyWeight: Math.max(0, pickNumber(signalRaw.notorietyWeight, d.signal.notorietyWeight))
      },
      specialtyFit: {
        categoryMissPenalty: Math.max(0, pickNumber(fitRaw.categoryMissPenalty, d.specialtyFit.categoryMissPenalty)),
        subtypeMissPenalty: Math.max(0, pickNumber(fitRaw.subtypeMissPenalty, d.specialtyFit.subtypeMissPenalty)),
        minFactor: Math.max(0, Math.min(1, pickNumber(fitRaw.minFactor, d.specialtyFit.minFactor)))
      },
      baseWeights: {
        information: normalizeRoleWeightMap(baseWeightsRaw.information, d.baseWeights.information),
        default: normalizeRoleWeightMap(baseWeightsRaw.default, d.baseWeights.default)
      },
      modeWeightMultipliers: {
        direct: normalizeRoleWeightMap(modeMultRaw.direct, d.modeWeightMultipliers.direct),
        recorded: normalizeRoleWeightMap(modeMultRaw.recorded, d.modeWeightMultipliers.recorded)
      }
    };
  }

  const STAFF_AUDIENCE_TUNING = readStaffAudienceTuning();

  const CATEGORY_SPECIALTY_TOKEN = Object.freeze({
    information: "informations",
    divertissement: "divertissements",
    films: "films",
    series: "series",
    magazines: "magazines",
    jeunesse: "jeunesse",
    documentaires: "documentaires",
    realite: "tele-realite",
    culture: "culture"
  });

  function hashString(value) {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  function seededRandom(seed) {
    let state = seed >>> 0;
    return function next() {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 0xffffffff;
    };
  }

  function getProgramDuration(title, categoryId) {
    if (programCatalog && typeof programCatalog.getProgramMeta === "function") {
      const meta = programCatalog.getProgramMeta(title);
      if (meta && Number(meta.duration) > 0) return Number(meta.duration);
    }
    const options = CATEGORY_DURATION_OPTIONS[categoryId] || [60];
    return options[hashString(title) % options.length];
  }

  function getFallbackStars(title, categoryId) {
    const seed = hashString(`${categoryId}:${title}:audience_stars`);
    const roll = seed % 100;
    if (roll < 12) return 0.5;
    if (roll < 27) return 1;
    if (roll < 42) return 1.5;
    if (roll < 56) return 2;
    if (roll < 68) return 2.5;
    if (roll < 79) return 3;
    if (roll < 88) return 3.5;
    if (roll < 94) return 4;
    if (roll < 98) return 4.5;
    return 5;
  }

  function normalizeToken(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function resolveProgramRuntimeMeta(title, categoryId) {
    const cacheKey = `${categoryId}:${title}`;
    if (PROGRAM_RUNTIME_META_CACHE.has(cacheKey)) return PROGRAM_RUNTIME_META_CACHE.get(cacheKey);
    const fallback = {
      stars: getFallbackStars(title, categoryId),
      productionMode: null,
      productionSubtype: "",
      presenterIds: [],
      directorId: "",
      producerId: ""
    };
    if (programCatalog && typeof programCatalog.getProgramMeta === "function") {
      const meta = programCatalog.getProgramMeta(title);
      if (meta && typeof meta === "object") {
        const presenterIds = Array.isArray(meta.presenterIds)
          ? meta.presenterIds.map((value) => String(value || "").trim()).filter(Boolean)
          : [];
        const presenterId = String(meta.presenterId || "").trim();
        if (presenterId && !presenterIds.includes(presenterId)) presenterIds.push(presenterId);
        const normalized = {
          stars: Number(meta.stars) > 0 ? Number(meta.stars) : fallback.stars,
          productionMode: String(meta.productionMode || "").trim().toLowerCase() === "recorded"
            ? "recorded"
            : (String(meta.productionMode || "").trim().toLowerCase() === "direct" ? "direct" : null),
          productionSubtype: String(meta.productionSubtype || ""),
          presenterIds,
          directorId: String(meta.directorId || "").trim(),
          producerId: String(meta.producerId || "").trim()
        };
        PROGRAM_RUNTIME_META_CACHE.set(cacheKey, normalized);
        return normalized;
      }
    }
    PROGRAM_RUNTIME_META_CACHE.set(cacheKey, fallback);
    return fallback;
  }

  function getProgramStars(title, categoryId) {
    const cacheKey = `${categoryId}:${title}`;
    if (PROGRAM_STARS_CACHE.has(cacheKey)) return PROGRAM_STARS_CACHE.get(cacheKey);
    const runtimeMeta = resolveProgramRuntimeMeta(title, categoryId);
    const stars = Number(runtimeMeta && runtimeMeta.stars);
    const normalized = Math.max(0.5, Math.min(5, Math.round((Number.isFinite(stars) ? stars : getFallbackStars(title, categoryId)) * 2) / 2));
    PROGRAM_STARS_CACHE.set(cacheKey, normalized);
    return normalized;
  }

  function getStaffByRoleAndId(role, staffId) {
    const safeRole = String(role || "").trim();
    const safeId = String(staffId || "").trim();
    if (!safeRole || !safeId) return null;
    const cacheKey = `${safeRole}:${safeId}`;
    if (STAFF_MEMBER_CACHE.has(cacheKey)) return STAFF_MEMBER_CACHE.get(cacheKey);

    let member = null;
    if (presenterEngine && typeof presenterEngine.getStaffByIdForCurrentSession === "function") {
      member = presenterEngine.getStaffByIdForCurrentSession(safeRole, safeId);
    }
    if (!member && presenterEngine) {
      if (safeRole === "journalists" && typeof presenterEngine.getJournalistByIdForCurrentSession === "function") {
        member = presenterEngine.getJournalistByIdForCurrentSession(safeId);
      } else if (safeRole === "presenters" && typeof presenterEngine.getPresenterByIdForCurrentSession === "function") {
        member = presenterEngine.getPresenterByIdForCurrentSession(safeId);
      } else if (safeRole === "directors" && typeof presenterEngine.getDirectorByIdForCurrentSession === "function") {
        member = presenterEngine.getDirectorByIdForCurrentSession(safeId);
      } else if (safeRole === "producers" && typeof presenterEngine.getProducerByIdForCurrentSession === "function") {
        member = presenterEngine.getProducerByIdForCurrentSession(safeId);
      }
    }

    STAFF_MEMBER_CACHE.set(cacheKey, member || null);
    return member || null;
  }

  function computeSpecialtyFit(staff, categoryId, subtype) {
    const specialty = normalizeToken(staff && staff.specialty);
    if (!specialty) return 1;
    let fit = 1;
    const categoryToken = CATEGORY_SPECIALTY_TOKEN[categoryId];
    const subtypeToken = normalizeToken(subtype);
    if (categoryToken && !specialty.includes(categoryToken)) fit -= STAFF_AUDIENCE_TUNING.specialtyFit.categoryMissPenalty;
    if (subtypeToken && !specialty.includes(subtypeToken)) fit -= STAFF_AUDIENCE_TUNING.specialtyFit.subtypeMissPenalty;
    return Math.max(STAFF_AUDIENCE_TUNING.specialtyFit.minFactor, Math.min(1, fit));
  }

  function computeStaffSignal(staff, categoryId, subtype) {
    if (!staff || typeof staff !== "object") return null;
    const editorial = Number(staff.editorial);
    const charisma = Number(staff.charisma);
    const notoriety = Number(staff.notoriety);
    if (!Number.isFinite(editorial) || !Number.isFinite(charisma) || !Number.isFinite(notoriety)) return null;
    const signal = STAFF_AUDIENCE_TUNING.signal;
    const weighted = (editorial * 0.45) + (charisma * 0.35) + (notoriety * 0.2);
    const qualitySignal = Math.max(-1, Math.min(1, (weighted - signal.baseline) / signal.range));
    const notorietySignal = Math.max(-1, Math.min(1, (notoriety - signal.notorietyBaseline) / signal.notorietyRange));
    const qualityWeight = Math.max(0, Number(signal.qualityWeight) || 0);
    const notorietyWeight = Math.max(0, Number(signal.notorietyWeight) || 0);
    const totalWeight = qualityWeight + notorietyWeight || 1;
    const fit = computeSpecialtyFit(staff, categoryId, subtype);
    return (((qualitySignal * qualityWeight) + (notorietySignal * notorietyWeight)) / totalWeight) * fit;
  }

  function computeRoleAverageSignal(role, ids, categoryId, subtype) {
    const safeIds = Array.isArray(ids) ? ids.map((value) => String(value || "").trim()).filter(Boolean) : [];
    if (!safeIds.length) return null;
    const values = [];
    safeIds.forEach((id) => {
      const staff = getStaffByRoleAndId(role, id);
      const signal = computeStaffSignal(staff, categoryId, subtype);
      if (Number.isFinite(signal)) values.push(signal);
    });
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  function resolveOnAirSignal(categoryId, ids, subtype) {
    const safeCategory = String(categoryId || "");
    const preferredRole = safeCategory === "information" ? "journalists" : "presenters";
    const fallbackRole = preferredRole === "journalists" ? "presenters" : "journalists";
    const preferred = computeRoleAverageSignal(preferredRole, ids, safeCategory, subtype);
    if (Number.isFinite(preferred)) {
      return { role: preferredRole, signal: preferred };
    }
    const fallback = computeRoleAverageSignal(fallbackRole, ids, safeCategory, subtype);
    if (Number.isFinite(fallback)) {
      return { role: preferredRole, signal: fallback };
    }
    return { role: preferredRole, signal: null };
  }

  function buildStaffWeightMap(categoryId, productionMode) {
    const safeCategory = String(categoryId || "");
    const safeMode = String(productionMode || "").trim().toLowerCase();
    const base = safeCategory === "information"
      ? STAFF_AUDIENCE_TUNING.baseWeights.information
      : STAFF_AUDIENCE_TUNING.baseWeights.default;
    const modeMultipliers = STAFF_AUDIENCE_TUNING.modeWeightMultipliers[safeMode] || null;
    const weights = {};
    ["journalists", "presenters", "directors", "producers"].forEach((role) => {
      const roleBase = Number(base[role]) || 0;
      const modeFactor = modeMultipliers ? (Number(modeMultipliers[role]) || 1) : 1;
      weights[role] = Math.max(0, roleBase * modeFactor);
    });
    return weights;
  }

  function computeProgramStaffAdjustment(channelId, program, runtimeMeta) {
    if (String(channelId || "") !== "player") return 0;
    if (!program || !runtimeMeta || !presenterEngine) return 0;

    const categoryId = String(program.categoryId || "");
    const subtype = String(program.subtype || runtimeMeta.productionSubtype || "");
    const onAirIds = Array.isArray(runtimeMeta.presenterIds) ? runtimeMeta.presenterIds : [];
    const directorIds = runtimeMeta.directorId ? [runtimeMeta.directorId] : [];
    const producerIds = runtimeMeta.producerId ? [runtimeMeta.producerId] : [];

    const onAir = resolveOnAirSignal(categoryId, onAirIds, subtype);
    const roleSignals = {
      journalists: null,
      presenters: null,
      directors: computeRoleAverageSignal("directors", directorIds, categoryId, subtype),
      producers: computeRoleAverageSignal("producers", producerIds, categoryId, subtype)
    };
    if (onAir.role === "journalists") roleSignals.journalists = onAir.signal;
    if (onAir.role === "presenters") roleSignals.presenters = onAir.signal;

    const weights = buildStaffWeightMap(categoryId, program.productionMode || runtimeMeta.productionMode);
    const activeRoles = Object.keys(roleSignals).filter((role) => Number.isFinite(roleSignals[role]) && Number(weights[role]) > 0);
    if (!activeRoles.length) return 0;

    const totalWeight = activeRoles.reduce((sum, role) => sum + Number(weights[role]), 0);
    if (totalWeight <= 0) return 0;

    const compositeSignal = activeRoles.reduce((sum, role) => {
      const normalizedWeight = Number(weights[role]) / totalWeight;
      return sum + (normalizedWeight * Number(roleSignals[role]));
    }, 0);

    const scaled = compositeSignal * STAFF_AUDIENCE_TUNING.adjustment.scale;
    return Math.max(STAFF_AUDIENCE_TUNING.adjustment.min, Math.min(STAFF_AUDIENCE_TUNING.adjustment.max, scaled));
  }

  function formatMinute(total) {
    const hour = Math.floor(total / 60) % 24;
    const minute = total % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  function normalizeEntry(raw) {
    if (!raw || typeof raw !== "object") {
      return { title: "", categoryId: "", productionMode: null, subtype: "", season: null, episode: null, fixedStartMinute: null };
    }
    const title = typeof raw.title === "string" ? raw.title : "";
    if (!title) return { title: "", categoryId: "", productionMode: null, subtype: "", season: null, episode: null, fixedStartMinute: null };
    const categoryId = typeof raw.categoryId === "string" && raw.categoryId
      ? raw.categoryId
      : (CATEGORY_BY_PROGRAM.get(title) || "");
    return {
      title,
      categoryId,
      productionMode: String(raw.productionMode || "").trim().toLowerCase() === "recorded"
        ? "recorded"
        : (String(raw.productionMode || "").trim().toLowerCase() === "direct" ? "direct" : null),
      subtype: String(raw.subtype || ""),
      season: Number.isInteger(raw.season) && raw.season > 0 ? raw.season : null,
      episode: Number.isInteger(raw.episode) && raw.episode > 0 ? raw.episode : null,
      fixedStartMinute: Number.isFinite(Number(raw.fixedStartMinute))
        ? Math.max(0, Math.min((24 * 60) - 1, Math.floor(Number(raw.fixedStartMinute))))
        : null
    };
  }

  function normalizePlayerDay(dayRaw) {
    if (!dayRaw) return [];
    if (Array.isArray(dayRaw)) return dayRaw.map(normalizeEntry);
    if (Array.isArray(dayRaw.day)) return dayRaw.day.map(normalizeEntry);
    if (Array.isArray(dayRaw.before) || Array.isArray(dayRaw.after)) {
      const before = Array.isArray(dayRaw.before) ? dayRaw.before : [];
      const after = Array.isArray(dayRaw.after) ? dayRaw.after : [];
      return [...before, ...after].map(normalizeEntry);
    }
    const migrated = [];
    Object.keys(dayRaw)
      .filter((key) => key.startsWith("slot_"))
      .sort((a, b) => {
        const av = a === "slot_00" ? 24 : Number(a.slice(5));
        const bv = b === "slot_00" ? 24 : Number(b.slice(5));
        return av - bv;
      })
      .forEach((slot) => {
        const entry = normalizeEntry(dayRaw[slot]);
        if (entry.title) migrated.push(entry);
      });
    return migrated;
  }

  function buildTimedScheduleFromEntries(entries) {
    const timed = [];
    let cursor = DAY_START;
    entries.forEach((entry) => {
      if (!entry.title) return;
      const fixedStart = Number(entry.fixedStartMinute);
      const start = Number.isFinite(fixedStart) && fixedStart >= cursor
        ? fixedStart
        : cursor;
      if (start >= DAY_END) return;
      const duration = getProgramDuration(entry.title, entry.categoryId);
      const end = Math.min(DAY_END, start + duration);
      timed.push({ ...entry, start, end, duration });
      cursor = end;
    });
    return timed;
  }

  function pickCategoryForProfile(profile, rand) {
    const pool = PROFILE_PROGRAM_POOLS[profile] || PROFILE_PROGRAM_POOLS.generaliste;
    return pool[Math.floor(rand() * pool.length)];
  }

  function createProgramForCategory(categoryId, rand, channelId) {
    const list = PROGRAMS_BY_CATEGORY.get(categoryId) || [];
    if (list.length === 0) return null;
    const title = list[Math.floor(rand() * list.length)];
    const entry = {
      title,
      categoryId,
      season: null,
      episode: null
    };
    if (categoryId === "series") {
      const base = hashString(`${channelId}:${title}`);
      entry.season = 1 + (base % 4);
      entry.episode = 1 + ((base >>> 4) % 12);
    }
    return entry;
  }

  function generateCompetitorDay(competitorId, profile, dayKey) {
    const rand = seededRandom(hashString(`${competitorId}:${dayKey}:schedule`));
    const entries = [];
    let cursor = DAY_START;
    while (cursor < DAY_END) {
      const categoryId = pickCategoryForProfile(profile, rand);
      const entry = createProgramForCategory(categoryId, rand, competitorId);
      if (!entry) break;
      const duration = getProgramDuration(entry.title, categoryId);
      entries.push(entry);
      cursor += duration;
    }
    return buildTimedScheduleFromEntries(entries);
  }

  function getCurrentProgram(timedSchedule, minute) {
    for (let i = 0; i < timedSchedule.length; i += 1) {
      const item = timedSchedule[i];
      if (minute >= item.start && minute < item.end) return item;
    }
    return null;
  }

  function hourBaseFactor(minute) {
    const hour = Math.floor((minute % (24 * 60)) / 60);
    if (hour >= 5 && hour < 8) return 0.62;
    if (hour >= 8 && hour < 12) return 0.82;
    if (hour >= 12 && hour < 14) return 1.02;
    if (hour >= 14 && hour < 18) return 0.9;
    if (hour >= 18 && hour < 20) return 1.06;
    if (hour >= 20 && hour < 23) return 1.4;
    if (hour >= 23 || hour < 1) return 0.74;
    return 0.5;
  }

  function getCategoryHourFactor(categoryId, minute) {
    const hour = Math.floor((minute % (24 * 60)) / 60);
    const windows = {
      information: [
        { from: 6, to: 9, factor: 1.08 },
        { from: 12, to: 14, factor: 1.12 },
        { from: 19, to: 21, factor: 1.16 }
      ],
      divertissement: [
        { from: 17, to: 20, factor: 1.08 },
        { from: 20, to: 24, factor: 1.1 }
      ],
      films: [
        { from: 20, to: 24, factor: 1.2 },
        { from: 14, to: 17, factor: 0.95 }
      ],
      series: [
        { from: 20, to: 24, factor: 1.15 },
        { from: 14, to: 17, factor: 1.02 }
      ],
      magazines: [
        { from: 9, to: 12, factor: 1.08 },
        { from: 14, to: 17, factor: 1.06 },
        { from: 20, to: 24, factor: 0.93 }
      ],
      jeunesse: [
        { from: 6, to: 9, factor: 1.24 },
        { from: 16, to: 19, factor: 1.2 },
        { from: 20, to: 24, factor: 0.58 }
      ],
      documentaires: [
        { from: 14, to: 18, factor: 1.07 },
        { from: 22, to: 24, factor: 1.05 }
      ],
      realite: [
        { from: 18, to: 22, factor: 1.14 },
        { from: 8, to: 12, factor: 0.9 }
      ],
      culture: [
        { from: 20, to: 24, factor: 1.1 },
        { from: 9, to: 12, factor: 0.95 }
      ]
    };
    const categoryWindows = windows[categoryId];
    if (!Array.isArray(categoryWindows) || categoryWindows.length === 0) return 1;
    let factor = 1;
    categoryWindows.forEach((window) => {
      if (hour >= window.from && hour < window.to) {
        factor *= Number(window.factor) || 1;
      }
    });
    return Math.max(0.4, Math.min(1.35, factor));
  }

  function getProgramKey(program) {
    if (!program) return "";
    if (diffusionRules && typeof diffusionRules.getTrackingKey === "function") {
      return diffusionRules.getTrackingKey(program);
    }
    if (program.categoryId === "series") {
      return `${program.title}::S${program.season || 1}E${program.episode || 1}`;
    }
    return program.title;
  }

  function createChannelStates(channels, playerHistory) {
    const states = {};
    channels.forEach((channel) => {
      states[channel.id] = {
        seenSet: new Set(),
        broadcastByKey: new Map(),
        titleBroadcasts: new Map()
      };
    });
    if (playerHistory && states.player) {
      states.player.seenSet = new Set(playerHistory.seenKeys || []);
      states.player.broadcastByKey = new Map(playerHistory.broadcastByKey || []);
      states.player.titleBroadcasts = new Map(playerHistory.titleBroadcasts || []);
    }
    return states;
  }

  function buildPlayerHistoryContext(sessionData, dateKeyExclusive) {
    const id = sessionData.email || sessionData.username || "player";
    const raw = localStorage.getItem(`${DATE_GRID_KEY_PREFIX}${id}`);
    if (!raw) {
      return { seenKeys: [], broadcastByKey: [], titleBroadcasts: [] };
    }
    const seen = new Set();
    const byKey = new Map();
    const byTitle = new Map();
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return { seenKeys: [], broadcastByKey: [], titleBroadcasts: [] };
      }
      Object.keys(parsed)
        .filter((dateKey) => !dateKeyExclusive || dateKey < dateKeyExclusive)
        .sort()
        .forEach((dateKey) => {
          const entries = normalizePlayerDay(parsed[dateKey]);
          entries.forEach((entry) => {
            if (!entry || !entry.title) return;
            const key = getProgramKey(entry);
            if (key) {
              seen.add(key);
              byKey.set(key, (byKey.get(key) || 0) + 1);
            }
            byTitle.set(entry.title, (byTitle.get(entry.title) || 0) + 1);
          });
        });
    } catch {
      return { seenKeys: [], broadcastByKey: [], titleBroadcasts: [] };
    }
    return {
      seenKeys: Array.from(seen),
      broadcastByKey: Array.from(byKey.entries()),
      titleBroadcasts: Array.from(byTitle.entries())
    };
  }

  function buildPlayerRediffusionSummary(playerState) {
    const byTrackingKey = {};
    let total = 0;
    playerState.broadcastByKey.forEach((count, key) => {
      const rediff = Math.max(0, Number(count || 0) - 1);
      byTrackingKey[key] = rediff;
      total += rediff;
    });
    const byProgram = {};
    playerState.titleBroadcasts.forEach((count, title) => {
      byProgram[title] = Math.max(0, Number(count || 0) - 1);
    });
    return {
      totalRediffusions: total,
      byTrackingKey,
      byProgram
    };
  }

  function createEmptyWeekMap() {
    return DAYS.reduce((acc, day) => {
      acc[day] = [];
      return acc;
    }, {});
  }

  function computeSlotScores(channels, minute, channelStates) {
    const scores = [];
    channels.forEach((channel) => {
      const program = getCurrentProgram(channel.schedule, minute);
      if (!program) {
        scores.push({ channelId: channel.id, score: 0.08, program: null, status: null });
        return;
      }
      const runtimeMeta = resolveProgramRuntimeMeta(program.title, program.categoryId);
      const categoryFactor = CATEGORY_AUDIENCE[program.categoryId] || 1;
      const profileFactor = (channel.weights && channel.weights[program.categoryId]) || 1;
      const categoryHourFactor = getCategoryHourFactor(program.categoryId, minute);
      const state = channelStates[channel.id];
      const seenSet = state.seenSet;
      const key = getProgramKey(program);
      const priorBroadcasts = key ? (state.broadcastByKey.get(key) || 0) : 0;
      const priorRediffusions = Math.max(0, priorBroadcasts - 1);
      const status = diffusionRules && typeof diffusionRules.resolveStatus === "function"
        ? diffusionRules.resolveStatus(program, seenSet)
        : (() => {
          if (program.categoryId === "information") return "inedit";
          const isSeen = key && seenSet.has(key);
          if (key) seenSet.add(key);
          return isSeen ? "rediffusion" : "inedit";
        })();
      if (key) state.broadcastByKey.set(key, priorBroadcasts + 1);
      state.titleBroadcasts.set(program.title, (state.titleBroadcasts.get(program.title) || 0) + 1);

      const stars = getProgramStars(program.title, program.categoryId);
      const starFactor = 0.82 + (stars * 0.09);
      const isRediff = status === "rediffusion";
      const rediffPenalty = isRediff
        ? Math.max(0.45, 0.94 - (priorRediffusions * 0.07))
        : 1.06;
      const staffAdjustment = computeProgramStaffAdjustment(channel.id, program, runtimeMeta);
      const staffFactor = 1 + staffAdjustment;
      const randomNudge = 0.96 + ((hashString(`${channel.id}:${minute}:${key}`) % 10) / 100);
      const score = Math.max(
        0.05,
        hourBaseFactor(minute) * categoryHourFactor * categoryFactor * profileFactor * starFactor * rediffPenalty * staffFactor * randomNudge
      );
      scores.push({
        channelId: channel.id,
        score,
        program,
        status,
        stars,
        priorRediffusions,
        staffAdjustment
      });
    });
    return scores;
  }

  function simulateDay(dayKey, playerName, playerDayRaw, options) {
    PROGRAM_STARS_CACHE.clear();
    PROGRAM_RUNTIME_META_CACHE.clear();
    STAFF_MEMBER_CACHE.clear();

    const opts = options && typeof options === "object" ? options : {};
    const playerEntries = normalizePlayerDay(playerDayRaw);
    const playerSchedule = buildTimedScheduleFromEntries(playerEntries);
    const channels = [
      { id: "player", name: playerName || "Ta chaîne", type: "player", weights: { information: 1.0, divertissement: 1.0, films: 1.0, series: 1.0, magazines: 1.0, jeunesse: 1.0, documentaires: 1.0, realite: 1.0, culture: 1.0 }, schedule: playerSchedule }
    ];

    COMPETITORS.forEach((comp) => {
      channels.push({
        id: comp.id,
        name: comp.name,
        type: comp.type,
        weights: comp.weights,
        schedule: generateCompetitorDay(comp.id, comp.type, dayKey)
      });
    });

    const totals = {};
    channels.forEach((channel) => {
      totals[channel.id] = 0;
    });

    const details = [];
    const history = opts.sessionData
      ? buildPlayerHistoryContext(opts.sessionData, opts.dateKey || null)
      : null;
    const channelStates = createChannelStates(channels, history);

    for (let minute = DAY_START; minute < DAY_END; minute += SLOT_SIZE) {
      const slotScores = computeSlotScores(channels, minute, channelStates);
      const totalScore = slotScores.reduce((sum, item) => sum + item.score, 0) || 1;
      const shares = {};
      slotScores.forEach((item) => {
        const share = (item.score / totalScore) * 100;
        totals[item.channelId] += share;
        shares[item.channelId] = {
          share,
          program: item.program,
          status: item.status,
          stars: item.stars,
          priorRediffusions: item.priorRediffusions,
          staffAdjustment: Number.isFinite(Number(item.staffAdjustment)) ? Number(item.staffAdjustment) : 0
        };
      });

      details.push({
        start: minute,
        end: minute + SLOT_SIZE,
        shares
      });
    }

    const slotCount = details.length || 1;
    const ranking = channels
      .map((channel) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        share: totals[channel.id] / slotCount
      }))
      .sort((a, b) => b.share - a.share);

    return {
      channels,
      ranking,
      details,
      playerRediffusionStats: buildPlayerRediffusionSummary(channelStates.player || {
        broadcastByKey: new Map(),
        titleBroadcasts: new Map()
      })
    };
  }

  window.AudienceEngine = {
    DAYS,
    DAY_LABELS: {
      lundi: "Lundi",
      mardi: "Mardi",
      mercredi: "Mercredi",
      jeudi: "Jeudi",
      vendredi: "Vendredi",
      samedi: "Samedi",
      dimanche: "Dimanche"
    },
    DIFFUSION_LABELS,
    CATEGORY_BY_PROGRAM,
    CATEGORY_COLOR_CLASSES: {
      information: "category-information",
      divertissement: "category-divertissement",
      films: "category-films",
      series: "category-series",
      magazines: "category-magazines",
      jeunesse: "category-jeunesse",
      documentaires: "category-documentaires",
      realite: "category-realite",
      culture: "category-culture"
    },
    STAFF_AUDIENCE_TUNING_DEFAULTS: DEFAULT_STAFF_AUDIENCE_TUNING,
    STAFF_AUDIENCE_TUNING: STAFF_AUDIENCE_TUNING,
    readPlayerWeek: function readPlayerWeekFor(sessionData) {
      const id = sessionData.email || sessionData.username || "player";
      const rawDateGrid = localStorage.getItem(`${DATE_GRID_KEY_PREFIX}${id}`);
      if (!rawDateGrid) return createEmptyWeekMap();
      try {
        const parsed = JSON.parse(rawDateGrid);
        if (!parsed || typeof parsed !== "object") return createEmptyWeekMap();
        const weekMap = createEmptyWeekMap();
        const latestByDay = {};
        Object.keys(parsed)
          .sort()
          .forEach((dateKey) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))) return;
            const [year, month, day] = String(dateKey).split("-").map(Number);
            const date = new Date(year, (month || 1) - 1, day || 1);
            const dayKey = DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1];
            if (!dayKey) return;
            latestByDay[dayKey] = normalizePlayerDay(parsed[dateKey]);
          });
        DAYS.forEach((dayKey) => {
          weekMap[dayKey] = Array.isArray(latestByDay[dayKey]) ? latestByDay[dayKey] : [];
        });
        return weekMap;
      } catch {
        return createEmptyWeekMap();
      }
    },
    getProgramDuration,
    formatMinute,
    simulateDay
  };
})();
