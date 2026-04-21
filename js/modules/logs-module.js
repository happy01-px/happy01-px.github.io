(function initLogsModule(global) {
    function addLog(actionType, objectType, objectName, details) {
        const log = {
            id: createRuntimeId('LOG'),
            timestamp: new Date(),
            userId: currentUser.id,
            userName: currentUser.name,
            actionType,
            objectType,
            objectName,
            details,
            ipAddress: clientIP
        };

        logsData.unshift(log);
        localStorage.setItem('logsData', JSON.stringify(logsData));

        const logsSection = document.querySelector('#logs');
        if (logsSection && !logsSection.classList.contains('hidden')) {
            renderLogsTable();
        }
    }

    function renderLogsTable() {
        const logsTableBody = document.getElementById('logs-table-body');
        if (!logsTableBody) return;

        logsTableBody.innerHTML = '';

        const typeFilter = document.getElementById('log-filter-type') ? document.getElementById('log-filter-type').value : '';
        const userFilter = document.getElementById('log-filter-user') ? document.getElementById('log-filter-user').value.toLowerCase().trim() : '';
        const dateStartFilter = document.getElementById('log-filter-date-start') ? document.getElementById('log-filter-date-start').value : '';
        const dateEndFilter = document.getElementById('log-filter-date-end') ? document.getElementById('log-filter-date-end').value : '';
        const searchFilter = document.getElementById('log-filter-search') ? document.getElementById('log-filter-search').value.toLowerCase().trim() : '';

        let filteredLogs = logsData.filter(log => {
            if (typeFilter && log.actionType !== typeFilter) return false;
            if (userFilter && !log.userName.toLowerCase().includes(userFilter)) return false;

            if (dateStartFilter) {
                const logDate = new Date(log.timestamp);
                const startDate = new Date(dateStartFilter);
                if (!dateStartFilter.includes(':')) {
                    startDate.setHours(0, 0, 0, 0);
                }
                if (logDate < startDate) return false;
            }

            if (dateEndFilter) {
                const logDate = new Date(log.timestamp);
                const endDate = new Date(dateEndFilter);
                if (!dateEndFilter.includes(':')) {
                    endDate.setHours(23, 59, 59, 999);
                }
                if (logDate > endDate) return false;
            }

            if (searchFilter && !log.objectName.toLowerCase().includes(searchFilter)) return false;

            return true;
        });

        filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        paginationState.logs.total = filteredLogs.length;
        let { page, pageSize } = paginationState.logs;

        const totalPages = Math.ceil(filteredLogs.length / pageSize);
        if (page > totalPages && totalPages > 0) {
            paginationState.logs.page = totalPages;
            page = totalPages;
        }

        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

        if (paginatedLogs.length === 0) {
            logsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">没有找到匹配的日志记录</td>
                </tr>
            `;
            renderPaginationControl('logs-pagination-container', 'logs', renderLogsTable);
            return;
        }

        paginatedLogs.forEach(log => {
            const formattedTime = new Date(log.timestamp).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });

            let actionTypeText = '';
            let actionTypeClass = '';

            switch (log.actionType) {
                case 'add':
                    actionTypeText = '新增';
                    actionTypeClass = 'bg-green-100 text-green-800';
                    break;
                case 'edit':
                    actionTypeText = '编辑';
                    actionTypeClass = 'bg-blue-100 text-blue-800';
                    break;
                case 'delete':
                    actionTypeText = '删除';
                    actionTypeClass = 'bg-red-100 text-red-800';
                    break;
                case 'cancel':
                    actionTypeText = '作废';
                    actionTypeClass = 'bg-rose-100 text-rose-700';
                    break;
                case 'import':
                    actionTypeText = '导入';
                    actionTypeClass = 'bg-yellow-100 text-yellow-800';
                    break;
                case 'export':
                    actionTypeText = '导出';
                    actionTypeClass = 'bg-purple-100 text-purple-800';
                    break;
                default:
                    actionTypeText = log.actionType;
                    actionTypeClass = 'bg-gray-100 text-gray-800';
            }

            const safeActionTypeText = escapeHTML(actionTypeText || '-');
            const safeUserName = escapeHTML(log.userName || '-');
            const safeObjectName = escapeHTML(log.objectName || '-');
            const safeDetails = escapeHTML(log.details || '-');
            const safeIpAddress = escapeHTML(log.ipAddress || '-');

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formattedTime}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div class="flex items-center">
                        <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(log.userName)}</span>
                        ${safeUserName}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${actionTypeClass}">${safeActionTypeText}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${safeObjectName}</td>
                <td class="px-6 py-4 text-sm text-gray-500">${safeDetails}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${safeIpAddress}</td>
            `;

            logsTableBody.appendChild(row);
        });

        renderPaginationControl('logs-pagination-container', 'logs', renderLogsTable);
    }

    global.addLog = addLog;
    global.renderLogsTable = renderLogsTable;
    global.AppLogsModule = Object.freeze({
        addLog,
        renderLogsTable
    });
})(window);
