(function commonHeaderInit() {
  const sessionUtils = window.SessionUtils;
  const appKeys = (sessionUtils && sessionUtils.APP_KEYS) || {};
  const SESSION_KEY = appKeys.SESSION_KEY || "tv_manager_session";
  const LAST_EMAIL_KEY = appKeys.LAST_EMAIL_KEY || "tv_manager_last_email";
  const LOGOUT_AT_KEY = appKeys.LOGOUT_AT_KEY || "tv_manager_logout_at";
  const GRID_PUBLICATION_KEY_PREFIX = appKeys.GRID_PUBLICATION_KEY_PREFIX || "tv_manager_grid_publication_";
  const BANK_KEY_PREFIX = appKeys.BANK_KEY_PREFIX || "tv_manager_bank_";
  const NOTIF_DISMISSED_KEY_PREFIX = appKeys.NOTIF_DISMISSED_KEY_PREFIX || "tv_manager_notif_dismissed_";
  const cloudSyncApi = window.TVManagerCloudSync || null;
  const coreApi = window.TVManagerCore || null;
  const cloudConfigApi = window.TVManagerCloudConfig || null;
  let notifSyncWriteVersion = 0;

  function ensureSessionStillValid() {
    if (!sessionUtils || typeof sessionUtils.recoverSessionFromLocation !== "function") return;
    const session = sessionUtils.recoverSessionFromLocation({
      persist: false
    });
    if (!session) {
      window.location.replace("index.html");
    }
  }

  function withCurrentSession(path) {
    if (sessionUtils && typeof sessionUtils.withSession === "function") {
      return sessionUtils.withSession(path, getSession());
    }
    return path;
  }

  function createMenuLink(config, className) {
    const link = document.createElement("a");
    link.className = className || "menu-btn";
    link.textContent = String(config && config.label ? config.label : "");
    if (config && config.id) link.id = config.id;
    if (config && config.path) {
      link.href = withCurrentSession(config.path);
    }
    return link;
  }

  function getSession() {
    if (!sessionUtils || typeof sessionUtils.recoverSessionFromLocation !== "function") return null;
    return sessionUtils.recoverSessionFromLocation({ persist: false });
  }

  function todayDateKey() {
    return sessionUtils.toDateKey(new Date());
  }

  function addDaysDateKey(dateKey, days) {
    return sessionUtils.addDaysToDateKey(dateKey, days);
  }

  function formatEuro(value) {
    return sessionUtils.formatEuro(value);
  }

  function formatSyncLabel(state) {
    const status = state && state.status ? state.status : "idle";
    if (status === "synced") return { text: "Synchronisé", css: "sync-synced" };
    if (status === "pending") return { text: "En attente", css: "sync-pending" };
    if (status === "syncing") return { text: "Sync...", css: "sync-syncing" };
    if (status === "error") return { text: "Erreur sync", css: "sync-error" };
    return { text: "Sync off", css: "sync-off" };
  }

  function renderSyncBadge(target) {
    if (!target) return;
    const state = cloudSyncApi && typeof cloudSyncApi.getSyncState === "function"
      ? cloudSyncApi.getSyncState()
      : null;
    const badge = formatSyncLabel(state);
    target.textContent = badge.text;
    target.className = `sync-state-badge ${badge.css}`;
    if (state && state.lastErrorMessage && state.status === "error") {
      target.title = state.lastErrorMessage;
    } else if (state && state.lastSuccessAt) {
      target.title = `Dernière sync: ${new Date(state.lastSuccessAt).toLocaleString("fr-FR")}`;
    } else {
      target.title = "Statut de synchronisation cloud";
    }
  }

  function notificationsStorageKey(session) {
    const playerId = sessionUtils && typeof sessionUtils.getPlayerId === "function"
      ? sessionUtils.getPlayerId(session)
      : (session && (session.email || session.username)) || "player";
    return `${NOTIF_DISMISSED_KEY_PREFIX}${playerId}`;
  }

  function readDismissedNotifications(session) {
    try {
      const raw = localStorage.getItem(notificationsStorageKey(session));
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeDismissedNotifications(session, payload) {
    const safePayload = payload && typeof payload === "object" ? payload : {};
    const storageKey = notificationsStorageKey(session);
    const writeVersion = (notifSyncWriteVersion += 1);
    try {
      localStorage.setItem(storageKey, JSON.stringify(safePayload));
    } catch {
      // ignore storage errors
    }
    syncDismissedNotificationsToCloud(safePayload, storageKey, writeVersion);
  }

  async function syncDismissedNotificationsToCloud(payload, storageKey, writeVersion) {
    try {
      if (!coreApi || typeof coreApi.createCloudStoreForCurrentPlayer !== "function") return;
      const config = cloudConfigApi && typeof cloudConfigApi.read === "function"
        ? cloudConfigApi.read()
        : null;
      if (!config || !config.url || !config.anonKey) return;
      const cloudStore = coreApi.createCloudStoreForCurrentPlayer({
        url: config.url,
        anonKey: config.anonKey,
        syncToken: config.syncToken || "",
        table: config.table || "tv_manager_state_records"
      });
      await cloudStore.set("notifications_dismissed", payload);
      if (writeVersion !== notifSyncWriteVersion) return;
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // keep local value; background cloud sync can retry later
    }
  }

  function readGridPublicationMap(session) {
    if (!session) return {};
    const playerId = sessionUtils && typeof sessionUtils.getPlayerId === "function"
      ? sessionUtils.getPlayerId(session)
      : (session.email || session.username || "player");
    try {
      const raw = localStorage.getItem(`${GRID_PUBLICATION_KEY_PREFIX}${playerId}`);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function readBankBalance(session) {
    if (!session) return 500000;
    const playerId = sessionUtils && typeof sessionUtils.getPlayerId === "function"
      ? sessionUtils.getPlayerId(session)
      : (session.email || session.username || "player");
    const raw = localStorage.getItem(`${BANK_KEY_PREFIX}${playerId}`);
    const value = Number(raw);
    return Number.isFinite(value) ? value : 500000;
  }

  function buildNotifications(session) {
    if (!session) return [];
    const notifications = [];
    const today = todayDateKey();
    const tomorrow = addDaysDateKey(today, 1);
    const publication = readGridPublicationMap(session);
    const todayPublished = Boolean(publication[today]);
    const tomorrowPublished = Boolean(publication[tomorrow]);
    const balance = readBankBalance(session);

    if (!todayPublished) {
      notifications.push({
        id: `publish-today-${today}`,
        level: "warning",
        message: "Attention, la grille d'aujourd'hui n'est pas publiée."
      });
    }
    if (!tomorrowPublished) {
      notifications.push({
        id: `publish-tomorrow-${tomorrow}`,
        level: "info",
        message: "Pense à publier la grille de demain."
      });
    }
    if (balance < 100000) {
      notifications.push({
        id: `low-bank-${today}`,
        level: "warning",
        message: `Solde faible: ${formatEuro(balance)}.`
      });
    }

    return notifications;
  }

  function createNotificationsMenu(session) {
    const group = document.createElement("div");
    group.className = "notif-group";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.id = "notificationsBtn";
    trigger.className = "menu-btn notif-icon-btn";
    trigger.setAttribute("aria-haspopup", "true");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", "Notifications");
    trigger.title = "Notifications";

    const bellIcon = document.createElement("img");
    bellIcon.className = "notif-icon";
    bellIcon.src = "images/bell-icon.svg";
    bellIcon.alt = "";
    bellIcon.decoding = "async";
    trigger.appendChild(bellIcon);

    const panel = document.createElement("div");
    panel.className = "notif-panel";

    const head = document.createElement("div");
    head.className = "notif-head";
    const headTitle = document.createElement("strong");
    headTitle.textContent = "Notifications";
    const clearAllBtn = document.createElement("button");
    clearAllBtn.type = "button";
    clearAllBtn.className = "secondary-btn notif-clear-btn";
    clearAllBtn.textContent = "Tout supprimer";
    head.append(headTitle, clearAllBtn);

    const list = document.createElement("div");
    list.className = "notif-list";
    panel.append(head, list);

    function renderList() {
      const dismissed = readDismissedNotifications(session);
      const all = buildNotifications(session);
      const visible = all.filter((item) => !dismissed[item.id]);
      const countBadge = trigger.querySelector(".notif-count");
      if (countBadge) countBadge.remove();
      if (visible.length > 0) {
        const badge = document.createElement("span");
        badge.className = "notif-count";
        badge.textContent = String(visible.length);
        trigger.appendChild(badge);
      }

      clearAllBtn.disabled = visible.length === 0;
      list.replaceChildren();
      if (visible.length === 0) {
        const empty = document.createElement("p");
        empty.className = "notif-empty";
        empty.textContent = "Aucune notification.";
        list.appendChild(empty);
        return;
      }

      const rows = visible.map((item) => {
        const row = document.createElement("article");
        row.className = `notif-item ${item.level || "info"}`.trim();
        const text = document.createElement("p");
        text.textContent = item.message;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "notif-remove";
        remove.setAttribute("aria-label", "Supprimer la notification");
        remove.title = "Supprimer";
        remove.textContent = "×";
        remove.addEventListener("click", () => {
          const next = readDismissedNotifications(session);
          next[item.id] = new Date().toISOString();
          writeDismissedNotifications(session, next);
          renderList();
        });
        row.append(text, remove);
        return row;
      });
      list.append(...rows);
    }

    clearAllBtn.addEventListener("click", () => {
      const all = buildNotifications(session);
      const next = readDismissedNotifications(session);
      all.forEach((item) => {
        next[item.id] = new Date().toISOString();
      });
      writeDismissedNotifications(session, next);
      renderList();
    });

    function closeMenu() {
      group.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
    }

    function openMenu() {
      renderList();
      group.classList.add("open");
      trigger.setAttribute("aria-expanded", "true");
    }

    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (group.classList.contains("open")) closeMenu();
      else openMenu();
    });

    document.addEventListener("click", (event) => {
      if (!group.contains(event.target)) closeMenu();
    });

    renderList();
    group.append(trigger, panel);
    return group;
  }

  function createMenuButton(config, activePage) {
    const isActive = config.page === activePage;
    const button = createMenuLink(config, `menu-btn ${isActive ? "active-menu" : ""}`.trim());
    if (isActive) {
      button.removeAttribute("href");
      button.setAttribute("aria-current", "page");
      return button;
    }
    return button;
  }

  function createDropdownMenu(label, entries, activePage) {
    const safeEntries = Array.isArray(entries) ? entries : [];
    const isGroupActive = safeEntries.some((entry) => entry && entry.page === activePage);
    const group = document.createElement("div");
    group.className = "menu-group";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = `menu-btn ${isGroupActive ? "active-menu" : ""}`.trim();
    trigger.textContent = String(label || "Menu");
    trigger.setAttribute("aria-haspopup", "true");
    trigger.setAttribute("aria-expanded", "false");

    const submenu = document.createElement("div");
    submenu.className = "menu-sub";
    const subButtons = safeEntries.map((entry) => {
      const isActive = Boolean(entry && entry.page === activePage);
      const button = createMenuLink(entry, `menu-btn menu-sub-btn ${isActive ? "active-menu" : ""}`.trim());
      if (isActive) {
        button.removeAttribute("href");
        button.setAttribute("aria-current", "page");
      }
      return button;
    });
    submenu.append(...subButtons);

    function closeMenu() {
      group.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
    }

    function openMenu() {
      group.classList.add("open");
      trigger.setAttribute("aria-expanded", "true");
    }

    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (group.classList.contains("open")) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    group.addEventListener("mouseenter", openMenu);
    group.addEventListener("mouseleave", closeMenu);

    subButtons.forEach((button) => {
      button.addEventListener("click", closeMenu);
    });

    document.addEventListener("click", (event) => {
      if (!group.contains(event.target)) closeMenu();
    });

    group.append(trigger, submenu);
    return group;
  }

  function buildHeader(activePage) {
    const wrapper = document.createElement("div");
    wrapper.className = "site-header";

    const topRow = document.createElement("div");
    topRow.className = "header-main";

    const brand = document.createElement("div");
    brand.className = "site-brand";
    const logo = document.createElement("img");
    logo.className = "site-brand-logo";
    logo.src = "images/logo.png";
    logo.alt = "TV Manager";
    logo.decoding = "async";
    logo.addEventListener("error", () => {
      brand.textContent = "TV Manager";
    });
    brand.appendChild(logo);

    const bank = document.createElement("span");
    bank.className = "bank-badge";
    bank.setAttribute("data-bank-balance", "");
    bank.textContent = "Compte: 500 000 €";

    const actions = document.createElement("div");
    actions.className = "header-actions";

    const syncBadge = document.createElement("span");
    syncBadge.id = "syncStateBadge";
    syncBadge.className = "sync-state-badge sync-off";
    syncBadge.textContent = "Sync off";
    renderSyncBadge(syncBadge);

    const notifications = createNotificationsMenu(getSession());

    const logout = document.createElement("button");
    logout.type = "button";
    logout.id = "logoutBtn";
    logout.className = "menu-btn logout-icon-btn";
    logout.setAttribute("aria-label", "Déconnexion");
    logout.title = "Déconnexion";
    const logoutIcon = document.createElement("img");
    logoutIcon.className = "logout-icon";
    logoutIcon.src = "images/logout-icon.svg";
    logoutIcon.alt = "";
    logoutIcon.decoding = "async";
    logout.appendChild(logoutIcon);
    logout.addEventListener("click", () => {
      localStorage.setItem(LOGOUT_AT_KEY, new Date().toISOString());
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(LAST_EMAIL_KEY);
      window.location.replace("index.html");
    });

    actions.append(syncBadge, notifications, logout);

    topRow.append(brand, bank, actions);

    const menu = document.createElement("nav");
    menu.className = "top-menu";

    const dashboard = { page: "dashboard", id: "backHomeBtn", label: "Tableau de bord", path: "game.html" };
    const admin = { page: "admin", id: "openAdminBtn", label: "Admin", path: "admin.html" };
    const pilotageEntries = [
      { page: "audiences", id: "openAudiencesBtn", label: "Audiences", path: "audiences.html" },
      { page: "finance", id: "openFinanceBtn", label: "Finance", path: "finance.html" },
      { page: "ad-regie", id: "openAdRegieBtn", label: "Régie pub", path: "regie-pub.html" }
    ];
    const contenusEntries = [
      { page: "planner", id: "openPlannerBtn", label: "Grille TV", path: "planner.html" },
      { page: "studio", id: "openStudioBtn", label: "Studio TV", path: "studio.html" },
      { page: "market", id: "openMarketBtn", label: "Marché des programmes", path: "market.html" },
      { page: "owned", id: "openOwnedBtn", label: "Vos programmes", path: "owned.html" }
    ];
    const personnelsEntries = [
      { page: "personnel-owned", id: "openPersonnelBtn", label: "Mon personnel", path: "personnel.html" },
      { page: "personnel-recruitment", id: "openRecruitmentBtn", label: "Recrutement", path: "presenters.html" }
    ];

    menu.append(
      createMenuButton(dashboard, activePage),
      createDropdownMenu("Pilotage", pilotageEntries, activePage),
      createDropdownMenu("Contenus", contenusEntries, activePage),
      createDropdownMenu("Personnels", personnelsEntries, activePage),
      createMenuButton(admin, activePage)
    );
    wrapper.append(topRow, menu);
    return wrapper;
  }

  const host = document.getElementById("appHeader");
  if (!host) return;
  ensureSessionStillValid();
  window.addEventListener("pageshow", ensureSessionStillValid);
  const activePage = host.dataset.activePage || "";
  host.replaceChildren(buildHeader(activePage));
  const syncBadge = document.getElementById("syncStateBadge");
  if (syncBadge) {
    window.addEventListener("tvmanager:cloud-sync-state", (event) => {
      const detail = event && event.detail ? event.detail : {};
      const state = detail.state || null;
      const badge = formatSyncLabel(state);
      syncBadge.textContent = badge.text;
      syncBadge.className = `sync-state-badge ${badge.css}`;
      if (state && state.lastErrorMessage && state.status === "error") {
        syncBadge.title = state.lastErrorMessage;
      } else if (state && state.lastSuccessAt) {
        syncBadge.title = `Dernière sync: ${new Date(state.lastSuccessAt).toLocaleString("fr-FR")}`;
      }
    });
    renderSyncBadge(syncBadge);
  }
})();
