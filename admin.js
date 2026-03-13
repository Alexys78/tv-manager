(function adminApp() {
  const appKeys = (window.SessionUtils && window.SessionUtils.APP_KEYS) || {};
  const SESSION_KEY = appKeys.SESSION_KEY || "tv_manager_session";
  const LAST_EMAIL_KEY = appKeys.LAST_EMAIL_KEY || "tv_manager_last_email";
  const STUDIO_KEY_PREFIX = appKeys.STUDIO_KEY_PREFIX || "tv_manager_studio_";
  const STUDIO_SCHEDULE_KEY_PREFIX = appKeys.STUDIO_SCHEDULE_KEY_PREFIX || "tv_manager_studio_schedule_";
  const BANK_KEY_PREFIX = appKeys.BANK_KEY_PREFIX || "tv_manager_bank_";
  const DATE_GRID_KEY_PREFIX = appKeys.DATE_GRID_KEY_PREFIX || "tv_manager_date_grid_";
  const RESULTS_KEY_PREFIX = appKeys.RESULTS_KEY_PREFIX || "tv_manager_audience_results_";
  const PLAYER_REDIFF_STATS_KEY_PREFIX = appKeys.PLAYER_REDIFF_STATS_KEY_PREFIX || "tv_manager_player_rediff_stats_";
  const FINANCE_RESULTS_KEY_PREFIX = appKeys.FINANCE_RESULTS_KEY_PREFIX || "tv_manager_finance_results_";
  const FINANCE_TRANSACTIONS_KEY_PREFIX = appKeys.FINANCE_TRANSACTIONS_KEY_PREFIX || "tv_manager_finance_transactions_";
  const OWNED_KEY_PREFIX = appKeys.OWNED_KEY_PREFIX || "tv_manager_owned_programs_";
  const OWNED_DETAILS_KEY_PREFIX = appKeys.OWNED_DETAILS_KEY_PREFIX || "tv_manager_owned_program_details_";
  const DYNAMIC_FILMS_KEY_PREFIX = appKeys.DYNAMIC_FILMS_KEY_PREFIX || "tv_manager_dynamic_films_";
  const DYNAMIC_FILMS_REVISION_KEY_PREFIX = appKeys.DYNAMIC_FILMS_REVISION_KEY_PREFIX || "tv_manager_dynamic_films_revision_";
  const DYNAMIC_CATEGORY_KEY_PREFIX = appKeys.DYNAMIC_CATEGORY_KEY_PREFIX || "tv_manager_dynamic_category_";
  const DYNAMIC_CATEGORY_REVISION_KEY_PREFIX = appKeys.DYNAMIC_CATEGORY_REVISION_KEY_PREFIX || "tv_manager_dynamic_category_revision_";
  const resultsStore = window.AudienceResults;
  const bankStore = window.PlayerBank;
  const programCatalog = window.ProgramCatalog;
  const presenterEngine = window.PresenterEngine;
  const financeStore = window.FinanceEngine;
  const sessionUtils = window.SessionUtils;
  const cloudConfigApi = window.TVManagerCloudConfig;
  const coreApi = window.TVManagerCore;
  const cloudSyncApi = window.TVManagerCloudSync;
  const session = sessionUtils && typeof sessionUtils.requireSession === "function"
    ? sessionUtils.requireSession({ redirectPath: "index.html", persist: true, allowEmailParam: true, clearSearch: true })
    : null;
  if (!session) return;
  if (!sessionUtils || typeof sessionUtils.canAccessAdmin !== "function" || !sessionUtils.canAccessAdmin(session)) {
    window.location.replace("tableau-de-bord.html");
    return;
  }

  function setFeedback(message, type) {
    const feedback = document.getElementById("adminFeedback");
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = `feedback ${type}`;
  }

  function setFundsFeedback(message, type) {
    const feedback = document.getElementById("fundsFeedback");
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = `feedback ${type}`;
  }

  function setMarketFeedback(message, type) {
    const feedback = document.getElementById("marketFeedback");
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = `feedback ${type}`;
  }

  function setRecruitmentFeedback(message, type) {
    const feedback = document.getElementById("recruitmentFeedback");
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = `feedback ${type}`;
  }

  function setStudioFeedback(message, type) {
    const feedback = document.getElementById("studioFeedback");
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = `feedback ${type}`;
  }

  function setAccountFeedback(message, type) {
    const feedback = document.getElementById("accountFeedback");
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = `feedback ${type}`;
  }

  function setFinanceFeedback(message, type) {
    const feedback = document.getElementById("financeFeedback");
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = `feedback ${type}`;
  }

  function asPromise(value) {
    if (value && typeof value.then === "function") return value;
    return Promise.resolve(value);
  }

  async function forceCloudPushSilently() {
    if (!cloudSyncApi || typeof cloudSyncApi.forcePush !== "function") return;
    try {
      await cloudSyncApi.forcePush();
    } catch {
      // On conserve le succès local même si le push cloud échoue ponctuellement.
    }
  }

  function studioStateKey() {
    const playerId = session.email || session.username || "player";
    return `${STUDIO_KEY_PREFIX}${playerId}`;
  }

  function getPlayerIdsForCleanup() {
    const ids = new Set();
    if (session && typeof session.email === "string" && session.email.trim()) {
      ids.add(session.email.trim());
    }
    if (session && typeof session.username === "string" && session.username.trim()) {
      ids.add(session.username.trim());
    }
    return Array.from(ids);
  }

  function removePlayerDataFromStorage(playerId) {
    if (!playerId) return;
    const fixedKeys = [
      `${BANK_KEY_PREFIX}${playerId}`,
      `${DATE_GRID_KEY_PREFIX}${playerId}`,
      `${STUDIO_KEY_PREFIX}${playerId}`,
      `${STUDIO_SCHEDULE_KEY_PREFIX}${playerId}`,
      `${RESULTS_KEY_PREFIX}${playerId}`,
      `${FINANCE_RESULTS_KEY_PREFIX}${playerId}`,
      `${FINANCE_TRANSACTIONS_KEY_PREFIX}${playerId}`,
      `${PLAYER_REDIFF_STATS_KEY_PREFIX}${playerId}`,
      `${OWNED_KEY_PREFIX}${playerId}`,
      `${OWNED_DETAILS_KEY_PREFIX}${playerId}`,
      `${DYNAMIC_FILMS_KEY_PREFIX}${playerId}`,
      `${DYNAMIC_FILMS_REVISION_KEY_PREFIX}${playerId}`
    ];
    fixedKeys.forEach((key) => localStorage.removeItem(key));

    const dynamicPrefixes = [
      `${DYNAMIC_CATEGORY_KEY_PREFIX}${playerId}_`,
      `${DYNAMIC_CATEGORY_REVISION_KEY_PREFIX}${playerId}_`
    ];

    const runtimeStorage = window.TVManagerStorageRuntime;
    const keys = runtimeStorage && typeof runtimeStorage.keys === "function"
      ? runtimeStorage.keys()
      : (() => {
        const out = [];
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          if (key) out.push(key);
        }
        return out;
      })();

    for (let i = keys.length - 1; i >= 0; i -= 1) {
      const key = keys[i];
      if (!key) continue;
      if (dynamicPrefixes.some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key);
      }
    }
  }

  function readCloudConfig() {
    const fixedStateTable = "tv_manager_state_records";
    const fixedAccountsTable = "tv_manager_accounts";
    if (cloudConfigApi && typeof cloudConfigApi.read === "function") {
      const cfg = cloudConfigApi.read();
      if (cfg && cfg.url && cfg.anonKey) {
        return {
          url: String(cfg.url).trim().replace(/\/+$/, ""),
          anonKey: String(cfg.anonKey).trim(),
          table: fixedStateTable,
          accountsTable: fixedAccountsTable
        };
      }
    }
    return null;
  }

  function cloudHeaders(config) {
    if (!session || !session.email) {
      throw new Error("Session invalide: reconnecte-toi.");
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

  async function deleteCloudRowsByPlayerId(config, playerId) {
    const url = `${config.url}/rest/v1/${encodeURIComponent(config.table)}?player_id=eq.${encodeURIComponent(playerId)}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: cloudHeaders(config)
    });
    if (!response.ok) {
      const details = await readErrorDetails(response);
      throw new Error(`Suppression cloud impossible (${response.status})${details ? `: ${details}` : ""}`);
    }
  }

  async function deleteCloudAccountByEmail(config, email) {
    const safeEmail = String(email || "").trim().toLowerCase();
    if (!safeEmail) return;
    const url = `${config.url}/rest/v1/${encodeURIComponent(config.accountsTable)}?email=eq.${encodeURIComponent(safeEmail)}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: cloudHeaders(config)
    });
    if (!response.ok) {
      const details = await readErrorDetails(response);
      throw new Error(`Suppression compte cloud impossible (${response.status})${details ? `: ${details}` : ""}`);
    }
  }

  async function deleteAccountFromCloud() {
    const config = readCloudConfig();
    if (!config) {
      throw new Error("Configuration cloud manquante. Configure d'abord le cloud dans Admin.");
    }
    const ids = getPlayerIdsForCleanup().filter(Boolean);
    for (let i = 0; i < ids.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await deleteCloudRowsByPlayerId(config, ids[i]);
    }
    await deleteCloudAccountByEmail(config, session.email);
  }

  function formatIsoDate(isoText) {
    if (!isoText) return "-";
    const date = new Date(isoText);
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function refreshStatus() {
    const status = document.getElementById("adminStatusText");
    if (!status) return;
    if (!resultsStore) {
      status.textContent = "Le module de résultats d'audience est indisponible.";
      return;
    }
    const yesterday = resultsStore.getResultByOffset(session, -1);
    if (!yesterday) {
      status.textContent = "Aucun calcul de veille enregistré.";
      return;
    }
    status.textContent = `Dernier calcul de la veille: ${formatIsoDate(yesterday.computedAt)} (${yesterday.dayKey})`;
  }

  function refreshFinanceStatus() {
    const status = document.getElementById("financeStatusText");
    if (!status) return;
    if (!financeStore || typeof financeStore.getResultByOffset !== "function") {
      status.textContent = "Le module finance est indisponible.";
      return;
    }
    const yesterday = financeStore.getResultByOffset(session, -1);
    if (!yesterday) {
      status.textContent = "Aucun résultat financier de la veille.";
      return;
    }
    status.textContent = `Dernier résultat: ${formatIsoDate(yesterday.computedAt)} (${yesterday.dateKey})`;
  }

  const runYesterdayCalcBtn = document.getElementById("runYesterdayCalcBtn");
  if (runYesterdayCalcBtn) {
    runYesterdayCalcBtn.addEventListener("click", () => {
      if (!resultsStore) {
        setFeedback("Module de calcul indisponible.", "error");
        return;
      }
      const result = resultsStore.computeYesterdayNow(session, false);
      if (!result) {
        setFeedback("Calcul impossible pour la veille.", "error");
        return;
      }
      setFeedback("Calcul de la veille exécuté.", "success");
      refreshStatus();
      if (financeStore && typeof financeStore.computeYesterdayNow === "function") {
        financeStore.computeYesterdayNow(session, false);
        refreshFinanceStatus();
      }
    });
  }

  const forceYesterdayCalcBtn = document.getElementById("forceYesterdayCalcBtn");
  if (forceYesterdayCalcBtn) {
    forceYesterdayCalcBtn.addEventListener("click", () => {
      if (!resultsStore) {
        setFeedback("Module de calcul indisponible.", "error");
        return;
      }
      const result = resultsStore.computeYesterdayNow(session, true);
      if (!result) {
        setFeedback("Recalcul impossible pour la veille.", "error");
        return;
      }
      setFeedback("Recalcul forcé de la veille exécuté.", "success");
      refreshStatus();
      if (financeStore && typeof financeStore.computeYesterdayNow === "function") {
        financeStore.computeYesterdayNow(session, true);
        refreshFinanceStatus();
      }
    });
  }

  const runYesterdayFinanceBtn = document.getElementById("runYesterdayFinanceBtn");
  if (runYesterdayFinanceBtn) {
    runYesterdayFinanceBtn.addEventListener("click", () => {
      if (!financeStore || typeof financeStore.computeYesterdayNow !== "function") {
        setFinanceFeedback("Module finance indisponible.", "error");
        return;
      }
      const result = financeStore.computeYesterdayNow(session, false);
      if (!result) {
        setFinanceFeedback("Calcul du résultat impossible.", "error");
        return;
      }
      setFinanceFeedback("Résultat financier de la veille calculé.", "success");
      refreshFinanceStatus();
    });
  }

  const forceYesterdayFinanceBtn = document.getElementById("forceYesterdayFinanceBtn");
  if (forceYesterdayFinanceBtn) {
    forceYesterdayFinanceBtn.addEventListener("click", () => {
      if (!financeStore || typeof financeStore.computeYesterdayNow !== "function") {
        setFinanceFeedback("Module finance indisponible.", "error");
        return;
      }
      const result = financeStore.computeYesterdayNow(session, true);
      if (!result) {
        setFinanceFeedback("Recalcul financier impossible.", "error");
        return;
      }
      setFinanceFeedback("Recalcul forcé du résultat exécuté.", "success");
      refreshFinanceStatus();
    });
  }

  const addFundsBtn = document.getElementById("addFundsBtn");
  if (addFundsBtn) {
    addFundsBtn.addEventListener("click", () => {
      const input = document.getElementById("addFundsInput");
      const rawAmount = input ? String(input.value || "") : "";
      const amount = Math.round(Number(rawAmount.replace(/\s/g, "").replace(",", ".")));

      if (!Number.isFinite(amount) || amount <= 0) {
        setFundsFeedback("Montant invalide.", "error");
        return;
      }
      if (!bankStore || typeof bankStore.add !== "function") {
        setFundsFeedback("Module bancaire indisponible.", "error");
        return;
      }

      const nextBalance = bankStore.add(amount, {
        category: "ajustement_admin",
        label: "Ajout manuel de fonds"
      });
      if (input) input.value = "";
      setFundsFeedback(`+${amount.toLocaleString("fr-FR")} € ajoutés. Nouveau solde: ${nextBalance.toLocaleString("fr-FR")} €`, "success");
    });
  }

  function createCategoryRegenerateButton(category) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-btn";
    button.textContent = `Régénérer ${category.name}`;
    button.addEventListener("click", async () => {
      if (!programCatalog || typeof programCatalog.regenerateDynamicCategoryForCurrentSession !== "function") {
        setMarketFeedback("Module catalogue indisponible.", "error");
        return;
      }
      let result = null;
      try {
        result = await asPromise(programCatalog.regenerateDynamicCategoryForCurrentSession(category.id));
      } catch (error) {
        const details = error && error.message ? error.message : "Erreur pendant la régénération.";
        setMarketFeedback(details, "error");
        return;
      }
      if (!result || !result.ok) {
        setMarketFeedback(result && result.message ? result.message : "Régénération impossible.", "error");
        return;
      }
      await forceCloudPushSilently();
      setMarketFeedback(`${result.categoryName} régénéré (${result.count} programmes générés).`, "success");
    });
    return button;
  }

  function renderMarketRegenerateButtons() {
    const wrap = document.getElementById("marketRegenerateButtons");
    if (!wrap) return;
    if (!programCatalog || typeof programCatalog.getRegeneratableMarketCategories !== "function") {
      wrap.replaceChildren();
      setMarketFeedback("Module catalogue indisponible.", "error");
      return;
    }
    const categories = programCatalog.getRegeneratableMarketCategories();
    const buttons = categories
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "fr", { sensitivity: "base" }))
      .map((category) => createCategoryRegenerateButton(category));
    wrap.replaceChildren(...buttons);
  }

  function createRecruitmentRegenerateButton(item) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-btn";
    button.textContent = item.label;
    button.addEventListener("click", async () => {
      if (!presenterEngine) {
        setRecruitmentFeedback("Module recrutement indisponible.", "error");
        return;
      }
      let result = null;
      try {
        if (typeof presenterEngine.regenerateRoleMarketForCurrentSession === "function") {
          result = await asPromise(presenterEngine.regenerateRoleMarketForCurrentSession(item.id, { force: true }));
        } else if (
          item.id === "presenters"
          && typeof presenterEngine.regeneratePresentersMarketForCurrentSession === "function"
        ) {
          result = await asPromise(presenterEngine.regeneratePresentersMarketForCurrentSession({ force: true }));
        } else if (
          item.id === "journalists"
          && typeof presenterEngine.regenerateJournalistsMarketForCurrentSession === "function"
        ) {
          result = await asPromise(presenterEngine.regenerateJournalistsMarketForCurrentSession({ force: true }));
        } else if (typeof presenterEngine.regenerateMarketForCurrentSession === "function") {
          result = await asPromise(presenterEngine.regenerateMarketForCurrentSession({ force: true }));
        }
      } catch (error) {
        const details = error && error.message ? error.message : "Erreur pendant le renouvellement.";
        setRecruitmentFeedback(details, "error");
        return;
      }

      if (!result || !result.ok) {
        setRecruitmentFeedback(result && result.message ? result.message : "Renouvellement impossible.", "error");
        return;
      }
      await forceCloudPushSilently();
      setRecruitmentFeedback(`${item.successLabel} (${result.count || 0} profils disponibles).`, "success");
    });
    return button;
  }

  function renderRecruitmentRegenerateButtons() {
    const wrap = document.getElementById("recruitmentRegenerateButtons");
    if (!wrap) return;
    let items = [
      { id: "presenters", label: "Renouveler Présentateurs", successLabel: "Casting présentateurs renouvelé" },
      { id: "journalists", label: "Renouveler Journalistes", successLabel: "Casting journalistes renouvelé" }
    ];
    if (presenterEngine && typeof presenterEngine.listRolesForCurrentSession === "function") {
      const roles = presenterEngine.listRolesForCurrentSession();
      if (Array.isArray(roles) && roles.length > 0) {
        items = roles.map((role) => {
          const id = String(role && role.id ? role.id : "").trim();
          const label = String(role && role.label ? role.label : id);
          return {
            id,
            label: `Renouveler ${label}`,
            successLabel: `Casting ${label.toLowerCase()} renouvelé`
          };
        }).filter((item) => item.id);
      }
    }
    const buttons = items.map((item) => createRecruitmentRegenerateButton(item));
    wrap.replaceChildren(...buttons);
  }

  const regenerateAllMarketsBtn = document.getElementById("regenerateAllMarketsBtn");
  if (regenerateAllMarketsBtn) {
    regenerateAllMarketsBtn.addEventListener("click", async () => {
      if (!programCatalog || typeof programCatalog.regenerateAllDynamicCategoriesForCurrentSession !== "function") {
        setMarketFeedback("Module catalogue indisponible.", "error");
        return;
      }
      let result = null;
      try {
        result = await asPromise(programCatalog.regenerateAllDynamicCategoriesForCurrentSession());
      } catch (error) {
        const details = error && error.message ? error.message : "Erreur pendant la régénération globale.";
        setMarketFeedback(details, "error");
        return;
      }
      if (!result || !result.ok) {
        setMarketFeedback(result && result.message ? result.message : "Régénération globale impossible.", "error");
        return;
      }
      await forceCloudPushSilently();
      setMarketFeedback(`Marchés régénérés (${result.total} programmes générés au total).`, "success");
    });
  }

  const regenerateAllRecruitmentBtn = document.getElementById("regenerateAllRecruitmentBtn");
  if (regenerateAllRecruitmentBtn) {
    regenerateAllRecruitmentBtn.addEventListener("click", async () => {
      if (!presenterEngine) {
        setRecruitmentFeedback("Module recrutement indisponible.", "error");
        return;
      }
      let result = null;
      try {
        if (typeof presenterEngine.regenerateAllMarketsForCurrentSession === "function") {
          result = await asPromise(presenterEngine.regenerateAllMarketsForCurrentSession({ force: true }));
        } else if (typeof presenterEngine.regenerateMarketForCurrentSession === "function") {
          result = await asPromise(presenterEngine.regenerateMarketForCurrentSession({ force: true }));
        }
      } catch (error) {
        const details = error && error.message ? error.message : "Erreur pendant le renouvellement global.";
        setRecruitmentFeedback(details, "error");
        return;
      }

      if (!result || !result.ok) {
        setRecruitmentFeedback(result && result.message ? result.message : "Renouvellement global impossible.", "error");
        return;
      }
      await forceCloudPushSilently();
      setRecruitmentFeedback(
        `Recrutement global renouvelé (${result.count || 0} profils disponibles).`,
        "success"
      );
    });
  }

  const resetStudioOptionsBtn = document.getElementById("resetStudioOptionsBtn");
  if (resetStudioOptionsBtn) {
    resetStudioOptionsBtn.addEventListener("click", async () => {
      try {
        if (coreApi && typeof coreApi.createLocalStoreForCurrentPlayer === "function") {
          const localStore = coreApi.createLocalStoreForCurrentPlayer();
          await localStore.init(["studio_state", studioStateKey()]);
          await localStore.set("studio_state", {});
          await localStore.set(studioStateKey(), {});
        } else {
          localStorage.removeItem("studio_state");
          localStorage.removeItem(studioStateKey());
        }
        localStorage.removeItem("studio_state");
        localStorage.removeItem(studioStateKey());
        await forceCloudPushSilently();
        setStudioFeedback("Options du studio réinitialisées.", "success");
      } catch {
        setStudioFeedback("Impossible de réinitialiser le studio.", "error");
      }
    });
  }

  const deleteAccountBtn = document.getElementById("deleteAccountBtn");
  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener("click", async () => {
      const confirmed = window.confirm("Tu veux vraiment supprimer ce compte et toutes ses données ?");
      if (!confirmed) {
        setAccountFeedback("Suppression annulée.", "error");
        return;
      }
      const confirmedTwice = window.confirm("Cette action est irréversible. Tu confirmes la suppression ?");
      if (!confirmedTwice) {
        setAccountFeedback("Suppression annulée.", "error");
        return;
      }

      try {
        setAccountFeedback("Suppression cloud en cours...", "success");
        await deleteAccountFromCloud();
        getPlayerIdsForCleanup().forEach((id) => removePlayerDataFromStorage(id));
        if (localStorage.getItem(LAST_EMAIL_KEY) === session.email) {
          localStorage.removeItem(LAST_EMAIL_KEY);
        }
        if (sessionUtils && typeof sessionUtils.signOutSessionRemote === "function") {
          await sessionUtils.signOutSessionRemote();
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
        window.location.href = "index.html";
      } catch (error) {
        const details = error && error.message ? error.message : "Impossible de supprimer le compte.";
        setAccountFeedback(details, "error");
      }
    });
  }

  refreshStatus();
  refreshFinanceStatus();
  renderMarketRegenerateButtons();
  renderRecruitmentRegenerateButtons();
})();
