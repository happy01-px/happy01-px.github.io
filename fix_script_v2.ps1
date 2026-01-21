$path = "c:\Users\01\Desktop\git-hub system\happy01-px.github.io\js\script.js"
$lines = [System.IO.File]::ReadAllLines($path, [System.Text.Encoding]::UTF8)

# Fix updateInventoryTable (indices 0-based from Read tool output)
# Note: Read tool output lines start at 1.
# 488 -> 487
$lines[487] = "                const supplierName = supplier ? supplier.name : '未知供应商';"
# 538 -> 537
$lines[537] = '                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">¥${product.costPrice.toLocaleString()}</td>'
# 539 -> 538
$lines[538] = '                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">¥${stockValue.toLocaleString()}</td>'
# 547 -> 546
$lines[546] = '                                <span class="text-xs text-gray-500 mr-2">创建:</span>'
# 554 -> 553
$lines[553] = '                                <span class="text-xs text-gray-500 mr-2">更新:</span>'

[System.IO.File]::WriteAllLines($path, $lines, [System.Text.Encoding]::UTF8)
