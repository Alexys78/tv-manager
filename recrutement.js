(function recruitmentPageInit() {
  const sessionUtils = window.SessionUtils;
  const presenterEngine = window.PresenterEngine;
  const session = sessionUtils && typeof sessionUtils.requireSession === "function"
    ? sessionUtils.requireSession({ redirectPath: "index.html", persist: true, allowEmailParam: true, clearSearch: true })
    : null;
  if (!session) return;

  const state = {
    role: "presenters",
    genre: "all",
    subgenre: "all",
    stars: "all",
    sortBy: "name",
    asc: true
  };

  function getRoleStarFilterValues(roleId) {
    const role = String(roleId || "");
    if (role === "directors" || role === "producers") return [0, 0.5];
    return [0, 0.5, 1];
  }

  function formatEuro(value) {
    return sessionUtils.formatEuro(Number(value) || 0);
  }

  function setFeedback(message, type) {
    const node = document.getElementById("recruitmentFeedback");
    if (!node) return;
    node.textContent = String(message || "");
    node.className = message ? `feedback ${type || "success"}` : "feedback";
  }

  function getRoles() {
    if (presenterEngine && typeof presenterEngine.listRolesForCurrentSession === "function") {
      const roles = presenterEngine.listRolesForCurrentSession();
      if (Array.isArray(roles) && roles.length > 0) return roles;
    }
    return [
      { id: "presenters", label: "Présentateurs", singular: "Présentateur" },
      { id: "journalists", label: "Journalistes", singular: "Journaliste" },
      { id: "directors", label: "Réalisateurs", singular: "Réalisateur" },
      { id: "producers", label: "Producteurs", singular: "Producteur" }
    ];
  }

  function getRoleMeta(roleId) {
    const roles = getRoles();
    return roles.find((item) => item.id === roleId) || roles[0];
  }

  function getRoleSpecialties(roleId, rows) {
    const marketRows = Array.isArray(rows) ? rows : [];
    if (presenterEngine && typeof presenterEngine.getRoleDefinition === "function") {
      const definition = presenterEngine.getRoleDefinition(roleId);
      if (definition && Array.isArray(definition.specialties) && definition.specialties.length > 0) {
        return definition.specialties.slice();
      }
    }
    return marketRows.map((item) => String(item && item.specialty ? item.specialty : "")).filter(Boolean);
  }

  function parseSpecialty(specialty, roleId) {
    const safe = String(specialty || "").trim();
    if (!safe) return { genre: "", subgenre: "" };
    const parts = safe.split("·").map((item) => item.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return {
        genre: parts[0],
        subgenre: parts.slice(1).join(" · ")
      };
    }
    if (String(roleId || state.role || "") === "journalists") {
      return {
        genre: "Informations",
        subgenre: safe
      };
    }
    return {
      genre: "Autres",
      subgenre: safe
    };
  }

  function buildTaxonomy(roleId, rows) {
    const map = new Map();
    const fromRole = getRoleSpecialties(roleId, rows);
    const fromRows = Array.isArray(rows) ? rows.map((item) => String(item && item.specialty ? item.specialty : "")) : [];
    [...fromRole, ...fromRows].forEach((specialty) => {
      const parsed = parseSpecialty(specialty, roleId);
      if (!parsed.genre || !parsed.subgenre) return;
      if (!map.has(parsed.genre)) map.set(parsed.genre, new Set());
      map.get(parsed.genre).add(parsed.subgenre);
    });
    return map;
  }

  function getMarket(roleId) {
    const role = String(roleId || state.role || "presenters");
    if (presenterEngine && typeof presenterEngine.getMarketStaffByRoleForCurrentSession === "function") {
      return presenterEngine.getMarketStaffByRoleForCurrentSession(role);
    }
    if (role === "journalists" && presenterEngine && typeof presenterEngine.getMarketJournalistsForCurrentSession === "function") {
      return presenterEngine.getMarketJournalistsForCurrentSession();
    }
    if (presenterEngine && typeof presenterEngine.getMarketPresentersForCurrentSession === "function") {
      return presenterEngine.getMarketPresentersForCurrentSession();
    }
    return [];
  }

  function normalizeStarBonusValue(value, roleId) {
    const role = String(roleId || state.role || "");
    const max = (role === "directors" || role === "producers") ? 0.5 : 1;
    const safe = Math.max(0, Math.min(max, Number(value) || 0));
    return Math.round(safe * 2) / 2;
  }

  function formatStarBonusLabel(value, roleId) {
    const safe = normalizeStarBonusValue(value, roleId);
    const text = Number.isInteger(safe) ? String(safe) : String(safe).replace(".", ",");
    return `+${text}★`;
  }

  function compareRows(a, b) {
    const key = String(state.sortBy || "name");
    let result = 0;
    if (key === "salary") {
      result = (Number(a.salaryMonthly) || 0) - (Number(b.salaryMonthly) || 0);
    } else if (key === "impact") {
      result = (Number(a.starBonus) || 0) - (Number(b.starBonus) || 0);
    } else if (key === "bonus") {
      result = (Number(a.signingBonus) || 0) - (Number(b.signingBonus) || 0);
    } else {
      result = String(a.fullName || "").localeCompare(String(b.fullName || ""), "fr", { sensitivity: "base" });
    }
    if (result === 0) {
      result = String(a.fullName || "").localeCompare(String(b.fullName || ""), "fr", { sensitivity: "base" });
    }
    return state.asc ? result : -result;
  }

  function renderTabs() {
    const host = document.getElementById("staffRecruitTabs");
    if (!host) return;
    const roles = getRoles();
    if (!roles.some((role) => role.id === state.role)) state.role = roles[0] ? roles[0].id : "presenters";

    const tabs = roles.map((role) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `market-tab ${state.role === role.id ? "active" : ""}`.trim();
      button.textContent = role.label;
      button.addEventListener("click", () => {
        state.role = role.id;
        state.genre = "all";
        state.subgenre = "all";
        state.stars = "all";
        renderPage();
      });
      return button;
    });

    host.replaceChildren(...tabs);
  }

  function buildToolbar(rows) {
    const block = document.createElement("section");
    block.className = "game-block owned-toolbar-block market-toolbar-block";

    const top = document.createElement("div");
    top.className = "owned-toolbar-top staff-toolbar-top";

    const sortSelect = document.createElement("select");
    [
      { value: "name", label: "Trier: Nom" },
      { value: "salary", label: "Trier: Salaire" },
      { value: "impact", label: "Trier: Impact" },
      { value: "bonus", label: "Trier: Coût recrutement" }
    ].forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.label;
      sortSelect.appendChild(option);
    });
    sortSelect.value = state.sortBy;
    sortSelect.addEventListener("change", () => {
      state.sortBy = sortSelect.value || "name";
      renderPage();
    });

    const orderBtn = document.createElement("button");
    orderBtn.type = "button";
    orderBtn.className = "secondary-btn";
    orderBtn.textContent = state.asc ? "Ordre: A-Z" : "Ordre: Z-A";
    orderBtn.addEventListener("click", () => {
      state.asc = !state.asc;
      renderPage();
    });

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "secondary-btn";
    resetBtn.textContent = "Réinitialiser";
    resetBtn.addEventListener("click", () => {
      state.genre = "all";
      state.subgenre = "all";
      state.stars = "all";
      state.sortBy = "name";
      state.asc = true;
      renderPage();
    });

    top.append(sortSelect, orderBtn, resetBtn);

    const filters = document.createElement("div");
    filters.className = "owned-filters-grid";

    const isJournalists = state.role === "journalists";
    const taxonomy = buildTaxonomy(state.role, rows);
    const genres = Array.from(taxonomy.keys()).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
    if (isJournalists) {
      state.genre = "all";
    } else if (state.genre !== "all" && !genres.includes(state.genre)) {
      state.genre = "all";
      state.subgenre = "all";
    }

    let subgenres = [];
    if (isJournalists) {
      const infoSet = taxonomy.get("Informations");
      if (infoSet instanceof Set) {
        subgenres = Array.from(infoSet);
      } else {
        const all = new Set();
        genres.forEach((genre) => {
          const set = taxonomy.get(genre);
          if (!(set instanceof Set)) return;
          set.forEach((sub) => all.add(sub));
        });
        subgenres = Array.from(all);
      }
    } else if (state.genre === "all") {
      const all = new Set();
      genres.forEach((genre) => {
        const set = taxonomy.get(genre);
        if (!(set instanceof Set)) return;
        set.forEach((sub) => all.add(sub));
      });
      subgenres = Array.from(all);
    } else {
      const selectedSet = taxonomy.get(state.genre);
      subgenres = selectedSet instanceof Set ? Array.from(selectedSet) : [];
    }
    subgenres.sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
    if (state.subgenre !== "all" && !subgenres.includes(state.subgenre)) {
      state.subgenre = "all";
    }

    const genreWrap = document.createElement("div");
    genreWrap.className = "filter-group";
    const genreTitle = document.createElement("span");
    genreTitle.className = "filter-label";
    genreTitle.textContent = "Genre";
    const genreChips = document.createElement("div");
    genreChips.className = "filter-chip-row";

    const genreAllChip = document.createElement("button");
    genreAllChip.type = "button";
    genreAllChip.className = `filter-chip ${state.genre === "all" ? "active" : ""}`.trim();
    genreAllChip.textContent = "Tous";
    genreAllChip.addEventListener("click", () => {
      state.genre = "all";
      state.subgenre = "all";
      renderPage();
    });
    genreChips.appendChild(genreAllChip);

    genres.forEach((genre) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `filter-chip ${state.genre === genre ? "active" : ""}`.trim();
      chip.textContent = genre;
      chip.addEventListener("click", () => {
        state.genre = genre;
        state.subgenre = "all";
        renderPage();
      });
      genreChips.appendChild(chip);
    });
    genreWrap.append(genreTitle, genreChips);

    const subgenreWrap = document.createElement("div");
    subgenreWrap.className = "filter-group";
    const subgenreTitle = document.createElement("span");
    subgenreTitle.className = "filter-label";
    subgenreTitle.textContent = "Sous-genre";
    const subgenreChips = document.createElement("div");
    subgenreChips.className = "filter-chip-row";

    const subgenreAllChip = document.createElement("button");
    subgenreAllChip.type = "button";
    subgenreAllChip.className = `filter-chip ${state.subgenre === "all" ? "active" : ""}`.trim();
    subgenreAllChip.textContent = "Tous";
    subgenreAllChip.addEventListener("click", () => {
      state.subgenre = "all";
      renderPage();
    });
    subgenreChips.appendChild(subgenreAllChip);

    subgenres.forEach((subgenre) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `filter-chip ${state.subgenre === subgenre ? "active" : ""}`.trim();
      chip.textContent = subgenre;
      chip.addEventListener("click", () => {
        state.subgenre = subgenre;
        renderPage();
      });
      subgenreChips.appendChild(chip);
    });
    subgenreWrap.append(subgenreTitle, subgenreChips);

    const starsWrap = document.createElement("div");
    starsWrap.className = "filter-group";
    const starsTitle = document.createElement("span");
    starsTitle.className = "filter-label";
    starsTitle.textContent = "Étoiles";
    const starsChips = document.createElement("div");
    starsChips.className = "filter-chip-row";

    const starsAllChip = document.createElement("button");
    starsAllChip.type = "button";
    starsAllChip.className = `filter-chip ${state.stars === "all" ? "active" : ""}`.trim();
    starsAllChip.textContent = "Toutes";
    starsAllChip.addEventListener("click", () => {
      state.stars = "all";
      renderPage();
    });
    starsChips.appendChild(starsAllChip);

    getRoleStarFilterValues(state.role).forEach((starValue) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `filter-chip ${Number(state.stars) === starValue ? "active" : ""}`.trim();
      chip.textContent = `${String(starValue).replace(".", ",")}★`;
      chip.addEventListener("click", () => {
        state.stars = String(starValue);
        renderPage();
      });
      starsChips.appendChild(chip);
    });
    starsWrap.append(starsTitle, starsChips);

    if (isJournalists) {
      filters.append(subgenreWrap, starsWrap);
    } else {
      filters.append(genreWrap, subgenreWrap, starsWrap);
    }
    block.append(top, filters);
    return block;
  }

  function buildRecruitTable(rows, totalAvailable) {
    const roleMeta = getRoleMeta(state.role);
    const section = document.createElement("section");
    section.className = "game-block market-list-fixed";

    const wrap = document.createElement("div");
    wrap.className = "owned-table-wrap";

    const table = document.createElement("table");
    table.className = "owned-table";

    const head = document.createElement("thead");
    const hRow = document.createElement("tr");
    ["Profil", "Spécialité", "Édito", "Charisme", "Notoriété", "Impact", "Salaire", "Coût recrutement", "Action"]
      .forEach((label) => {
        const th = document.createElement("th");
        th.textContent = label;
        hRow.appendChild(th);
      });
    head.appendChild(hRow);

    const body = document.createElement("tbody");
    if (!rows.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 9;
      const noneAvailable = (Number(totalAvailable) || 0) <= 0;
      td.textContent = noneAvailable
        ? "Aucun personnel disponible pour le moment."
        : `Aucun ${String(roleMeta.singular || "profil").toLowerCase()} disponible avec ces filtres.`;
      tr.appendChild(td);
      body.appendChild(tr);
    } else {
      rows.forEach((item) => {
        const tr = document.createElement("tr");

        const nameTd = document.createElement("td");
        nameTd.textContent = item.fullName || "-";

        const specTd = document.createElement("td");
        specTd.textContent = item.specialty || "-";

        const editoTd = document.createElement("td");
        editoTd.textContent = String(Math.max(0, Number(item.editorial) || 0));

        const charismaTd = document.createElement("td");
        charismaTd.textContent = String(Math.max(0, Number(item.charisma) || 0));

        const notorietyTd = document.createElement("td");
        notorietyTd.textContent = String(Math.max(0, Number(item.notoriety) || 0));

        const impactTd = document.createElement("td");
        impactTd.textContent = formatStarBonusLabel(item.starBonus, state.role);

        const salaryTd = document.createElement("td");
        salaryTd.textContent = `${formatEuro(item.salaryMonthly || 0)} / mois`;

        const bonusTd = document.createElement("td");
        bonusTd.textContent = formatEuro(item.signingBonus || 0);

        const actionTd = document.createElement("td");
        const recruitBtn = document.createElement("button");
        recruitBtn.type = "button";
        recruitBtn.className = "market-buy-btn";
        recruitBtn.textContent = "Recruter";
        recruitBtn.addEventListener("click", () => {
          if (!presenterEngine || typeof presenterEngine.hireStaffForCurrentSession !== "function") {
            setFeedback("Module recrutement indisponible.", "error");
            return;
          }
          const result = presenterEngine.hireStaffForCurrentSession(state.role, item.id);
          if (!result || !result.ok) {
            setFeedback((result && result.message) || "Recrutement impossible.", "error");
            return;
          }
          setFeedback(result.message || "Recrutement confirmé.", "success");
          renderPage();
        });
        actionTd.appendChild(recruitBtn);

        tr.append(nameTd, specTd, editoTd, charismaTd, notorietyTd, impactTd, salaryTd, bonusTd, actionTd);
        body.appendChild(tr);
      });
    }

    table.append(head, body);
    wrap.appendChild(table);
    section.appendChild(wrap);
    return section;
  }

  function getFilteredRows() {
    const genre = String(state.genre || "all");
    const subgenre = String(state.subgenre || "all");
    const stars = String(state.stars || "all");
    return getMarket(state.role)
      .filter((item) => {
        const parsed = parseSpecialty(item && item.specialty ? item.specialty : "", state.role);
        if (genre !== "all" && parsed.genre !== genre) return false;
        if (subgenre !== "all" && parsed.subgenre !== subgenre) return false;
        if (stars !== "all" && normalizeStarBonusValue(item && item.starBonus, state.role) !== normalizeStarBonusValue(stars, state.role)) return false;
        return true;
      })
      .sort(compareRows);
  }

  function renderPage() {
    renderTabs();
    const host = document.getElementById("staffRecruitContent");
    if (!host) return;
    const marketRows = getMarket(state.role);
    const rows = getFilteredRows();
    const toolbar = buildToolbar(marketRows);
    const table = buildRecruitTable(rows, marketRows.length);
    host.replaceChildren(toolbar, table);
  }

  renderPage();

  window.addEventListener("tvmanager:cloud-sync", (event) => {
    const detail = event && event.detail ? event.detail : null;
    if (!detail || !detail.ok || detail.mode !== "pull") return;
    renderPage();
  });
})();
