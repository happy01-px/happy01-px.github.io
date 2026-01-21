$path = "c:\Users\01\Desktop\git-hub system\happy01-px.github.io\js\script.js"

Write-Host "--- Reading as GBK ---"
$linesGBK = [System.IO.File]::ReadAllLines($path, [System.Text.Encoding]::GetEncoding(936))
Write-Host "L820: $($linesGBK[819])"
Write-Host "L563: $($linesGBK[562])"

Write-Host "--- Reading as UTF-8 ---"
$linesUTF8 = [System.IO.File]::ReadAllLines($path, [System.Text.Encoding]::UTF8)
Write-Host "L820: $($linesUTF8[819])"
Write-Host "L563: $($linesUTF8[562])"
