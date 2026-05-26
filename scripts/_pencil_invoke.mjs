#!/usr/bin/env node
/**
 * One-off helper: invoke OpenPencil MCP tools against a .pen file via stdio.
 * Usage: node scripts/_pencil_invoke.mjs <toolName> '<json-args>'
 */
import { Client } from '../openpencil-mcp-safe/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js'
import { StdioClientTransport } from '../openpencil-mcp-safe/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const serverPath = path.join(root, 'openpencil-mcp-safe', 'mcp-server.cjs')

const toolName = process.argv[2]
let argsJson = process.argv[3] || '{}'
if (argsJson.startsWith('@')) {
  const fs = await import('node:fs/promises')
  argsJson = await fs.readFile(argsJson.slice(1), 'utf8')
}

if (!toolName) {
  console.error('Usage: node scripts/_pencil_invoke.mjs <toolName> \'<json-args>\'')
  process.exit(1)
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath, '--stdio'],
  cwd: root
})

const client = new Client({ name: 'pencil-invoke', version: '1.0.0' }, { capabilities: {} })
await client.connect(transport)

const args = JSON.parse(argsJson)
const result = await client.callTool({ name: toolName, arguments: args })
console.log(JSON.stringify(result, null, 2))
await client.close()
