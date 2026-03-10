(function personnelPageInit() {
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

  function getOwned() {
    if (!presenterEngine || typeof presenterEngine.getOwnedPresentersForCurrentSession !== "function") return [];
    return presenterEngine.getOwnedPresentersForCurrentSession();
  }

  function formatStarBonusLabel(value) {
    const safe = Math.max(0, Math.min(2, Number(value) || 0));
    if (safe >= 2) return "+2★";
    if (safe >= 1) return "+1★";
    return "+0★";
  }

  function presenterRow(presenter) {
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
    row.append(main);
    return row;
  }

  function renderSpecialties(list) {
    const select = document.getElementById("personnelSpecialtySelect");
    if (!select) return;
    const specialties = Array.from(new Set(list.map((item) => String(item.specialty || "").trim()).filter(Boolean)))
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

  function renderOwned() {
    const wrap = document.getElementById("personnelOwnedList");
    const count = document.getElementById("personnelOwnedCount");
    if (!wrap || !count) return;
    const owned = getOwned();
    renderSpecialties(owned);

    const search = String(state.search || "").trim().toLowerCase();
    const specialty = String(state.specialty || "all");
    const filtered = owned
      .filter((presenter) => {
        if (specialty !== "all" && String(presenter.specialty || "") !== specialty) return false;
        if (!search) return true;
        const hay = `${presenter.fullName || ""} ${presenter.specialty || ""}`.toLowerCase();
        return hay.includes(search);
      })
      .sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || ""), "fr", { sensitivity: "base" }));

    count.textContent = String(filtered.length);
    if (!filtered.length) {
      const empty = document.createElement("p");
      empty.className = "studio-presenter-empty";
      empty.textContent = owned.length ? "Aucun profil pour ce filtre." : "Aucun présentateur.";
      wrap.replaceChildren(empty);
      return;
    }
    wrap.replaceChildren(...filtered.map((presenter) => presenterRow(presenter)));
  }

  function bindToolbar() {
    const searchInput = document.getElementById("personnelSearchInput");
    const specialtySelect = document.getElementById("personnelSpecialtySelect");
    if (!searchInput || !specialtySelect) return;
    searchInput.addEventListener("input", () => {
      state.search = searchInput.value || "";
      renderOwned();
    });
    specialtySelect.addEventListener("change", () => {
      state.specialty = specialtySelect.value || "all";
      renderOwned();
    });
  }

  bindToolbar();
  renderOwned();

  window.addEventListener("tvmanager:cloud-sync", (event) => {
    const detail = event && event.detail ? event.detail : null;
    if (!detail || !detail.ok || detail.mode !== "pull") return;
    renderOwned();
  });
})();
