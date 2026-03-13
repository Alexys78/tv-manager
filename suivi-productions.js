(function studioProductionsTrackingPage() {
  const sessionUtils = window.SessionUtils;
  const programCatalog = window.ProgramCatalog;
  const session = sessionUtils && typeof sessionUtils.requireSession === "function"
    ? sessionUtils.requireSession({ redirectPath: "index.html", persist: true, allowEmailParam: true, clearSearch: true })
    : null;
  if (!session) return;

  const listNode = document.getElementById("productionTrackingList");
  const feedbackNode = document.getElementById("productionTrackingFeedback");
  if (!listNode || !feedbackNode) return;

  function setFeedback(message, type) {
    feedbackNode.textContent = String(message || "");
    feedbackNode.className = `feedback ${type || ""}`.trim();
  }

  function parseDateKey(value) {
    if (!sessionUtils || typeof sessionUtils.parseDateKey !== "function") return null;
    return sessionUtils.parseDateKey(value);
  }

  function formatDate(value) {
    const parsed = parseDateKey(value);
    if (!parsed) return String(value || "-");
    return parsed.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  }

  function formatTime(minutes) {
    const safe = Number(minutes);
    if (!Number.isFinite(safe)) return "--:--";
    const hh = String(Math.floor(safe / 60) % 24).padStart(2, "0");
    const mm = String(Math.floor(safe % 60)).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function todayDateKey() {
    if (!sessionUtils || typeof sessionUtils.toDateKey !== "function") return "";
    return sessionUtils.toDateKey(new Date());
  }

  function getEpisodeStatus(episode, todayKey) {
    const shootDate = String(episode && episode.shootDateKey || "");
    const readyDate = String(episode && episode.readyDateKey || "");
    if (!shootDate || !readyDate) return { id: "unknown", label: "Inconnu", css: "neutral" };
    if (todayKey >= readyDate) return { id: "ready", label: "Prêt", css: "inedit" };
    if (todayKey >= shootDate) return { id: "postprod", label: "Post-production", css: "rediffusion" };
    return { id: "planned", label: "Tournage prévu", css: "neutral" };
  }

  function createProgressBar(value) {
    const wrapper = document.createElement("div");
    wrapper.className = "production-progress-bar";
    const fill = document.createElement("span");
    fill.className = "production-progress-fill";
    fill.style.width = `${Math.max(0, Math.min(100, Number(value) || 0))}%`;
    wrapper.appendChild(fill);
    return wrapper;
  }

  function createEpisodeRow(episode, todayKey) {
    const row = document.createElement("div");
    row.className = "production-episode-row";

    const left = document.createElement("div");
    left.className = "production-episode-left";
    const badge = document.createElement("span");
    badge.className = "day-badge";
    badge.textContent = `E${Number(episode && episode.episode) || 1}`;
    const text = document.createElement("span");
    text.textContent = `${formatDate(episode.shootDateKey)} · ${formatTime(episode.shootStartMinute)}`;
    left.append(badge, text);

    const right = document.createElement("div");
    right.className = "production-episode-right";
    const ready = document.createElement("span");
    ready.className = "production-ready-date";
    ready.textContent = `Disponible: ${formatDate(episode.readyDateKey)}`;
    const status = getEpisodeStatus(episode, todayKey);
    const statusBadge = document.createElement("span");
    statusBadge.className = `status-badge ${status.css}`;
    statusBadge.textContent = status.label;
    right.append(ready, statusBadge);

    row.append(left, right);
    return row;
  }

  function createProductionCard(record, todayKey) {
    const card = document.createElement("article");
    card.className = "production-tracking-card";

    const head = document.createElement("div");
    head.className = "production-tracking-head";
    const title = document.createElement("h2");
    title.textContent = String(record && record.title || "Production");
    const badges = document.createElement("div");
    badges.className = "production-tracking-badges";
    const typeBadge = document.createElement("span");
    typeBadge.className = "day-badge";
    typeBadge.textContent = "Magazine";
    const budgetBadge = document.createElement("span");
    budgetBadge.className = "day-badge";
    const budget = String(record && record.budget || "medium").trim().toLowerCase();
    budgetBadge.textContent = budget === "high" ? "Budget élevé" : (budget === "low" ? "Budget faible" : "Budget moyen");
    badges.append(typeBadge, budgetBadge);
    head.append(title, badges);

    const summary = document.createElement("div");
    summary.className = "production-tracking-summary";
    const readyCount = Number(record && record.readyEpisodes) || 0;
    const total = Math.max(1, Number(record && record.totalEpisodes) || 1);
    const count = document.createElement("strong");
    count.textContent = `${readyCount}/${total} épisodes prêts`;
    summary.append(count, createProgressBar((readyCount / total) * 100));

    const episodesWrap = document.createElement("div");
    episodesWrap.className = "production-episodes-list";
    const episodes = Array.isArray(record && record.episodes) ? record.episodes.slice() : [];
    episodes.sort((a, b) => (Number(a.episode) || 0) - (Number(b.episode) || 0));
    episodesWrap.replaceChildren(...episodes.map((episode) => createEpisodeRow(episode, todayKey)));

    card.append(head, summary, episodesWrap);
    return card;
  }

  function render() {
    if (!programCatalog || typeof programCatalog.getStudioProductionsForCurrentSession !== "function") {
      setFeedback("Module production indisponible.", "error");
      return;
    }
    const rows = programCatalog.getStudioProductionsForCurrentSession();
    if (!Array.isArray(rows) || rows.length === 0) {
      const empty = document.createElement("p");
      empty.className = "library-empty";
      empty.textContent = "Aucune production magazine en cours.";
      listNode.replaceChildren(empty);
      setFeedback("", "");
      return;
    }
    const todayKey = todayDateKey();
    const sorted = rows.slice().sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    listNode.replaceChildren(...sorted.map((record) => createProductionCard(record, todayKey)));
    setFeedback("", "");
  }

  render();
})();
