#!/usr/bin/env node
/**
 * Merge extra .pen documents into pencil-new.pen: append each top-level child
 * from secondary file(s) with new node IDs so nothing collides with the primary.
 *
 * Usage (from repo root):
 *   node scripts/merge-pen-into-primary.js
 *
 * Env:
 *   PEN_PRIMARY   (default: UIX/pencil-new.pen)
 *   PEN_SECONDARY (default: pencil-new_1234.pen)
 *   DRY_RUN=1     only print counts, do not write
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const root = path.join(__dirname, '..')
const primaryPath = path.resolve(root, process.env.PEN_PRIMARY || path.join('UIX', 'pencil-new.pen'))
const secondaryPath = path.resolve(root, process.env.PEN_SECONDARY || 'pencil-new_1234.pen')
const dryRun = process.env.DRY_RUN === '1'

function collectIds(node, acc = new Set()) {
  if (!node || typeof node !== 'object') return acc
  if (typeof node.id === 'string') acc.add(node.id)
  if (Array.isArray(node.children)) {
    for (const c of node.children) collectIds(c, acc)
  }
  return acc
}

function buildIdMapForSubtree(node, mainIds) {
  const oldIds = [...collectIds(node)]
  const map = new Map()
  for (const oldId of oldIds) {
    let newId
    let attempts = 0
    do {
      newId = 'm' + crypto.randomBytes(5).toString('hex')
      attempts += 1
      if (attempts > 200) throw new Error('Failed to generate unique id')
    } while (mainIds.has(newId))
    map.set(oldId, newId)
    mainIds.add(newId)
  }
  return map
}

function applyIdMap(node, idMap) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) applyIdMap(item, idMap)
    return
  }
  if (typeof node.id === 'string' && idMap.has(node.id)) {
    node.id = idMap.get(node.id)
  }
  for (const k of Object.keys(node)) {
    const v = node[k]
    if (v && typeof v === 'object') applyIdMap(v, idMap)
  }
}

function deepClone(o) {
  return JSON.parse(JSON.stringify(o))
}

function main() {
  if (!fs.existsSync(primaryPath)) {
    console.error('Missing primary:', primaryPath)
    process.exit(1)
  }
  if (!fs.existsSync(secondaryPath)) {
    console.log('merge-pen: no secondary file (nothing to do):', secondaryPath)
    process.exit(0)
  }

  const primary = JSON.parse(fs.readFileSync(primaryPath, 'utf8'))
  const secondary = JSON.parse(fs.readFileSync(secondaryPath, 'utf8'))

  if (primary.version !== secondary.version) {
    console.warn('Warning: version mismatch', primary.version, 'vs', secondary.version)
  }

  const mainIds = collectIds({ children: primary.children })
  const incoming = Array.isArray(secondary.children) ? secondary.children : []
  let appended = 0

  for (const child of incoming) {
    const clone = deepClone(child)
    const idMap = buildIdMapForSubtree(clone, mainIds)
    applyIdMap(clone, idMap)
    primary.children.push(clone)
    appended += 1
  }

  console.log('Primary:', primaryPath)
  console.log('Secondary:', secondaryPath)
  console.log('Appended top-level frames:', appended)

  if (dryRun) {
    console.log('DRY_RUN=1 — not writing')
    return
  }

  const backupPath = primaryPath + '.pre-merge.' + Date.now() + '.bak'
  fs.copyFileSync(primaryPath, backupPath)
  console.log('Backup:', backupPath)

  fs.writeFileSync(primaryPath, JSON.stringify(primary, null, 2) + '\n', 'utf8')
  console.log('Wrote merged:', primaryPath)
}

main()
