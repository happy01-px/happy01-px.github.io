$scriptPath = "c:\Users\01\Desktop\git-hub system\happy01-px.github.io\js\script.js"
$replacementsPath = "c:\Users\01\Desktop\git-hub system\happy01-px.github.io\replacements.txt"

# Read replacements as UTF-8
$replacements = [System.IO.File]::ReadAllLines($replacementsPath, [System.Text.Encoding]::UTF8)

# Read script.js as GBK (936) to correctly interpret existing GBK content
$enc = [System.Text.Encoding]::GetEncoding(936)
$lines = [System.IO.File]::ReadAllLines($scriptPath, $enc)

# Apply replacements
# Line 563 (index 562)
$lines[562] = $replacements[0]

# Line 730 (index 729)
$lines[729] = $replacements[1]

# Line 731 (index 730)
$lines[730] = $replacements[2]

# Line 742 (index 741)
$lines[741] = $replacements[3]

# Line 743 (index 742)
$lines[742] = $replacements[4]

# Write back as UTF-8
[System.IO.File]::WriteAllLines($scriptPath, $lines, [System.Text.Encoding]::UTF8)

Write-Host "Fixed encoding and content."
