# De Bareel — fix mapstructuur
# Voer uit in PowerShell als Administrator of gewoon dubbelklik

$root = "C:\home\user\Luigi"
$images = "$root\images"

Write-Host "`n=== De Bareel — Mapstructuur fixen ===" -ForegroundColor Cyan

# Verplaats HTML/CSS/JS die per ongeluk in images/ staan naar de hoofdmap
$verkeerd = @("index.html", "style.css", "script.js", "debareel-volledig.html", "maak-volledig.py")
foreach ($bestand in $verkeerd) {
    $pad = "$images\$bestand"
    if (Test-Path $pad) {
        Move-Item $pad "$root\$bestand" -Force
        Write-Host "  Verplaatst: images\$bestand → $bestand" -ForegroundColor Yellow
    }
}

# Toon de huidige mapstructuur
Write-Host "`n=== Huidige structuur ===" -ForegroundColor Cyan
Write-Host "`n$root\" -ForegroundColor White
Get-ChildItem $root -File | ForEach-Object { Write-Host "  $($_.Name)" }
Write-Host "  images\" -ForegroundColor White
Get-ChildItem $images -File | ForEach-Object { Write-Host "    $($_.Name)" }

Write-Host "`n=== Klaar! Open index.html in je browser ===" -ForegroundColor Green
