# Opens Cosmos in a Chrome-class browser at a fixed tablet window size (Windows).
# Store OS (POS) primary device: tablet landscape — default 1180×820 (swap for 820×1180 portrait if needed).
# Usage:
#   .\scripts\open-cosmos-tablet-browser.ps1
#   .\scripts\open-cosmos-tablet-browser.ps1 -Url "http://192.168.0.107:4000/pos/login" -Width 820 -Height 1180
param(
  [string] $Url = "http://localhost:4000/pos/login",
  [int] $Width = 1180,
  [int] $Height = 820
)

$chrome = "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe"
$chrome86 = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"

$exe = $null
foreach ($c in @($chrome, $chrome86, $edge)) {
  if ($c -and (Test-Path -LiteralPath $c)) { $exe = $c; break }
}

if (-not $exe) {
  Write-Error "No Chrome or Edge found. Install Google Chrome or Microsoft Edge."
  exit 1
}

# --window-size=w,h opens a new window with inner viewport roughly that size (OS chrome adds title bar).
$args = @(
  "--new-window",
  "--window-size=${Width},${Height}",
  $Url
)

Start-Process -FilePath $exe -ArgumentList $args
Write-Host "Launched $exe at ${Width}x${Height} -> $Url"
