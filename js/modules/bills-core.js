(function initBillsCore(global) {
  const BILL_TYPE_META = Object.freeze({
    customer: {
      label: "客户对账单",
      partyLabel: "客户",
      emptyText: "当前没有客户对账单",
    },
    supplier: {
      label: "供应商对账单",
      partyLabel: "供应商",
      emptyText: "当前没有供应商对账单",
    },
    payment: {
      label: "付款计划",
      partyLabel: "对象",
      emptyText: "当前没有待付款或部分付款对账单",
    },
  });

  const BILL_STATUS_META = Object.freeze({
    pending_check: { label: "待核对", badgeClass: "bg-blue-100 text-blue-700" },
    pending_payment: { label: "待付款", badgeClass: "bg-red-100 text-red-700" },
    partial_paid: {
      label: "部分付款",
      badgeClass: "bg-yellow-100 text-yellow-700",
    },
    paid: { label: "已结清", badgeClass: "bg-green-100 text-green-700" },
    cancelled: { label: "已作废", badgeClass: "bg-gray-100 text-gray-600" },
  });

  function getBillsMeta(tabKey) {
    return BILL_TYPE_META[tabKey] || BILL_TYPE_META.customer;
  }

  function normalizeBillStatus(status) {
    const map = {
      pending: "pending_check",
      created: "pending_check",
      draft: "pending_check",
      verified: "pending_payment",
      sent: "pending_payment",
      pending_payment: "pending_payment",
      partial_paid: "partial_paid",
      partial: "partial_paid",
      paid: "paid",
      confirmed: "paid",
      cancelled: "cancelled",
      canceled: "cancelled",
    };
    return map[String(status || "").trim()] || "pending_check";
  }

  function normalizeBillDate(value) {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

    const raw = String(value).trim();
    if (/^\d{8}$/.test(raw)) {
      return new Date(
        `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00`,
      );
    }

    const normalized = raw.includes("T") ? raw : raw.replace(/\//g, "-");
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatBillDateOnly(value) {
    const date = normalizeBillDate(value);
    if (!date) return "-";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatBillDateTime(value) {
    const date = normalizeBillDate(value);
    if (!date) return "-";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  }

  function formatStatementPeriod(start, end) {
    return `${formatBillDateOnly(start)} 至 ${formatBillDateOnly(end)}`;
  }

  function roundCurrency(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function formatBillCurrency(value) {
    return `¥${roundCurrency(value).toFixed(2)}`;
  }

  function getStatusBadgeHtml(status) {
    const meta =
      BILL_STATUS_META[normalizeBillStatus(status)] ||
      BILL_STATUS_META.pending_check;
    return `<span class="bills-status-badge ${meta.badgeClass}">${meta.label}</span>`;
  }

  function convertAmountToChineseUpperForBills(amount) {
    const number = roundCurrency(amount);
    if (!number) return "人民币零元整";

    const digits = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
    const units = ["", "拾", "佰", "仟"];
    const groups = ["", "万", "亿", "兆"];
    const fractionUnits = ["角", "分"];

    const integerPart = Math.floor(number);
    const decimalPart = Math.round((number - integerPart) * 100);

    function convertInteger(num) {
      const raw = String(num);
      const result = [];
      const groupCount = Math.ceil(raw.length / 4);

      for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
        const start = Math.max(raw.length - (groupIndex + 1) * 4, 0);
        const end = raw.length - groupIndex * 4;
        const chunk = raw.slice(start, end).padStart(4, "0");
        let chunkText = "";

        for (let i = 0; i < chunk.length; i += 1) {
          const digit = Number(chunk[i]);
          if (!digit) {
            if (chunkText && !chunkText.endsWith("零")) {
              chunkText += "零";
            }
            continue;
          }
          chunkText += digits[digit] + units[chunk.length - i - 1];
        }

        chunkText = chunkText.replace(/零+$/g, "");
        if (chunkText) {
          result.unshift(chunkText + groups[groupIndex]);
        }
      }

      return result
        .join("")
        .replace(/零+/g, "零")
        .replace(/零(万|亿|兆)/g, "$1");
    }

    const integerText = convertInteger(integerPart) || "零";
    let fractionText = "";
    if (decimalPart > 0) {
      const jiao = Math.floor(decimalPart / 10);
      const fen = decimalPart % 10;
      if (jiao) fractionText += digits[jiao] + fractionUnits[0];
      if (fen) fractionText += digits[fen] + fractionUnits[1];
    }

    return `人民币${integerText}元${fractionText || "整"}`
      .replace(/零角零分$/, "整")
      .replace(/零分$/, "");
  }

  global.BillsCore = Object.freeze({
    BILL_TYPE_META,
    BILL_STATUS_META,
    getBillsMeta,
    normalizeBillStatus,
    normalizeBillDate,
    formatBillDateOnly,
    formatBillDateTime,
    formatStatementPeriod,
    roundCurrency,
    formatBillCurrency,
    getStatusBadgeHtml,
    convertAmountToChineseUpperForBills,
  });
})(window);
