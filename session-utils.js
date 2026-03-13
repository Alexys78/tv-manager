(function sessionUtilsInit() {
  const APP_KEYS = {
    SESSION_KEY: "tv_manager_session",
    LAST_EMAIL_KEY: "tv_manager_last_email",
    LOGOUT_AT_KEY: "tv_manager_logout_at",
    DATE_GRID_KEY_PREFIX: "tv_manager_date_grid_",
    GRID_PUBLICATION_KEY_PREFIX: "tv_manager_grid_publication_",
    RESULTS_KEY_PREFIX: "tv_manager_audience_results_",
    PLAYER_REDIFF_STATS_KEY_PREFIX: "tv_manager_player_rediff_stats_",
    FINANCE_RESULTS_KEY_PREFIX: "tv_manager_finance_results_",
    FINANCE_TRANSACTIONS_KEY_PREFIX: "tv_manager_finance_transactions_",
    BANK_KEY_PREFIX: "tv_manager_bank_",
    AD_SETTINGS_KEY_PREFIX: "tv_manager_ad_settings_",
    AD_SLOT_PLAN_KEY_PREFIX: "tv_manager_ad_slot_plan_",
    NOTIF_DISMISSED_KEY_PREFIX: "tv_manager_notif_dismissed_",
    OWNED_KEY_PREFIX: "tv_manager_owned_programs_",
    OWNED_DETAILS_KEY_PREFIX: "tv_manager_owned_program_details_",
    STUDIO_KEY_PREFIX: "tv_manager_studio_",
    STUDIO_SCHEDULE_KEY_PREFIX: "tv_manager_studio_schedule_",
    STUDIO_PRODUCTIONS_KEY_PREFIX: "tv_manager_studio_productions_",
    PRESENTERS_KEY_PREFIX: "tv_manager_presenters_",
    DYNAMIC_FILMS_KEY_PREFIX: "tv_manager_dynamic_films_",
    DYNAMIC_FILMS_REVISION_KEY_PREFIX: "tv_manager_dynamic_films_revision_",
    DYNAMIC_CATEGORY_KEY_PREFIX: "tv_manager_dynamic_category_",
    DYNAMIC_CATEGORY_REVISION_KEY_PREFIX: "tv_manager_dynamic_category_revision_"
  };

  const SESSION_KEY = APP_KEYS.SESSION_KEY;
  const LAST_EMAIL_KEY = APP_KEYS.LAST_EMAIL_KEY;
  const LOGOUT_AT_KEY = APP_KEYS.LOGOUT_AT_KEY;
  const DAY_START_MINUTE = 5 * 60;
  const DAY_END_MINUTE = 25 * 60;

  function toSafeString(value) {
    return String(value || "").trim();
  }

  function parseIsoDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  function normalizeEmail(value) {
    return toSafeString(value).toLowerCase();
  }

  function sanitizeUsername(value, fallbackEmail) {
    const cleaned = String(value || "")
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
    if (cleaned) return cleaned;
    const safeFallback = String(fallbackEmail || "")
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
    return safeFallback || "Joueur";
  }

  function normalizeAdminEmails(rawList) {
    if (!Array.isArray(rawList)) return [];
    return rawList
      .map((value) => normalizeEmail(value))
      .filter(Boolean);
  }

  function resolveAdminFlag(email) {
    const safeEmail = normalizeEmail(email);
    const config = window.TVManagerCloudConfig && typeof window.TVManagerCloudConfig.read === "function"
      ? window.TVManagerCloudConfig.read()
      : null;
    const configuredAdmins = normalizeAdminEmails(config && config.adminEmails);
    if (configuredAdmins.includes(safeEmail)) return true;
    return false;
  }

  function normalizeSession(sessionData) {
    if (!sessionData || typeof sessionData !== "object") return null;
    const email = normalizeEmail(sessionData.email);
    if (!email) return null;
    const connectedAtRaw = parseIsoDate(sessionData.connectedAt);
    const connectedAt = connectedAtRaw ? connectedAtRaw.toISOString() : new Date().toISOString();
    const expiresAtRaw = parseIsoDate(sessionData.expiresAt);
    return {
      username: sanitizeUsername(sessionData.username, email),
      email,
      connectedAt,
      supabaseUserId: "",
      accessToken: toSafeString(sessionData.accessToken),
      refreshToken: toSafeString(sessionData.refreshToken),
      tokenType: toSafeString(sessionData.tokenType || "bearer").toLowerCase(),
      expiresAt: expiresAtRaw ? expiresAtRaw.toISOString() : null,
      isAdmin: Boolean(sessionData.isAdmin) || resolveAdminFlag(email),
      legacyAuth: sessionData.legacyAuth !== false
    };
  }

  function getPlayerId(sessionData) {
    if (!sessionData || typeof sessionData !== "object") return "player";
    return sessionData.email || sessionData.username || "player";
  }

  function getPlayerChannelName(sessionData) {
    if (!sessionData || typeof sessionData !== "object") return "Ta chaîne";
    const username = sanitizeUsername(sessionData.username, "");
    if (!username || username === "Joueur") return "Ta chaîne";
    return `${username} TV`;
  }

  function toDateKey(date) {
    const safeDate = date instanceof Date ? date : new Date();
    const year = safeDate.getFullYear();
    const month = String(safeDate.getMonth() + 1).padStart(2, "0");
    const day = String(safeDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseDateKey(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function addDaysToDateKey(dateKey, delta) {
    const base = parseDateKey(dateKey);
    if (!base) return String(dateKey || "");
    base.setDate(base.getDate() + Number(delta || 0));
    return toDateKey(base);
  }

  function getDateKeyByOffset(offsetDays) {
    const date = new Date();
    date.setDate(date.getDate() + Number(offsetDays || 0));
    return toDateKey(date);
  }

  function formatEuro(value) {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0
    }).format(Number(value) || 0);
  }

  function decodeSessionToken() {
    return null;
  }

  function encodeSessionToken() {
    return "";
  }

  function isTokenRevoked(sessionData) {
    if (!sessionData || !sessionData.email) return true;
    const rawLogoutAt = localStorage.getItem(LOGOUT_AT_KEY);
    if (!rawLogoutAt) return false;
    const logoutAt = parseIsoDate(rawLogoutAt);
    if (!logoutAt) return false;
    const connectedAt = parseIsoDate(sessionData.connectedAt);
    if (!connectedAt) return true;
    return connectedAt.getTime() <= logoutAt.getTime();
  }

  function isSessionExpired() {
    return false;
  }

  function hasCloudAccess(sessionData) {
    if (!sessionData || !sessionData.email) return false;
    return true;
  }

  function canAccessAdmin(sessionData) {
    const safeSession = sessionData && typeof sessionData === "object" ? sessionData : null;
    if (!safeSession || !safeSession.email) return false;
    const config = window.TVManagerCloudConfig && typeof window.TVManagerCloudConfig.read === "function"
      ? window.TVManagerCloudConfig.read()
      : null;
    const configuredAdmins = normalizeAdminEmails(config && config.adminEmails);
    if (configuredAdmins.length > 0) return configuredAdmins.includes(normalizeEmail(safeSession.email));
    return Boolean(safeSession.email);
  }

  function persistSession(sessionData) {
    const normalized = normalizeSession(sessionData);
    if (!normalized || !normalized.email) return null;
    localStorage.removeItem(LOGOUT_AT_KEY);
    localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
    localStorage.setItem(LAST_EMAIL_KEY, normalized.email);
    return normalized;
  }

  function clearSession(options) {
    const opts = options && typeof options === "object" ? options : {};
    if (opts.markLoggedOut !== false) {
      localStorage.setItem(LOGOUT_AT_KEY, new Date().toISOString());
    }
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LAST_EMAIL_KEY);
  }

  function readStoredSession() {
    try {
      const rawSession = localStorage.getItem(SESSION_KEY);
      if (!rawSession) return null;
      const parsed = normalizeSession(JSON.parse(rawSession));
      if (!parsed) return null;
      if (isTokenRevoked(parsed)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function recoverSessionFromLocation(options) {
    const opts = options && typeof options === "object" ? options : {};
    const persist = opts.persist !== false;
    const parsed = readStoredSession();
    if (!parsed) return null;
    if (persist) persistSession(parsed);
    return parsed;
  }

  function withSession(path, sessionData) {
    if (sessionData && typeof sessionData === "object") persistSession(sessionData);
    return String(path || "");
  }

  function clearUrlSearch() {
    if (!window.location.search) return;
    const nextUrl = `${window.location.pathname}${window.location.hash || ""}`;
    window.history.replaceState({}, "", nextUrl);
  }

  async function refreshSessionIfNeeded() {
    const session = recoverSessionFromLocation({ persist: false });
    if (!session) return null;
    if (!session.legacyAuth) {
      const normalized = normalizeSession({ ...session, legacyAuth: true });
      if (!normalized) return session;
      persistSession(normalized);
      return normalized;
    }
    return session;
  }

  async function signOutSessionRemote() {
    clearSession({ markLoggedOut: true });
  }

  function requireSession(options) {
    const opts = options && typeof options === "object" ? options : {};
    const session = recoverSessionFromLocation({
      persist: opts.persist !== false
    });
    const validSession = session && hasCloudAccess(session);
    if (!validSession) {
      clearSession({ markLoggedOut: false });
      if (opts.redirectPath !== false) {
        window.location.href = typeof opts.redirectPath === "string" ? opts.redirectPath : "index.html";
      }
      return null;
    }
    if (opts.clearSearch !== false) clearUrlSearch();
    return session;
  }

  window.SessionUtils = {
    APP_KEYS,
    SESSION_KEY,
    LAST_EMAIL_KEY,
    LOGOUT_AT_KEY,
    DAY_START_MINUTE,
    DAY_END_MINUTE,
    getPlayerId,
    getPlayerChannelName,
    toDateKey,
    parseDateKey,
    addDaysToDateKey,
    getDateKeyByOffset,
    formatEuro,
    decodeSessionToken,
    encodeSessionToken,
    isTokenRevoked,
    isSessionExpired,
    hasCloudAccess,
    canAccessAdmin,
    normalizeSession,
    persistSession,
    clearSession,
    recoverSessionFromLocation,
    refreshSessionIfNeeded,
    signOutSessionRemote,
    withSession,
    clearUrlSearch,
    requireSession
  };
})();
