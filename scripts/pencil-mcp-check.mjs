#!/usr/bin/env node
/**
 * Verify OpenPencil MCP server starts and can read the canonical .pen file.
 * Usage: npm run pencil:mcp-check
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '../openpencil-mcp-safe/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js'
import { StdioClientTransport } from '../openpencil-mcp-safe/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js'
import { PENCIL_ABS, PENCIL_MCP_FILE_PATH, PENCIL_REL } from './_pencil_paths.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const serverPath = path.join(root, 'openpencil-mcp-safe', 'mcp-server.cjs')

function fail(msg) {
  console.error('[pencil:mcp-check] FAIL —', msg)
  process.exit(1)
}

function ok(msg) {
  console.log('[pencil:mcp-check] OK —', msg)
}

if (!fs.existsSync(serverPath)) {
  fail(`Server not found: ${serverPath}`)
}

if (!fs.existsSync(PENCIL_ABS)) {
  fail(`Design file missing: ${PENCIL_REL} (${PENCIL_ABS})`)
}

const stat = fs.statSync(PENCIL_ABS)
if (stat.size < 1000) {
  fail(`${PENCIL_REL} looks truncated (${stat.size} bytes). Open UIX/pencil-new.pen in Pencil and save, or restore from git.`)
}

const nodeModules = path.join(root, 'openpencil-mcp-safe', 'node_modules')
if (!fs.existsSync(nodeModules)) {
  fail('openpencil-mcp-safe/node_modules missing. Run: npm run pencil:install')
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath, '--stdio'],
  cwd: root
})

const client = new Client({ name: 'pencil-mcp-check', version: '1.0.0' }, { capabilities: {} })

try {
  await client.connect(transport)
  ok('stdio server connected')

  const tools = await client.listTools()
  const names = (tools.tools || []).map((t) => t.name)
  if (!names.length) fail('listTools returned no tools')
  ok(`tools listed (${names.length}): ${names.slice(0, 8).join(', ')}${names.length > 8 ? '…' : ''}`)

  const required = ['batch_get', 'batch_design']
  for (const name of required) {
    if (!names.includes(name)) {
      fail(`missing tool "${name}" — OpenPencil MCP may be outdated`)
    }
  }

  if (!names.includes('batch_get')) fail('batch_get not available')

  const probe = await client.callTool({
    name: 'batch_get',
    arguments: {
      filePath: PENCIL_MCP_FILE_PATH,
      readDepth: 0
    }
  })

  const text = (probe.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n')

  if (!text || text.includes('error') && text.length < 200) {
    fail(`batch_get probe failed: ${text || '(empty)'}`)
  }

  ok(`batch_get on ${PENCIL_REL}`)
  console.log('\nAgent CallMcpTool server IDs (use these exact names):')
  console.log('  user-pencil                          — OpenPencil / file (mcp.json key: pencil)')
  console.log('  user-highagency.pencildev-extension-pencil — Pencil extension (live editor)')
  console.log('\nIf Agent still says "Pencil MCP unavailable":')
  console.log('  1. Cursor → Settings → MCP → enable pencil + extension-pencil')
  console.log('  2. Developer: Reload Window → new Agent chat')
  console.log('  See docs/dev/pencil-mcp-setup.md')
} catch (err) {
  fail(err.message || String(err))
} finally {
  try {
    await client.close()
  } catch {
    /* ignore */
  }
}
