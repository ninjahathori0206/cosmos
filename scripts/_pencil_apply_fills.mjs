#!/usr/bin/env node
/**
 * Apply default fills to nodes missing fill in UIX/pencil-new.pen (visibility fix).
 */
import { Client } from '../openpencil-mcp-safe/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js'
import { StdioClientTransport } from '../openpencil-mcp-safe/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PENCIL_MCP_FILE_PATH } from './_pencil_paths.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const filePath = PENCIL_MCP_FILE_PATH

const DARK_ROOTS = new Set(['Ytpc7', 'V7RAmM'])

const LIGHT = {
  page: '#F8FAFC',
  surface: '#FFFFFF',
  surface2: '#F1F5F9',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  accent: '#2563EB',
  accentOrange: '#EA580C',
  navy: '#0F172A'
}

const DARK = {
  page: '#0F172A',
  surface: '#1E293B',
  surface2: '#111827',
  text: '#F8FAFC',
  muted: '#94A3B8',
  border: '#334155',
  accent: '#2563EB',
  accentOrange: '#EA580C',
  navy: '#0F172A'
}

const TOP_FRAMES = [
  'n7LXP', '2l4HL', 'j0CrZ', '0RJs9v129S3D2WBREfZd5', '0Zwnf', 'qOpTD', 'h7oti',
  'm5f1b1a495c', 'ma287358f8c', 'md28e19e03e', 'mda9c1507af', 'me1ef1192fd', 'm7855f226e5',
  'm4da7ee364f', 'm71577662da', 'mcd9034577e', 'm57728a8417', 'Ytpc7', 'V7RAmM', 'GSbEU',
  'NGSGe', 'O8619k', 'NkJcx', 'FfozR', 'MdhPM', 'D5H6SP', '8pEn4gu2pZ59KlgntsRk8',
  '8lbVgj_GOhLb-gXVZP2Wn', 'aDiKPRFx2MB04G7aAsMQW', 'L4zhDAsdSFFcDAgOJ4hjP',
  'Dy6bb', 'Vjb27', 'IGDgm', 'NztvOvuJy5d2x0RTRfs3z', 'ZMyf87bDlsGNEF05HHwhd',
  'duZJZySs0Sm28ki6gnXP2', '2eeEM--nTlBqve3ZFylWP'
]

function themeForRoot(rootId) {
  return DARK_ROOTS.has(rootId) ? DARK : LIGHT
}

function hasFill(node) {
  if (node.fill == null) return false
  if (typeof node.fill === 'string' && node.fill) return true
  if (Array.isArray(node.fill) && node.fill.length) return true
  return false
}

function textFill(node, t) {
  const n = (node.name || '').toLowerCase()
  const fs = node.fontSize || 14
  const lw = node.fontWeight || 400
  if (node.enabled === false) return '#EF4444'
  if (n.includes('hint') || n.includes('sub') || n.includes('caption') || n.includes('lbl') || n.includes('chevron')) return t.muted
  if (fs <= 11 || (node.letterSpacing && node.letterSpacing >= 1.5)) return t.muted
  if (n.includes('btn') && lw >= 600) return '#FFFFFF'
  if (n.includes('error')) return '#EF4444'
  if (n.includes('success') || n.includes('green')) return '#16A34A'
  if (lw >= 700 && fs >= 16) return t.text
  return t.text
}

function frameFill(node, t, isDark) {
  const n = (node.name || '').toLowerCase()
  if (n.includes('statusbar') || n === 'topbar') return t.navy
  if (n.includes('login button') || n.includes('primary') || n === 'login button') return t.accent
  if (n.includes('module badge')) return isDark ? '#172554' : '#EFF6FF'
  if (n.includes('card') || n.includes('panel') || n.includes('modal') || n.includes('sheet')) return t.surface
  if (n.includes('sidebar') || n.includes('nav')) return t.navy
  if (n.includes('stat') && n.includes('left')) return '#2563EB'
  if (n.includes('stat') && n.includes('right')) return '#16A34A'
  if (n.includes('btn') || n.includes('button')) return t.surface2
  if (n.includes('input') || n.includes('field') || n.includes('selector')) return t.surface
  if (n.includes('content')) return 'transparent'
  if (n.includes('divider')) return t.border
  return t.surface
}

function rectFill(node, t) {
  const n = (node.name || '').toLowerCase()
  if (n.includes('divider')) return t.border
  return t.border
}

function ellipseFill(node, t) {
  const n = (node.name || '').toLowerCase()
  if (n.includes('dot')) {
    const stroke = node.stroke
    if (stroke && stroke.thickness >= 2 && !hasFill(node)) return t.surface2
    return t.accent
  }
  return t.accent
}

function strokeFill(node, t) {
  if (!node.stroke) return null
  return { align: 'inside', thickness: node.stroke.thickness || 1, fill: t.border }
}

async function main() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(root, 'openpencil-mcp-safe', 'mcp-server.cjs'), '--stdio'],
    cwd: root
  })
  const client = new Client({ name: 'apply-fills', version: '1.0.0' }, { capabilities: {} })
  await client.connect(transport)

  const updates = []

  for (const rootId of TOP_FRAMES) {
    const t = themeForRoot(rootId)
    const isDark = DARK_ROOTS.has(rootId)
    updates.push(`U("${rootId}",{fill:"${t.page}"})`)

    for (const pattern of [{ type: 'text' }, { type: 'frame' }, { type: 'rectangle' }, { type: 'ellipse' }]) {
      const res = await client.callTool({
        name: 'batch_get',
        arguments: {
          filePath,
          parentId: rootId,
          patterns: [pattern],
          readDepth: 0,
          searchDepth: 25
        }
      })
      const data = JSON.parse(res.content[0].text)
      const nodes = data.nodes || []
      for (const node of nodes) {
        if (node.id === rootId) continue
        if (hasFill(node)) continue

        if (node.type === 'text') {
          updates.push(`U("${node.id}",{fill:"${textFill(node, t)}"})`)
        } else if (node.type === 'frame') {
          const fill = frameFill(node, t, isDark)
          const stroke = strokeFill(node, t)
          if (fill === 'transparent') {
            if (stroke) updates.push(`U("${node.id}",{stroke:${JSON.stringify(stroke)}})`)
          } else {
            const parts = [`fill:"${fill}"`]
            if (stroke && !node.stroke?.fill) parts.push(`stroke:${JSON.stringify(stroke)}`)
            updates.push(`U("${node.id}",{${parts.join(',')}})`)
          }
        } else if (node.type === 'rectangle') {
          updates.push(`U("${node.id}",{fill:"${rectFill(node, t)}"})`)
        } else if (node.type === 'ellipse') {
          const stroke = strokeFill(node, t)
          const fill = ellipseFill(node, t)
          const parts = [`fill:"${fill}"`]
          if (stroke) parts.push(`stroke:${JSON.stringify(stroke)}`)
          updates.push(`U("${node.id}",{${parts.join(',')}})`)
        }
      }
    }
  }

  console.log('Total U() ops:', updates.length)
  const chunkSize = 120
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize).join('\n')
    const res = await client.callTool({
      name: 'batch_design',
      arguments: { filePath, operations: chunk, postProcess: false }
    })
    const text = res.content?.[0]?.text || ''
    if (text.includes('error') || text.includes('Error')) {
      console.log('Chunk', i, 'issue:', text.slice(0, 300))
    } else {
      console.log('Chunk', i, 'OK', Math.min(i + chunkSize, updates.length), '/', updates.length)
    }
  }

  await client.close()
  console.log('Done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
