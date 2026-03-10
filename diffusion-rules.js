(function diffusionRulesInit() {
  const ALWAYS_INEDIT_CATEGORIES = new Set(["information"]);
  const EPISODIC_CATEGORIES = new Set(["series", "divertissement", "magazines", "jeunesse", "realite"]);

  function isAlwaysIneditCategory(categoryId) {
    return ALWAYS_INEDIT_CATEGORIES.has(categoryId);
  }

  function isEpisodicCategory(categoryId) {
    return EPISODIC_CATEGORIES.has(categoryId);
  }

  function getTrackingKey(entry) {
    if (!entry || !entry.title) return "";
    if (isAlwaysIneditCategory(entry.categoryId)) return "";
    if (isEpisodicCategory(entry.categoryId)) {
      return `${entry.title}::S${entry.season || 1}E${entry.episode || 1}`;
    }
    return entry.title;
  }

  function resolveStatus(entry, seenSet) {
    if (!entry || !entry.title) return null;
    if (isAlwaysIneditCategory(entry.categoryId)) return "inedit";
    const key = getTrackingKey(entry);
    if (!key) return "inedit";
    const status = seenSet.has(key) ? "rediffusion" : "inedit";
    seenSet.add(key);
    return status;
  }

  function getStatusLabel(status, categoryId) {
    if (!status) return "-";
    if (status === "rediffusion") return "Rediffusion";
    if (status === "inedit" && isAlwaysIneditCategory(categoryId)) return "En direct";
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
