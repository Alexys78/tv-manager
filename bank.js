(function bankInit() {
  const DEFAULT_BALANCE = 2000000;
  const sessionUtils = window.SessionUtils;
  const appKeys = (sessionUtils && sessionUtils.APP_KEYS) || {};
  const BANK_KEY_PREFIX = appKeys.BANK_KEY_PREFIX || "tv_manager_bank_";
  const coreApi = window.TVManagerCore;
  const cloudSyncApi = window.TVManagerCloudSync;
  const STATE_RECORDS_TABLE = "tv_manager_state_records";
  let mirrorBankTimer = null;
  let pendingMirrorBalance = null;

  function formatEuro(value) {
    return sessionUtils.formatEuro(value);
  }

  async function forceCloudPushBestEffort() {
    if (!cloudSyncApi || typeof cloudSyncApi.forcePush !== "function") return;
    try {
      await cloudSyncApi.forcePush();
    } catch {
      // Best effort only.
    }
  }

  function scheduleCriticalCloudPush() {
    setTimeout(() => {
      forceCloudPushBestEffort();
    }, 0);
  }

  function keyForSession(session) {
    const id = session.email || session.username || "player";
    return `${BANK_KEY_PREFIX}${id}`;
  }

  function getBalance(session) {
    const key = keyForSession(session);
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return DEFAULT_BALANCE;
    }
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      return DEFAULT_BALANCE;
    }
    return value;
  }

  function setBalance(session, amount) {
    const next = Math.max(0, Math.round(Number(amount) || 0));
    localStorage.setItem(keyForSession(session), String(next));
    mirrorBankToStateRecords(next);
    scheduleCriticalCloudPush();
    return next;
  }

  function getStateRecordsCloudStore() {
    if (!coreApi || typeof coreApi.createCloudStoreForCurrentPlayer !== "function") return null;
    if (!cloudSyncApi || typeof cloudSyncApi.getConfig !== "function") return null;
    const config = cloudSyncApi.getConfig();
    if (!config || !config.url || !config.anonKey) return null;
    return coreApi.createCloudStoreForCurrentPlayer({
      url: config.url,
      anonKey: config.anonKey,
      syncToken: config.syncToken || "",
      table: STATE_RECORDS_TABLE
    });
  }

  function mirrorBankToStateRecords(balanceValue) {
    pendingMirrorBalance = Number(balanceValue) || DEFAULT_BALANCE;
    if (mirrorBankTimer) clearTimeout(mirrorBankTimer);
    mirrorBankTimer = setTimeout(async () => {
      mirrorBankTimer = null;
      try {
        const store = getStateRecordsCloudStore();
        if (!store) return;
        await store.set("bank_balance", pendingMirrorBalance);
      } catch {
        // Best effort mirror only.
      }
    }, 500);
  }

  function renderBalance(session) {
    const value = getBalance(session);
    const formatted = formatEuro(value);
    document.querySelectorAll("[data-bank-balance]").forEach((node) => {
      node.textContent = `Compte: ${formatted}`;
    });
  }

  const session = sessionUtils && typeof sessionUtils.requireSession === "function"
    ? sessionUtils.requireSession({ redirectPath: false, persist: true, allowEmailParam: true, clearSearch: false })
    : null;
  if (!session) return;
  renderBalance(session);
  if (typeof window.addEventListener === "function") {
    window.addEventListener("tvmanager:cloud-sync", (event) => {
      const detail = event && event.detail ? event.detail : null;
      if (!detail || !detail.ok || detail.mode !== "pull") return;
      renderBalance(session);
    });
  }

  window.PlayerBank = {
    defaultBalance: DEFAULT_BALANCE,
    getBalance: function getCurrentBalance() {
      return getBalance(session);
    },
    setBalance: function updateBalance(amount) {
      const next = setBalance(session, amount);
      renderBalance(session);
      return next;
    },
    add: function addAmount(delta, meta) {
      const amount = Number(delta) || 0;
      const next = setBalance(session, getBalance(session) + amount);
      renderBalance(session);
      const opts = meta && typeof meta === "object" ? meta : {};
      if (amount !== 0 && opts.record !== false) {
        const finance = window.FinanceEngine;
        if (finance && typeof finance.recordTransaction === "function") {
          finance.recordTransaction(session, {
            amount,
            category: String(opts.category || "autre"),
            label: String(opts.label || ""),
            dateKey: typeof opts.dateKey === "string" ? opts.dateKey : null
          });
        }
      }
      scheduleCriticalCloudPush();
      return next;
    },
    refresh: function refreshDisplay() {
      renderBalance(session);
    }
  };
})();
