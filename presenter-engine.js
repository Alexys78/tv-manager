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
  const WEEKDAY_LABELS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

  const SPECIALTIES = ["JT", "Débat", "Éco", "Culture", "Société", "Matinale", "International", "Faits divers"];

  const FIRST_NAMES = [
    "Camille", "Nora", "Lina", "Maya", "Eva", "Sarah", "Lou", "Inès", "Zoé", "Manon",
    "Lucas", "Noah", "Hugo", "Adam", "Léo", "Nolan", "Théo", "Ethan", "Tom", "Mathis"
  ];

  const LAST_NAMES = [
    "Martin", "Bernard", "Robert", "Dubois", "Morel", "Laurent", "Simon", "Michel", "Leroy", "Roux",
    "Fournier", "Girard", "Bonnet", "Dupont", "Lambert", "Fontaine", "Rousseau", "Vincent", "Muller", "Faure"
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

  function seededRandom(seed) {
    let state = seed >>> 0;
    return function next() {
      state = (1664525 * state + 1013904223) >>> 0;
      return state / 0xffffffff;
    };
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
    const weekday = current.getDay(); // 0=dimanche, 1=lundi
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
    if (score >= 85) return 2;
    if (score >= 70) return 1;
    return 0;
  }

  function sanitizePresenter(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = String(raw.id || "").trim();
    const fullName = String(raw.fullName || "").trim();
    if (!id || !fullName) return null;
    const specialty = String(raw.specialty || "JT").trim() || "JT";
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
      ? clamp(raw.starBonus, 0, 2)
      : computeStarBonusFromStats({ editorial, charisma, notoriety });
    return {
      id,
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

  function sanitizeStore(raw) {
    const base = { hired: [], market: [], revision: 0, lastRefreshAnchor: "" };
    if (!raw || typeof raw !== "object") return base;
    const hired = Array.isArray(raw.hired) ? raw.hired.map(sanitizePresenter).filter(Boolean) : [];
    const market = Array.isArray(raw.market) ? raw.market.map(sanitizePresenter).filter(Boolean) : [];
    const revision = Math.max(0, Math.floor(Number(raw.revision) || 0));
    const lastRefreshAnchor = typeof raw.lastRefreshAnchor === "string" ? raw.lastRefreshAnchor : "";
    return { hired, market, revision, lastRefreshAnchor };
  }

  function readStore(sessionData) {
    if (!sessionData) return { hired: [], market: [], revision: 0, lastRefreshAnchor: "" };
    const raw = localStorage.getItem(presentersKey(sessionData));
    if (!raw) return { hired: [], market: [], revision: 0, lastRefreshAnchor: "" };
    try {
      return sanitizeStore(JSON.parse(raw));
    } catch {
      return { hired: [], market: [], revision: 0, lastRefreshAnchor: "" };
    }
  }

  function writeStore(sessionData, payload) {
    if (!sessionData) return { hired: [], market: [], revision: 0, lastRefreshAnchor: "" };
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

  function generatePresenter(playerId, index, revision) {
    const rand = seededRandom(hashString(`${playerId}:presenter:${revision}:${index}`));
    const firstName = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
    const lastName = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
    const specialty = SPECIALTIES[Math.floor(rand() * SPECIALTIES.length)];
    const editorial = Math.round(48 + (rand() * 44));
    const charisma = Math.round(45 + (rand() * 46));
    const notoriety = Math.round(28 + (rand() * 58));
    const starBonus = computeStarBonusFromStats({ editorial, charisma, notoriety });
    const salaryMonthly = Math.round(2600 + (editorial * 42) + (charisma * 33) + (notoriety * 36));
    const signingBonus = Math.round(salaryMonthly * (2 + (rand() * 2.5)));
    return sanitizePresenter({
      id: `pr_${revision}_${index}_${hashString(`${firstName}${lastName}${specialty}`).toString(36).slice(0, 5)}`,
      fullName: `${firstName} ${lastName}`,
      specialty,
      editorial,
      charisma,
      notoriety,
      starBonus,
      salaryMonthly,
      signingBonus,
      contractType: "CDI"
    });
  }

  function generateMarket(playerId, revision) {
    const list = [];
    for (let i = 0; i < 8; i += 1) {
      const presenter = generatePresenter(playerId, i, revision);
      if (presenter) list.push(presenter);
    }
    return list;
  }

  function ensureStore(sessionData) {
    if (!sessionData) return { hired: [], market: [], revision: 0, lastRefreshAnchor: "" };
    const hasPersistedStore = localStorage.getItem(presentersKey(sessionData)) !== null;
    const current = readStore(sessionData);
    if (!hasPersistedStore && isCloudBootstrapInProgress()) {
      // Avoid seeding defaults before cloud pull has a chance to restore real data.
      return current;
    }
    const refreshAnchor = getCurrentRefreshAnchorKey();
    const hasMarket = Array.isArray(current.market) && current.market.length > 0;
    const hasAnchor = Boolean(current.lastRefreshAnchor);
    if (hasAnchor && current.lastRefreshAnchor !== refreshAnchor) {
      const nextRevision = (current.revision || 0) + 1;
      const refreshed = {
        hired: Array.isArray(current.hired) ? current.hired : [],
        market: generateMarket(getPlayerId(sessionData), nextRevision),
        revision: nextRevision,
        lastRefreshAnchor: refreshAnchor
      };
      return writeStore(sessionData, refreshed);
    }
    if (hasMarket) {
      if (!hasAnchor) {
        return writeStore(sessionData, {
          ...current,
          lastRefreshAnchor: refreshAnchor
        });
      }
      return current;
    }
    if (hasAnchor) return current;
    const seeded = {
      hired: Array.isArray(current.hired) ? current.hired : [],
      market: generateMarket(getPlayerId(sessionData), current.revision || 0),
      revision: current.revision || 0,
      lastRefreshAnchor: refreshAnchor
    };
    return writeStore(sessionData, seeded);
  }

  function regenerateMarket(sessionData, options) {
    if (!sessionData) return { ok: false, message: "Session introuvable." };
    const opts = options && typeof options === "object" ? options : {};
    const force = Boolean(opts.force);
    const current = readStore(sessionData);
    const refreshAnchor = getCurrentRefreshAnchorKey();
    const hasMarket = Array.isArray(current.market) && current.market.length > 0;
    const hasAnchor = Boolean(current.lastRefreshAnchor);
    const needsWeeklyRefresh = hasAnchor && current.lastRefreshAnchor !== refreshAnchor;
    const needsSeed = !hasMarket;

    if (!force && !needsWeeklyRefresh && !needsSeed) {
      const visibleCount = getMarketPresenters(sessionData).length;
      return {
        ok: true,
        refreshed: false,
        count: visibleCount,
        message: "Casting déjà à jour pour cette semaine."
      };
    }

    const shouldIncrementRevision = force || needsWeeklyRefresh;
    const nextRevision = Math.max(0, Math.floor(Number(current.revision) || 0)) + (shouldIncrementRevision ? 1 : 0);
    const next = {
      hired: Array.isArray(current.hired) ? current.hired : [],
      market: generateMarket(getPlayerId(sessionData), nextRevision),
      revision: nextRevision,
      lastRefreshAnchor: refreshAnchor
    };
    const stored = writeStore(sessionData, next);
    const ownedIds = new Set((stored.hired || []).map((item) => item.id));
    const visibleCount = (stored.market || []).filter((item) => !ownedIds.has(item.id)).length;
    return {
      ok: true,
      refreshed: true,
      count: visibleCount,
      revision: nextRevision,
      message: force
        ? "Casting renouvelé (forcé)."
        : (needsWeeklyRefresh
          ? "Casting renouvelé pour la nouvelle semaine."
          : "Casting initialisé.")
    };
  }

  function getOwnedPresenters(sessionData) {
    return ensureStore(sessionData).hired.slice();
  }

  function getMarketPresenters(sessionData) {
    const store = ensureStore(sessionData);
    const ownedIds = new Set(store.hired.map((item) => item.id));
    return store.market.filter((item) => !ownedIds.has(item.id));
  }

  function findOwnedPresenter(sessionData, presenterId) {
    const id = String(presenterId || "").trim();
    if (!id) return null;
    const store = ensureStore(sessionData);
    return store.hired.find((item) => item.id === id) || null;
  }

  function hirePresenter(sessionData, presenterId) {
    const id = String(presenterId || "").trim();
    if (!sessionData || !id) return { ok: false, message: "Présentateur invalide." };
    const store = ensureStore(sessionData);
    if (store.hired.some((item) => item.id === id)) {
      return { ok: false, message: "Présentateur déjà en CDI." };
    }
    const target = store.market.find((item) => item.id === id);
    if (!target) {
      return { ok: false, message: "Présentateur introuvable." };
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
      category: "recrutement_presentateurs",
      label: `Recrutement CDI: ${target.fullName}`
    });
    if (finance && typeof finance.recordTransaction === "function") {
      finance.recordTransaction(sessionData, {
        amount: -bonus,
        category: "recrutement_presentateurs",
        label: `Recrutement CDI: ${target.fullName}`
      });
    }

    const hiredPresenter = {
      ...target,
      hiredAt: new Date().toISOString(),
      contractType: "CDI"
    };
    const next = {
      ...store,
      hired: [...store.hired, hiredPresenter],
      market: store.market.filter((item) => item.id !== id)
    };
    writeStore(sessionData, next);
    return { ok: true, presenter: hiredPresenter, message: `${target.fullName} rejoint l'équipe en CDI.` };
  }

  function getSalaryBreakdown(sessionData) {
    const hired = getOwnedPresenters(sessionData);
    const rows = hired.map((presenter) => ({
      role: "Présentateur",
      name: presenter.fullName,
      amount: Math.max(0, Math.round((Number(presenter.salaryMonthly) || 0) / DAYS_PER_MONTH))
    }));
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    return { rows, total };
  }

  function getPresenterStarBonus(sessionData, presenterId) {
    const presenter = findOwnedPresenter(sessionData, presenterId);
    if (!presenter) return 0;
    return clamp(Number(presenter.starBonus) || 0, 0, 2);
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

  function entryPresenterIds(entry) {
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

  function listActivePresenterAssignments(sessionData, presenterId) {
    const id = String(presenterId || "").trim();
    if (!sessionData || !id) return [];
    const todayKey = toDateKey(new Date());
    return readStudioSchedule(sessionData)
      .filter((entry) => entryPresenterIds(entry).includes(id))
      .filter((entry) => isActiveAssignment(entry, todayKey))
      .map((entry) => ({
        id: String(entry && entry.id ? entry.id : ""),
        label: formatAssignmentLabel(entry)
      }));
  }

  function getTerminationCost(presenter) {
    if (!presenter || typeof presenter !== "object") return 0;
    const monthly = Math.max(
      MIN_MONTHLY_SALARY,
      Math.round(Number(presenter.salaryMonthly) || Math.round((Number(presenter.salaryDaily) || 0) * DAYS_PER_MONTH))
    );
    return Math.max(0, Math.round(monthly * TERMINATION_COST_MONTHS));
  }

  function getTerminationStatus(sessionData, presenterId) {
    const presenter = findOwnedPresenter(sessionData, presenterId);
    if (!sessionData || !presenter) {
      return {
        ok: false,
        code: "not_found",
        message: "Présentateur introuvable."
      };
    }

    const assignments = listActivePresenterAssignments(sessionData, presenterId);
    const cost = getTerminationCost(presenter);
    if (assignments.length > 0) {
      return {
        ok: false,
        code: "assigned",
        presenter,
        cost,
        assignments,
        message: "Licenciement impossible: ce présentateur est affecté à un programme."
      };
    }

    if (!bank || typeof bank.getBalance !== "function" || typeof bank.add !== "function") {
      return {
        ok: false,
        code: "bank_unavailable",
        presenter,
        cost,
        message: "Module bancaire indisponible."
      };
    }

    const balance = Number(bank.getBalance()) || 0;
    if (balance < cost) {
      return {
        ok: false,
        code: "insufficient_funds",
        presenter,
        cost,
        missing: Math.max(0, cost - balance),
        message: "Fonds insuffisants pour payer les frais de licenciement."
      };
    }

    return {
      ok: true,
      code: "ok",
      presenter,
      cost,
      assignments: []
    };
  }

  function firePresenter(sessionData, presenterId) {
    const status = getTerminationStatus(sessionData, presenterId);
    if (!status.ok) return status;
    const id = String(presenterId || "").trim();
    const store = ensureStore(sessionData);
    if (!store.hired.some((item) => item.id === id)) {
      return { ok: false, code: "not_found", message: "Présentateur introuvable." };
    }

    const cost = Math.max(0, Math.round(Number(status.cost) || 0));
    const presenterName = String((status.presenter && status.presenter.fullName) || "Présentateur");

    if (cost > 0) {
      bank.add(-cost, {
        category: "licenciement_presentateurs",
        label: `Licenciement: ${presenterName}`
      });
      if (finance && typeof finance.recordTransaction === "function") {
        finance.recordTransaction(sessionData, {
          amount: -cost,
          category: "licenciement_presentateurs",
          label: `Licenciement: ${presenterName}`
        });
      }
    }

    const next = {
      ...store,
      hired: store.hired.filter((item) => item.id !== id)
    };
    writeStore(sessionData, next);
    return {
      ok: true,
      code: "fired",
      presenter: status.presenter,
      cost,
      message: `${presenterName} a été licencié.`
    };
  }

  window.PresenterEngine = {
    getOwnedPresentersForCurrentSession: function getOwnedPresentersForCurrentSession() {
      const session = getSession();
      if (!session) return [];
      return getOwnedPresenters(session);
    },
    getMarketPresentersForCurrentSession: function getMarketPresentersForCurrentSession() {
      const session = getSession();
      if (!session) return [];
      return getMarketPresenters(session);
    },
    regenerateMarketForCurrentSession: function regenerateMarketForCurrentSession(options) {
      const session = getSession();
      if (!session) return { ok: false, message: "Session introuvable." };
      return regenerateMarket(session, options);
    },
    hirePresenterForCurrentSession: function hirePresenterForCurrentSession(presenterId) {
      const session = getSession();
      if (!session) return { ok: false, message: "Session introuvable." };
      return hirePresenter(session, presenterId);
    },
    getPresenterByIdForCurrentSession: function getPresenterByIdForCurrentSession(presenterId) {
      const session = getSession();
      if (!session) return null;
      return findOwnedPresenter(session, presenterId);
    },
    getPresenterStarBonusForCurrentSession: function getPresenterStarBonusForCurrentSession(presenterId) {
      const session = getSession();
      if (!session) return 0;
      return getPresenterStarBonus(session, presenterId);
    },
    getSalaryBreakdownForCurrentSession: function getSalaryBreakdownForCurrentSession() {
      const session = getSession();
      if (!session) return { rows: [], total: 0 };
      return getSalaryBreakdown(session);
    },
    getPresenterTerminationStatusForCurrentSession: function getPresenterTerminationStatusForCurrentSession(presenterId) {
      const session = getSession();
      if (!session) return { ok: false, code: "no_session", message: "Session introuvable." };
      return getTerminationStatus(session, presenterId);
    },
    firePresenterForCurrentSession: function firePresenterForCurrentSession(presenterId) {
      const session = getSession();
      if (!session) return { ok: false, code: "no_session", message: "Session introuvable." };
      return firePresenter(session, presenterId);
    },
    computeStarBonusFromStats
  };
})();
