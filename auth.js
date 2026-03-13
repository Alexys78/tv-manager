(function authApp() {
  const REGISTRATION_OPEN = true;
  const ACCOUNTS_TABLE = "tv_manager_accounts";
  const MIN_USERNAME_LENGTH = 3;
  const MIN_PASSWORD_LENGTH = 8;
  const PBKDF2_ITERATIONS = 210000;
  const PBKDF2_KEY_LENGTH = 32;
  const LOGIN_RATE_KEY = "tv_manager_login_rate_v1";
  const MAX_LOGIN_ATTEMPTS = 6;
  const LOGIN_WINDOW_MS = 5 * 60 * 1000;
  const LOGIN_LOCK_MS = 10 * 60 * 1000;

  const cloudConfigApi = window.TVManagerCloudConfig;
  const sessionUtils = window.SessionUtils;

  function setFeedback(message, type) {
    const feedback = document.getElementById("feedback");
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = `feedback ${type || ""}`.trim();
  }

  function setUsernameFeedback(message, type) {
    const feedback = document.getElementById("usernameFeedback");
    if (!feedback) return;
    feedback.textContent = message || "";
    feedback.className = `feedback ${type || ""}`.trim();
  }

  function nowMs() {
    return Date.now();
  }

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function normalizeUsernameKey(username) {
    return String(username || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
  }

  function sanitizeUsername(username, fallbackEmail) {
    const cleaned = String(username || "")
      .replace(/[<>]/g, "")
      .replace(/[%_*]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
    if (cleaned) return cleaned;
    const safeFallback = String(fallbackEmail || "")
      .replace(/[<>]/g, "")
      .replace(/[%_*]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
    return safeFallback || "joueur";
  }

  function readCloudConfig() {
    if (cloudConfigApi && typeof cloudConfigApi.read === "function") {
      const cfg = cloudConfigApi.read();
      if (cfg && cfg.url && cfg.anonKey) {
        return {
          url: String(cfg.url).trim().replace(/\/+$/, ""),
          anonKey: String(cfg.anonKey).trim(),
          adminEmails: Array.isArray(cfg.adminEmails)
            ? cfg.adminEmails.map((email) => normalizeEmail(email)).filter(Boolean)
            : []
        };
      }
    }
    return null;
  }

  function isAdminEmail(config, email) {
    const admins = (config && Array.isArray(config.adminEmails)) ? config.adminEmails : [];
    return admins.includes(normalizeEmail(email));
  }

  function cloudHeaders(config) {
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
          if (parsed.details) return String(parsed.details);
        }
      } catch {
        // fallback on raw text
      }
      return String(text).slice(0, 260);
    } catch {
      return "";
    }
  }

  async function cloudFetchAccountByEmail(config, email) {
    const url = `${config.url}/rest/v1/${encodeURIComponent(ACCOUNTS_TABLE)}?email=eq.${encodeURIComponent(email)}&select=username,email,password_hash,created_at,updated_at&limit=1`;
    const response = await fetch(url, { method: "GET", headers: cloudHeaders(config) });
    if (!response.ok) {
      const details = await readErrorDetails(response);
      throw new Error(`Lecture comptes impossible (${response.status})${details ? `: ${details}` : ""}`);
    }
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.length) return null;
    return rows[0];
  }

  async function cloudFetchAccountByUsername(config, username) {
    const safeUsername = sanitizeUsername(username, "");
    const url = `${config.url}/rest/v1/${encodeURIComponent(ACCOUNTS_TABLE)}?username=ilike.${encodeURIComponent(safeUsername)}&select=username,email&limit=5`;
    const response = await fetch(url, { method: "GET", headers: cloudHeaders(config) });
    if (!response.ok) {
      const details = await readErrorDetails(response);
      throw new Error(`Lecture pseudo impossible (${response.status})${details ? `: ${details}` : ""}`);
    }
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.length) return null;
    const target = normalizeUsernameKey(safeUsername);
    return rows.find((row) => normalizeUsernameKey(row && row.username) === target) || null;
  }

  async function cloudInsertAccount(config, payload) {
    const url = `${config.url}/rest/v1/${encodeURIComponent(ACCOUNTS_TABLE)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...cloudHeaders(config),
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify([{
        username: payload.username,
        email: payload.email,
        password_hash: payload.passwordHash,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
    });
    if (!response.ok) {
      const details = await readErrorDetails(response);
      throw new Error(`Création compte impossible (${response.status})${details ? `: ${details}` : ""}`);
    }
    const rows = await response.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  }

  async function cloudUpdateAccountPasswordHash(config, email, passwordHash) {
    const url = `${config.url}/rest/v1/${encodeURIComponent(ACCOUNTS_TABLE)}?email=eq.${encodeURIComponent(email)}`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: cloudHeaders(config),
      body: JSON.stringify({
        password_hash: passwordHash,
        updated_at: new Date().toISOString()
      })
    });
    if (!response.ok) {
      const details = await readErrorDetails(response);
      throw new Error(`Mise à jour mot de passe impossible (${response.status})${details ? `: ${details}` : ""}`);
    }
  }

  function toBase64Url(uint8Array) {
    let binary = "";
    for (let i = 0; i < uint8Array.length; i += 1) binary += String.fromCharCode(uint8Array[i]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function fromBase64Url(value) {
    const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "===".slice((normalized.length + 3) % 4);
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  }

  function constantTimeEqualBytes(a, b) {
    if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) return false;
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i += 1) diff |= (a[i] ^ b[i]);
    return diff === 0;
  }

  function constantTimeEqualString(a, b) {
    const left = String(a || "");
    const right = String(b || "");
    if (left.length !== right.length) return false;
    let diff = 0;
    for (let i = 0; i < left.length; i += 1) diff |= (left.charCodeAt(i) ^ right.charCodeAt(i));
    return diff === 0;
  }

  async function derivePbkdf2Hash(password, saltBytes, iterations, keyLength) {
    if (!window.crypto || !window.crypto.subtle || typeof TextEncoder !== "function") {
      throw new Error("WebCrypto indisponible.");
    }
    const encoder = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      "raw",
      encoder.encode(String(password || "")),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await window.crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations },
      keyMaterial,
      keyLength * 8
    );
    return new Uint8Array(bits);
  }

  async function createPasswordHash(password) {
    if (!window.crypto || !window.crypto.getRandomValues) {
      throw new Error("WebCrypto indisponible.");
    }
    const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
    const hashBytes = await derivePbkdf2Hash(password, saltBytes, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH);
    return `pbkdf2$sha256$${PBKDF2_ITERATIONS}$${toBase64Url(saltBytes)}$${toBase64Url(hashBytes)}`;
  }

  async function legacySha256Hash(password) {
    if (!window.crypto || !window.crypto.subtle || typeof TextEncoder !== "function") {
      return `legacy:${String(password || "")}`;
    }
    const data = new TextEncoder().encode(String(password || ""));
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    const bytes = Array.from(new Uint8Array(digest));
    const hex = bytes.map((value) => value.toString(16).padStart(2, "0")).join("");
    return `sha256:${hex}`;
  }

  async function verifyPassword(password, storedHash) {
    const value = String(storedHash || "");
    if (!value) return { ok: false, needsUpgrade: false };

    if (value.startsWith("pbkdf2$")) {
      const parts = value.split("$");
      if (parts.length !== 5) return { ok: false, needsUpgrade: false };
      const algo = parts[1];
      const iterations = Number(parts[2]);
      if (algo !== "sha256" || !Number.isFinite(iterations) || iterations < 50000) {
        return { ok: false, needsUpgrade: false };
      }
      try {
        const saltBytes = fromBase64Url(parts[3]);
        const expected = fromBase64Url(parts[4]);
        const computed = await derivePbkdf2Hash(password, saltBytes, iterations, expected.length || PBKDF2_KEY_LENGTH);
        return { ok: constantTimeEqualBytes(computed, expected), needsUpgrade: false };
      } catch {
        return { ok: false, needsUpgrade: false };
      }
    }

    if (value.startsWith("sha256:")) {
      const computed = await legacySha256Hash(password);
      return { ok: constantTimeEqualString(computed, value), needsUpgrade: true };
    }

    if (value.startsWith("legacy:")) {
      return { ok: constantTimeEqualString(`legacy:${String(password || "")}`, value), needsUpgrade: true };
    }

    return { ok: false, needsUpgrade: false };
  }

  function createLegacySession(account, config) {
    const email = normalizeEmail(account && account.email);
    const username = sanitizeUsername(account && account.username, "joueur");
    const sessionData = {
      username,
      email,
      connectedAt: new Date().toISOString(),
      isAdmin: isAdminEmail(config, email),
      legacyAuth: true,
      accessToken: "",
      refreshToken: "",
      tokenType: "bearer",
      expiresAt: null
    };
    if (sessionUtils && typeof sessionUtils.persistSession === "function") {
      return sessionUtils.persistSession(sessionData);
    }
    localStorage.setItem("tv_manager_session", JSON.stringify(sessionData));
    localStorage.setItem("tv_manager_last_email", email);
    return sessionData;
  }

  function readRateMap() {
    try {
      const raw = sessionStorage.getItem(LOGIN_RATE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeRateMap(map) {
    try {
      sessionStorage.setItem(LOGIN_RATE_KEY, JSON.stringify(map || {}));
    } catch {
      // ignore quota edge cases
    }
  }

  function getRateState(email) {
    const safeEmail = normalizeEmail(email);
    if (!safeEmail) return null;
    const map = readRateMap();
    const current = map[safeEmail];
    if (!current || typeof current !== "object") return { attempts: [] };
    const attempts = Array.isArray(current.attempts)
      ? current.attempts.map((value) => Number(value)).filter((value) => Number.isFinite(value))
      : [];
    const lockUntil = Number(current.lockUntil);
    return {
      attempts,
      lockUntil: Number.isFinite(lockUntil) ? lockUntil : 0
    };
  }

  function isLoginLocked(email) {
    const state = getRateState(email);
    if (!state) return null;
    if (!state.lockUntil || state.lockUntil <= nowMs()) return null;
    return state.lockUntil;
  }

  function markLoginFailure(email) {
    const safeEmail = normalizeEmail(email);
    if (!safeEmail) return;
    const map = readRateMap();
    const current = getRateState(safeEmail) || { attempts: [], lockUntil: 0 };
    const threshold = nowMs() - LOGIN_WINDOW_MS;
    const attempts = current.attempts.filter((value) => value >= threshold);
    attempts.push(nowMs());
    const locked = attempts.length >= MAX_LOGIN_ATTEMPTS ? nowMs() + LOGIN_LOCK_MS : 0;
    map[safeEmail] = { attempts, lockUntil: locked };
    writeRateMap(map);
  }

  function clearLoginFailures(email) {
    const safeEmail = normalizeEmail(email);
    if (!safeEmail) return;
    const map = readRateMap();
    delete map[safeEmail];
    writeRateMap(map);
  }

  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    const usernameInput = document.getElementById("username");
    let usernameCheckTimer = null;
    let usernameCheckSeq = 0;
    let lastUsernameCheck = { value: "", available: null };

    async function checkUsernameAvailability(rawUsername, options) {
      const opts = options && typeof options === "object" ? options : {};
      const config = readCloudConfig();
      if (!config) {
        if (!opts.silent) setUsernameFeedback("Configuration cloud manquante.", "error");
        return null;
      }
      const username = sanitizeUsername(rawUsername, "");
      if (username.length < MIN_USERNAME_LENGTH) {
        if (!opts.silent) setUsernameFeedback(`Pseudo: ${MIN_USERNAME_LENGTH} caractères minimum.`, "error");
        return null;
      }
      const existing = await cloudFetchAccountByUsername(config, username);
      const available = !existing;
      lastUsernameCheck = { value: normalizeUsernameKey(username), available };
      if (!opts.silent) {
        if (available) {
          setUsernameFeedback("Pseudo disponible.", "success");
        } else {
          setUsernameFeedback("Pseudo déjà pris.", "error");
        }
      }
      return available;
    }

    if (!REGISTRATION_OPEN) {
      registerForm.querySelectorAll("input, button, select, textarea").forEach((field) => {
        field.disabled = true;
      });
      setFeedback("Les inscriptions sont fermées.", "error");
    }

    if (usernameInput) {
      usernameInput.addEventListener("input", () => {
        const username = sanitizeUsername(usernameInput.value, "");
        if (usernameCheckTimer) {
          clearTimeout(usernameCheckTimer);
          usernameCheckTimer = null;
        }
        if (username.length < MIN_USERNAME_LENGTH) {
          lastUsernameCheck = { value: "", available: null };
          setUsernameFeedback(`Pseudo: ${MIN_USERNAME_LENGTH} caractères minimum.`, "error");
          return;
        }
        setUsernameFeedback("Vérification du pseudo...", "");
        const seq = ++usernameCheckSeq;
        usernameCheckTimer = setTimeout(async () => {
          try {
            const available = await checkUsernameAvailability(username, { silent: true });
            if (seq !== usernameCheckSeq) return;
            if (available === true) setUsernameFeedback("Pseudo disponible.", "success");
            else if (available === false) setUsernameFeedback("Pseudo déjà pris.", "error");
          } catch {
            if (seq !== usernameCheckSeq) return;
            setUsernameFeedback("Vérification pseudo impossible.", "error");
          }
        }, 280);
      });
    }

    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!REGISTRATION_OPEN) {
        setFeedback("Les inscriptions sont fermées.", "error");
        return;
      }

      const config = readCloudConfig();
      if (!config) {
        setFeedback("Configuration cloud manquante.", "error");
        return;
      }

      const form = new FormData(registerForm);
      const username = sanitizeUsername(form.get("username"), "");
      const email = normalizeEmail(form.get("email"));
      const password = String(form.get("password") || "");
      const confirmPassword = String(form.get("confirmPassword") || "");

      if (username.length < MIN_USERNAME_LENGTH) {
        setFeedback(`Pseudo trop court (${MIN_USERNAME_LENGTH} caractères minimum).`, "error");
        return;
      }
      if (!isValidEmail(email)) {
        setFeedback("Adresse email invalide.", "error");
        return;
      }
      if (!isAdminEmail(config, email)) {
        setFeedback("Inscription refusée: email non autorisé (admin requis).", "error");
        return;
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        setFeedback(`Mot de passe trop court (${MIN_PASSWORD_LENGTH} caractères minimum).`, "error");
        return;
      }
      if (password !== confirmPassword) {
        setFeedback("Les mots de passe ne correspondent pas.", "error");
        return;
      }

      try {
        const key = normalizeUsernameKey(username);
        let usernameAvailable = (lastUsernameCheck.value === key) ? lastUsernameCheck.available : null;
        if (usernameAvailable === null) {
          usernameAvailable = await checkUsernameAvailability(username, { silent: false });
        }
        if (usernameAvailable === false) {
          setFeedback("Pseudo déjà pris.", "error");
          return;
        }

        const existing = await cloudFetchAccountByEmail(config, email);
        if (existing) {
          setFeedback("Un compte existe déjà avec cet email.", "error");
          return;
        }

        const passwordHash = await createPasswordHash(password);
        await cloudInsertAccount(config, { username, email, passwordHash });
        setFeedback("Compte créé. Redirection vers la connexion...", "success");
        setTimeout(() => {
          window.location.href = "index.html";
        }, 700);
      } catch (error) {
        const message = error && error.message ? error.message : "Inscription impossible.";
        if (/duplicate key/i.test(message) || /unique/i.test(message)) {
          setFeedback("Pseudo ou email déjà utilisé.", "error");
          return;
        }
        setFeedback(message, "error");
      }
    });
  }

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const config = readCloudConfig();
      if (!config) {
        setFeedback("Configuration cloud manquante.", "error");
        return;
      }

      const form = new FormData(loginForm);
      const email = normalizeEmail(form.get("email"));
      const password = String(form.get("password") || "");

      if (!isValidEmail(email)) {
        setFeedback("Identifiants invalides.", "error");
        return;
      }

      try {
        const lockUntil = isLoginLocked(email);
        if (lockUntil) {
          setFeedback("Trop de tentatives. Réessaie dans quelques minutes.", "error");
          return;
        }

        const account = await cloudFetchAccountByEmail(config, email);
        if (!account) {
          markLoginFailure(email);
          setFeedback("Identifiants invalides.", "error");
          return;
        }

        const verification = await verifyPassword(password, account.password_hash);
        if (!verification.ok) {
          markLoginFailure(email);
          setFeedback("Identifiants invalides.", "error");
          return;
        }

        clearLoginFailures(email);

        if (verification.needsUpgrade) {
          try {
            const upgraded = await createPasswordHash(password);
            await cloudUpdateAccountPasswordHash(config, email, upgraded);
          } catch {
            // Best effort upgrade only.
          }
        }

        const sessionData = createLegacySession(account, config);
        setFeedback("Connexion réussie. Bienvenue !", "success");
        setTimeout(() => {
          if (sessionUtils && typeof sessionUtils.withSession === "function") {
            window.location.href = sessionUtils.withSession("tableau-de-bord.html", sessionData);
            return;
          }
          window.location.href = "tableau-de-bord.html";
        }, 450);
      } catch (error) {
        const message = error && error.message ? error.message : "Connexion impossible.";
        setFeedback(message, "error");
      }
    });
  }
})();
