$path = "c:\Users\01\Desktop\git-hub system\happy01-px.github.io\js\script.js"
$content = Get-Content -Path $path -Encoding UTF8

# Fix renderStockMovementTable garbled text
$content[819] = '                                <span class="text-xs text-gray-500 mr-2">创建:</span>'
$content[826] = '                                <span class="text-xs text-gray-500 mr-2">更新:</span>'

$content | Set-Content -Path $path -Encoding UTF8
