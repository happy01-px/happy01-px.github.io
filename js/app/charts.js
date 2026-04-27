(function initChartsModule(global) {
  function initCharts() {
    if (
      !global.document ||
      typeof global.document.getElementById !== "function"
    ) {
      return;
    }

    if (typeof global.Chart === "undefined") {
      console.error("Chart.js is not loaded");
      return;
    }

    const inventoryValueCtx = document.getElementById("inventoryValueChart");
    if (inventoryValueCtx) {
      new global.Chart(inventoryValueCtx, {
        type: "line",
        data: {
          labels: ["1月", "2月", "3月", "4月", "5月", "6月", "7月"],
          datasets: [
            {
              label: "库存价值（万元）",
              data: [100, 110, 115, 105, 120, 125, 130],
              borderColor: "#1a56db",
              backgroundColor: "rgba(26, 86, 219, 0.1)",
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

    const inventoryCategoryCtx = document.getElementById(
      "inventoryCategoryChart",
    );
    if (inventoryCategoryCtx) {
      new global.Chart(inventoryCategoryCtx, {
        type: "doughnut",
        data: {
          labels: ["电子产品", "服装", "家具", "图书"],
          datasets: [
            {
              data: [65, 15, 10, 10],
              backgroundColor: ["#1a56db", "#10b981", "#f59e0b", "#ef4444"],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
            },
          },
          cutout: "70%",
        },
      });
    }

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
              borderColor: "#10b981",
              backgroundColor: "rgba(16, 185, 129, 0.1)",
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
                "#10b981",
                "#10b981",
                "#3b82f6",
                "#3b82f6",
                "#ef4444",
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
  global.ensureChartsInitialized = ensureChartsInitialized;
  global.scheduleChartsInitialization = scheduleChartsInitialization;
})(window);
