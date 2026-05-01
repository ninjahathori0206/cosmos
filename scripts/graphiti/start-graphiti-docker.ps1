#requires -Version 5.1
<#
  Starts Graphiti MCP + FalkorDB via Docker Compose.
  Cosmos stays on PORT (e.g. 4000); Graphiti listens on 8000 (MCP), 6379, 3000.

  Prereqs: Docker Desktop, API keys in Graphiti mcp_server\.env
  Override repo root: $env:GRAPHITI_REPO = "D:\dev\graphiti"
#>
$ErrorActionPreference = 'Stop'

$graphitiRoot = if ($env:GRAPHITI_REPO) {
  [System.IO.Path]::GetFullPath($env:GRAPHITI_REPO.TrimEnd('\', '/'))
} else {
  [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..\graphiti'))
}

$composeDir = Join-Path $graphitiRoot 'mcp_server\docker'
$composeFile = Join-Path $composeDir 'docker-compose.yml'

if (-not (Test-Path $composeFile)) {
  Write-Error @"
Graphiti repo not found at: $graphitiRoot
Clone it: git clone https://github.com/getzep/graphiti.git
Or set GRAPHITI_REPO to the clone root, then copy mcp_server\.env.example to mcp_server\.env and set OPENAI_API_KEY.
"@
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  Write-Error 'docker not found in PATH. Install Docker Desktop and retry.'
}

Push-Location $composeDir
try {
  Write-Host "Starting Graphiti from $composeDir ..."
  if ($args.Count -eq 0) {
    & docker compose up
  } else {
    & docker compose @args
  }
} finally {
  Pop-Location
}
