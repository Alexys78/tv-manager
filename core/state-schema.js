(function tvManagerStateSchemaInit() {
  const VERSION = 1;

  const DEFAULTS = Object.freeze({
    bank_balance: 500000,
    date_grid: {},
    grid_publication: {},
    audience_results: {},
    finance_results: {},
    finance_transactions: [],
    owned_titles: [],
    owned_details: {},
    studio_state: {},
    studio_schedule: [],
    presenters: { hired: [], market: [], revision: 0 },
    ad_settings: {},
    ad_slot_plan: {},
    rediff_stats: {},
    dynamic_films: [],
    dynamic_films_revision: 0,
    dynamic_categories: {},
    dynamic_categories_revision: {},
    notifications_dismissed: {}
  });

  function cloneDefault(value) {
    if (Array.isArray(value)) return value.slice();
    if (value && typeof value === "object") return { ...value };
    return value;
  }

  function defaultFor(namespace) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULTS, namespace)) return null;
    return cloneDefault(DEFAULTS[namespace]);
  }

  function listNamespaces() {
    return Object.keys(DEFAULTS);
  }

  function normalizeNamespaceValue(namespace, value) {
    const fallback = defaultFor(namespace);
    if (fallback === null) return value;

    if (typeof fallback === "number") {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : fallback;
    }

    if (Array.isArray(fallback)) {
      return Array.isArray(value) ? value : fallback;
    }

    if (fallback && typeof fallback === "object") {
      return value && typeof value === "object" ? value : fallback;
    }

    return value == null ? fallback : value;
  }

  window.TVManagerStateSchema = {
    VERSION,
    DEFAULTS,
    defaultFor,
    listNamespaces,
    normalizeNamespaceValue
  };
})();
