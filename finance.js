(function financeInit() {
  const sessionUtils = window.SessionUtils;
  const appKeys = (window.SessionUtils && window.SessionUtils.APP_KEYS) || {};
  const FINANCE_RESULTS_KEY_PREFIX = appKeys.FINANCE_RESULTS_KEY_PREFIX || "tv_manager_finance_results_";
  const TRANSACTIONS_KEY_PREFIX = appKeys.FINANCE_TRANSACTIONS_KEY_PREFIX || "tv_manager_finance_transactions_";
  const AUDIENCE_RESULTS_KEY_PREFIX = appKeys.RESULTS_KEY_PREFIX || "tv_manager_audience_results_";
  const DATE_GRID_KEY_PREFIX = appKeys.DATE_GRID_KEY_PREFIX || "tv_manager_date_grid_";
  const GRID_PUBLICATION_KEY_PREFIX = appKeys.GRID_PUBLICATION_KEY_PREFIX || "tv_manager_grid_publication_";
  const STUDIO_KEY_PREFIX = appKeys.STUDIO_KEY_PREFIX || "tv_manager_studio_";
  const PRESENTERS_KEY_PREFIX = appKeys.PRESENTERS_KEY_PREFIX || "tv_manager_presenters_";
  const BANK_KEY_PREFIX = appKeys.BANK_KEY_PREFIX || "tv_manager_bank_";
  const AD_SETTINGS_KEY_PREFIX = appKeys.AD_SETTINGS_KEY_PREFIX || "tv_manager_ad_settings_";
  const AD_SLOT_PLAN_KEY_PREFIX = appKeys.AD_SLOT_PLAN_KEY_PREFIX || "tv_manager_ad_slot_plan_";

  const LEGAL_DAILY_AD_CAP_MINUTES = 216;
  const LEGAL_HOURLY_AD_CAP_MINUTES = 12;
  const AD_REVENUE_PER_WEIGHTED_POINT_MINUTE = 230;
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
  const AD_PRESSURE_CONFIG = {
    soft: { id: "soft", label: "Soft", fillRate: 0.6 },
    balanced: { id: "balanced", label: "Équilibré", fillRate: 0.8 },
    intense: { id: "intense", label: "Intensif", fillRate: 1 }
  };
  const AD_CONTRACT_TEMPLATES = [
    {
      id: "auto_prime",
      label: "Auto Prime",
      description: "Campagne automobile en prime-time.",
      durationDays: 7,
      bonusRate: 0.14,
      targets: { categories: [], hourFrom: 18, hourTo: 23 }
    },
    {
      id: "famille_tp",
      label: "Pack Famille",
      description: "Annonceurs famille ciblant le tout public.",
      durationDays: 10,
      bonusRate: 0.12,
      targets: { categories: ["jeunesse", "magazines"], hourFrom: 6, hourTo: 21 }
    },
    {
      id: "food_access",
      label: "Restauration Access",
      description: "Offre access sur les programmes de flux.",
      durationDays: 7,
      bonusRate: 0.11,
      targets: { categories: ["divertissement", "realite"], hourFrom: 17, hourTo: 21 }
    },
    {
      id: "stream_serie",
      label: "Plateforme Séries",
      description: "Co-branding sur les cases séries.",
      durationDays: 14,
      bonusRate: 0.16,
      targets: { categories: ["series"], hourFrom: 19, hourTo: 24 }
    },
    {
      id: "culture_weekend",
      label: "Fondation Culture",
      description: "Campagne premium week-end culture.",
      durationDays: 14,
      bonusRate: 0.13,
      targets: { categories: ["culture", "documentaires"], hourFrom: 10, hourTo: 24 }
    },
    {
      id: "cinema_max",
      label: "Sorties Cinéma",
      description: "Annonceurs cinéma autour des films.",
      durationDays: 10,
      bonusRate: 0.15,
      targets: { categories: ["films"], hourFrom: 14, hourTo: 24 }
    }
  ];
  const BROADCAST_COST = 90000;
  const STUDIO_BASE_MAINTENANCE = 30000;
  const STUDIO_MAINTENANCE_PER_LEVEL = {
    decor: 12000,
    lights: 15000,
    cameras: 22000,
    regie: 30000,
    son: 17000,
    prompteur: 11000
  };
  const STUDIO_PRODUCTION_COST_MAX_BONUS = 1.4;
  const PROGRAM_COST_BASE = {
    information: 1200,
    divertissement: 12000,
    films: 30000,
    series: 14000,
    magazines: 9000,
    jeunesse: 7000,
    documentaires: 11000,
    realite: 16000,
    culture: 8500
  };
  const TRANSACTION_CATEGORY_LABELS = {
    achat_programmes: "Achat programmes",
    vente_programmes: "Vente programmes",
    amelioration_studio: "Amélioration studio TV",
    production_studio: "Mise en production studio TV",
    publication_grille: "Publication grille",
    recrutement_presentateurs: "Recrutement",
    recrutement_journalistes: "Recrutement",
    licenciement_presentateurs: "Licenciement",
    licenciement_journalistes: "Licenciement",
    salaires_fin_mois: "Salaires",
    maintenance_studio_fin_mois: "Maintenance studio TV",
    ajustement_admin: "Ajustement admin",
    autre: "Autres"
  };
  const MONTHLY_SETTLEMENT_CATEGORIES = {
    staff: "salaires_fin_mois",
    maintenance: "maintenance_studio_fin_mois"
  };

  const diffusionRules = window.DiffusionRules;
  const catalog = window.ProgramCatalog;
  function getBankApi() {
    const candidate = window.PlayerBank;
    if (!candidate || typeof candidate !== "object") return null;
    return candidate;
  }

  function getPlayerId(sessionData) {
    return sessionData.email || sessionData.username || "player";
  }

  function financeStorageKey(sessionData) {
    return `${FINANCE_RESULTS_KEY_PREFIX}${getPlayerId(sessionData)}`;
  }

  function audienceStorageKey(sessionData) {
    return `${AUDIENCE_RESULTS_KEY_PREFIX}${getPlayerId(sessionData)}`;
  }

  function transactionsStorageKey(sessionData) {
    return `${TRANSACTIONS_KEY_PREFIX}${getPlayerId(sessionData)}`;
  }

  function dateGridStorageKey(sessionData) {
    return `${DATE_GRID_KEY_PREFIX}${getPlayerId(sessionData)}`;
  }

  function gridPublicationStorageKey(sessionData) {
    return `${GRID_PUBLICATION_KEY_PREFIX}${getPlayerId(sessionData)}`;
  }

  function studioStorageKey(sessionData) {
    return `${STUDIO_KEY_PREFIX}${getPlayerId(sessionData)}`;
  }

  function bankStorageKey(sessionData) {
    return `${BANK_KEY_PREFIX}${getPlayerId(sessionData)}`;
  }

  function presentersStorageKey(sessionData) {
    return `${PRESENTERS_KEY_PREFIX}${getPlayerId(sessionData)}`;
  }

  function adSettingsStorageKey(sessionData) {
    return `${AD_SETTINGS_KEY_PREFIX}${getPlayerId(sessionData)}`;
  }

  function adSlotPlanStorageKey(sessionData) {
    return `${AD_SLOT_PLAN_KEY_PREFIX}${getPlayerId(sessionData)}`;
  }

  function toDateKey(date) {
    return sessionUtils.toDateKey(date);
  }

  function getDateKeyByOffset(offsetDays) {
    return sessionUtils.getDateKeyByOffset(offsetDays);
  }

  function parseDateKey(value) {
    return sessionUtils.parseDateKey(value);
  }

  function addDays(dateKey, delta) {
    return sessionUtils.addDaysToDateKey(dateKey, delta);
  }

  function hashString(value) {
    let hash = 0;
    const safe = String(value || "");
    for (let i = 0; i < safe.length; i += 1) {
      hash = (hash * 31 + safe.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  function normalizeGridEntry(raw) {
    if (!raw) return null;
    if (typeof raw === "string") return { title: raw, categoryId: "", season: null, episode: null };
    const title = String(raw.title || "");
    if (!title) return null;
    return {
      title,
      categoryId: String(raw.categoryId || ""),
      season: Number(raw.season) > 0 ? Number(raw.season) : null,
      episode: Number(raw.episode) > 0 ? Number(raw.episode) : null
    };
  }

  function normalizeGridDay(dayRaw) {
    if (!dayRaw) return [];
    if (Array.isArray(dayRaw)) return dayRaw.map(normalizeGridEntry).filter(Boolean);
    if (Array.isArray(dayRaw.day)) return dayRaw.day.map(normalizeGridEntry).filter(Boolean);
    if (Array.isArray(dayRaw.before) || Array.isArray(dayRaw.after)) {
      const before = Array.isArray(dayRaw.before) ? dayRaw.before : [];
      const after = Array.isArray(dayRaw.after) ? dayRaw.after : [];
      return [...before, ...after].map(normalizeGridEntry).filter(Boolean);
    }
    return [];
  }

  function readJson(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function readGridPublicationStore(sessionData) {
    const parsed = readJson(gridPublicationStorageKey(sessionData));
    if (!parsed || typeof parsed !== "object") return {};
    const out = {};
    Object.keys(parsed).forEach((dateKey) => {
      const row = parsed[dateKey];
      if (!row || typeof row !== "object") return;
      out[dateKey] = {
        published: Boolean(row.published),
        publishedAt: String(row.publishedAt || ""),
        paidCost: Math.max(0, Number(row.paidCost) || 0)
      };
    });
    return out;
  }

  function writeGridPublicationStore(sessionData, payload) {
    writeJson(gridPublicationStorageKey(sessionData), payload && typeof payload === "object" ? payload : {});
    return readGridPublicationStore(sessionData);
  }

  function isGridPublished(sessionData, dateKey) {
    const key = String(dateKey || "");
    if (!key) return false;
    const store = readGridPublicationStore(sessionData);
    return Boolean(store[key] && store[key].published);
  }

  function publishGridForDate(sessionData, dateKey, paidCost) {
    const key = String(dateKey || "");
    if (!key) return { ok: false, message: "Date invalide." };
    const todayKey = getDateKeyByOffset(0);
    if (key < todayKey) return { ok: false, message: "Impossible de publier une journée passée." };
    if (isGridPublished(sessionData, key)) return { ok: false, message: "Cette journée est déjà publiée." };

    const amount = Math.max(0, Math.round(Number(paidCost) || 0));
    if (amount > 0) {
      const bank = getBankApi();
      if (!bank || typeof bank.getBalance !== "function" || typeof bank.add !== "function") {
        return { ok: false, message: "Module bancaire indisponible." };
      }
      const balance = Number(bank.getBalance()) || 0;
      if (balance < amount) {
        return { ok: false, message: `Fonds insuffisants pour publier la grille (${amount} €).` };
      }
      bank.add(-amount, {
        category: "publication_grille",
        label: `Publication grille: ${key}`
      });
      recordTransaction(sessionData, {
        dateKey: getDateKeyByOffset(0),
        amount: -amount,
        category: "publication_grille",
        label: `Publication grille: ${key}`
      });
    }

    const store = readGridPublicationStore(sessionData);
    store[key] = {
      published: true,
      publishedAt: new Date().toISOString(),
      paidCost: amount
    };
    writeGridPublicationStore(sessionData, store);
    return { ok: true, dateKey: key, paidCost: amount };
  }

  function getDefaultAdSettings() {
    return {
      pressure: "balanced",
      blockedPrograms: {},
      activeContract: null,
      updatedAt: new Date().toISOString()
    };
  }

  function sanitizeAdSettings(raw) {
    const base = getDefaultAdSettings();
    const input = raw && typeof raw === "object" ? raw : {};
    const pressure = String(input.pressure || "balanced");
    if (AD_PRESSURE_CONFIG[pressure]) base.pressure = pressure;
    if (input.blockedPrograms && typeof input.blockedPrograms === "object") {
      Object.keys(input.blockedPrograms).forEach((title) => {
        if (!title) return;
        if (input.blockedPrograms[title]) base.blockedPrograms[title] = true;
      });
    }
    const contract = input.activeContract;
    if (contract && typeof contract === "object" && contract.offerId && contract.startDateKey && contract.endDateKey) {
      base.activeContract = {
        offerId: String(contract.offerId),
        label: String(contract.label || ""),
        startDateKey: String(contract.startDateKey),
        endDateKey: String(contract.endDateKey),
        bonusRate: Number(contract.bonusRate) || 0,
        targets: contract.targets && typeof contract.targets === "object"
          ? {
            categories: Array.isArray(contract.targets.categories)
              ? contract.targets.categories.map((id) => String(id))
              : [],
            hourFrom: Number(contract.targets.hourFrom) || 0,
            hourTo: Number(contract.targets.hourTo) || 24
          }
          : { categories: [], hourFrom: 0, hourTo: 24 }
      };
    }
    return base;
  }

  function readAdSlotPlan(sessionData) {
    const raw = readJson(adSlotPlanStorageKey(sessionData));
    if (!raw || typeof raw !== "object") return {};
    const out = {};
    Object.keys(raw).forEach((dateKey) => {
      const node = raw[dateKey];
      if (!node || typeof node !== "object") return;
      const disabledPrograms = {};
      const disabledBreaks = {};
      const sourcePrograms = node.disabledPrograms && typeof node.disabledPrograms === "object"
        ? node.disabledPrograms
        : {};
      const sourceBreaks = node.disabledBreaks && typeof node.disabledBreaks === "object"
        ? node.disabledBreaks
        : {};
      Object.keys(sourcePrograms).forEach((key) => {
        if (sourcePrograms[key]) disabledPrograms[String(key)] = true;
      });
      Object.keys(sourceBreaks).forEach((key) => {
        if (sourceBreaks[key]) disabledBreaks[String(key)] = true;
      });
      out[dateKey] = { disabledPrograms, disabledBreaks };
    });
    return out;
  }

  function writeAdSlotPlan(sessionData, payload) {
    writeJson(adSlotPlanStorageKey(sessionData), payload && typeof payload === "object" ? payload : {});
    return readAdSlotPlan(sessionData);
  }

  function getAdCutsForDate(sessionData, dateKey) {
    const plan = readAdSlotPlan(sessionData);
    const safeDateKey = String(dateKey || getDateKeyByOffset(0));
    const node = plan[safeDateKey] && typeof plan[safeDateKey] === "object"
      ? plan[safeDateKey]
      : { disabledPrograms: {}, disabledBreaks: {} };
    return {
      dateKey: safeDateKey,
      disabledPrograms: { ...(node.disabledPrograms || {}) },
      disabledBreaks: { ...(node.disabledBreaks || {}) }
    };
  }

  function setAdSlotDisabled(sessionData, dateKey, slotType, slotKey, disabled) {
    const safeDateKey = String(dateKey || "").trim();
    const safeType = String(slotType || "").trim().toLowerCase();
    const safeKey = String(slotKey || "").trim();
    if (!safeDateKey || !safeKey || (safeType !== "program" && safeType !== "break")) {
      return getAdCutsForDate(sessionData, safeDateKey || getDateKeyByOffset(0));
    }
    if (safeDateKey < getDateKeyByOffset(0)) {
      return getAdCutsForDate(sessionData, safeDateKey);
    }
    const plan = readAdSlotPlan(sessionData);
    if (!plan[safeDateKey] || typeof plan[safeDateKey] !== "object") {
      plan[safeDateKey] = { disabledPrograms: {}, disabledBreaks: {} };
    }
    if (!plan[safeDateKey].disabledPrograms || typeof plan[safeDateKey].disabledPrograms !== "object") {
      plan[safeDateKey].disabledPrograms = {};
    }
    if (!plan[safeDateKey].disabledBreaks || typeof plan[safeDateKey].disabledBreaks !== "object") {
      plan[safeDateKey].disabledBreaks = {};
    }
    const map = safeType === "program" ? plan[safeDateKey].disabledPrograms : plan[safeDateKey].disabledBreaks;
    if (disabled) map[safeKey] = true;
    else delete map[safeKey];
    writeAdSlotPlan(sessionData, plan);
    return getAdCutsForDate(sessionData, safeDateKey);
  }

  function readAdSettings(sessionData) {
    const parsed = readJson(adSettingsStorageKey(sessionData));
    const settings = sanitizeAdSettings(parsed);
    if (settings.activeContract && settings.activeContract.endDateKey < getDateKeyByOffset(0)) {
      settings.activeContract = null;
    }
    return settings;
  }

  function writeAdSettings(sessionData, settings) {
    const next = sanitizeAdSettings(settings);
    next.updatedAt = new Date().toISOString();
    writeJson(adSettingsStorageKey(sessionData), next);
    return next;
  }

  function readFinanceStore(sessionData) {
    const parsed = readJson(financeStorageKey(sessionData));
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  }

  function writeFinanceStore(sessionData, store) {
    writeJson(financeStorageKey(sessionData), store || {});
  }

  function readTransactions(sessionData) {
    const parsed = readJson(transactionsStorageKey(sessionData));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item === "object");
  }

  function writeTransactions(sessionData, items) {
    writeJson(transactionsStorageKey(sessionData), Array.isArray(items) ? items : []);
  }

  function resolveTodayDateKey() {
    return getDateKeyByOffset(0);
  }

  function recordTransaction(sessionData, tx) {
    if (!sessionData || !tx || typeof tx !== "object") return null;
    const amount = Number(tx.amount) || 0;
    if (!amount) return null;
    const dateKey = typeof tx.dateKey === "string" && tx.dateKey ? tx.dateKey : resolveTodayDateKey();
    const payload = {
      id: `${Date.now()}_${Math.floor(Math.random() * 100000)}`,
      dateKey,
      amount: Math.round(amount),
      category: String(tx.category || "autre"),
      label: String(tx.label || ""),
      createdAt: new Date().toISOString()
    };
    const items = readTransactions(sessionData);
    items.push(payload);
    writeTransactions(sessionData, items);
    return payload;
  }

  function getAudienceShareForDate(sessionData, dateKey) {
    const parsed = readJson(audienceStorageKey(sessionData));
    if (!parsed || typeof parsed !== "object") return 0;
    const dayResult = parsed[dateKey];
    if (!dayResult || !dayResult.simulation || !Array.isArray(dayResult.simulation.ranking)) return 0;
    const playerRow = dayResult.simulation.ranking.find((row) => row && row.id === "player");
    return playerRow && Number.isFinite(Number(playerRow.share)) ? Number(playerRow.share) : 0;
  }

  function getAudienceSimulationForDate(sessionData, dateKey) {
    const parsed = readJson(audienceStorageKey(sessionData));
    if (!parsed || typeof parsed !== "object") return null;
    const dayResult = parsed[dateKey];
    if (!dayResult || !dayResult.simulation || typeof dayResult.simulation !== "object") return null;
    return dayResult.simulation;
  }

  function getAdMarketOffers(sessionData, dateKey) {
    const targetDateKey = String(dateKey || getDateKeyByOffset(0));
    const seed = hashString(`${getPlayerId(sessionData)}:${targetDateKey}:ad_market`);
    const ranked = AD_CONTRACT_TEMPLATES
      .map((template, index) => ({
        template,
        score: hashString(`${seed}:${template.id}:${index}`)
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 3)
      .map((item) => item.template);
    const settings = readAdSettings(sessionData);
    const activeId = settings.activeContract ? settings.activeContract.offerId : "";
    return ranked.map((template) => ({
      ...template,
      isActive: activeId === template.id
    }));
  }

  function contractTargetsMatch(contract, categoryId, hourOfDay) {
    if (!contract || !contract.targets) return false;
    const targets = contract.targets;
    const categories = Array.isArray(targets.categories) ? targets.categories : [];
    const categoryOk = categories.length === 0 || categories.includes(categoryId);
    const from = Number(targets.hourFrom);
    const to = Number(targets.hourTo);
    const safeFrom = Number.isFinite(from) ? from : 0;
    const safeTo = Number.isFinite(to) ? to : 24;
    const hourOk = hourOfDay >= safeFrom && hourOfDay < safeTo;
    return categoryOk && hourOk;
  }

  function getContractBonusFactor(contract, categoryId, hourOfDay) {
    if (!contract) return 1;
    const rate = Math.max(0, Number(contract.bonusRate) || 0);
    if (rate <= 0) return 1;
    return contractTargetsMatch(contract, categoryId, hourOfDay) ? (1 + rate) : 1;
  }

  function buildProgramInstanceKey(program) {
    if (!program) return "";
    const season = Number(program.season) > 0 ? Number(program.season) : 0;
    const episode = Number(program.episode) > 0 ? Number(program.episode) : 0;
    const start = Number.isFinite(Number(program.start)) ? Number(program.start) : -1;
    return `${start}:${String(program.title || "")}:S${season}:E${episode}`;
  }

  function buildAdProgramKey(program, startMinute) {
    if (!program || !program.title) return "";
    const start = Number.isFinite(Number(startMinute)) ? Number(startMinute) : -1;
    const season = Number(program.season) > 0 ? Number(program.season) : 0;
    const episode = Number(program.episode) > 0 ? Number(program.episode) : 0;
    return `P:${start}:${String(program.title)}:S${season}:E${episode}`;
  }

  function buildAdBreakKey(program, startMinute) {
    const programKey = buildAdProgramKey(program, startMinute);
    return programKey ? `B:${programKey}` : "";
  }

  function splitIntervalByClockHour(startMinute, endMinute) {
    const ranges = [];
    let cursor = Math.max(0, Number(startMinute) || 0);
    const end = Math.max(cursor, Number(endMinute) || cursor);
    while (cursor < end) {
      const hourIndex = Math.floor(cursor / 60);
      const hourEnd = Math.min(end, (hourIndex + 1) * 60);
      ranges.push({
        hourIndex,
        start: cursor,
        end: hourEnd,
        minutes: Math.max(0, hourEnd - cursor)
      });
      cursor = hourEnd;
    }
    return ranges;
  }

  function getPrimeTimeFactor(hourOfDay) {
    if (hourOfDay >= 20 && hourOfDay < 23) return 1.2;
    if (hourOfDay >= 18 && hourOfDay < 20) return 1.1;
    if (hourOfDay >= 23 || hourOfDay < 1) return 0.88;
    if (hourOfDay >= 1 && hourOfDay < 5) return 0.72;
    return 1;
  }

  function getStatusMonetizationFactor(status, priorRediffusions) {
    if (status !== "rediffusion") return 1;
    const previous = Math.max(0, Number(priorRediffusions) || 0);
    return Math.max(0.62, 0.9 - (previous * 0.05));
  }

  function computeFilmInternalBreakCap(duration) {
    const safeDuration = Math.max(0, Number(duration) || 0);
    if (safeDuration < 20) return 0;
    if (safeDuration < 40) return 6;
    // V1: seconde coupure activée, chaque coupure max 6 min.
    return 12;
  }

  function computeAdvertisingRevenueForDate(sessionData, dateKey) {
    const adSettings = readAdSettings(sessionData);
    const pressure = AD_PRESSURE_CONFIG[adSettings.pressure] || AD_PRESSURE_CONFIG.balanced;
    const activeContract = adSettings.activeContract
      && dateKey >= adSettings.activeContract.startDateKey
      && dateKey <= adSettings.activeContract.endDateKey
      ? adSettings.activeContract
      : null;
    const simulation = getAudienceSimulationForDate(sessionData, dateKey);
    const adCuts = getAdCutsForDate(sessionData, dateKey);
    if (!simulation) {
      return {
        revenue: 0,
        details: {
          totalCandidateMinutes: 0,
          inProgramMinutes: 0,
          betweenProgramMinutes: 0,
          afterHourlyCapMinutes: 0,
          appliedDailyCapMinutes: 0,
          weightedPoints: 0,
          blockedProgramsCount: Object.keys(adSettings.blockedPrograms || {}).length,
          blockedProgramsMinutes: 0,
          pressure: pressure.id,
          pressureFillRate: pressure.fillRate,
          pressureUtilizationPercent: Math.round((pressure.fillRate || 0) * 100),
          activeContract: activeContract
            ? {
              offerId: activeContract.offerId,
              label: activeContract.label,
              startDateKey: activeContract.startDateKey,
              endDateKey: activeContract.endDateKey
            }
            : null,
          contractBoostFactor: 1,
          contractBoostWeightedPoints: 0,
          legalCap: {
            dailyMinutes: LEGAL_DAILY_AD_CAP_MINUTES,
            hourlyMinutes: LEGAL_HOURLY_AD_CAP_MINUTES
          }
        }
      };
    }

    const playerChannel = Array.isArray(simulation.channels)
      ? simulation.channels.find((channel) => channel && channel.id === "player")
      : null;
    const schedule = playerChannel && Array.isArray(playerChannel.schedule) ? playerChannel.schedule : [];
    const details = Array.isArray(simulation.details) ? simulation.details : [];
    const fallbackShare = getAudienceShareForDate(sessionData, dateKey);

    const slotByProgram = new Map();
    details.forEach((slot) => {
      if (!slot || !slot.shares || !slot.shares.player || !slot.shares.player.program) return;
      const playerShare = slot.shares.player;
      const program = playerShare.program;
      const key = buildProgramInstanceKey(program);
      if (!key) return;
      if (!slotByProgram.has(key)) {
        slotByProgram.set(key, {
          shareSum: 0,
          shareCount: 0,
          status: "inedit",
          priorRediffusions: 0
        });
      }
      const agg = slotByProgram.get(key);
      agg.shareSum += Number(playerShare.share) || 0;
      agg.shareCount += 1;
      if (typeof playerShare.status === "string" && playerShare.status) agg.status = playerShare.status;
      const prior = Number(playerShare.priorRediffusions);
      if (Number.isFinite(prior)) agg.priorRediffusions = Math.max(agg.priorRediffusions, prior);
    });

    const hourBuckets = new Map();
    let totalCandidateMinutes = 0;
    let totalInProgramMinutes = 0;
    let totalBetweenProgramMinutes = 0;
    let blockedProgramsMinutes = 0;

    schedule.forEach((item, index) => {
      if (!item || !item.title) return;
      if (adSettings.blockedPrograms && adSettings.blockedPrograms[item.title]) {
        blockedProgramsMinutes += Math.max(0, Number(item.duration) || 0);
        return;
      }
      const hasNextProgram = index < (schedule.length - 1);
      const adProgramKey = buildAdProgramKey(item, item.start);
      const adBreakKey = buildAdBreakKey(item, item.start);
      const itemMeta = getProgramDurationAndCategory(item);
      const categoryId = String(itemMeta.categoryId || "culture");
      const duration = Math.max(5, Number(itemMeta.duration) || 0);
      const baseRatePerHour = AD_CATEGORY_MINUTES_PER_HOUR[categoryId] || 6;
      const totalCandidate = (duration / 60) * baseRatePerHour;

      const disallowInProgram = isProgramAdForbidden(itemMeta);
      let inProgramMinutes = disallowInProgram ? 0 : (totalCandidate * 0.75);
      if (categoryId === "films" || categoryId === "series") {
        inProgramMinutes = Math.min(inProgramMinutes, computeFilmInternalBreakCap(duration));
      }
      inProgramMinutes = Math.max(0, inProgramMinutes);
      let betweenMinutes = hasNextProgram ? Math.max(0, totalCandidate - inProgramMinutes) : 0;
      if (adProgramKey && adCuts.disabledPrograms[adProgramKey]) {
        inProgramMinutes = 0;
      }
      if (adBreakKey && adCuts.disabledBreaks[adBreakKey]) {
        betweenMinutes = 0;
      }
      const programTotal = inProgramMinutes + betweenMinutes;
      if (programTotal <= 0) return;

      totalCandidateMinutes += programTotal;
      totalInProgramMinutes += inProgramMinutes;
      totalBetweenProgramMinutes += betweenMinutes;

      const key = buildProgramInstanceKey(item);
      const slotAgg = slotByProgram.get(key);
      const avgShare = slotAgg && slotAgg.shareCount > 0
        ? (slotAgg.shareSum / slotAgg.shareCount)
        : fallbackShare;
      const status = slotAgg ? slotAgg.status : "inedit";
      const statusFactor = getStatusMonetizationFactor(status, slotAgg ? slotAgg.priorRediffusions : 0);

      const ranges = splitIntervalByClockHour(item.start, item.end);
      const totalWindowMinutes = Math.max(1, ranges.reduce((sum, r) => sum + r.minutes, 0));
      ranges.forEach((range) => {
        const allocated = programTotal * (range.minutes / totalWindowMinutes);
        const hourOfDay = ((range.hourIndex % 24) + 24) % 24;
        const primeFactor = getPrimeTimeFactor(hourOfDay);
        const baseWeightedPoints = allocated * Math.max(0, avgShare) * primeFactor * statusFactor;
        const contractFactor = getContractBonusFactor(activeContract, categoryId, hourOfDay);
        const weightedPoints = baseWeightedPoints * contractFactor;
        if (!hourBuckets.has(range.hourIndex)) {
          hourBuckets.set(range.hourIndex, { minutes: 0, weightedPoints: 0, weightedPointsNoContract: 0 });
        }
        const bucket = hourBuckets.get(range.hourIndex);
        bucket.minutes += allocated;
        bucket.weightedPoints += weightedPoints;
        bucket.weightedPointsNoContract += baseWeightedPoints;
      });
    });

    let afterHourlyCapMinutes = 0;
    let afterHourlyCapWeightedPoints = 0;
    let afterHourlyCapWeightedPointsNoContract = 0;
    hourBuckets.forEach((bucket) => {
      const minutes = Math.max(0, Number(bucket.minutes) || 0) * pressure.fillRate;
      const weightedPoints = Math.max(0, Number(bucket.weightedPoints) || 0) * pressure.fillRate;
      const weightedPointsNoContract = Math.max(0, Number(bucket.weightedPointsNoContract) || 0) * pressure.fillRate;
      if (minutes <= 0 || weightedPoints <= 0) return;
      const hourlyFactor = Math.min(1, LEGAL_HOURLY_AD_CAP_MINUTES / minutes);
      afterHourlyCapMinutes += minutes * hourlyFactor;
      afterHourlyCapWeightedPoints += weightedPoints * hourlyFactor;
      afterHourlyCapWeightedPointsNoContract += weightedPointsNoContract * hourlyFactor;
    });

    const dailyFactor = afterHourlyCapMinutes > 0
      ? Math.min(1, LEGAL_DAILY_AD_CAP_MINUTES / afterHourlyCapMinutes)
      : 1;
    const appliedDailyCapMinutes = afterHourlyCapMinutes * dailyFactor;
    const weightedPointsBeforePressure = afterHourlyCapWeightedPoints * dailyFactor;
    const weightedPointsNoContract = afterHourlyCapWeightedPointsNoContract * dailyFactor;
    const weightedPoints = weightedPointsBeforePressure;
    const revenue = Math.round(weightedPoints * AD_REVENUE_PER_WEIGHTED_POINT_MINUTE);

    return {
      revenue: Math.max(0, revenue),
      details: {
        totalCandidateMinutes: Math.round(totalCandidateMinutes * 100) / 100,
        inProgramMinutes: Math.round(totalInProgramMinutes * 100) / 100,
        betweenProgramMinutes: Math.round(totalBetweenProgramMinutes * 100) / 100,
        afterHourlyCapMinutes: Math.round(afterHourlyCapMinutes * 100) / 100,
        appliedDailyCapMinutes: Math.round(appliedDailyCapMinutes * 100) / 100,
        weightedPoints: Math.round(weightedPoints * 100) / 100,
        blockedProgramsCount: Object.keys(adSettings.blockedPrograms || {}).length,
        blockedProgramsMinutes: Math.round(blockedProgramsMinutes * 100) / 100,
        pressure: pressure.id,
        pressureFillRate: pressure.fillRate,
        pressureUtilizationPercent: Math.round((pressure.fillRate || 0) * 100),
        activeContract: activeContract
          ? {
            offerId: activeContract.offerId,
            label: activeContract.label,
            startDateKey: activeContract.startDateKey,
            endDateKey: activeContract.endDateKey
          }
          : null,
        contractBoostFactor: weightedPointsNoContract > 0
          ? Math.round((weightedPointsBeforePressure / weightedPointsNoContract) * 1000) / 1000
          : 1,
        contractBoostWeightedPoints: Math.round(Math.max(0, weightedPointsBeforePressure - weightedPointsNoContract) * 100) / 100,
        legalCap: {
          dailyMinutes: LEGAL_DAILY_AD_CAP_MINUTES,
          hourlyMinutes: LEGAL_HOURLY_AD_CAP_MINUTES
        }
      }
    };
  }

  function getStudioMaintenanceCost(sessionData) {
    const parsed = readJson(studioStorageKey(sessionData)) || {};
    const levels = {
      decor: Math.max(0, Math.min(3, Number(parsed.decor) || 0)),
      lights: Math.max(0, Math.min(3, Number(parsed.lights) || 0)),
      cameras: Math.max(0, Math.min(3, Number(parsed.cameras) || 0)),
      regie: Math.max(0, Math.min(3, Number(parsed.regie) || 0)),
      son: Math.max(0, Math.min(3, Number(parsed.son) || 0)),
      prompteur: Math.max(0, Math.min(3, Number(parsed.prompteur) || 0))
    };
    return STUDIO_BASE_MAINTENANCE
      + (levels.decor * STUDIO_MAINTENANCE_PER_LEVEL.decor)
      + (levels.lights * STUDIO_MAINTENANCE_PER_LEVEL.lights)
      + (levels.cameras * STUDIO_MAINTENANCE_PER_LEVEL.cameras)
      + (levels.regie * STUDIO_MAINTENANCE_PER_LEVEL.regie)
      + (levels.son * STUDIO_MAINTENANCE_PER_LEVEL.son)
      + (levels.prompteur * STUDIO_MAINTENANCE_PER_LEVEL.prompteur);
  }

  function getPresentersSalaryBreakdown(sessionData) {
    const DAYS_PER_MONTH = 30;
    const parsed = readJson(presentersStorageKey(sessionData));
    const roleLabel = (roleKey) => (roleKey === "journalists" ? "Journaliste" : "Présentateur");

    const hiredGroups = [];
    if (parsed && parsed.roles && typeof parsed.roles === "object") {
      hiredGroups.push(
        { role: "presenters", list: Array.isArray(parsed.roles.presenters && parsed.roles.presenters.hired) ? parsed.roles.presenters.hired : [] },
        { role: "journalists", list: Array.isArray(parsed.roles.journalists && parsed.roles.journalists.hired) ? parsed.roles.journalists.hired : [] }
      );
    } else if (parsed && (parsed.presenters || parsed.journalists)) {
      hiredGroups.push(
        { role: "presenters", list: Array.isArray(parsed.presenters && parsed.presenters.hired) ? parsed.presenters.hired : [] },
        { role: "journalists", list: Array.isArray(parsed.journalists && parsed.journalists.hired) ? parsed.journalists.hired : [] }
      );
    } else {
      hiredGroups.push({ role: "presenters", list: parsed && Array.isArray(parsed.hired) ? parsed.hired : [] });
    }

    const rows = hiredGroups
      .flatMap((group) => {
        const list = Array.isArray(group.list) ? group.list : [];
        return list.map((item) => {
          const name = String(item && item.fullName ? item.fullName : "").trim();
          const monthly = Math.max(
            0,
            Math.round(
              Number(item && item.salaryMonthly) > 0
                ? Number(item && item.salaryMonthly)
                : Number(item && item.salaryDaily) || 0
            )
          );
          const amount = Math.max(0, Math.round(monthly / DAYS_PER_MONTH));
          if (!name || amount <= 0) return null;
          return { role: roleLabel(group.role), label: name, amount };
        });
      })
      .filter(Boolean);
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    return { rows, total };
  }

  function getPresentersMonthlySalaryTotal(sessionData) {
    const parsed = readJson(presentersStorageKey(sessionData));
    const groups = [];
    if (parsed && parsed.roles && typeof parsed.roles === "object") {
      groups.push(
        Array.isArray(parsed.roles.presenters && parsed.roles.presenters.hired) ? parsed.roles.presenters.hired : [],
        Array.isArray(parsed.roles.journalists && parsed.roles.journalists.hired) ? parsed.roles.journalists.hired : []
      );
    } else if (parsed && (parsed.presenters || parsed.journalists)) {
      groups.push(
        Array.isArray(parsed.presenters && parsed.presenters.hired) ? parsed.presenters.hired : [],
        Array.isArray(parsed.journalists && parsed.journalists.hired) ? parsed.journalists.hired : []
      );
    } else {
      groups.push(parsed && Array.isArray(parsed.hired) ? parsed.hired : []);
    }

    return groups
      .flat()
      .reduce((sum, item) => {
        const monthly = Math.max(
          0,
          Math.round(
            Number(item && item.salaryMonthly) > 0
              ? Number(item && item.salaryMonthly)
              : (Number(item && item.salaryDaily) || 0) * 30
          )
        );
        return sum + monthly;
      }, 0);
  }

  function getStudioProductionCostMultiplier(sessionData) {
    if (!sessionData) return 1;
    const parsed = readJson(studioStorageKey(sessionData)) || {};
    const clampLevel = (value) => Math.max(0, Math.min(3, Number(value) || 0));
    const levels = {
      decor: clampLevel(parsed.decor),
      lights: clampLevel(parsed.lights),
      cameras: clampLevel(parsed.cameras),
      regie: clampLevel(parsed.regie),
      son: clampLevel(parsed.son),
      prompteur: clampLevel(parsed.prompteur)
    };
    const totalCurrent = levels.decor + levels.lights + levels.cameras + levels.regie + levels.son + levels.prompteur;
    const totalMax = 18;
    const ratio = totalMax > 0 ? (totalCurrent / totalMax) : 0;
    return 1 + (ratio * STUDIO_PRODUCTION_COST_MAX_BONUS);
  }

  function buildSeenSetBeforeDate(sessionData, limitDateKey) {
    const seen = new Set();
    const parsed = readJson(dateGridStorageKey(sessionData));
    if (!parsed || typeof parsed !== "object") return seen;
    Object.keys(parsed)
      .filter((dateKey) => dateKey < limitDateKey)
      .sort()
      .forEach((dateKey) => {
        const entries = normalizeGridDay(parsed[dateKey]);
        entries.forEach((entry) => {
          if (!entry || !entry.title) return;
          if (diffusionRules && typeof diffusionRules.getTrackingKey === "function") {
            const key = diffusionRules.getTrackingKey(entry);
            if (key) seen.add(key);
            return;
          }
          const fallback = entry.categoryId === "series"
            ? `${entry.title}::S${entry.season || 1}E${entry.episode || 1}`
            : entry.title;
          if (fallback) seen.add(fallback);
        });
      });
    return seen;
  }

  function getProgramDurationAndCategory(entry) {
    if (!entry) return { duration: 60, categoryId: "culture", productionSubtype: "" };
    const explicitDuration = Number(entry.duration);
    const explicitCategoryId = String(entry.categoryId || "");
    const explicitSubtype = String(entry.productionSubtype || entry.subtype || "");
    const safeTitle = String(entry.title || "").trim();
    if (Number.isFinite(explicitDuration) && explicitDuration > 0) {
      return {
        duration: explicitDuration,
        categoryId: explicitCategoryId || "culture",
        productionSubtype: explicitSubtype
      };
    }
    if (!safeTitle) {
      return {
        duration: 60,
        categoryId: explicitCategoryId || "culture",
        productionSubtype: explicitSubtype
      };
    }
    if (catalog && typeof catalog.getProgramMeta === "function") {
      const meta = catalog.getProgramMeta(safeTitle);
      if (meta) {
        return {
          duration: Number(meta.duration) > 0 ? Number(meta.duration) : 60,
          categoryId: String(meta.categoryId || entry.categoryId || "culture"),
          productionSubtype: String(meta.productionSubtype || explicitSubtype || "")
        };
      }
    }
    return {
      duration: 60,
      categoryId: String(entry.categoryId || "culture"),
      productionSubtype: explicitSubtype
    };
  }

  function isProgramAdForbidden(entryOrMeta) {
    const meta = getProgramDurationAndCategory(entryOrMeta);
    const subtype = String(meta.productionSubtype || "").trim().toLowerCase();
    const infoJt = meta.categoryId === "information" && subtype === "jt";
    return infoJt || meta.categoryId === "jeunesse" || Number(meta.duration) < 15;
  }

  function getDayEntries(sessionData, dateKey) {
    const parsed = readJson(dateGridStorageKey(sessionData));
    if (!parsed || typeof parsed !== "object") return [];
    return normalizeGridDay(parsed[dateKey]);
  }

  function isInactiveDay(sessionData, dateKey) {
    const entries = getDayEntries(sessionData, dateKey);
    if (entries.length > 0) return false;
    const transactions = readTransactions(sessionData);
    const hasTx = transactions.some((tx) => {
      if (!tx || tx.dateKey !== dateKey) return false;
      if (isMonthlySettlementCategory(tx.category)) return false;
      return Number(tx.amount) !== 0;
    });
    return !hasTx;
  }

  function getProgrammingCostForDate(sessionData, dateKey) {
    const entries = getDayEntries(sessionData, dateKey);
    if (!entries.length) return 0;
    const seen = buildSeenSetBeforeDate(sessionData, dateKey);
    let total = 0;
    entries.forEach((entry) => {
      if (!entry || !entry.title) return;
      const meta = getProgramDurationAndCategory(entry);
      const status = (diffusionRules && typeof diffusionRules.resolveStatus === "function")
        ? diffusionRules.resolveStatus(entry, seen)
        : "inedit";
      total += estimateProgramCost(entry, status, sessionData);
    });
    return total;
  }

  function estimateProgramCost(entry, forcedStatus, sessionDataOverride) {
    if (!entry) return 0;
    const meta = getProgramDurationAndCategory(entry);
    const base = PROGRAM_COST_BASE[meta.categoryId] || 9000;
    const durationFactor = Math.max(0.2, Number(meta.duration) / 60);
    const status = String(forcedStatus || "inedit");
    let multiplier = 1;
    if (status === "rediffusion" && meta.categoryId !== "information") {
      multiplier *= 0.7;
    }
    if (meta.categoryId === "information") {
      const activeSession = sessionDataOverride
        || (sessionUtils && typeof sessionUtils.recoverSessionFromLocation === "function"
          ? sessionUtils.recoverSessionFromLocation({ persist: false })
          : null);
      multiplier *= getStudioProductionCostMultiplier(activeSession);
    }
    return Math.round(base * durationFactor * multiplier);
  }

  function applyToBank(sessionData, delta) {
    const bank = getBankApi();
    if (bank && typeof bank.add === "function") {
      return bank.add(delta, {
        record: false,
        category: "resultat_journalier",
        label: "Résultat journalier"
      });
    }
    const key = bankStorageKey(sessionData);
    const current = Number(localStorage.getItem(key));
    if (!Number.isFinite(current)) {
      return null;
    }
    const next = Math.max(0, Math.round(current + delta));
    localStorage.setItem(key, String(next));
    return next;
  }

  function computeForDate(sessionData, dateKey, force) {
    settleMonthEndExpensesUpTo(sessionData, dateKey);

    const store = readFinanceStore(sessionData);
    const existing = store[dateKey];
    if (existing && !force) return existing;

    if (existing && force && Number.isFinite(Number(existing.netResult))) {
      applyToBank(sessionData, -Math.round(Number(existing.netResult)));
    }

    let audienceShare = getAudienceShareForDate(sessionData, dateKey);
    const adRevenue = computeAdvertisingRevenueForDate(sessionData, dateKey);
    let revenueAds = Number(adRevenue.revenue) || 0;
    let costs = {
      broadcast: BROADCAST_COST,
      staff: 0,
      staffBreakdown: [],
      studioMaintenance: 0,
      programming: 0
    };
    let totalCosts = costs.broadcast + costs.staff + costs.studioMaintenance + costs.programming;
    let netResult = Math.round(revenueAds - totalCosts);

    if (isInactiveDay(sessionData, dateKey)) {
      audienceShare = 0;
      revenueAds = 0;
      costs = {
        broadcast: 0,
        staff: 0,
        staffBreakdown: [],
        studioMaintenance: 0,
        programming: 0
      };
      totalCosts = 0;
      netResult = 0;
    }

    const bank = getBankApi();
    const localBalanceValue = Number(localStorage.getItem(bankStorageKey(sessionData)));
    const balanceAfter = netResult !== 0
      ? applyToBank(sessionData, netResult)
      : (bank && typeof bank.getBalance === "function"
        ? bank.getBalance()
        : (Number.isFinite(localBalanceValue) ? localBalanceValue : null));

    const result = {
      dateKey,
      computedAt: new Date().toISOString(),
      audienceShare,
      revenue: {
        ads: revenueAds,
        adsDetails: adRevenue.details
      },
      costs,
      totalRevenue: revenueAds,
      totalCosts,
      netResult,
      balanceAfter
    };

    store[dateKey] = result;
    writeFinanceStore(sessionData, store);
    return result;
  }

  function getResultByDateKey(sessionData, dateKey) {
    const store = readFinanceStore(sessionData);
    return store[dateKey] || null;
  }

  function getHistory(sessionData) {
    const store = readFinanceStore(sessionData);
    return Object.keys(store)
      .sort()
      .map((dateKey) => store[dateKey])
      .filter(Boolean);
  }

  function normalizeSalaryBreakdownRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const role = String(item.role || "").trim() || "Poste";
        const label = String(item.label || "").trim();
        const amount = Math.max(0, Math.round(Number(item.amount) || 0));
        if (amount <= 0) return null;
        return { role, label, amount };
      })
      .filter(Boolean);
  }

  function getSalaryBreakdownForDate(sessionData, dateKey) {
    const result = getResultByDateKey(sessionData, dateKey);
    if (!result) return { dateKey: String(dateKey || ""), total: 0, rows: [] };
    const rows = normalizeSalaryBreakdownRows(result.costs && result.costs.staffBreakdown);
    const total = Number(result.costs && result.costs.staff) || rows.reduce((sum, row) => sum + row.amount, 0);
    if (rows.length > 0) {
      return { dateKey: String(result.dateKey || dateKey || ""), total: Math.round(total), rows };
    }
    const fallbackRows = [{ role: "CDI structure", label: "Équipe fixe CDI", amount: Math.max(0, Math.round(total)) }];
    return {
      dateKey: String(result.dateKey || dateKey || ""),
      total: Math.max(0, Math.round(total)),
      rows: total > 0 ? fallbackRows : []
    };
  }

  function monthKeyFromDateKey(dateKey) {
    const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(dateKey || ""));
    if (!match) return "";
    return `${match[1]}-${match[2]}`;
  }

  function monthLabelFromKey(monthKey) {
    const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey || ""));
    if (!match) return monthKey;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
    const month = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(date);
    return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${match[1]}`;
  }

  function getDaysInMonth(monthKey) {
    const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey || ""));
    if (!match) return 30;
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) return 30;
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function isMonthlySettlementCategory(category) {
    const safe = String(category || "");
    return safe === MONTHLY_SETTLEMENT_CATEGORIES.staff || safe === MONTHLY_SETTLEMENT_CATEGORIES.maintenance;
  }

  function getMonthEndDateKey(monthKey) {
    const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey || ""));
    if (!match) return "";
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) return "";
    const date = new Date(year, monthIndex + 1, 0);
    return toDateKey(date);
  }

  function getMonthKeyRange(startMonthKey, endMonthKey) {
    const output = [];
    const startMatch = /^(\d{4})-(\d{2})$/.exec(String(startMonthKey || ""));
    const endMatch = /^(\d{4})-(\d{2})$/.exec(String(endMonthKey || ""));
    if (!startMatch || !endMatch) return output;
    let cursor = new Date(Number(startMatch[1]), Number(startMatch[2]) - 1, 1);
    const end = new Date(Number(endMatch[1]), Number(endMatch[2]) - 1, 1);
    if (cursor > end) return output;
    while (cursor <= end) {
      output.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return output;
  }

  function monthHasActivity(sessionData, monthKey) {
    const history = getHistory(sessionData);
    const hasHistoryActivity = history.some((item) => {
      if (!item || monthKeyFromDateKey(item.dateKey) !== monthKey) return false;
      return Number(item.totalRevenue) !== 0 || Number(item.totalCosts) !== 0;
    });
    if (hasHistoryActivity) return true;

    const transactions = readTransactions(sessionData);
    const hasTransactionActivity = transactions.some((tx) => {
      if (!tx || monthKeyFromDateKey(tx.dateKey) !== monthKey) return false;
      if (isMonthlySettlementCategory(tx.category)) return false;
      return Number(tx.amount) !== 0;
    });
    if (hasTransactionActivity) return true;

    const grid = readJson(dateGridStorageKey(sessionData));
    if (!grid || typeof grid !== "object") return false;
    return Object.keys(grid).some((dateKey) => {
      if (monthKeyFromDateKey(dateKey) !== monthKey) return false;
      return normalizeGridDay(grid[dateKey]).length > 0;
    });
  }

  function getEarliestKnownMonthKey(sessionData, fallbackDateKey) {
    const candidates = [];
    const history = getHistory(sessionData);
    history.forEach((item) => {
      if (item && typeof item.dateKey === "string" && item.dateKey) candidates.push(item.dateKey);
    });
    const transactions = readTransactions(sessionData);
    transactions.forEach((tx) => {
      if (tx && typeof tx.dateKey === "string" && tx.dateKey) candidates.push(tx.dateKey);
    });
    const grid = readJson(dateGridStorageKey(sessionData));
    if (grid && typeof grid === "object") {
      Object.keys(grid).forEach((dateKey) => {
        if (normalizeGridDay(grid[dateKey]).length > 0) candidates.push(dateKey);
      });
    }
    if (candidates.length === 0) return monthKeyFromDateKey(fallbackDateKey);
    candidates.sort();
    return monthKeyFromDateKey(candidates[0]);
  }

  function hasMonthEndSettlement(sessionData, monthKey) {
    return readTransactions(sessionData).some((tx) => {
      if (!tx || monthKeyFromDateKey(tx.dateKey) !== monthKey) return false;
      return isMonthlySettlementCategory(tx.category);
    });
  }

  function getMonthlyStaffExpenseProjection(sessionData, monthKey) {
    void monthKey;
    return Math.max(0, Math.round(getPresentersMonthlySalaryTotal(sessionData)));
  }

  function getMonthlyMaintenanceExpenseProjection(sessionData, monthKey) {
    const dailyMaintenance = Math.max(0, getStudioMaintenanceCost(sessionData));
    return Math.round(dailyMaintenance * getDaysInMonth(monthKey));
  }

  function applyMonthEndSettlementForMonth(sessionData, monthKey) {
    if (!sessionData || !monthKey) return;
    if (hasMonthEndSettlement(sessionData, monthKey)) return;
    if (!monthHasActivity(sessionData, monthKey)) return;
    const monthEndDateKey = getMonthEndDateKey(monthKey);
    if (!monthEndDateKey) return;

    const staffExpense = getMonthlyStaffExpenseProjection(sessionData, monthKey);
    const maintenanceExpense = getMonthlyMaintenanceExpenseProjection(sessionData, monthKey);
    const totalExpense = Math.max(0, staffExpense) + Math.max(0, maintenanceExpense);
    if (totalExpense <= 0) return;

    applyToBank(sessionData, -totalExpense);
    if (staffExpense > 0) {
      recordTransaction(sessionData, {
        amount: -staffExpense,
        category: MONTHLY_SETTLEMENT_CATEGORIES.staff,
        label: `Prélèvement fin de mois 23:59 (${monthKey})`,
        dateKey: monthEndDateKey
      });
    }
    if (maintenanceExpense > 0) {
      recordTransaction(sessionData, {
        amount: -maintenanceExpense,
        category: MONTHLY_SETTLEMENT_CATEGORIES.maintenance,
        label: `Prélèvement fin de mois 23:59 (${monthKey})`,
        dateKey: monthEndDateKey
      });
    }
  }

  function settleMonthEndExpensesUpTo(sessionData, upToDateKey) {
    if (!sessionData || !upToDateKey) return;
    const upToMonthKey = monthKeyFromDateKey(upToDateKey);
    const startMonthKey = getEarliestKnownMonthKey(sessionData, upToDateKey);
    if (!startMonthKey || !upToMonthKey) return;
    const monthKeys = getMonthKeyRange(startMonthKey, upToMonthKey);
    monthKeys.forEach((monthKey) => {
      const monthEndDateKey = getMonthEndDateKey(monthKey);
      if (!monthEndDateKey || monthEndDateKey > upToDateKey) return;
      applyMonthEndSettlementForMonth(sessionData, monthKey);
    });
  }

  function isCurrentMonthKey(monthKey) {
    const todayKey = getDateKeyByOffset(0);
    return monthKeyFromDateKey(todayKey) === String(monthKey || "");
  }

  function aggregateRowsByCategory(map, category, revenue, expense) {
    if (!map.has(category)) {
      map.set(category, { category, revenue: 0, expense: 0 });
    }
    const row = map.get(category);
    row.revenue += revenue;
    row.expense += expense;
  }

  function getMonthlySummary(sessionData, monthKey) {
    settleMonthEndExpensesUpTo(sessionData, getDateKeyByOffset(0));

    const realizedMap = new Map();
    const projectedMap = new Map();
    const history = getHistory(sessionData);
    const monthHistory = history.filter((item) => monthKeyFromDateKey(item.dateKey) === monthKey);
    const monthHasOps = monthHasActivity(sessionData, monthKey);
    const monthAlreadySettled = hasMonthEndSettlement(sessionData, monthKey);

    monthHistory.forEach((item) => {
      aggregateRowsByCategory(realizedMap, "Publicité", Number(item.totalRevenue) || 0, 0);
      aggregateRowsByCategory(realizedMap, "Diffusion", 0, Number(item.costs && item.costs.broadcast) || 0);
      aggregateRowsByCategory(realizedMap, "Coût de diffusion (grille)", 0, Number(item.costs && item.costs.programming) || 0);
    });

    const transactions = readTransactions(sessionData);
    const monthTransactions = transactions.filter((tx) => monthKeyFromDateKey(tx.dateKey) === monthKey);
    monthTransactions.forEach((tx) => {
      const amount = Number(tx.amount) || 0;
      if (!amount) return;
      const label = TRANSACTION_CATEGORY_LABELS[tx.category] || String(tx.category || "Autres");
      if (amount > 0) {
        aggregateRowsByCategory(realizedMap, label, amount, 0);
      } else {
        aggregateRowsByCategory(realizedMap, label, 0, Math.abs(amount));
      }
    });

    if (monthHasOps && !monthAlreadySettled) {
      const projectedSalaryExpense = getMonthlyStaffExpenseProjection(sessionData, monthKey);
      const projectedMaintenanceExpense = getMonthlyMaintenanceExpenseProjection(sessionData, monthKey);
      if (projectedSalaryExpense > 0) {
        aggregateRowsByCategory(projectedMap, "Salaires", 0, projectedSalaryExpense);
      }
      if (projectedMaintenanceExpense > 0) {
        aggregateRowsByCategory(projectedMap, "Maintenance studio TV", 0, projectedMaintenanceExpense);
      }
    }

    const realizedRows = Array.from(realizedMap.values())
      .map((row) => ({
        category: row.category,
        revenue: Math.round(row.revenue),
        expense: Math.round(row.expense),
        net: Math.round(row.revenue - row.expense)
      }))
      .sort((a, b) => a.category.localeCompare(b.category, "fr", { sensitivity: "base" }));

    const projectedRows = Array.from(projectedMap.values())
      .map((row) => ({
        category: row.category,
        revenue: Math.round(row.revenue),
        expense: Math.round(row.expense),
        net: Math.round(row.revenue - row.expense)
      }))
      .sort((a, b) => a.category.localeCompare(b.category, "fr", { sensitivity: "base" }));

    const combinedRows = [
      ...realizedRows,
      ...projectedRows.map((row) => ({
        ...row,
        category: `${row.category} (prévision)`
      }))
    ];

    const realizedRevenue = realizedRows.reduce((sum, row) => sum + row.revenue, 0);
    const realizedExpense = realizedRows.reduce((sum, row) => sum + row.expense, 0);
    const projectedRevenue = projectedRows.reduce((sum, row) => sum + row.revenue, 0);
    const projectedExpense = projectedRows.reduce((sum, row) => sum + row.expense, 0);
    const totalRevenue = realizedRevenue + projectedRevenue;
    const totalExpense = realizedExpense + projectedExpense;
    return {
      monthKey,
      monthLabel: monthLabelFromKey(monthKey),
      totalRevenue: Math.round(totalRevenue),
      totalExpense: Math.round(totalExpense),
      netResult: Math.round(totalRevenue - totalExpense),
      realizedRevenue: Math.round(realizedRevenue),
      realizedExpense: Math.round(realizedExpense),
      projectedRevenue: Math.round(projectedRevenue),
      projectedExpense: Math.round(projectedExpense),
      rows: combinedRows,
      realizedRows,
      projectedRows
    };
  }

  function getMonthlySalaryBreakdown(sessionData, monthKey) {
    const history = getHistory(sessionData);
    const aggregated = new Map();
    let total = 0;

    history
      .filter((item) => monthKeyFromDateKey(item.dateKey) === monthKey)
      .forEach((item) => {
        const salaryRows = normalizeSalaryBreakdownRows(item && item.costs && item.costs.staffBreakdown);
        if (salaryRows.length === 0) {
          const fallbackAmount = Math.max(0, Math.round(Number(item && item.costs && item.costs.staff) || 0));
          if (fallbackAmount > 0) {
            const key = "CDI structure::Équipe fixe CDI";
            if (!aggregated.has(key)) aggregated.set(key, { role: "CDI structure", label: "Équipe fixe CDI", amount: 0 });
            aggregated.get(key).amount += fallbackAmount;
            total += fallbackAmount;
          }
          return;
        }
        salaryRows.forEach((row) => {
          const key = `${row.role}::${row.label}`;
          if (!aggregated.has(key)) aggregated.set(key, { role: row.role, label: row.label, amount: 0 });
          aggregated.get(key).amount += row.amount;
          total += row.amount;
        });
      });

    const rows = Array.from(aggregated.values())
      .map((row) => ({ ...row, amount: Math.round(row.amount) }))
      .sort((a, b) => {
        const roleCmp = String(a.role).localeCompare(String(b.role), "fr", { sensitivity: "base" });
        if (roleCmp !== 0) return roleCmp;
        return String(a.label).localeCompare(String(b.label), "fr", { sensitivity: "base" });
      });

    return {
      monthKey,
      monthLabel: monthLabelFromKey(monthKey),
      total: Math.round(total),
      rows
    };
  }

  function getAvailableMonthKeys(sessionData) {
    const months = new Set();
    getHistory(sessionData).forEach((item) => {
      const mk = monthKeyFromDateKey(item.dateKey);
      if (mk) months.add(mk);
    });
    readTransactions(sessionData).forEach((tx) => {
      const mk = monthKeyFromDateKey(tx.dateKey);
      if (mk) months.add(mk);
    });
    return Array.from(months).sort().reverse();
  }

  function getMonthlySummaries(sessionData, limit) {
    const maxItems = Math.max(1, Number(limit) || 3);
    return getAvailableMonthKeys(sessionData)
      .slice(0, maxItems)
      .map((monthKey) => getMonthlySummary(sessionData, monthKey));
  }

  function getBlockablePrograms(sessionData) {
    const titles = new Set();
    if (catalog && typeof catalog.getOwnedCatalogForCurrentSession === "function") {
      const categories = catalog.getOwnedCatalogForCurrentSession();
      if (Array.isArray(categories)) {
        categories.forEach((category) => {
          if (!category || !Array.isArray(category.programs)) return;
          category.programs.forEach((program) => {
            const rawTitle = typeof program === "string"
              ? program
              : (program && typeof program.title === "string" ? program.title : "");
            const safeTitle = String(rawTitle || "").trim();
            if (safeTitle) titles.add(safeTitle);
          });
        });
      }
    } else if (catalog && typeof catalog.getAvailableCategoriesForCurrentSession === "function") {
      const categories = catalog.getAvailableCategoriesForCurrentSession();
      if (Array.isArray(categories)) {
        categories.forEach((category) => {
          if (!category || !Array.isArray(category.programs)) return;
          category.programs.forEach((title) => {
            const safeTitle = String(title || "").trim();
            if (safeTitle) titles.add(safeTitle);
          });
        });
      }
    }
    const parsed = readJson(dateGridStorageKey(sessionData));
    if (parsed && typeof parsed === "object") {
      Object.keys(parsed).forEach((dateKey) => {
        const entries = normalizeGridDay(parsed[dateKey]);
        entries.forEach((entry) => {
          const safeTitle = String(entry && entry.title ? entry.title : "").trim();
          if (safeTitle) titles.add(safeTitle);
        });
      });
    }
    return Array.from(titles).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
  }

  function setAdPressure(sessionData, pressureId) {
    const settings = readAdSettings(sessionData);
    const nextPressure = AD_PRESSURE_CONFIG[pressureId] ? pressureId : "balanced";
    settings.pressure = nextPressure;
    return writeAdSettings(sessionData, settings);
  }

  function setProgramAdsBlocked(sessionData, title, blocked) {
    const safeTitle = String(title || "").trim();
    if (!safeTitle) return readAdSettings(sessionData);
    const settings = readAdSettings(sessionData);
    if (!settings.blockedPrograms || typeof settings.blockedPrograms !== "object") {
      settings.blockedPrograms = {};
    }
    if (blocked) settings.blockedPrograms[safeTitle] = true;
    else delete settings.blockedPrograms[safeTitle];
    return writeAdSettings(sessionData, settings);
  }

  function acceptAdContract(sessionData, offerId, startDateKey) {
    const offers = getAdMarketOffers(sessionData, startDateKey);
    const offer = offers.find((item) => item.id === String(offerId || ""));
    if (!offer) return null;
    const startKey = String(startDateKey || getDateKeyByOffset(0));
    const endKey = addDays(startKey, Math.max(1, Number(offer.durationDays) || 7) - 1);
    const settings = readAdSettings(sessionData);
    settings.activeContract = {
      offerId: offer.id,
      label: offer.label,
      startDateKey: startKey,
      endDateKey: endKey,
      bonusRate: Number(offer.bonusRate) || 0,
      targets: {
        categories: Array.isArray(offer.targets && offer.targets.categories) ? offer.targets.categories : [],
        hourFrom: Number(offer.targets && offer.targets.hourFrom) || 0,
        hourTo: Number(offer.targets && offer.targets.hourTo) || 24
      }
    };
    writeAdSettings(sessionData, settings);
    return settings.activeContract;
  }

  function clearAdContract(sessionData) {
    const settings = readAdSettings(sessionData);
    settings.activeContract = null;
    return writeAdSettings(sessionData, settings);
  }

  function ensureYesterdayClosed(sessionData) {
    const audience = window.AudienceResults;
    if (audience && typeof audience.ensureYesterdayCalculated === "function") {
      audience.ensureYesterdayCalculated(sessionData);
    }
    const yesterdayKey = getDateKeyByOffset(-1);
    return computeForDate(sessionData, yesterdayKey, false);
  }

  window.FinanceEngine = {
    getDateKeyByOffset,
    ensureYesterdayClosed,
    computeYesterdayNow: function computeYesterdayNow(sessionData, force) {
      const audience = window.AudienceResults;
      if (audience && typeof audience.computeYesterdayNow === "function") {
        audience.computeYesterdayNow(sessionData, Boolean(force));
      }
      return computeForDate(sessionData, getDateKeyByOffset(-1), Boolean(force));
    },
    getResultByOffset: function getResultByOffset(sessionData, offsetDays) {
      return getResultByDateKey(sessionData, getDateKeyByOffset(offsetDays));
    },
    getResultByDateKey,
    getHistory,
    getSalaryBreakdownForDate,
    getAvailableMonthKeys,
    getMonthlySummary,
    getMonthlySalaryBreakdown,
    getMonthlySummaries,
    isGridPublished,
    publishGridForDate,
    getAdSettings: readAdSettings,
    setAdPressure,
    getAdCutsForDate,
    setAdSlotDisabled,
    getAdMarketOffers,
    acceptAdContract,
    clearAdContract,
    getBlockablePrograms,
    setProgramAdsBlocked,
    buildAdProgramKey,
    buildAdBreakKey,
    isProgramAdForbidden,
    getTransactions: readTransactions,
    recordTransaction,
    getStudioProductionCostMultiplier,
    estimateProgramCost
  };
})();
