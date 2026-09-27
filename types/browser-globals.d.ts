interface Window {
  [key: string]: any;
}

interface HTMLElement {
  _reactRoot?: any;
  checked?: boolean;
  disabled?: boolean;
  options?: any;
  required?: boolean;
  selected?: boolean;
  type?: string;
  value?: any;
}

interface EventTarget {
  checked?: boolean;
  closest?(selectors: string): any;
  value?: any;
}

interface Document {
  getElementById(elementId: string): any;
  querySelector(selectors: string): any;
  querySelectorAll(selectors: string): any;
}

interface Element {
  checked?: boolean;
  disabled?: boolean;
  selected?: boolean;
  type?: string;
  value?: any;
}

interface FormData {
  get(name: string): any;
}

declare var mockData: any;
declare var stockMovementData: any[];
declare var logsData: any[];
declare var defaultMockData: any;
declare var defaultStockMovementData: any[];
declare var defaultLogsData: any[];
declare var currentUser: any;
declare var clientIP: string;
declare var paginationState: any;

declare function alert(message?: any): void;
declare function deepClone(value: any): any;
declare function normalizeList(value: any): any[];
declare function normalizeMockData(value: any): any;
declare function restoreStockMovementDates(value: any): any[];
declare function restoreLogDates(value: any): any[];
declare function createRuntimeId(prefix: string): string;
declare function createSequentialId(
  records: any[],
  prefix: string,
  padLength?: number,
): string;
declare function getLocalISOString(): string;
declare function addLog(...args: any[]): any;
declare function escapeHTML(...args: any[]): any;
declare function exportAllData(...args: any[]): any;
declare function finalizeStagedAuditLogs(...args: any[]): any;
declare function getInitial(...args: any[]): any;
declare function importData(...args: any[]): any;
declare function initInventoryFilters(...args: any[]): any;
declare function persistLogsData(...args: any[]): any;
declare function renderAntdEmptyTableRow(...args: any[]): any;
declare function renderAntdInput(...args: any[]): any;
declare function renderAntdRadioGroup(...args: any[]): any;
declare function renderAntdSelect(...args: any[]): any;
declare function renderBillPartyFilter(...args: any[]): any;
declare function renderDashboardActivity(...args: any[]): any;
declare function renderLogsTable(...args: any[]): any;
declare function renderPaginationControl(...args: any[]): any;
declare function renderStockMovementTable(...args: any[]): any;
declare function rollbackStagedAuditLogs(...args: any[]): any;
declare function saveMockData(...args: any[]): any;
declare function showModal(...args: any[]): any;
declare function stageAuditLogs(...args: any[]): any;
declare function updateBillsTable(...args: any[]): any;
declare function updateInventoryTable(...args: any[]): any;
declare function updateSupplierTable(...args: any[]): any;
