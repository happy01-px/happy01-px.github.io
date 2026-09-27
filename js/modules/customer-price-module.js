(function initCustomerPriceModule(global) {
  function getPriceRecords() {
    if (!Array.isArray(mockData.customerProductPrices)) {
      mockData.customerProductPrices = [];
    }
    return mockData.customerProductPrices;
  }

  function getEffectiveCustomerPrice(customerId, productId, companyId) {
    return (
      getPriceRecords()
        .filter(
          (record) =>
            record.customerId === customerId &&
            record.productId === productId &&
            (!companyId || record.companyId === companyId) &&
            record.status !== "inactive",
        )
        .sort(
          (left, right) =>
            new Date(right.updatedAt || right.createdAt).getTime() -
            new Date(left.updatedAt || left.createdAt).getTime(),
        )[0] || null
    );
  }

  function getLastCustomerProductPrice(customerId, productId, companyId) {
    const getNoteTime = (note) => {
      for (const value of [note.deliveryDate, note.issueDate, note.createdAt]) {
        if (!value) continue;
        const timestamp = new Date(value).getTime();
        if (Number.isFinite(timestamp)) return timestamp;
      }
      return 0;
    };
    const notes = Array.isArray(mockData.deliveryNotes)
      ? mockData.deliveryNotes
          .slice()
          .sort((left, right) => getNoteTime(right) - getNoteTime(left))
      : [];
    for (const note of notes) {
      if (
        note.type !== "sales" ||
        note.customerId !== customerId ||
        (companyId && note.companyId !== companyId) ||
        ["voided", "cancelled"].includes(note.status)
      ) {
        continue;
      }
      const detail = (note.details || []).find(
        (entry) => entry.productId === productId,
      );
      if (detail) {
        const value = Number(detail.confirmedUnitPrice ?? detail.unitPrice);
        if (Number.isFinite(value)) return value;
      }
    }
    return null;
  }

  function buildPriceRows(customer, companyId) {
    const products = (mockData.products || [])
      .filter((product) => product.status !== "inactive")
      .sort((left, right) =>
        String(left.name).localeCompare(String(right.name), "zh-CN"),
      );
    if (!products.length) {
      return '<div class="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">请先建立商品档案，再维护客户价目表。</div>';
    }
    return products
      .map((product) => {
        const current = getEffectiveCustomerPrice(
          customer.id,
          product.id,
          companyId,
        );
        const lastPrice = getLastCustomerProductPrice(
          customer.id,
          product.id,
          companyId,
        );
        const referencePrice = current?.referencePrice ?? "";
        const taxMode =
          current?.priceTaxMode || customer.priceTaxMode || "exclusive";
        return `
          <tr class="border-b border-gray-200" data-price-row data-product-id="${escapeHTML(product.id)}" data-current-id="${escapeHTML(current?.id || "")}">
            <td class="px-3 py-3">
              <div class="font-medium text-gray-900">${escapeHTML(product.name || "-")}</div>
              <div class="mt-1 text-xs text-gray-500">${escapeHTML(product.category || "-")} · ${escapeHTML(product.unit || "-")}</div>
            </td>
            <td class="px-3 py-3 text-center text-sm text-gray-600">¥${Number(product.retailPrice || 0).toFixed(2)}</td>
            <td class="px-3 py-3 text-center text-sm text-gray-600">${lastPrice === null ? "-" : `¥${lastPrice.toFixed(2)}`}</td>
            <td class="px-3 py-3">
              <input data-field="referencePrice" type="number" min="0" step="0.01" value="${escapeHTML(referencePrice)}" placeholder="未设置" class="w-full rounded-md border border-gray-300 px-3 py-2 text-right focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
            </td>
            <td class="px-3 py-3">
              <select data-field="priceTaxMode" class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="exclusive" ${taxMode === "exclusive" ? "selected" : ""}>未税价</option>
                <option value="inclusive" ${taxMode === "inclusive" ? "selected" : ""}>含税价</option>
              </select>
            </td>
          </tr>`;
      })
      .join("");
  }

  function showCustomerPriceListModal(customerId) {
    if (typeof global.openCustomerPriceManagement === "function") {
      global.openCustomerPriceManagement(customerId);
      return;
    }
    const customer = (mockData.customers || []).find(
      (entry) => entry.id === customerId,
    );
    if (!customer) {
      alert("未找到对应的客户记录");
      return;
    }
    const companies = (mockData.companies || []).filter(
      (entry) => entry.status !== "inactive",
    );
    const companyId = companies[0]?.id || "";
    if (!companyId) {
      alert("请先建立公司档案");
      return;
    }
    const taxRate = Number(customer.defaultTaxRate || 0) * 100;
    const content = `
      <form id="customer-price-list-form" class="space-y-3">
        <div class="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
          <div class="font-semibold text-gray-900">${escapeHTML(customer.name)} · 商品参考价目表</div>
          <div class="mt-1 text-sm text-gray-600">公司：${escapeHTML(companies[0].name)}；默认税点 ${taxRate.toFixed(2).replace(/\.00$/, "")}%；送货时会带出参考价，但仍需人工确认本次单价。</div>
        </div>
        <div class="max-h-[55vh] overflow-auto rounded-lg border border-gray-200">
          <table class="w-full min-w-[760px] border-collapse">
            <thead class="sticky top-0 bg-gray-50 text-sm text-gray-700">
              <tr>
                <th class="px-3 py-3 text-left">商品</th>
                <th class="px-3 py-3 text-center">通用售价</th>
                <th class="px-3 py-3 text-center">上次成交</th>
                <th class="px-3 py-3 text-center">客户参考价</th>
                <th class="px-3 py-3 text-center">价格类型</th>
              </tr>
            </thead>
            <tbody>${buildPriceRows(customer, companyId)}</tbody>
          </table>
        </div>
        <p class="text-xs text-gray-500">修改价格会生成新的价格版本，历史送货单上的确认价格不会变化。留空表示暂不设置，不会删除历史版本。</p>
      </form>`;

    showModal("客户商品价目表", content, async () => {
      const rows = Array.from(document.querySelectorAll("[data-price-row]"));
      const beforePrices = JSON.parse(JSON.stringify(getPriceRecords()));
      const beforeLogs = Array.isArray(logsData) ? logsData.slice() : [];
      const now =
        typeof getLocalISOString === "function"
          ? getLocalISOString()
          : new Date().toISOString();
      let changed = 0;

      for (const row of rows) {
        const priceInput = row.querySelector('[data-field="referencePrice"]');
        const modeInput = row.querySelector('[data-field="priceTaxMode"]');
        const rawPrice = String(priceInput?.value || "").trim();
        if (!rawPrice) continue;
        const referencePrice = Number(rawPrice);
        if (!Number.isFinite(referencePrice) || referencePrice < 0) {
          alert("客户参考价必须是大于或等于 0 的有效数字");
          return false;
        }
        const productId = row.dataset.productId;
        const priceTaxMode =
          modeInput?.value === "inclusive" ? "inclusive" : "exclusive";
        const current = row.dataset.currentId
          ? getPriceRecords().find(
              (entry) => entry.id === row.dataset.currentId,
            )
          : null;
        if (
          current &&
          Number(current.referencePrice) === referencePrice &&
          current.priceTaxMode === priceTaxMode
        ) {
          continue;
        }
        if (current) {
          current.status = "inactive";
          current.updatedAt = now;
        }
        getPriceRecords().push({
          id: createRuntimeId("CPP"),
          companyId,
          customerId: customer.id,
          productId,
          referencePrice,
          priceTaxMode,
          status: "active",
          remark: "客户价目表维护",
          createdAt: now,
          updatedAt: now,
        });
        changed += 1;
      }

      if (!changed) {
        alert("价目表没有变化");
        return false;
      }
      const auditLogs = stageAuditLogs({
        actionType: "edit",
        objectType: "customer-price-list",
        objectName: customer.name,
        details: `更新客户商品参考价 ${changed} 项`,
      });
      const saved =
        typeof saveMockData === "function" ? await saveMockData() : true;
      if (saved === false) {
        mockData.customerProductPrices = beforePrices;
        logsData = beforeLogs;
        rollbackStagedAuditLogs(auditLogs);
        alert("客户价目表保存失败，变更已回滚");
        return false;
      }
      finalizeStagedAuditLogs(auditLogs);
      alert(`客户价目表已更新，共 ${changed} 项`);
      return true;
    });

    global.AppMasterDataCore?.configureWideFormModal?.("保存价目表");
  }

  global.getEffectiveCustomerPrice = getEffectiveCustomerPrice;
  global.getLastCustomerProductPrice = getLastCustomerProductPrice;
  global.showCustomerPriceListModal = showCustomerPriceListModal;
  global.AppCustomerPriceModule = Object.freeze({
    getEffectiveCustomerPrice,
    getLastCustomerProductPrice,
    showCustomerPriceListModal,
  });
})(window);
