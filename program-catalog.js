(function programCatalogInit() {
  const sessionUtils = window.SessionUtils;
  const appKeys = (sessionUtils && sessionUtils.APP_KEYS) || {};
  const OWNED_KEY_PREFIX = appKeys.OWNED_KEY_PREFIX || "tv_manager_owned_programs_";
  const OWNED_DETAILS_KEY_PREFIX = appKeys.OWNED_DETAILS_KEY_PREFIX || "tv_manager_owned_program_details_";
  const STUDIO_KEY_PREFIX = appKeys.STUDIO_KEY_PREFIX || "tv_manager_studio_";
  const STUDIO_PRODUCTIONS_KEY_PREFIX = appKeys.STUDIO_PRODUCTIONS_KEY_PREFIX || "tv_manager_studio_productions_";
  const DATE_GRID_KEY_PREFIX = appKeys.DATE_GRID_KEY_PREFIX || "tv_manager_date_grid_";
  const STUDIO_SCHEDULE_KEY_PREFIX = appKeys.STUDIO_SCHEDULE_KEY_PREFIX || "tv_manager_studio_schedule_";
  const DYNAMIC_FILMS_KEY_PREFIX = appKeys.DYNAMIC_FILMS_KEY_PREFIX || "tv_manager_dynamic_films_";
  const DYNAMIC_FILMS_REVISION_KEY_PREFIX = appKeys.DYNAMIC_FILMS_REVISION_KEY_PREFIX || "tv_manager_dynamic_films_revision_";
  const DYNAMIC_CATEGORY_KEY_PREFIX = appKeys.DYNAMIC_CATEGORY_KEY_PREFIX || "tv_manager_dynamic_category_";
  const DYNAMIC_CATEGORY_REVISION_KEY_PREFIX = appKeys.DYNAMIC_CATEGORY_REVISION_KEY_PREFIX || "tv_manager_dynamic_category_revision_";
  const diffusionRules = window.DiffusionRules;
  const MARKET_PROGRAMS_PER_TYPE = 10;
  const GENERATED_FILMS_COUNT = MARKET_PROGRAMS_PER_TYPE;
  const FILMS_MARKET_MAX = MARKET_PROGRAMS_PER_TYPE;
  const PROGRAM_AGE_CLASSIFICATIONS = ["TP", "-10", "-12", "-16"];
  const PROGRAM_STAR_PRICE_MULTIPLIER = {
    0.5: 0.64,
    1: 0.72,
    1.5: 0.79,
    2: 0.86,
    2.5: 0.93,
    3: 1.0,
    3.5: 1.11,
    4: 1.22,
    4.5: 1.35,
    5: 1.48
  };
  const CATEGORY_PRICE_MULTIPLIER = {
    information: 1,
    divertissement: 8.8,
    films: 12.5,
    series: 10.8,
    magazines: 6.7,
    jeunesse: 5.9,
    documentaires: 7.9,
    realite: 9.2,
    culture: 6.3
  };
  const CATEGORY_PRICE_FLOOR = {
    information: 0,
    divertissement: 600000,
    films: 450000,
    series: 700000,
    magazines: 260000,
    jeunesse: 190000,
    documentaires: 320000,
    realite: 560000,
    culture: 230000
  };
  const CATEGORY_EPISODE_BONUS = {
    divertissement: 22000,
    series: 30000,
    magazines: 9000,
    jeunesse: 7000,
    realite: 18000
  };
  const PRODUCTION_BUDGET_LEVELS = Object.freeze({
    low: { id: "low", label: "Faible", setupMultiplier: 0.84, runMultiplier: 0.9, starsBonus: -0.5 },
    medium: { id: "medium", label: "Moyen", setupMultiplier: 1, runMultiplier: 1, starsBonus: 0 },
    high: { id: "high", label: "Élevé", setupMultiplier: 1.22, runMultiplier: 1.18, starsBonus: 0.5 }
  });
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
  const CATEGORY_SUBTYPE_OPTIONS = {
    information: ["JT", "Météo", "Économie", "Politique", "Matinale", "International", "Faits divers", "Culture", "Santé", "Sport flash"],
    divertissement: ["Jeu", "Variété", "Humour", "Talk-show", "Prime", "Talent-show"],
    magazines: ["Société", "Conso", "Culture", "Santé", "Lifestyle", "Investigation"],
    jeunesse: ["Éducatif", "Animation", "Jeu", "Aventure", "Découverte"],
    documentaires: ["Nature", "Histoire", "Science", "Société", "Investigation"],
    realite: ["Compétition", "Vie quotidienne", "Aventure", "Cuisine", "Dating"],
    culture: ["Concert", "Théâtre", "Opéra", "Danse", "Arts visuels"]
  };
  const SUBTYPELESS_CATEGORY_IDS = new Set(["films", "series"]);
  const CATEGORY_SUBTYPE_KEYWORD_RULES = {
    information: [
      { subtype: "Météo", keywords: ["meteo"] },
      { subtype: "Économie", keywords: ["eco", "economie", "business"] },
      { subtype: "Politique", keywords: ["politique", "assemblee", "senat"] },
      { subtype: "Matinale", keywords: ["matinale", "6/8", "morning", "reveil"] },
      { subtype: "International", keywords: ["international", "monde", "etranger"] },
      { subtype: "Faits divers", keywords: ["faits divers", "crime", "police", "accident"] },
      { subtype: "Culture", keywords: ["culture", "arts", "spectacle"] },
      { subtype: "Santé", keywords: ["sante", "medical", "hopital"] },
      { subtype: "Sport flash", keywords: ["sport", "match", "flash"] },
      { subtype: "JT", keywords: ["journal", "jt", "edition"] }
    ],
    divertissement: [
      { subtype: "Talk-show", keywords: ["talk", "debat", "interview"] },
      { subtype: "Humour", keywords: ["humour", "rire", "stand-up", "comedy"] },
      { subtype: "Jeu", keywords: ["quiz", "jeu", "challenge", "defi"] },
      { subtype: "Talent-show", keywords: ["talent", "stars", "champions"] },
      { subtype: "Prime", keywords: ["prime", "soiree", "festival"] },
      { subtype: "Variété", keywords: ["variete", "show", "spectacle"] }
    ],
    magazines: [
      { subtype: "Conso", keywords: ["conso", "consommation", "auto", "budget", "maison", "deco", "deco", "cuisine"] },
      { subtype: "Santé", keywords: ["sante", "medical", "bien-etre", "bien etre"] },
      { subtype: "Investigation", keywords: ["enquete", "investigation", "dossier"] },
      { subtype: "Culture", keywords: ["culture", "arts", "scene", "musique"] },
      { subtype: "Société", keywords: ["societe", "quotidien", "regards", "focus"] },
      { subtype: "Lifestyle", keywords: ["voyage", "evasion", "lifestyle", "vivre", "weekend", "week-end"] }
    ],
    jeunesse: [
      { subtype: "Animation", keywords: ["cartoon", "animation"] },
      { subtype: "Jeu", keywords: ["quiz", "jeu", "challenge"] },
      { subtype: "Éducatif", keywords: ["science", "educatif", "college", "junior"] },
      { subtype: "Aventure", keywords: ["mission", "aventuriers", "quest", "explorer"] },
      { subtype: "Découverte", keywords: ["curieux", "decouverte", "lab", "universe"] }
    ],
    documentaires: [
      { subtype: "Nature", keywords: ["terres", "ocean", "planete", "sauvage"] },
      { subtype: "Histoire", keywords: ["histoire", "civilisation", "memoire", "histori"] },
      { subtype: "Science", keywords: ["science", "inventeurs", "futur"] },
      { subtype: "Investigation", keywords: ["enquete", "criminel", "investigation"] },
      { subtype: "Société", keywords: ["societe", "monde", "routes"] }
    ],
    realite: [
      { subtype: "Compétition", keywords: ["challenge", "rivals", "duel", "competition", "academy"] },
      { subtype: "Vie quotidienne", keywords: ["loft", "coloc", "maison", "famille", "nouvelle vie"] },
      { subtype: "Aventure", keywords: ["survie", "ranch", "mission", "aventure"] },
      { subtype: "Cuisine", keywords: ["cuisine", "chef"] },
      { subtype: "Dating", keywords: ["dating", "mariage", "amour"] }
    ],
    culture: [
      { subtype: "Concert", keywords: ["concert", "recital", "acoustique", "musique"] },
      { subtype: "Danse", keywords: ["ballet", "danse"] },
      { subtype: "Théâtre", keywords: ["theatre", "piece"] },
      { subtype: "Opéra", keywords: ["opera"] },
      { subtype: "Arts visuels", keywords: ["arts visuels", "artistique", "culture"] }
    ]
  };
  const CATEGORIES = [
    { id: "information", name: "Informations", colorClass: "category-information", programs: [
      { title: "JT Quotidien", price: 25000, defaultOwned: true },
      { title: "Le 6/8 Matin", price: 20000, defaultOwned: true },
      { title: "Journal de Midi", price: 22000, defaultOwned: true },
      { title: "JT National 13h", price: 32000, defaultOwned: true },
      { title: "Le Grand Débat", price: 38000, defaultOwned: false },
      { title: "Briefing International", price: 30000, defaultOwned: false },
      { title: "Éco Express", price: 28000, defaultOwned: false },
      { title: "Info Régions", price: 26000, defaultOwned: false },
      { title: "Édition spéciale", price: 34000, defaultOwned: false }
    ] },
    { id: "divertissement", name: "Divertissements", colorClass: "category-divertissement", programs: [
      { title: "Soirée Stand-Up", price: 65000, defaultOwned: true, seasons: 6, episodesPerSeason: 12 },
      { title: "Le Grand Défi Live", price: 70000, defaultOwned: true, seasons: 8, episodesPerSeason: 10 },
      { title: "Famille en Jeu", price: 62000, defaultOwned: true, seasons: 5, episodesPerSeason: 16 },
      { title: "Quiz Arena", price: 55000, defaultOwned: true, seasons: 7, episodesPerSeason: 20 },
      { title: "Prime Spectacle", price: 68000, defaultOwned: false, seasons: 10, episodesPerSeason: 8 },
      { title: "Comedy Factory", price: 60000, defaultOwned: false, seasons: 4, episodesPerSeason: 14 },
      { title: "Talent Avenue", price: 80000, defaultOwned: false, seasons: 9, episodesPerSeason: 12 },
      { title: "Blind Test XXL", price: 59000, defaultOwned: false, seasons: 6, episodesPerSeason: 18 }
    ] },
    { id: "films", name: "Films", colorClass: "category-films", programs: [
      { title: "Film Action Prime", price: 120000, defaultOwned: true },
      { title: "Comédie Romantique", price: 90000, defaultOwned: true },
      { title: "Thriller Urbain", price: 110000, defaultOwned: true },
      { title: "Cinéma Français", price: 85000, defaultOwned: true },
      { title: "Aventure Fantastique", price: 130000, defaultOwned: false },
      { title: "Film Historique", price: 100000, defaultOwned: false },
      { title: "Polar du Soir", price: 98000, defaultOwned: false },
      { title: "Classique du Dimanche", price: 78000, defaultOwned: false }
    ] },
    { id: "series", name: "Séries", colorClass: "category-series", programs: [
      { title: "Unité 51", price: 72000, defaultOwned: true, seasons: 4, episodesPerSeason: 12 },
      { title: "Les Héritiers", price: 68000, defaultOwned: true, seasons: 5, episodesPerSeason: 10 },
      { title: "Police District", price: 76000, defaultOwned: true, seasons: 6, episodesPerSeason: 12 },
      { title: "Campus 24", price: 52000, defaultOwned: true, seasons: 3, episodesPerSeason: 8 },
      { title: "Chroniques Médicales", price: 82000, defaultOwned: false, seasons: 7, episodesPerSeason: 14 },
      { title: "Code Rouge", price: 71000, defaultOwned: false, seasons: 4, episodesPerSeason: 10 },
      { title: "Mystères en Ville", price: 70000, defaultOwned: false, seasons: 5, episodesPerSeason: 12 },
      { title: "Saga Familiale", price: 66000, defaultOwned: false, seasons: 8, episodesPerSeason: 16 }
    ] },
    { id: "magazines", name: "Magazines", colorClass: "category-magazines", programs: [
      { title: "Consommation & Vous", price: 34000, defaultOwned: true, seasons: 12, episodesPerSeason: 20 },
      { title: "Maison et Déco", price: 32000, defaultOwned: true, seasons: 10, episodesPerSeason: 18 },
      { title: "Destination Évasion", price: 36000, defaultOwned: true, seasons: 8, episodesPerSeason: 14 },
      { title: "Santé Pratique", price: 33000, defaultOwned: true, seasons: 9, episodesPerSeason: 16 },
      { title: "Auto Passion", price: 37000, defaultOwned: false, seasons: 7, episodesPerSeason: 12 },
      { title: "Vivre Mieux", price: 30000, defaultOwned: false, seasons: 11, episodesPerSeason: 15 },
      { title: "Enquête Société", price: 39000, defaultOwned: false, seasons: 6, episodesPerSeason: 10 },
      { title: "Cuisine de Saison", price: 31000, defaultOwned: false, seasons: 13, episodesPerSeason: 22 }
    ] },
    { id: "jeunesse", name: "Jeunesse", colorClass: "category-jeunesse", programs: [
      { title: "Les Aventuriers Mini", price: 24000, defaultOwned: true, seasons: 5, episodesPerSeason: 26 },
      { title: "Cartoon Planet", price: 26000, defaultOwned: true, seasons: 9, episodesPerSeason: 30 },
      { title: "Mission Collège", price: 22000, defaultOwned: true, seasons: 4, episodesPerSeason: 20 },
      { title: "Kids Quiz", price: 23000, defaultOwned: true, seasons: 8, episodesPerSeason: 24 },
      { title: "Studio Ados", price: 28000, defaultOwned: false, seasons: 6, episodesPerSeason: 18 },
      { title: "Les Petits Curieux", price: 20000, defaultOwned: false, seasons: 7, episodesPerSeason: 22 },
      { title: "Conte du Soir", price: 19000, defaultOwned: false, seasons: 10, episodesPerSeason: 28 },
      { title: "Science Junior", price: 25000, defaultOwned: false, seasons: 5, episodesPerSeason: 16 }
    ] },
    { id: "documentaires", name: "Documentaires", colorClass: "category-documentaires", programs: [
      { title: "Terres Sauvages", price: 42000, defaultOwned: true },
      { title: "Planète Bleue", price: 45000, defaultOwned: true },
      { title: "Grands Inventeurs", price: 40000, defaultOwned: true },
      { title: "Histoire Secrète", price: 43000, defaultOwned: true },
      { title: "Les Routes du Monde", price: 46000, defaultOwned: false },
      { title: "Enquêtes Criminelles", price: 48000, defaultOwned: false },
      { title: "Civilisations", price: 44000, defaultOwned: false },
      { title: "Océans Extrêmes", price: 47000, defaultOwned: false }
    ] },
    { id: "realite", name: "Télé-réalité", colorClass: "category-realite", programs: [
      { title: "Loft Rivals", price: 52000, defaultOwned: true, seasons: 11, episodesPerSeason: 14 },
      { title: "Objectif Cuisine", price: 50000, defaultOwned: true, seasons: 9, episodesPerSeason: 16 },
      { title: "Le Ranch des Célébrités", price: 56000, defaultOwned: true, seasons: 7, episodesPerSeason: 12 },
      { title: "Mariage Challenge", price: 53000, defaultOwned: true, seasons: 10, episodesPerSeason: 18 },
      { title: "Survivants Urbains", price: 62000, defaultOwned: false, seasons: 6, episodesPerSeason: 10 },
      { title: "Maison en Duel", price: 54000, defaultOwned: false, seasons: 8, episodesPerSeason: 13 },
      { title: "Coach Academy", price: 51000, defaultOwned: false, seasons: 5, episodesPerSeason: 11 },
      { title: "Nouvelle Vie", price: 49000, defaultOwned: false, seasons: 12, episodesPerSeason: 20 }
    ] },
    { id: "culture", name: "Culture & Musique", colorClass: "category-culture", programs: [
      { title: "Scène Ouverte", price: 35000, defaultOwned: true },
      { title: "Concert Privé", price: 42000, defaultOwned: true },
      { title: "L'Invité Culture", price: 33000, defaultOwned: true },
      { title: "Backstage Live", price: 38000, defaultOwned: true },
      { title: "Découverte Arts", price: 30000, defaultOwned: false },
      { title: "Théâtre à la Une", price: 41000, defaultOwned: false },
      { title: "Session Acoustique", price: 36000, defaultOwned: false },
      { title: "Musiques du Monde", price: 34000, defaultOwned: false }
    ] }
  ];

  const BASE_CATEGORY_TITLES = new Map(
    CATEGORIES.map((category) => [
      category.id,
      new Set((category.programs || []).map((program) => program.title))
    ])
  );

  const DYNAMIC_CATEGORY_IDS = CATEGORIES
    .filter((category) => category.id !== "information")
    .map((category) => category.id);

  const EPISODIC_CATEGORY_IDS = new Set(["divertissement", "series", "magazines", "jeunesse", "realite"]);

  const CATEGORY_TITLE_PARTS = {
    films: {
      first: ["Les", "Le", "La", "Un", "Une", "Chroniques", "Nuits", "Mission", "Retour", "Dernier", "Première", "Écho"],
      second: ["Ombres", "Frontières", "Légendes", "Serment", "Aube", "Tempête", "Mirage", "Vertige", "Complot", "Horizons", "Silence", "Traque", "Alliance", "Revanche"],
      third: ["de Minuit", "Interdite", "à Paris", "du Futur", "Nocturne", "Sauvage", "Ultime", "en Fuite", "Perdu", "Secret", "Sous Pression", "Sans Retour"]
    },
    divertissement: {
      first: ["Show", "Nuit", "Festival", "Défi", "Soirée", "Arena", "Scène", "Prime"],
      second: ["des Talents", "des Rires", "des Stars", "Live", "en Direct", "du Public", "Challenge", "des Champions"],
      third: ["Édition", "Event", "Session", "Spéciale", "Hebdo", "Studio", "Grand Format", "All Stars"]
    },
    series: {
      first: ["Brigade", "District", "Chroniques", "Zone", "Cellule", "Syndrome", "Rivages", "Destins"],
      second: ["Noire", "21", "Urbaine", "Alpha", "Rouge", "Secrète", "Atlantique", "Interdite"],
      third: ["Saison", "Chapitre", "Origines", "Dossiers", "Enquêtes", "Réseau", "Alliance", "Trajectoire"]
    },
    magazines: {
      first: ["Le", "Planète", "Focus", "Capsule", "Regards", "Objectif", "Minute", "Vivre"],
      second: ["Quotidien", "Pratique", "Société", "Maison", "Conso", "Auto", "Business", "Voyage"],
      third: ["Hebdo", "Expert", "Conseils", "360", "Direct", "Mag", "Weekend", "Plus"]
    },
    jeunesse: {
      first: ["Kids", "Mini", "Junior", "Club", "Studio", "Mission", "Team", "Aventures"],
      second: ["Academy", "Planet", "Express", "Max", "Fun", "Quest", "Lab", "Galaxy"],
      third: ["Episode", "Show", "Challenge", "Story", "Explorers", "Action", "Ados", "Universe"]
    },
    documentaires: {
      first: ["Terres", "Planète", "Horizons", "Mémoires", "Routes", "Civilisations", "Enquêtes", "Secrets"],
      second: ["Inconnues", "Sauvages", "Perdues", "Historiques", "Marines", "du Monde", "d'Hier", "du Futur"],
      third: ["Doc", "Investigation", "Grand Format", "Collection", "Chronique", "Exploration", "Atlas", "Vision"]
    },
    realite: {
      first: ["Maison", "Loft", "Arena", "Objectif", "Nouvelle", "Survie", "Famille", "Campus"],
      second: ["Challenge", "Extreme", "Star", "Coloc", "Ultime", "Academy", "Rivals", "Mission"],
      third: ["Live", "Experience", "Saison", "Week-end", "Story", "Session", "Prime", "Edition"]
    },
    culture: {
      first: ["Scène", "Session", "Backstage", "Studio", "Vibrations", "Rythmes", "Open", "Culture"],
      second: ["Live", "Acoustique", "Classique", "Urbaine", "Monde", "Concert", "Mix", "Artistique"],
      third: ["Édition", "Collection", "Rendez-vous", "Nuits", "Hebdo", "Direct", "Spéciale", "Masterclass"]
    }
  };

  const TITLE_SUFFIX_CLEANUP_BY_CATEGORY = {
    culture: [
      "Pièce de théâtre",
      "Piece de theatre",
      "Concert",
      "Opéra",
      "Opera",
      "Ballet",
      "Récital",
      "Recital",
      "Danse",
      "Théâtre",
      "Theatre",
      "Arts visuels"
    ],
    divertissement: [
      "Jeu",
      "Variété",
      "Variete",
      "Humour",
      "Talk-show",
      "Prime",
      "Talent-show",
      "Jeu TV"
    ]
  };

  const CATEGORY_DYNAMIC_CONFIG = {
    films: { generatedCount: GENERATED_FILMS_COUNT, marketMax: FILMS_MARKET_MAX },
    divertissement: { generatedCount: MARKET_PROGRAMS_PER_TYPE, marketMax: MARKET_PROGRAMS_PER_TYPE },
    series: { generatedCount: MARKET_PROGRAMS_PER_TYPE, marketMax: MARKET_PROGRAMS_PER_TYPE },
    magazines: { generatedCount: MARKET_PROGRAMS_PER_TYPE, marketMax: MARKET_PROGRAMS_PER_TYPE },
    jeunesse: { generatedCount: MARKET_PROGRAMS_PER_TYPE, marketMax: MARKET_PROGRAMS_PER_TYPE },
    documentaires: { generatedCount: MARKET_PROGRAMS_PER_TYPE, marketMax: MARKET_PROGRAMS_PER_TYPE },
    realite: { generatedCount: MARKET_PROGRAMS_PER_TYPE, marketMax: MARKET_PROGRAMS_PER_TYPE },
    culture: { generatedCount: MARKET_PROGRAMS_PER_TYPE, marketMax: MARKET_PROGRAMS_PER_TYPE }
  };

  const EXTERNAL_REDIFFUSION_PROBABILITY = {
    films: 36,
    divertissement: 42,
    series: 40,
    magazines: 28,
    jeunesse: 34,
    documentaires: 30,
    realite: 46,
    culture: 32
  };
  const EXTERNAL_REDIFFUSION_SEASON_BONUS = 8;
  const STARTER_PACK_BY_CATEGORY = {
    culture: 3,
    divertissement: 3,
    documentaires: 5,
    films: 10,
    information: 0,
    jeunesse: 3,
    magazines: 4,
    series: 8,
    realite: 2
  };

  function dynamicCategoryKey(sessionData, categoryId) {
    if (categoryId === "films") return `${DYNAMIC_FILMS_KEY_PREFIX}${getPlayerId(sessionData)}`;
    return `${DYNAMIC_CATEGORY_KEY_PREFIX}${getPlayerId(sessionData)}_${categoryId}`;
  }

  function dynamicCategoryRevisionKey(sessionData, categoryId) {
    if (categoryId === "films") return `${DYNAMIC_FILMS_REVISION_KEY_PREFIX}${getPlayerId(sessionData)}`;
    return `${DYNAMIC_CATEGORY_REVISION_KEY_PREFIX}${getPlayerId(sessionData)}_${categoryId}`;
  }

  function getDynamicCategoryRevision(sessionData, categoryId) {
    const raw = localStorage.getItem(dynamicCategoryRevisionKey(sessionData, categoryId));
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  }

  function setDynamicCategoryRevision(sessionData, categoryId, revision) {
    localStorage.setItem(
      dynamicCategoryRevisionKey(sessionData, categoryId),
      String(Math.max(0, Math.floor(revision)))
    );
  }

  function hashString(value) {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash * 31) + value.charCodeAt(index)) >>> 0;
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

  function toDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getWeeklyMarketRefreshAnchor(date) {
    const current = new Date(date);
    current.setHours(0, 0, 0, 0);
    const weekday = current.getDay(); // 0=dimanche, 1=lundi
    const monday = new Date(current);
    monday.setDate(current.getDate() - ((weekday + 6) % 7));
    return monday;
  }

  function pickCategoryOfferTitles(sessionData, categoryId, titlesPool) {
    if (!Array.isArray(titlesPool) || titlesPool.length === 0) return [];
    const categoryConfig = CATEGORY_DYNAMIC_CONFIG[categoryId] || {};
    if (!Number(categoryConfig.marketMax) || Number(categoryConfig.marketMax) <= 0) {
      return titlesPool.slice();
    }
    const anchor = getWeeklyMarketRefreshAnchor(new Date());
    const anchorKey = toDateKey(anchor);
    const rand = seededRandom(hashString(`${getPlayerId(sessionData)}::${anchorKey}::${categoryId}_offer`));
    const shuffled = titlesPool.slice();
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const pick = Math.floor(rand() * (index + 1));
      const tmp = shuffled[index];
      shuffled[index] = shuffled[pick];
      shuffled[pick] = tmp;
    }
    return shuffled.slice(0, Math.min(Number(categoryConfig.marketMax), shuffled.length));
  }

  function categoryById(categoryId) {
    return CATEGORIES.find((category) => category.id === categoryId) || null;
  }

  function computeCategoryRanges(category) {
    const baseTitles = BASE_CATEGORY_TITLES.get(category.id);
    const sourcePrograms = baseTitles
      ? (category.programs || []).filter((program) => baseTitles.has(program.title))
      : (category.programs || []);
    const prices = sourcePrograms
      .map((program) => Number(program.price))
      .filter((value) => Number.isFinite(value) && value > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : 20000;
    const maxPrice = prices.length > 0 ? Math.max(...prices) : Math.max(minPrice + 10000, 60000);

    const episodicPrograms = sourcePrograms
      .filter((program) => Number(program.seasons) > 0 && Number(program.episodesPerSeason) > 0);
    const seasons = episodicPrograms.map((program) => Number(program.seasons));
    const episodes = episodicPrograms.map((program) => Number(program.episodesPerSeason));
    return {
      minPrice,
      maxPrice,
      seasonsMin: seasons.length > 0 ? Math.min(...seasons) : null,
      seasonsMax: seasons.length > 0 ? Math.max(...seasons) : null,
      episodesMin: episodes.length > 0 ? Math.min(...episodes) : null,
      episodesMax: episodes.length > 0 ? Math.max(...episodes) : null
    };
  }

  function normalizeDynamicProgramEntry(raw, categoryId) {
    if (!raw || typeof raw !== "object") return null;
    const title = cleanupCategoryProgramTitle(
      categoryId,
      typeof raw.title === "string" ? raw.title.trim() : ""
    );
    if (!title) return null;
    const category = categoryById(categoryId);
    const ranges = computeCategoryRanges(category || { programs: [] });
    const price = Number(raw.price);
    const normalized = {
      title,
      price: Number.isFinite(price) && price > 0 ? Math.round(price) : Math.round(ranges.minPrice),
      defaultOwned: false
    };
    if (EPISODIC_CATEGORY_IDS.has(categoryId)) {
      const seasons = Number(raw.seasons);
      const episodesPerSeason = Number(raw.episodesPerSeason);
      if (Number.isFinite(seasons) && seasons > 0 && Number.isFinite(episodesPerSeason) && episodesPerSeason > 0) {
        normalized.seasons = Math.floor(seasons);
        normalized.episodesPerSeason = Math.floor(episodesPerSeason);
      }
    }
    if (raw.externalStatus === "rediffusion") {
      normalized.externalStatus = "rediffusion";
    }
    if (Number(raw.externalDiffusionCount) > 0) {
      normalized.externalDiffusionCount = Math.floor(Number(raw.externalDiffusionCount));
    }
    return normalized;
  }

  function pickGeneratedSeasonCount(categoryId, seed) {
    if (!EPISODIC_CATEGORY_IDS.has(categoryId)) return null;
    const roll = seed % 100;
    if (roll < 46) return 1;
    if (roll < 76) return 2;
    if (roll < 92) return 3;
    return 4;
  }

  function computeExternalStatus(categoryId, seed, seasons) {
    const baseChance = Number(EXTERNAL_REDIFFUSION_PROBABILITY[categoryId]) || 0;
    const seasonCount = Number(seasons) > 0 ? Number(seasons) : 1;
    const chance = Math.min(92, baseChance + Math.max(0, seasonCount - 1) * EXTERNAL_REDIFFUSION_SEASON_BONUS);
    const roll = (Math.floor(seed / 13) % 100);
    return roll < chance ? "rediffusion" : "inedit";
  }

  function computeExternalDiffusionCount(categoryId, seed, seasons, status) {
    if (status !== "rediffusion") return 0;
    const seasonCount = Number(seasons) > 0 ? Number(seasons) : 1;
    const base = 1 + (Math.floor(seed / 17) % 5);
    const seasonBonus = Math.max(0, seasonCount - 1) * (1 + (Math.floor(seed / 29) % 2));
    return Math.min(20, base + seasonBonus);
  }

  function generateDynamicProgramTitle(usedTitles, categoryId, seed) {
    if (categoryId === "culture") {
      const parts = CATEGORY_TITLE_PARTS.culture || CATEGORY_TITLE_PARTS.films;
      const first = parts.first[seed % parts.first.length];
      const second = parts.second[Math.floor(seed / 3) % parts.second.length];
      const third = parts.third[Math.floor(seed / 7) % parts.third.length];
      let cultureTitle = `${first} ${second} ${third}`.replace(/\s+/g, " ").trim();
      if (usedTitles.has(cultureTitle)) {
        cultureTitle = `${cultureTitle} ${1 + (Math.floor(seed / 13) % 9)}`;
      }
      return cultureTitle;
    }

    const parts = CATEGORY_TITLE_PARTS[categoryId] || CATEGORY_TITLE_PARTS.films;
    const first = parts.first[seed % parts.first.length];
    const second = parts.second[Math.floor(seed / 3) % parts.second.length];
    const third = parts.third[Math.floor(seed / 7) % parts.third.length];
    let title = `${first} ${second} ${third}`.replace(/\s+/g, " ").trim();
    if (usedTitles.has(title)) {
      title = `${title} ${1 + (seed % 9)}`;
    }
    return title;
  }

  function generateDynamicPrograms(sessionData, categoryId, revision) {
    const category = categoryById(categoryId);
    if (!category) return [];
    const categoryConfig = CATEGORY_DYNAMIC_CONFIG[categoryId] || { generatedCount: 8 };
    const ranges = computeCategoryRanges(category);
    const generated = [];
    const usedTitles = new Set();
    const safeRevision = Number.isFinite(Number(revision)) ? Math.floor(Number(revision)) : 0;
    const playerHashBase = (`${getPlayerId(sessionData)}::${categoryId}`)
      .split("")
      .reduce((acc, char) => (acc * 33 + char.charCodeAt(0)) >>> 0, 5381);
    const revisionSeed = hashString(`${safeRevision}`);

    for (let index = 0; index < Number(categoryConfig.generatedCount || 0); index += 1) {
      const seed = playerHashBase + revisionSeed + (index * 97);
      const title = generateDynamicProgramTitle(usedTitles, categoryId, seed);
      usedTitles.add(title);
      const spread = Math.max(1, ranges.maxPrice - ranges.minPrice + 1);
      const price = ranges.minPrice + (seed % spread);
      const program = {
        title,
        price,
        defaultOwned: false
      };
      if (EPISODIC_CATEGORY_IDS.has(categoryId)) {
        const episodesMin = Math.max(8, ranges.episodesMin || 8);
        const episodesMax = Math.max(episodesMin, ranges.episodesMax || 24);
        const episodeSpread = Math.max(1, episodesMax - episodesMin + 1);
        program.seasons = pickGeneratedSeasonCount(categoryId, seed);
        program.episodesPerSeason = episodesMin + (Math.floor(seed / 11) % episodeSpread);
      }
      program.externalStatus = computeExternalStatus(categoryId, seed, program.seasons || 1);
      program.externalDiffusionCount = computeExternalDiffusionCount(
        categoryId,
        seed,
        program.seasons || 1,
        program.externalStatus
      );
      generated.push(program);
    }
    return generated;
  }

  function ensureDynamicProgramsForCategory(sessionData, categoryId) {
    const category = categoryById(categoryId);
    if (!category) return;

    const key = dynamicCategoryKey(sessionData, categoryId);
    let dynamicPrograms = [];
    let shouldRewriteStore = false;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const seenNormalizedTitles = new Set();
          dynamicPrograms = parsed
            .map((entry) => normalizeDynamicProgramEntry(entry, categoryId))
            .filter((entry) => {
              if (!entry) return false;
              const normalized = normalizeToken(entry.title);
              if (!normalized || seenNormalizedTitles.has(normalized)) {
                shouldRewriteStore = true;
                return false;
              }
              seenNormalizedTitles.add(normalized);
              return true;
            });
          if (Array.isArray(parsed) && parsed.length !== dynamicPrograms.length) {
            shouldRewriteStore = true;
          } else if (Array.isArray(parsed)) {
            for (let i = 0; i < parsed.length; i += 1) {
              const sourceTitle = typeof parsed[i] === "object" && parsed[i] ? String(parsed[i].title || "") : "";
              const targetTitle = dynamicPrograms[i] ? String(dynamicPrograms[i].title || "") : "";
              if (sourceTitle && targetTitle && sourceTitle !== targetTitle) {
                shouldRewriteStore = true;
                break;
              }
            }
          }
        }
      } catch {
        dynamicPrograms = [];
      }
    }

    const categoryConfig = CATEGORY_DYNAMIC_CONFIG[categoryId] || {};
    const generatedCount = Math.max(1, Number(categoryConfig.generatedCount) || MARKET_PROGRAMS_PER_TYPE);
    if (dynamicPrograms.length > generatedCount) {
      dynamicPrograms = dynamicPrograms.slice(0, generatedCount);
      shouldRewriteStore = true;
      localStorage.setItem(key, JSON.stringify(dynamicPrograms));
    }

    if (dynamicPrograms.length === 0) {
      dynamicPrograms = generateDynamicPrograms(sessionData, categoryId, getDynamicCategoryRevision(sessionData, categoryId));
      shouldRewriteStore = true;
      localStorage.setItem(key, JSON.stringify(dynamicPrograms));
    }

    if (shouldRewriteStore) {
      localStorage.setItem(key, JSON.stringify(dynamicPrograms));
    }

    dynamicPrograms.forEach((entry) => {
      if (!category.programs.some((program) => program.title === entry.title)) {
        category.programs.push({ ...entry });
      }
    });
  }

  function ensureDynamicPrograms(sessionData) {
    DYNAMIC_CATEGORY_IDS.forEach((categoryId) => ensureDynamicProgramsForCategory(sessionData, categoryId));
  }

  function regenerateDynamicProgramsForCategory(sessionData, categoryId) {
    if (!DYNAMIC_CATEGORY_IDS.includes(categoryId)) {
      return { ok: false, message: "Catégorie introuvable." };
    }
    const category = categoryById(categoryId);
    if (!category) return { ok: false, message: "Catégorie introuvable." };

    const key = dynamicCategoryKey(sessionData, categoryId);
    const previousRaw = localStorage.getItem(key);
    const previousDynamicTitles = new Set();
    if (previousRaw) {
      try {
        const parsed = JSON.parse(previousRaw);
        if (Array.isArray(parsed)) {
          parsed
            .map((entry) => normalizeDynamicProgramEntry(entry, categoryId))
            .filter(Boolean)
            .forEach((entry) => previousDynamicTitles.add(entry.title));
        }
      } catch {
        // Ignore corrupted value.
      }
    }

    const owned = ensureOwnedTitles(sessionData);
    const baseTitles = BASE_CATEGORY_TITLES.get(categoryId) || new Set();
    category.programs = category.programs.filter((program) => {
      if (baseTitles.has(program.title)) return true;
      if (!previousDynamicTitles.has(program.title)) return true;
      return owned.has(program.title);
    });

    const nextRevision = getDynamicCategoryRevision(sessionData, categoryId) + 1;
    setDynamicCategoryRevision(sessionData, categoryId, nextRevision);
    const nextDynamicPrograms = generateDynamicPrograms(sessionData, categoryId, nextRevision);
    localStorage.setItem(key, JSON.stringify(nextDynamicPrograms));
    ensureDynamicProgramsForCategory(sessionData, categoryId);
    return {
      ok: true,
      message: `Marché ${category.name} régénéré.`,
      count: nextDynamicPrograms.length,
      categoryId,
      categoryName: category.name
    };
  }

  function regenerateAllDynamicPrograms(sessionData) {
    const results = DYNAMIC_CATEGORY_IDS.map((categoryId) => regenerateDynamicProgramsForCategory(sessionData, categoryId));
    const failures = results.filter((result) => !result || !result.ok);
    if (failures.length > 0) {
      return { ok: false, message: "Certaines catégories n'ont pas pu être régénérées.", details: results };
    }
    const total = results.reduce((sum, result) => sum + (Number(result.count) || 0), 0);
    return { ok: true, message: "Tous les marchés ont été régénérés.", total, details: results };
  }

  function regenerateDynamicFilms(sessionData) {
    return regenerateDynamicProgramsForCategory(sessionData, "films");
  }

  function getProgramClassification(sessionData, categoryId, title) {
    const seed = hashString(`${getPlayerId(sessionData)}::${categoryId}::program_meta::${title}`);
    const roll = seed % 100;
    // Weighted rarity on half-star steps: higher stars remain intentionally less frequent.
    const stars = roll < 12 ? 0.5
      : roll < 27 ? 1
      : roll < 42 ? 1.5
      : roll < 56 ? 2
      : roll < 68 ? 2.5
      : roll < 79 ? 3
      : roll < 88 ? 3.5
      : roll < 94 ? 4
      : roll < 98 ? 4.5
      : 5;
    // Keep -16 less frequent for non-crypted channel context.
    const ageRoll = (seed >>> 3) % 100;
    const ageRating = categoryId === "jeunesse"
      ? "TP"
      : ageRoll < 38 ? "TP"
      : ageRoll < 70 ? "-10"
      : ageRoll < 94 ? "-12"
      : "-16";
    return { stars, ageRating };
  }

  function getProgramDurationMinutes(categoryId, title) {
    const options = CATEGORY_DURATION_OPTIONS[categoryId] || [60];
    return options[hashString(`${categoryId}:${title}:duration` ) % options.length];
  }

  function normalizeToken(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function cleanupCategoryProgramTitle(categoryId, title) {
    const safeCategory = String(categoryId || "").trim();
    const safeTitle = String(title || "").trim();
    if (!safeTitle) return "";
    const suffixes = TITLE_SUFFIX_CLEANUP_BY_CATEGORY[safeCategory];
    if (!Array.isArray(suffixes) || suffixes.length === 0) return safeTitle;
    const splitIndex = safeTitle.lastIndexOf(" - ");
    if (splitIndex < 0) return safeTitle;
    const suffixRaw = safeTitle.slice(splitIndex + 3).trim();
    if (!suffixRaw) return safeTitle;
    const suffixNormalized = normalizeToken(suffixRaw);
    const isRemovable = suffixes.some((item) => normalizeToken(item) === suffixNormalized);
    if (!isRemovable) return safeTitle;
    return safeTitle.slice(0, splitIndex).trim();
  }

  function inferSubtypeFromTitle(categoryId, title) {
    const safeCategory = String(categoryId || "").trim();
    const rawTitle = String(title || "").trim();
    if (!safeCategory || !rawTitle) return "";
    const normalizedTitle = normalizeToken(rawTitle);

    if (safeCategory === "culture") {
      const separatorIndex = rawTitle.lastIndexOf(" - ");
      if (separatorIndex >= 0) {
        const suffix = normalizeToken(rawTitle.slice(separatorIndex + 3));
        if (suffix.includes("concert") || suffix.includes("recital")) return "Concert";
        if (suffix.includes("ballet") || suffix.includes("danse")) return "Danse";
        if (suffix.includes("theatre") || suffix.includes("piece")) return "Théâtre";
        if (suffix.includes("opera")) return "Opéra";
      }
    }

    const rules = CATEGORY_SUBTYPE_KEYWORD_RULES[safeCategory];
    if (Array.isArray(rules)) {
      for (let i = 0; i < rules.length; i += 1) {
        const rule = rules[i];
        const subtype = String(rule && rule.subtype || "").trim();
        const keywords = Array.isArray(rule && rule.keywords) ? rule.keywords : [];
        if (!subtype || !keywords.length) continue;
        const match = keywords.some((keyword) => {
          const token = normalizeToken(keyword);
          return token && normalizedTitle.includes(token);
        });
        if (match) return subtype;
      }
    }
    return "";
  }

  function getProgramSubtypeLabel(categoryId, title, explicitSubtype) {
    const safeCategory = String(categoryId || "").trim();
    if (SUBTYPELESS_CATEGORY_IDS.has(safeCategory)) return "";
    const explicit = String(explicitSubtype || "").trim();
    if (explicit) return explicit;
    const inferred = inferSubtypeFromTitle(safeCategory, title);
    if (inferred) return inferred;
    const options = CATEGORY_SUBTYPE_OPTIONS[safeCategory];
    if (!Array.isArray(options) || options.length === 0) return "";
    const seed = hashString(`${safeCategory}:${String(title || "")}:subtype`);
    return options[seed % options.length];
  }

  function normalizeStarRating(value, options) {
    const opts = options && typeof options === "object" ? options : {};
    const allowHalf = opts.allowHalf !== false;
    const fallback = Number.isFinite(Number(opts.fallback)) ? Number(opts.fallback) : (allowHalf ? 0.5 : 1);
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
    const rounded = allowHalf ? (Math.round(numeric * 2) / 2) : Math.round(numeric);
    const min = allowHalf ? 0.5 : 1;
    return Math.max(min, Math.min(5, rounded));
  }

  function parseEpisodeTrackingKey(value) {
    const match = /^S(\d+)E(\d+)$/i.exec(String(value || "").trim());
    if (!match) return null;
    return {
      season: Math.max(1, Number(match[1]) || 1),
      episode: Math.max(1, Number(match[2]) || 1)
    };
  }

  function normalizeEpisodeReadyDatesMap(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out = {};
    Object.keys(raw).forEach((key) => {
      const parsed = parseEpisodeTrackingKey(key);
      const dateKey = String(raw[key] || "").trim();
      if (!parsed || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
      const normalizedKey = `S${parsed.season}E${parsed.episode}`;
      out[normalizedKey] = dateKey;
    });
    return out;
  }

  function getPriceFromStars(basePrice, stars, program, categoryId) {
    const normalizedStars = normalizeStarRating(stars, { allowHalf: true, fallback: 1 });
    const starMultiplier = PROGRAM_STAR_PRICE_MULTIPLIER[normalizedStars] || 1;
    const categoryMultiplier = CATEGORY_PRICE_MULTIPLIER[categoryId] || 6.5;
    const floor = CATEGORY_PRICE_FLOOR[categoryId] || 200000;
    const seasons = Number(program && program.seasons) || 0;
    const episodesPerSeason = Number(program && program.episodesPerSeason) || 0;
    const totalEpisodes = seasons > 0 && episodesPerSeason > 0 ? (seasons * episodesPerSeason) : 0;
    const episodeBonus = totalEpisodes > 0
      ? (totalEpisodes * (CATEGORY_EPISODE_BONUS[categoryId] || 0))
      : 0;
    const raw = (basePrice * starMultiplier * categoryMultiplier) + episodeBonus;
    return Math.min(8000000, Math.max(floor, Math.round(raw)));
  }

  function enrichProgramForSession(sessionData, category, program) {
    if (!category || !program) {
      return {
        title: program && program.title ? program.title : "",
        price: program && Number(program.price) > 0 ? Number(program.price) : 0,
        duration: 60,
        stars: null,
        ageRating: null,
        productionMode: null
      };
    }
    const classification = (() => {
      const ownedDetail = sessionData ? ensureOwnedProgramDetails(sessionData)[program.title] : null;
      const hasOwnedOverride = ownedDetail && Number(ownedDetail.stars) > 0 && typeof ownedDetail.ageRating === "string";
      const hasInline = Number(program.stars) > 0 && typeof program.ageRating === "string";
      const fallback = hasOwnedOverride
        ? {
          stars: normalizeStarRating(ownedDetail.stars, { allowHalf: true, fallback: 1 }),
          ageRating: category.id === "jeunesse" ? "TP" : ownedDetail.ageRating
        }
        : (hasInline
          ? {
            stars: normalizeStarRating(program.stars, { allowHalf: true, fallback: 1 }),
            ageRating: category.id === "jeunesse" ? "TP" : program.ageRating
          }
          : getProgramClassification(sessionData, category.id, program.title));
      if (category.id === "information") {
        const source = ownedDetail && typeof ownedDetail === "object" ? ownedDetail : program;
        return {
          stars: normalizeStarRating(
            resolveInfoProducedProgramStars(sessionData, source),
            { allowHalf: true, fallback: 0.5 }
          ),
          ageRating: fallback.ageRating
        };
      }
      return fallback;
    })();
    const duration = Number(program.duration) > 0
      ? Number(program.duration)
      : getProgramDurationMinutes(category.id, program.title);
    const ownedDetail = sessionData ? ensureOwnedProgramDetails(sessionData)[program.title] : null;
    const productionModeRaw = ownedDetail && typeof ownedDetail.productionMode === "string"
      ? ownedDetail.productionMode
      : (typeof program.productionMode === "string" ? program.productionMode : "");
    const productionMode = String(productionModeRaw || "").trim().toLowerCase() === "recorded"
      ? "recorded"
      : (String(productionModeRaw || "").trim().toLowerCase() === "direct" ? "direct" : null);
    return {
      title: program.title,
      price: getPriceFromStars(program.price, classification.stars, program, category.id),
      duration,
      stars: classification.stars,
      ageRating: classification.ageRating,
      productionMode,
      productionBudget: normalizeProductionBudget(ownedDetail && ownedDetail.productionBudget)
    };
  }

  function getPlayerId(sessionData) {
    if (sessionUtils && typeof sessionUtils.getPlayerId === "function") {
      return sessionUtils.getPlayerId(sessionData);
    }
    return sessionData.email || sessionData.username || "player";
  }

  function studioStateKey(sessionData) {
    return `${STUDIO_KEY_PREFIX}${getPlayerId(sessionData)}`;
  }

  function getDynamicStudioStars(sessionData) {
    if (!sessionData) return 1;
    let parsed = null;
    const raw = localStorage.getItem(studioStateKey(sessionData));
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }
    const levels = {
      decor: Math.max(0, Math.min(3, Number(parsed && parsed.decor) || 0)),
      lights: Math.max(0, Math.min(3, Number(parsed && parsed.lights) || 0)),
      cameras: Math.max(0, Math.min(3, Number(parsed && parsed.cameras) || 0)),
      regie: Math.max(0, Math.min(3, Number(parsed && parsed.regie) || 0)),
      son: Math.max(0, Math.min(3, Number(parsed && parsed.son) || 0)),
      prompteur: Math.max(0, Math.min(3, Number(parsed && parsed.prompteur) || 0))
    };
    const values = [
      levels.decor,
      levels.lights,
      levels.cameras,
      levels.regie,
      levels.son,
      levels.prompteur
    ];
    const halfCount = Math.ceil(values.length / 2);
    const countAtLeast = (level) => values.filter((value) => value >= level).length;
    const allAtLeast = (level) => values.every((value) => value >= level);
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

  function clampNumeric(value, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.max(min, Math.min(max, numeric));
  }

  function roundToHalf(value) {
    return Math.round((Number(value) || 0) * 2) / 2;
  }

  function computeProducedProgramStarsFromFactors(factors) {
    const source = factors && typeof factors === "object" ? factors : {};
    const baseStudio = clampNumeric(source.baseStudio, 0.5, 3);
    const bonusBudget = clampNumeric(source.bonusBudget, -0.5, 0.5);
    const bonusAntenne = clampNumeric(source.bonusAntenne, 0, 1);
    const bonusRealisateur = clampNumeric(source.bonusRealisateur, 0, 1);
    const bonusProducteur = clampNumeric(source.bonusProducteur, 0, 1);
    const bonusCoherence = clampNumeric(source.bonusCoherence, 0, 0.5);
    const brute = baseStudio + bonusBudget + bonusAntenne + bonusRealisateur + bonusProducteur + bonusCoherence;
    const cap = Math.min(5, baseStudio + 2);
    return Math.max(0.5, Math.min(cap, roundToHalf(brute)));
  }

  function resolveInfoProducedProgramStars(sessionData, programLike) {
    const source = programLike && typeof programLike === "object" ? programLike : {};
    const budgetBonus = getProductionBudgetConfig(source.productionBudget).starsBonus;
    return computeProducedProgramStarsFromFactors({
      baseStudio: getDynamicStudioStars(sessionData),
      bonusBudget: budgetBonus,
      bonusAntenne: source.presenterStarBonus,
      bonusRealisateur: source.directorStarBonus,
      bonusProducteur: source.producerStarBonus,
      bonusCoherence: source.coherenceBonus
    });
  }

  function recoverSession() {
    if (!sessionUtils || typeof sessionUtils.requireSession !== "function") return null;
    return sessionUtils.requireSession({
      redirectPath: false,
      persist: true,
      allowEmailParam: true,
      clearSearch: false
    });
  }

  function ownedKey(sessionData) {
    return `${OWNED_KEY_PREFIX}${getPlayerId(sessionData)}`;
  }

  function ownedDetailsKey(sessionData) {
    return `${OWNED_DETAILS_KEY_PREFIX}${getPlayerId(sessionData)}`;
  }

  function dateGridKey(sessionData) {
    return `${DATE_GRID_KEY_PREFIX}${getPlayerId(sessionData)}`;
  }

  function studioProductionsKey(sessionData) {
    return `${STUDIO_PRODUCTIONS_KEY_PREFIX}${getPlayerId(sessionData)}`;
  }

  function normalizeProductionBudget(value) {
    const budget = String(value || "").trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(PRODUCTION_BUDGET_LEVELS, budget)) return budget;
    return "medium";
  }

  function getProductionBudgetConfig(value) {
    return PRODUCTION_BUDGET_LEVELS[normalizeProductionBudget(value)] || PRODUCTION_BUDGET_LEVELS.medium;
  }

  function getProgramSnapshot(sessionData, category, program, options) {
    if (!category || !program || !sessionData) return null;
    const opts = options && typeof options === "object" ? options : {};
    const fallbackClassification = getProgramClassification(sessionData, category.id, program.title);
    const forcedStars = Number(opts.stars);
    const forcedAge = typeof opts.ageRating === "string" ? opts.ageRating : "";
    const classification = {
      stars: Number.isFinite(forcedStars) && forcedStars > 0
        ? normalizeStarRating(forcedStars, { allowHalf: true, fallback: fallbackClassification.stars })
        : fallbackClassification.stars,
      ageRating: forcedAge || fallbackClassification.ageRating
    };
    const duration = getProgramDurationMinutes(category.id, program.title);
    return {
      title: program.title,
      categoryId: category.id,
      basePrice: Number(program.price) || 0,
      seasons: Number(program.seasons) || null,
      episodesPerSeason: Number(program.episodesPerSeason) || null,
      duration,
      stars: classification.stars,
      ageRating: classification.ageRating,
      productionBudget: "medium",
      episodeReadyDates: {},
      seasonStars: {}
    };
  }

  function pickStarterStars(seed) {
    const roll = seed % 100;
    if (roll < 20) return 1;
    if (roll < 45) return 1.5;
    if (roll < 75) return 2;
    if (roll < 93) return 2.5;
    return 3;
  }

  function pickRandomTitlesFromCategory(sessionData, category, count) {
    const target = Math.max(0, Number(count) || 0);
    if (!category || target <= 0) return [];
    const source = Array.isArray(category.programs) ? category.programs.slice() : [];
    if (source.length === 0) return [];
    const random = seededRandom(hashString(`${getPlayerId(sessionData)}::starter::${category.id}`));
    for (let index = source.length - 1; index > 0; index -= 1) {
      const pick = Math.floor(random() * (index + 1));
      const tmp = source[index];
      source[index] = source[pick];
      source[pick] = tmp;
    }
    return source.slice(0, Math.min(target, source.length));
  }

  function buildStarterOwnedDetails(sessionData) {
    const details = {};
    ensureDynamicPrograms(sessionData);
    Object.keys(STARTER_PACK_BY_CATEGORY).forEach((categoryId) => {
      if (categoryId === "information") return;
      const category = categoryById(categoryId);
      if (!category) return;
      const picks = pickRandomTitlesFromCategory(sessionData, category, STARTER_PACK_BY_CATEGORY[categoryId]);
      picks.forEach((program, index) => {
        const seed = hashString(`${getPlayerId(sessionData)}::starter::${categoryId}::${program.title}::${index}`);
        const stars = pickStarterStars(seed);
        const baseAge = getProgramClassification(sessionData, category.id, program.title).ageRating;
        const ageRating = category.id === "jeunesse" ? "TP" : baseAge;
        const snapshot = getProgramSnapshot(sessionData, category, program, { stars, ageRating });
        if (snapshot) details[snapshot.title] = snapshot;
      });
    });
    return details;
  }

  function ensureOwnedProgramDetails(sessionData) {
    const detailsKey = ownedDetailsKey(sessionData);
    let details = {};
    const rawDetails = localStorage.getItem(detailsKey);
    if (rawDetails) {
      try {
        const parsed = JSON.parse(rawDetails);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          Object.keys(parsed).forEach((title) => {
            const raw = parsed[title];
            if (!raw || typeof raw !== "object") return;
            const cleanTitle = typeof raw.title === "string" && raw.title ? raw.title : title;
            const categoryId = typeof raw.categoryId === "string" ? raw.categoryId : "";
            if (!cleanTitle || !categoryId) return;
            details[cleanTitle] = {
              title: cleanTitle,
              categoryId,
              basePrice: Number(raw.basePrice) > 0 ? Number(raw.basePrice) : 0,
              seasons: Number(raw.seasons) > 0 ? Number(raw.seasons) : null,
              episodesPerSeason: Number(raw.episodesPerSeason) > 0 ? Number(raw.episodesPerSeason) : null,
              duration: Number(raw.duration) > 0 ? Number(raw.duration) : getProgramDurationMinutes(categoryId, cleanTitle),
              stars: Number(raw.stars) > 0 ? Number(raw.stars) : null,
              ageRating: typeof raw.ageRating === "string" ? raw.ageRating : null,
              productionSubtype: typeof raw.productionSubtype === "string" ? raw.productionSubtype : null,
              productionMode: typeof raw.productionMode === "string" ? raw.productionMode : null,
              productionBudget: normalizeProductionBudget(raw.productionBudget),
              producedAt: typeof raw.producedAt === "string" ? raw.producedAt : null,
              presenterId: typeof raw.presenterId === "string" ? raw.presenterId : null,
              presenterName: typeof raw.presenterName === "string" ? raw.presenterName : null,
              presenterIds: Array.isArray(raw.presenterIds)
                ? raw.presenterIds.map((value) => String(value || "").trim()).filter(Boolean)
                : [],
              presenterNames: Array.isArray(raw.presenterNames)
                ? raw.presenterNames.map((value) => String(value || "").trim()).filter(Boolean)
                : [],
              presenterStarBonuses: Array.isArray(raw.presenterStarBonuses)
                ? raw.presenterStarBonuses.map((value) => Math.max(0, Math.min(1, Number(value) || 0)))
                : [],
              presenterStarBonus: Number.isFinite(Number(raw.presenterStarBonus))
                ? Math.max(0, Math.min(1, Number(raw.presenterStarBonus)))
                : 0,
              directorId: typeof raw.directorId === "string" ? raw.directorId : null,
              directorName: typeof raw.directorName === "string" ? raw.directorName : null,
              directorStarBonus: Number.isFinite(Number(raw.directorStarBonus))
                ? Math.max(0, Math.min(1, Number(raw.directorStarBonus)))
                : 0,
              producerId: typeof raw.producerId === "string" ? raw.producerId : null,
              producerName: typeof raw.producerName === "string" ? raw.producerName : null,
              producerStarBonus: Number.isFinite(Number(raw.producerStarBonus))
                ? Math.max(0, Math.min(1, Number(raw.producerStarBonus)))
                : 0,
              coherenceBonus: Number.isFinite(Number(raw.coherenceBonus))
                ? Math.max(0, Math.min(0.5, Number(raw.coherenceBonus)))
                : 0,
              episodeReadyDates: normalizeEpisodeReadyDatesMap(raw.episodeReadyDates),
              seasonStars: raw.seasonStars && typeof raw.seasonStars === "object" && !Array.isArray(raw.seasonStars)
                ? Object.keys(raw.seasonStars).reduce((acc, key) => {
                  const value = Number(raw.seasonStars[key]);
                  if (!Number.isFinite(value) || value <= 0) return acc;
                  acc[String(key)] = normalizeStarRating(value, { allowHalf: true, fallback: 0.5 });
                  return acc;
                }, {})
                : {},
              plannedEpisodes: Number(raw.plannedEpisodes) > 0 ? Number(raw.plannedEpisodes) : null
            };
          });
        }
      } catch {
        details = {};
      }
    }
    if (Object.keys(details).length === 0) {
      details = buildStarterOwnedDetails(sessionData);
    }
    localStorage.setItem(detailsKey, JSON.stringify(details));
    localStorage.setItem(ownedKey(sessionData), JSON.stringify(Object.keys(details)));
    return details;
  }

  function ensureOwnedTitles(sessionData) {
    const details = ensureOwnedProgramDetails(sessionData);
    return new Set(Object.keys(details));
  }

  function saveOwnedTitles(sessionData, ownedSet) {
    localStorage.setItem(ownedKey(sessionData), JSON.stringify(Array.from(ownedSet)));
  }

  function saveOwnedProgramDetails(sessionData, details) {
    localStorage.setItem(ownedDetailsKey(sessionData), JSON.stringify(details));
    localStorage.setItem(ownedKey(sessionData), JSON.stringify(Object.keys(details)));
  }

  function normalizeStudioProductionEpisode(raw) {
    if (!raw || typeof raw !== "object") return null;
    const episode = Math.max(1, Number(raw.episode) || 1);
    const shootDateKey = String(raw.shootDateKey || "").trim();
    const shootStartMinute = Number(raw.shootStartMinute);
    const shootDurationMinutes = Math.max(30, Number(raw.shootDurationMinutes) || 60);
    const readyDateKey = String(raw.readyDateKey || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(shootDateKey)) return null;
    if (!Number.isFinite(shootStartMinute) || shootStartMinute < 0 || shootStartMinute >= (24 * 60)) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(readyDateKey)) return null;
    return {
      episode,
      shootDateKey,
      shootStartMinute: Math.floor(shootStartMinute),
      shootDurationMinutes: Math.floor(shootDurationMinutes),
      readyDateKey
    };
  }

  function normalizeStudioProductionRecord(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = String(raw.id || "").trim();
    const title = String(raw.title || "").trim();
    const categoryId = String(raw.categoryId || "").trim();
    const createdAt = String(raw.createdAt || "").trim();
    const subtype = String(raw.subtype || "").trim();
    const budget = normalizeProductionBudget(raw.budget);
    const duration = Math.max(5, Number(raw.duration) || 60);
    const episodes = Array.isArray(raw.episodes)
      ? raw.episodes.map(normalizeStudioProductionEpisode).filter(Boolean)
      : [];
    if (!id || !title || !categoryId || !createdAt || episodes.length === 0) return null;
    return {
      id,
      title,
      categoryId,
      subtype,
      budget,
      duration,
      createdAt,
      totalEpisodes: Math.max(1, Number(raw.totalEpisodes) || episodes.length),
      starsAtLaunch: normalizeStarRating(raw.starsAtLaunch, { allowHalf: true, fallback: 0.5 }),
      studioId: String(raw.studioId || "studio_1").trim() || "studio_1",
      studioName: String(raw.studioName || "Studio TV 1").trim() || "Studio TV 1",
      episodes
    };
  }

  function ensureStudioProductions(sessionData) {
    const key = studioProductionsKey(sessionData);
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        localStorage.setItem(key, JSON.stringify([]));
        return [];
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        localStorage.setItem(key, JSON.stringify([]));
        return [];
      }
      const normalized = parsed.map(normalizeStudioProductionRecord).filter(Boolean);
      localStorage.setItem(key, JSON.stringify(normalized));
      return normalized;
    } catch {
      localStorage.setItem(key, JSON.stringify([]));
      return [];
    }
  }

  function saveStudioProductions(sessionData, list) {
    const safe = Array.isArray(list) ? list.map(normalizeStudioProductionRecord).filter(Boolean) : [];
    localStorage.setItem(studioProductionsKey(sessionData), JSON.stringify(safe));
    return safe;
  }

  function registerStudioProduction(sessionData, payload) {
    const normalized = normalizeStudioProductionRecord(payload);
    if (!normalized) return { ok: false, message: "Production invalide." };
    const list = ensureStudioProductions(sessionData);
    const next = [...list.filter((item) => item.id !== normalized.id), normalized];
    saveStudioProductions(sessionData, next);
    return { ok: true };
  }

  function getStudioProductions(sessionData) {
    const list = ensureStudioProductions(sessionData);
    const today = todayDateKey();
    return list.map((record) => {
      const safeEpisodes = Array.isArray(record.episodes) ? record.episodes.slice() : [];
      const readyCount = safeEpisodes.filter((episode) => episode.readyDateKey <= today).length;
      return {
        ...record,
        readyEpisodes: readyCount,
        progress: Math.round((readyCount / Math.max(1, record.totalEpisodes)) * 100)
      };
    });
  }

  function findProgramByTitle(title, sessionData) {
    for (let i = 0; i < CATEGORIES.length; i += 1) {
      const category = CATEGORIES[i];
      const program = category.programs.find((entry) => entry.title === title);
      if (program) return { category, program };
    }
    if (sessionData) {
      const details = ensureOwnedProgramDetails(sessionData);
      const stored = details[title];
      if (stored && stored.categoryId) {
        const category = categoryById(stored.categoryId);
        const fallbackCategory = category || {
          id: stored.categoryId,
          name: stored.categoryId,
          colorClass: ""
        };
        return {
          category: fallbackCategory,
          program: {
            title: stored.title,
            price: Number(stored.basePrice) || 0,
            seasons: Number(stored.seasons) || null,
            episodesPerSeason: Number(stored.episodesPerSeason) || null,
            duration: Number(stored.duration) || getProgramDurationMinutes(stored.categoryId, stored.title),
            stars: Number(stored.stars) || null,
            ageRating: stored.ageRating || null,
            productionMode: stored.productionMode || null,
            productionBudget: normalizeProductionBudget(stored.productionBudget),
            productionSubtype: stored.productionSubtype || null,
            producedAt: stored.producedAt || null,
            presenterId: stored.presenterId || null,
            presenterName: stored.presenterName || null,
            presenterIds: Array.isArray(stored.presenterIds) ? stored.presenterIds.slice() : [],
            presenterNames: Array.isArray(stored.presenterNames) ? stored.presenterNames.slice() : [],
            presenterStarBonuses: Array.isArray(stored.presenterStarBonuses) ? stored.presenterStarBonuses.slice() : [],
            presenterStarBonus: Number.isFinite(Number(stored.presenterStarBonus))
              ? Math.max(0, Math.min(1, Number(stored.presenterStarBonus)))
              : 0,
            directorId: stored.directorId || null,
            directorName: stored.directorName || null,
            directorStarBonus: Number.isFinite(Number(stored.directorStarBonus))
              ? Math.max(0, Math.min(1, Number(stored.directorStarBonus)))
              : 0,
            producerId: stored.producerId || null,
            producerName: stored.producerName || null,
            producerStarBonus: Number.isFinite(Number(stored.producerStarBonus))
              ? Math.max(0, Math.min(1, Number(stored.producerStarBonus)))
              : 0,
            coherenceBonus: Number.isFinite(Number(stored.coherenceBonus))
              ? Math.max(0, Math.min(0.5, Number(stored.coherenceBonus)))
              : 0,
            episodeReadyDates: normalizeEpisodeReadyDatesMap(stored.episodeReadyDates),
            seasonStars: stored.seasonStars && typeof stored.seasonStars === "object" ? { ...stored.seasonStars } : {},
            plannedEpisodes: Number(stored.plannedEpisodes) > 0 ? Number(stored.plannedEpisodes) : null
          }
        };
      }
    }
    return null;
  }

  function isEpisodicProgram(program) {
    return Number(program && program.seasons) > 0 && Number(program && program.episodesPerSeason) > 0;
  }

  function normalizeGridEntry(raw) {
    if (!raw) return null;
    if (typeof raw === "string") {
      const found = findProgramByTitle(raw);
      return {
        title: raw,
        categoryId: found ? found.category.id : "",
        productionMode: null,
        subtype: "",
        season: null,
        episode: null
      };
    }
    const title = typeof raw.title === "string" ? raw.title : "";
    if (!title) return null;
    const found = findProgramByTitle(title);
    const categoryId = (typeof raw.categoryId === "string" && raw.categoryId) || (found ? found.category.id : "");
    const season = Number(raw.season) > 0 ? Number(raw.season) : null;
    const episode = Number(raw.episode) > 0 ? Number(raw.episode) : null;
    return {
      title,
      categoryId,
      productionMode: String(raw.productionMode || "").trim().toLowerCase() === "recorded"
        ? "recorded"
        : (String(raw.productionMode || "").trim().toLowerCase() === "direct" ? "direct" : null),
      subtype: String(raw.subtype || ""),
      season,
      episode
    };
  }

  function normalizeGridDay(dayRaw) {
    if (!dayRaw) return [];
    if (Array.isArray(dayRaw)) {
      return dayRaw.map(normalizeGridEntry).filter(Boolean);
    }
    if (Array.isArray(dayRaw.day)) {
      return dayRaw.day.map(normalizeGridEntry).filter(Boolean);
    }
    if (Array.isArray(dayRaw.before) || Array.isArray(dayRaw.after)) {
      const before = Array.isArray(dayRaw.before) ? dayRaw.before : [];
      const after = Array.isArray(dayRaw.after) ? dayRaw.after : [];
      return [...before, ...after].map(normalizeGridEntry).filter(Boolean);
    }
    const migrated = [];
    Object.keys(dayRaw)
      .filter((key) => key.startsWith("slot_"))
      .sort((a, b) => {
        const av = a === "slot_00" ? 24 : Number(a.slice(5));
        const bv = b === "slot_00" ? 24 : Number(b.slice(5));
        return av - bv;
      })
      .forEach((slotKey) => {
        const entry = normalizeGridEntry(dayRaw[slotKey]);
        if (entry && entry.title) migrated.push(entry);
      });
    return migrated;
  }

  function todayDateKey() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function buildSeenMapFromPastDiffusions(sessionData) {
    const seenTitles = new Set();
    const seenEpisodesByTitle = new Map();
    const titleBroadcastCounts = new Map();
    const trackingBroadcastCounts = new Map();
    const rawDateGrid = localStorage.getItem(dateGridKey(sessionData));
    if (!rawDateGrid) return { seenTitles, seenEpisodesByTitle, titleBroadcastCounts, trackingBroadcastCounts };

    let parsed;
    try {
      parsed = JSON.parse(rawDateGrid);
    } catch {
      return { seenTitles, seenEpisodesByTitle, titleBroadcastCounts, trackingBroadcastCounts };
    }
    if (!parsed || typeof parsed !== "object") return { seenTitles, seenEpisodesByTitle, titleBroadcastCounts, trackingBroadcastCounts };

    const todayKey = todayDateKey();
    Object.keys(parsed)
      .filter((dateKey) => dateKey < todayKey)
      .sort()
      .forEach((dateKey) => {
        const entries = normalizeGridDay(parsed[dateKey]);
        entries.forEach((entry) => {
          if (!entry || !entry.title) return;
          seenTitles.add(entry.title);
          titleBroadcastCounts.set(entry.title, (titleBroadcastCounts.get(entry.title) || 0) + 1);
          const trackingKey = diffusionRules && typeof diffusionRules.getTrackingKey === "function"
            ? diffusionRules.getTrackingKey(entry)
            : (entry.categoryId === "information" ? "" : (entry.categoryId && EPISODIC_CATEGORY_IDS.has(entry.categoryId)
              ? `${entry.title}::S${entry.season || 1}E${entry.episode || 1}`
              : entry.title));
          if (trackingKey) {
            trackingBroadcastCounts.set(trackingKey, (trackingBroadcastCounts.get(trackingKey) || 0) + 1);
          }
          if (Number(entry.season) > 0 && Number(entry.episode) > 0) {
            const key = `S${entry.season}E${entry.episode}`;
            if (!seenEpisodesByTitle.has(entry.title)) {
              seenEpisodesByTitle.set(entry.title, new Set());
            }
            seenEpisodesByTitle.get(entry.title).add(key);
          }
        });
      });

    return { seenTitles, seenEpisodesByTitle, titleBroadcastCounts, trackingBroadcastCounts };
  }

  function getProgramMarketStatus(program, seenMap, categoryId, options) {
    const opts = options || {};
    const useExternalStatus = Boolean(opts.useExternalStatus);
    const { seenTitles, seenEpisodesByTitle, titleBroadcastCounts } = seenMap;
    const productionMode = String(program && program.productionMode || "").trim().toLowerCase();
    if (productionMode === "direct") {
      return {
        status: "direct",
        diffusionCount: titleBroadcastCounts.get(program.title) || 0
      };
    }
    if (categoryId === "information" && productionMode !== "recorded") {
      return {
        status: "direct",
        diffusionCount: titleBroadcastCounts.get(program.title) || 0
      };
    }
    if (
      (diffusionRules && typeof diffusionRules.isAlwaysIneditCategory === "function" && diffusionRules.isAlwaysIneditCategory(categoryId))
      || categoryId === "information"
    ) {
      return {
        status: "inedit",
        diffusionCount: titleBroadcastCounts.get(program.title) || 0
      };
    }
    if (!isEpisodicProgram(program)) {
      if (useExternalStatus && program.externalStatus === "rediffusion" && !seenTitles.has(program.title)) {
        return {
          status: "rediffusion",
          diffusionCount: Number(program.externalDiffusionCount) > 0 ? Number(program.externalDiffusionCount) : 1
        };
      }
      return {
        status: seenTitles.has(program.title) ? "rediffusion" : "inedit",
        diffusionCount: titleBroadcastCounts.get(program.title) || 0
      };
    }

    const seasons = Number(program.seasons);
    const episodesPerSeason = Number(program.episodesPerSeason);
    const totalEpisodes = seasons * episodesPerSeason;
    const usedSet = seenEpisodesByTitle.get(program.title) || new Set();
    const usedEpisodes = usedSet.size;
    const remainingEpisodes = Math.max(0, totalEpisodes - usedEpisodes);
    const localStatus = {
      status: remainingEpisodes > 0 ? "inedit" : "rediffusion",
      usedEpisodes,
      remainingEpisodes,
      totalEpisodes,
      diffusionCount: titleBroadcastCounts.get(program.title) || 0
    };
    if (useExternalStatus && program.externalStatus === "rediffusion" && remainingEpisodes > 0) {
      return {
        status: "rediffusion",
        usedEpisodes: totalEpisodes,
        remainingEpisodes: 0,
        totalEpisodes,
        diffusionCount: Number(program.externalDiffusionCount) > 0 ? Number(program.externalDiffusionCount) : 1
      };
    }
    return localStatus;
  }

  function buildSeasonDetails(program, seenMap) {
    const seasons = Number(program.seasons) || 0;
    const episodesPerSeason = Number(program.episodesPerSeason) || 0;
    if (seasons <= 0 || episodesPerSeason <= 0) return [];

    const seenSet = seenMap.seenEpisodesByTitle.get(program.title) || new Set();
    const byTrackingKey = seenMap.trackingBroadcastCounts || new Map();
    const seasonDetails = [];
    for (let season = 1; season <= seasons; season += 1) {
      const episodes = [];
      let seenCount = 0;
      for (let episode = 1; episode <= episodesPerSeason; episode += 1) {
        const key = `S${season}E${episode}`;
        const isSeen = seenSet.has(key);
        const trackingKey = `${program.title}::S${season}E${episode}`;
        const diffusionCount = Number(byTrackingKey.get(trackingKey)) || 0;
        if (isSeen) seenCount += 1;
        episodes.push({
          episode,
          status: isSeen ? "rediffusion" : "inedit",
          diffusionCount
        });
      }
      seasonDetails.push({
        season,
        status: seenCount === episodesPerSeason ? "rediffusion" : "inedit",
        seenEpisodes: seenCount,
        totalEpisodes: episodesPerSeason,
        episodes
      });
    }
    return seasonDetails;
  }

  function ownedCatalog(sessionData) {
    ensureDynamicPrograms(sessionData);
    const ownedTitles = ensureOwnedTitles(sessionData);
    const ownedDetails = ensureOwnedProgramDetails(sessionData);
    const seenMap = buildSeenMapFromPastDiffusions(sessionData);
    const grouped = new Map();
    const todayKey = todayDateKey();
    Array.from(ownedTitles).forEach((title) => {
      if (!isProgramAvailableForBroadcast(sessionData, title, todayKey)) return;
      const found = findProgramByTitle(title, sessionData);
      if (!found) return;
      const category = found.category;
      const program = found.program;
      const ownedDetail = ownedDetails[title];
      const explicitSubtype = ownedDetail && typeof ownedDetail.productionSubtype === "string"
        ? ownedDetail.productionSubtype
        : (typeof program.productionSubtype === "string" ? program.productionSubtype : "");
      const enriched = enrichProgramForSession(sessionData, category, program);
      const diffusion = getProgramMarketStatus(program, seenMap, category.id, { useExternalStatus: false });
      if (!grouped.has(category.id)) {
        grouped.set(category.id, {
          id: category.id,
          name: category.name,
          colorClass: category.colorClass,
          programs: []
        });
      }
      grouped.get(category.id).programs.push({
        title: enriched.title,
        price: enriched.price,
        duration: enriched.duration,
        subtype: getProgramSubtypeLabel(category.id, enriched.title, explicitSubtype),
        stars: enriched.stars,
        ageRating: enriched.ageRating,
        seasons: Number(program.seasons) || null,
        episodesPerSeason: Number(program.episodesPerSeason) || null,
        totalEpisodes: (Number(program.seasons) && Number(program.episodesPerSeason))
          ? Number(program.seasons) * Number(program.episodesPerSeason)
          : null,
        diffusion,
        seasonsDetail: buildSeasonDetails(program, seenMap)
      });
    });
    return Array.from(grouped.values());
  }

  function categoriesForOwned(sessionData) {
    ensureDynamicPrograms(sessionData);
    const ownedTitles = ensureOwnedTitles(sessionData);
    const grouped = new Map();
    const todayKey = todayDateKey();
    Array.from(ownedTitles).forEach((title) => {
      if (!isProgramAvailableForBroadcast(sessionData, title, todayKey)) return;
      const found = findProgramByTitle(title, sessionData);
      if (!found) return;
      const category = found.category;
      if (!grouped.has(category.id)) {
        grouped.set(category.id, {
          id: category.id,
          name: category.name,
          colorClass: category.colorClass,
          programs: []
        });
      }
      grouped.get(category.id).programs.push(title);
    });
    return Array.from(grouped.values());
  }

  function marketCategories(sessionData) {
    ensureDynamicPrograms(sessionData);
    const owned = ensureOwnedTitles(sessionData);
    const seenMap = buildSeenMapFromPastDiffusions(sessionData);
    return CATEGORIES
      .filter((category) => category.id !== "information")
      .map((category) => ({
      id: category.id,
      name: category.name,
      colorClass: category.colorClass,
      programs: (() => {
        const sourcePrograms = (() => {
          const availableTitles = category.programs
            .filter((program) => !owned.has(program.title))
            .map((program) => program.title);
          const offeredTitles = new Set(pickCategoryOfferTitles(sessionData, category.id, availableTitles));
          return category.programs.filter((program) => offeredTitles.has(program.title));
        })();
        return sourcePrograms.map((program) => ({
        ...enrichProgramForSession(sessionData, category, program),
        subtype: getProgramSubtypeLabel(
          category.id,
          String(program.title || ""),
          typeof program.productionSubtype === "string" ? program.productionSubtype : ""
        ),
        owned: owned.has(program.title),
        seasons: Number(program.seasons) || null,
        episodesPerSeason: Number(program.episodesPerSeason) || null,
        totalEpisodes: (Number(program.seasons) && Number(program.episodesPerSeason))
          ? Number(program.seasons) * Number(program.episodesPerSeason)
          : null,
        diffusion: getProgramMarketStatus(program, seenMap, category.id, { useExternalStatus: true })
      }));
      })()
      }));
  }

  function getProgramMeta(title) {
    const activeSession = getSession();
    if (activeSession) ensureDynamicPrograms(activeSession);
    const found = findProgramByTitle(title, activeSession || null);
    if (!found) return null;
    const seasons = Number(found.program.seasons) || null;
    const episodesPerSeason = Number(found.program.episodesPerSeason) || null;
    const seenMap = activeSession ? buildSeenMapFromPastDiffusions(activeSession) : {
      seenTitles: new Set(),
      seenEpisodesByTitle: new Map(),
      titleBroadcastCounts: new Map(),
      trackingBroadcastCounts: new Map()
    };
    const enriched = activeSession ? enrichProgramForSession(activeSession, found.category, found.program) : {
      title: found.program.title,
      price: found.program.price,
      duration: Number(found.program.duration) || getProgramDurationMinutes(found.category.id, found.program.title),
      stars: null,
      ageRating: null
    };
    const diffusion = getProgramMarketStatus(found.program, seenMap, found.category.id, { useExternalStatus: false });
    const ownedDetail = activeSession ? ensureOwnedProgramDetails(activeSession)[enriched.title] : null;
    const productionSubtype = ownedDetail && typeof ownedDetail.productionSubtype === "string"
      ? ownedDetail.productionSubtype
      : (typeof found.program.productionSubtype === "string" ? found.program.productionSubtype : null);
    const productionBudget = normalizeProductionBudget(
      ownedDetail && ownedDetail.productionBudget
        ? ownedDetail.productionBudget
        : found.program.productionBudget
    );
    const episodeReadyDates = normalizeEpisodeReadyDatesMap(
      ownedDetail && ownedDetail.episodeReadyDates
        ? ownedDetail.episodeReadyDates
        : found.program.episodeReadyDates
    );
    const seasonStars = ownedDetail && ownedDetail.seasonStars && typeof ownedDetail.seasonStars === "object"
      ? { ...ownedDetail.seasonStars }
      : (found.program.seasonStars && typeof found.program.seasonStars === "object" ? { ...found.program.seasonStars } : {});
    const presenterId = ownedDetail && typeof ownedDetail.presenterId === "string"
      ? ownedDetail.presenterId
      : (typeof found.program.presenterId === "string" ? found.program.presenterId : null);
    const presenterIds = Array.isArray(ownedDetail && ownedDetail.presenterIds)
      ? ownedDetail.presenterIds.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    if (!presenterIds.length && presenterId) presenterIds.push(String(presenterId));
    const presenterName = ownedDetail && typeof ownedDetail.presenterName === "string"
      ? ownedDetail.presenterName
      : (typeof found.program.presenterName === "string" ? found.program.presenterName : null);
    const presenterNames = Array.isArray(ownedDetail && ownedDetail.presenterNames)
      ? ownedDetail.presenterNames.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    if (!presenterNames.length && presenterName) presenterNames.push(String(presenterName));
    const presenterStarBonus = Number.isFinite(Number(ownedDetail && ownedDetail.presenterStarBonus))
      ? Math.max(0, Math.min(1, Number(ownedDetail.presenterStarBonus)))
      : (Number.isFinite(Number(found.program.presenterStarBonus))
        ? Math.max(0, Math.min(1, Number(found.program.presenterStarBonus)))
        : 0);
    const presenterStarBonuses = Array.isArray(ownedDetail && ownedDetail.presenterStarBonuses)
      ? ownedDetail.presenterStarBonuses.map((value) => Math.max(0, Math.min(1, Number(value) || 0)))
      : [];
    const directorId = ownedDetail && typeof ownedDetail.directorId === "string"
      ? ownedDetail.directorId
      : (typeof found.program.directorId === "string" ? found.program.directorId : null);
    const directorName = ownedDetail && typeof ownedDetail.directorName === "string"
      ? ownedDetail.directorName
      : (typeof found.program.directorName === "string" ? found.program.directorName : null);
    const directorStarBonus = Number.isFinite(Number(ownedDetail && ownedDetail.directorStarBonus))
      ? Math.max(0, Math.min(1, Number(ownedDetail.directorStarBonus)))
      : (Number.isFinite(Number(found.program.directorStarBonus))
        ? Math.max(0, Math.min(1, Number(found.program.directorStarBonus)))
        : 0);
    const producerId = ownedDetail && typeof ownedDetail.producerId === "string"
      ? ownedDetail.producerId
      : (typeof found.program.producerId === "string" ? found.program.producerId : null);
    const producerName = ownedDetail && typeof ownedDetail.producerName === "string"
      ? ownedDetail.producerName
      : (typeof found.program.producerName === "string" ? found.program.producerName : null);
    const producerStarBonus = Number.isFinite(Number(ownedDetail && ownedDetail.producerStarBonus))
      ? Math.max(0, Math.min(1, Number(ownedDetail.producerStarBonus)))
      : (Number.isFinite(Number(found.program.producerStarBonus))
        ? Math.max(0, Math.min(1, Number(found.program.producerStarBonus)))
        : 0);
    const coherenceBonus = Number.isFinite(Number(ownedDetail && ownedDetail.coherenceBonus))
      ? Math.max(0, Math.min(0.5, Number(ownedDetail.coherenceBonus)))
      : (Number.isFinite(Number(found.program.coherenceBonus))
        ? Math.max(0, Math.min(0.5, Number(found.program.coherenceBonus)))
        : 0);
    return {
      title: enriched.title,
      categoryId: found.category.id,
      price: enriched.price,
      duration: enriched.duration,
      stars: enriched.stars,
      ageRating: enriched.ageRating,
      productionMode: enriched.productionMode || null,
      productionBudget,
      productionSubtype,
      subtype: getProgramSubtypeLabel(found.category.id, enriched.title, productionSubtype),
      seasons,
      episodesPerSeason,
      totalEpisodes: seasons && episodesPerSeason ? (seasons * episodesPerSeason) : null,
      diffusionCount: Number(diffusion && diffusion.diffusionCount) || 0,
      diffusionStatus: diffusion && diffusion.status ? diffusion.status : "inedit",
      presenterId: presenterId || null,
      presenterName: presenterName || null,
      presenterIds,
      presenterNames,
      presenterStarBonus,
      presenterStarBonuses,
      directorId: directorId || null,
      directorName: directorName || null,
      directorStarBonus,
      producerId: producerId || null,
      producerName: producerName || null,
      producerStarBonus,
      coherenceBonus,
      episodeReadyDates,
      seasonStars
    };
  }

  function getProgramEpisodeAvailabilityForDate(sessionData, title, dateKey) {
    const meta = getProgramMeta(title);
    if (!meta || Number(meta.seasons) <= 0 || Number(meta.episodesPerSeason) <= 0) return null;
    const safeDateKey = /^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || "")) ? String(dateKey) : todayDateKey();
    const readyDates = normalizeEpisodeReadyDatesMap(meta.episodeReadyDates);
    const hasReadyMap = Object.keys(readyDates).length > 0;
    const availableEpisodes = [];
    const unavailableEpisodes = [];
    for (let season = 1; season <= Number(meta.seasons); season += 1) {
      for (let episode = 1; episode <= Number(meta.episodesPerSeason); episode += 1) {
        const trackingKey = `S${season}E${episode}`;
        const readyDateKey = readyDates[trackingKey] || "";
        const available = !hasReadyMap || (readyDateKey && readyDateKey <= safeDateKey);
        const row = { season, episode, key: trackingKey, readyDateKey };
        if (available) availableEpisodes.push(row);
        else unavailableEpisodes.push(row);
      }
    }
    const availableBySeason = {};
    availableEpisodes.forEach((item) => {
      availableBySeason[item.season] = (availableBySeason[item.season] || 0) + 1;
    });
    return {
      seasons: Number(meta.seasons),
      episodesPerSeason: Number(meta.episodesPerSeason),
      availableBySeason,
      availableEpisodes,
      unavailableEpisodes,
      hasReadyMap
    };
  }

  function isProgramAvailableForBroadcast(sessionData, title, dateKey) {
    const availability = getProgramEpisodeAvailabilityForDate(sessionData, title, dateKey);
    if (!availability || !availability.hasReadyMap) return true;
    return Array.isArray(availability.availableEpisodes) && availability.availableEpisodes.length > 0;
  }

  function buyProgram(sessionData, title) {
    ensureDynamicPrograms(sessionData);
    const found = findProgramByTitle(title, sessionData);
    if (!found) return { ok: false, message: "Programme introuvable." };
    if (found.category.id === "information") {
      return { ok: false, message: "Les programmes d'information sont produits en interne." };
    }

    const owned = ensureOwnedTitles(sessionData);
    if (owned.has(title)) return { ok: false, message: "Programme déjà acheté." };
    const ownedDetails = ensureOwnedProgramDetails(sessionData);

    const bank = window.PlayerBank;
    if (!bank || typeof bank.getBalance !== "function" || typeof bank.add !== "function") {
      return { ok: false, message: "Module bancaire indisponible." };
    }

    const enriched = enrichProgramForSession(sessionData, found.category, found.program);
    const price = enriched.price;
    const balance = bank.getBalance();
    if (balance < price) {
      return { ok: false, message: "Fonds insuffisants." };
    }

    bank.add(-price, {
      category: "achat_programmes",
      label: `Achat programme: ${title}`
    });
    owned.add(title);
    saveOwnedTitles(sessionData, owned);
    const snapshot = getProgramSnapshot(sessionData, found.category, found.program);
    if (snapshot) {
      ownedDetails[title] = snapshot;
      saveOwnedProgramDetails(sessionData, ownedDetails);
    }
    return { ok: true, message: "Programme acheté.", price };
  }

  function findProgramScheduling(sessionData, title) {
    const rawDateGrid = localStorage.getItem(dateGridKey(sessionData));
    if (!rawDateGrid) return { isScheduled: false, dateKeys: [] };
    try {
      const parsed = JSON.parse(rawDateGrid);
      if (!parsed || typeof parsed !== "object") return { isScheduled: false, dateKeys: [] };
      const dateKeys = Object.keys(parsed).sort();
      const scheduledDateKeys = [];
      for (let i = 0; i < dateKeys.length; i += 1) {
        const dateKey = dateKeys[i];
        const entries = normalizeGridDay(parsed[dateKey]);
        const found = entries.some((entry) => entry && entry.title === title);
        if (found) scheduledDateKeys.push(dateKey);
      }
      return { isScheduled: scheduledDateKeys.length > 0, dateKeys: scheduledDateKeys };
    } catch {
      return { isScheduled: false, dateKeys: [] };
    }
  }

  function getResalePrice(currentPrice) {
    const base = Math.max(0, Number(currentPrice) || 0);
    return Math.max(10000, Math.round(base * 0.5));
  }

  function getSellStatus(sessionData, title) {
    ensureDynamicPrograms(sessionData);
    const owned = ensureOwnedTitles(sessionData);
    if (!owned.has(title)) {
      return {
        canSell: false,
        reason: "Programme non possédé.",
        resalePrice: 0,
        isScheduled: false,
        scheduledDateKeys: []
      };
    }

    const found = findProgramByTitle(title, sessionData);
    if (!found) {
      return {
        canSell: false,
        reason: "Programme introuvable.",
        resalePrice: 0,
        isScheduled: false,
        scheduledDateKeys: []
      };
    }

    if (found.category.id === "information") {
      return {
        canSell: false,
        reason: "Les programmes d'information ne peuvent pas être vendus.",
        resalePrice: 0,
        isScheduled: false,
        scheduledDateKeys: []
      };
    }

    const scheduling = findProgramScheduling(sessionData, title);
    if (scheduling.isScheduled) {
      return {
        canSell: false,
        reason: "Programme planifié dans la grille TV.",
        resalePrice: 0,
        isScheduled: true,
        scheduledDateKeys: scheduling.dateKeys || []
      };
    }

    const enriched = enrichProgramForSession(sessionData, found.category, found.program);
    return {
      canSell: true,
      reason: "",
      resalePrice: getResalePrice(enriched.price),
      isScheduled: false,
      scheduledDateKeys: []
    };
  }

  function sellProgram(sessionData, title) {
    const status = getSellStatus(sessionData, title);
    if (!status.canSell) {
      return {
        ok: false,
        message: status.reason || "Vente impossible.",
        resalePrice: 0,
        isScheduled: status.isScheduled,
        scheduledDateKeys: Array.isArray(status.scheduledDateKeys) ? status.scheduledDateKeys : []
      };
    }

    const bank = window.PlayerBank;
    if (!bank || typeof bank.add !== "function") {
      return { ok: false, message: "Module bancaire indisponible.", resalePrice: 0 };
    }

    const owned = ensureOwnedTitles(sessionData);
    const ownedDetails = ensureOwnedProgramDetails(sessionData);
    owned.delete(title);
    delete ownedDetails[title];
    saveOwnedTitles(sessionData, owned);
    saveOwnedProgramDetails(sessionData, ownedDetails);

    bank.add(status.resalePrice, {
      category: "vente_programmes",
      label: `Vente programme: ${title}`
    });
    return {
      ok: true,
      message: "Programme vendu.",
      resalePrice: status.resalePrice
    };
  }

  function deleteProducedProgram(sessionData, title, options) {
    const opts = options && typeof options === "object" ? options : {};
    const ignoreScheduling = Boolean(opts.ignoreScheduling);
    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) return { ok: false, message: "Titre invalide." };
    const details = ensureOwnedProgramDetails(sessionData);
    const entry = details[cleanTitle];
    if (!entry) return { ok: false, message: "Programme introuvable." };
    const scheduling = ignoreScheduling ? { isScheduled: false, dateKeys: [] } : findProgramScheduling(sessionData, cleanTitle);
    if (!ignoreScheduling && scheduling && scheduling.isScheduled) {
      return {
        ok: false,
        message: "Suppression impossible : programme planifié dans la grille TV.",
        isScheduled: true,
        scheduledDateKeys: scheduling.dateKeys || []
      };
    }

    const owned = ensureOwnedTitles(sessionData);
    owned.delete(cleanTitle);
    delete details[cleanTitle];
    saveOwnedTitles(sessionData, owned);
    saveOwnedProgramDetails(sessionData, details);
    return { ok: true, message: "Programme de production supprimé." };
  }

  function getProgramSchedulingStatus(sessionData, title) {
    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) {
      return { isScheduled: false, dateKeys: [] };
    }
    return findProgramScheduling(sessionData, cleanTitle);
  }

  function findOwnedDetailByNormalizedTitle(sessionData, title) {
    const normalized = String(title || "").trim().toLowerCase();
    if (!normalized) return null;
    const details = ensureOwnedProgramDetails(sessionData);
    const matchTitle = Object.keys(details).find((ownedTitle) => String(ownedTitle || "").trim().toLowerCase() === normalized);
    if (!matchTitle) return null;
    return details[matchTitle] || null;
  }

  function createProducedProgram(sessionData, payload) {
    const data = payload && typeof payload === "object" ? payload : {};
    const rawTitle = String(data.title || "").trim();
    const categoryId = String(data.categoryId || "").trim();
    const subtype = String(data.subtype || "").trim();
    const duration = Number(data.duration);
    const episodeCount = Math.max(1, Math.floor(Number(data.episodeCount) || 1));
    const productionModeRaw = String(data.productionMode || "").trim().toLowerCase();
    const productionBudget = normalizeProductionBudget(data.productionBudget);
    const requestedAgeRating = String(data.ageRating || "TP");
    const starsOverride = Number(data.starsOverride);
    const episodeReadyDates = normalizeEpisodeReadyDatesMap(data.episodeReadyDates);
    const requestedSeasonStars = data.seasonStars && typeof data.seasonStars === "object" ? data.seasonStars : {};
    const presenterId = String(data.presenterId || "").trim();
    const presenterName = String(data.presenterName || "").trim();
    const presenterStarBonus = Number(data.presenterStarBonus);
    const presenterIds = Array.isArray(data.presenterIds)
      ? data.presenterIds.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    const presenterNames = Array.isArray(data.presenterNames)
      ? data.presenterNames.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    const presenterStarBonuses = Array.isArray(data.presenterStarBonuses)
      ? data.presenterStarBonuses.map((value) => Math.max(0, Math.min(1, Number(value) || 0)))
      : [];
    const directorId = String(data.directorId || "").trim();
    const directorName = String(data.directorName || "").trim();
    const directorStarBonus = Number(data.directorStarBonus);
    const producerId = String(data.producerId || "").trim();
    const producerName = String(data.producerName || "").trim();
    const producerStarBonus = Number(data.producerStarBonus);
    const coherenceBonus = Number(data.coherenceBonus);

    if (!rawTitle) return { ok: false, message: "Nom de programme requis." };
    if (rawTitle.length < 3) return { ok: false, message: "Le nom doit contenir au moins 3 caractères." };
    const existingOwned = findOwnedDetailByNormalizedTitle(sessionData, rawTitle);
    if (existingOwned) {
      if (existingOwned.categoryId !== categoryId) {
        return { ok: false, message: "Un programme avec ce nom existe déjà dans une autre catégorie." };
      }
      return {
        ok: true,
        message: "Programme déjà existant, réutilisé pour la planification.",
        title: existingOwned.title || rawTitle,
        categoryId,
        subtype: subtype || "JT",
        duration
      };
    }
    if (categoryId !== "information" && categoryId !== "magazines") {
      return { ok: false, message: "Type de production invalide." };
    }

    const allowedDurations = CATEGORY_DURATION_OPTIONS[categoryId] || [];
    if (!allowedDurations.includes(duration)) {
      return { ok: false, message: "Durée invalide pour ce type." };
    }

    const category = categoryById(categoryId);
    if (!category) return { ok: false, message: "Catégorie introuvable." };

    const classification = getProgramClassification(sessionData, categoryId, rawTitle);
    const resolvedStars = Number.isFinite(starsOverride)
      ? normalizeStarRating(starsOverride, { allowHalf: true, fallback: classification.stars })
      : classification.stars;
    const ownedDetails = ensureOwnedProgramDetails(sessionData);
    const owned = ensureOwnedTitles(sessionData);
    const safeSubtype = subtype || (categoryId === "information" ? "JT" : "Société");
    const allowedInfoRatings = new Set(["TP", "-10", "-12", "-16"]);
    const resolvedAgeRating = categoryId === "information"
      ? (safeSubtype === "Faits divers" && allowedInfoRatings.has(requestedAgeRating) ? requestedAgeRating : "TP")
      : classification.ageRating;
    const productionMode = categoryId === "magazines"
      ? "recorded"
      : (productionModeRaw === "recorded" ? "recorded" : "direct");
    const resolvedSeasonStars = Object.keys(requestedSeasonStars).reduce((acc, key) => {
      const value = Number(requestedSeasonStars[key]);
      if (!Number.isFinite(value) || value <= 0) return acc;
      acc[String(key)] = normalizeStarRating(value, { allowHalf: true, fallback: resolvedStars });
      return acc;
    }, {});
    if (categoryId === "magazines" && !resolvedSeasonStars["1"]) {
      resolvedSeasonStars["1"] = resolvedStars;
    }
    const detail = {
      title: rawTitle,
      categoryId,
      basePrice: categoryId === "information" ? 20000 : 90000,
      seasons: categoryId === "magazines" ? 1 : null,
      episodesPerSeason: categoryId === "magazines" ? episodeCount : null,
      duration,
      stars: resolvedStars,
      ageRating: resolvedAgeRating,
      productionSubtype: safeSubtype,
      productionMode,
      productionBudget,
      producedAt: new Date().toISOString(),
      presenterId: presenterId || null,
      presenterName: presenterName || null,
      presenterStarBonus: Number.isFinite(presenterStarBonus)
        ? Math.max(0, Math.min(1, presenterStarBonus))
        : 0,
      presenterIds,
      presenterNames,
      presenterStarBonuses,
      directorId: directorId || null,
      directorName: directorName || null,
      directorStarBonus: Number.isFinite(directorStarBonus)
        ? Math.max(0, Math.min(1, directorStarBonus))
        : 0,
      producerId: producerId || null,
      producerName: producerName || null,
      producerStarBonus: Number.isFinite(producerStarBonus)
        ? Math.max(0, Math.min(1, producerStarBonus))
        : 0,
      coherenceBonus: Number.isFinite(coherenceBonus)
        ? Math.max(0, Math.min(0.5, coherenceBonus))
        : 0,
      episodeReadyDates: categoryId === "magazines" ? episodeReadyDates : {},
      seasonStars: categoryId === "magazines" ? resolvedSeasonStars : {},
      plannedEpisodes: categoryId === "magazines" ? episodeCount : null
    };

    ownedDetails[rawTitle] = detail;
    owned.add(rawTitle);
    saveOwnedProgramDetails(sessionData, ownedDetails);
    saveOwnedTitles(sessionData, owned);
    return {
      ok: true,
      message: "Programme produit.",
      title: rawTitle,
      categoryId,
      subtype: safeSubtype,
      duration,
      episodeCount: detail.episodesPerSeason || null
    };
  }

  function setProducedProgramPresenter(sessionData, title, presenterData) {
    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) return { ok: false, message: "Programme invalide." };
    const details = ensureOwnedProgramDetails(sessionData);
    const entry = details[cleanTitle];
    if (!entry) return { ok: false, message: "Programme introuvable." };
    const categoryId = String(entry.categoryId || "");
    if (categoryId !== "information" && categoryId !== "magazines") {
      return { ok: false, message: "Affectation réservée aux productions studio TV." };
    }
    const payload = presenterData && typeof presenterData === "object" ? presenterData : {};
    entry.presenterId = String(payload.presenterId || "").trim() || null;
    entry.presenterName = String(payload.presenterName || "").trim() || null;
    entry.presenterStarBonus = Number.isFinite(Number(payload.presenterStarBonus))
      ? Math.max(0, Math.min(1, Number(payload.presenterStarBonus)))
      : 0;
    entry.presenterIds = Array.isArray(payload.presenterIds)
      ? payload.presenterIds.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    entry.presenterNames = Array.isArray(payload.presenterNames)
      ? payload.presenterNames.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    entry.presenterStarBonuses = Array.isArray(payload.presenterStarBonuses)
      ? payload.presenterStarBonuses.map((value) => Math.max(0, Math.min(1, Number(value) || 0)))
      : [];
    if (Object.prototype.hasOwnProperty.call(payload, "directorId")) {
      entry.directorId = String(payload.directorId || "").trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "directorName")) {
      entry.directorName = String(payload.directorName || "").trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "directorStarBonus")) {
      entry.directorStarBonus = Number.isFinite(Number(payload.directorStarBonus))
        ? Math.max(0, Math.min(1, Number(payload.directorStarBonus)))
        : 0;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "producerId")) {
      entry.producerId = String(payload.producerId || "").trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "producerName")) {
      entry.producerName = String(payload.producerName || "").trim() || null;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "producerStarBonus")) {
      entry.producerStarBonus = Number.isFinite(Number(payload.producerStarBonus))
        ? Math.max(0, Math.min(1, Number(payload.producerStarBonus)))
        : 0;
    }
    if (Object.prototype.hasOwnProperty.call(payload, "coherenceBonus")) {
      entry.coherenceBonus = Number.isFinite(Number(payload.coherenceBonus))
        ? Math.max(0, Math.min(0.5, Number(payload.coherenceBonus)))
        : 0;
    }
    saveOwnedProgramDetails(sessionData, details);
    return { ok: true };
  }

  let session = recoverSession();

  function getSession() {
    const current = recoverSession();
    if (current) session = current;
    return session;
  }

  window.ProgramCatalog = {
    CATEGORY_DURATION_OPTIONS,
    PRODUCTION_BUDGET_LEVELS,
    getAvailableCategoriesForCurrentSession: function getAvailableCategories() {
      const activeSession = getSession();
      if (!activeSession) return [];
      return categoriesForOwned(activeSession);
    },
    getMarketCategoriesForCurrentSession: function getMarketCategories() {
      const activeSession = getSession();
      if (!activeSession) return [];
      return marketCategories(activeSession);
    },
    getFullCategoriesForCurrentSession: function getFullCategoriesForCurrentSession() {
      const activeSession = getSession();
      if (!activeSession) return [];
      ensureDynamicPrograms(activeSession);
      return CATEGORIES.map((category) => ({
        id: category.id,
        name: category.name,
        colorClass: category.colorClass,
        programs: category.programs.map((program) => program.title)
      }));
    },
    getOwnedCatalogForCurrentSession: function getOwnedCatalogForCurrentSession() {
      const activeSession = getSession();
      if (!activeSession) return [];
      return ownedCatalog(activeSession);
    },
    getProgramSellStatusForCurrentSession: function getProgramSellStatusForCurrentSession(title) {
      const activeSession = getSession();
      if (!activeSession) {
        return {
          canSell: false,
          reason: "Session introuvable.",
          resalePrice: 0,
          isScheduled: false,
          scheduledDateKeys: []
        };
      }
      return getSellStatus(activeSession, title);
    },
    sellProgramForCurrentSession: function sellProgramForCurrentSession(title) {
      const activeSession = getSession();
      if (!activeSession) return { ok: false, message: "Session introuvable.", resalePrice: 0 };
      return sellProgram(activeSession, title);
    },
    buyProgramForCurrentSession: function buyProgramForCurrentSession(title) {
      const activeSession = getSession();
      if (!activeSession) return { ok: false, message: "Session introuvable." };
      return buyProgram(activeSession, title);
    },
    regenerateDynamicFilmsForCurrentSession: function regenerateDynamicFilmsForCurrentSession() {
      const activeSession = getSession();
      if (!activeSession) return { ok: false, message: "Session introuvable." };
      return regenerateDynamicFilms(activeSession);
    },
    regenerateDynamicCategoryForCurrentSession: function regenerateDynamicCategoryForCurrentSession(categoryId) {
      const activeSession = getSession();
      if (!activeSession) return { ok: false, message: "Session introuvable." };
      return regenerateDynamicProgramsForCategory(activeSession, categoryId);
    },
    regenerateAllDynamicCategoriesForCurrentSession: function regenerateAllDynamicCategoriesForCurrentSession() {
      const activeSession = getSession();
      if (!activeSession) return { ok: false, message: "Session introuvable." };
      return regenerateAllDynamicPrograms(activeSession);
    },
    getRegeneratableMarketCategories: function getRegeneratableMarketCategories() {
      return CATEGORIES
        .filter((category) => category.id !== "information")
        .map((category) => ({ id: category.id, name: category.name }));
    },
    getProgramMeta: function getProgramMetaByTitle(title) {
      return getProgramMeta(title);
    },
    createProducedProgramForCurrentSession: function createProducedProgramForCurrentSession(payload) {
      const activeSession = getSession();
      if (!activeSession) return { ok: false, message: "Session introuvable." };
      return createProducedProgram(activeSession, payload);
    },
    registerStudioProductionForCurrentSession: function registerStudioProductionForCurrentSession(payload) {
      const activeSession = getSession();
      if (!activeSession) return { ok: false, message: "Session introuvable." };
      return registerStudioProduction(activeSession, payload);
    },
    getStudioProductionsForCurrentSession: function getStudioProductionsForCurrentSession() {
      const activeSession = getSession();
      if (!activeSession) return [];
      return getStudioProductions(activeSession);
    },
    getProgramEpisodeAvailabilityForDateForCurrentSession: function getProgramEpisodeAvailabilityForDateForCurrentSession(title, dateKey) {
      const activeSession = getSession();
      if (!activeSession) return null;
      return getProgramEpisodeAvailabilityForDate(activeSession, title, dateKey);
    },
    setProducedProgramPresenterForCurrentSession: function setProducedProgramPresenterForCurrentSession(title, presenterData) {
      const activeSession = getSession();
      if (!activeSession) return { ok: false, message: "Session introuvable." };
      return setProducedProgramPresenter(activeSession, title, presenterData);
    },
    deleteProducedProgramForCurrentSession: function deleteProducedProgramForCurrentSession(title, options) {
      const activeSession = getSession();
      if (!activeSession) return { ok: false, message: "Session introuvable." };
      const opts = options && typeof options === "object" ? options : {};
      return deleteProducedProgram(activeSession, title, opts);
    },
    getProgramSchedulingForCurrentSession: function getProgramSchedulingForCurrentSession(title) {
      const activeSession = getSession();
      if (!activeSession) return { isScheduled: false, dateKeys: [] };
      return getProgramSchedulingStatus(activeSession, title);
    }
  };
})();
