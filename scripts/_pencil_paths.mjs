import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Canonical monolith — single source of truth for Pencil MCP + scripts. */
export const PENCIL_REL = path.join('UIX', 'pencil-new.pen')
export const PENCIL_ABS = path.join(root, PENCIL_REL).replace(/\\/g, '/')
export const PENCIL_MCP_FILE_PATH = 'E:/Curser/cosmos/UIX/pencil-new.pen'
