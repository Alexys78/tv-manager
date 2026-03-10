(function personnelPageInit() {
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
    asc: true,
    pendingFireRole: "",
    pendingFireId: ""
  };

  function formatEuro(value) {
    return sessionUtils.formatEuro(Number(value) || 0);
  }

  function setFeedback(message, type) {
    const node = document.getElementById("personnelFeedback");
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
      { id: "presenters", label: "Présentateurs", singular: "Présentateur", singularLower: "présentateur" },
      { id: "journalists", label: "Journalistes", singular: "Journaliste", singularLower: "journaliste" }
    ];
  }

  function getRoleMeta(roleId) {
    const roles = getRoles();
    return roles.find((item) => item.id === roleId) || roles[0];
  }

  function getOwned(roleId) {
    const role = String(roleId || state.role || "presenters");
    if (presenterEngine && typeof presenterEngine.getOwnedStaffByRoleForCurrentSession === "function") {
      return presenterEngine.getOwnedStaffByRoleForCurrentSession(role);
    }
    if (role === "journalists" && presenterEngine && typeof presenterEngine.getOwnedJournalistsForCurrentSession === "function") {
      return presenterEngine.getOwnedJournalistsForCurrentSession();
    }
    if (presenterEngine && typeof presenterEngine.getOwnedPresentersForCurrentSession === "function") {
      return presenterEngine.getOwnedPresentersForCurrentSession();
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
    } else {
      result = String(a.fullName || "").localeCompare(String(b.fullName || ""), "fr", { sensitivity: "base" });
    }
    if (result === 0) {
      result = String(a.fullName || "").localeCompare(String(b.fullName || ""), "fr", { sensitivity: "base" });
    }
    return state.asc ? result : -result;
  }

  function closeFireModal() {
    const modal = document.getElementById("firePresenterModal");
    if (!modal) return;
    state.pendingFireRole = "";
    state.pendingFireId = "";
    modal.classList.add("hidden");
  }

  function openFireModal(roleId, item) {
    const modal = document.getElementById("firePresenterModal");
    const title = document.getElementById("firePresenterModalTitle");
    const body = document.getElementById("firePresenterModalBody");
    const confirmBtn = document.getElementById("confirmFirePresenterBtn");
    if (!modal || !title || !body || !confirmBtn || !item) return;

    const roleMeta = getRoleMeta(roleId);
    const status = presenterEngine && typeof presenterEngine.getStaffTerminationStatusForCurrentSession === "function"
      ? presenterEngine.getStaffTerminationStatusForCurrentSession(roleId, item.id)
      : { ok: false, message: "Module de licenciement indisponible." };

    const cost = Math.max(0, Number(status && status.cost) || 0);
    title.textContent = `Licencier ${item.fullName}`;
    body.replaceChildren();

    if (status && status.ok) {
      const confirmText = document.createElement("p");
      confirmText.textContent = `Tu confirmes le licenciement de ${item.fullName} ?`;
      const costText = document.createElement("p");
      costText.textContent = `Frais de licenciement: ${formatEuro(cost)}.`;
      body.append(confirmText, costText);
      state.pendingFireRole = roleId;
      state.pendingFireId = item.id;
      confirmBtn.disabled = false;
      confirmBtn.classList.remove("hidden");
    } else {
      const reason = document.createElement("p");
      reason.textContent = (status && status.message) || "Licenciement impossible.";
      body.appendChild(reason);

      if (status && Array.isArray(status.assignments) && status.assignments.length > 0) {
        const lead = document.createElement("p");
        lead.textContent = "Programme(s) concerné(s):";
        body.appendChild(lead);
        const list = document.createElement("ul");
        list.className = "modal-list";
        status.assignments.forEach((entry) => {
          const li = document.createElement("li");
          li.textContent = `- ${entry && entry.label ? entry.label : "Programme"}`;
          list.appendChild(li);
        });
        body.appendChild(list);
      }

      if (cost > 0) {
        const costText = document.createElement("p");
        costText.textContent = `Frais estimés: ${formatEuro(cost)}.`;
        body.appendChild(costText);
      }

      state.pendingFireRole = "";
      state.pendingFireId = "";
      confirmBtn.disabled = true;
      confirmBtn.classList.add("hidden");
    }

    modal.classList.remove("hidden");
  }

  function renderTabs() {
    const host = document.getElementById("staffOwnedTabs");
    if (!host) return;
    const roles = getRoles();
    if (!roles.some((role) => role.id === state.role)) state.role = roles[0] ? roles[0].id : "presenters";

    const tabs = roles.map((role) => {
      const count = getOwned(role.id).length;
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
      { value: "impact", label: "Trier: Impact" }
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
    infoText.textContent = `${rows.length} membre(s)`;
    infoWrap.append(infoTitle, infoText);

    filters.append(specialtyWrap, infoWrap);
    block.append(top, filters);
    return block;
  }

  function buildOwnedTable(rows) {
    const roleMeta = getRoleMeta(state.role);
    const section = document.createElement("section");
    section.className = "game-block market-list-fixed";

    const wrap = document.createElement("div");
    wrap.className = "owned-table-wrap";

    const table = document.createElement("table");
    table.className = "owned-table";

    const head = document.createElement("thead");
    const hRow = document.createElement("tr");
    ["Profil", "Spécialité", "Édito", "Charisme", "Notoriété", "Impact", "Salaire", "Action"]
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
      td.colSpan = 8;
      td.textContent = `Aucun ${String(roleMeta.singular || "profil").toLowerCase()} pour ce filtre.`;
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

        const actionTd = document.createElement("td");
        const fireBtn = document.createElement("button");
        fireBtn.type = "button";
        fireBtn.className = "market-buy-btn market-sell-btn";
        fireBtn.textContent = "Licencier";
        fireBtn.addEventListener("click", () => {
          openFireModal(state.role, item);
        });
        actionTd.appendChild(fireBtn);

        tr.append(nameTd, specTd, editoTd, charismaTd, notorietyTd, impactTd, salaryTd, actionTd);
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
    return getOwned(state.role)
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
    const host = document.getElementById("staffOwnedContent");
    if (!host) return;
    const rows = getFilteredRows();
    const toolbar = buildToolbar(getOwned(state.role));
    const table = buildOwnedTable(rows);
    host.replaceChildren(toolbar, table);
  }

  function bindModal() {
    const modal = document.getElementById("firePresenterModal");
    const cancelBtn = document.getElementById("cancelFirePresenterBtn");
    const confirmBtn = document.getElementById("confirmFirePresenterBtn");
    if (!modal || !cancelBtn || !confirmBtn) return;

    cancelBtn.addEventListener("click", closeFireModal);

    confirmBtn.addEventListener("click", () => {
      const role = String(state.pendingFireRole || "").trim();
      const staffId = String(state.pendingFireId || "").trim();
      if (!role || !staffId) {
        closeFireModal();
        return;
      }
      if (!presenterEngine || typeof presenterEngine.fireStaffForCurrentSession !== "function") {
        setFeedback("Module de licenciement indisponible.", "error");
        closeFireModal();
        return;
      }
      const result = presenterEngine.fireStaffForCurrentSession(role, staffId);
      if (!result || !result.ok) {
        setFeedback((result && result.message) || "Licenciement impossible.", "error");
        closeFireModal();
        renderPage();
        return;
      }
      setFeedback(`${result.message} Frais: ${formatEuro(result.cost)}.`, "success");
      closeFireModal();
      renderPage();
    });

    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeFireModal();
    });
  }

  bindModal();
  renderPage();

  window.addEventListener("tvmanager:cloud-sync", (event) => {
    const detail = event && event.detail ? event.detail : null;
    if (!detail || !detail.ok || detail.mode !== "pull") return;
    renderPage();
  });
})();
