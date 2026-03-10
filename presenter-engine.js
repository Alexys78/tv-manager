(function presenterEngineInit() {
  const sessionUtils = window.SessionUtils;
  const appKeys = (sessionUtils && sessionUtils.APP_KEYS) || {};
  const PRESENTERS_KEY_PREFIX = appKeys.PRESENTERS_KEY_PREFIX || "tv_manager_presenters_";
  const STUDIO_SCHEDULE_KEY_PREFIX = appKeys.STUDIO_SCHEDULE_KEY_PREFIX || "tv_manager_studio_schedule_";
  const bank = window.PlayerBank;
  const finance = window.FinanceEngine;

  const DAYS_PER_MONTH = 30;
  const MIN_MONTHLY_SALARY = 2600;
  const TERMINATION_COST_MONTHS = 1;
  const MARKET_SIZE_PER_ROLE = 20;
  const WEEKDAY_LABELS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

  const ROLE_CONFIG = Object.freeze({
    presenters: {
      id: "presenters",
      label: "Présentateurs",
      singular: "Présentateur",
      singularLower: "présentateur",
      idPrefix: "pr",
      recruitCategory: "recrutement_presentateurs",
      fireCategory: "licenciement_presentateurs",
      specialties: [
        "Divertissements · Jeu TV",
        "Divertissements · Talk-show",
        "Divertissements · Variété",
        "Divertissements · Humour",
        "Divertissements · Prime",
        "Divertissements · Talent-show",
        "Documentaires · Histoire",
        "Documentaires · Science",
        "Documentaires · Nature",
        "Documentaires · Investigation",
        "Jeunesse · Animation",
        "Jeunesse · Éducatif",
        "Jeunesse · Aventure",
        "Jeunesse · Découverte",
        "Magazines · Société",
        "Magazines · Consommation",
        "Magazines · Culture",
        "Magazines · Lifestyle",
        "Magazines · Investigation",
        "Culture & Musique · Concert",
        "Culture & Musique · Théâtre",
        "Culture & Musique · Opéra",
        "Culture & Musique · Danse",
        "Culture & Musique · Arts visuels",
        "Télé-réalité · Compétition",
        "Télé-réalité · Vie quotidienne",
        "Télé-réalité · Aventure",
        "Télé-réalité · Cuisine",
        "Télé-réalité · Dating"
      ]
    },
    journalists: {
      id: "journalists",
      label: "Journalistes",
      singular: "Journaliste",
      singularLower: "journaliste",
      idPrefix: "jr",
      recruitCategory: "recrutement_journalistes",
      fireCategory: "licenciement_journalistes",
      specialties: [
        "Informations · JT",
        "Informations · Météo",
        "Informations · Économie",
        "Informations · Politique",
        "Informations · Matinale",
        "Informations · International",
        "Informations · Faits divers",
        "Informations · Culture",
        "Informations · Santé",
        "Informations · Sport flash"
      ]
    }
  });

  const ROLE_KEYS = Object.freeze(Object.keys(ROLE_CONFIG));
  const LEGACY_INFO_SPECIALTIES = new Set([
    "jt",
    "debat",
    "eco",
    "economie",
    "culture",
    "societe",
    "matinale",
    "international",
    "faits divers",
    "meteo",
    "sante",
    "sport flash",
    "politique"
  ]);

  const FIRST_NAMES = [
    "Camille", "Nora", "Lina", "Maya", "Eva", "Sarah", "Lou", "Inès", "Zoé", "Manon",
    "Lucas", "Noah", "Hugo", "Adam", "Léo", "Nolan", "Théo", "Ethan", "Tom", "Mathis",
    "Emma", "Lola", "Jade", "Chloé", "Sofia", "Nina", "Anna", "Lisa", "Léa", "Clara",
    "Arthur", "Gabriel", "Raphaël", "Louis", "Jules", "Nathan", "Antoine", "Paul", "Baptiste", "Maxime",
    "Alicia", "Marine", "Jeanne", "Margot", "Juliette", "Alexia", "Océane", "Elsa", "Agathe", "Mélanie"
  ];

  const ROLE_FIRST_NAMES = Object.freeze({
    presenters: [
      "Camille", "Nora", "Maya", "Sarah", "Inès", "Manon", "Emma", "Lola", "Jade", "Chloé",
      "Sofia", "Nina", "Anna", "Léa", "Clara", "Arthur", "Gabriel", "Raphaël", "Louis", "Jules",
      "Nathan", "Antoine", "Paul", "Baptiste", "Maxime", "Jeanne", "Margot", "Juliette", "Alexia", "Océane",
      "Elsa", "Agathe", "Mélanie", "Lina", "Eva", "Lou", "Lucas", "Noah", "Hugo", "Tom"
    ],
    journalists: [
      "Amina", "Clémence", "Siham", "Nawel", "Morgane", "Céline", "Héloïse", "Noémie", "Salomé", "Maëlys",
      "Violette", "Suzanne", "Aurore", "Bérénice", "Élodie", "Marina", "Tiphaine", "Cassandra", "Sabrina", "Nadège",
      "Idriss", "Yanis", "Karim", "Samir", "Rayan", "Sami", "Farès", "Nassim", "Anis", "Romain",
      "Quentin", "Valentin", "Damien", "Florian", "Adrien", "Gaspard", "Aurélien", "Benoît", "Mathieu", "Kylian"
    ]
  });

  const LAST_NAMES = [
    "Martin", "Bernard", "Robert", "Dubois", "Morel", "Laurent", "Simon", "Michel", "Leroy", "Roux",
    "Fournier", "Girard", "Bonnet", "Dupont", "Lambert", "Fontaine", "Rousseau", "Vincent", "Muller", "Faure",
    "Garcia", "David", "Bertrand", "Moreau", "Lefebvre", "Mercier", "Blanc", "Henry", "Renaud", "Schmitt",
    "Garnier", "Chevalier", "Petit", "Lopez", "Perrin", "Marchand", "Meyer", "Renard", "Leclerc", "Boyer",
    "Gauthier", "Masson", "Picard", "Morin", "Lemoine", "Caron", "Robin", "Noël", "Colin", "Aubry"
  ];

  function getSession() {
    if (!sessionUtils || typeof sessionUtils.recoverSessionFromLocation !== "function") return null;
    return sessionUtils.recoverSessionFromLocation({ persist: true });
  }

  function getPlayerId(sessionData) {
    if (!sessionUtils || typeof sessionUtils.getPlayerId !== "function") return "player";
    return sessionUtils.getPlayerId(sessionData);
  }

  function presentersKey(sessionData) {
    return `${PRESENTERS_KEY_PREFIX}${getPlayerId(sessionData)}`;
  }

  function studioScheduleKey(sessionData) {
    return `${STUDIO_SCHEDULE_KEY_PREFIX}${getPlayerId(sessionData)}`;
  }

  function getRoleKey(role) {
    const safe = String(role || "").trim();
    if (ROLE_CONFIG[safe]) return safe;
    return "presenters";
  }

  function getRoleConfig(role) {
    return ROLE_CONFIG[getRoleKey(role)];
  }

  function emptyRoleBucket() {
    return { hired: [], market: [], revision: 0, lastRefreshAnchor: "" };
  }

  function emptyStore() {
    return {
      roles: {
        presenters: emptyRoleBucket(),
        journalists: emptyRoleBucket()
      }
    };
  }

  function hashString(value) {
    let hash = 0;
    const safe = String(value || "");
    for (let i = 0; i < safe.length; i += 1) {
      hash = ((hash * 31) + safe.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function seededRandom(seed) {
    let state = seed >>> 0;
    return function next() {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 0xffffffff;
    };
  }

  function uniqueList(items) {
    const out = [];
    const used = new Set();
    (Array.isArray(items) ? items : []).forEach((item) => {
      const value = String(item || "").trim();
      const key = value.toLowerCase();
      if (!value || used.has(key)) return;
      used.add(key);
      out.push(value);
    });
    return out;
  }

  function buildFirstNamePoolForRole(role) {
    const roleKey = getRoleKey(role);
    const scoped = Array.isArray(ROLE_FIRST_NAMES[roleKey]) ? ROLE_FIRST_NAMES[roleKey] : [];
    const merged = uniqueList([...scoped, ...FIRST_NAMES]);
    return merged.length > 0 ? merged : FIRST_NAMES.slice();
  }

  function buildShuffledPool(list, seedBase) {
    const source = Array.isArray(list) ? list.slice() : [];
    if (source.length <= 1) return source;
    const rand = seededRandom(hashString(String(seedBase || "shuffle")));
    for (let i = source.length - 1; i > 0; i -= 1) {
      const swapIndex = Math.floor(rand() * (i + 1));
      const tmp = source[i];
      source[i] = source[swapIndex];
      source[swapIndex] = tmp;
    }
    return source;
  }

  function toDateKey(date) {
    const safeDate = date instanceof Date ? date : new Date();
    const year = safeDate.getFullYear();
    const month = String(safeDate.getMonth() + 1).padStart(2, "0");
    const day = String(safeDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getWeeklyMarketRefreshAnchor(date) {
    const current = new Date(date);
    current.setHours(0, 0, 0, 0);
    const weekday = current.getDay();
    const monday = new Date(current);
    monday.setDate(current.getDate() - ((weekday + 6) % 7));
    return monday;
  }

  function getCurrentRefreshAnchorKey() {
    return toDateKey(getWeeklyMarketRefreshAnchor(new Date()));
  }

  function computeStarBonusFromStats(stats) {
    const editorial = clamp(stats && stats.editorial, 0, 100);
    const charisma = clamp(stats && stats.charisma, 0, 100);
    const notoriety = clamp(stats && stats.notoriety, 0, 100);
    const score = (editorial * 0.45) + (charisma * 0.35) + (notoriety * 0.2);
    if (score >= 86) return 2;
    if (score >= 76) return 1.5;
    if (score >= 66) return 1;
    return 0.5;
  }

  function sanitizeTalent(raw, role) {
    if (!raw || typeof raw !== "object") return null;
    const roleKey = getRoleKey(role || raw.role);
    const roleConfig = getRoleConfig(roleKey);
    const id = String(raw.id || "").trim();
    const fullName = String(raw.fullName || "").trim();
    if (!id || !fullName) return null;

    const fallbackSpecialty = roleConfig.specialties[0] || "JT";
    let specialty = String(raw.specialty || fallbackSpecialty).trim() || fallbackSpecialty;
    if (roleKey === "presenters" && LEGACY_INFO_SPECIALTIES.has(normalizeText(specialty))) {
      const pool = ROLE_CONFIG.presenters.specialties;
      const idx = Math.abs(hashString(`${id}:${fullName}:${specialty}`)) % pool.length;
      specialty = pool[idx];
    }
    const editorial = Math.round(clamp(raw.editorial, 35, 98));
    const charisma = Math.round(clamp(raw.charisma, 35, 98));
    const notoriety = Math.round(clamp(raw.notoriety, 20, 98));
    const legacySalaryDaily = Math.max(0, Math.round(Number(raw.salaryDaily) || 0));
    const providedSalaryMonthly = Math.round(Number(raw.salaryMonthly));
    const salaryMonthly = Math.max(
      MIN_MONTHLY_SALARY,
      Number.isFinite(providedSalaryMonthly) && providedSalaryMonthly > 0
        ? providedSalaryMonthly
        : legacySalaryDaily
    );
    const salaryDaily = Math.max(0, Math.round(salaryMonthly / DAYS_PER_MONTH));
    const signingBonus = Math.max(0, Math.round(Number(raw.signingBonus) || 0));
    const starBonus = Number.isFinite(Number(raw.starBonus))
      ? clamp(raw.starBonus, 0.5, 2)
      : computeStarBonusFromStats({ editorial, charisma, notoriety });

    return {
      id,
      role: roleKey,
      fullName,
      specialty,
      editorial,
      charisma,
      notoriety,
      starBonus,
      salaryMonthly,
      salaryDaily,
      signingBonus,
      contractType: "CDI",
      hiredAt: typeof raw.hiredAt === "string" ? raw.hiredAt : null
    };
  }

  function sanitizeRoleBucket(rawBucket, role) {
    const bucket = rawBucket && typeof rawBucket === "object" ? rawBucket : {};
    const hired = Array.isArray(bucket.hired) ? bucket.hired.map((item) => sanitizeTalent(item, role)).filter(Boolean) : [];
    const market = Array.isArray(bucket.market) ? bucket.market.map((item) => sanitizeTalent(item, role)).filter(Boolean) : [];
    const revision = Math.max(0, Math.floor(Number(bucket.revision) || 0));
    const lastRefreshAnchor = typeof bucket.lastRefreshAnchor === "string" ? bucket.lastRefreshAnchor : "";
    return { hired, market, revision, lastRefreshAnchor };
  }

  function sanitizeStore(raw) {
    const base = emptyStore();
    const source = raw && typeof raw === "object" ? raw : {};

    if (source.roles && typeof source.roles === "object") {
      ROLE_KEYS.forEach((roleKey) => {
        base.roles[roleKey] = sanitizeRoleBucket(source.roles[roleKey], roleKey);
      });
      return base;
    }

    if (source.presenters || source.journalists) {
      base.roles.presenters = sanitizeRoleBucket(source.presenters, "presenters");
      base.roles.journalists = sanitizeRoleBucket(source.journalists, "journalists");
      return base;
    }

    // Legacy format: top-level hired/market/revision/lastRefreshAnchor belonged to presenters.
    base.roles.presenters = sanitizeRoleBucket(
      {
        hired: source.hired,
        market: source.market,
        revision: source.revision,
        lastRefreshAnchor: source.lastRefreshAnchor
      },
      "presenters"
    );
    return base;
  }

  function readStore(sessionData) {
    if (!sessionData) return emptyStore();
    const raw = localStorage.getItem(presentersKey(sessionData));
    if (!raw) return emptyStore();
    try {
      return sanitizeStore(JSON.parse(raw));
    } catch {
      return emptyStore();
    }
  }

  function writeStore(sessionData, payload) {
    if (!sessionData) return emptyStore();
    const clean = sanitizeStore(payload);
    localStorage.setItem(presentersKey(sessionData), JSON.stringify(clean));
    return clean;
  }

  function isCloudBootstrapInProgress() {
    const syncApi = window.TVManagerCloudSync;
    if (!syncApi || typeof syncApi.getSyncState !== "function") return false;
    const state = syncApi.getSyncState();
    if (!state || typeof state !== "object") return false;
    const status = String(state.status || "");
    const hasSyncedOnce = Boolean(state.lastSuccessAt);
    return !hasSyncedOnce && (status === "syncing" || status === "pending");
  }

  function generateTalent(playerId, role, index, revision, salt, nameHint) {
    const roleConfig = getRoleConfig(role);
    const rand = seededRandom(hashString(`${playerId}:${role}:${revision}:${index}:${Number(salt) || 0}`));
    const safeHint = nameHint && typeof nameHint === "object" ? nameHint : {};
    const firstName = String(safeHint.firstName || "").trim()
      || FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
    const lastName = String(safeHint.lastName || "").trim()
      || LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
    const specialtyList = Array.isArray(roleConfig.specialties) && roleConfig.specialties.length > 0
      ? roleConfig.specialties
      : ["JT"];
    const specialty = specialtyList[Math.floor(rand() * specialtyList.length)];

    const editorial = Math.round(48 + (rand() * 44));
    const charisma = Math.round(45 + (rand() * 46));
    const notoriety = Math.round(28 + (rand() * 58));
    const starBonus = computeStarBonusFromStats({ editorial, charisma, notoriety });
    const salaryMonthly = Math.round(2600 + (editorial * 42) + (charisma * 33) + (notoriety * 36));
    const signingBonus = Math.round(salaryMonthly * (2 + (rand() * 2.5)));

    return sanitizeTalent({
      id: `${roleConfig.idPrefix}_${revision}_${index}_${hashString(`${firstName}${lastName}${specialty}_${Number(salt) || 0}`).toString(36).slice(0, 6)}`,
      role,
      fullName: `${firstName} ${lastName}`,
      specialty,
      editorial,
      charisma,
      notoriety,
      starBonus,
      salaryMonthly,
      signingBonus,
      contractType: "CDI"
    }, role);
  }

  function generateMarket(playerId, role, revision) {
    const firstNamePool = buildShuffledPool(
      buildFirstNamePoolForRole(role),
      `${playerId}:${role}:${revision}:first_names`
    );
    const lastNamePool = buildShuffledPool(
      LAST_NAMES,
      `${playerId}:${role}:${revision}:last_names`
    );
    const list = [];
    const usedNames = new Set();
    for (let i = 0; i < MARKET_SIZE_PER_ROLE; i += 1) {
      let picked = null;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const firstName = firstNamePool[(i + attempt) % firstNamePool.length];
        const lastName = lastNamePool[((i * 2) + attempt) % lastNamePool.length];
        const candidate = generateTalent(playerId, role, i, revision, attempt, { firstName, lastName });
        if (!candidate) continue;
        const key = String(candidate.fullName || "").trim().toLowerCase();
        if (!key || usedNames.has(key)) continue;
        usedNames.add(key);
        picked = candidate;
        break;
      }
      if (!picked) {
        const fallback = generateTalent(playerId, role, i, revision, 999 + i, {
          firstName: firstNamePool[i % firstNamePool.length],
          lastName: lastNamePool[i % lastNamePool.length]
        });
        if (fallback) {
          let name = String(fallback.fullName || "").trim();
          if (name && usedNames.has(name.toLowerCase())) {
            name = `${name} ${i + 1}`;
            fallback.fullName = name;
          }
          if (name) usedNames.add(name.toLowerCase());
          picked = fallback;
        }
      }
      if (picked) list.push(picked);
    }
    return list;
  }

  function ensureStore(sessionData) {
    if (!sessionData) return emptyStore();
    const hasPersistedStore = localStorage.getItem(presentersKey(sessionData)) !== null;
    const current = readStore(sessionData);
    if (!hasPersistedStore && isCloudBootstrapInProgress()) {
      return current;
    }

    const refreshAnchor = getCurrentRefreshAnchorKey();
    const next = sanitizeStore(current);
    let changed = false;

    ROLE_KEYS.forEach((roleKey) => {
      const bucket = next.roles[roleKey] || emptyRoleBucket();
      const hasMarket = Array.isArray(bucket.market) && bucket.market.length > 0;
      const hasAnchor = Boolean(bucket.lastRefreshAnchor);

      if (hasAnchor && bucket.lastRefreshAnchor !== refreshAnchor) {
        const nextRevision = (bucket.revision || 0) + 1;
        next.roles[roleKey] = {
          hired: Array.isArray(bucket.hired) ? bucket.hired : [],
          market: generateMarket(getPlayerId(sessionData), roleKey, nextRevision),
          revision: nextRevision,
          lastRefreshAnchor: refreshAnchor
        };
        changed = true;
        return;
      }

      if (hasMarket && !hasAnchor) {
        next.roles[roleKey] = {
          ...bucket,
          lastRefreshAnchor: refreshAnchor
        };
        changed = true;
        return;
      }

      if (!hasMarket && !hasAnchor) {
        next.roles[roleKey] = {
          hired: Array.isArray(bucket.hired) ? bucket.hired : [],
          market: generateMarket(getPlayerId(sessionData), roleKey, bucket.revision || 0),
          revision: bucket.revision || 0,
          lastRefreshAnchor: refreshAnchor
        };
        changed = true;
      }
    });

    if (!changed) return current;
    return writeStore(sessionData, next);
  }

  function getRoleBucket(store, role) {
    const safeStore = sanitizeStore(store);
    const roleKey = getRoleKey(role);
    return safeStore.roles[roleKey] || emptyRoleBucket();
  }

  function getOwnedByRole(sessionData, role) {
    const store = ensureStore(sessionData);
    const bucket = getRoleBucket(store, role);
    return bucket.hired.slice();
  }

  function getMarketByRole(sessionData, role) {
    const store = ensureStore(sessionData);
    const bucket = getRoleBucket(store, role);
    const ownedIds = new Set((bucket.hired || []).map((item) => item.id));
    return (bucket.market || []).filter((item) => !ownedIds.has(item.id));
  }

  function findOwnedByRole(sessionData, role, staffId) {
    const id = String(staffId || "").trim();
    if (!id) return null;
    const owned = getOwnedByRole(sessionData, role);
    return owned.find((item) => item.id === id) || null;
  }

  function getStarBonusByRole(sessionData, role, staffId) {
    const item = findOwnedByRole(sessionData, role, staffId);
    if (!item) return 0;
    return clamp(Number(item.starBonus) || 0.5, 0.5, 2);
  }

  function visibleCountFromStored(store, role) {
    const bucket = getRoleBucket(store, role);
    const ownedIds = new Set((bucket.hired || []).map((item) => item.id));
    return (bucket.market || []).filter((item) => !ownedIds.has(item.id)).length;
  }

  function regenerateRoleMarket(sessionData, role, options) {
    if (!sessionData) return { ok: false, message: "Session introuvable." };
    const roleKey = getRoleKey(role);
    const cfg = getRoleConfig(roleKey);
    const opts = options && typeof options === "object" ? options : {};
    const force = Boolean(opts.force);

    const current = readStore(sessionData);
    const bucket = getRoleBucket(current, roleKey);
    const refreshAnchor = getCurrentRefreshAnchorKey();
    const hasMarket = Array.isArray(bucket.market) && bucket.market.length > 0;
    const hasAnchor = Boolean(bucket.lastRefreshAnchor);
    const needsWeeklyRefresh = hasAnchor && bucket.lastRefreshAnchor !== refreshAnchor;
    const needsSeed = !hasMarket;

    if (!force && !needsWeeklyRefresh && !needsSeed) {
      return {
        ok: true,
        role: roleKey,
        refreshed: false,
        count: getMarketByRole(sessionData, roleKey).length,
        message: `${cfg.label} déjà à jour pour cette semaine.`
      };
    }

    const shouldIncrementRevision = force || needsWeeklyRefresh;
    const nextRevision = Math.max(0, Math.floor(Number(bucket.revision) || 0)) + (shouldIncrementRevision ? 1 : 0);

    const next = sanitizeStore(current);
    next.roles[roleKey] = {
      hired: Array.isArray(bucket.hired) ? bucket.hired : [],
      market: generateMarket(getPlayerId(sessionData), roleKey, nextRevision),
      revision: nextRevision,
      lastRefreshAnchor: refreshAnchor
    };

    const stored = writeStore(sessionData, next);
    const count = visibleCountFromStored(stored, roleKey);
    return {
      ok: true,
      role: roleKey,
      refreshed: true,
      count,
      revision: nextRevision,
      message: force
        ? `${cfg.label} renouvelés (forcé).`
        : (needsWeeklyRefresh
          ? `${cfg.label} renouvelés pour la nouvelle semaine.`
          : `${cfg.label} initialisés.`)
    };
  }

  function regenerateAllMarkets(sessionData, options) {
    if (!sessionData) return { ok: false, message: "Session introuvable." };
    const results = ROLE_KEYS.map((roleKey) => regenerateRoleMarket(sessionData, roleKey, options));
    const failed = results.find((item) => !item || !item.ok);
    if (failed) {
      return {
        ok: false,
        message: failed && failed.message ? failed.message : "Renouvellement impossible.",
        results
      };
    }
    const total = results.reduce((sum, item) => sum + (Number(item && item.count) || 0), 0);
    return {
      ok: true,
      results,
      total,
      count: total,
      message: `Casting renouvelé (${total} profils disponibles).`
    };
  }

  function hireByRole(sessionData, role, staffId) {
    const roleKey = getRoleKey(role);
    const cfg = getRoleConfig(roleKey);
    const id = String(staffId || "").trim();
    if (!sessionData || !id) return { ok: false, message: `${cfg.singular} invalide.` };

    const store = ensureStore(sessionData);
    const bucket = getRoleBucket(store, roleKey);
    if (bucket.hired.some((item) => item.id === id)) {
      return { ok: false, message: `${cfg.singular} déjà en CDI.` };
    }

    const target = (bucket.market || []).find((item) => item.id === id);
    if (!target) {
      return { ok: false, message: `${cfg.singular} introuvable.` };
    }

    if (!bank || typeof bank.getBalance !== "function" || typeof bank.add !== "function") {
      return { ok: false, message: "Module bancaire indisponible." };
    }

    const bonus = Math.max(0, Number(target.signingBonus) || 0);
    const balance = Number(bank.getBalance()) || 0;
    if (balance < bonus) {
      return {
        ok: false,
        message: `Fonds insuffisants pour recruter ${target.fullName} (${sessionUtils.formatEuro(bonus)}).`
      };
    }

    bank.add(-bonus, {
      category: cfg.recruitCategory,
      label: `Recrutement ${cfg.singular}: ${target.fullName}`
    });

    if (finance && typeof finance.recordTransaction === "function") {
      finance.recordTransaction(sessionData, {
        amount: -bonus,
        category: cfg.recruitCategory,
        label: `Recrutement ${cfg.singular}: ${target.fullName}`
      });
    }

    const hired = {
      ...target,
      role: roleKey,
      hiredAt: new Date().toISOString(),
      contractType: "CDI"
    };

    const next = sanitizeStore(store);
    const nextBucket = getRoleBucket(next, roleKey);
    next.roles[roleKey] = {
      ...nextBucket,
      hired: [...(nextBucket.hired || []), hired],
      market: (nextBucket.market || []).filter((item) => item.id !== id)
    };
    writeStore(sessionData, next);

    return { ok: true, role: roleKey, staff: hired, message: `${target.fullName} rejoint l'équipe en CDI.` };
  }

  function getSalaryBreakdown(sessionData) {
    const rows = [];
    ROLE_KEYS.forEach((roleKey) => {
      const cfg = getRoleConfig(roleKey);
      const hired = getOwnedByRole(sessionData, roleKey);
      hired.forEach((item) => {
        rows.push({
          role: cfg.singular,
          name: item.fullName,
          amount: Math.max(0, Math.round((Number(item.salaryMonthly) || 0) / DAYS_PER_MONTH))
        });
      });
    });
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    return { rows, total };
  }

  function readStudioSchedule(sessionData) {
    if (!sessionData) return [];
    try {
      const raw = localStorage.getItem(studioScheduleKey(sessionData));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function entryStaffIds(entry) {
    if (!entry || typeof entry !== "object") return [];
    const ids = Array.isArray(entry.presenterIds)
      ? entry.presenterIds.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const legacy = String(entry.presenterId || "").trim();
    if (!ids.length && legacy) ids.push(legacy);
    return Array.from(new Set(ids));
  }

  function pad2(value) {
    return String(Math.max(0, Math.floor(Number(value) || 0))).padStart(2, "0");
  }

  function formatMinute(value) {
    const minute = Math.max(0, Math.floor(Number(value) || 0));
    const h = Math.floor(minute / 60);
    const m = minute % 60;
    return `${pad2(h)}:${pad2(m)}`;
  }

  function formatDateForUi(dateKey) {
    if (!dateKey) return "";
    const parsed = sessionUtils.parseDateKey(dateKey);
    if (!parsed) return dateKey;
    return parsed.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long"
    });
  }

  function isActiveAssignment(entry, todayKey) {
    if (!entry || typeof entry !== "object") return false;
    const mode = entry.recurrenceMode === "recurring" ? "recurring" : "single";
    if (mode === "single") {
      const dateKey = String(entry.dateKey || "");
      return Boolean(dateKey) && dateKey >= todayKey;
    }
    const start = String(entry.recurrenceStartDate || "");
    const end = String(entry.recurrenceEndDate || "");
    if (start && start > todayKey) return true;
    return !end || end >= todayKey;
  }

  function getRecurringDays(entry) {
    return Array.isArray(entry && entry.recurrenceDays)
      ? entry.recurrenceDays.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      : [];
  }

  function formatAssignmentLabel(entry) {
    const title = String((entry && entry.title) || "Programme");
    const start = formatMinute(entry && entry.startMinute);
    const mode = entry && entry.recurrenceMode === "recurring" ? "recurring" : "single";
    if (mode === "single") {
      const dateLabel = formatDateForUi(String((entry && entry.dateKey) || ""));
      return `${title} · ${dateLabel} · ${start}`;
    }
    const days = getRecurringDays(entry)
      .map((day) => WEEKDAY_LABELS[day])
      .filter(Boolean)
      .join(", ");
    return `${title} · Récurrent (${days || "-"}) · ${start}`;
  }

  function listActiveAssignmentsByStaff(sessionData, staffId) {
    const id = String(staffId || "").trim();
    if (!sessionData || !id) return [];
    const todayKey = toDateKey(new Date());
    return readStudioSchedule(sessionData)
      .filter((entry) => entryStaffIds(entry).includes(id))
      .filter((entry) => isActiveAssignment(entry, todayKey))
      .map((entry) => ({
        id: String(entry && entry.id ? entry.id : ""),
        label: formatAssignmentLabel(entry)
      }));
  }

  function getTerminationCost(staff) {
    if (!staff || typeof staff !== "object") return 0;
    const monthly = Math.max(
      MIN_MONTHLY_SALARY,
      Math.round(Number(staff.salaryMonthly) || Math.round((Number(staff.salaryDaily) || 0) * DAYS_PER_MONTH))
    );
    return Math.max(0, Math.round(monthly * TERMINATION_COST_MONTHS));
  }

  function getTerminationStatusByRole(sessionData, role, staffId) {
    const roleKey = getRoleKey(role);
    const cfg = getRoleConfig(roleKey);
    const staff = findOwnedByRole(sessionData, roleKey, staffId);
    if (!sessionData || !staff) {
      return {
        ok: false,
        code: "not_found",
        message: `${cfg.singular} introuvable.`
      };
    }

    const assignments = listActiveAssignmentsByStaff(sessionData, staffId);
    const cost = getTerminationCost(staff);
    if (assignments.length > 0) {
      return {
        ok: false,
        code: "assigned",
        staff,
        role: roleKey,
        cost,
        assignments,
        message: `Licenciement impossible: ce ${cfg.singularLower} est affecté à un programme.`
      };
    }

    if (!bank || typeof bank.getBalance !== "function" || typeof bank.add !== "function") {
      return {
        ok: false,
        code: "bank_unavailable",
        staff,
        role: roleKey,
        cost,
        message: "Module bancaire indisponible."
      };
    }

    const balance = Number(bank.getBalance()) || 0;
    if (balance < cost) {
      return {
        ok: false,
        code: "insufficient_funds",
        staff,
        role: roleKey,
        cost,
        missing: Math.max(0, cost - balance),
        message: "Fonds insuffisants pour payer les frais de licenciement."
      };
    }

    return {
      ok: true,
      code: "ok",
      staff,
      role: roleKey,
      cost,
      assignments: []
    };
  }

  function fireByRole(sessionData, role, staffId) {
    const roleKey = getRoleKey(role);
    const cfg = getRoleConfig(roleKey);
    const status = getTerminationStatusByRole(sessionData, roleKey, staffId);
    if (!status.ok) return status;

    const id = String(staffId || "").trim();
    const store = ensureStore(sessionData);
    const bucket = getRoleBucket(store, roleKey);
    if (!(bucket.hired || []).some((item) => item.id === id)) {
      return { ok: false, code: "not_found", message: `${cfg.singular} introuvable.` };
    }

    const cost = Math.max(0, Math.round(Number(status.cost) || 0));
    const staffName = String((status.staff && status.staff.fullName) || cfg.singular);

    if (cost > 0) {
      bank.add(-cost, {
        category: cfg.fireCategory,
        label: `Licenciement ${cfg.singular}: ${staffName}`
      });
      if (finance && typeof finance.recordTransaction === "function") {
        finance.recordTransaction(sessionData, {
          amount: -cost,
          category: cfg.fireCategory,
          label: `Licenciement ${cfg.singular}: ${staffName}`
        });
      }
    }

    const next = sanitizeStore(store);
    const nextBucket = getRoleBucket(next, roleKey);
    next.roles[roleKey] = {
      ...nextBucket,
      hired: (nextBucket.hired || []).filter((item) => item.id !== id)
    };
    writeStore(sessionData, next);

    return {
      ok: true,
      code: "fired",
      role: roleKey,
      staff: status.staff,
      cost,
      message: `${staffName} a été licencié.`
    };
  }

  function listRoles() {
    return ROLE_KEYS.map((roleKey) => {
      const cfg = getRoleConfig(roleKey);
      return {
        id: cfg.id,
        label: cfg.label,
        singular: cfg.singular,
        singularLower: cfg.singularLower
      };
    });
  }

  window.PresenterEngine = {
    listRolesForCurrentSession: function listRolesForCurrentSession() {
      return listRoles();
    },
    getRoleDefinition: function getRoleDefinition(role) {
      return getRoleConfig(role);
    },
    getOwnedStaffByRoleForCurrentSession: function getOwnedStaffByRoleForCurrentSession(role) {
      const session = getSession();
      if (!session) return [];
      return getOwnedByRole(session, role);
    },
    getMarketStaffByRoleForCurrentSession: function getMarketStaffByRoleForCurrentSession(role) {
      const session = getSession();
      if (!session) return [];
      return getMarketByRole(session, role);
    },
    hireStaffForCurrentSession: function hireStaffForCurrentSession(role, staffId) {
      const session = getSession();
      if (!session) return { ok: false, message: "Session introuvable." };
      return hireByRole(session, role, staffId);
    },
    getStaffByIdForCurrentSession: function getStaffByIdForCurrentSession(role, staffId) {
      const session = getSession();
      if (!session) return null;
      return findOwnedByRole(session, role, staffId);
    },
    getStaffStarBonusForCurrentSession: function getStaffStarBonusForCurrentSession(role, staffId) {
      const session = getSession();
      if (!session) return 0;
      return getStarBonusByRole(session, role, staffId);
    },
    getStaffTerminationStatusForCurrentSession: function getStaffTerminationStatusForCurrentSession(role, staffId) {
      const session = getSession();
      if (!session) return { ok: false, code: "no_session", message: "Session introuvable." };
      return getTerminationStatusByRole(session, role, staffId);
    },
    fireStaffForCurrentSession: function fireStaffForCurrentSession(role, staffId) {
      const session = getSession();
      if (!session) return { ok: false, code: "no_session", message: "Session introuvable." };
      return fireByRole(session, role, staffId);
    },
    regenerateRoleMarketForCurrentSession: function regenerateRoleMarketForCurrentSession(role, options) {
      const session = getSession();
      if (!session) return { ok: false, message: "Session introuvable." };
      return regenerateRoleMarket(session, role, options);
    },
    regenerateAllMarketsForCurrentSession: function regenerateAllMarketsForCurrentSession(options) {
      const session = getSession();
      if (!session) return { ok: false, message: "Session introuvable." };
      return regenerateAllMarkets(session, options);
    },

    // Compatibilité API historique "présentateurs".
    getOwnedPresentersForCurrentSession: function getOwnedPresentersForCurrentSession() {
      const session = getSession();
      if (!session) return [];
      return getOwnedByRole(session, "presenters");
    },
    getMarketPresentersForCurrentSession: function getMarketPresentersForCurrentSession() {
      const session = getSession();
      if (!session) return [];
      return getMarketByRole(session, "presenters");
    },
    hirePresenterForCurrentSession: function hirePresenterForCurrentSession(staffId) {
      const session = getSession();
      if (!session) return { ok: false, message: "Session introuvable." };
      return hireByRole(session, "presenters", staffId);
    },
    getPresenterByIdForCurrentSession: function getPresenterByIdForCurrentSession(staffId) {
      const session = getSession();
      if (!session) return null;
      return findOwnedByRole(session, "presenters", staffId);
    },
    getPresenterStarBonusForCurrentSession: function getPresenterStarBonusForCurrentSession(staffId) {
      const session = getSession();
      if (!session) return 0;
      return getStarBonusByRole(session, "presenters", staffId);
    },
    getPresenterTerminationStatusForCurrentSession: function getPresenterTerminationStatusForCurrentSession(staffId) {
      const session = getSession();
      if (!session) return { ok: false, code: "no_session", message: "Session introuvable." };
      return getTerminationStatusByRole(session, "presenters", staffId);
    },
    firePresenterForCurrentSession: function firePresenterForCurrentSession(staffId) {
      const session = getSession();
      if (!session) return { ok: false, code: "no_session", message: "Session introuvable." };
      return fireByRole(session, "presenters", staffId);
    },
    regenerateMarketForCurrentSession: function regenerateMarketForCurrentSession(options) {
      const session = getSession();
      if (!session) return { ok: false, message: "Session introuvable." };
      return regenerateAllMarkets(session, options);
    },

    // API explicite journalistes.
    getOwnedJournalistsForCurrentSession: function getOwnedJournalistsForCurrentSession() {
      const session = getSession();
      if (!session) return [];
      return getOwnedByRole(session, "journalists");
    },
    getMarketJournalistsForCurrentSession: function getMarketJournalistsForCurrentSession() {
      const session = getSession();
      if (!session) return [];
      return getMarketByRole(session, "journalists");
    },
    hireJournalistForCurrentSession: function hireJournalistForCurrentSession(staffId) {
      const session = getSession();
      if (!session) return { ok: false, message: "Session introuvable." };
      return hireByRole(session, "journalists", staffId);
    },
    getJournalistByIdForCurrentSession: function getJournalistByIdForCurrentSession(staffId) {
      const session = getSession();
      if (!session) return null;
      return findOwnedByRole(session, "journalists", staffId);
    },
    getJournalistStarBonusForCurrentSession: function getJournalistStarBonusForCurrentSession(staffId) {
      const session = getSession();
      if (!session) return 0;
      return getStarBonusByRole(session, "journalists", staffId);
    },
    getJournalistTerminationStatusForCurrentSession: function getJournalistTerminationStatusForCurrentSession(staffId) {
      const session = getSession();
      if (!session) return { ok: false, code: "no_session", message: "Session introuvable." };
      return getTerminationStatusByRole(session, "journalists", staffId);
    },
    fireJournalistForCurrentSession: function fireJournalistForCurrentSession(staffId) {
      const session = getSession();
      if (!session) return { ok: false, code: "no_session", message: "Session introuvable." };
      return fireByRole(session, "journalists", staffId);
    },

    getSalaryBreakdownForCurrentSession: function getSalaryBreakdownForCurrentSession() {
      const session = getSession();
      if (!session) return { rows: [], total: 0 };
      return getSalaryBreakdown(session);
    },

    computeStarBonusFromStats
  };
})();
