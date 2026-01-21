const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'js', 'script.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

// Fix updateInventoryTable
lines[487] = "                const supplierName = supplier ? supplier.name : '未知供应商';";
lines[537] = '                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">¥${product.costPrice.toLocaleString()}</td>';
lines[538] = '                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">¥${stockValue.toLocaleString()}</td>';
lines[546] = '                                <span class="text-xs text-gray-500 mr-2">创建:</span>';
lines[553] = '                                <span class="text-xs text-gray-500 mr-2">更新:</span>';

// Write back
fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Fixed script.js');
