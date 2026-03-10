(function authApp() {
  const REGISTRATION_OPEN = false;
  const appKeys = (window.SessionUtils && window.SessionUtils.APP_KEYS) || {};
  const SESSION_KEY = appKeys.SESSION_KEY || "tv_manager_session";
  const LAST_EMAIL_KEY = appKeys.LAST_EMAIL_KEY || "tv_manager_last_email";
  const LOGOUT_AT_KEY = appKeys.LOGOUT_AT_KEY || "tv_manager_logout_at";
  const cloudConfigApi = window.TVManagerCloudConfig;

  function readCloudConfig() {
    if (cloudConfigApi && typeof cloudConfigApi.read === "function") {
      const cfg = cloudConfigApi.read();
      if (cfg && cfg.url && cfg.anonKey) return cfg;
    }
    return null;
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
        }
      } catch {
        // Keep raw text below.
      }
      return String(text).slice(0, 200);
    } catch {
      return "";
    }
  }

  async function cloudFetchAccountByEmail(config, email) {
    const table = encodeURIComponent(config.accountsTable || "tv_manager_accounts");
    const url = `${config.url}/rest/v1/${table}?email=eq.${encodeURIComponent(email)}&select=username,email,password_hash,created_at,updated_at&limit=1`;
    const response = await fetch(url, { method: "GET", headers: cloudHeaders(config) });
    if (!response.ok) {
      const details = await readErrorDetails(response);
      throw new Error(`Lecture comptes impossible (${response.status})${details ? `: ${details}` : ""}`);
    }
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.length) return null;
    return rows[0];
  }

  async function cloudInsertAccount(config, payload) {
    const table = encodeURIComponent(config.accountsTable || "tv_manager_accounts");
    const url = `${config.url}/rest/v1/${table}`;
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

  function setFeedback(message, type) {
    const feedback = document.getElementById("feedback");
    if (!feedback) return;
    feedback.textContent = message;
    feedback.className = `feedback ${type}`;
  }

  function normalizeEmail(email) {
    return email.trim().toLowerCase();
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
  }

  function sanitizeUsername(username) {
    return String(username || "")
      .replace(/[<>]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
  }

  async function hashPassword(password) {
    const input = String(password || "");
    if (!window.crypto || !window.crypto.subtle || typeof TextEncoder !== "function") {
      return `legacy:${input}`;
    }
    const data = new TextEncoder().encode(input);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    const bytes = Array.from(new Uint8Array(digest));
    const hex = bytes.map((value) => value.toString(16).padStart(2, "0")).join("");
    return `sha256:${hex}`;
  }

  function createSessionForAccount(user) {
    const sessionData = {
      username: user.username,
      email: user.email,
      connectedAt: new Date().toISOString()
    };
    localStorage.removeItem(LOGOUT_AT_KEY);
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    localStorage.setItem(LAST_EMAIL_KEY, user.email);
    return sessionData;
  }

  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    if (!REGISTRATION_OPEN) {
      registerForm.querySelectorAll("input, button, select, textarea").forEach((field) => {
        field.disabled = true;
      });
      setFeedback("Les inscriptions sont fermées pour le moment.", "error");
    }

    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!REGISTRATION_OPEN) {
        setFeedback("Les inscriptions sont fermées pour le moment.", "error");
        return;
      }

      const config = readCloudConfig();
      if (!config) {
        setFeedback("Configuration cloud manquante. Renseigne d'abord Supabase.", "error");
        return;
      }

      const form = new FormData(registerForm);
      const username = sanitizeUsername(form.get("username"));
      const email = normalizeEmail(String(form.get("email") || ""));
      const password = String(form.get("password") || "");
      const confirmPassword = String(form.get("confirmPassword") || "");

      if (username.length < 2) {
        setFeedback("Nom d'utilisateur trop court (2 caractères minimum).", "error");
        return;
      }
      if (!isValidEmail(email)) {
        setFeedback("Adresse email invalide.", "error");
        return;
      }
      if (password.length < 6) {
        setFeedback("Mot de passe trop court (6 caractères minimum).", "error");
        return;
      }
      if (password !== confirmPassword) {
        setFeedback("Les mots de passe ne correspondent pas.", "error");
        return;
      }

      try {
        const existing = await cloudFetchAccountByEmail(config, email);
        if (existing) {
          setFeedback("Un compte avec cet email existe déjà.", "error");
          return;
        }

        const passwordHash = await hashPassword(password);
        await cloudInsertAccount(config, { username, email, passwordHash });

        setFeedback("Compte cloud créé. Redirection vers la connexion...", "success");
        setTimeout(() => {
          window.location.href = "index.html";
        }, 900);
      } catch (error) {
        setFeedback(error && error.message ? error.message : "Inscription cloud impossible.", "error");
      }
    });
  }

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const config = readCloudConfig();
      if (!config) {
        setFeedback("Configuration cloud manquante. Renseigne d'abord Supabase.", "error");
        return;
      }

      const form = new FormData(loginForm);
      const email = normalizeEmail(String(form.get("email") || ""));
      const password = String(form.get("password") || "");
      if (!isValidEmail(email)) {
        setFeedback("Adresse email invalide.", "error");
        return;
      }

      try {
        const passwordHash = await hashPassword(password);
        const account = await cloudFetchAccountByEmail(config, email);
        if (!account) {
          setFeedback("Identifiants invalides.", "error");
          return;
        }

        const storedHash = String(account.password_hash || "");
        if (storedHash !== passwordHash) {
          setFeedback("Identifiants invalides.", "error");
          return;
        }

        const sessionData = createSessionForAccount({
          username: account.username,
          email: account.email
        });

        setFeedback("Connexion réussie. Bienvenue !", "success");
        setTimeout(() => {
          if (window.SessionUtils && typeof window.SessionUtils.withSession === "function") {
            window.location.href = window.SessionUtils.withSession("game.html", sessionData);
            return;
          }
          window.location.href = "game.html";
        }, 700);
      } catch (error) {
        setFeedback(error && error.message ? error.message : "Connexion cloud impossible.", "error");
      }
    });
  }
})();
