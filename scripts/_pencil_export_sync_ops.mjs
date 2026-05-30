#!/usr/bin/env node
import { Client } from '../openpencil-mcp-safe/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js'
import { StdioClientTransport } from '../openpencil-mcp-safe/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const filePath = 'E:/Curser/cosmos/pencil-new.pen'
const tops = [
  'n7LXP', '2l4HL', 'j0CrZ', '0Zwnf', 'qOpTD', 'h7oti', '0RJs9v129S3D2WBREfZd5',
  'm5f1b1a495c', 'ma287358f8c', 'md28e19e03e', 'mda9c1507af', 'me1ef1192fd', 'm7855f226e5',
  'm4da7ee364f', 'm71577662da', 'mcd9034577e', 'm57728a8417', 'Ytpc7', 'V7RAmM', 'GSbEU',
  'Dy6bb', 'Vjb27', 'IGDgm', 'NztvOvuJy5d2x0RTRfs3z', 'duZJZySs0Sm28ki6gnXP2',
  '8pEn4gu2pZ59KlgntsRk8', '8lbVgj_GOhLb-gXVZP2Wn', 'aDiKPRFx2MB04G7aAsMQW',
  'L4zhDAsdSFFcDAgOJ4hjP', 'MdhPM', 'D5H6SP', 'FfozR', 'NkJcx', 'NGSGe', 'O8619k'
]

function hex(fill) {
  if (!fill) return null
  if (typeof fill === 'string') return fill === 'transparent' ? null : fill
  if (Array.isArray(fill) && fill[0]?.color) return fill[0].color
  return null
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(root, '..', 'openpencil-mcp-safe', 'mcp-server.cjs'), '--stdio'],
  cwd: path.join(root, '..')
})
const client = new Client({ name: 'export-sync', version: '1' }, { capabilities: {} })
await client.connect(transport)

const ops = []
for (const rootId of tops) {
  for (const pattern of [{ type: 'text' }, { type: 'frame' }, { type: 'rectangle' }, { type: 'ellipse' }]) {
    const res = await client.callTool({
      name: 'batch_get',
      arguments: { filePath, parentId: rootId, patterns: [pattern], readDepth: 0, searchDepth: 25 }
    })
    const nodes = JSON.parse(res.content[0].text).nodes || []
    for (const n of nodes) {
      const color = hex(n.fill)
      if (!color) continue
      ops.push(`U("${n.id}",{fill:"${color}"})`)
    }
  }
}
await client.close()
fs.writeFileSync(path.join(root, '_tmp_extension_sync.txt'), ops.join('\n'))
console.log('Exported', ops.length, 'ops')
