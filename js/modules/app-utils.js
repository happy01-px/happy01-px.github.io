(function initAppUtils(global) {
    const existingUser = global.currentUser;

    global.currentUser = existingUser || {
        id: 'U001',
        name: '张三',
        role: 'admin'
    };

    global.clientIP = global.clientIP || '192.168.1.100';

    function getLocalISOString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    }

    function deepClone(data) {
        return JSON.parse(JSON.stringify(data ?? {}));
    }

    function normalizeList(value) {
        return Array.isArray(value) ? value : [];
    }

    function normalizeMockData(data = {}) {
        return {
            products: normalizeList(data.products),
            suppliers: normalizeList(data.suppliers),
            customers: normalizeList(data.customers),
            companies: normalizeList(data.companies),
            bills: normalizeList(data.bills),
            deliveryNotes: normalizeList(data.deliveryNotes)
        };
    }

    function restoreStockMovementDates(records = []) {
        return normalizeList(records).map(record => ({
            ...record,
            createdAt: record?.createdAt ? new Date(record.createdAt) : new Date(),
            updatedAt: record?.updatedAt ? new Date(record.updatedAt) : new Date()
        }));
    }

    function restoreLogDates(records = []) {
        return normalizeList(records).map(log => ({
            ...log,
            timestamp: log?.timestamp ? new Date(log.timestamp) : new Date()
        }));
    }

    function escapeHTML(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function createSequentialId(items, prefix, padLength = 3) {
        const maxId = normalizeList(items).reduce((max, item) => {
            const rawId = String(item?.id ?? '');
            if (!rawId.startsWith(prefix)) return max;

            const numericPart = rawId.slice(prefix.length).match(/\d+/)?.[0];
            const parsedNumber = Number.parseInt(numericPart, 10);
            return Number.isFinite(parsedNumber) ? Math.max(max, parsedNumber) : max;
        }, 0);

        return `${prefix}${String(maxId + 1).padStart(padLength, '0')}`;
    }

    function createRuntimeId(prefix) {
        return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    }

    global.getLocalISOString = getLocalISOString;
    global.deepClone = deepClone;
    global.normalizeList = normalizeList;
    global.normalizeMockData = normalizeMockData;
    global.restoreStockMovementDates = restoreStockMovementDates;
    global.restoreLogDates = restoreLogDates;
    global.escapeHTML = escapeHTML;
    global.createSequentialId = createSequentialId;
    global.createRuntimeId = createRuntimeId;

    global.AppUtils = Object.freeze({
        getLocalISOString,
        deepClone,
        normalizeList,
        normalizeMockData,
        restoreStockMovementDates,
        restoreLogDates,
        escapeHTML,
        createSequentialId,
        createRuntimeId
    });
})(window);
