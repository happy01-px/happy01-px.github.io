(function initSettingsModule(global) {
    function bindSettingsEvents() {
        const settingsTabs = document.querySelectorAll('#settings-tabs button');
        settingsTabs.forEach(tab => {
            tab.addEventListener('click', function onClick() {
                settingsTabs.forEach(item => {
                    item.classList.remove('border-primary', 'text-primary');
                    item.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
                });

                this.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
                this.classList.add('border-primary', 'text-primary');

                const contents = document.querySelectorAll('.settings-content');
                contents.forEach(content => content.classList.add('hidden'));

                const targetId = this.getAttribute('data-target');
                document.getElementById(targetId).classList.remove('hidden');
            });
        });

        const exportBtn = document.getElementById('export-data-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', exportAllData);
        }

        const importBtn = document.getElementById('import-data-btn');
        const importInput = document.getElementById('import-data-input');
        if (importBtn && importInput) {
            importBtn.addEventListener('click', () => importInput.click());
            importInput.addEventListener('change', async event => {
                if (event.target.files.length > 0) {
                    const ok = await window.showAntdConfirm({
                        title: '导入数据',
                        content: '导入数据将覆盖当前所有数据，确定要继续吗？',
                        okText: '继续',
                        cancelText: '取消'
                    });
                    if (ok) {
                        importData(event.target.files[0]);
                    }
                    event.target.value = '';
                }
            });
        }
    }

    global.bindSettingsEvents = bindSettingsEvents;
    global.AppSettingsModule = Object.freeze({
        bindSettingsEvents
    });
})(window);
