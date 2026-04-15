(function initAppState(global) {
    const state = global.AppState || {
        defaultMockData: global.normalizeMockData(),
        defaultStockMovementData: [],
        defaultLogsData: [],
        mockData: global.normalizeMockData(),
        stockMovementData: [],
        logsData: []
    };

    global.AppState = state;

    const propertyNames = [
        'defaultMockData',
        'defaultStockMovementData',
        'defaultLogsData',
        'mockData',
        'stockMovementData',
        'logsData'
    ];

    propertyNames.forEach((propertyName) => {
        const descriptor = Object.getOwnPropertyDescriptor(global, propertyName);
        if (descriptor && !descriptor.configurable) return;

        Object.defineProperty(global, propertyName, {
            configurable: true,
            enumerable: true,
            get() {
                return state[propertyName];
            },
            set(value) {
                state[propertyName] = value;
            }
        });
    });
})(window);
