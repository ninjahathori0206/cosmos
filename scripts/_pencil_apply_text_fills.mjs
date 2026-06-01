#!/usr/bin/env node
import { Client } from '../openpencil-mcp-safe/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js'
import { StdioClientTransport } from '../openpencil-mcp-safe/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PENCIL_MCP_FILE_PATH } from './_pencil_paths.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const filePath = PENCIL_MCP_FILE_PATH
const DARK = new Set(['Ytpc7', 'V7RAmM'])
const TOPS = [
  'n7LXP', '2l4HL', 'j0CrZ', '0Zwnf', 'qOpTD', 'h7oti', '0RJs9v129S3D2WBREfZd5',
  'm5f1b1a495c', 'ma287358f8c', 'md28e19e03e', 'mda9c1507af', 'me1ef1192fd', 'm7855f226e5',
  'm4da7ee364f', 'm71577662da', 'mcd9034577e', 'm57728a8417', 'Ytpc7', 'V7RAmM', 'GSbEU',
  'Dy6bb', 'Vjb27', 'IGDgm', 'NztvOvuJy5d2x0RTRfs3z', 'duZJZySs0Sm28ki6gnXP2',
  '8pEn4gu2pZ59KlgntsRk8', '8lbVgj_GOhLb-gXVZP2Wn', 'aDiKPRFx2MB04G7aAsMQW',
  'L4zhDAsdSFFcDAgOJ4hjP', 'MdhPM', 'D5H6SP', 'FfozR', 'NkJcx', 'NGSGe', 'O8619k',
  'ZMyf87bDlsGNEF05HHwhd', '2eeEM--nTlBqve3ZFylWP'
]

function textColor(node, dark) {
  const n = (node.name || '').toLowerCase()
  const fs = node.fontSize || 14
  const lw = node.fontWeight || 400
  if (n.includes('statusbar') || n === 'sbtime') return dark ? '#F8FAFC' : '#FFFFFF'
  if (n.includes('badge') && n.includes('txt')) return '#2563EB'
  if (n.includes('tab1') || (n.includes('tab') && lw >= 600)) return '#2563EB'
  if (n.includes('link') || n.includes('see all')) return '#2563EB'
  if (n.includes('error')) return '#EF4444'
  if (n.includes('hint') || n.includes('sub') || fs <= 11 || (node.letterSpacing && node.letterSpacing >= 1.5)) {
    return dark ? '#94A3B8' : '#64748B'
  }
  if (n.includes('lbl') || n.includes('label')) return dark ? '#94A3B8' : '#64748B'
  if (n.includes('val') || (lw >= 500 && fs >= 18)) return dark ? '#F8FAFC' : '#0F172A'
  if (n.includes('btn') && lw >= 600) return '#FFFFFF'
  return dark ? '#F8FAFC' : '#0F172A'
}

function frameColor(node, dark) {
  const n = (node.name || '').toLowerCase()
  if (n.includes('statusbar') || n === 'topbar' && dark) return '#0F172A'
  if (n.includes('statusbar')) return '#0F172A'
  if (n.includes('topbar') || n.includes('bottomtab') || n.includes('tabbar')) return '#FFFFFF'
  if (n.includes('sidebar') || n.includes('nav')) return '#0F172A'
  if (n.includes('login button') || n === 'login button') return '#2563EB'
  if (n.includes('statleft') || n.includes('sc1')) return '#2563EB'
  if (n.includes('statright') || n.includes('sc2')) return '#16A34A'
  if (n.includes('card') || n.includes('modal') || n.includes('panel')) return dark ? '#1E293B' : '#FFFFFF'
  if (n.includes('btn') || n.includes('numpad') || n.includes('key')) return dark ? '#1E293B' : '#F1F5F9'
  if (n.includes('input') || n.includes('field') || n.includes('selector')) return dark ? '#0F172A' : '#FFFFFF'
  if (n.includes('content')) return dark ? '#0F172A' : '#F8FAFC'
  if (n.includes('divider')) return dark ? '#334155' : '#E2E8F0'
  return dark ? '#1E293B' : '#FFFFFF'
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(root, '..', 'openpencil-mcp-safe', 'mcp-server.cjs'), '--stdio'],
  cwd: path.join(root, '..')
})
const client = new Client({ name: 'text-fills', version: '1' }, { capabilities: {} })
await client.connect(transport)

const ops = []
for (const rootId of TOPS) {
  const dark = DARK.has(rootId)
  ops.push(`U("${rootId}",{fill:"${dark ? '#0F172A' : '#F8FAFC'}"})`)
  for (const pattern of [{ type: 'text' }, { type: 'frame' }, { type: 'rectangle' }, { type: 'ellipse' }]) {
    const res = await client.callTool({
      name: 'batch_get',
      arguments: { filePath, parentId: rootId, patterns: [pattern], readDepth: 0, searchDepth: 25 }
    })
    for (const node of JSON.parse(res.content[0].text).nodes || []) {
      if (node.id === rootId) continue
      if (node.type === 'text') {
        ops.push(`U("${node.id}",{fill:"${textColor(node, dark)}"})`)
      } else if (node.type === 'frame') {
        ops.push(`U("${node.id}",{fill:"${frameColor(node, dark)}"})`)
      } else if (node.type === 'rectangle') {
        ops.push(`U("${node.id}",{fill:"${dark ? '#334155' : '#E2E8F0'}"})`)
      } else if (node.type === 'ellipse') {
        const filled = node.stroke?.thickness >= 2
        ops.push(`U("${node.id}",{fill:"${filled ? (dark ? '#1E293B' : '#FFFFFF') : '#2563EB'}"})`)
      }
    }
  }
}

await client.close()
const out = path.join(root, '_tmp_all_fills.txt')
fs.writeFileSync(out, ops.join('\n'))
console.log('Wrote', ops.length, 'ops to', out)
