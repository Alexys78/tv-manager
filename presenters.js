(function presentersPageInit() {
  const sessionUtils = window.SessionUtils;
  const presenterEngine = window.PresenterEngine;
  const session = sessionUtils && typeof sessionUtils.requireSession === "function"
    ? sessionUtils.requireSession({ redirectPath: "index.html", persist: true, allowEmailParam: true, clearSearch: true })
    : null;
  if (!session) return;

  const state = {
    search: "",
    specialty: "all"
  };

  function formatEuro(value) {
    return sessionUtils.formatEuro(Number(value) || 0);
  }

  function setFeedback(message, type) {
    const node = document.getElementById("presentersFeedback");
    if (!node) return;
    node.textContent = message;
    node.className = `feedback ${type || ""}`.trim();
  }

  function getMarket() {
    if (!presenterEngine || typeof presenterEngine.getMarketPresentersForCurrentSession !== "function") return [];
    return presenterEngine.getMarketPresentersForCurrentSession();
  }

  function formatStarBonusLabel(value) {
    const safe = Math.max(0, Math.min(2, Number(value) || 0));
    if (safe >= 2) return "+2★";
    if (safe >= 1) return "+1★";
    return "+0★";
  }

  function presenterRow(presenter, options) {
    const opts = options && typeof options === "object" ? options : {};
    const row = document.createElement("div");
    row.className = "studio-presenter-row";

    const main = document.createElement("div");
    main.className = "studio-presenter-main";

    const name = document.createElement("div");
    name.className = "studio-presenter-name";
    name.textContent = presenter.fullName;

    const meta = document.createElement("div");
    meta.className = "studio-presenter-meta";
    const badges = [
      presenter.specialty || "Généraliste",
      `Édito ${presenter.editorial}`,
      `Charisme ${presenter.charisma}`,
      `Notoriété ${presenter.notoriety}`
    ];
    badges.forEach((label) => {
      const badge = document.createElement("span");
      badge.className = "studio-presenter-badge";
      badge.textContent = label;
      meta.appendChild(badge);
    });

    const starBadge = document.createElement("span");
    starBadge.className = "studio-presenter-badge strong";
    starBadge.textContent = `Impact ${formatStarBonusLabel(presenter.starBonus)}`;
    meta.appendChild(starBadge);

    const salaryBadge = document.createElement("span");
    salaryBadge.className = "studio-presenter-badge warn";
    salaryBadge.textContent = `${formatEuro(presenter.salaryMonthly || presenter.salaryDaily || 0)} / mois`;
    meta.appendChild(salaryBadge);

    main.append(name, meta);

    const actionWrap = document.createElement("div");
    actionWrap.className = "presenter-action-wrap";
    if (opts.mode === "market") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "secondary-btn";
      btn.textContent = `Recruter (${formatEuro(presenter.signingBonus)})`;
      btn.addEventListener("click", () => {
        if (!presenterEngine || typeof presenterEngine.hirePresenterForCurrentSession !== "function") {
          setFeedback("Module présentateurs indisponible.", "error");
          return;
        }
        const result = presenterEngine.hirePresenterForCurrentSession(presenter.id);
        if (!result || !result.ok) {
          setFeedback((result && result.message) || "Recrutement impossible.", "error");
          return;
        }
        setFeedback(result.message || "Présentateur recruté.", "success");
        renderAll();
      });
      actionWrap.appendChild(btn);
    }

    row.append(main, actionWrap);
    return row;
  }

  function renderSpecialties() {
    const select = document.getElementById("presentersSpecialtySelect");
    if (!select) return;
    const market = getMarket();
    const specialties = Array.from(new Set(market.map((item) => String(item.specialty || "").trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));

    const current = state.specialty;
    select.innerHTML = '<option value="all">Toutes les spécialités</option>';
    specialties.forEach((specialty) => {
      const option = document.createElement("option");
      option.value = specialty;
      option.textContent = specialty;
      select.appendChild(option);
    });
    select.value = specialties.includes(current) || current === "all" ? current : "all";
    state.specialty = select.value;
  }

  function renderMarket() {
    const wrap = document.getElementById("presentersMarketList");
    const count = document.getElementById("presentersMarketCount");
    if (!wrap || !count) return;
    const search = String(state.search || "").trim().toLowerCase();
    const specialty = String(state.specialty || "all");

    const rows = getMarket()
      .filter((presenter) => {
        if (specialty !== "all" && String(presenter.specialty || "") !== specialty) return false;
        if (!search) return true;
        const hay = `${presenter.fullName || ""} ${presenter.specialty || ""}`.toLowerCase();
        return hay.includes(search);
      })
      .sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || ""), "fr", { sensitivity: "base" }));

    count.textContent = String(rows.length);

    if (!rows.length) {
      const empty = document.createElement("p");
      empty.className = "studio-presenter-empty";
      empty.textContent = "Aucun profil pour ce filtre.";
      wrap.replaceChildren(empty);
      return;
    }

    wrap.replaceChildren(...rows.map((presenter) => presenterRow(presenter, { mode: "market" })));
  }

  function bindToolbar() {
    const searchInput = document.getElementById("presentersSearchInput");
    const specialtySelect = document.getElementById("presentersSpecialtySelect");
    if (!searchInput || !specialtySelect) return;

    searchInput.addEventListener("input", () => {
      state.search = searchInput.value || "";
      renderMarket();
    });
    specialtySelect.addEventListener("change", () => {
      state.specialty = specialtySelect.value || "all";
      renderMarket();
    });
  }

  function renderAll() {
    renderSpecialties();
    renderMarket();
  }

  bindToolbar();
  renderAll();

  window.addEventListener("tvmanager:cloud-sync", (event) => {
    const detail = event && event.detail ? event.detail : null;
    if (!detail || !detail.ok || detail.mode !== "pull") return;
    renderAll();
  });
})();
