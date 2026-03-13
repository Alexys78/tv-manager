(function cloudSyncInit() {
  const sessionUtils = window.SessionUtils;
  if (!sessionUtils || !sessionUtils.APP_KEYS) return;

  const appKeys = sessionUtils.APP_KEYS;
  const coreApi = window.TVManagerCore;
  const schemaApi = window.TVManagerStateSchema;
  const cloudConfigApi = window.TVManagerCloudConfig;

  const STATE_RECORDS_TABLE = "tv_manager_state_records";
  const SYNC_CONFIG_KEY = (cloudConfigApi && cloudConfigApi.key) || "tv_manager_sync_config_v1";
  const SYNC_STATE_PREFIX = "tv_manager_sync_state_";

  const EXCLUDED_KEYS = new Set([
    appKeys.SESSION_KEY,
    appKeys.LAST_EMAIL_KEY,
    appKeys.LOGOUT_AT_KEY,
    SYNC_CONFIG_KEY
  ]);

  const managedPrefixes = [
    appKeys.DATE_GRID_KEY_PREFIX,
    appKeys.GRID_PUBLICATION_KEY_PREFIX,
    appKeys.RESULTS_KEY_PREFIX,
    appKeys.PLAYER_REDIFF_STATS_KEY_PREFIX,
    appKeys.FINANCE_RESULTS_KEY_PREFIX,
    appKeys.FINANCE_TRANSACTIONS_KEY_PREFIX,
    appKeys.BANK_KEY_PREFIX,
    appKeys.AD_SETTINGS_KEY_PREFIX,
    appKeys.AD_SLOT_PLAN_KEY_PREFIX,
    appKeys.NOTIF_DISMISSED_KEY_PREFIX,
    appKeys.OWNED_KEY_PREFIX,
    appKeys.OWNED_DETAILS_KEY_PREFIX,
    appKeys.STUDIO_KEY_PREFIX,
    appKeys.STUDIO_SCHEDULE_KEY_PREFIX,
    appKeys.STUDIO_PRODUCTIONS_KEY_PREFIX,
    appKeys.PRESENTERS_KEY_PREFIX,
    appKeys.DYNAMIC_FILMS_KEY_PREFIX,
    appKeys.DYNAMIC_FILMS_REVISION_KEY_PREFIX,
    appKeys.DYNAMIC_CATEGORY_KEY_PREFIX,
    appKeys.DYNAMIC_CATEGORY_REVISION_KEY_PREFIX
  ].filter(Boolean);

  let syncInFlight = false;
  let pendingDirty = false;
  let pushTimer = null;
  let runtime = null;

  function getNamespaces() {
    if (schemaApi && typeof schemaApi.listNamespaces === "function") {
      return schemaApi.listNamespaces();
    }
    return [];
  }

  function normalizeNamespace(namespace, value) {
    if (schemaApi && typeof schemaApi.normalizeNamespaceValue === "function") {
      return schemaApi.normalizeNamespaceValue(namespace, value);
    }
    return value;
  }

  function defaultNamespaceValue(namespace) {
    if (schemaApi && typeof schemaApi.defaultFor === "function") {
      return schemaApi.defaultFor(namespace);
    }
    return null;
  }

  function getActiveSession() {
    const recovered = sessionUtils.recoverSessionFromLocation({ persist: true });
    if (recovered && recovered.email && sessionUtils.hasCloudAccess(recovered)) return recovered;
    if (runtime && runtime.session && runtime.session.email) return runtime.session;
    return null;
  }

  function readConfig() {
    if (cloudConfigApi && typeof cloudConfigApi.read === "function") {
      const cfg = cloudConfigApi.read();
      if (cfg && cfg.url && cfg.anonKey) {
        return {
          url: String(cfg.url).trim().replace(/\/+$/, ""),
          anonKey: String(cfg.anonKey).trim(),
          syncToken: String(cfg.syncToken || "").trim()
        };
      }
    }
    try {
      const raw = localStorage.getItem(SYNC_CONFIG_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.url || !parsed.anonKey) return null;
      return {
        url: String(parsed.url).trim().replace(/\/+$/, ""),
        anonKey: String(parsed.anonKey).trim(),
        syncToken: String(parsed.syncToken || "").trim()
      };
    } catch {
      return null;
    }
  }

  function isManagedKey(key) {
    if (!key || EXCLUDED_KEYS.has(key)) return false;
    return managedPrefixes.some((prefix) => key === prefix || key.startsWith(prefix));
  }

  function getPlayerId(session) {
    return sessionUtils.getPlayerId(session);
  }

  function stateStorageKey(playerId) {
    return `${SYNC_STATE_PREFIX}${playerId}`;
  }

  function setDirtyTimestamp(playerId) {
    if (!playerId) return;
    localStorage.setItem(`${SYNC_STATE_PREFIX}${playerId}:dirty`, String(Date.now()));
  }

  function clearDirtyTimestamp(playerId) {
    if (!playerId) return;
    localStorage.removeItem(`${SYNC_STATE_PREFIX}${playerId}:dirty`);
  }

  function readSyncState(playerId) {
    try {
      if (!playerId) return null;
      const raw = localStorage.getItem(stateStorageKey(playerId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function pushSyncLog(playerId, entry) {
    if (!playerId) return null;
    const current = readSyncState(playerId) || {};
    const logs = Array.isArray(current.logs) ? current.logs.slice(0, 19) : [];
    logs.unshift(entry);
    return {
      status: current.status || "idle",
      lastSuccessAt: current.lastSuccessAt || null,
      lastErrorAt: current.lastErrorAt || null,
      lastErrorMessage: current.lastErrorMessage || "",
      logs
    };
  }

  function setSyncState(playerId, patch, logEntry) {
    if (!playerId) return;
    const current = readSyncState(playerId) || {
      status: "idle",
      lastSuccessAt: null,
      lastErrorAt: null,
      lastErrorMessage: "",
      logs: []
    };
    const next = { ...current, ...(patch || {}) };
    const finalState = logEntry ? { ...(pushSyncLog(playerId, logEntry) || next), ...next } : next;
    localStorage.setItem(stateStorageKey(playerId), JSON.stringify(finalState));
    window.dispatchEvent(new CustomEvent("tvmanager:cloud-sync-state", {
      detail: { playerId, state: finalState }
    }));
  }

  function emitSyncResult(detail) {
    window.dispatchEvent(new CustomEvent("tvmanager:cloud-sync", { detail }));
  }

  function makeHeaders(config, session) {
    if (!session || !session.email) {
      throw new Error("Session cloud invalide: reconnecte-toi.");
    }
    return {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    };
  }

  async function readErrorDetails(response) {
    try {
      const text = await response.text();
      if (!text) return "";
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object") {
          if (parsed.message) return String(parsed.message);
          if (parsed.error) return String(parsed.error);
          if (parsed.hint) return String(parsed.hint);
        }
      } catch {
        // keep raw text
      }
      return String(text).slice(0, 240);
    } catch {
      return "";
    }
  }

  function effectiveSyncToken(config, playerId) {
    const explicitToken = String((config && config.syncToken) || "").trim();
    return explicitToken || String(playerId || "").trim() || "default";
  }

  async function fetchLatestRowForNamespace(config, session, playerId, namespace) {
    const token = effectiveSyncToken(config, playerId);
    const url = `${config.url}/rest/v1/${encodeURIComponent(STATE_RECORDS_TABLE)}?player_id=eq.${encodeURIComponent(playerId)}&sync_token=eq.${encodeURIComponent(token)}&namespace=eq.${encodeURIComponent(namespace)}&select=namespace,payload,updated_at,sync_token&order=updated_at.desc&limit=1`;
    let response = await fetch(url, { method: "GET", headers: makeHeaders(config, session) });
    if (!response.ok) {
      const details = await readErrorDetails(response);
      throw new Error(`Lecture cloud impossible (${response.status})${details ? `: ${details}` : ""}`);
    }
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows[0];
  }

  async function fetchRemoteSnapshot(config, session, playerId) {
    const namespaces = getNamespaces();
    const snapshot = {};
    let foundAnyRow = false;
    const rows = await Promise.all(
      namespaces.map((namespace) => fetchLatestRowForNamespace(config, session, playerId, namespace))
    );
    namespaces.forEach((namespace, index) => {
      const row = rows[index];
      if (row && typeof row === "object") {
        snapshot[namespace] = normalizeNamespace(namespace, row.payload);
        foundAnyRow = true;
      } else {
        snapshot[namespace] = normalizeNamespace(namespace, defaultNamespaceValue(namespace));
      }
    });
    return { snapshot, foundAnyRow };
  }

  async function ensureRuntimeSession(options) {
    const opts = options && typeof options === "object" ? options : {};
    const refreshFn = sessionUtils && typeof sessionUtils.refreshSessionIfNeeded === "function"
      ? sessionUtils.refreshSessionIfNeeded
      : null;
    const refreshed = refreshFn
      ? await refreshFn({ force: opts.forceRefresh === true })
      : getActiveSession();
    if (!refreshed || !refreshed.email) {
      throw new Error("Session cloud invalide: reconnecte-toi.");
    }
    if (!runtime) runtime = {};
    runtime.session = refreshed;
    runtime.playerId = getPlayerId(refreshed);
    return refreshed;
  }

  function getStateRecordsCloudStore() {
    if (!coreApi || typeof coreApi.createCloudStoreForCurrentPlayer !== "function") return null;
    if (!runtime || !runtime.config) return null;
    const activeSession = getActiveSession();
    if (activeSession && (!runtime.session || runtime.session.email !== activeSession.email)) {
      runtime.session = activeSession;
      runtime.playerId = getPlayerId(activeSession);
    }
    return coreApi.createCloudStoreForCurrentPlayer({
      url: runtime.config.url,
      anonKey: runtime.config.anonKey,
      syncToken: runtime.config.syncToken || "",
      table: STATE_RECORDS_TABLE
    });
  }

  async function buildNamespaceSnapshotFromLocal() {
    const namespaces = getNamespaces();
    if (!namespaces.length || !coreApi || typeof coreApi.createLocalStoreForCurrentPlayer !== "function") {
      return {};
    }
    const localStore = coreApi.createLocalStoreForCurrentPlayer();
    await localStore.init(namespaces);
    return localStore.getMany(namespaces);
  }

  async function applyRemoteSnapshot(snapshot) {
    const namespaces = getNamespaces();
    if (!namespaces.length || !coreApi || typeof coreApi.createLocalStoreForCurrentPlayer !== "function") return;
    const localStore = coreApi.createLocalStoreForCurrentPlayer();
    await localStore.init(namespaces);
    await localStore.setMany(snapshot);
  }

  async function pushNow(reason) {
    if (!runtime || syncInFlight) return;
    syncInFlight = true;
    const activePlayerId = runtime.playerId;
    setSyncState(activePlayerId, { status: "syncing", lastErrorMessage: "" }, {
      at: new Date().toISOString(),
      type: "info",
      mode: "state_records",
      reason: reason || "auto",
      message: "Synchronisation en cours"
    });
    try {
      await ensureRuntimeSession();
      const snapshot = await buildNamespaceSnapshotFromLocal();
      const entries = Object.entries(snapshot || {});
      if (entries.length > 0) {
        const cloudStore = getStateRecordsCloudStore();
        if (!cloudStore) throw new Error("Store cloud indisponible.");
        await cloudStore.setMany(snapshot);
      }
      clearDirtyTimestamp(activePlayerId);
      pendingDirty = false;
      setSyncState(activePlayerId, {
        status: "synced",
        lastSuccessAt: new Date().toISOString(),
        lastErrorMessage: ""
      }, {
        at: new Date().toISOString(),
        type: "success",
        mode: "state_records",
        reason: reason || "auto",
        message: `${entries.length} namespaces synchronisés`
      });
      emitSyncResult({ ok: true, mode: "push", reason: reason || "auto" });
    } catch (error) {
      setSyncState(activePlayerId, {
        status: "error",
        lastErrorAt: new Date().toISOString(),
        lastErrorMessage: error.message || "Erreur inconnue"
      }, {
        at: new Date().toISOString(),
        type: "error",
        mode: "state_records",
        reason: reason || "auto",
        message: error.message || "Erreur de sync"
      });
      emitSyncResult({ ok: false, mode: "push", reason: reason || "auto", error: error.message });
      throw error;
    } finally {
      syncInFlight = false;
      if (pendingDirty) schedulePush();
    }
  }

  function schedulePush() {
    if (!runtime) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      pushNow("debounced").catch(() => {});
    }, 1200);
  }

  function markDirty(key) {
    if (!runtime || !isManagedKey(key)) return;
    pendingDirty = true;
    setDirtyTimestamp(runtime.playerId);
    const current = readSyncState(runtime.playerId);
    const alreadyPending = current && current.status === "pending";
    setSyncState(runtime.playerId, { status: "pending" }, alreadyPending ? null : {
      at: new Date().toISOString(),
      type: "info",
      mode: "local",
      reason: "change",
      message: "Modifications locales en attente"
    });
    schedulePush();
  }

  function patchLocalStorageWrites() {
    if (window.__tvManagerLocalStoragePatchedBySync) return;
    window.__tvManagerLocalStoragePatchedBySync = true;

    const originalSetItem = localStorage.setItem.bind(localStorage);
    const originalRemoveItem = localStorage.removeItem.bind(localStorage);

    localStorage.setItem = function patchedSetItem(key, value) {
      originalSetItem(key, value);
      markDirty(key);
    };

    localStorage.removeItem = function patchedRemoveItem(key) {
      originalRemoveItem(key);
      markDirty(key);
    };
  }

  async function pullNow(reason) {
    if (!runtime) return;
    const activePlayerId = runtime.playerId;
    setSyncState(activePlayerId, { status: "syncing", lastErrorMessage: "" }, {
      at: new Date().toISOString(),
      type: "info",
      mode: "state_records",
      reason: reason || "pull",
      message: "Récupération cloud"
    });
    const activeSession = await ensureRuntimeSession();
    const remote = await fetchRemoteSnapshot(runtime.config, activeSession, activePlayerId);
    if (!remote.foundAnyRow) {
      throw new Error("Aucune sauvegarde cloud trouvée pour ce joueur.");
    }
    await applyRemoteSnapshot(remote.snapshot);
    clearDirtyTimestamp(activePlayerId);
    pendingDirty = false;
    setSyncState(activePlayerId, {
      status: "synced",
      lastSuccessAt: new Date().toISOString(),
      lastErrorMessage: ""
    }, {
      at: new Date().toISOString(),
      type: "success",
      mode: "state_records",
      reason: reason || "pull",
      message: "Version cloud récupérée"
    });
    emitSyncResult({ ok: true, mode: "pull", reason: reason || "manual" });
  }

  async function bootstrapSync() {
    const config = readConfig();
    if (!config) return;
    let session = getActiveSession();
    if (!session) return;
    if (sessionUtils && typeof sessionUtils.refreshSessionIfNeeded === "function") {
      try {
        session = await sessionUtils.refreshSessionIfNeeded({ force: false }) || session;
      } catch {
        // Keep current in-memory session if refresh fails here.
      }
    }
    if (!session || !session.email) return;
    const playerId = getPlayerId(session);
    runtime = { config, session, playerId };

    setSyncState(playerId, { status: "syncing", lastErrorMessage: "" }, {
      at: new Date().toISOString(),
      type: "info",
      mode: "state_records",
      reason: "startup",
      message: "Connexion cloud"
    });

    try {
      const activeSession = await ensureRuntimeSession();
      const remote = await fetchRemoteSnapshot(config, activeSession, playerId);
      if (remote.foundAnyRow) {
        await applyRemoteSnapshot(remote.snapshot);
        clearDirtyTimestamp(playerId);
        pendingDirty = false;
        setSyncState(playerId, {
          status: "synced",
          lastSuccessAt: new Date().toISOString(),
          lastErrorMessage: ""
        }, {
          at: new Date().toISOString(),
          type: "success",
          mode: "state_records",
          reason: "startup-pull",
          message: "Données cloud chargées"
        });
        emitSyncResult({ ok: true, mode: "pull", reason: "startup" });
      } else {
        await pushNow("bootstrap-seed");
      }
    } catch (error) {
      setSyncState(playerId, {
        status: "error",
        lastErrorAt: new Date().toISOString(),
        lastErrorMessage: error.message || "Erreur inconnue"
      }, {
        at: new Date().toISOString(),
        type: "error",
        mode: "state_records",
        reason: "startup",
        message: error.message || "Erreur de connexion cloud"
      });
      emitSyncResult({ ok: false, mode: "bootstrap", error: error.message });
    }

    patchLocalStorageWrites();
    window.addEventListener("beforeunload", () => {
      if (pendingDirty) {
        pushNow("beforeunload").catch(() => {});
      }
    });
  }

  function configureAndSync(payload) {
    const config = payload && typeof payload === "object" ? payload : {};
    const next = {
      url: String(config.url || "").trim().replace(/\/+$/, ""),
      anonKey: String(config.anonKey || "").trim(),
      table: STATE_RECORDS_TABLE,
      syncToken: String(config.syncToken || "").trim(),
      adminEmails: Array.isArray(config.adminEmails)
        ? config.adminEmails.map((email) => String(email || "").trim().toLowerCase()).filter(Boolean)
        : []
    };
    if (!next.url || !next.anonKey) {
      throw new Error("URL et clé anon obligatoires.");
    }
    if (cloudConfigApi && typeof cloudConfigApi.write === "function") {
      cloudConfigApi.write(next);
    } else {
      localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(next));
    }
    return bootstrapSync();
  }

  function getConfig() {
    const cfg = readConfig();
    if (!cfg) return null;
    return {
      ...cfg,
      table: STATE_RECORDS_TABLE
    };
  }

  async function forcePush() {
    const config = readConfig();
    const session = await ensureRuntimeSession();
    if (!config || !session) {
      throw new Error("Configuration sync ou session manquante.");
    }
    runtime = { config, session, playerId: getPlayerId(session) };
    return pushNow("manual");
  }

  async function forcePull() {
    const config = readConfig();
    const session = await ensureRuntimeSession();
    if (!config || !config.url || !config.anonKey) {
      throw new Error("Configuration sync manquante (URL ou clé anon).");
    }
    if (!session || !session.email) {
      throw new Error("Session manquante: reconnecte-toi puis recharge la page.");
    }
    runtime = { config, session, playerId: getPlayerId(session) };
    return pullNow("manual");
  }

  function getSyncState() {
    if (!runtime || !runtime.playerId) return null;
    return readSyncState(runtime.playerId);
  }

  window.TVManagerCloudSync = {
    getConfig,
    configureAndSync,
    forcePush,
    forcePull,
    bootstrapSync,
    getSyncState
  };

  bootstrapSync();
})();
