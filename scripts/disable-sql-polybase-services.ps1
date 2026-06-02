# Stop PolyBase Windows services if unused (run on SQL Server host as Administrator).
# Cosmos does not use PolyBase - safe when sys.external_tables is empty.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/disable-sql-polybase-services.ps1

$ErrorActionPreference = 'Stop'

$patterns = @(
  '*PolyBase*',
  '*SQL Server PolyBase*',
  '*mpdw*'
)

$services = Get-Service -ErrorAction SilentlyContinue | Where-Object {
  $n = $_.Name
  $d = $_.DisplayName
  foreach ($p in $patterns) {
    if ($n -like $p -or $d -like $p) { return $true }
  }
  return $false
}

if (-not $services) {
  Write-Output '[polybase-disable] No PolyBase-related services found on this machine.'
  Write-Output 'If mpdwsvcl still uses CPU, check Task Manager for the full process path (may be another SQL component or a remote host).'
  exit 0
}

foreach ($svc in $services) {
  $msg = '[polybase-disable] Found: ' + $svc.Name + ' - ' + $svc.DisplayName + ' [' + $svc.Status + ']'
  Write-Output $msg
}

foreach ($svc in $services) {
  if ($svc.Status -eq 'Running') {
    Write-Output ('[polybase-disable] Stopping ' + $svc.Name + '...')
    Stop-Service -Name $svc.Name -Force -ErrorAction SilentlyContinue
  }
  Write-Output ('[polybase-disable] Setting ' + $svc.Name + ' startup type to Manual')
  Set-Service -Name $svc.Name -StartupType Manual -ErrorAction SilentlyContinue
}

Write-Output '[polybase-disable] Done. Reboot optional. Cosmos ERP does not require PolyBase.'
