(function tvManagerStorageAdapterInit() {
  const sessionUtils = window.SessionUtils;
  const schema = window.TVManagerStateSchema;
  if (!sessionUtils || !schema) return;

  const appKeys = sessionUtils.APP_KEYS || {};

  function safeJsonParse(raw, fallback) {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function normalize(namespace, value) {
    return schema.normalizeNamespaceValue(namespace, value);
  }

  function normalizeForCloudWrite(namespace, value) {
    const normalized = normalize(namespace, value);
    if (normalized !== null && normalized !== undefined) return normalized;
    const fallback = schema.defaultFor(namespace);
    if (fallback !== null && fallback !== undefined) return fallback;
    return {};
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
        // use raw text below
      }
      return String(text).slice(0, 240);
    } catch {
      return "";
    }
  }

  function createLegacyKeyResolver(playerId) {
    const base = {
      bank_balance: `${appKeys.BANK_KEY_PREFIX || "tv_manager_bank_"}${playerId}`,
      date_grid: `${appKeys.DATE_GRID_KEY_PREFIX || "tv_manager_date_grid_"}${playerId}`,
      grid_publication: `${appKeys.GRID_PUBLICATION_KEY_PREFIX || "tv_manager_grid_publication_"}${playerId}`,
      audience_results: `${appKeys.RESULTS_KEY_PREFIX || "tv_manager_audience_results_"}${playerId}`,
      rediff_stats: `${appKeys.PLAYER_REDIFF_STATS_KEY_PREFIX || "tv_manager_player_rediff_stats_"}${playerId}`,
      finance_results: `${appKeys.FINANCE_RESULTS_KEY_PREFIX || "tv_manager_finance_results_"}${playerId}`,
      finance_transactions: `${appKeys.FINANCE_TRANSACTIONS_KEY_PREFIX || "tv_manager_finance_transactions_"}${playerId}`,
      owned_titles: `${appKeys.OWNED_KEY_PREFIX || "tv_manager_owned_programs_"}${playerId}`,
      owned_details: `${appKeys.OWNED_DETAILS_KEY_PREFIX || "tv_manager_owned_program_details_"}${playerId}`,
      studio_state: `${appKeys.STUDIO_KEY_PREFIX || "tv_manager_studio_"}${playerId}`,
      studio_schedule: `${appKeys.STUDIO_SCHEDULE_KEY_PREFIX || "tv_manager_studio_schedule_"}${playerId}`,
      presenters: `${appKeys.PRESENTERS_KEY_PREFIX || "tv_manager_presenters_"}${playerId}`,
      ad_settings: `${appKeys.AD_SETTINGS_KEY_PREFIX || "tv_manager_ad_settings_"}${playerId}`,
      ad_slot_plan: `${appKeys.AD_SLOT_PLAN_KEY_PREFIX || "tv_manager_ad_slot_plan_"}${playerId}`,
      dynamic_films: `${appKeys.DYNAMIC_FILMS_KEY_PREFIX || "tv_manager_dynamic_films_"}${playerId}`,
      dynamic_films_revision: `${appKeys.DYNAMIC_FILMS_REVISION_KEY_PREFIX || "tv_manager_dynamic_films_revision_"}${playerId}`,
      notifications_dismissed: `${appKeys.NOTIF_DISMISSED_KEY_PREFIX || "tv_manager_notif_dismissed_"}${playerId}`
    };

    const dynamicCategoryPrefix = `${appKeys.DYNAMIC_CATEGORY_KEY_PREFIX || "tv_manager_dynamic_category_"}${playerId}_`;
    const dynamicCategoryRevisionPrefix = `${appKeys.DYNAMIC_CATEGORY_REVISION_KEY_PREFIX || "tv_manager_dynamic_category_revision_"}${playerId}_`;

    return {
      keyFor(namespace) {
        return base[namespace] || null;
      },
      dynamicCategoryPrefix,
      dynamicCategoryRevisionPrefix
    };
  }

  function listStorageKeys() {
    const runtime = window.TVManagerStorageRuntime;
    if (runtime && typeof runtime.keys === "function") {
      return runtime.keys();
    }
    const out = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key) out.push(key);
    }
    return out;
  }

  function collectKeysByPrefix(prefix) {
    const out = {};
    if (!prefix) return out;
    const keys = listStorageKeys();
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (!key || !key.startsWith(prefix)) continue;
      out[key.slice(prefix.length)] = localStorage.getItem(key);
    }
    return out;
  }

  class LocalNamespaceAdapter {
    constructor(session) {
      this.session = session || null;
      this.playerId = sessionUtils.getPlayerId(session);
      this.resolver = createLegacyKeyResolver(this.playerId);
    }

    async get(namespace) {
      if (namespace === "dynamic_categories") {
        const rawMap = collectKeysByPrefix(this.resolver.dynamicCategoryPrefix);
        const parsed = {};
        Object.keys(rawMap).forEach((id) => {
          parsed[id] = safeJsonParse(rawMap[id], []);
        });
        return normalize(namespace, parsed);
      }

      if (namespace === "dynamic_categories_revision") {
        const rawMap = collectKeysByPrefix(this.resolver.dynamicCategoryRevisionPrefix);
        const parsed = {};
        Object.keys(rawMap).forEach((id) => {
          parsed[id] = Number(rawMap[id]) || null;
        });
        return normalize(namespace, parsed);
      }

      const key = this.resolver.keyFor(namespace);
      if (!key) return normalize(namespace, schema.defaultFor(namespace));
      const raw = localStorage.getItem(key);

      if (namespace === "bank_balance") {
        return normalize(namespace, Number(raw));
      }

      return normalize(namespace, safeJsonParse(raw, schema.defaultFor(namespace)));
    }

    async set(namespace, value) {
      if (namespace === "dynamic_categories") {
        const next = value && typeof value === "object" ? value : {};
        Object.keys(next).forEach((categoryId) => {
          localStorage.setItem(`${this.resolver.dynamicCategoryPrefix}${categoryId}`, JSON.stringify(next[categoryId]));
        });
        return;
      }

      if (namespace === "dynamic_categories_revision") {
        const next = value && typeof value === "object" ? value : {};
        Object.keys(next).forEach((categoryId) => {
          localStorage.setItem(`${this.resolver.dynamicCategoryRevisionPrefix}${categoryId}`, String(next[categoryId] || ""));
        });
        return;
      }

      const key = this.resolver.keyFor(namespace);
      if (!key) return;

      if (namespace === "bank_balance") {
        localStorage.setItem(key, String(Number(value) || 0));
        return;
      }

      localStorage.setItem(key, JSON.stringify(value));
    }

    async getMany(namespaces) {
      const entries = await Promise.all((namespaces || []).map(async (ns) => [ns, await this.get(ns)]));
      return Object.fromEntries(entries);
    }

    async setMany(payload) {
      const entries = Object.entries(payload || {});
      for (let i = 0; i < entries.length; i += 1) {
        const [ns, value] = entries[i];
        // eslint-disable-next-line no-await-in-loop
        await this.set(ns, value);
      }
    }
  }

  class SupabaseNamespaceAdapter {
    constructor(options) {
      const opts = options || {};
      this.url = String(opts.url || "").trim().replace(/\/+$/, "");
      this.anonKey = String(opts.anonKey || "").trim();
      this.table = String(opts.table || "tv_manager_state_records").trim();
      this.playerId = String(opts.playerId || "").trim();
      this.syncToken = String(opts.syncToken || "").trim();
    }

    effectiveSyncToken() {
      return this.syncToken || "default";
    }

    headers() {
      return {
        apikey: this.anonKey,
        Authorization: `Bearer ${this.anonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      };
    }

    whereNamespace(namespace) {
      const tokenClause = `&sync_token=eq.${encodeURIComponent(this.effectiveSyncToken())}`;
      return `${this.url}/rest/v1/${encodeURIComponent(this.table)}?player_id=eq.${encodeURIComponent(this.playerId)}&namespace=eq.${encodeURIComponent(namespace)}${tokenClause}`;
    }

    async get(namespace) {
      const url = `${this.whereNamespace(namespace)}&select=namespace,payload&limit=1`;
      const response = await fetch(url, { method: "GET", headers: this.headers() });
      if (!response.ok) {
        const details = await readErrorDetails(response);
        throw new Error(`Cloud read failed (${response.status})${details ? `: ${details}` : ""}`);
      }
      const rows = await response.json();
      if (!Array.isArray(rows) || rows.length === 0) return schema.defaultFor(namespace);
      return normalize(namespace, rows[0].payload);
    }

    async set(namespace, value) {
      const safePayload = normalizeForCloudWrite(namespace, value);
      const payload = [{
        player_id: this.playerId,
        sync_token: this.effectiveSyncToken(),
        namespace,
        payload: safePayload,
        updated_at: new Date().toISOString()
      }];
      const url = `${this.url}/rest/v1/${encodeURIComponent(this.table)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          ...this.headers(),
          Prefer: "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const details = await readErrorDetails(response);
        throw new Error(`Cloud write failed (${response.status})${details ? `: ${details}` : ""}`);
      }
    }

    async getMany(namespaces) {
      const list = Array.isArray(namespaces) ? namespaces : [];
      const out = {};
      for (let i = 0; i < list.length; i += 1) {
        const ns = list[i];
        // eslint-disable-next-line no-await-in-loop
        out[ns] = await this.get(ns);
      }
      return out;
    }

    async setMany(payload) {
      const entries = Object.entries(payload || {});
      if (!entries.length) return;
      const rows = entries.map(([namespace, value]) => ({
        player_id: this.playerId,
        sync_token: this.effectiveSyncToken(),
        namespace,
        payload: normalizeForCloudWrite(namespace, value),
        updated_at: new Date().toISOString()
      }));
      const url = `${this.url}/rest/v1/${encodeURIComponent(this.table)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          ...this.headers(),
          Prefer: "resolution=merge-duplicates,return=representation"
        },
        body: JSON.stringify(rows)
      });
      if (!response.ok) {
        const details = await readErrorDetails(response);
        throw new Error(`Cloud batch write failed (${response.status})${details ? `: ${details}` : ""}`);
      }
    }
  }

  window.TVManagerStorageAdapter = {
    LocalNamespaceAdapter,
    SupabaseNamespaceAdapter
  };
})();
