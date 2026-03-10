(function diffusionRulesInit() {
  const ALWAYS_INEDIT_CATEGORIES = new Set(["information"]);
  const EPISODIC_CATEGORIES = new Set(["series", "divertissement", "magazines", "jeunesse", "realite"]);
  const programCatalog = window.ProgramCatalog;

  function resolveProductionMode(entry) {
    if (!entry) return "";
    const explicit = String(entry.productionMode || "").trim().toLowerCase();
    if (explicit === "direct" || explicit === "recorded") return explicit;
    if (!programCatalog || typeof programCatalog.getProgramMeta !== "function" || !entry.title) return "";
    const meta = programCatalog.getProgramMeta(String(entry.title || ""));
    if (!meta) return "";
    const fromMeta = String(meta.productionMode || "").trim().toLowerCase();
    if (fromMeta === "direct" || fromMeta === "recorded") return fromMeta;
    if (String(entry.categoryId || "") === "information") return "direct";
    return "";
  }

  function isAlwaysIneditCategory(categoryId) {
    return ALWAYS_INEDIT_CATEGORIES.has(categoryId);
  }

  function isEpisodicCategory(categoryId) {
    return EPISODIC_CATEGORIES.has(categoryId);
  }

  function getTrackingKey(entry) {
    if (!entry || !entry.title) return "";
    if (resolveProductionMode(entry) === "direct") return "";
    if (isAlwaysIneditCategory(entry.categoryId)) return "";
    if (isEpisodicCategory(entry.categoryId)) {
      return `${entry.title}::S${entry.season || 1}E${entry.episode || 1}`;
    }
    return entry.title;
  }

  function resolveStatus(entry, seenSet) {
    if (!entry || !entry.title) return null;
    const mode = resolveProductionMode(entry);
    if (mode === "direct") return "direct";
    if (isAlwaysIneditCategory(entry.categoryId)) return "inedit";
    const key = getTrackingKey(entry);
    if (!key) return "inedit";
    const status = seenSet.has(key) ? "rediffusion" : "inedit";
    seenSet.add(key);
    return status;
  }

  function getStatusLabel(status, categoryId) {
    if (!status) return "-";
    if (status === "direct") return "En direct";
    if (status === "rediffusion") return "Rediffusion";
    return "Inédit";
  }

  window.DiffusionRules = {
    isAlwaysIneditCategory,
    isEpisodicCategory,
    getTrackingKey,
    resolveStatus,
    getStatusLabel
  };
})();
