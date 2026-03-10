(function personnelPageInit() {
  const sessionUtils = window.SessionUtils;
  const presenterEngine = window.PresenterEngine;
  const session = sessionUtils && typeof sessionUtils.requireSession === "function"
    ? sessionUtils.requireSession({ redirectPath: "index.html", persist: true, allowEmailParam: true, clearSearch: true })
    : null;
  if (!session) return;

  const state = {
    search: "",
    specialty: "all",
    pendingFirePresenterId: ""
  };

  function formatEuro(value) {
    return sessionUtils.formatEuro(Number(value) || 0);
  }

  function getOwned() {
    if (!presenterEngine || typeof presenterEngine.getOwnedPresentersForCurrentSession !== "function") return [];
    return presenterEngine.getOwnedPresentersForCurrentSession();
  }

  function setFeedback(message, type) {
    const node = document.getElementById("personnelFeedback");
    if (!node) return;
    node.textContent = message || "";
    node.className = message ? `feedback ${type || "success"}` : "feedback";
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

    const actionWrap = document.createElement("div");
    actionWrap.className = "presenter-action-wrap";

    const fireBtn = document.createElement("button");
    fireBtn.type = "button";
    fireBtn.className = "market-buy-btn market-sell-btn";
    fireBtn.textContent = "Licencier";
    fireBtn.addEventListener("click", () => {
      openFireModal(presenter);
    });
    actionWrap.appendChild(fireBtn);

    main.append(name, meta);
    row.append(main, actionWrap);
    return row;
  }

  function closeFireModal() {
    const modal = document.getElementById("firePresenterModal");
    if (!modal) return;
    state.pendingFirePresenterId = "";
    modal.classList.add("hidden");
  }

  function openFireModal(presenter) {
    const modal = document.getElementById("firePresenterModal");
    const title = document.getElementById("firePresenterModalTitle");
    const body = document.getElementById("firePresenterModalBody");
    const confirmBtn = document.getElementById("confirmFirePresenterBtn");
    if (!modal || !title || !body || !confirmBtn || !presenter) return;

    const getStatus = presenterEngine && typeof presenterEngine.getPresenterTerminationStatusForCurrentSession === "function"
      ? presenterEngine.getPresenterTerminationStatusForCurrentSession
      : null;
    const status = getStatus ? getStatus(presenter.id) : { ok: false, message: "Module de licenciement indisponible." };
    const cost = Math.max(0, Number(status && status.cost) || 0);

    title.textContent = `Licencier ${presenter.fullName}`;
    body.replaceChildren();

    if (status && status.ok) {
      const confirmText = document.createElement("p");
      confirmText.textContent = `Tu confirmes le licenciement de ${presenter.fullName} ?`;
      const costText = document.createElement("p");
      costText.textContent = `Frais de licenciement: ${formatEuro(cost)}.`;
      body.append(confirmText, costText);
      state.pendingFirePresenterId = presenter.id;
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
        status.assignments.forEach((item) => {
          const li = document.createElement("li");
          li.textContent = `- ${item && item.label ? item.label : "Programme"}`;
          list.appendChild(li);
        });
        body.appendChild(list);
      }

      if (cost > 0) {
        const costText = document.createElement("p");
        costText.textContent = `Frais estimés: ${formatEuro(cost)}.`;
        body.appendChild(costText);
      }

      state.pendingFirePresenterId = "";
      confirmBtn.disabled = true;
      confirmBtn.classList.add("hidden");
    }

    modal.classList.remove("hidden");
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

  function bindFireModal() {
    const modal = document.getElementById("firePresenterModal");
    const cancelBtn = document.getElementById("cancelFirePresenterBtn");
    const confirmBtn = document.getElementById("confirmFirePresenterBtn");
    if (!modal || !cancelBtn || !confirmBtn) return;

    cancelBtn.addEventListener("click", closeFireModal);
    confirmBtn.addEventListener("click", () => {
      const presenterId = String(state.pendingFirePresenterId || "").trim();
      if (!presenterId) {
        closeFireModal();
        return;
      }
      if (!presenterEngine || typeof presenterEngine.firePresenterForCurrentSession !== "function") {
        setFeedback("Module de licenciement indisponible.", "error");
        closeFireModal();
        return;
      }
      const result = presenterEngine.firePresenterForCurrentSession(presenterId);
      if (!result || !result.ok) {
        setFeedback((result && result.message) || "Licenciement impossible.", "error");
        closeFireModal();
        renderOwned();
        return;
      }
      setFeedback(`${result.message} Frais: ${formatEuro(result.cost)}.`, "success");
      closeFireModal();
      renderOwned();
    });

    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeFireModal();
    });
  }

  bindToolbar();
  bindFireModal();
  renderOwned();

  window.addEventListener("tvmanager:cloud-sync", (event) => {
    const detail = event && event.detail ? event.detail : null;
    if (!detail || !detail.ok || detail.mode !== "pull") return;
    renderOwned();
  });
})();
