(function audiencesApp() {
  const engine = window.AudienceEngine;
  const resultsStore = window.AudienceResults;
  const sessionUtils = window.SessionUtils;
  const session = sessionUtils && typeof sessionUtils.requireSession === "function"
    ? sessionUtils.requireSession({ redirectPath: "index.html", persist: true, allowEmailParam: true, clearSearch: true })
    : null;
  if (!session) return;

  function getDayKeyByOffset(offsetDays) {
    const map = { 0: "dimanche", 1: "lundi", 2: "mardi", 3: "mercredi", 4: "jeudi", 5: "vendredi", 6: "samedi" };
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    return map[date.getDay()];
  }

  function formatDateByOffset(offsetDays) {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    const parts = new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long"
    }).formatToParts(date);
    const weekday = (parts.find((part) => part.type === "weekday") || { value: "" }).value;
    const day = (parts.find((part) => part.type === "day") || { value: "" }).value;
    const month = (parts.find((part) => part.type === "month") || { value: "" }).value;
    const cap = (value) => (value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value);
    return `${cap(weekday)} ${day} ${cap(month)}`.trim();
  }

  function renderRanking(simulation) {
    const container = document.getElementById("audienceRanking");
    if (!container) return;
    if (!simulation || !Array.isArray(simulation.ranking)) {
      const line = document.createElement("div");
      line.className = "ranking-row";
      line.textContent = "Audiences de la veille non encore calculées.";
      container.replaceChildren(line);
      return;
    }
    const rows = simulation.ranking.map((row, index) => {
      const line = document.createElement("div");
      line.className = `ranking-row ${row.id === "player" ? "player-row" : ""}`;

      const rank = document.createElement("span");
      rank.className = "ranking-rank";
      rank.textContent = `#${index + 1}`;

      const name = document.createElement("span");
      name.className = "ranking-name";
      name.textContent = row.name;

      const share = document.createElement("span");
      share.className = "ranking-share";
      share.textContent = `${row.share.toFixed(1)}%`;

      line.append(rank, name, share);
      return line;
    });
    container.replaceChildren(...rows);
  }

  function renderDetails(simulation) {
    const container = document.getElementById("audienceDetails");
    if (!container) return;
    if (!simulation || !Array.isArray(simulation.details) || simulation.details.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "Aucun détail disponible pour la veille.";
      container.replaceChildren(empty);
      return;
    }

    const table = document.createElement("table");
    table.className = "audience-table";
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");

    const baseHeaders = ["Créneau", "Leader"];
    baseHeaders.forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      headRow.appendChild(th);
    });

    simulation.channels.forEach((channel) => {
      const th = document.createElement("th");
      th.textContent = channel.name;
      headRow.appendChild(th);
    });

    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    simulation.details.forEach((slot) => {
      const row = document.createElement("tr");
      const time = document.createElement("td");
      time.textContent = `${engine.formatMinute(slot.start)} - ${engine.formatMinute(slot.end)}`;
      row.appendChild(time);

      let leader = { name: "-", share: -1 };
      simulation.channels.forEach((channel) => {
        const data = slot.shares[channel.id];
        if (data && data.share > leader.share) {
          leader = { name: channel.name, share: data.share };
        }
      });
      const leaderCell = document.createElement("td");
      leaderCell.textContent = `${leader.name} (${leader.share.toFixed(1)}%)`;
      row.appendChild(leaderCell);

      simulation.channels.forEach((channel) => {
        const data = slot.shares[channel.id];
        const td = document.createElement("td");
        td.textContent = `${data.share.toFixed(1)}%`;
        if (channel.id === "player") td.className = "player-cell";
        row.appendChild(td);
      });

      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    container.replaceChildren(table);
  }

  const chartState = {
    zoom: 1,
    colorByChannel: {},
    visibleChannels: new Set()
  };
  let currentSimulation = null;

  function getChannelColors(channels) {
    const palette = ["#5ec2ff", "#60dfa8", "#ffd166", "#f78fb3", "#c4a7ff", "#ff9f68"];
    const colors = {};
    channels.forEach((channel, index) => {
      colors[channel.id] = palette[index % palette.length];
    });
    return colors;
  }

  function renderChartLegend(simulation) {
    const legend = document.getElementById("audienceChartLegend");
    if (!legend) return;
    if (!simulation || !Array.isArray(simulation.channels)) {
      legend.replaceChildren();
      return;
    }

    const items = simulation.channels.map((channel) => {
      const label = document.createElement("label");
      label.className = "chart-legend-item";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = chartState.visibleChannels.has(channel.id);
      input.addEventListener("change", () => {
        if (input.checked) chartState.visibleChannels.add(channel.id);
        else chartState.visibleChannels.delete(channel.id);
        renderAudienceChart(simulation);
      });

      const swatch = document.createElement("span");
      swatch.className = "chart-legend-swatch";
      swatch.style.backgroundColor = chartState.colorByChannel[channel.id];

      const text = document.createElement("span");
      text.textContent = channel.name;

      label.append(input, swatch, text);
      return label;
    });

    legend.replaceChildren(...items);
  }

  function renderAudienceChart(simulation) {
    const svg = document.getElementById("audienceChart");
    const wrap = document.getElementById("audienceChartWrap");
    const zoomLabel = document.getElementById("chartZoomLabel");
    if (!svg || !wrap) return;

    if (!simulation || !Array.isArray(simulation.details) || simulation.details.length === 0) {
      svg.replaceChildren();
      svg.setAttribute("viewBox", "0 0 800 300");
      svg.setAttribute("width", "800");
      svg.setAttribute("height", "300");
      if (zoomLabel) zoomLabel.textContent = `${Math.round(chartState.zoom * 100)}%`;
      return;
    }

    const details = simulation.details;
    const containerWidth = Math.max(840, (wrap.clientWidth || 0) - 2);
    const baseWidth = Math.max(containerWidth, details.length * 34);
    const width = Math.round(baseWidth * chartState.zoom);
    const height = 300;
    const margin = { top: 16, right: 20, bottom: 36, left: 44 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    let maxShare = 0;
    simulation.channels.forEach((channel) => {
      details.forEach((slot) => {
        const data = slot.shares[channel.id];
        if (data && data.share > maxShare) maxShare = data.share;
      });
    });
    const yMax = Math.min(100, Math.max(10, maxShare + 5));

    svg.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
    if (zoomLabel) zoomLabel.textContent = `${Math.round(chartState.zoom * 100)}%`;

    const ns = "http://www.w3.org/2000/svg";

    for (let tick = 0; tick <= 5; tick += 1) {
      const share = (yMax / 5) * tick;
      const y = margin.top + ((yMax - share) / yMax) * plotHeight;
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", String(margin.left));
      line.setAttribute("x2", String(width - margin.right));
      line.setAttribute("y1", String(y));
      line.setAttribute("y2", String(y));
      line.setAttribute("stroke", "rgba(255,255,255,0.12)");
      line.setAttribute("stroke-width", "1");
      svg.appendChild(line);

      const label = document.createElementNS(ns, "text");
      label.setAttribute("x", String(margin.left - 8));
      label.setAttribute("y", String(y + 4));
      label.setAttribute("text-anchor", "end");
      label.setAttribute("fill", "rgba(237,244,255,0.82)");
      label.setAttribute("font-size", "11");
      label.textContent = `${share.toFixed(0)}%`;
      svg.appendChild(label);
    }

    const step = details.length > 1 ? plotWidth / (details.length - 1) : plotWidth;
    details.forEach((slot, index) => {
      if (index % 4 !== 0) return;
      const x = margin.left + (index * step);
      const tick = document.createElementNS(ns, "line");
      tick.setAttribute("x1", String(x));
      tick.setAttribute("x2", String(x));
      tick.setAttribute("y1", String(height - margin.bottom));
      tick.setAttribute("y2", String(height - margin.bottom + 6));
      tick.setAttribute("stroke", "rgba(255,255,255,0.28)");
      tick.setAttribute("stroke-width", "1");
      svg.appendChild(tick);

      const label = document.createElementNS(ns, "text");
      label.setAttribute("x", String(x));
      label.setAttribute("y", String(height - 8));
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("fill", "rgba(237,244,255,0.82)");
      label.setAttribute("font-size", "10");
      label.textContent = engine.formatMinute(slot.start);
      svg.appendChild(label);
    });

    simulation.channels.forEach((channel) => {
      if (!chartState.visibleChannels.has(channel.id)) return;
      const points = details.map((slot, index) => {
        const data = slot.shares[channel.id];
        const share = data ? data.share : 0;
        const x = margin.left + (index * step);
        const y = margin.top + ((yMax - share) / yMax) * plotHeight;
        return { x, y };
      });
      if (points.length === 0) return;

      const path = document.createElementNS(ns, "path");
      const d = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", chartState.colorByChannel[channel.id]);
      path.setAttribute("stroke-width", "2.5");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("stroke-linecap", "round");
      svg.appendChild(path);
    });

    wrap.scrollLeft = 0;
  }

  if (engine) {
    let dayKey = getDayKeyByOffset(-1);
    let simulation = null;
    if (resultsStore) {
      const ensured = resultsStore.ensureYesterdayCalculated(session);
      if (ensured) {
        dayKey = ensured.dayKey || dayKey;
        simulation = ensured.simulation || null;
      }
    } else {
      const playerWeek = engine.readPlayerWeek(session);
      simulation = engine.simulateDay(
        dayKey,
        session.username ? `${session.username} TV` : "Ta chaîne",
        playerWeek[dayKey]
      );
    }

    const label = document.getElementById("audienceDayLabel");
    if (label) {
      const dateText = formatDateByOffset(-1);
      label.textContent = dateText;
    }

    currentSimulation = simulation;
    if (simulation && Array.isArray(simulation.channels)) {
      chartState.colorByChannel = getChannelColors(simulation.channels);
      chartState.visibleChannels = new Set(simulation.channels.map((channel) => channel.id));
    }
    renderRanking(simulation);
    renderChartLegend(simulation);
    renderAudienceChart(simulation);
    renderDetails(simulation);
  } else {
    const label = document.getElementById("audienceDayLabel");
    if (label) {
      label.textContent = "Le moteur d'audience n'a pas chargé. Recharge la page.";
    }
  }

  const zoomInChartBtn = document.getElementById("zoomInChartBtn");
  if (zoomInChartBtn) {
    zoomInChartBtn.addEventListener("click", () => {
      chartState.zoom = Math.min(3.5, chartState.zoom + 0.25);
      renderAudienceChart(currentSimulation);
    });
  }

  const zoomOutChartBtn = document.getElementById("zoomOutChartBtn");
  if (zoomOutChartBtn) {
    zoomOutChartBtn.addEventListener("click", () => {
      chartState.zoom = Math.max(1, chartState.zoom - 0.25);
      renderAudienceChart(currentSimulation);
    });
  }

})();
