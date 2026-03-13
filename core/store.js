(function tvManagerStoreInit() {
  const sessionUtils = window.SessionUtils;
  const schema = window.TVManagerStateSchema;
  const adapters = window.TVManagerStorageAdapter;
  if (!sessionUtils || !schema || !adapters) return;

  class PlayerStateStore {
    constructor(options) {
      const opts = options || {};
      this.session = opts.session || null;
      this.playerId = sessionUtils.getPlayerId(this.session);
      this.adapter = opts.adapter || new adapters.LocalNamespaceAdapter(this.session);
      this.cache = new Map();
      this.listeners = new Set();
      this.schemaVersion = schema.VERSION;
      this.ready = false;
    }

    emit(event, payload) {
      this.listeners.forEach((listener) => {
        try {
          listener({ event, payload, playerId: this.playerId });
        } catch {
          // ignore listener errors
        }
      });
      window.dispatchEvent(new CustomEvent("tvmanager:store", {
        detail: { event, payload, playerId: this.playerId }
      }));
    }

    subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      this.listeners.add(listener);
      return () => {
        this.listeners.delete(listener);
      };
    }

    async init(prefetchNamespaces) {
      const namespaces = Array.isArray(prefetchNamespaces) && prefetchNamespaces.length
        ? prefetchNamespaces
        : schema.listNamespaces();
      const snapshot = await this.adapter.getMany(namespaces);
      Object.entries(snapshot || {}).forEach(([ns, value]) => {
        this.cache.set(ns, schema.normalizeNamespaceValue(ns, value));
      });
      this.ready = true;
      this.emit("init", { namespaces });
      return this;
    }

    async get(namespace) {
      if (this.cache.has(namespace)) return this.cache.get(namespace);
      const value = await this.adapter.get(namespace);
      const normalized = schema.normalizeNamespaceValue(namespace, value);
      this.cache.set(namespace, normalized);
      return normalized;
    }

    async set(namespace, value) {
      const normalized = schema.normalizeNamespaceValue(namespace, value);
      await this.adapter.set(namespace, normalized);
      this.cache.set(namespace, normalized);
      this.emit("set", { namespace, value: normalized });
      return normalized;
    }

    async update(namespace, updater) {
      const current = await this.get(namespace);
      const next = typeof updater === "function" ? updater(current) : updater;
      return this.set(namespace, next);
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
      const data = payload && typeof payload === "object" ? payload : {};
      const normalized = {};
      Object.keys(data).forEach((ns) => {
        normalized[ns] = schema.normalizeNamespaceValue(ns, data[ns]);
      });
      await this.adapter.setMany(normalized);
      Object.entries(normalized).forEach(([ns, value]) => {
        this.cache.set(ns, value);
      });
      this.emit("setMany", { namespaces: Object.keys(normalized) });
      return normalized;
    }
  }

  function createLocalStore(session) {
    return new PlayerStateStore({
      session,
      adapter: new adapters.LocalNamespaceAdapter(session)
    });
  }

  function createCloudStore(session, cloudOptions) {
    const opts = cloudOptions || {};
    const playerId = sessionUtils.getPlayerId(session);
    return new PlayerStateStore({
      session,
      adapter: new adapters.SupabaseNamespaceAdapter({
        ...opts,
        playerId,
        accessToken: session && session.accessToken ? session.accessToken : "",
        legacyAuth: Boolean(session && session.legacyAuth)
      })
    });
  }

  window.TVManagerStore = {
    PlayerStateStore,
    createLocalStore,
    createCloudStore
  };
})();
