(function initMasterDataModule(global) {
  const core = global.AppMasterDataCore;
  if (!core) {
    throw new Error(
      "master-data-core.js must load before master-data-module.js",
    );
  }

  const {
    DOMESTIC_PHONE_REGEX,
    PAYMENT_OPTIONS,
    formatDateTime,
    normalizeTextValue,
    getEditableFieldValue,
    getStoredOptionalValue,
    getStatusMeta,
    buildRecordInfoCard,
    ensureUniqueName,
    ensureUniqueRecordId,
    renderStatusSelect,
    renderPaymentTermsSelect,
    countMatchingItems,
    requestDeleteConfirmation,
    createMasterDataSnapshot,
    persistMasterDataChanges,
    refreshInventoryDependencies,
    refreshStockDependencies,
    refreshBillDependencies,
    updateCustomerReferenceIds,
    configureReadonlyModal,
    getSafeDisplayValue,
    buildReadonlySummaryCard,
    buildReadonlyFieldCard,
    buildEditableFieldCard,
    buildFormIntroCard,
    configureWideFormModal,
  } = core;

  function showBusinessEditor(title, content, onConfirm, options = {}) {
    const open = global.showBusinessFormPage || global.showModal;
    return open?.(title, content, onConfirm, options);
  }

  function formError(form, selector, message) {
    if (typeof global.reportFormError === "function") {
      return global.reportFormError(message, selector, form);
    }
    global.alert(message);
    return false;
  }

  function showViewCompanyModal(companyId) {
    const company = mockData.companies.find((item) => item.id === companyId);
    if (!company) {
      alert("未找到对应的公司记录");
      return;
    }

    const statusMeta = getStatusMeta(company.status);
    const statusBadge = `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusMeta.className}">${escapeHTML(statusMeta.label)}</span>`;

    const content = `
            <div class="space-y-3">
                ${buildReadonlySummaryCard("building-o", company.name, `编号: ${company.id || "-"}`, statusMeta)}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${buildReadonlyFieldCard("公司名称", getSafeDisplayValue(company.name))}
                    ${buildReadonlyFieldCard("联系人", getSafeDisplayValue(company.contactPerson))}
                    ${buildReadonlyFieldCard("联系电话", getSafeDisplayValue(company.contactPhone))}
                    ${buildReadonlyFieldCard("电子邮箱", getSafeDisplayValue(company.email))}
                    ${buildReadonlyFieldCard("状态", statusBadge)}
                    ${buildReadonlyFieldCard("公司地址", getSafeDisplayValue(company.address), "md:col-span-2")}
                </div>
                ${buildRecordInfoCard(company)}
                <p class="text-xs text-gray-500">当前窗口为只读详情，仅用于查看公司信息。</p>
            </div>
        `;

    showModal("查看公司详情", content);
    configureReadonlyModal();
  }

  function showViewSupplierModal(supplierId) {
    const supplier = mockData.suppliers.find((item) => item.id === supplierId);
    if (!supplier) {
      alert("未找到对应的供应商记录");
      return;
    }

    const statusMeta = getStatusMeta(supplier.status);
    const statusBadge = `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusMeta.className}">${escapeHTML(statusMeta.label)}</span>`;

    const content = `
            <div class="space-y-3">
                ${buildReadonlySummaryCard("truck", supplier.name, `编号: ${supplier.id || "-"}`, statusMeta)}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${buildReadonlyFieldCard("供应商名称", getSafeDisplayValue(supplier.name))}
                    ${buildReadonlyFieldCard("联系人", getSafeDisplayValue(supplier.contactPerson))}
                    ${buildReadonlyFieldCard("联系电话", getSafeDisplayValue(supplier.contactPhone))}
                    ${buildReadonlyFieldCard("电子邮箱", getSafeDisplayValue(supplier.email))}
                    ${buildReadonlyFieldCard("付款条件", getSafeDisplayValue(supplier.paymentTerms))}
                    ${buildReadonlyFieldCard("状态", statusBadge)}
                    ${buildReadonlyFieldCard("地址", getSafeDisplayValue(supplier.address), "md:col-span-2")}
                </div>
                ${buildRecordInfoCard(supplier)}
                <p class="text-xs text-gray-500">当前窗口为只读详情，仅用于查看供应商信息。</p>
            </div>
        `;

    showModal("查看供应商详情", content);
    configureReadonlyModal();
  }

  function showViewCustomerModal(customerId) {
    const customer = mockData.customers.find((item) => item.id === customerId);
    if (!customer) {
      alert("未找到对应的客户记录");
      return;
    }

    const customerIdValue = escapeHTML(getEditableFieldValue(customer.id));
    const statusMeta = getStatusMeta(customer.status);
    const statusBadge = `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusMeta.className}">${escapeHTML(statusMeta.label)}</span>`;

    const content = `
            <div class="space-y-3">
                ${buildReadonlySummaryCard("users", customer.name, `编号: ${customer.id || "-"}`, statusMeta)}
                ${buildEditableFieldCard(
                  '客户编号 <span class="text-danger">*</span>',
                  `<div class="flex flex-col sm:flex-row gap-2">
                      <input type="text" id="view-customer-id-input" value="${customerIdValue}" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
                      <button type="button" id="view-customer-id-save" class="sm:w-24 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-md transition-all-300">保存</button>
                  </div>`,
                )}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${buildReadonlyFieldCard("客户名称", getSafeDisplayValue(customer.name))}
                    ${buildReadonlyFieldCard("联系人", getSafeDisplayValue(customer.contactPerson))}
                    ${buildReadonlyFieldCard("联系电话", getSafeDisplayValue(customer.contactPhone))}
                    ${buildReadonlyFieldCard("电子邮箱", getSafeDisplayValue(customer.email))}
                    ${buildReadonlyFieldCard("付款条件", getSafeDisplayValue(customer.paymentTerms))}
                    ${buildReadonlyFieldCard("默认税点", `${(Number(customer.defaultTaxRate || 0) * 100).toFixed(2).replace(/\.00$/, "")}%`)}
                    ${buildReadonlyFieldCard("价格类型", customer.priceTaxMode === "inclusive" ? "含税价" : "未税价")}
                    ${buildReadonlyFieldCard("状态", statusBadge)}
                    ${buildReadonlyFieldCard("客户地址", getSafeDisplayValue(customer.address), "md:col-span-2")}
                </div>
                ${buildRecordInfoCard(customer)}
                <p class="text-xs text-gray-500">当前窗口为只读详情，仅用于查看客户信息。</p>
            </div>
        `;

    showModal("查看客户详情", content);
    configureReadonlyModal();
    bindViewCustomerIdEditor(customer.id);
  }

  function bindViewCustomerIdEditor(customerId) {
    const input = document.getElementById("view-customer-id-input");
    const button = document.getElementById("view-customer-id-save");
    if (!input || !button) return;

    const saveCustomerId = async () => {
      const nextId = normalizeTextValue(input.value);
      const customer = mockData.customers.find(
        (item) => item.id === customerId,
      );

      if (!customer) {
        alert("未找到对应的客户记录");
        return;
      }

      if (!nextId) {
        alert("请输入客户编号");
        return;
      }

      if (nextId === customer.id) {
        alert("客户编号未变化");
        return;
      }

      if (
        !ensureUniqueRecordId(mockData.customers, customer.id, nextId, "客户")
      ) {
        return;
      }

      const previousId = customer.id;
      const snapshot = createMasterDataSnapshot();
      customer.id = nextId;
      customer.updatedAt = getLocalISOString();
      updateCustomerReferenceIds(previousId, nextId);

      const persisted = await persistMasterDataChanges(snapshot, "客户编号", {
        actionType: "edit",
        objectType: "customer",
        objectName: customer.name,
        details: `修改客户编号：${previousId} -> ${nextId}`,
      });
      if (!persisted) {
        input.value = previousId;
        return false;
      }
      updateCustomerTable();
      refreshBillDependencies();
      refreshStockDependencies();
      alert("客户编号已更新");
      document.getElementById("modal")?.classList.add("hidden");
      return true;
    };

    button.addEventListener("click", () => {
      saveCustomerId();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        saveCustomerId();
      }
    });
  }

  async function deleteCompany(companyId) {
    const companyIndex = mockData.companies.findIndex(
      (item) => item.id === companyId,
    );
    if (companyIndex === -1) {
      alert("未找到对应的公司记录");
      return false;
    }

    const company = mockData.companies[companyIndex];
    const relatedBillCount = countMatchingItems(
      mockData.bills,
      (item) => item.companyId === companyId,
    );
    const relatedDeliveryCount = countMatchingItems(
      mockData.deliveryNotes,
      (note) => note.companyId === companyId,
    );
    const relatedStockCount = countMatchingItems(
      stockMovementData,
      (item) => item.companyId === companyId,
    );
    const hasReferences =
      relatedBillCount + relatedDeliveryCount + relatedStockCount > 0;

    const ok = await requestDeleteConfirmation(
      "公司",
      company.name,
      [
        relatedBillCount > 0
          ? `已有 ${relatedBillCount} 张对账单会保留这家公司的历史快照。`
          : "",
        relatedDeliveryCount > 0
          ? `已有 ${relatedDeliveryCount} 张送货单会保留这家公司的历史快照。`
          : "",
        relatedStockCount > 0
          ? `已有 ${relatedStockCount} 条库存流水引用了这家公司。`
          : "",
      ],
      hasReferences ? "deactivate" : "delete",
    );
    if (!ok) return false;

    const snapshot = createMasterDataSnapshot();
    if (hasReferences) {
      company.status = "inactive";
      company.updatedAt = getLocalISOString();
    } else {
      mockData.companies.splice(companyIndex, 1);
    }
    const persisted = await persistMasterDataChanges(snapshot, "公司", {
      actionType: hasReferences ? "edit" : "delete",
      objectType: "company",
      objectName: company.name,
      details: hasReferences ? "停用公司" : "删除公司",
    });
    if (!persisted) return false;

    updateCompanyTable();
    refreshInventoryDependencies();
    alert(hasReferences ? "公司已停用，历史业务数据保持不变" : "公司已删除");
    return true;
  }

  async function deleteSupplier(supplierId) {
    const supplierIndex = mockData.suppliers.findIndex(
      (item) => item.id === supplierId,
    );
    if (supplierIndex === -1) {
      alert("未找到对应的供应商记录");
      return false;
    }

    const supplier = mockData.suppliers[supplierIndex];
    const relatedProductCount = countMatchingItems(
      mockData.products,
      (item) => item.supplierId === supplierId,
    );
    const relatedBillCount = countMatchingItems(
      mockData.bills,
      (item) =>
        item.partyId === supplierId && item.statementType === "supplier",
    );
    const relatedDeliveryCount = countMatchingItems(
      mockData.deliveryNotes,
      (note) => note.supplierId === supplierId,
    );
    const relatedStockCount = countMatchingItems(
      stockMovementData,
      (item) => item.supplierId === supplierId,
    );
    const hasReferences =
      relatedProductCount +
        relatedBillCount +
        relatedDeliveryCount +
        relatedStockCount >
      0;

    const ok = await requestDeleteConfirmation(
      "供应商",
      supplier.name,
      [
        relatedProductCount > 0
          ? `已有 ${relatedProductCount} 个商品关联了这家供应商。`
          : "",
        relatedBillCount > 0
          ? `已有 ${relatedBillCount} 张对账单会保留这家供应商的历史快照。`
          : "",
        relatedDeliveryCount > 0
          ? `已有 ${relatedDeliveryCount} 张送货单会保留这家供应商的历史快照。`
          : "",
        relatedStockCount > 0
          ? `已有 ${relatedStockCount} 条库存流水会保留这家供应商的历史快照。`
          : "",
      ],
      hasReferences ? "deactivate" : "delete",
    );
    if (!ok) return false;

    const snapshot = createMasterDataSnapshot();
    if (hasReferences) {
      supplier.status = "inactive";
      supplier.updatedAt = getLocalISOString();
    } else {
      mockData.suppliers.splice(supplierIndex, 1);
    }
    const persisted = await persistMasterDataChanges(snapshot, "供应商", {
      actionType: hasReferences ? "edit" : "delete",
      objectType: "supplier",
      objectName: supplier.name,
      details: hasReferences ? "停用供应商" : "删除供应商",
    });
    if (!persisted) return false;

    updateSupplierTable();
    refreshInventoryDependencies();
    refreshBillDependencies();
    refreshStockDependencies();
    alert(
      hasReferences ? "供应商已停用，历史业务数据保持不变" : "供应商已删除",
    );
    return true;
  }

  async function deleteCustomer(customerId) {
    const customerIndex = mockData.customers.findIndex(
      (item) => item.id === customerId,
    );
    if (customerIndex === -1) {
      alert("未找到对应的客户记录");
      return false;
    }

    const customer = mockData.customers[customerIndex];
    const relatedBillCount = countMatchingItems(
      mockData.bills,
      (item) =>
        item.partyId === customerId && item.statementType === "customer",
    );
    const relatedDeliveryCount = countMatchingItems(
      mockData.deliveryNotes,
      (note) => note.customerId === customerId,
    );
    const relatedStockCount = countMatchingItems(
      stockMovementData,
      (item) => item.customerId === customerId,
    );
    const relatedPriceCount = countMatchingItems(
      mockData.customerProductPrices,
      (item) => item.customerId === customerId,
    );
    const hasReferences =
      relatedBillCount +
        relatedDeliveryCount +
        relatedStockCount +
        relatedPriceCount >
      0;

    const ok = await requestDeleteConfirmation(
      "客户",
      customer.name,
      [
        relatedBillCount > 0
          ? `已有 ${relatedBillCount} 张对账单会保留这位客户的历史快照。`
          : "",
        relatedDeliveryCount > 0
          ? `已有 ${relatedDeliveryCount} 张送货单会保留这位客户的历史快照。`
          : "",
        relatedStockCount > 0
          ? `已有 ${relatedStockCount} 条库存流水会保留这位客户的历史快照。`
          : "",
        relatedPriceCount > 0
          ? `已有 ${relatedPriceCount} 条客户商品价目记录会继续保留。`
          : "",
      ],
      hasReferences ? "deactivate" : "delete",
    );
    if (!ok) return false;

    const snapshot = createMasterDataSnapshot();
    if (hasReferences) {
      customer.status = "inactive";
      customer.updatedAt = getLocalISOString();
    } else {
      mockData.customers.splice(customerIndex, 1);
    }
    const persisted = await persistMasterDataChanges(snapshot, "客户", {
      actionType: hasReferences ? "edit" : "delete",
      objectType: "customer",
      objectName: customer.name,
      details: hasReferences ? "停用客户" : "删除客户",
    });
    if (!persisted) return false;

    updateCustomerTable();
    refreshBillDependencies();
    refreshStockDependencies();
    alert(hasReferences ? "客户已停用，历史业务数据保持不变" : "客户已删除");
    return true;
  }

  function showAddCompanyModal() {
    const content = `
            <form id="add-company-form" class="space-y-3">
                ${buildFormIntroCard("building-o", "新增公司", "填写公司基础信息后即可创建，系统会自动分配编号并默认设为活跃状态。")}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${buildEditableFieldCard(
                      '公司名称 <span class="text-danger">*</span>',
                      '<input type="text" name="name" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      '联系人 <span class="text-danger">*</span>',
                      '<input type="text" name="contactPerson" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      '联系电话 <span class="text-danger">*</span>',
                      '<input type="tel" name="contactPhone" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="请输入国内手机号或座机号">',
                    )}
                    ${buildEditableFieldCard(
                      '公司地址 <span class="text-danger">*</span>',
                      '<input type="text" name="address" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                      "app-modal-two-thirds-row",
                    )}
                    ${buildEditableFieldCard(
                      "电子邮箱",
                      '<input type="email" name="email" class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                      "app-modal-third-row",
                    )}
                </div>
                <p class="text-xs text-gray-500">建议先填写常用联系人和联系电话，后续出货公司筛选会直接使用这里的信息。</p>
            </form>
        `;

    showBusinessEditor(
      "新增公司",
      content,
      async function onConfirm() {
        const form = document.getElementById("add-company-form");
        const formData = new FormData(form);
        const name = formData.get("name").trim();
        const contactPerson = formData.get("contactPerson").trim();
        const contactPhone = formData.get("contactPhone").trim();
        const address = formData.get("address").trim();
        const email = formData.get("email").trim();

        if (!name) {
          return formError(form, '[name="name"]', "请输入公司名称");
        }
        if (!contactPerson) {
          return formError(form, '[name="contactPerson"]', "请输入联系人");
        }
        if (!contactPhone) {
          return formError(form, '[name="contactPhone"]', "请输入联系电话");
        }
        if (!address) {
          return formError(form, '[name="address"]', "请输入公司地址");
        }
        if (!DOMESTIC_PHONE_REGEX.test(contactPhone)) {
          return formError(
            form,
            '[name="contactPhone"]',
            "请输入有效的国内联系电话（手机号或座机号）",
          );
        }

        const newCompany = {
          id: createSequentialId(mockData.companies, "CO"),
          name,
          contactPerson,
          contactPhone,
          address,
          email: email || "-",
          status: "active",
          createdAt: getLocalISOString(),
          updatedAt: getLocalISOString(),
        };

        const snapshot = createMasterDataSnapshot();
        mockData.companies.push(newCompany);
        const persisted = await persistMasterDataChanges(snapshot, "公司", {
          actionType: "add",
          objectType: "company",
          objectName: name,
          details: `新增公司，联系人：${contactPerson}`,
        });
        if (!persisted) return false;
        updateCompanyTable();
        global.showAntdMessage?.("success", "公司添加成功");
        return true;
      },
      {
        confirmText: "保存并返回",
        allowContinue: true,
        continueText: "保存并继续新增",
        onContinue: showAddCompanyModal,
      },
    );

    configureWideFormModal("保存并返回");
  }

  function showEditCompanyModal(companyId) {
    const company = mockData.companies.find((item) => item.id === companyId);
    if (!company) {
      alert("未找到对应的公司记录");
      return;
    }

    const nameValue = escapeHTML(getEditableFieldValue(company.name));
    const contactPersonValue = escapeHTML(
      getEditableFieldValue(company.contactPerson),
    );
    const contactPhoneValue = escapeHTML(
      getEditableFieldValue(company.contactPhone),
    );
    const addressValue = escapeHTML(getEditableFieldValue(company.address));
    const statusValue = escapeHTML(getStatusMeta(company.status).value);
    const statusMeta = getStatusMeta(company.status);

    const content = `
            <form id="edit-company-form" class="space-y-3">
                ${buildReadonlySummaryCard("building-o", company.name, `编号: ${company.id || "-"}`, statusMeta)}
                ${buildRecordInfoCard(company)}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${buildEditableFieldCard(
                      '公司名称 <span class="text-danger">*</span>',
                      `<input type="text" name="name" required value="${nameValue}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      '联系人 <span class="text-danger">*</span>',
                      `<input type="text" name="contactPerson" required value="${contactPersonValue}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      '联系电话 <span class="text-danger">*</span>',
                      `<input type="tel" name="contactPhone" required value="${contactPhoneValue}" placeholder="请输入国内手机号或座机号" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      '状态 <span class="text-danger">*</span>',
                      `<div id="edit-company-status-container" class="w-full"></div><input type="hidden" name="status" id="edit-company-status-input" value="${statusValue}">`,
                      "app-modal-third-row",
                    )}
                    ${buildEditableFieldCard(
                      '公司地址 <span class="text-danger">*</span>',
                      `<input type="text" name="address" required value="${addressValue}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                      "app-modal-two-thirds-row",
                    )}
                </div>
                <p class="text-xs text-gray-500">当前窗口为编辑模式，修改后点击保存即可更新公司信息。</p>
            </form>
        `;

    showBusinessEditor("编辑公司", content, async function onConfirm() {
      const form = document.getElementById("edit-company-form");

      const formData = new FormData(form);
      const name = normalizeTextValue(formData.get("name"));
      const contactPerson = normalizeTextValue(formData.get("contactPerson"));
      const contactPhone = normalizeTextValue(formData.get("contactPhone"));
      const address = normalizeTextValue(formData.get("address"));
      const status =
        normalizeTextValue(
          document.getElementById("edit-company-status-input").value,
        ) || "active";

      if (!name) {
        return formError(form, '[name="name"]', "请输入公司名称");
      }
      if (!contactPerson) {
        return formError(form, '[name="contactPerson"]', "请输入联系人");
      }
      if (!contactPhone) {
        return formError(form, '[name="contactPhone"]', "请输入联系电话");
      }
      if (!address) {
        return formError(form, '[name="address"]', "请输入公司地址");
      }
      if (!DOMESTIC_PHONE_REGEX.test(contactPhone)) {
        return formError(
          form,
          '[name="contactPhone"]',
          "请输入有效的国内联系电话（手机号或座机号）",
        );
      }
      if (!ensureUniqueName(mockData.companies, company.id, name, "公司")) {
        return false;
      }

      const snapshot = createMasterDataSnapshot();
      Object.assign(company, {
        name,
        contactPerson,
        contactPhone,
        address,
        status,
        updatedAt: getLocalISOString(),
      });

      const persisted = await persistMasterDataChanges(snapshot, "公司", {
        actionType: "edit",
        objectType: "company",
        objectName: name,
        details: `编辑公司信息，联系人：${contactPerson}`,
      });
      if (!persisted) return false;
      updateCompanyTable();
      alert("公司信息已更新");
      return true;
    });

    configureWideFormModal("保存");
    renderStatusSelect(
      "edit-company-status-container",
      "edit-company-status-input",
      company.status || "active",
    );
  }

  function updateCompanyTable() {
    const tbody = document.querySelector("#companies tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const sortedCompanies = [...mockData.companies].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    paginationState.companies.total = sortedCompanies.length;
    let { page, pageSize } = paginationState.companies;

    const totalPages = Math.ceil(sortedCompanies.length / pageSize);
    if (page > totalPages && totalPages > 0) {
      paginationState.companies.page = totalPages;
      page = totalPages;
    }

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedCompanies = sortedCompanies.slice(startIndex, endIndex);

    if (paginatedCompanies.length === 0) {
      renderAntdEmptyTableRow(tbody, 7, "暂无公司记录");
      renderPaginationControl(
        "company-pagination-container",
        "companies",
        updateCompanyTable,
      );
      return;
    }

    paginatedCompanies.forEach((company) => {
      const formattedCreatedAt = formatDateTime(company.createdAt);
      const formattedUpdatedAt = formatDateTime(company.updatedAt);
      const safeCompanyName = escapeHTML(company.name || "-");
      const safeContactPerson = escapeHTML(company.contactPerson || "-");
      const safeContactPhone = escapeHTML(company.contactPhone || "-");
      const safeAddress = escapeHTML(company.address || "-");
      const statusMeta = getStatusMeta(company.status);
      const safeStatusLabel = escapeHTML(statusMeta.label);

      const row = document.createElement("tr");
      row.dataset.recordId = company.id;
      row.innerHTML = `
                <td class="px-6 py-4 align-middle">
                    <div class="table-long-text company-cell-wrap text-sm font-medium text-gray-900" title="${safeCompanyName}">${safeCompanyName}</div>
                </td>
                <td class="px-6 py-4 align-middle whitespace-nowrap text-sm text-gray-500">${safeContactPerson}</td>
                <td class="px-6 py-4 align-middle whitespace-nowrap text-sm text-gray-500">${safeContactPhone}</td>
                <td class="px-6 py-4 align-middle text-sm text-gray-500"><div class="table-long-text company-cell-wrap" title="${safeAddress}">${safeAddress}</div></td>
                <td class="px-6 py-4 align-middle whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusMeta.className}">${safeStatusLabel}</span>
                </td>
                <td class="px-6 py-4 align-middle text-sm text-gray-500 whitespace-nowrap">
                    <div class="space-y-1">
                        <div class="flex items-center">
                            <span class="text-xs text-gray-500 whitespace-nowrap">创建时间:</span>
                            <span class="flex items-center whitespace-nowrap">
                                <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(currentUser.name)}</span>
                                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedCreatedAt}</span>
                            </span>
                        </div>
                        <div class="flex items-center">
                            <span class="text-xs text-gray-500 whitespace-nowrap">更新时间:</span>
                            <span class="flex items-center whitespace-nowrap">
                                <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(currentUser.name)}</span>
                                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedUpdatedAt}</span>
                            </span>
                        </div>
                    </div>
                </td>
                <td class="table-action-cell px-6 py-4 align-middle whitespace-nowrap text-left text-sm font-medium">
                    <div class="table-action-links">
                        <button type="button" class="text-blue-600 hover:text-blue-900" data-action="view">查看</button>
                        <button type="button" class="text-primary hover:text-primary-dark" data-action="edit">编辑</button>
                        <button type="button" class="text-danger hover:text-danger-dark" data-action="delete">删除</button>
                    </div>
                </td>
            `;
      const viewButton = row.querySelector('[data-action="view"]');
      const editButton = row.querySelector('[data-action="edit"]');
      const deleteButton = row.querySelector('[data-action="delete"]');
      if (viewButton) {
        viewButton.addEventListener("click", () =>
          showViewCompanyModal(company.id),
        );
      }
      if (editButton) {
        editButton.addEventListener("click", () =>
          showEditCompanyModal(company.id),
        );
      }
      if (deleteButton) {
        deleteButton.addEventListener("click", () => deleteCompany(company.id));
      }
      tbody.appendChild(row);
    });

    renderPaginationControl(
      "company-pagination-container",
      "companies",
      updateCompanyTable,
    );
  }

  function showAddSupplierModal() {
    const content = `
            <form id="add-supplier-form" class="space-y-3">
                ${buildFormIntroCard("truck", "新增供应商", "填写供应商基础信息后即可创建，系统会默认设为活跃状态。")}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${buildEditableFieldCard(
                      '供应商名称 <span class="text-danger">*</span>',
                      '<input type="text" name="name" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      '联系人 <span class="text-danger">*</span>',
                      '<input type="text" name="contactPerson" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      '联系电话 <span class="text-danger">*</span>',
                      '<input type="tel" name="contactPhone" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      "地址",
                      '<input type="text" name="address" class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="选填，未填写时默认记为 -">',
                      "app-modal-two-thirds-row",
                    )}
                    ${buildEditableFieldCard(
                      "付款条件",
                      '<div id="add-supplier-payment-container" class="w-full"></div><input type="hidden" name="paymentTerms" id="add-supplier-payment-input">',
                      "app-modal-third-row",
                    )}
                </div>
                <p class="text-xs text-gray-500">建议把付款条件先补全，后续进货和对账会直接引用这里的配置。</p>
            </form>
        `;

    showBusinessEditor(
      "新增供应商",
      content,
      async function onConfirm() {
        const form = document.getElementById("add-supplier-form");
        const formData = new FormData(form);
        const name = formData.get("name").trim();
        const contactPerson = formData.get("contactPerson").trim();
        const contactPhone = formData.get("contactPhone").trim();
        const address = formData.get("address").trim();
        const paymentTerms = document.getElementById(
          "add-supplier-payment-input",
        ).value;

        if (!name) {
          return formError(form, '[name="name"]', "请输入供应商名称");
        }
        if (!contactPerson) {
          return formError(form, '[name="contactPerson"]', "请输入联系人");
        }
        if (!contactPhone) {
          return formError(form, '[name="contactPhone"]', "请输入联系电话");
        }
        if (!DOMESTIC_PHONE_REGEX.test(contactPhone)) {
          return formError(
            form,
            '[name="contactPhone"]',
            "请输入有效的国内联系电话（手机号或座机号）",
          );
        }

        const newSupplier = {
          id: createSequentialId(mockData.suppliers, "S"),
          name,
          contactPerson,
          contactPhone,
          email: "-",
          address: address || "-",
          paymentTerms: paymentTerms || "Net 30",
          creditLimit: 0,
          status: "active",
          createdAt: getLocalISOString(),
          updatedAt: getLocalISOString(),
        };

        const snapshot = createMasterDataSnapshot();
        mockData.suppliers.push(newSupplier);
        const persisted = await persistMasterDataChanges(snapshot, "供应商", {
          actionType: "add",
          objectType: "supplier",
          objectName: name,
          details: `新增供应商，联系人：${contactPerson}`,
        });
        if (!persisted) return false;
        updateSupplierTable();
        global.showAntdMessage?.("success", "供应商添加成功");
        return true;
      },
      {
        confirmText: "保存并返回",
        allowContinue: true,
        continueText: "保存并继续新增",
        onContinue: showAddSupplierModal,
      },
    );

    configureWideFormModal("保存并返回");
    renderAntdSelect(
      "add-supplier-payment-container",
      "add-supplier-payment-input",
      PAYMENT_OPTIONS,
      "Net 30",
    );
  }

  function showEditSupplierModal(supplierId) {
    const supplier = mockData.suppliers.find((item) => item.id === supplierId);
    if (!supplier) {
      alert("未找到对应的供应商记录");
      return;
    }

    const nameValue = escapeHTML(getEditableFieldValue(supplier.name));
    const contactPersonValue = escapeHTML(
      getEditableFieldValue(supplier.contactPerson),
    );
    const contactPhoneValue = escapeHTML(
      getEditableFieldValue(supplier.contactPhone),
    );
    const addressValue = escapeHTML(getEditableFieldValue(supplier.address));
    const paymentTermsValue = escapeHTML(
      getEditableFieldValue(supplier.paymentTerms),
    );
    const statusValue = escapeHTML(getStatusMeta(supplier.status).value);
    const statusMeta = getStatusMeta(supplier.status);

    const content = `
            <form id="edit-supplier-form" class="space-y-3">
                ${buildReadonlySummaryCard("truck", supplier.name, `编号: ${supplier.id || "-"}`, statusMeta)}
                ${buildRecordInfoCard(supplier)}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${buildEditableFieldCard(
                      '供应商名称 <span class="text-danger">*</span>',
                      `<input type="text" name="name" required value="${nameValue}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      '联系人 <span class="text-danger">*</span>',
                      `<input type="text" name="contactPerson" required value="${contactPersonValue}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      '联系电话 <span class="text-danger">*</span>',
                      `<input type="tel" name="contactPhone" required value="${contactPhoneValue}" placeholder="请输入国内手机号或座机号" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      "地址",
                      `<input type="text" name="address" value="${addressValue}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                      "app-modal-two-thirds-row",
                    )}
                    ${buildEditableFieldCard(
                      "付款条件",
                      `<div id="edit-supplier-payment-container" class="w-full"></div><input type="hidden" name="paymentTerms" id="edit-supplier-payment-input" value="${paymentTermsValue}">`,
                      "app-modal-third-row",
                    )}
                    ${buildEditableFieldCard(
                      '状态 <span class="text-danger">*</span>',
                      `<div id="edit-supplier-status-container" class="w-full"></div><input type="hidden" name="status" id="edit-supplier-status-input" value="${statusValue}">`,
                      "app-modal-wide-field",
                    )}
                </div>
                <p class="text-xs text-gray-500">当前窗口为编辑模式，修改后点击保存即可更新供应商信息。</p>
            </form>
        `;

    showBusinessEditor("编辑供应商", content, async function onConfirm() {
      const form = document.getElementById("edit-supplier-form");

      const formData = new FormData(form);
      const name = normalizeTextValue(formData.get("name"));
      const contactPerson = normalizeTextValue(formData.get("contactPerson"));
      const contactPhone = normalizeTextValue(formData.get("contactPhone"));
      const address = normalizeTextValue(formData.get("address"));
      const paymentTerms = normalizeTextValue(
        document.getElementById("edit-supplier-payment-input").value,
      );
      const status =
        normalizeTextValue(
          document.getElementById("edit-supplier-status-input").value,
        ) || "active";

      if (!name) {
        return formError(form, '[name="name"]', "请输入供应商名称");
      }
      if (!contactPerson) {
        return formError(form, '[name="contactPerson"]', "请输入联系人");
      }
      if (!contactPhone) {
        return formError(form, '[name="contactPhone"]', "请输入联系电话");
      }
      if (!DOMESTIC_PHONE_REGEX.test(contactPhone)) {
        return formError(
          form,
          '[name="contactPhone"]',
          "请输入有效的国内联系电话（手机号或座机号）",
        );
      }
      if (!ensureUniqueName(mockData.suppliers, supplier.id, name, "供应商")) {
        return false;
      }

      const snapshot = createMasterDataSnapshot();
      Object.assign(supplier, {
        name,
        contactPerson,
        contactPhone,
        address: getStoredOptionalValue(address),
        paymentTerms: getStoredOptionalValue(paymentTerms),
        creditLimit: Number.isFinite(Number(supplier.creditLimit))
          ? Number(supplier.creditLimit)
          : 0,
        status,
        updatedAt: getLocalISOString(),
      });

      const persisted = await persistMasterDataChanges(snapshot, "供应商", {
        actionType: "edit",
        objectType: "supplier",
        objectName: name,
        details: `编辑供应商信息，联系人：${contactPerson}`,
      });
      if (!persisted) return false;
      updateSupplierTable();
      alert("供应商信息已更新");
      return true;
    });

    configureWideFormModal("保存");
    renderPaymentTermsSelect(
      "edit-supplier-payment-container",
      "edit-supplier-payment-input",
      getEditableFieldValue(supplier.paymentTerms),
      "请选择付款条件",
    );
    renderStatusSelect(
      "edit-supplier-status-container",
      "edit-supplier-status-input",
      supplier.status || "active",
    );
  }

  function bindCustomerTaxRateControls(mode, initialValues = {}) {
    const prefix = `${mode}-customer-tax-rate`;
    const form = document.getElementById(`${mode}-customer-form`);
    const choiceContainer = document.getElementById(
      `${prefix}-choice-container`,
    );
    const choiceInput = document.getElementById(`${prefix}-choice-input`);
    const wrap = document.getElementById(`${prefix}-wrap`);
    const input = document.getElementById(`${prefix}-input`);
    if (!form || !choiceContainer || !choiceInput || !wrap || !input) return;

    const initialChoice = initialValues.choice || choiceInput.value || "";
    const initialCoefficient =
      initialChoice === "yes" && initialValues.coefficient != null
        ? String(initialValues.coefficient)
        : "";
    choiceInput.value = initialChoice;
    input.value = initialCoefficient;

    const syncVisibility = () => {
      const selectedValue = choiceInput.value || "";
      const shouldShow = selectedValue === "yes";
      wrap.classList.toggle("invisible", !shouldShow);
      wrap.classList.toggle("pointer-events-none", !shouldShow);
      wrap.setAttribute("aria-hidden", shouldShow ? "false" : "true");
      input.required = shouldShow;

      if (!shouldShow) {
        input.value = "";
      }
    };

    if (typeof renderAntdRadioGroup === "function") {
      const radioConfig = { name: "hasTaxRate" };
      if (initialChoice) radioConfig.defaultValue = initialChoice;

      renderAntdRadioGroup(
        `${prefix}-choice-container`,
        `${prefix}-choice-input`,
        [
          { value: "no", label: "否" },
          { value: "yes", label: "是" },
        ],
        radioConfig,
        (value) => {
          choiceInput.value = value || "";
          syncVisibility();
        },
      );
    }

    if (typeof renderAntdInput === "function") {
      renderAntdInput(`${prefix}-input-container`, `${prefix}-input`, {
        placeholder: "请输入税点，例如 7",
        inputMode: "decimal",
        defaultValue: initialCoefficient,
      });
    }

    choiceInput.addEventListener("change", syncVisibility);
    syncVisibility();
  }

  function showAddCustomerModal() {
    const content = `
            <form id="add-customer-form" class="space-y-3">
                ${buildFormIntroCard("users", "新增客户", "填写客户基础信息后即可创建，系统会默认设为活跃状态。")}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${buildEditableFieldCard(
                      '客户名称 <span class="text-danger">*</span>',
                      '<input type="text" name="name" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      '客户编号 <span class="text-danger">*</span>',
                      '<input type="text" name="id" required placeholder="请输入客户编号" class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      '联系人 <span class="text-danger">*</span>',
                      '<input type="text" name="contactPerson" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      '联系电话 <span class="text-danger">*</span>',
                      '<input type="tel" name="contactPhone" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="请输入国内手机号或座机号">',
                    )}
                    ${buildEditableFieldCard(
                      '默认税点 <span class="text-danger">*</span>',
                      `<div class="flex min-h-[40px] flex-col gap-2 sm:flex-row sm:items-center">
                          <div id="add-customer-tax-rate-choice-container" class="shrink-0"></div>
                          <input type="hidden" name="hasTaxRate" id="add-customer-tax-rate-choice-input" required>
                          <div id="add-customer-tax-rate-wrap" class="invisible pointer-events-none min-w-0 flex-1" aria-hidden="true">
                              <div id="add-customer-tax-rate-input-container" class="w-full"></div>
                              <input type="hidden" name="taxRateCoefficient" id="add-customer-tax-rate-input">
                          </div>
                      </div>`,
                      "app-modal-two-thirds-row",
                    )}
                    ${buildEditableFieldCard(
                      '价格类型 <span class="text-danger">*</span>',
                      `<select name="priceTaxMode" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
                          <option value="exclusive" selected>未税价</option>
                          <option value="inclusive">含税价</option>
                      </select>`,
                    )}
                    ${buildEditableFieldCard(
                      '客户地址 <span class="text-danger">*</span>',
                      '<input type="text" name="address" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                      "app-modal-two-thirds-row",
                    )}
                    ${buildEditableFieldCard(
                      '付款条件 <span class="text-danger">*</span>',
                      '<div id="add-customer-payment-container" class="w-full"></div><input type="hidden" name="paymentTerms" id="add-customer-payment-input" required>',
                      "app-modal-third-row",
                    )}
                </div>
                <p class="text-xs text-gray-500">建议把付款条件和地址一起补全，后续销售单和送货单会直接引用这些数据。</p>
            </form>
        `;

    showBusinessEditor(
      "新增客户",
      content,
      async function onConfirm() {
        const form = document.getElementById("add-customer-form");
        const formData = new FormData(form);

        const id = normalizeTextValue(formData.get("id"));
        const name = formData.get("name").trim();
        const contactPerson = formData.get("contactPerson").trim();
        const contactPhone = formData.get("contactPhone").trim();
        const address = formData.get("address").trim();
        const hasTaxRate = normalizeTextValue(formData.get("hasTaxRate"));
        const taxRateCoefficientText = normalizeTextValue(
          formData.get("taxRateCoefficient"),
        );
        const paymentTerms = document.getElementById(
          "add-customer-payment-input",
        ).value;
        const priceTaxMode = normalizeTextValue(formData.get("priceTaxMode"));
        let taxRateCoefficient = null;
        let defaultTaxRate = 0;

        if (!id) {
          return formError(form, '[name="id"]', "请输入客户编号");
        }
        if (!name) {
          return formError(form, '[name="name"]', "请输入客户名称");
        }
        if (!contactPerson) {
          return formError(form, '[name="contactPerson"]', "请输入联系人");
        }
        if (!contactPhone) {
          return formError(form, '[name="contactPhone"]', "请输入联系电话");
        }
        if (!address) {
          return formError(form, '[name="address"]', "请输入客户地址");
        }
        if (!paymentTerms) {
          return formError(
            form,
            "#add-customer-payment-container",
            "请选择付款条件",
          );
        }
        if (!hasTaxRate) {
          return formError(
            form,
            "#add-customer-tax-rate-choice-container",
            "请选择是否有税点",
          );
        }
        if (hasTaxRate === "yes") {
          if (!taxRateCoefficientText) {
            return formError(
              form,
              "#add-customer-tax-rate-input-container",
              "请输入税点，例如 7",
            );
          }

          const taxPoint = Number(taxRateCoefficientText);
          if (!Number.isFinite(taxPoint) || taxPoint <= 0 || taxPoint > 100) {
            return formError(
              form,
              "#add-customer-tax-rate-input-container",
              "税点必须大于 0 且不超过 100",
            );
          }
          defaultTaxRate = taxPoint / 100;
          taxRateCoefficient = 1 + defaultTaxRate;
        }
        if (!DOMESTIC_PHONE_REGEX.test(contactPhone)) {
          return formError(
            form,
            '[name="contactPhone"]',
            "请输入有效的国内联系电话（手机号或座机号）",
          );
        }
        if (!ensureUniqueRecordId(mockData.customers, null, id, "客户")) {
          return false;
        }

        const newCustomer = {
          id,
          name,
          contactPerson,
          contactPhone,
          address,
          email: "-",
          paymentTerms,
          hasTaxRate: hasTaxRate === "yes",
          taxRateCoefficient,
          defaultTaxRate,
          priceTaxMode:
            priceTaxMode === "inclusive" ? "inclusive" : "exclusive",
          creditLimit: 0,
          status: "active",
          createdAt: getLocalISOString(),
          updatedAt: getLocalISOString(),
        };

        const snapshot = createMasterDataSnapshot();
        mockData.customers.push(newCustomer);
        const persisted = await persistMasterDataChanges(snapshot, "客户", {
          actionType: "add",
          objectType: "customer",
          objectName: name,
          details: `新增客户，联系人：${contactPerson}`,
        });
        if (!persisted) return false;
        updateCustomerTable();

        global.showAntdMessage?.("success", "客户添加成功");
        return true;
      },
      {
        confirmText: "保存并返回",
        allowContinue: true,
        continueText: "保存并继续新增",
        onContinue: showAddCustomerModal,
      },
    );

    configureWideFormModal("保存并返回");
    renderAntdSelect(
      "add-customer-payment-container",
      "add-customer-payment-input",
      PAYMENT_OPTIONS,
      "请选择付款条件",
    );
    bindCustomerTaxRateControls("add");
  }

  function showEditCustomerModal(customerId) {
    const customer = mockData.customers.find((item) => item.id === customerId);
    if (!customer) {
      alert("未找到对应的客户记录");
      return;
    }

    const nameValue = escapeHTML(getEditableFieldValue(customer.name));
    const contactPersonValue = escapeHTML(
      getEditableFieldValue(customer.contactPerson),
    );
    const contactPhoneValue = escapeHTML(
      getEditableFieldValue(customer.contactPhone),
    );
    const addressValue = escapeHTML(getEditableFieldValue(customer.address));
    const paymentTermsValue = escapeHTML(
      getEditableFieldValue(customer.paymentTerms),
    );
    const statusValue = escapeHTML(getStatusMeta(customer.status).value);
    const statusMeta = getStatusMeta(customer.status);

    const content = `
            <form id="edit-customer-form" class="space-y-3">
                ${buildReadonlySummaryCard("users", customer.name, `编号: ${customer.id || "-"}`, statusMeta)}
                ${buildRecordInfoCard(customer)}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${buildEditableFieldCard(
                      '客户名称 <span class="text-danger">*</span>',
                      `<input type="text" name="name" required value="${nameValue}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      '联系人 <span class="text-danger">*</span>',
                      `<input type="text" name="contactPerson" required value="${contactPersonValue}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      '联系电话 <span class="text-danger">*</span>',
                      `<input type="tel" name="contactPhone" required value="${contactPhoneValue}" placeholder="请输入国内手机号或座机号" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      '默认税点 <span class="text-danger">*</span>',
                      `<div class="flex min-h-[40px] flex-col gap-2 sm:flex-row sm:items-center">
                          <div id="edit-customer-tax-rate-choice-container" class="shrink-0"></div>
                          <input type="hidden" name="hasTaxRate" id="edit-customer-tax-rate-choice-input" required>
                          <div id="edit-customer-tax-rate-wrap" class="invisible pointer-events-none min-w-0 flex-1" aria-hidden="true">
                              <div id="edit-customer-tax-rate-input-container" class="w-full"></div>
                              <input type="hidden" name="taxRateCoefficient" id="edit-customer-tax-rate-input">
                          </div>
                      </div>`,
                    )}
                    ${buildEditableFieldCard(
                      '价格类型 <span class="text-danger">*</span>',
                      `<select name="priceTaxMode" required class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
                          <option value="exclusive" ${customer.priceTaxMode !== "inclusive" ? "selected" : ""}>未税价</option>
                          <option value="inclusive" ${customer.priceTaxMode === "inclusive" ? "selected" : ""}>含税价</option>
                      </select>`,
                    )}
                    ${buildEditableFieldCard(
                      '付款条件 <span class="text-danger">*</span>',
                      `<div id="edit-customer-payment-container" class="w-full"></div><input type="hidden" name="paymentTerms" id="edit-customer-payment-input" value="${paymentTermsValue}">`,
                    )}
                    ${buildEditableFieldCard(
                      '状态 <span class="text-danger">*</span>',
                      `<div id="edit-customer-status-container" class="w-full"></div><input type="hidden" name="status" id="edit-customer-status-input" value="${statusValue}">`,
                    )}
                    ${buildEditableFieldCard(
                      '客户地址 <span class="text-danger">*</span>',
                      `<input type="text" name="address" required value="${addressValue}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                      "md:col-span-2",
                    )}
                </div>
                <p class="text-xs text-gray-500">当前窗口为编辑模式，修改后点击保存即可更新客户信息。</p>
            </form>
        `;

    showBusinessEditor("编辑客户", content, async function onConfirm() {
      const form = document.getElementById("edit-customer-form");

      const formData = new FormData(form);
      const name = normalizeTextValue(formData.get("name"));
      const contactPerson = normalizeTextValue(formData.get("contactPerson"));
      const contactPhone = normalizeTextValue(formData.get("contactPhone"));
      const address = normalizeTextValue(formData.get("address"));
      const hasTaxRate = normalizeTextValue(formData.get("hasTaxRate"));
      const taxRateCoefficientText = normalizeTextValue(
        formData.get("taxRateCoefficient"),
      );
      const paymentTerms = normalizeTextValue(
        document.getElementById("edit-customer-payment-input").value,
      );
      const priceTaxMode = normalizeTextValue(formData.get("priceTaxMode"));
      let taxRateCoefficient = null;
      let defaultTaxRate = 0;
      const status =
        normalizeTextValue(
          document.getElementById("edit-customer-status-input").value,
        ) || "active";

      if (!name) {
        return formError(form, '[name="name"]', "请输入客户名称");
      }
      if (!contactPerson) {
        return formError(form, '[name="contactPerson"]', "请输入联系人");
      }
      if (!contactPhone) {
        return formError(form, '[name="contactPhone"]', "请输入联系电话");
      }
      if (!address) {
        return formError(form, '[name="address"]', "请输入客户地址");
      }
      if (!paymentTerms) {
        return formError(
          form,
          "#edit-customer-payment-container",
          "请选择付款条件",
        );
      }
      if (!hasTaxRate) {
        return formError(form, '[name="hasTaxRate"]', "请选择是否有税点");
      }
      if (hasTaxRate === "yes") {
        if (!taxRateCoefficientText) {
          return formError(
            form,
            '[name="taxRateCoefficient"]',
            "请输入税点，例如 7",
          );
        }

        const taxPoint = Number(taxRateCoefficientText);
        if (!Number.isFinite(taxPoint) || taxPoint <= 0 || taxPoint > 100) {
          return formError(
            form,
            '[name="taxRateCoefficient"]',
            "税点必须大于 0 且不超过 100",
          );
        }
        defaultTaxRate = taxPoint / 100;
        taxRateCoefficient = 1 + defaultTaxRate;
      }
      if (!DOMESTIC_PHONE_REGEX.test(contactPhone)) {
        return formError(
          form,
          '[name="contactPhone"]',
          "请输入有效的国内联系电话（手机号或座机号）",
        );
      }
      if (!ensureUniqueName(mockData.customers, customer.id, name, "客户")) {
        return false;
      }

      const snapshot = createMasterDataSnapshot();
      Object.assign(customer, {
        name,
        contactPerson,
        contactPhone,
        address,
        paymentTerms,
        hasTaxRate: hasTaxRate === "yes",
        taxRateCoefficient,
        defaultTaxRate,
        priceTaxMode: priceTaxMode === "inclusive" ? "inclusive" : "exclusive",
        status,
        updatedAt: getLocalISOString(),
      });

      const persisted = await persistMasterDataChanges(snapshot, "客户", {
        actionType: "edit",
        objectType: "customer",
        objectName: name,
        details: `编辑客户信息，联系人：${contactPerson}`,
      });
      if (!persisted) return false;
      updateCustomerTable();
      alert("客户信息已更新");
      return true;
    });

    configureWideFormModal("保存");
    renderPaymentTermsSelect(
      "edit-customer-payment-container",
      "edit-customer-payment-input",
      getEditableFieldValue(customer.paymentTerms),
      "请选择付款条件",
    );
    renderStatusSelect(
      "edit-customer-status-container",
      "edit-customer-status-input",
      customer.status || "active",
    );
    bindCustomerTaxRateControls("edit", {
      choice: customer.hasTaxRate ? "yes" : "no",
      coefficient: Number.isFinite(Number(customer.defaultTaxRate))
        ? Number(customer.defaultTaxRate) * 100
        : Number(customer.taxRateCoefficient) > 1
          ? (Number(customer.taxRateCoefficient) - 1) * 100
          : Number(customer.taxRateCoefficient || 0) * 100,
    });
  }

  function updateCustomerTable() {
    const tbody = document.querySelector("#customers tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    const sortedCustomers = [...mockData.customers].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    paginationState.customers.total = sortedCustomers.length;
    let { page, pageSize } = paginationState.customers;

    const totalPages = Math.ceil(sortedCustomers.length / pageSize);
    if (page > totalPages && totalPages > 0) {
      paginationState.customers.page = totalPages;
      page = totalPages;
    }

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedCustomers = sortedCustomers.slice(startIndex, endIndex);

    if (paginatedCustomers.length === 0) {
      renderAntdEmptyTableRow(tbody, 9, "暂无客户记录");
      renderPaginationControl(
        "customer-pagination-container",
        "customers",
        updateCustomerTable,
      );
      return;
    }

    paginatedCustomers.forEach((customer) => {
      const formattedCreatedAt = formatDateTime(customer.createdAt);
      const formattedUpdatedAt = formatDateTime(customer.updatedAt);
      const safeCustomerId = escapeHTML(customer.id || "-");
      const safeCustomerName = escapeHTML(customer.name || "-");
      const safeContactPerson = escapeHTML(customer.contactPerson || "-");
      const safeContactPhone = escapeHTML(customer.contactPhone || "-");
      const safeAddress = escapeHTML(customer.address || "-");
      const safePaymentTerms = escapeHTML(customer.paymentTerms || "-");
      const statusMeta = getStatusMeta(customer.status);
      const safeStatusLabel = escapeHTML(statusMeta.label);

      const row = document.createElement("tr");
      row.dataset.recordId = customer.id;
      row.innerHTML = `
                <td class="px-6 py-4 align-middle whitespace-nowrap text-sm font-medium text-gray-900">${safeCustomerId}</td>
                <td class="px-6 py-4 align-middle">
                    <div class="table-long-text customer-cell-wrap text-sm font-medium text-gray-900" title="${safeCustomerName}">${safeCustomerName}</div>
                </td>
                <td class="px-6 py-4 align-middle whitespace-nowrap text-sm text-gray-500">${safeContactPerson}</td>
                <td class="px-6 py-4 align-middle whitespace-nowrap text-sm text-gray-500">${safeContactPhone}</td>
                <td class="px-6 py-4 align-middle text-sm text-gray-500"><div class="table-long-text customer-cell-wrap" title="${safeAddress}">${safeAddress}</div></td>
                <td class="px-6 py-4 align-middle text-sm text-gray-500"><div class="table-long-text customer-cell-wrap" title="${safePaymentTerms}">${safePaymentTerms}</div></td>
                <td class="px-6 py-4 align-middle whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusMeta.className}">${safeStatusLabel}</span>
                </td>
                <td class="px-6 py-4 align-middle text-sm text-gray-500 whitespace-nowrap">
                    <div class="space-y-1">
                        <div class="flex items-center">
                            <span class="text-xs text-gray-500 mr-2 whitespace-nowrap">创建时间:</span>
                            <span class="flex items-center whitespace-nowrap">
                                <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(currentUser.name)}</span>
                                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedCreatedAt}</span>
                            </span>
                        </div>
                        <div class="flex items-center">
                            <span class="text-xs text-gray-500 mr-2 whitespace-nowrap">更新时间:</span>
                            <span class="flex items-center whitespace-nowrap">
                                <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(currentUser.name)}</span>
                                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedUpdatedAt}</span>
                            </span>
                        </div>
                    </div>
                </td>
                <td class="table-action-cell px-6 py-4 align-middle whitespace-nowrap text-left text-sm font-medium">
                    <div class="table-action-links customer-row-actions">
                        <button type="button" class="text-blue-600 hover:text-blue-900" data-action="view">查看</button>
                        <button type="button" class="text-emerald-600 hover:text-emerald-800" data-action="prices">价目表</button>
                        <button type="button" class="text-orange-600 hover:text-orange-800" data-action="bill">对账</button>
                        <button type="button" class="text-primary hover:text-primary-dark" data-action="edit">编辑</button>
                        <button type="button" class="text-danger hover:text-danger-dark" data-action="delete">删除</button>
                    </div>
                </td>
            `;
      const viewButton = row.querySelector('[data-action="view"]');
      const pricesButton = row.querySelector('[data-action="prices"]');
      const billButton = row.querySelector('[data-action="bill"]');
      const editButton = row.querySelector('[data-action="edit"]');
      const deleteButton = row.querySelector('[data-action="delete"]');
      if (viewButton) {
        viewButton.addEventListener("click", () =>
          showViewCustomerModal(customer.id),
        );
      }
      if (pricesButton) {
        pricesButton.addEventListener("click", () =>
          global.showCustomerPriceListModal?.(customer.id),
        );
      }
      if (billButton) {
        billButton.addEventListener("click", () =>
          global.openCreateBillForCustomer?.(customer.id),
        );
      }
      if (editButton) {
        editButton.addEventListener("click", () =>
          showEditCustomerModal(customer.id),
        );
      }
      if (deleteButton) {
        deleteButton.addEventListener("click", () =>
          deleteCustomer(customer.id),
        );
      }
      tbody.appendChild(row);
    });

    renderPaginationControl(
      "customer-pagination-container",
      "customers",
      updateCustomerTable,
    );
  }

  function updateSupplierTable() {
    const tbody = document.getElementById("suppliers-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    const sortedSuppliers = [...mockData.suppliers].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    paginationState.suppliers.total = sortedSuppliers.length;
    let { page, pageSize } = paginationState.suppliers;

    const totalPages = Math.ceil(sortedSuppliers.length / pageSize);
    if (page > totalPages && totalPages > 0) {
      paginationState.suppliers.page = totalPages;
      page = totalPages;
    }

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedSuppliers = sortedSuppliers.slice(startIndex, endIndex);

    if (paginatedSuppliers.length === 0) {
      renderAntdEmptyTableRow(tbody, 7, "暂无供应商记录");
      renderPaginationControl(
        "suppliers-pagination-container",
        "suppliers",
        updateSupplierTable,
      );
      return;
    }

    paginatedSuppliers.forEach((supplier) => {
      const formattedCreatedAt = formatDateTime(supplier.createdAt);
      const formattedUpdatedAt = formatDateTime(supplier.updatedAt);
      const safeSupplierName = escapeHTML(supplier.name || "-");
      const safeContactPerson = escapeHTML(supplier.contactPerson || "-");
      const safeContactPhone = escapeHTML(supplier.contactPhone || "-");
      const safePaymentTerms = escapeHTML(supplier.paymentTerms || "-");
      const statusMeta = getStatusMeta(supplier.status);
      const safeStatusLabel = escapeHTML(statusMeta.label);

      const row = document.createElement("tr");
      row.dataset.recordId = supplier.id;
      row.innerHTML = `
                <td class="px-6 py-4 align-middle">
                    <div class="table-long-text supplier-cell-wrap text-sm font-medium text-gray-900" title="${safeSupplierName}">${safeSupplierName}</div>
                </td>
                <td class="px-6 py-4 align-middle whitespace-nowrap text-sm text-gray-500">${safeContactPerson}</td>
                <td class="px-6 py-4 align-middle whitespace-nowrap text-sm text-gray-500">${safeContactPhone}</td>
                <td class="px-6 py-4 align-middle text-sm text-gray-500"><div class="table-long-text supplier-cell-wrap" title="${safePaymentTerms}">${safePaymentTerms}</div></td>
                <td class="px-6 py-4 align-middle whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusMeta.className}">${safeStatusLabel}</span>
                </td>
                <td class="px-6 py-4 align-middle text-sm text-gray-500 whitespace-nowrap">
                    <div class="space-y-1">
                        <div class="flex items-center">
                            <span class="text-xs text-gray-500 mr-2 whitespace-nowrap">创建时间:</span>
                            <span class="flex items-center whitespace-nowrap">
                                <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(currentUser.name)}</span>
                                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedCreatedAt}</span>
                            </span>
                        </div>
                        <div class="flex items-center">
                            <span class="text-xs text-gray-500 mr-2 whitespace-nowrap">更新时间:</span>
                            <span class="flex items-center whitespace-nowrap">
                                <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(currentUser.name)}</span>
                                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedUpdatedAt}</span>
                            </span>
                        </div>
                    </div>
                </td>
                <td class="table-action-cell px-6 py-4 align-middle whitespace-nowrap text-left text-sm font-medium">
                    <div class="table-action-links">
                        <button type="button" class="text-blue-600 hover:text-blue-900" data-action="view">查看</button>
                        <button type="button" class="text-orange-600 hover:text-orange-800" data-action="bill">对账</button>
                        <button type="button" class="text-primary hover:text-primary-dark" data-action="edit">编辑</button>
                        <button type="button" class="text-danger hover:text-danger-dark" data-action="delete">删除</button>
                    </div>
                </td>
            `;
      const viewButton = row.querySelector('[data-action="view"]');
      const billButton = row.querySelector('[data-action="bill"]');
      const editButton = row.querySelector('[data-action="edit"]');
      const deleteButton = row.querySelector('[data-action="delete"]');
      if (viewButton) {
        viewButton.addEventListener("click", () =>
          showViewSupplierModal(supplier.id),
        );
      }
      if (billButton) {
        billButton.addEventListener("click", () =>
          global.openCreateBillForSupplier?.(supplier.id),
        );
      }
      if (editButton) {
        editButton.addEventListener("click", () =>
          showEditSupplierModal(supplier.id),
        );
      }
      if (deleteButton) {
        deleteButton.addEventListener("click", () =>
          deleteSupplier(supplier.id),
        );
      }
      tbody.appendChild(row);
    });

    renderPaginationControl(
      "suppliers-pagination-container",
      "suppliers",
      updateSupplierTable,
    );
  }

  global.showAddCompanyModal = showAddCompanyModal;
  global.showViewCompanyModal = showViewCompanyModal;
  global.showEditCompanyModal = showEditCompanyModal;
  global.deleteCompany = deleteCompany;
  global.updateCompanyTable = updateCompanyTable;
  global.showAddSupplierModal = showAddSupplierModal;
  global.showViewSupplierModal = showViewSupplierModal;
  global.showEditSupplierModal = showEditSupplierModal;
  global.deleteSupplier = deleteSupplier;
  global.showAddCustomerModal = showAddCustomerModal;
  global.showViewCustomerModal = showViewCustomerModal;
  global.showEditCustomerModal = showEditCustomerModal;
  global.deleteCustomer = deleteCustomer;
  global.updateCustomerTable = updateCustomerTable;
  global.updateSupplierTable = updateSupplierTable;

  const partners = Object.freeze({
    showAddCompanyModal,
    showViewCompanyModal,
    showEditCompanyModal,
    deleteCompany,
    updateCompanyTable,
    showAddSupplierModal,
    showViewSupplierModal,
    showEditSupplierModal,
    deleteSupplier,
    showAddCustomerModal,
    showViewCustomerModal,
    showEditCustomerModal,
    deleteCustomer,
    updateCustomerTable,
    updateSupplierTable,
  });
  global.AppMasterDataPartners = partners;
  global.AppMasterDataModule = Object.freeze({
    ...(global.AppMasterDataProducts || {}),
    ...partners,
  });
})(window);
