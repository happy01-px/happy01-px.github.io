(function initBillsState(global) {
  if (global.BillsModuleState) return;

  global.BillsModuleState = {
    activeTab: "customer",
    filtersBound: false,
    tableEventsBound: false,
    addButtonBound: false,
    modalLifecycleBound: false,
    routeBound: false,
    pendingDraft: null,
    modalCloseHandler: null,
    activeViewStatementId: "",
    activeViewReturnTab: "",
    previousBillsRoute: null,
    currentBillsRoute: null,
  };
})(window);
