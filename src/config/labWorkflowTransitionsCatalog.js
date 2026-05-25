'use strict'

/**
 * Lab workflow transitions — single source of truth for allowed edges and RBAC.
 * Command Unit assigns permission keys from this catalogue; JWT must include one
 * of `required_permissions` per transition (super_admin bypasses in middleware).
 *
 * `actor_role` on dbo.pos_lab_transitions is legacy — not used for authorization.
 */

/** @typedef {{ from_status: string, to_status: string, required_permissions: string[], requires_note: boolean, label?: string }} LabTransitionDef */

/** @type {LabTransitionDef[]} */
const LAB_WORKFLOW_TRANSITIONS = [
  { from_status: 'ORDER_PLACED', to_status: 'ADVANCE_PAID', required_permissions: ['pos.lab.workflow', 'storepilot.lab.manage'], requires_note: false },
  { from_status: 'ADVANCE_PAID', to_status: 'SENT_TO_LAB', required_permissions: ['pos.lab.workflow', 'storepilot.lab.manage'], requires_note: false },
  { from_status: 'DISPATCHED_TO_STORE', to_status: 'RECEIVED_AT_STORE', required_permissions: ['storepilot.lab.manage', 'foundry.lab.manage'], requires_note: false },
  { from_status: 'RECEIVED_AT_STORE', to_status: 'STORE_QC_PASS', required_permissions: ['storepilot.lab.manage', 'foundry.lab.manage'], requires_note: false },
  { from_status: 'RECEIVED_AT_STORE', to_status: 'STORE_QC_PARTIAL', required_permissions: ['storepilot.lab.manage', 'foundry.lab.manage'], requires_note: true },
  { from_status: 'RECEIVED_AT_STORE', to_status: 'QC_FAIL_STORE', required_permissions: ['storepilot.lab.manage', 'foundry.lab.manage'], requires_note: true },
  { from_status: 'QC_FAIL_STORE', to_status: 'SENT_TO_LAB', required_permissions: ['storepilot.lab.manage', 'foundry.lab.manage'], requires_note: false },
  { from_status: 'STORE_QC_PASS', to_status: 'READY_FOR_DELIVERY', required_permissions: ['storepilot.lab.manage'], requires_note: false },
  { from_status: 'STORE_QC_PARTIAL', to_status: 'READY_FOR_DELIVERY', required_permissions: ['storepilot.lab.manage'], requires_note: false },
  { from_status: 'SENT_TO_LAB', to_status: 'LAB_FITTING', required_permissions: ['foundry.lab.manage'], requires_note: false },
  { from_status: 'LAB_FITTING', to_status: 'QC_PASS', required_permissions: ['foundry.lab.manage'], requires_note: false },
  { from_status: 'LAB_FITTING', to_status: 'QC_FAIL_LAB', required_permissions: ['foundry.lab.manage'], requires_note: true },
  { from_status: 'QC_FAIL_LAB', to_status: 'LAB_FITTING', required_permissions: ['foundry.lab.manage'], requires_note: false },
  { from_status: 'QC_PASS', to_status: 'DISPATCHED_TO_STORE', required_permissions: ['foundry.lab.manage'], requires_note: false }
]

const LAB_TRANSITION_INDEX = new Map(
  LAB_WORKFLOW_TRANSITIONS.map((row) => [
    `${row.from_status}\u0000${row.to_status}`,
    row
  ])
)

function normStatus(s) {
  return String(s || '').trim().toUpperCase()
}

/**
 * @param {string} fromStatus
 * @param {string} toStatus
 * @returns {LabTransitionDef|null}
 */
function getLabWorkflowTransition(fromStatus, toStatus) {
  const key = `${normStatus(fromStatus)}\u0000${normStatus(toStatus)}`
  return LAB_TRANSITION_INDEX.get(key) || null
}

/**
 * All catalogue permission keys referenced by lab transitions (for CU / meta).
 * @returns {string[]}
 */
function getLabWorkflowPermissionKeys() {
  const set = new Set()
  for (const row of LAB_WORKFLOW_TRANSITIONS) {
    for (const p of row.required_permissions) set.add(p)
  }
  return [...set].sort()
}

/**
 * API / bootstrap shape.
 * @returns {LabTransitionDef[]}
 */
function getLabWorkflowTransitionsForApi() {
  return LAB_WORKFLOW_TRANSITIONS.map((row) => ({
    from_status: row.from_status,
    to_status: row.to_status,
    required_permissions: row.required_permissions.slice(),
    requires_note: !!row.requires_note
  }))
}

module.exports = {
  LAB_WORKFLOW_TRANSITIONS,
  getLabWorkflowTransition,
  getLabWorkflowPermissionKeys,
  getLabWorkflowTransitionsForApi,
  normLabStatus: normStatus
}
