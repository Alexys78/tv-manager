(function sessionUtilsInit() {
  const APP_KEYS = {
    SESSION_KEY: "tv_manager_session",
    LAST_EMAIL_KEY: "tv_manager_last_email",
    LOGOUT_AT_KEY: "tv_manager_logout_at",
    WEEK_GRID_KEY_PREFIX: "tv_manager_week_grid_",
    LEGACY_GRID_KEY_PREFIX: "tv_manager_grid_",
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

  function getPlayerId(sessionData) {
    if (!sessionData || typeof sessionData !== "object") return "player";
    return sessionData.email || sessionData.username || "player";
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

  function decodeSessionToken(token) {
    if (!token) return null;
    try {
      const utf8 = atob(token);
      const json = decodeURIComponent(utf8);
      const parsed = JSON.parse(json);
      if (!parsed || !parsed.email) return null;
      return {
        username: parsed.username || "",
        email: parsed.email,
        connectedAt: parsed.connectedAt || new Date().toISOString()
      };
    } catch {
      return null;
    }
  }

  function parseIsoDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
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

  function encodeSessionToken(sessionData) {
    if (!sessionData || !sessionData.email) return "";
    const json = JSON.stringify(sessionData);
    const utf8 = encodeURIComponent(json);
    return btoa(utf8);
  }

  function persistSession(sessionData) {
    if (!sessionData || !sessionData.email) return;
    localStorage.removeItem(LOGOUT_AT_KEY);
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    localStorage.setItem(LAST_EMAIL_KEY, sessionData.email);
  }

  function recoverSessionFromLocation(options) {
    const opts = options && typeof options === "object" ? options : {};
    const persist = opts.persist !== false;

    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get("session");

    const tokenSession = decodeSessionToken(tokenFromUrl);
    if (tokenSession && !isTokenRevoked(tokenSession)) {
      if (persist) persistSession(tokenSession);
      return tokenSession;
    }

    const rawSession = localStorage.getItem(SESSION_KEY);
    if (rawSession) {
      try {
        const parsed = JSON.parse(rawSession);
        if (parsed && parsed.email && !isTokenRevoked(parsed)) return parsed;
      } catch {
        // fallback below
      }
    }

    return null;
  }

  function withSession(path, sessionData) {
    const currentSession = sessionData || recoverSessionFromLocation({ persist: true });
    if (currentSession && currentSession.email) {
      persistSession(currentSession);
      const token = encodeSessionToken(currentSession);
      if (!token) return path;
      try {
        const url = new URL(String(path || ""), window.location.href);
        url.searchParams.set("session", token);
        return url.toString();
      } catch {
        const rawPath = String(path || "");
        const hashIndex = rawPath.indexOf("#");
        const base = hashIndex >= 0 ? rawPath.slice(0, hashIndex) : rawPath;
        const hash = hashIndex >= 0 ? rawPath.slice(hashIndex) : "";
        const sep = base.includes("?") ? "&" : "?";
        return `${base}${sep}session=${encodeURIComponent(token)}${hash}`;
      }
    }
    return path;
  }

  function clearUrlSearch() {
    if (!window.location.search) return;
    const nextUrl = `${window.location.pathname}${window.location.hash || ""}`;
    window.history.replaceState({}, "", nextUrl);
  }

  function requireSession(options) {
    const opts = options && typeof options === "object" ? options : {};
    const session = recoverSessionFromLocation({
      persist: opts.persist !== false,
      allowEmailParam: opts.allowEmailParam === true
    });
    if (!session) {
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
    toDateKey,
    parseDateKey,
    addDaysToDateKey,
    getDateKeyByOffset,
    formatEuro,
    decodeSessionToken,
    encodeSessionToken,
    isTokenRevoked,
    recoverSessionFromLocation,
    withSession,
    clearUrlSearch,
    requireSession
  };
})();
