#requires -Version 5.1
<#
  Starts Graphiti MCP with stdio or HTTP using uv (no Docker).
  HTTP default in config exposes MCP at http://localhost:8000/mcp/ — same as Docker path.

  Prereqs: Python 3.10+, uv (https://docs.astral.sh/uv/), deps: cd mcp_server && uv sync
  Env: mcp_server\.env with OPENAI_API_KEY (and any provider keys from config.yaml)
#>
$ErrorActionPreference = 'Stop'

$graphitiRoot = if ($env:GRAPHITI_REPO) {
  [System.IO.Path]::GetFullPath($env:GRAPHITI_REPO.TrimEnd('\', '/'))
} else {
  [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..\graphiti'))
}

$mcpServer = Join-Path $graphitiRoot 'mcp_server'
if (-not (Test-Path (Join-Path $mcpServer 'main.py'))) {
  Write-Error @"
Graphiti mcp_server not found under: $graphitiRoot
Clone: git clone https://github.com/getzep/graphiti.git
Or set GRAPHITI_REPO.
"@
}

$uv = Get-Command uv -ErrorAction SilentlyContinue
if (-not $uv) {
  Write-Error 'uv not found in PATH. Install: https://docs.astral.sh/uv/getting-started/installation/'
}

Push-Location $mcpServer
try {
  Write-Host "Running Graphiti MCP from $mcpServer ..."
  if ($args.Count -eq 0) {
    & uv run main.py
  } else {
    & uv run main.py @args
  }
} finally {
  Pop-Location
}
