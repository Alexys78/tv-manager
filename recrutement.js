(function recruitmentPageInit() {
  const sessionUtils = window.SessionUtils;
  const presenterEngine = window.PresenterEngine;
  const session = sessionUtils && typeof sessionUtils.requireSession === "function"
    ? sessionUtils.requireSession({ redirectPath: "index.html", persist: true, allowEmailParam: true, clearSearch: true })
    : null;
  if (!session) return;

  const state = {
    role: "presenters",
    search: "",
    specialty: "all",
    sortBy: "name",
    asc: true
  };

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
      { id: "journalists", label: "Journalistes", singular: "Journaliste" }
    ];
  }

  function getRoleMeta(roleId) {
    const roles = getRoles();
    return roles.find((item) => item.id === roleId) || roles[0];
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

  function formatStarBonusLabel(value) {
    const safe = Math.max(0, Math.min(2, Number(value) || 0));
    if (safe >= 2) return "+2★";
    if (safe >= 1) return "+1★";
    return "+0★";
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
      const count = getMarket(role.id).length;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `market-tab ${state.role === role.id ? "active" : ""}`.trim();
      button.textContent = `${role.label} (${count})`;
      button.addEventListener("click", () => {
        state.role = role.id;
        state.specialty = "all";
        state.search = "";
        renderPage();
      });
      return button;
    });

    host.replaceChildren(...tabs);
  }

  function buildToolbar(rows) {
    const roleMeta = getRoleMeta(state.role);
    const block = document.createElement("section");
    block.className = "game-block owned-toolbar-block market-toolbar-block";

    const top = document.createElement("div");
    top.className = "owned-toolbar-top";

    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.placeholder = `Rechercher un ${String(roleMeta.singular || "profil").toLowerCase()}...`;
    searchInput.value = state.search;
    searchInput.addEventListener("input", () => {
      state.search = searchInput.value || "";
      renderPage();
    });

    const sortSelect = document.createElement("select");
    [
      { value: "name", label: "Trier: Nom" },
      { value: "salary", label: "Trier: Salaire" },
      { value: "impact", label: "Trier: Impact" },
      { value: "bonus", label: "Trier: Prime" }
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
      state.search = "";
      state.specialty = "all";
      state.sortBy = "name";
      state.asc = true;
      renderPage();
    });

    top.append(searchInput, sortSelect, orderBtn, resetBtn);

    const filters = document.createElement("div");
    filters.className = "owned-filters-grid";

    const specialtyWrap = document.createElement("div");
    const specialtyTitle = document.createElement("strong");
    specialtyTitle.textContent = "Spécialité";
    const specialtyChips = document.createElement("div");
    specialtyChips.className = "filter-chip-row";
    const specialties = Array.from(new Set(rows.map((item) => String(item.specialty || "").trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));

    const allChip = document.createElement("button");
    allChip.type = "button";
    allChip.className = `filter-chip ${state.specialty === "all" ? "active" : ""}`.trim();
    allChip.textContent = "Toutes";
    allChip.addEventListener("click", () => {
      state.specialty = "all";
      renderPage();
    });
    specialtyChips.appendChild(allChip);

    specialties.forEach((specialty) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = `filter-chip ${state.specialty === specialty ? "active" : ""}`.trim();
      chip.textContent = specialty;
      chip.addEventListener("click", () => {
        state.specialty = specialty;
        renderPage();
      });
      specialtyChips.appendChild(chip);
    });

    specialtyWrap.append(specialtyTitle, specialtyChips);

    const infoWrap = document.createElement("div");
    const infoTitle = document.createElement("strong");
    infoTitle.textContent = roleMeta.label;
    const infoText = document.createElement("div");
    infoText.className = "summary-strip";
    infoText.textContent = `${rows.length} profil(s) disponible(s)`;
    infoWrap.append(infoTitle, infoText);

    filters.append(specialtyWrap, infoWrap);
    block.append(top, filters);
    return block;
  }

  function buildRecruitTable(rows) {
    const roleMeta = getRoleMeta(state.role);
    const section = document.createElement("section");
    section.className = "game-block market-list-fixed";

    const wrap = document.createElement("div");
    wrap.className = "owned-table-wrap";

    const table = document.createElement("table");
    table.className = "owned-table";

    const head = document.createElement("thead");
    const hRow = document.createElement("tr");
    ["Profil", "Spécialité", "Édito", "Charisme", "Notoriété", "Impact", "Salaire", "Prime", "Action"]
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
      td.textContent = `Aucun ${String(roleMeta.singular || "profil").toLowerCase()} disponible pour ce filtre.`;
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
        impactTd.textContent = formatStarBonusLabel(item.starBonus);

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
    const search = String(state.search || "").trim().toLowerCase();
    const specialty = String(state.specialty || "all");
    return getMarket(state.role)
      .filter((item) => {
        if (specialty !== "all" && String(item.specialty || "") !== specialty) return false;
        if (!search) return true;
        const haystack = `${item.fullName || ""} ${item.specialty || ""}`.toLowerCase();
        return haystack.includes(search);
      })
      .sort(compareRows);
  }

  function renderPage() {
    renderTabs();
    const host = document.getElementById("staffRecruitContent");
    if (!host) return;
    const rows = getFilteredRows();
    const toolbar = buildToolbar(getMarket(state.role));
    const table = buildRecruitTable(rows);
    host.replaceChildren(toolbar, table);
  }

  renderPage();

  window.addEventListener("tvmanager:cloud-sync", (event) => {
    const detail = event && event.detail ? event.detail : null;
    if (!detail || !detail.ok || detail.mode !== "pull") return;
    renderPage();
  });
})();
