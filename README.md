# 仓库库存管理系统

一个基于 `HTML + Tailwind + JavaScript` 的本地库存管理系统，当前采用单仓模式，支持进出货记录、供应商/客户/公司管理、日志查看、销售单出库和对账单管理。

当前版本定位为单机使用：服务只监听 `127.0.0.1`，尚未提供多用户登录和权限控制，请勿直接暴露到局域网或公网。

## 启动方式

1. 安装 Node.js 22.5 或更高版本。
2. 在项目目录运行 `npm start`。
3. 打开终端输出的本地地址。

推荐通过本地服务启动，此时业务数据会写入 SQLite。部署到 GitHub Pages 等静态站点时，系统会自动改用当前浏览器的本地存储；静态模式的数据不会同步到其他设备，清理浏览器网站数据前请先导出备份。不要直接双击 `index.html` 使用。

## 数据安全

- 本地服务使用 `data/inventory.sqlite` 作为唯一业务数据源，并启用 WAL 和完整同步模式。
- 常规业务会通过 `/api/transactions` 只提交本次新增、修改、删除和排序变化；服务端在一个 SQLite 事务中重建并校验结果，任何一项失败都会整体回滚。
- 每笔成功事务都会递增修订号，并在 `business_transactions` 中记录受影响记录，多个窗口不会静默覆盖数据。
- 第一次启动 SQLite 版本时，会优先读取旧版 `data/.snapshots/` 中最新的有效快照；没有快照时再从 `data/*.json` 导入。旧文件会保留，不会在迁移时删除。
- 静态部署无法访问保存接口时，会使用带版本号的浏览器本地快照，支持刷新后继续使用并防止多窗口静默覆盖。
- “系统设置 → 数据备份”可以导出或导入带版本号的完整 JSON 备份。
- 导入前会检查版本、字段类型、数量金额范围、状态枚举、重复 ID 和跨表引用；保存失败时会恢复导入前的数据。
- 库存流水是库存数量的唯一持久化账本；`stockQuantity` 只在页面运行时以不可枚举派生字段提供，JSON 快照、导出和默认数据均不再保存该字段。
- 系统会在后台按库存流水校验并重建运行时库存；旧版数据会自动迁移到主仓库并生成期初库存流水。
- 客户档案保存默认税点和含税/未税模式；客户商品价目表只提供参考价，销售出库时仍需确认本次单价。
- “价格管理”提供实体化进货价格表，并按“我方公司 + 客户”组合维护双方专属商品价格表。
- 新增进货采用批量进货单：公司和供应商只选择一次，可连续录入多个已有或新商品，并通过一次原子保存完成建档、入库和采购单记录。
- 已确认销售单会保存商品名称、规格、单位、客户参考价、确认单价、税点和价格类型快照，后续调价不会改动历史单据。
- 请勿把包含真实客户、电话、地址、价格或欠款的数据文件提交到公开仓库。

## 质量检查

```powershell
npm run ci:check
```

该命令依次执行代码检查、类型检查、测试和覆盖率检查。

## Windows 桌面应用

开发调试桌面窗口：

```powershell
npm run desktop:start
```

生成 Windows 安装程序：

```powershell
npm run build
```

安装程序会生成到 `desktop-dist/Happy01Inventory-Setup-1.0.0.exe`。安装后从桌面或开始菜单打开，只会显示库存系统自己的窗口，不会再打开浏览器或终端窗口。关闭应用窗口时，本地服务和数据库连接会一起安全退出；已经提交的数据不会丢失，下次打开会继续读取。

如仍需生成旧式“本地服务 + 浏览器”版本，可运行：

```powershell
npm run build:server
```

打包版的可变数据不会写在 EXE 旁边，而是保存到：

```text
%LOCALAPPDATA%\Happy01Inventory\data\inventory.sqlite
```

因此应用升级或替换 EXE 时不会覆盖业务数据库。仓库中的 `data/*.json` 只作为首次安装的默认数据和旧版本迁移来源。

## 目录说明

- `index.html`: 主页面
- `js/script.js`: Ant Design 通用 UI 组件，不再包含账单或应用外壳逻辑
- `js/app/app-shell.js`: 分页、筛选器和通用模态框基础能力
- `js/modules/master-data-core.js`: 主数据校验、快照回滚和通用表单能力
- `js/modules/master-data-products.js`: 商品维护和库存列表
- `js/modules/master-data-module.js`: 公司、供应商和客户维护
- `js/modules/customer-price-module.js`: 客户商品参考价、价格版本和上次成交价
- `js/modules/price-management-module.js`: 进货价格表与公司客户商品价格表页面
- `js/modules/inventory-ledger.js`: 默认仓库、流水汇总和库存账实核对
- `js/modules/bills-core.js`: 对账单纯函数与格式化规则
- `js/modules/bills-data.js`: 对账单迁移、来源映射和种子数据
- `js/modules/bills-statements.js`: 对账单构建、重复检查和来源占用计算
- `js/modules/bills-list.js`: 对账单列表、筛选和通用弹窗
- `js/modules/bills-module.js`: 对账单路由、创建、查看、付款及导出流程
- `css/bills.css`: 对账单专属样式
- `js/sales-order.js`: 销售单逻辑
- `data/`: 默认数据文件
- `server/sqlite-store.js`: SQLite 表结构、增量变更、事务提交和修订日志
- `preview_server.js`: 本地预览与数据保存服务
