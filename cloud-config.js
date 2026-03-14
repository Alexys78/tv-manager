(function tvManagerCloudConfigInit() {
  const STORAGE_KEY = "tv_manager_sync_config_v1";

  function normalizeConfig(raw) {
    const cfg = raw && typeof raw === "object" ? raw : {};
    const fixedStateTable = "tv_manager_state_records";
    const defaultAdminEmails = (Array.isArray(window.TV_MANAGER_CLOUD_DEFAULTS && window.TV_MANAGER_CLOUD_DEFAULTS.adminEmails)
      ? window.TV_MANAGER_CLOUD_DEFAULTS.adminEmails
      : [])
      .map((email) => String(email || "").trim().toLowerCase())
      .filter(Boolean);
    const configuredAdminEmails = (Array.isArray(cfg.adminEmails) ? cfg.adminEmails : [])
      .map((email) => String(email || "").trim().toLowerCase())
      .filter(Boolean);
    const adminEmails = Array.from(new Set([
      ...defaultAdminEmails,
      ...configuredAdminEmails
    ]));
    const normalized = {
      url: String(cfg.url || "").trim().replace(/\/+$/, ""),
      anonKey: String(cfg.anonKey || "").trim(),
      table: fixedStateTable,
      syncToken: String(cfg.syncToken || "").trim(),
      adminEmails
    };
    if (!normalized.url || !normalized.anonKey) return null;
    return normalized;
  }

  function readStored() {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return normalizeConfig(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  function readDefaults() {
    const defaults = window.TV_MANAGER_CLOUD_DEFAULTS;
    return normalizeConfig(defaults);
  }

  function write(config) {
    const normalized = normalizeConfig(config);
    if (!normalized) throw new Error("Configuration cloud invalide.");
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function read() {
    return readStored() || readDefaults();
  }

  function clear() {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }

  const existing = read();
  if (existing && !readStored()) {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  }

  window.TVManagerCloudConfig = {
    key: STORAGE_KEY,
    read,
    write,
    clear
  };
})();
