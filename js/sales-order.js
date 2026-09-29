(function initSalesOrderModule(global) {
  const SALES_ORDER_AGREEMENT_TEXT =
    "1.我公司货品保证质量，请全面核对货物数量和质量情况，如有异议，对货物的数量外观请在送货当天当面提出；对货物的质量有异议的请在收货后三日内书面统计并致函发货方提出，逾期则视为收货方确认数量及质量合格。2.货物在未付清款之前，所有权归发货方所有，如有故意拖欠货款，发货方有权随时取回货物。3.逾期不付货款，发货方有权收欠款利息（逾期金额按月息2%利率计算）。4、送货单、快递单据的传真件、扫描件与原件具有同等法律效力。5、双方之间争议应友好协商，协商不成由供方注册所在地法院管辖，守约方因维权产生的律师费、差旅费保全费、拍卖费等都由违约方承担。";
  const SALES_ORDER_NOTE_TEXT =
    "注：第一联白仓库存收款根联，第二联红联；第三联蓝联，第四联黄联均数客户联";

  const NAME_INITIALS_MAP = {
    京: "J",
    东: "D",
    天: "T",
    猫: "M",
    苏: "S",
    宁: "N",
    易: "Y",
    购: "G",
    同: "T",
    芯: "X",
    化: "H",
    工: "G",
    劳: "L",
    保: "B",
    苹: "P",
    果: "G",
    华: "H",
    为: "W",
    拼: "P",
    多: "D",
    测: "C",
    试: "S",
  };

  let currentSalesOrder = createEmptySalesOrder();
  let currentPrintableDeliveryNote = null;
  let salesOrderInitialSnapshot = "";
  let salesOrderPaperResizeObserver = null;
  let salesOrderResizeFallbackBound = false;
  let salesOrderLayoutFrame = 0;

  const SALES_ORDER_PAPER_WIDTH = 1220;
  const SALES_ORDER_PAPER_LAYOUTS = Object.freeze([
    {
      viewportId: "sales-order-paper-viewport",
      paperId: "sales-order-paper",
    },
    {
      viewportId: "sales-order-preview-viewport",
      paperId: "sales-order-preview-content",
    },
    {
      viewportId: "sales-order-print-viewport",
      paperId: "sales-order-print-content",
    },
  ]);

  function syncSalesOrderPaperLayout() {
    SALES_ORDER_PAPER_LAYOUTS.forEach(({ viewportId, paperId }) => {
      const viewport = document.getElementById(viewportId);
      const paper = document.getElementById(paperId);
      if (!viewport || !paper || viewport.clientWidth <= 0) return;

      const naturalWidth = paper.offsetWidth || SALES_ORDER_PAPER_WIDTH;
      const naturalHeight = paper.offsetHeight;
      const scale = Math.min(1, viewport.clientWidth / naturalWidth);
      const renderedWidth = naturalWidth * scale;

      paper.style.transform = `scale(${scale})`;
      paper.style.marginLeft = `${Math.max(0, (viewport.clientWidth - renderedWidth) / 2)}px`;
      viewport.style.height = `${Math.ceil(naturalHeight * scale)}px`;
      viewport.dataset.scale = scale.toFixed(4);
    });
  }

  function scheduleSalesOrderPaperLayout() {
    if (
      salesOrderLayoutFrame &&
      typeof global.cancelAnimationFrame === "function"
    ) {
      global.cancelAnimationFrame(salesOrderLayoutFrame);
    }

    const schedule =
      typeof global.requestAnimationFrame === "function"
        ? global.requestAnimationFrame.bind(global)
        : (callback) => global.setTimeout(callback, 0);
    salesOrderLayoutFrame = schedule(() => {
      salesOrderLayoutFrame = 0;
      syncSalesOrderPaperLayout();
    });
  }

  function initSalesOrderPaperScaling() {
    const elements = SALES_ORDER_PAPER_LAYOUTS.flatMap(
      ({ viewportId, paperId }) => [
        document.getElementById(viewportId),
        document.getElementById(paperId),
      ],
    ).filter(Boolean);

    if (typeof global.ResizeObserver === "function") {
      salesOrderPaperResizeObserver?.disconnect();
      salesOrderPaperResizeObserver = new global.ResizeObserver(
        scheduleSalesOrderPaperLayout,
      );
      elements.forEach((element) =>
        salesOrderPaperResizeObserver.observe(element),
      );
    } else if (!salesOrderResizeFallbackBound) {
      global.addEventListener("resize", scheduleSalesOrderPaperLayout);
      salesOrderResizeFallbackBound = true;
    }

    scheduleSalesOrderPaperLayout();
  }

  function getTodayCompactDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
  }

  function formatCompactDate(value) {
    if (!value) return getTodayCompactDate();
    const str = String(value).trim();
    if (/^\d{8}$/.test(str)) return str;
    if (/^\d{4}-\d{2}-\d{2}/.test(str))
      return str.slice(0, 10).replace(/-/g, "");

    const parsed = new Date(str);
    if (Number.isNaN(parsed.getTime())) return getTodayCompactDate();

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
  }

  function createSalesOrderNumber() {
    const compactDate = getTodayCompactDate();
    const existedCount = (
      Array.isArray(mockData?.deliveryNotes) ? mockData.deliveryNotes : []
    ).filter((note) =>
      String(note?.orderNo || "").startsWith(`XS${compactDate}`),
    ).length;

    return `XS${compactDate}${String(existedCount + 1).padStart(4, "0")}`;
  }

  function createSalesOrderItem() {
    return {
      id: createRuntimeId("SOI"),
      productId: "",
      productName: "",
      spec: "-",
      unit: "-",
      quantity: "",
      price: "",
      referencePrice: null,
      referencePriceOriginal: null,
      referencePriceTaxMode: null,
      lastTransactionPrice: null,
      priceSource: "product-default",
      remark: "",
    };
  }

  function createEmptySalesOrder() {
    return {
      orderNo: createSalesOrderNumber(),
      issueDate: getTodayCompactDate(),
      companyId: "",
      customerId: "",
      warehouseId: global.getDefaultWarehouseId?.() || "WH001",
      customerNo: "--",
      taxRate: 0,
      priceTaxMode: "exclusive",
      items: [createSalesOrderItem()],
    };
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = value ?? "";
    }
  }

  function setInputValue(id, value) {
    const input = document.getElementById(id);
    if (input) {
      input.value = value ?? "";
    }
  }

  function getInputValue(id) {
    const input = document.getElementById(id);
    return input ? String(input.value || "").trim() : "";
  }

  function findCompanyById(companyId) {
    return (
      (mockData?.companies || []).find((company) => company.id === companyId) ||
      null
    );
  }

  function findCustomerById(customerId) {
    return (
      (mockData?.customers || []).find(
        (customer) => customer.id === customerId,
      ) || null
    );
  }

  function findProductById(productId) {
    return (
      (mockData?.products || []).find((product) => product.id === productId) ||
      null
    );
  }

  function getCustomerInitials(name) {
    const cleaned = String(name || "").replace(/\s+/g, "");
    if (!cleaned) return "KH";

    const asciiInitials = cleaned
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");

    if (asciiInitials.length >= 2) {
      return asciiInitials.slice(0, 2);
    }

    const initials = [];
    for (const char of cleaned) {
      if (NAME_INITIALS_MAP[char]) {
        initials.push(NAME_INITIALS_MAP[char]);
      } else if (/[a-zA-Z]/.test(char)) {
        initials.push(char.toUpperCase());
      }

      if (initials.length >= 2) break;
    }

    while (initials.length < 2) {
      initials.push("X");
    }

    return initials.join("").slice(0, 2);
  }

  function getCustomerCodePrefix(customer) {
    const idLetters = String(customer?.id || "")
      .toUpperCase()
      .match(/[A-Z]/g);
    if (idLetters && idLetters.length >= 2) {
      return idLetters.slice(0, 2).join("");
    }

    return getCustomerInitials(customer?.name);
  }

  function getCustomerNo(customerId, issueDate) {
    const customer = findCustomerById(customerId);
    if (!customer) return "--";

    const compactDate = formatCompactDate(issueDate);
    const yearShort = compactDate.slice(2, 4);
    const currentYear = compactDate.slice(0, 4);
    const existedCount = (mockData?.deliveryNotes || []).filter((note) => {
      if ((note?.type || "") !== "sales") return false;
      const noteDate = formatCompactDate(
        note?.issueDate || note?.deliveryDate || note?.createdAt,
      );
      return (
        note?.customerId === customerId && noteDate.startsWith(currentYear)
      );
    }).length;

    return `${getCustomerCodePrefix(customer)}${yearShort}-${String(existedCount + 1).padStart(3, "0")}`;
  }

  function parseNumber(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function roundMoney(value) {
    return Math.round((parseNumber(value) + Number.EPSILON) * 100) / 100;
  }

  function getCustomerTaxRate(customer) {
    const explicitRate = Number(customer?.defaultTaxRate);
    if (Number.isFinite(explicitRate) && explicitRate >= 0) {
      return Math.min(1, explicitRate);
    }
    const coefficient = Number(customer?.taxRateCoefficient);
    if (!customer?.hasTaxRate || !Number.isFinite(coefficient)) return 0;
    return Math.min(
      1,
      Math.max(0, coefficient > 1 ? coefficient - 1 : coefficient),
    );
  }

  /**
   * @param {Array<{quantity: string|number, price: string|number}>} [items]
   */
  function getOrderAmounts(items) {
    const amountItems = Array.isArray(items) ? items : getDeliveryItems();
    const enteredAmount = roundMoney(
      amountItems.reduce(
        (total, item) =>
          total + parseNumber(item.quantity) * parseNumber(item.price),
        0,
      ),
    );
    const taxRate = Math.max(0, parseNumber(currentSalesOrder.taxRate));
    if (currentSalesOrder.priceTaxMode === "inclusive") {
      const totalAmount = enteredAmount;
      const subtotal = roundMoney(totalAmount / (1 + taxRate));
      return {
        subtotal,
        taxAmount: roundMoney(totalAmount - subtotal),
        totalAmount,
      };
    }
    const subtotal = enteredAmount;
    const taxAmount = roundMoney(subtotal * taxRate);
    return {
      subtotal,
      taxAmount,
      totalAmount: roundMoney(subtotal + taxAmount),
    };
  }

  function formatMoney(value) {
    return `¥${parseNumber(value).toFixed(2)}`;
  }

  function convertAmountToChineseUpper(amount) {
    const numericAmount = Math.round(parseNumber(amount) * 100);
    if (!numericAmount) return "人民币零元整";

    const fractionUnits = ["角", "分"];
    const digitChars = [
      "零",
      "壹",
      "贰",
      "叁",
      "肆",
      "伍",
      "陆",
      "柒",
      "捌",
      "玖",
    ];
    const sectionUnits = [
      ["元", "万", "亿"],
      ["", "拾", "佰", "仟"],
    ];

    let remaining = numericAmount;
    let fractionPart = "";

    for (let i = 0; i < fractionUnits.length; i += 1) {
      const digit =
        Math.floor(remaining / (10 * 10 ** (fractionUnits.length - i - 1))) %
        10;
      if (digit) {
        fractionPart += `${digitChars[digit]}${fractionUnits[i]}`;
      }
    }

    let integerPart = Math.floor(numericAmount / 100);
    let chineseInteger = "";

    for (let i = 0; i < sectionUnits[0].length && integerPart > 0; i += 1) {
      let sectionText = "";
      let zeroCount = 0;

      for (let j = 0; j < sectionUnits[1].length && integerPart > 0; j += 1) {
        const digit = integerPart % 10;
        if (digit === 0) {
          zeroCount += 1;
        } else {
          if (zeroCount > 0) {
            sectionText = `零${sectionText}`;
          }
          zeroCount = 0;
          sectionText = `${digitChars[digit]}${sectionUnits[1][j]}${sectionText}`;
        }
        integerPart = Math.floor(integerPart / 10);
      }

      if (sectionText) {
        chineseInteger = `${sectionText}${sectionUnits[0][i]}${chineseInteger}`;
      }
    }

    chineseInteger = chineseInteger
      .replace(/零+/g, "零")
      .replace(/零(万|亿|元)/g, "$1")
      .replace(/亿万/g, "亿")
      .replace(/零角零分$/, "整")
      .replace(/零分$/, "整")
      .replace(/零角/, "")
      .replace(/零元$/, "元");

    if (!fractionPart) {
      fractionPart = "整";
    }

    return `人民币${chineseInteger || "零元"}${fractionPart === "整" ? "整" : fractionPart}`;
  }

  function getDeliveryItems() {
    return currentSalesOrder.items.filter(
      (item) => item.productId && parseNumber(item.quantity) > 0,
    );
  }

  function updateSalesOrderTotals() {
    const amounts = getOrderAmounts();
    const totalAmount = amounts.totalAmount;
    setText("sales-order-total-amount-display", formatMoney(totalAmount));
    setText("sales-order-subtotal-display", formatMoney(amounts.subtotal));
    setText("sales-order-tax-amount-display", formatMoney(amounts.taxAmount));
    setText(
      "sales-order-total-amount-uppercase",
      convertAmountToChineseUpper(totalAmount),
    );
  }

  function applyCompanyToForm(company) {
    setInputValue("sales-company-address-input", company?.address || "");
    setInputValue("sales-company-phone-input", company?.contactPhone || "");
    setInputValue("sales-company-contact-input", company?.contactPerson || "");
  }

  function updateCustomerNoDisplay() {
    currentSalesOrder.customerNo = currentSalesOrder.customerId
      ? getCustomerNo(currentSalesOrder.customerId, currentSalesOrder.issueDate)
      : "--";

    setText("sales-customer-no", currentSalesOrder.customerNo);
  }

  function applyCustomerToForm(customer) {
    setInputValue("sales-customer-address-input", customer?.address || "");
    setInputValue(
      "sales-customer-contact-input",
      customer?.contactPerson || "",
    );
    setInputValue("sales-customer-phone-input", customer?.contactPhone || "");
    setInputValue("sales-customer-payment-input", customer?.paymentTerms || "");
    currentSalesOrder.taxRate = getCustomerTaxRate(customer);
    currentSalesOrder.priceTaxMode =
      customer?.priceTaxMode === "inclusive" ? "inclusive" : "exclusive";
    setInputValue(
      "sales-order-tax-rate-input",
      (currentSalesOrder.taxRate * 100).toFixed(2).replace(/\.00$/, ""),
    );
    setInputValue(
      "sales-order-price-tax-mode-input",
      currentSalesOrder.priceTaxMode,
    );
    setText(
      "sales-order-price-label",
      currentSalesOrder.priceTaxMode === "inclusive"
        ? "含税单价(RMB)"
        : "未税单价(RMB)",
    );
    updateSalesOrderTotals();
  }

  function refreshSelectedProductPrices() {
    currentSalesOrder.items.forEach((item) => {
      if (item.productId) applyProductSelection(item.id, item.productId);
    });
  }

  function bindSalesTaxControls() {
    const taxInput = document.getElementById("sales-order-tax-rate-input");
    const modeInput = document.getElementById(
      "sales-order-price-tax-mode-input",
    );
    if (taxInput && !taxInput.dataset.bound) {
      taxInput.dataset.bound = "true";
      taxInput.addEventListener("input", () => {
        const percentage = Math.min(
          100,
          Math.max(0, parseNumber(taxInput.value)),
        );
        currentSalesOrder.taxRate = percentage / 100;
        updateSalesOrderTotals();
      });
    }
    if (modeInput && !modeInput.dataset.bound) {
      modeInput.dataset.bound = "true";
      modeInput.addEventListener("change", () => {
        currentSalesOrder.priceTaxMode =
          modeInput.value === "inclusive" ? "inclusive" : "exclusive";
        setText(
          "sales-order-price-label",
          currentSalesOrder.priceTaxMode === "inclusive"
            ? "含税单价(RMB)"
            : "未税单价(RMB)",
        );
        updateSalesOrderTotals();
      });
    }
  }

  function renderCompanySelect() {
    if (typeof global.renderAntdSelect !== "function") return;

    const companyOptions = (mockData?.companies || [])
      .filter((company) => company.status !== "inactive")
      .map((company) => ({
        value: company.id,
        label: company.name,
      }));

    global.renderAntdSelect(
      "sales-order-company-container",
      "sales-order-company-input",
      companyOptions,
      {
        placeholder: "搜索并选择发货公司",
        value: currentSalesOrder.companyId || undefined,
        className: "sales-order-company-select",
        listHeight: 160,
        dropdownStyle: { maxHeight: 176 },
      },
      (value) => {
        currentSalesOrder.companyId = value || "";
        applyCompanyToForm(findCompanyById(currentSalesOrder.companyId));
      },
    );
  }

  function renderCustomerSelect() {
    if (typeof global.renderAntdSelect !== "function") return;

    const customerOptions = (mockData?.customers || [])
      .filter((customer) => customer.status !== "inactive")
      .map((customer) => ({
        value: customer.id,
        label: customer.name,
      }));

    global.renderAntdSelect(
      "sales-order-customer-container",
      "sales-order-customer-input",
      customerOptions,
      {
        placeholder: "搜索并选择客户名称",
        value: currentSalesOrder.customerId || undefined,
        listHeight: 160,
        dropdownStyle: { maxHeight: 176 },
      },
      (value) => {
        currentSalesOrder.customerId = value || "";
        applyCustomerToForm(findCustomerById(currentSalesOrder.customerId));
        updateCustomerNoDisplay();
        refreshSelectedProductPrices();
      },
    );
  }

  function renderIssueDatePicker() {
    const container = document.getElementById("sales-order-date-container");
    const hiddenInput = document.getElementById("sales-order-date-input");
    if (!hiddenInput) return;

    hiddenInput.value = currentSalesOrder.issueDate;

    if (
      !container ||
      !global.React ||
      !global.ReactDOM ||
      !global.antd ||
      !global.dayjs
    ) {
      container.innerHTML = `
                <input
                    type="text"
                    class="w-full rounded border border-gray-300 px-3 py-1.5 text-[15px] text-gray-900"
                    value="${escapeHTML(currentSalesOrder.issueDate)}"
                >
            `;
      return;
    }

    const React = global.React;
    const ReactDOM = global.ReactDOM;
    const DatePicker = global.antd.DatePicker;
    const dayjs = global.dayjs;

    const App = () => {
      const [value, setValue] = React.useState(
        dayjs(currentSalesOrder.issueDate, "YYYYMMDD"),
      );

      React.useEffect(() => {
        setValue(dayjs(currentSalesOrder.issueDate, "YYYYMMDD"));
      }, [currentSalesOrder.issueDate]);

      return React.createElement(DatePicker, {
        value,
        format: "YYYYMMDD",
        allowClear: false,
        needConfirm: true,
        style: { width: "100%" },
        onChange: (date, dateString) => {
          const nextValue = formatCompactDate(
            dateString || currentSalesOrder.issueDate || getTodayCompactDate(),
          );
          setValue(dayjs(nextValue, "YYYYMMDD"));
          currentSalesOrder.issueDate = nextValue;
          hiddenInput.value = nextValue;
          updateCustomerNoDisplay();
          refreshSelectedProductPrices();
        },
      });
    };

    if (!container._reactRoot) {
      container._reactRoot = ReactDOM.createRoot(container);
    }

    container._reactRoot.render(React.createElement(App));
  }

  function getProductOptions() {
    return (mockData?.products || [])
      .filter(
        (product) =>
          product.status !== "inactive" &&
          parseNumber(product.stockQuantity) > 0,
      )
      .map((product) => ({
        value: product.id,
        label: product.name,
      }));
  }

  function getProductStockText(product) {
    if (!product) return "";
    const stockQuantity = parseNumber(product.stockQuantity);
    const unit = product.unit || "个";
    return `当前库存：${stockQuantity} ${unit}`;
  }

  function getProductStockClassName(product) {
    if (!product) return "text-gray-500";

    const stockQuantity = parseNumber(product.stockQuantity);
    const minStock = parseNumber(product.minStock);

    if (stockQuantity <= 0) return "text-red-600";
    if (stockQuantity <= minStock) return "text-orange-500";
    return "text-green-600";
  }

  function getProductPriceHint(item, product) {
    if (!item || !product) return "";
    const referenceText =
      item.referencePrice === null
        ? "客户参考价：未设置"
        : `客户参考价：¥${parseNumber(item.referencePrice).toFixed(2)}`;
    const lastText =
      item.lastTransactionPrice === null
        ? "上次成交：无"
        : `上次成交：¥${parseNumber(item.lastTransactionPrice).toFixed(2)}`;
    return `${referenceText} / ${lastText} / 成本：¥${parseNumber(product.costPrice).toFixed(2)}`;
  }

  function normalizeReferencePrice(customerPrice) {
    if (!customerPrice) return null;
    const originalPrice = parseNumber(customerPrice.referencePrice);
    const sourceMode =
      customerPrice.priceTaxMode === "inclusive" ? "inclusive" : "exclusive";
    const targetMode = currentSalesOrder.priceTaxMode;
    const taxRate = parseNumber(currentSalesOrder.taxRate);
    if (sourceMode === targetMode || taxRate <= 0) return originalPrice;
    return sourceMode === "inclusive"
      ? roundMoney(originalPrice / (1 + taxRate))
      : roundMoney(originalPrice * (1 + taxRate));
  }

  function normalizeQuantityInput(value) {
    const raw = String(value ?? "").trim();
    if (!raw) return "";

    const cleaned = raw.replace(/[^\d.]/g, "");
    if (!cleaned) return "";

    const [integerPartRaw = "", decimalPartRaw = ""] = cleaned.split(".");
    const integerPart =
      integerPartRaw.replace(/^0+(?=\d)/, "") ||
      (decimalPartRaw ? "0" : integerPartRaw);
    const decimalPart = decimalPartRaw.slice(0, 2);

    return decimalPart ? `${integerPart}.${decimalPart}` : integerPart;
  }

  function renderSalesOrderQuantityInput(rowId) {
    const container = document.getElementById(
      `sales-order-item-qty-container-${rowId}`,
    );
    const hiddenInput = document.getElementById(
      `sales-order-item-qty-${rowId}`,
    );
    const item = currentSalesOrder.items.find((entry) => entry.id === rowId);
    if (!container || !hiddenInput || !item) return;

    if (!global.React || !global.ReactDOM || !global.antd) {
      container.innerHTML = `
                <input
                    type="text"
                    class="w-full border-0 bg-transparent px-0 py-0 text-center text-[15px] leading-6 text-gray-900 focus:outline-none focus:ring-0"
                    value="${escapeHTML(item.quantity)}"
                >
            `;
      return;
    }

    const React = global.React;
    const ReactDOM = global.ReactDOM;
    const InputNumber = global.antd.InputNumber;

    const App = () => {
      const [value, setValue] = React.useState(
        item.quantity === "" ? null : String(item.quantity),
      );

      React.useEffect(() => {
        setValue(item.quantity === "" ? null : String(item.quantity));
      }, [item.quantity]);

      const handleChange = (nextValue) => {
        const normalizedValue = normalizeQuantityInput(nextValue);
        const displayValue = normalizedValue === "" ? null : normalizedValue;

        setValue(displayValue);
        hiddenInput.value = normalizedValue;
        updateRowField(rowId, "quantity", normalizedValue);
      };

      return React.createElement(InputNumber, {
        controls: false,
        stringMode: true,
        min: "0",
        step: "0.01",
        placeholder: "请输入",
        value,
        parser: (input) => normalizeQuantityInput(input),
        formatter: (input) =>
          input === null || input === undefined ? "" : String(input),
        onChange: handleChange,
        style: { width: "100%" },
        className: "sales-order-qty-input-number",
      });
    };

    if (!container._reactRoot) {
      container._reactRoot = ReactDOM.createRoot(container);
    }

    container._reactRoot.render(React.createElement(App));
  }

  function syncRowAmount(rowId) {
    const item = currentSalesOrder.items.find((entry) => entry.id === rowId);
    const amountNode = document.getElementById(
      `sales-order-item-amount-${rowId}`,
    );
    if (!item || !amountNode) return;

    const amount = parseNumber(item.quantity) * parseNumber(item.price);
    amountNode.textContent = parseNumber(amount).toFixed(2);
    updateSalesOrderTotals();
  }

  function applyProductSelection(rowId, productId) {
    const item = currentSalesOrder.items.find((entry) => entry.id === rowId);
    if (!item) return;

    const product = findProductById(productId);
    item.productId = productId || "";

    if (!product) {
      item.productName = "";
      item.spec = "-";
      item.unit = "-";
      item.price = "";
      item.referencePrice = null;
      item.referencePriceOriginal = null;
      item.referencePriceTaxMode = null;
      item.lastTransactionPrice = null;
      item.priceSource = "product-default";
      item.quantity = "";
      item.remark = "";
    } else {
      item.productName = product.name || "";
      item.spec = product.category || "-";
      item.unit = product.unit || "-";
      const customerPrice =
        currentSalesOrder.customerId &&
        typeof global.getEffectiveCustomerPrice === "function"
          ? global.getEffectiveCustomerPrice(
              currentSalesOrder.customerId,
              product.id,
              currentSalesOrder.companyId,
            )
          : null;
      item.referencePrice = normalizeReferencePrice(customerPrice);
      item.referencePriceOriginal = customerPrice
        ? parseNumber(customerPrice.referencePrice)
        : null;
      item.referencePriceTaxMode = customerPrice?.priceTaxMode || null;
      item.lastTransactionPrice =
        currentSalesOrder.customerId &&
        typeof global.getLastCustomerProductPrice === "function"
          ? global.getLastCustomerProductPrice(
              currentSalesOrder.customerId,
              product.id,
              currentSalesOrder.companyId,
            )
          : null;
      item.price = parseNumber(
        customerPrice?.referencePrice ?? product.retailPrice,
      ).toFixed(2);
      item.priceSource = customerPrice
        ? "customer-price-list"
        : "product-default";
    }

    const specNode = document.getElementById(`sales-order-item-spec-${rowId}`);
    const unitNode = document.getElementById(`sales-order-item-unit-${rowId}`);
    const priceInput = document.getElementById(
      `sales-order-item-price-${rowId}`,
    );
    const qtyInput = document.getElementById(`sales-order-item-qty-${rowId}`);
    const remarkInput = document.getElementById(
      `sales-order-item-remark-${rowId}`,
    );
    const stockHintNode = document.getElementById(
      `sales-order-item-stock-${rowId}`,
    );
    const priceHintNode = document.getElementById(
      `sales-order-item-price-hint-${rowId}`,
    );

    if (specNode) specNode.textContent = item.spec || "-";
    if (unitNode) unitNode.textContent = item.unit || "-";
    if (priceInput) priceInput.value = item.price || "";
    if (qtyInput) qtyInput.value = item.quantity || "";
    if (remarkInput) remarkInput.value = item.remark || "";
    if (stockHintNode) {
      stockHintNode.textContent = product ? getProductStockText(product) : "";
      stockHintNode.className = product
        ? `mt-1 min-h-4 text-left text-xs ${getProductStockClassName(product)}`
        : "invisible pointer-events-none mt-1 min-h-4 text-left text-xs text-gray-500";
    }
    if (priceHintNode) {
      priceHintNode.textContent = getProductPriceHint(item, product);
    }
    renderSalesOrderQuantityInput(rowId);

    syncRowAmount(rowId);
  }

  function updateRowField(rowId, field, value) {
    const item = currentSalesOrder.items.find((entry) => entry.id === rowId);
    if (!item) return;

    item[field] = value;
    if (field === "price") {
      const referencePrice = item.referencePrice;
      item.priceSource =
        referencePrice !== null &&
        parseNumber(value) === parseNumber(referencePrice)
          ? "customer-price-list"
          : "manual";
    }
    syncRowAmount(rowId);
  }

  function bindRowInputs(rowId) {
    const priceInput = document.getElementById(
      `sales-order-item-price-${rowId}`,
    );
    const remarkInput = document.getElementById(
      `sales-order-item-remark-${rowId}`,
    );

    if (priceInput) {
      priceInput.addEventListener("input", (event) => {
        updateRowField(rowId, "price", event.target.value);
      });
    }

    if (remarkInput) {
      remarkInput.addEventListener("input", (event) => {
        updateRowField(rowId, "remark", event.target.value);
      });
    }
  }

  function renderSalesOrderAddRowButton() {
    const container = document.getElementById("sales-order-add-row-button");
    if (!container) return;

    const onClick = () => addSalesOrderRow();

    if (
      !global.React ||
      !global.ReactDOM ||
      !global.antd ||
      !global.antd.Button ||
      !global.antd.Flex
    ) {
      container.innerHTML = `
                <button type="button" class="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800" onclick="addSalesOrderRow()">
                    <i class="fa fa-plus mr-2"></i> 添加产品
                </button>
            `;
      return;
    }

    const React = global.React;
    const ReactDOM = global.ReactDOM;
    const { Button, Flex } = global.antd;

    if (!container._reactRoot) {
      container._reactRoot = ReactDOM.createRoot(container);
    }

    container._reactRoot.render(
      React.createElement(
        Flex,
        { gap: "small", wrap: true },
        React.createElement(
          Button,
          {
            type: "primary",
            onClick,
            size: "middle",
            icon: React.createElement("i", { className: "fa fa-plus" }),
            className: "!inline-flex !items-center !rounded-md !font-medium",
          },
          "添加产品",
        ),
      ),
    );
  }

  function renderSalesOrderTable() {
    const tbody = document.getElementById("sales-order-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    currentSalesOrder.items.forEach((item, index) => {
      const row = document.createElement("tr");
      row.className =
        "border-b border-gray-300 align-middle text-[15px] text-gray-900";

      const productContainerId = `sales-order-item-product-container-${item.id}`;
      const productInputId = `sales-order-item-product-input-${item.id}`;
      const qtyInputId = `sales-order-item-qty-${item.id}`;
      const priceInputId = `sales-order-item-price-${item.id}`;
      const remarkInputId = `sales-order-item-remark-${item.id}`;

      row.innerHTML = `
                <td class="border-r border-gray-300 px-2 py-3 text-center">${index + 1}</td>
                <td class="border-r border-gray-300 px-3 py-2">
                    <div id="${productContainerId}" class="w-full"></div>
                    <div id="sales-order-item-stock-${item.id}" class="${item.productId ? `mt-1 min-h-4 text-left text-xs ${getProductStockClassName(findProductById(item.productId))}` : "invisible pointer-events-none mt-1 min-h-4 text-left text-xs text-gray-500"}">${escapeHTML(getProductStockText(findProductById(item.productId)))}</div>
                    <input type="hidden" id="${productInputId}" value="${escapeHTML(item.productId)}">
                </td>
                <td class="border-r border-gray-300 px-3 py-3 text-center" id="sales-order-item-spec-${item.id}">${escapeHTML(item.spec || "-")}</td>
                <td class="border-r border-gray-300 px-3 py-3 text-center" id="sales-order-item-unit-${item.id}">${escapeHTML(item.unit || "-")}</td>
                <td class="border-r border-gray-300 px-3 py-2">
                    <div id="sales-order-item-qty-container-${item.id}" class="w-full"></div>
                    <input type="hidden" id="${qtyInputId}" value="${escapeHTML(item.quantity)}">
                </td>
                <td class="border-r border-gray-300 px-3 py-2">
                    <input id="${priceInputId}" type="number" min="0" step="0.01" class="w-full border-0 bg-transparent px-0 py-0 text-center text-[15px] leading-6 text-gray-900 focus:outline-none focus:ring-0" value="${escapeHTML(item.price)}">
                    <div id="sales-order-item-price-hint-${item.id}" class="mt-1 text-center text-[11px] leading-4 text-gray-500">${escapeHTML(getProductPriceHint(item, findProductById(item.productId)))}</div>
                </td>
                <td class="border-r border-gray-300 px-3 py-3 text-center font-medium" id="sales-order-item-amount-${item.id}">${(parseNumber(item.quantity) * parseNumber(item.price)).toFixed(2)}</td>
                <td class="px-3 py-2">
                    <div class="flex items-center gap-3">
                        <input id="${remarkInputId}" type="text" class="min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-[15px] leading-6 text-gray-900 focus:outline-none focus:ring-0" value="${escapeHTML(item.remark)}" placeholder="备注">
                        <button type="button" class="shrink-0 text-red-500 hover:text-red-700" onclick="removeSalesOrderRow('${item.id}')">
                            <i class="fa fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;

      tbody.appendChild(row);

      if (typeof global.renderAntdSelect === "function") {
        global.renderAntdSelect(
          productContainerId,
          productInputId,
          getProductOptions(),
          {
            placeholder: "搜索并选择商品",
            value: item.productId || undefined,
            virtual: false,
            popupClassName: "product-name-select-dropdown",
            listHeight: 160,
            dropdownStyle: { maxHeight: 176, overflow: "hidden" },
          },
          (value) => applyProductSelection(item.id, value),
        );
      }

      renderSalesOrderQuantityInput(item.id);
      bindRowInputs(item.id);
    });

    updateSalesOrderTotals();
    scheduleSalesOrderPaperLayout();
  }

  function setStepState(stepIndex) {
    const badgeClassMap = {
      active:
        "flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-base font-bold text-white shadow-sm",
      done: "flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-base font-bold text-white shadow-sm",
      idle: "flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-base font-bold text-primary/60",
    };

    const textClassMap = {
      active: "text-[20px] font-semibold text-primary",
      done: "text-[20px] font-semibold text-primary",
      idle: "text-[20px] font-semibold text-primary/40",
    };

    const stepStates = [
      stepIndex === 1 ? "active" : "done",
      stepIndex === 2 ? "active" : stepIndex > 2 ? "done" : "idle",
      stepIndex >= 3 ? "active" : "idle",
    ];

    stepStates.forEach((state, index) => {
      const badge = document.getElementById(
        `sales-order-step-${index + 1}-badge`,
      );
      const text = document.getElementById(
        `sales-order-step-${index + 1}-text`,
      );
      if (badge) badge.className = badgeClassMap[state];
      if (text) text.className = textClassMap[state];
    });
  }

  function collectSalesOrderPayload() {
    const company = findCompanyById(currentSalesOrder.companyId);
    const customer = findCustomerById(currentSalesOrder.customerId);
    const items = getDeliveryItems().map((item) => ({
      id: item.id,
      productId: item.productId,
      productName:
        item.productName || findProductById(item.productId)?.name || "",
      spec: item.spec || "-",
      unit: item.unit || "-",
      quantity: parseNumber(item.quantity),
      price: parseNumber(item.price),
      referencePrice:
        item.referencePrice === null ? null : parseNumber(item.referencePrice),
      referencePriceOriginal:
        item.referencePriceOriginal === null
          ? null
          : parseNumber(item.referencePriceOriginal),
      referencePriceTaxMode: item.referencePriceTaxMode,
      lastTransactionPrice:
        item.lastTransactionPrice === null
          ? null
          : parseNumber(item.lastTransactionPrice),
      priceSource: item.priceSource || "manual",
      amount: roundMoney(parseNumber(item.quantity) * parseNumber(item.price)),
      remark: item.remark || "",
    }));

    const amounts = getOrderAmounts(items);

    return {
      orderNo: currentSalesOrder.orderNo,
      issueDate: formatCompactDate(currentSalesOrder.issueDate),
      companyId: currentSalesOrder.companyId,
      warehouseId: global.getDefaultWarehouseId?.() || "WH001",
      companyName: company?.name || "",
      companyAddress: getInputValue("sales-company-address-input"),
      companyPhone: getInputValue("sales-company-phone-input"),
      companyContact: getInputValue("sales-company-contact-input"),
      customerId: currentSalesOrder.customerId,
      customerName: customer?.name || "",
      customerAddress: getInputValue("sales-customer-address-input"),
      customerContact: getInputValue("sales-customer-contact-input"),
      customerPhone: getInputValue("sales-customer-phone-input"),
      paymentTerms: getInputValue("sales-customer-payment-input"),
      customerNo: currentSalesOrder.customerNo || "--",
      taxRate: currentSalesOrder.taxRate,
      priceTaxMode: currentSalesOrder.priceTaxMode,
      items,
      subtotal: amounts.subtotal,
      taxAmount: amounts.taxAmount,
      totalAmount: amounts.totalAmount,
    };
  }

  function validateSalesOrder() {
    const payload = collectSalesOrderPayload();

    if (!payload.companyId) {
      return {
        ok: false,
        message: "请选择发货公司。",
        selector: "#sales-order-company-container",
      };
    }

    if (!payload.customerId) {
      return {
        ok: false,
        message: "请选择客户。",
        selector: "#sales-order-customer-container",
      };
    }

    if (!payload.items.length) {
      return {
        ok: false,
        message: "请至少选择一条商品明细并填写出货数量。",
        selector: currentSalesOrder.items[0]
          ? `#sales-order-item-product-container-${currentSalesOrder.items[0].id}`
          : "#sales-order-add-row-button",
      };
    }

    for (const item of payload.items) {
      if (item.quantity <= 0) {
        return {
          ok: false,
          message: `商品“${item.productName || "未命名商品"}”的出货数量必须大于 0。`,
          selector: `#sales-order-item-qty-container-${item.id}`,
        };
      }

      if (item.price <= 0) {
        return {
          ok: false,
          message: `请确认商品“${item.productName || "未命名商品"}”的本次送货单价，单价必须大于 0。`,
          selector: `#sales-order-item-price-${item.id}`,
        };
      }

      const product = findProductById(item.productId);
      const salesWarehouseId = payload.warehouseId;
      const currentStock =
        typeof global.getLedgerQuantity === "function"
          ? global.getLedgerQuantity(item.productId, salesWarehouseId)
          : parseNumber(product?.stockQuantity);
      if (!product) {
        return {
          ok: false,
          message: "存在无效商品，请重新选择。",
          selector: `#sales-order-item-product-container-${item.id}`,
        };
      }

      if (item.quantity > currentStock) {
        return {
          ok: false,
          message: `商品“${item.productName}”库存不足，当前库存 ${currentStock}。`,
          selector: `#sales-order-item-qty-container-${item.id}`,
        };
      }
    }

    return { ok: true, payload };
  }

  function buildSalesOrderPreviewMarkup(payload, items, totalAmount) {
    const safePayload = payload || {};
    const safeItems = (items || []).filter((item) => item && item.productName);
    const safeTotalAmount = parseNumber(totalAmount);
    const safeSubtotal = parseNumber(safePayload.subtotal ?? safeTotalAmount);
    const safeTaxAmount = parseNumber(safePayload.taxAmount);
    const taxRateText = `${(parseNumber(safePayload.taxRate) * 100).toFixed(2).replace(/\.00$/, "")}%`;
    const priceLabel =
      safePayload.priceTaxMode === "inclusive"
        ? "含税单价(RMB)"
        : "未税单价(RMB)";
    const rowsMarkup = safeItems
      .map(
        (item, index) => `
            <tr class="border-b border-gray-300 text-[15px] text-gray-900">
                <td class="border-r border-gray-300 px-2 py-3 text-center">${index + 1}</td>
                <td class="border-r border-gray-300 px-3 py-3 text-center">${escapeHTML(item.productName || "-")}</td>
                <td class="border-r border-gray-300 px-3 py-3 text-center">${escapeHTML(item.spec || "-")}</td>
                <td class="border-r border-gray-300 px-3 py-3 text-center">${escapeHTML(item.unit || "-")}</td>
                <td class="border-r border-gray-300 px-3 py-3 text-center">${parseNumber(item.deliveryQty ?? item.quantity)}</td>
                <td class="border-r border-gray-300 px-3 py-3 text-center">${parseNumber(item.price).toFixed(2)}</td>
                <td class="border-r border-gray-300 px-3 py-3 text-center">${(parseNumber(item.deliveryQty ?? item.quantity) * parseNumber(item.price)).toFixed(2)}</td>
                <td class="px-3 py-3">${escapeHTML(item.remark || "")}</td>
            </tr>
        `,
      )
      .join("");

    return `
            <div class="mx-auto min-w-[1220px] max-w-[1220px] border border-gray-300 bg-white text-[15px]">
                <div class="border-b border-gray-300 px-6 py-3 text-center">
                    <div class="text-[24px] font-semibold text-gray-900">${escapeHTML(safePayload.companyName || "-")}</div>
                </div>

                <div class="grid grid-cols-[1fr_260px] border-b border-gray-300">
                    <div class="px-6 py-3 text-center">
                        <div class="text-[24px] font-semibold tracking-[0.45em] text-gray-900">
                        <span class="inline-block" style="transform: translateX(140px);">销售出库单</span>
                        </div>
                    </div>
                    <div class="border-l border-gray-300 px-4 py-3 flex items-center justify-center">
                        <div class="flex w-full items-center justify-center gap-3 text-[15px] font-semibold text-gray-900">
                            <span class="shrink-0">制单日期：</span>
                            <span>${escapeHTML(formatCompactDate(safePayload.issueDate))}</span>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-[100px_520px_140px_170px_100px_190px] border-b border-gray-300 text-[15px]">
                    <div class="flex items-center justify-center border-r border-gray-300 px-3 py-2.5 text-center font-semibold text-gray-900">地址</div>
                    <div class="border-r border-gray-300 px-3 py-2.5">${escapeHTML(safePayload.companyAddress || "")}</div>
                    <div class="flex items-center justify-center border-r border-gray-300 px-3 py-2.5 text-center font-semibold text-gray-900">订货电话</div>
                    <div class="border-r border-gray-300 px-3 py-2.5">${escapeHTML(safePayload.companyPhone || "")}</div>
                    <div class="flex items-center justify-center border-r border-gray-300 px-3 py-2.5 text-center font-semibold text-gray-900">经手人</div>
                    <div class="px-3 py-2.5 text-center">${escapeHTML(safePayload.companyContact || "")}</div>
                </div>

                <div class="grid grid-cols-[100px_520px_140px_460px] border-b border-gray-300 text-[15px]">
                    <div class="flex items-center justify-center border-r border-gray-300 px-3 py-2.5 text-center font-semibold text-gray-900">收货单位</div>
                    <div class="border-r border-gray-300 px-3 py-2.5">${escapeHTML(safePayload.customerName || "")}</div>
                    <div class="flex items-center justify-center border-r border-gray-300 px-3 py-2.5 text-center font-semibold text-gray-900">收货地址</div>
                    <div class="px-3 py-2.5">${escapeHTML(safePayload.customerAddress || "")}</div>
                </div>

                <div class="grid grid-cols-[100px_230px_100px_190px_100px_210px_70px_220px] border-b border-gray-300 text-[15px]">
                    <div class="flex items-center justify-center border-r border-gray-300 px-3 py-2.5 text-center font-semibold text-gray-900">收货人</div>
                    <div class="border-r border-gray-300 px-3 py-2.5">${escapeHTML(safePayload.customerContact || "")}</div>
                    <div class="flex items-center justify-center border-r border-gray-300 px-3 py-2.5 text-center font-semibold text-gray-900">电话</div>
                    <div class="border-r border-gray-300 px-3 py-2.5">${escapeHTML(safePayload.customerPhone || "")}</div>
                    <div class="flex items-center justify-center border-r border-gray-300 px-3 py-2.5 text-center font-semibold text-gray-900">结款方式</div>
                    <div class="border-r border-gray-300 px-3 py-2.5">${escapeHTML(safePayload.paymentTerms || "")}</div>
                    <div class="flex items-center justify-center border-r border-gray-300 px-3 py-2.5 text-center font-semibold text-gray-900">NO</div>
                    <div class="px-3 py-2.5 font-semibold text-gray-900">${escapeHTML(safePayload.customerNo || "--")}</div>
                </div>

                <table class="w-full table-fixed border-collapse text-[15px]">
                    <thead>
                        <tr class="bg-gray-50 text-gray-900">
                            <th class="w-[70px] border-b border-r border-gray-300 px-2 py-3 text-center font-semibold">序号</th>
                            <th class="w-[290px] border-b border-r border-gray-300 px-3 py-3 text-center font-semibold">产品名称</th>
                            <th class="w-[160px] border-b border-r border-gray-300 px-3 py-3 text-center font-semibold">规格</th>
                            <th class="w-[100px] border-b border-r border-gray-300 px-3 py-3 text-center font-semibold">单位</th>
                            <th class="w-[140px] border-b border-r border-gray-300 px-3 py-3 text-center font-semibold">出库数量</th>
                            <th class="w-[170px] border-b border-r border-gray-300 px-3 py-3 text-center font-semibold">${priceLabel}</th>
                            <th class="w-[170px] border-b border-r border-gray-300 px-3 py-3 text-center font-semibold">金额(RMB)</th>
                            <th class="border-b border-gray-300 px-3 py-3 text-center font-semibold">备注</th>
                        </tr>
                    </thead>
                    <tbody>${rowsMarkup}</tbody>
                    <tfoot>
                        <tr class="bg-white text-sm text-gray-700">
                            <td colspan="4" class="border-t border-r border-gray-300 px-4 py-2 text-right">未税金额：${formatMoney(safeSubtotal)}</td>
                            <td colspan="2" class="border-t border-r border-gray-300 px-4 py-2 text-center">税点：${taxRateText}</td>
                            <td colspan="2" class="border-t border-gray-300 px-4 py-2 text-center">税额：${formatMoney(safeTaxAmount)}</td>
                        </tr>
                        <tr class="bg-gray-50">
                            <td colspan="2" class="border-t border-r border-gray-300 px-4 py-3 text-center text-[16px] font-semibold text-gray-900">合计金额：</td>
                            <td colspan="2" class="border-t border-r border-gray-300 px-4 py-3 text-center text-[16px] font-semibold text-gray-900">${formatMoney(safeTotalAmount)}</td>
                            <td class="border-t border-r border-gray-300 px-4 py-3 text-center text-[16px] font-semibold text-gray-900">大写</td>
                            <td colspan="3" class="border-t border-gray-300 px-4 py-3 text-center text-[16px] font-semibold text-gray-900">${escapeHTML(convertAmountToChineseUpper(safeTotalAmount))}</td>
                        </tr>
                    </tfoot>
                </table>

                <div class="grid grid-cols-[100px_minmax(0,1fr)] border-t border-gray-300">
                    <div class="flex items-center justify-center border-r border-gray-300 px-4 py-3 text-center text-[18px] font-semibold text-gray-900">协议</div>
                    <div class="px-4 py-3 text-[15px] leading-7 text-gray-900">${escapeHTML(SALES_ORDER_AGREEMENT_TEXT)}</div>
                </div>

                <div class="border-t border-gray-300 px-4 py-2.5 text-[15px] leading-7 text-gray-900">${escapeHTML(SALES_ORDER_NOTE_TEXT)}</div>

                <div class="grid grid-cols-2 border-t border-gray-300">
                    <div class="flex min-h-[120px] items-end border-r border-gray-300 px-8 py-4 text-[24px] leading-[1.65] text-gray-900">
                        <div>发货单位<br>及经手人（签章）</div>
                    </div>
                    <div class="flex min-h-[120px] items-end px-8 py-4 text-[24px] leading-[1.65] text-gray-900">
                        <div>收货单位<br>及经手人（签章）</div>
                    </div>
                </div>
            </div>
        `;
  }

  function buildDeliveryNotePrintMarkup(note) {
    if (!note) return "";

    const payload = {
      companyName: note.companyName,
      issueDate: note.issueDate || note.deliveryDate || note.createdAt,
      companyAddress: note.companyAddress,
      companyPhone: note.companyPhone,
      companyContact: note.companyContact,
      customerName: note.customerName,
      customerAddress: note.customerAddress,
      customerContact: note.customerContact,
      customerPhone: note.customerPhone,
      paymentTerms: note.paymentTerms,
      customerNo: note.customerNo,
      subtotal: note.subtotal,
      taxAmount: note.taxAmount,
      taxRate: note.taxRateSnapshot ?? note.taxRate,
      priceTaxMode: note.priceTaxModeSnapshot || note.priceTaxMode,
    };
    const items = (note.details || []).map((detail) => ({
      productName: detail.productNameSnapshot || detail.productName,
      spec: detail.specSnapshot || detail.spec,
      unit: detail.unitSnapshot || detail.unit,
      deliveryQty: detail.quantity,
      price: detail.confirmedUnitPrice ?? detail.unitPrice ?? detail.price ?? 0,
      remark: detail.notes || detail.remark || "",
    }));

    return buildSalesOrderPreviewMarkup(
      payload,
      items,
      Number(note.totalAmount) || 0,
    );
  }

  function printSalesOrderMarkup(markup, title = "送货单") {
    if (!markup || typeof global.print !== "function") {
      alert("当前浏览器无法调用打印功能，请更换浏览器后重试。");
      return false;
    }

    document.getElementById("delivery-note-print-root")?.remove();
    const printRoot = document.createElement("div");
    printRoot.id = "delivery-note-print-root";
    printRoot.className = "delivery-note-print-root";
    printRoot.innerHTML = `<div class="delivery-note-print-document">${markup}</div>`;
    document.body.appendChild(printRoot);

    const originalTitle = document.title;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      document.body.classList.remove("delivery-note-printing");
      printRoot.remove();
      document.title = originalTitle;
    };

    document.title = title;
    document.body.classList.add("delivery-note-printing");
    global.addEventListener("afterprint", cleanup, { once: true });

    try {
      global.print();
    } catch (error) {
      console.error("Delivery note print failed:", error);
      cleanup();
      alert("打印窗口打开失败，请重试。");
      return false;
    }

    global.setTimeout(cleanup, 1000);
    return true;
  }

  function printDeliveryNote(note) {
    const markup = buildDeliveryNotePrintMarkup(note);
    const printTitle = `送货单-${note?.customerNo || note?.orderNo || ""}`;
    return printSalesOrderMarkup(markup, printTitle);
  }

  function showSalesOrderPrintStep(note) {
    currentPrintableDeliveryNote = note;
    const printContent = document.getElementById("sales-order-print-content");
    if (printContent) {
      printContent.innerHTML = buildDeliveryNotePrintMarkup(note);
    }

    document.getElementById("sales-order-form-panel")?.classList.add("hidden");
    document
      .getElementById("sales-order-preview-panel")
      ?.classList.add("hidden");
    document
      .getElementById("sales-order-print-panel")
      ?.classList.remove("hidden");
    setStepState(3);
    scheduleSalesOrderPaperLayout();
  }

  function printCurrentSalesOrder() {
    if (!currentPrintableDeliveryNote) {
      alert("当前没有可打印的送货单。");
      return false;
    }
    return printDeliveryNote(currentPrintableDeliveryNote);
  }

  function finishSalesOrderPrint() {
    currentPrintableDeliveryNote = null;
    resetSalesOrderForm();
    if (typeof global.showSection === "function") {
      global.showSection("stock-movement");
    }

    const deliveryTab = document.querySelector(
      '#stock-tabs button[data-tab="delivery-note"]',
    );
    if (deliveryTab) {
      document
        .querySelectorAll("#stock-tabs button")
        .forEach((button) => button.classList.remove("active"));
      deliveryTab.classList.add("active");
    }
    global.renderStockMovementTable?.("delivery-note");
  }

  function renderPreviewContent() {
    const previewContainer = document.getElementById(
      "sales-order-preview-content",
    );
    if (!previewContainer) return;

    const payload = collectSalesOrderPayload();
    previewContainer.innerHTML = buildSalesOrderPreviewMarkup(
      payload,
      payload.items,
      payload.totalAmount,
    );
    scheduleSalesOrderPaperLayout();
  }

  function showSalesOrderForm() {
    const formPanel = document.getElementById("sales-order-form-panel");
    const previewPanel = document.getElementById("sales-order-preview-panel");
    const printPanel = document.getElementById("sales-order-print-panel");
    if (formPanel) formPanel.classList.remove("hidden");
    if (previewPanel) previewPanel.classList.add("hidden");
    if (printPanel) printPanel.classList.add("hidden");
    setStepState(1);
    scheduleSalesOrderPaperLayout();
  }

  function showSalesOrderPreview() {
    const validation = validateSalesOrder();
    if (!validation.ok) {
      global.reportFormError?.(
        validation.message,
        validation.selector,
        document.getElementById("sales-order"),
      );
      return;
    }

    renderPreviewContent();

    const formPanel = document.getElementById("sales-order-form-panel");
    const previewPanel = document.getElementById("sales-order-preview-panel");
    const printPanel = document.getElementById("sales-order-print-panel");
    if (formPanel) formPanel.classList.add("hidden");
    if (previewPanel) previewPanel.classList.remove("hidden");
    if (printPanel) printPanel.classList.add("hidden");
    setStepState(2);
    scheduleSalesOrderPaperLayout();
  }

  function resetSalesOrderForm() {
    currentPrintableDeliveryNote = null;
    currentSalesOrder = createEmptySalesOrder();

    setText("sales-order-no", currentSalesOrder.orderNo);
    setText("sales-order-agreement-text", SALES_ORDER_AGREEMENT_TEXT);
    setText("sales-order-note-text", SALES_ORDER_NOTE_TEXT);

    renderCompanySelect();
    renderCustomerSelect();
    renderIssueDatePicker();
    bindSalesTaxControls();

    applyCompanyToForm(null);
    applyCustomerToForm(null);
    updateCustomerNoDisplay();
    renderSalesOrderAddRowButton();
    renderSalesOrderTable();
    showSalesOrderForm();

    const previewContainer = document.getElementById(
      "sales-order-preview-content",
    );
    if (previewContainer) previewContainer.innerHTML = "";
    const printContainer = document.getElementById("sales-order-print-content");
    if (printContainer) printContainer.innerHTML = "";
    salesOrderInitialSnapshot = JSON.stringify(collectSalesOrderPayload());
  }

  function initSalesOrder() {
    initSalesOrderPaperScaling();
    resetSalesOrderForm();
  }

  function addSalesOrderRow() {
    currentSalesOrder.items.push(createSalesOrderItem());
    renderSalesOrderTable();
  }

  function removeSalesOrderRow(rowId) {
    if (currentSalesOrder.items.length <= 1) {
      currentSalesOrder.items = [createSalesOrderItem()];
    } else {
      currentSalesOrder.items = currentSalesOrder.items.filter(
        (item) => item.id !== rowId,
      );
    }
    renderSalesOrderTable();
  }

  function cancelSalesOrder() {
    if (typeof global.showSection === "function") {
      global.showSection("stock-movement");
      if (typeof global.renderStockMovementTable === "function") {
        global.renderStockMovementTable("all");
      }
    }
  }

  async function submitSalesOrder() {
    const validation = validateSalesOrder();
    if (!validation.ok) {
      showSalesOrderForm();
      global.reportFormError?.(
        validation.message,
        validation.selector,
        document.getElementById("sales-order"),
      );
      return;
    }

    const payload = validation.payload;
    const now = new Date();
    const deliveryNoteId = createRuntimeId("SD");
    const previousProductState = new Map(
      payload.items.map((item) => {
        const product = findProductById(item.productId);
        return [
          item.productId,
          product
            ? {
                stockQuantity: product.stockQuantity,
                updatedAt: product.updatedAt,
              }
            : null,
        ];
      }),
    );
    const previousDeliveryNotes = Array.isArray(mockData.deliveryNotes)
      ? mockData.deliveryNotes.slice()
      : [];
    const previousStockMovements = stockMovementData.slice();

    payload.items.forEach((item) => {
      const product = findProductById(item.productId);
      if (product) {
        product.stockQuantity = Math.max(
          0,
          parseNumber(product.stockQuantity) - item.quantity,
        );
        product.updatedAt =
          typeof getLocalISOString === "function"
            ? getLocalISOString()
            : new Date().toISOString();
      }
    });

    const deliveryNote = {
      id: deliveryNoteId,
      type: "sales",
      orderNo: payload.orderNo,
      issueDate: payload.issueDate,
      deliveryDate: payload.issueDate,
      status: "confirmed",
      subtotal: payload.subtotal,
      taxAmount: payload.taxAmount,
      totalAmount: payload.totalAmount,
      taxRateSnapshot: payload.taxRate,
      priceTaxModeSnapshot: payload.priceTaxMode,
      warehouseId: payload.warehouseId,
      notes: payload.items
        .map((item) => `${item.productName} x ${item.quantity}`)
        .join("；"),
      companyId: payload.companyId,
      companyName: payload.companyName,
      companyAddress: payload.companyAddress,
      companyPhone: payload.companyPhone,
      companyContact: payload.companyContact,
      customerId: payload.customerId,
      customerName: payload.customerName,
      customerAddress: payload.customerAddress,
      customerContact: payload.customerContact,
      customerPhone: payload.customerPhone,
      paymentTerms: payload.paymentTerms,
      customerNo: payload.customerNo,
      createdAt: now,
      updatedAt: now,
      details: payload.items.map((item) => ({
        id: createRuntimeId("SDD"),
        deliveryId: deliveryNoteId,
        productId: item.productId,
        productName: item.productName,
        productNameSnapshot: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        unitSnapshot: item.unit,
        spec: item.spec,
        specificationSnapshot: item.spec,
        unitPrice: item.price,
        confirmedUnitPrice: item.price,
        referencePriceSnapshot: item.referencePrice,
        referencePriceOriginalSnapshot: item.referencePriceOriginal,
        referencePriceTaxModeSnapshot: item.referencePriceTaxMode,
        lastTransactionPriceSnapshot: item.lastTransactionPrice,
        priceSource: item.priceSource,
        taxRateSnapshot: payload.taxRate,
        priceTaxModeSnapshot: payload.priceTaxMode,
        lineAmount: item.amount,
        totalAmount: item.amount,
        notes: item.remark || "",
        status: "confirmed",
      })),
    };

    if (!Array.isArray(mockData.deliveryNotes)) {
      mockData.deliveryNotes = [];
    }
    mockData.deliveryNotes.unshift(deliveryNote);

    payload.items.forEach((item) => {
      const warehouseId = payload.warehouseId;
      stockMovementData.unshift({
        id: createRuntimeId("SM"),
        type: "outbound",
        status: "confirmed",
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        operator: currentUser.name,
        warehouseId,
        locationCode: global.getDefaultLocationCode?.(warehouseId) || "",
        batchNo: "",
        expiryDate: null,
        remark: item.remark || `销售出库 - ${payload.orderNo}`,
        price: item.price,
        customerId: payload.customerId,
        customerName: payload.customerName,
        companyId: payload.companyId,
        companyName: payload.companyName,
        deliveryNoteId,
        orderNo: payload.orderNo,
        createdAt: now,
        updatedAt: now,
      });
    });

    const auditLogs = stageAuditLogs({
      actionType: "add",
      objectType: "delivery-note",
      objectName: payload.orderNo,
      details: `新增销售出库单：${payload.customerName || "-"} / ${payload.orderNo}`,
    });
    let saved = true;
    if (typeof saveMockData === "function") {
      saved = await saveMockData();
    }

    if (saved === false) {
      rollbackStagedAuditLogs(auditLogs);
      previousProductState.forEach((state, productId) => {
        const product = findProductById(productId);
        if (product && state) {
          product.stockQuantity = state.stockQuantity;
          product.updatedAt = state.updatedAt;
        }
      });
      mockData.deliveryNotes = previousDeliveryNotes;
      stockMovementData = previousStockMovements;
      if (typeof global.updateInventoryTable === "function") {
        global.updateInventoryTable();
      }
      if (typeof global.renderDashboardActivity === "function") {
        global.renderDashboardActivity();
      }
      alert("销售出库保存失败，本次库存和单据变更已回滚。");
      return false;
    }

    finalizeStagedAuditLogs(auditLogs);

    if (typeof global.updateInventoryTable === "function") {
      global.updateInventoryTable();
    }

    if (typeof global.renderDashboardActivity === "function") {
      global.renderDashboardActivity();
    }

    salesOrderInitialSnapshot = JSON.stringify(collectSalesOrderPayload());
    showSalesOrderPrintStep(deliveryNote);
    alert("销售出库已提交，请打印送货单。");
    return true;
  }

  global.initSalesOrder = initSalesOrder;
  global.addSalesOrderRow = addSalesOrderRow;
  global.removeSalesOrderRow = removeSalesOrderRow;
  global.goToSalesOrderPreview = showSalesOrderPreview;
  global.goToSalesOrderForm = showSalesOrderForm;
  global.cancelSalesOrder = cancelSalesOrder;
  global.submitSalesOrder = submitSalesOrder;
  global.printCurrentSalesOrder = printCurrentSalesOrder;
  global.finishSalesOrderPrint = finishSalesOrderPrint;
  global.printDeliveryNote = printDeliveryNote;
  global.printSalesOrderMarkup = printSalesOrderMarkup;
  global.buildDeliveryNotePrintMarkup = buildDeliveryNotePrintMarkup;
  global.buildSalesOrderPreviewMarkup = buildSalesOrderPreviewMarkup;
  global.syncSalesOrderPaperLayout = syncSalesOrderPaperLayout;
  global.hasUnsavedSalesOrder = function hasUnsavedSalesOrder() {
    const section = document.getElementById("sales-order");
    const printPanel = document.getElementById("sales-order-print-panel");
    if (!section || section.classList.contains("hidden")) return false;
    if (printPanel && !printPanel.classList.contains("hidden")) return false;
    if (!salesOrderInitialSnapshot) return false;
    return (
      JSON.stringify(collectSalesOrderPayload()) !== salesOrderInitialSnapshot
    );
  };
  global.discardSalesOrderChanges = function discardSalesOrderChanges() {
    salesOrderInitialSnapshot = "";
  };
})(window);
