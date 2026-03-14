(function marcheProgrammesApp() {
  const catalog = window.ProgramCatalog;
  const bank = window.PlayerBank;
  const diffusionRules = window.DiffusionRules;
  const sessionUtils = window.SessionUtils;
  const session = sessionUtils && typeof sessionUtils.requireSession === "function"
    ? sessionUtils.requireSession({ redirectPath: "index.html", persist: true, allowEmailParam: true, clearSearch: true })
    : null;
  if (!session) return;

  const state = {
    selectedCategoryId: null,
    expandedPrograms: new Set(),
    selectedSeasonByProgram: {},
    sortKey: "name",
    sortDir: "asc",
    filters: {
      search: "",
      duration: "all",
      stars: "all",
      status: "all",
      ageRatings: [],
      diffusion: "all"
    }
  };

  const AGE_ORDER = ["TP", "-10", "-12", "-16", "-18"];

  function setFeedback(message, type) {
    const feedback = document.getElementById("marketFeedback");
    if (!feedback) return;
    feedback.textContent = message || "";
    feedback.className = `feedback ${type || ""}`.trim();
  }

  function formatEuro(value) {
    return sessionUtils.formatEuro(Number(value) || 0);
  }

  function normalizeStars(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0.5;
    const rounded = Math.round(numeric * 2) / 2;
    return Math.max(0.5, Math.min(5, rounded));
  }

  function createStarsBadge(value) {
    const stars = normalizeStars(value);
    const badge = document.createElement("span");
    badge.className = "film-class-badge stars";
    const fullCount = Math.floor(stars);
    const hasHalf = (stars - fullCount) >= 0.5;
    const emptyCount = Math.max(0, 5 - fullCount - (hasHalf ? 1 : 0));

    if (fullCount > 0) {
      const filled = document.createElement("span");
      filled.className = "stars-filled";
      filled.textContent = "★".repeat(fullCount);
      badge.appendChild(filled);
    }

    if (hasHalf) {
      const half = document.createElement("span");
      half.className = "stars-half";
      half.textContent = "★";
      badge.appendChild(half);
    }

    if (emptyCount > 0) {
      const empty = document.createElement("span");
      empty.className = "stars-empty";
      empty.textContent = "★".repeat(emptyCount);
      badge.appendChild(empty);
    }

    return badge;
  }

  function ageRatingToken(value) {
    if (value === "TP") return "tp";
    if (value === "-10") return "m10";
    if (value === "-12") return "m12";
    if (value === "-16") return "m16";
    if (value === "-18") return "m18";
    return "default";
  }

  function createStatusBadge(kind, categoryId) {
    const badge = document.createElement("span");
    const normalized = kind === "rediffusion"
      ? "rediffusion"
      : (kind === "direct" ? "direct" : "inedit");
    badge.className = `status-badge ${normalized}`;
    badge.textContent = (diffusionRules && typeof diffusionRules.getStatusLabel === "function")
      ? diffusionRules.getStatusLabel(normalized, categoryId)
      : (normalized === "rediffusion" ? "Rediffusion" : (normalized === "direct" ? "En direct" : "Inédit"));
    return badge;
  }

  function toCategoryColorClass(categoryId) {
    const safe = String(categoryId || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    return safe ? `category-${safe}` : "";
  }

  function sortCategoriesByName(categories) {
    return categories
      .slice()
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "fr", { sensitivity: "base" }));
  }

  function getCategories() {
    if (!catalog || typeof catalog.getMarketCategoriesForCurrentSession !== "function") {
      return null;
    }
    const categories = catalog.getMarketCategoriesForCurrentSession();
    return Array.isArray(categories) ? sortCategoriesByName(categories) : categories;
  }

  function getProgramStatus(program) {
    const raw = String(program && program.diffusion && program.diffusion.status || "").trim().toLowerCase();
    if (raw === "rediffusion") return "rediffusion";
    if (raw === "direct") return "direct";
    return "inedit";
  }

  function getProgramDuration(program) {
    return Math.max(0, Number(program && program.duration) || 0);
  }

  function getProgramStars(program) {
    return normalizeStars(program && program.stars);
  }

  function getProgramAge(program) {
    return String((program && program.ageRating) || "");
  }

  function canDisplaySubtype(categoryId) {
    const safe = String(categoryId || "").trim();
    return safe !== "series" && safe !== "films";
  }

  function getProgramSubtype(program, categoryId) {
    if (!canDisplaySubtype(categoryId)) return "";
    return String(program && (program.subtype || program.productionSubtype) || "").trim();
  }

  function getProgramDiffusionCount(program) {
    return Math.max(0, Number(program && program.diffusion && program.diffusion.diffusionCount) || 0);
  }

  function matchesFilter(program, categoryId) {
    const text = String(program.title || "").toLowerCase();
    const search = String(state.filters.search || "").trim().toLowerCase();
    if (search && !text.includes(search)) return false;

    const duration = getProgramDuration(program);
    if (state.filters.duration !== "all" && duration !== Number(state.filters.duration)) return false;

    const stars = getProgramStars(program);
    if (state.filters.stars !== "all" && stars !== Number(state.filters.stars)) return false;

    const status = getProgramStatus(program, categoryId);
    if (state.filters.status !== "all" && status !== state.filters.status) return false;

    const age = getProgramAge(program);
    if (Array.isArray(state.filters.ageRatings) && state.filters.ageRatings.length > 0 && !state.filters.ageRatings.includes(age)) {
      return false;
    }

    const diffusions = getProgramDiffusionCount(program);
    if (state.filters.diffusion === "none" && diffusions !== 0) return false;
    if (state.filters.diffusion === "1plus" && diffusions < 1) return false;
    if (state.filters.diffusion === "5plus" && diffusions < 5) return false;
    if (state.filters.diffusion === "10plus" && diffusions < 10) return false;

    return true;
  }

  function comparePrograms(a, b, categoryId) {
    const dir = state.sortDir === "desc" ? -1 : 1;
    const key = state.sortKey;

    function valueOf(program) {
      if (key === "name") return String(program.title || "").toLowerCase();
      if (key === "duration") return getProgramDuration(program);
      if (key === "stars") return getProgramStars(program);
      if (key === "age") return AGE_ORDER.indexOf(getProgramAge(program));
      if (key === "status") return getProgramStatus(program, categoryId) === "rediffusion" ? 1 : 0;
      if (key === "price") return Number(program.price) || 0;
      if (key === "diffusions") return getProgramDiffusionCount(program);
      return String(program.title || "").toLowerCase();
    }

    const av = valueOf(a);
    const bv = valueOf(b);
    if (typeof av === "string" || typeof bv === "string") {
      const result = String(av).localeCompare(String(bv), "fr", { sensitivity: "base" });
      return result * dir;
    }
    if (av === bv) return 0;
    return (av > bv ? 1 : -1) * dir;
  }

  function getVisiblePrograms(category) {
    const programs = Array.isArray(category.programs) ? category.programs.slice() : [];
    return programs
      .filter((program) => matchesFilter(program, category.id))
      .sort((a, b) => comparePrograms(a, b, category.id));
  }

  function renderTabs(categories) {
    const tabs = document.getElementById("marketTabs");
    if (!tabs) return;
    const buttons = categories.map((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `market-tab ${state.selectedCategoryId === category.id ? "active" : ""}`;
      button.textContent = category.name;
      button.addEventListener("click", () => {
        state.selectedCategoryId = category.id;
        renderMarket();
      });
      return button;
    });
    tabs.replaceChildren(...buttons);
  }

  function renderToolbar(activeCategory) {
    const block = document.createElement("section");
    block.className = "game-block owned-toolbar-block market-toolbar-block";

    const durations = Array.from(new Set([
      5, 15, 30, 45, 60, 90, 120,
      ...(activeCategory.programs || []).map((program) => getProgramDuration(program)).filter((d) => d > 0)
    ])).sort((a, b) => a - b);
    const ages = AGE_ORDER.filter((age) => (activeCategory.programs || []).some((program) => getProgramAge(program) === age));

    const top = document.createElement("div");
    top.className = "owned-toolbar-top";

    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Rechercher un programme...";
    search.value = state.filters.search;
    search.addEventListener("input", () => {
      state.filters.search = search.value;
      renderMarket();
    });

    const sort = document.createElement("select");
    sort.className = "day-select";
    const sortOptions = [
      { value: "name", label: "Nom" },
      { value: "duration", label: "Durée" },
      { value: "stars", label: "Étoiles" },
      { value: "age", label: "Classification" },
      { value: "status", label: "Statut" },
      { value: "price", label: "Prix achat" },
      { value: "diffusions", label: "Nb diffusions" }
    ];
    sort.replaceChildren(...sortOptions.map((opt) => {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = `Trier: ${opt.label}`;
      if (state.sortKey === opt.value) option.selected = true;
      return option;
    }));
    sort.addEventListener("change", () => {
      state.sortKey = sort.value;
      renderMarket();
    });

    const dir = document.createElement("button");
    dir.type = "button";
    dir.className = "secondary-btn";
    dir.textContent = state.sortDir === "asc" ? "Ordre: A-Z" : "Ordre: Z-A";
    dir.addEventListener("click", () => {
      state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      renderMarket();
    });

    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "secondary-btn";
    reset.textContent = "Réinitialiser";
    reset.addEventListener("click", () => {
      state.filters.search = "";
      state.filters.duration = "all";
      state.filters.stars = "all";
      state.filters.status = "all";
      state.filters.ageRatings = [];
      state.filters.diffusion = "all";
      state.sortKey = "name";
      state.sortDir = "asc";
      renderMarket();
    });

    top.append(search, sort, dir, reset);

    const filters = document.createElement("div");
    filters.className = "owned-filters-grid";

    function buildChipGroup(labelText, options, activeValue, onClick) {
      const group = document.createElement("div");
      group.className = "filter-group";
      const label = document.createElement("span");
      label.className = "filter-label";
      label.textContent = labelText;
      const row = document.createElement("div");
      row.className = "filter-chip-row";
      options.forEach((opt) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = `filter-chip ${activeValue === opt.value ? "active" : ""}`.trim();
        chip.textContent = opt.label;
        chip.addEventListener("click", () => onClick(opt.value));
        row.appendChild(chip);
      });
      group.append(label, row);
      return group;
    }

    const durationGroup = buildChipGroup(
      "Durée",
      [{ value: "all", label: "Toutes" }, ...durations.map((d) => ({ value: String(d), label: `${d} min` }))],
      String(state.filters.duration),
      (value) => {
        state.filters.duration = value;
        renderMarket();
      }
    );

    const starsGroup = buildChipGroup(
      "Étoiles",
      [
        { value: "all", label: "Toutes" },
        { value: "0.5", label: "0,5★" },
        { value: "1", label: "1★" },
        { value: "1.5", label: "1,5★" },
        { value: "2", label: "2★" },
        { value: "2.5", label: "2,5★" },
        { value: "3", label: "3★" },
        { value: "3.5", label: "3,5★" },
        { value: "4", label: "4★" },
        { value: "4.5", label: "4,5★" },
        { value: "5", label: "5★" }
      ],
      String(state.filters.stars),
      (value) => {
        state.filters.stars = value;
        renderMarket();
      }
    );

    const statusGroup = buildChipGroup(
      "Statut",
      [
        { value: "all", label: "Tous" },
        { value: "inedit", label: "Inédit" },
        { value: "rediffusion", label: "Rediffusion" }
      ],
      String(state.filters.status),
      (value) => {
        state.filters.status = value;
        renderMarket();
      }
    );

    const diffusionGroup = buildChipGroup(
      "Diffusions",
      [
        { value: "all", label: "Toutes" },
        { value: "none", label: "0" },
        { value: "1plus", label: "1+" },
        { value: "5plus", label: "5+" },
        { value: "10plus", label: "10+" }
      ],
      String(state.filters.diffusion),
      (value) => {
        state.filters.diffusion = value;
        renderMarket();
      }
    );

    const ageGroup = document.createElement("div");
    ageGroup.className = "filter-group";
    const ageLabel = document.createElement("span");
    ageLabel.className = "filter-label";
    ageLabel.textContent = "Classification";
    const ageRow = document.createElement("div");
    ageRow.className = "filter-chip-row";
    ages.forEach((age) => {
      const chip = document.createElement("button");
      chip.type = "button";
      const active = state.filters.ageRatings.includes(age);
      chip.className = `filter-chip ${active ? "active" : ""}`.trim();
      chip.textContent = age;
      chip.addEventListener("click", () => {
        const set = new Set(state.filters.ageRatings);
        if (set.has(age)) {
          set.delete(age);
        } else {
          set.add(age);
        }
        state.filters.ageRatings = Array.from(set);
        renderMarket();
      });
      ageRow.appendChild(chip);
    });
    ageGroup.append(ageLabel, ageRow);

    filters.append(durationGroup, starsGroup, statusGroup, diffusionGroup, ageGroup);
    block.append(top, filters);
    return block;
  }

  function renderEpisodesBlock(seasonData) {
    const wrap = document.createElement("div");
    wrap.className = "owned-episodes-wrap";
    const episodeItems = seasonData.episodes.map((episodeData) => {
      const item = document.createElement("span");
      item.className = `owned-episode-pill ${episodeData.status || "inedit"}`;
      const count = Number(episodeData.diffusionCount) || 0;
      const diffusionLabel = count > 0 ? ` · ${count} diffusion${count > 1 ? "s" : ""}` : "";
      item.textContent = `E${episodeData.episode} · ${episodeData.status === "rediffusion" ? "Rediffusion" : "Inédit"}${diffusionLabel}`;
      return item;
    });
    wrap.append(...episodeItems);
    return wrap;
  }

  function renderProgramDetails(program, categoryId) {
    const details = document.createElement("div");
    details.className = "owned-program-details";

    const seasons = Array.isArray(program.seasonsDetail) ? program.seasonsDetail : [];
    if (seasons.length === 0) {
      const empty = document.createElement("p");
      empty.className = "market-program-meta";
      empty.textContent = "Aucun détail saison/épisode.";
      details.appendChild(empty);
      return details;
    }

    if (!state.selectedSeasonByProgram[program.title]) {
      state.selectedSeasonByProgram[program.title] = seasons[0].season;
    }

    const seasonRow = document.createElement("div");
    seasonRow.className = "owned-season-row";
    seasons.forEach((seasonData) => {
      const btn = document.createElement("button");
      btn.type = "button";
      const isActive = state.selectedSeasonByProgram[program.title] === seasonData.season;
      btn.className = `owned-season-btn ${isActive ? "active" : ""}`;
      btn.textContent = `S${seasonData.season}`;
      btn.appendChild(createStatusBadge(seasonData.status, categoryId));
      btn.addEventListener("click", () => {
        state.selectedSeasonByProgram[program.title] = seasonData.season;
        renderMarket();
      });
      seasonRow.appendChild(btn);
    });

    const activeSeason = seasons.find((s) => s.season === state.selectedSeasonByProgram[program.title]) || seasons[0];
    details.append(seasonRow, renderEpisodesBlock(activeSeason));
    return details;
  }

  function buildBuyButton(program) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "market-buy-btn";

    if (program.owned) {
      button.textContent = "Acheté";
      button.disabled = true;
      button.classList.add("secondary-btn");
      return button;
    }

    button.textContent = "Acheter";
    button.addEventListener("click", () => {
      const result = catalog.buyProgramForCurrentSession(program.title);
      if (!result.ok) {
        setFeedback(result.message, "error");
        return;
      }
      if (bank && typeof bank.refresh === "function") bank.refresh();
      setFeedback(`${program.title} acheté pour ${formatEuro(program.price)}.`, "success");
      renderMarket();
    });
    return button;
  }

  function buildProgramTable(activeCategory, programs) {
    const wrap = document.createElement("div");
    wrap.className = "owned-table-wrap";

    const table = document.createElement("table");
    table.className = "owned-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Programme", "Durée", "Étoiles", "Classif", "Statut", "Diffusions", "Prix achat", "Action"].forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);

    const tbody = document.createElement("tbody");
    programs.forEach((program) => {
      const tr = document.createElement("tr");
      const colorClass = toCategoryColorClass(activeCategory.id);
      if (colorClass) tr.classList.add(colorClass);

      const tdName = document.createElement("td");
      const titleBtn = document.createElement("button");
      titleBtn.type = "button";
      titleBtn.className = "owned-title-btn";
      titleBtn.textContent = program.title;
      tdName.appendChild(titleBtn);
      const subtype = getProgramSubtype(program, activeCategory.id);
      if (subtype) {
        const subtypeMeta = document.createElement("div");
        subtypeMeta.className = "market-program-meta";
        subtypeMeta.textContent = `Sous-type : ${subtype}`;
        tdName.appendChild(subtypeMeta);
      }
      if (Number(program.seasons) > 0 && Number(program.episodesPerSeason) > 0) {
        const meta = document.createElement("div");
        meta.className = "market-program-meta";
        const totalEpisodes = Number(program.totalEpisodes) > 0
          ? Number(program.totalEpisodes)
          : (Number(program.seasons) * Number(program.episodesPerSeason));
        meta.textContent = `${program.seasons} saisons • ${program.episodesPerSeason} épisodes/saison (${totalEpisodes} épisodes)`; 
        tdName.appendChild(meta);
      }

      const tdDuration = document.createElement("td");
      tdDuration.textContent = `${getProgramDuration(program)} min`;

      const tdStars = document.createElement("td");
      tdStars.appendChild(createStarsBadge(getProgramStars(program) || 1));

      const tdAge = document.createElement("td");
      const age = document.createElement("span");
      age.className = "film-class-badge age";
      age.textContent = getProgramAge(program) || "TP";
      age.dataset.ageRating = ageRatingToken(getProgramAge(program) || "TP");
      tdAge.appendChild(age);

      const tdStatus = document.createElement("td");
      tdStatus.appendChild(createStatusBadge(getProgramStatus(program), activeCategory.id));

      const tdDiff = document.createElement("td");
      tdDiff.textContent = String(getProgramDiffusionCount(program));

      const tdPrice = document.createElement("td");
      tdPrice.textContent = formatEuro(program.price || 0);

      const tdAction = document.createElement("td");
      tdAction.appendChild(buildBuyButton(program));

      tr.append(tdName, tdDuration, tdStars, tdAge, tdStatus, tdDiff, tdPrice, tdAction);
      tbody.appendChild(tr);

      const isEpisodic = Array.isArray(program.seasonsDetail) && program.seasonsDetail.length > 0;
      if (!isEpisodic) {
        titleBtn.disabled = true;
        titleBtn.classList.add("disabled");
        titleBtn.classList.add("not-clickable");
        return;
      }
      titleBtn.classList.add("clickable");

      titleBtn.addEventListener("click", () => {
        if (state.expandedPrograms.has(program.title)) {
          state.expandedPrograms.delete(program.title);
        } else {
          state.expandedPrograms.add(program.title);
        }
        renderMarket();
      });

      if (state.expandedPrograms.has(program.title)) {
        const detailTr = document.createElement("tr");
        detailTr.className = "owned-table-detail-row";
        const detailTd = document.createElement("td");
        detailTd.colSpan = 8;
        detailTd.appendChild(renderProgramDetails(program, activeCategory.id));
        detailTr.appendChild(detailTd);
        tbody.appendChild(detailTr);
      }
    });

    table.append(thead, tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function renderContent(activeCategory) {
    const target = document.getElementById("marketContent");
    if (!target) return;

    const container = document.createElement("div");
    container.className = "owned-v2-layout";
    container.appendChild(renderToolbar(activeCategory));

    const block = document.createElement("section");
    block.className = `game-block market-block market-list-fixed ${activeCategory.colorClass}`;

    const title = document.createElement("h2");
    title.textContent = activeCategory.name;

    const visiblePrograms = getVisiblePrograms(activeCategory);
    if (visiblePrograms.length === 0) {
      const empty = document.createElement("p");
      empty.className = "market-program-meta";
      empty.textContent = `Plus de ${String(activeCategory.name || "programmes").toLowerCase()} disponibles pour le moment.`;
      block.append(title, empty);
    } else {
      block.append(title, buildProgramTable(activeCategory, visiblePrograms));
    }

    container.appendChild(block);
    target.replaceChildren(container);
  }

  function renderMarket() {
    const categories = getCategories();
    const tabs = document.getElementById("marketTabs");
    const content = document.getElementById("marketContent");
    if (!tabs || !content) return;

    if (!categories) {
      const msg = document.createElement("p");
      msg.textContent = "Module marché indisponible.";
      tabs.replaceChildren();
      content.replaceChildren(msg);
      return;
    }

    if (!Array.isArray(categories) || categories.length === 0) {
      const msg = document.createElement("p");
      msg.className = "market-program-meta";
      msg.textContent = "Aucun type de programme disponible pour le moment.";
      tabs.replaceChildren();
      content.replaceChildren(msg);
      return;
    }

    if (!state.selectedCategoryId || !categories.some((c) => c.id === state.selectedCategoryId)) {
      state.selectedCategoryId = categories[0] ? categories[0].id : null;
    }

    renderTabs(categories);
    const active = categories.find((category) => category.id === state.selectedCategoryId);
    if (!active) {
      content.replaceChildren();
      return;
    }
    renderContent(active);
  }

  renderMarket();
})();
