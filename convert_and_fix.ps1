$path = "c:\Users\01\Desktop\git-hub system\happy01-px.github.io\js\script.js"
# Read as GBK (936)
$enc = [System.Text.Encoding]::GetEncoding(936)
$lines = [System.IO.File]::ReadAllLines($path, $enc)

# Fix lines that were written as UTF-8 bytes and thus read as garbled in GBK
# Line 563 (index 562)
$lines[562] = '                        <a href="#" class="text-blue-600 hover:text-blue-900 mr-3">查看</a><a href="#" class="text-primary hover:text-primary-dark mr-3">编辑</a>'

# Line 730 (index 729)
$lines[729] = "                        operator: '张三',"

# Line 731 (index 730)
$lines[730] = "                        remark: '客户订单#20240721-001',"

# Line 742 (index 741)
$lines[741] = "                        operator: '李四',"

# Line 743 (index 742)
$lines[742] = "                        remark: '采购入库',"

# Write as UTF-8
[System.IO.File]::WriteAllLines($path, $lines, [System.Text.Encoding]::UTF8)
