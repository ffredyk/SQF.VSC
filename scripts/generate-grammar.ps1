# Generate-ArmaSQFGrammar.ps1
# Reads reference.txt, extracts all Arma scripting commands,
# and updates sqf.tmLanguage.json with full command syntax highlighting.
# Also ensures correct pattern ordering (builtin-commands before variables).

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

# ── Step 1: Extract commands from reference.txt ──────────────────────

$refFile = "..\SQF.NET\reference.txt"
$commandsFile = "commands-extracted.txt"
$grammarFile = "syntaxes\sqf.tmLanguage.json"

if (-not (Test-Path $refFile)) {
    Write-Error "reference.txt not found at $refFile"
    exit 1
}

Write-Host "Extracting commands from reference.txt..."
$content = Get-Content $refFile -Encoding UTF8
$commands = $content |
    Where-Object { $_ -match '^    ([a-zA-Z_][a-zA-Z0-9_]*)\s*$' } |
    ForEach-Object { $matches[1] } |
    Sort-Object -Unique

Write-Host "  Found $($commands.Count) unique commands."

# ── Step 2: Build pattern groups ─────────────────────────────────────

$groups = $commands | Group-Object { $_[0].ToString().ToLower() } | Sort-Object Name

$patterns = @()
foreach ($g in $groups) {
    $joined = ($g.Group -join '|')
    $pattern = @{
        name = "support.function.sqf"
        match = "\b($joined)\b"
    }
    $patterns += $pattern
}

Write-Host "  Created $($patterns.Count) pattern groups (by first letter)."

# ── Step 3: Update grammar ──────────────────────────────────────────

Write-Host "Updating $grammarFile..."

$grammar = Get-Content $grammarFile -Raw -Encoding UTF8 | ConvertFrom-Json

# Replace builtin-commands patterns
$grammar.repository.'builtin-commands'.patterns = $patterns

# Ensure builtin-commands comes BEFORE variables in top-level patterns
$topPatterns = $grammar.patterns
$varTop = -1; $cmdTop = -1
for ($i = 0; $i -lt $topPatterns.Count; $i++) {
    if ($topPatterns[$i].include -eq '#variables') { $varTop = $i }
    if ($topPatterns[$i].include -eq '#builtin-commands') { $cmdTop = $i }
}
if ($varTop -ge 0 -and $cmdTop -ge 0 -and $varTop -lt $cmdTop) {
    $temp = $topPatterns[$varTop]
    $topPatterns[$varTop] = $topPatterns[$cmdTop]
    $topPatterns[$cmdTop] = $temp
    $grammar.patterns = $topPatterns
    Write-Host "  Fixed top-level order: builtin-commands before variables."
}

# Ensure builtin-commands comes BEFORE variables inside code-blocks
$cbPatterns = $grammar.repository.'code-blocks'.patterns[0].patterns
$varCb = -1; $cmdCb = -1
for ($i = 0; $i -lt $cbPatterns.Count; $i++) {
    if ($cbPatterns[$i].include -eq '#variables') { $varCb = $i }
    if ($cbPatterns[$i].include -eq '#builtin-commands') { $cmdCb = $i }
}
if ($varCb -ge 0 -and $cmdCb -ge 0 -and $varCb -lt $cmdCb) {
    $temp = $cbPatterns[$varCb]
    $cbPatterns[$varCb] = $cbPatterns[$cmdCb]
    $cbPatterns[$cmdCb] = $temp
    $grammar.repository.'code-blocks'.patterns[0].patterns = $cbPatterns
    Write-Host "  Fixed code-block order: builtin-commands before variables."
}

# Write back
$json = $grammar | ConvertTo-Json -Depth 10
$json | Set-Content $grammarFile -Encoding UTF8 -NoNewline
Add-Content $grammarFile "" -Encoding UTF8

Write-Host "Done. Grammar updated with $($commands.Count) Arma SQF commands."
