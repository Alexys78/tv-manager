(function financePageApp() {
  const finance = window.FinanceEngine;
  const sessionUtils = window.SessionUtils;
  const session = sessionUtils && typeof sessionUtils.requireSession === "function"
    ? sessionUtils.requireSession({ redirectPath: "index.html", persist: true, allowEmailParam: true, clearSearch: true })
    : null;
  if (!session) return;

  function formatEuro(value) {
    return sessionUtils.formatEuro(Number(value) || 0);
  }

  function formatPercent(value) {
    const safe = Number(value) || 0;
    return `${safe.toFixed(1)}%`;
  }

  function formatDateLabel(dateKey) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
    if (!match) return String(dateKey || "-");
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
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

  function toMonthKey(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  }

  function getRollingMonthKeys(limit) {
    const size = Math.max(1, Number(limit) || 12);
    const now = new Date();
    const keys = [];
    for (let i = 0; i < size; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(toMonthKey(d));
    }
    return keys;
  }

  function setYesterday(result) {
    const dateNode = document.getElementById("financeYesterdayDate");
    const revenueNode = document.getElementById("financeRevenueValue");
    const costsNode = document.getElementById("financeCostsValue");
    const netNode = document.getElementById("financeNetValue");
    if (!dateNode || !revenueNode || !costsNode || !netNode) return;

    if (!result) {
      dateNode.textContent = "-";
      revenueNode.textContent = "-";
      costsNode.textContent = "-";
      netNode.textContent = "-";
      return;
    }

    dateNode.textContent = formatDateLabel(result.dateKey);
    revenueNode.textContent = formatEuro(result.totalRevenue);
    costsNode.textContent = formatEuro(result.totalCosts);
    netNode.textContent = formatEuro(result.netResult);
    netNode.className = Number(result.netResult) >= 0 ? "kpi-positive" : "kpi-negative";
  }

  function renderHistory() {
    const body = document.getElementById("financeHistoryBody");
    if (!body) return;
    if (!finance || typeof finance.getHistory !== "function") {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.textContent = "Module finance indisponible.";
      row.appendChild(cell);
      body.replaceChildren(row);
      return;
    }

    const history = finance.getHistory(session).slice(-30).reverse();
    if (history.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.textContent = "Aucun résultat journalier disponible.";
      row.appendChild(cell);
      body.replaceChildren(row);
      return;
    }

    const rows = history.map((item) => {
      const row = document.createElement("tr");
      const dateCell = document.createElement("td");
      dateCell.textContent = formatDateLabel(item.dateKey);
      const audienceCell = document.createElement("td");
      audienceCell.textContent = formatPercent(item.audienceShare);
      const revenueCell = document.createElement("td");
      revenueCell.textContent = formatEuro(item.totalRevenue);
      const costsCell = document.createElement("td");
      costsCell.textContent = formatEuro(item.totalCosts);
      const netCell = document.createElement("td");
      netCell.className = Number(item.netResult) >= 0 ? "kpi-positive" : "kpi-negative";
      netCell.textContent = formatEuro(item.netResult);
      row.append(dateCell, audienceCell, revenueCell, costsCell, netCell);
      return row;
    });
    body.replaceChildren(...rows);
  }

  function renderMonthlySummary(monthKey) {
    const monthlyRealizedBody = document.getElementById("financeMonthlyRealizedBody");
    const monthlyProjectedBody = document.getElementById("financeMonthlyProjectedBody");
    const revenueNode = document.getElementById("financeMonthRevenueValue");
    const expenseNode = document.getElementById("financeMonthExpenseValue");
    const netNode = document.getElementById("financeMonthNetValue");
    if (!monthlyRealizedBody || !monthlyProjectedBody || !revenueNode || !expenseNode || !netNode) return;

    if (!finance || typeof finance.getMonthlySummary !== "function" || !monthKey) {
      revenueNode.textContent = "-";
      expenseNode.textContent = "-";
      netNode.textContent = "-";
      const realizedRow = document.createElement("tr");
      const realizedCell = document.createElement("td");
      realizedCell.colSpan = 4;
      realizedCell.textContent = "Synthèse mensuelle indisponible.";
      realizedRow.appendChild(realizedCell);
      const projectedRow = document.createElement("tr");
      const projectedCell = document.createElement("td");
      projectedCell.colSpan = 4;
      projectedCell.textContent = "Synthèse mensuelle indisponible.";
      projectedRow.appendChild(projectedCell);
      monthlyRealizedBody.replaceChildren(realizedRow);
      monthlyProjectedBody.replaceChildren(projectedRow);
      return;
    }

    const summary = finance.getMonthlySummary(session, monthKey);
    if (!summary) {
      revenueNode.textContent = formatEuro(0);
      expenseNode.textContent = formatEuro(0);
      netNode.textContent = formatEuro(0);
      netNode.className = "kpi-positive";
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.textContent = "Aucune opération pour ce mois.";
      row.appendChild(cell);
      monthlyRealizedBody.replaceChildren(row.cloneNode(true));
      monthlyProjectedBody.replaceChildren(row);
      return;
    }

    const realizedRows = Array.isArray(summary.realizedRows) ? summary.realizedRows : [];
    const projectedRows = Array.isArray(summary.projectedRows) ? summary.projectedRows : [];
    if (realizedRows.length === 0 && projectedRows.length === 0) {
      revenueNode.textContent = formatEuro(0);
      expenseNode.textContent = formatEuro(0);
      netNode.textContent = formatEuro(0);
      netNode.className = "kpi-positive";
      const emptyRealizedRow = document.createElement("tr");
      const emptyRealizedCell = document.createElement("td");
      emptyRealizedCell.colSpan = 4;
      emptyRealizedCell.textContent = "Aucune opération enregistrée pour ce mois.";
      emptyRealizedRow.appendChild(emptyRealizedCell);
      const emptyProjectedRow = document.createElement("tr");
      const emptyProjectedCell = document.createElement("td");
      emptyProjectedCell.colSpan = 4;
      emptyProjectedCell.textContent = "Aucune projection pour ce mois.";
      emptyProjectedRow.appendChild(emptyProjectedCell);
      monthlyRealizedBody.replaceChildren(emptyRealizedRow);
      monthlyProjectedBody.replaceChildren(emptyProjectedRow);
      return;
    }

    revenueNode.textContent = formatEuro(summary.totalRevenue);
    expenseNode.textContent = formatEuro(summary.totalExpense);
    netNode.textContent = formatEuro(summary.netResult);
    netNode.className = Number(summary.netResult) >= 0 ? "kpi-positive" : "kpi-negative";

    const buildRows = (items) => items.map((item) => {
      const row = document.createElement("tr");
      const categoryCell = document.createElement("td");
      categoryCell.textContent = item.category;
      row.appendChild(categoryCell);
      const revenueCell = document.createElement("td");
      revenueCell.textContent = formatEuro(item.revenue);
      const expenseCell = document.createElement("td");
      expenseCell.textContent = formatEuro(item.expense);
      const netCell = document.createElement("td");
      netCell.className = Number(item.net) >= 0 ? "kpi-positive" : "kpi-negative";
      netCell.textContent = formatEuro(item.net);
      row.append(revenueCell, expenseCell, netCell);
      return row;
    });

    if (realizedRows.length > 0) {
      monthlyRealizedBody.replaceChildren(...buildRows(realizedRows));
    } else {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.textContent = "Aucune opération enregistrée pour ce mois.";
      row.appendChild(cell);
      monthlyRealizedBody.replaceChildren(row);
    }

    if (projectedRows.length > 0) {
      monthlyProjectedBody.replaceChildren(...buildRows(projectedRows));
    } else {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.textContent = "Aucune projection pour ce mois.";
      row.appendChild(cell);
      monthlyProjectedBody.replaceChildren(row);
    }
  }

  function setupMonthSelector() {
    const select = document.getElementById("financeMonthSelect");
    if (!select) return;
    if (!finance || typeof finance.getMonthlySummary !== "function") {
      select.innerHTML = '<option value="">Aucun mois</option>';
      renderMonthlySummary("");
      return;
    }

    const months = getRollingMonthKeys(12).filter((monthKey) => {
      const summary = finance.getMonthlySummary(session, monthKey);
      if (!summary) return false;
      return Number(summary.totalRevenue) !== 0 || Number(summary.totalExpense) !== 0;
    });
    if (!Array.isArray(months) || months.length === 0) {
      select.innerHTML = '<option value="">Aucun mois</option>';
      renderMonthlySummary("");
      return;
    }

    select.innerHTML = "";
    months.forEach((monthKey) => {
      const option = document.createElement("option");
      option.value = monthKey;
      const summary = finance.getMonthlySummary(session, monthKey);
      option.textContent = summary && summary.monthLabel ? summary.monthLabel : monthKey;
      select.appendChild(option);
    });
    select.value = months[0];
    renderMonthlySummary(select.value);
    select.addEventListener("change", () => {
      renderMonthlySummary(select.value);
    });
  }

  function renderMonthlyHistory() {
    const body = document.getElementById("financeMonthlyHistoryBody");
    if (!body) return;

    if (!finance || typeof finance.getMonthlySummary !== "function") {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.textContent = "Synthèse mensuelle indisponible.";
      row.appendChild(cell);
      body.replaceChildren(row);
      return;
    }

    const monthKeys = getRollingMonthKeys(12);
    const rows = monthKeys.map((monthKey) => {
      const summary = finance.getMonthlySummary(session, monthKey);
      const row = document.createElement("tr");
      const monthCell = document.createElement("td");
      monthCell.textContent = summary && summary.monthLabel ? summary.monthLabel : monthKey;
      const revenueCell = document.createElement("td");
      revenueCell.textContent = formatEuro(summary ? summary.totalRevenue : 0);
      const expenseCell = document.createElement("td");
      expenseCell.textContent = formatEuro(summary ? summary.totalExpense : 0);
      const netCell = document.createElement("td");
      netCell.className = summary && Number(summary.netResult) >= 0 ? "kpi-positive" : "kpi-negative";
      netCell.textContent = formatEuro(summary ? summary.netResult : 0);
      row.append(monthCell, revenueCell, expenseCell, netCell);
      return row;
    });
    body.replaceChildren(...rows);
  }

  function setupTabs() {
    const dailyBtn = document.getElementById("financeTabDailyBtn");
    const monthlyBtn = document.getElementById("financeTabMonthlyBtn");
    const dailyPanel = document.getElementById("financeDailyPanel");
    const monthlyPanel = document.getElementById("financeMonthlyPanel");
    if (!dailyBtn || !monthlyBtn || !dailyPanel || !monthlyPanel) return;

    const activate = (mode) => {
      const showDaily = mode === "daily";
      dailyBtn.classList.toggle("active", showDaily);
      monthlyBtn.classList.toggle("active", !showDaily);
      dailyBtn.setAttribute("aria-selected", showDaily ? "true" : "false");
      monthlyBtn.setAttribute("aria-selected", showDaily ? "false" : "true");
      dailyPanel.classList.toggle("hidden", !showDaily);
      monthlyPanel.classList.toggle("hidden", showDaily);
      monthlyPanel.setAttribute("aria-hidden", showDaily ? "true" : "false");
      dailyPanel.setAttribute("aria-hidden", showDaily ? "false" : "true");
    };

    dailyBtn.addEventListener("click", () => activate("daily"));
    monthlyBtn.addEventListener("click", () => activate("monthly"));
    activate("daily");
  }

  const yesterday = finance && typeof finance.ensureYesterdayClosed === "function"
    ? finance.ensureYesterdayClosed(session)
    : null;
  setYesterday(yesterday);
  renderHistory();
  setupMonthSelector();
  renderMonthlyHistory();
  setupTabs();
})();
