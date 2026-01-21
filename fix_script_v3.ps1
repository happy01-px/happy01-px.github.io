$path = "c:\Users\01\Desktop\git-hub system\happy01-px.github.io\js\script.js"
$lines = [System.IO.File]::ReadAllLines($path, [System.Text.Encoding]::UTF8)

# Fix garbled stockMovementData
# Line 730 (index 729)
$lines[729] = "                        operator: '张三',"
# Line 731 (index 730)
$lines[730] = "                        remark: '客户订单#20240721-001',"
# Line 742 (index 741)
$lines[741] = "                        operator: '李四',"
# Line 743 (index 742)
$lines[742] = "                        remark: '采购入库',"

# Add "View" button to updateInventoryTable
# Line 563 (index 562)
# Current: <a href="#" class="text-primary hover:text-primary-dark mr-3">编辑</a>
# New: View + Edit
$lines[562] = '                        <a href="#" class="text-blue-600 hover:text-blue-900 mr-3">查看</a>' +
              '<a href="#" class="text-primary hover:text-primary-dark mr-3">编辑</a>'

[System.IO.File]::WriteAllLines($path, $lines, [System.Text.Encoding]::UTF8)
