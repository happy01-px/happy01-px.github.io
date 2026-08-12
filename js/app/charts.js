(function initChartsModule(global) {
  const DEFAULT_DASHBOARD_CHART_COLORS = [
    "#1a56db",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
    "#f97316",
    "#64748b",
  ];
  const dashboardChartInstances = {
    inventoryValue: null,
    inventoryCategory: null,
  };

  function getDesignToken(tokenName, fallback) {
    if (
      !global.document?.documentElement ||
      typeof global.getComputedStyle !== "function"
    ) {
      return fallback;
    }

    const value = global
      .getComputedStyle(global.document.documentElement)
      .getPropertyValue(tokenName)
      .trim();
    return value || fallback;
  }

  function getChartColors() {
    return {
      primary: getDesignToken("--ds-brand-7", "#1a56db"),
      primaryFill: getDesignToken("--ds-brand-fill", "rgba(26, 86, 219, 0.1)"),
      success: getDesignToken("--ds-success-8", "#10b981"),
      successFill: getDesignToken(
        "--ds-success-fill",
        "rgba(16, 185, 129, 0.1)",
      ),
      error: getDesignToken("--ds-error-5", "#ef4444"),
      palette: DEFAULT_DASHBOARD_CHART_COLORS,
    };
  }

  function normalizeList(value) {
    return Array.isArray(value) ? value : [];
  }

  function toFiniteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function roundCurrency(value) {
    return Math.round(toFiniteNumber(value) * 100) / 100;
  }

  function formatDashboardCurrency(value) {
    return `¥${roundCurrency(value).toLocaleString("zh-CN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  function getDashboardData() {
    return {
      products: normalizeList(global.mockData?.products),
      bills: normalizeList(global.mockData?.bills),
      stockMovements: normalizeList(global.stockMovementData),
    };
  }

  function getMonthKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function buildRecentMonths(now = new Date(), count = 7) {
    const current = now instanceof Date ? now : new Date(now);
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(
        current.getFullYear(),
        current.getMonth() - (count - index - 1),
        1,
      );
      const crossesYear = date.getFullYear() !== current.getFullYear();
      return {
        key: getMonthKey(date),
        label: crossesYear
          ? `${date.getFullYear()}年${date.getMonth() + 1}月`
          : `${date.getMonth() + 1}月`,
      };
    });
  }

  function getCurrentInventoryValue(products) {
    return normalizeList(products).reduce((total, product) => {
      const quantity = Math.max(0, toFiniteNumber(product?.stockQuantity));
      const costPrice = Math.max(0, toFiniteNumber(product?.costPrice));
      return total + quantity * costPrice;
    }, 0);
  }

  function getMovementValue(record, productPriceById) {
    const recordedPrice = toFiniteNumber(
      record?.price ?? record?.costPrice ?? record?.unitPrice,
    );
    const fallbackPrice = toFiniteNumber(
      productPriceById.get(String(record?.productId || "")),
    );
    const price = Math.max(0, recordedPrice || fallbackPrice);
    const quantity = Math.max(0, toFiniteNumber(record?.quantity));
    return quantity * price;
  }

  function buildInventoryValueTrend(
    products,
    stockMovements,
    now = new Date(),
  ) {
    const months = buildRecentMonths(now);
    const monthKeys = new Set(months.map((month) => month.key));
    const productPriceById = new Map(
      normalizeList(products).map((product) => [
        String(product?.id || ""),
        Math.max(0, toFiniteNumber(product?.costPrice)),
      ]),
    );
    const monthlyValueChanges = new Map();

    normalizeList(stockMovements).forEach((record) => {
      const monthKey = getMonthKey(record?.createdAt);
      if (!monthKeys.has(monthKey)) return;

      const movementValue = getMovementValue(record, productPriceById);
      if (!movementValue) return;

      const direction =
        record?.type === "inbound" ? 1 : record?.type === "outbound" ? -1 : 0;
      if (!direction) return;

      monthlyValueChanges.set(
        monthKey,
        toFiniteNumber(monthlyValueChanges.get(monthKey)) +
          direction * movementValue,
      );
    });

    const values = Array(months.length).fill(0);
    let monthEndValue = getCurrentInventoryValue(products);
    for (let index = months.length - 1; index >= 0; index -= 1) {
      values[index] = roundCurrency(Math.max(0, monthEndValue));
      monthEndValue -= toFiniteNumber(
        monthlyValueChanges.get(months[index].key),
      );
    }

    const firstMovementMonthIndex = months.findIndex((month) =>
      monthlyValueChanges.has(month.key),
    );
    const startIndex =
      firstMovementMonthIndex === -1
        ? months.length - 1
        : Math.max(0, firstMovementMonthIndex - 1);
    const visibleValues = values.slice(startIndex);

    return {
      labels: months.slice(startIndex).map((month) => month.label),
      values: visibleValues,
      hasData: visibleValues.some((value) => value > 0),
    };
  }

  function buildInventoryCategoryDistribution(products) {
    const valueByCategory = new Map();
    normalizeList(products).forEach((product) => {
      const quantity = Math.max(0, toFiniteNumber(product?.stockQuantity));
      const costPrice = Math.max(0, toFiniteNumber(product?.costPrice));
      const inventoryValue = quantity * costPrice;
      if (!inventoryValue) return;

      const category = String(product?.category || "").trim() || "未分类";
      valueByCategory.set(
        category,
        toFiniteNumber(valueByCategory.get(category)) + inventoryValue,
      );
    });

    const entries = Array.from(valueByCategory.entries()).sort(
      (left, right) => right[1] - left[1],
    );
    return {
      labels: entries.map(([category]) => category),
      values: entries.map(([, value]) => roundCurrency(value)),
      hasData: entries.length > 0,
    };
  }

  function normalizeDashboardBillStatus(status) {
    const statusMap = {
      paid: "paid",
      confirmed: "paid",
      cancelled: "cancelled",
      canceled: "cancelled",
    };
    return statusMap[String(status || "").trim()] || "pending";
  }

  function calculateDashboardMetrics(
    data = getDashboardData(),
    now = new Date(),
  ) {
    const products = normalizeList(data.products);
    const bills = normalizeList(data.bills);
    const stockMovements = normalizeList(data.stockMovements);
    const currentMonthKey = getMonthKey(now);

    return {
      totalInventoryValue: getCurrentInventoryValue(products),
      stockWarningCount: products.filter(
        (product) =>
          toFiniteNumber(product?.stockQuantity) <
          Math.max(0, toFiniteNumber(product?.minStock)),
      ).length,
      pendingBillCount: bills.filter(
        (bill) =>
          !["paid", "cancelled"].includes(
            normalizeDashboardBillStatus(bill?.status),
          ),
      ).length,
      monthlyInboundCount: stockMovements.filter(
        (record) =>
          record?.type === "inbound" &&
          getMonthKey(record?.createdAt) === currentMonthKey,
      ).length,
      productCount: products.length,
    };
  }

  function setTextContent(id, value) {
    const element = global.document?.getElementById(id);
    if (element) element.textContent = String(value);
  }

  function updateDashboardCards(metrics, now = new Date()) {
    setTextContent(
      "dashboard-total-inventory-value",
      formatDashboardCurrency(metrics.totalInventoryValue),
    );
    setTextContent("dashboard-stock-warning-count", metrics.stockWarningCount);
    setTextContent("dashboard-pending-bill-count", metrics.pendingBillCount);
    setTextContent(
      "dashboard-monthly-inbound-count",
      metrics.monthlyInboundCount,
    );

    setTextContent(
      "dashboard-total-inventory-value-caption",
      metrics.productCount ? "按当前库存成本计算" : "暂无库存数据",
    );
    setTextContent(
      "dashboard-stock-warning-caption",
      !metrics.productCount
        ? "暂无商品库存数据"
        : metrics.stockWarningCount
          ? `有 ${metrics.stockWarningCount} 个商品低于最低库存`
          : "当前库存状态正常",
    );
    setTextContent(
      "dashboard-pending-bill-caption",
      metrics.pendingBillCount
        ? "包含待核对、待付款及部分付款"
        : "暂无待处理对账单",
    );
    setTextContent(
      "dashboard-monthly-inbound-caption",
      metrics.monthlyInboundCount
        ? `${now.getMonth() + 1}月累计入库笔数`
        : "本月暂无入库记录",
    );
  }

  function setChartEmptyState(canvasId, emptyStateId, hasData) {
    const canvas = global.document?.getElementById(canvasId);
    const emptyState = global.document?.getElementById(emptyStateId);
    if (canvas) canvas.hidden = !hasData;
    if (emptyState) emptyState.hidden = hasData;
  }

  function clearDashboardChart(chartKey) {
    const chart = dashboardChartInstances[chartKey];
    if (chart && typeof chart.destroy === "function") chart.destroy();
    dashboardChartInstances[chartKey] = null;
  }

  function updateOrCreateDashboardChart(chartKey, canvas, config) {
    const currentChart = dashboardChartInstances[chartKey];
    if (currentChart && typeof currentChart.update === "function") {
      currentChart.data = config.data;
      currentChart.options = config.options;
      currentChart.update();
      return currentChart;
    }

    clearDashboardChart(chartKey);
    dashboardChartInstances[chartKey] = new global.Chart(canvas, config);
    return dashboardChartInstances[chartKey];
  }

  function renderDashboardCharts(data = getDashboardData(), now = new Date()) {
    const chartColors = getChartColors();
    const inventoryValueData = buildInventoryValueTrend(
      data.products,
      data.stockMovements,
      now,
    );
    const inventoryCategoryData = buildInventoryCategoryDistribution(
      data.products,
    );
    const inventoryValueCanvas = global.document?.getElementById(
      "inventoryValueChart",
    );
    const inventoryCategoryCanvas = global.document?.getElementById(
      "inventoryCategoryChart",
    );

    setChartEmptyState(
      "inventoryValueChart",
      "inventoryValueChartEmpty",
      inventoryValueData.hasData,
    );
    setChartEmptyState(
      "inventoryCategoryChart",
      "inventoryCategoryChartEmpty",
      inventoryCategoryData.hasData,
    );

    if (!inventoryValueData.hasData) {
      clearDashboardChart("inventoryValue");
    } else if (inventoryValueCanvas && typeof global.Chart !== "undefined") {
      updateOrCreateDashboardChart("inventoryValue", inventoryValueCanvas, {
        type: "line",
        data: {
          labels: inventoryValueData.labels,
          datasets: [
            {
              label: "库存价值（元）",
              data: inventoryValueData.values,
              borderColor: chartColors.primary,
              backgroundColor: chartColors.primaryFill,
              borderWidth: 2,
              tension: 0.3,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  return `库存价值：${formatDashboardCurrency(context.parsed.y)}`;
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { drawBorder: false },
              ticks: {
                callback(value) {
                  return formatDashboardCurrency(value);
                },
              },
            },
            x: { grid: { display: false } },
          },
        },
      });
    }

    if (!inventoryCategoryData.hasData) {
      clearDashboardChart("inventoryCategory");
    } else if (inventoryCategoryCanvas && typeof global.Chart !== "undefined") {
      updateOrCreateDashboardChart(
        "inventoryCategory",
        inventoryCategoryCanvas,
        {
          type: "doughnut",
          data: {
            labels: inventoryCategoryData.labels,
            datasets: [
              {
                data: inventoryCategoryData.values,
                backgroundColor: inventoryCategoryData.values.map(
                  (_, index) =>
                    chartColors.palette[index % chartColors.palette.length],
                ),
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: "bottom" },
              tooltip: {
                callbacks: {
                  label(context) {
                    return `${context.label}：${formatDashboardCurrency(context.parsed)}`;
                  },
                },
              },
            },
            cutout: "70%",
          },
        },
      );
    }

    return { inventoryValueData, inventoryCategoryData };
  }

  function refreshDashboardAnalytics(now = new Date()) {
    if (!global.document) return false;
    const data = getDashboardData();
    updateDashboardCards(calculateDashboardMetrics(data, now), now);
    renderDashboardCharts(data, now);
    return true;
  }

  function initCharts() {
    if (
      !global.document ||
      typeof global.document.getElementById !== "function"
    ) {
      return;
    }

    refreshDashboardAnalytics();

    if (typeof global.Chart === "undefined") {
      console.error("Chart.js is not loaded");
      return;
    }

    const chartColors = getChartColors();

    const inventoryTurnoverCtx = document.getElementById(
      "inventoryTurnoverChart",
    );
    if (inventoryTurnoverCtx) {
      new global.Chart(inventoryTurnoverCtx, {
        type: "line",
        data: {
          labels: ["1月", "2月", "3月", "4月", "5月", "6月", "7月"],
          datasets: [
            {
              label: "库存周转率",
              data: [3.2, 3.5, 3.8, 3.6, 4.0, 4.2, 4.5],
              borderColor: chartColors.success,
              backgroundColor: chartColors.successFill,
              borderWidth: 2,
              tension: 0.3,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: false,
              grid: {
                drawBorder: false,
              },
            },
            x: {
              grid: {
                display: false,
              },
            },
          },
        },
      });
    }

    const inventoryTurnoverRankingCtx = document.getElementById(
      "inventoryTurnoverRankingChart",
    );
    if (inventoryTurnoverRankingCtx) {
      new global.Chart(inventoryTurnoverRankingCtx, {
        type: "bar",
        data: {
          labels: ["MacBook Air", "Apple Watch", "iPhone", "AirPods", "iPad"],
          datasets: [
            {
              label: "库存周转率",
              data: [4.0, 4.0, 2.0, 2.0, 0.0],
              backgroundColor: [
                chartColors.success,
                chartColors.success,
                chartColors.primary,
                chartColors.primary,
                chartColors.error,
              ],
              borderWidth: 0,
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                drawBorder: false,
              },
            },
            x: {
              grid: {
                display: false,
              },
            },
          },
        },
      });
    }
  }

  function ensureChartsInitialized(sectionId = "") {
    if (sectionId && sectionId !== "dashboard" && sectionId !== "reports") {
      return false;
    }

    if (global.__appChartsInitialized) {
      return true;
    }

    initCharts();
    global.__appChartsInitialized = true;
    return true;
  }

  function scheduleChartsInitialization(sectionId = "") {
    if (sectionId && sectionId !== "dashboard" && sectionId !== "reports") {
      return false;
    }

    if (global.__appChartsInitialized || global.__appChartsInitScheduled) {
      return false;
    }

    global.__appChartsInitScheduled = true;
    const run = () => {
      global.__appChartsInitScheduled = false;
      if (
        !global.document ||
        typeof global.document.getElementById !== "function"
      ) {
        return;
      }
      ensureChartsInitialized(sectionId);
    };

    if (typeof global.requestIdleCallback === "function") {
      global.requestIdleCallback(run, { timeout: 500 });
      return true;
    }

    global.setTimeout(run, 0);
    return true;
  }

  global.initCharts = initCharts;
  global.refreshDashboardAnalytics = refreshDashboardAnalytics;
  global.calculateDashboardMetrics = calculateDashboardMetrics;
  global.buildInventoryValueTrend = buildInventoryValueTrend;
  global.buildInventoryCategoryDistribution =
    buildInventoryCategoryDistribution;
  global.ensureChartsInitialized = ensureChartsInitialized;
  global.scheduleChartsInitialization = scheduleChartsInitialization;
})(window);
