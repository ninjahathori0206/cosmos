'use strict'

/** Screen time quick-select (maps to customer_lifestyle.screen_hrs). */
const RX_SCREEN_TIME_OPTIONS = [
  { key: 'lt2', label: '<2 hrs', value: '<2' },
  { key: '2-4', label: '2–4 hrs', value: '2-4' },
  { key: '4-6', label: '4–6 hrs', value: '4-6' },
  { key: '6-8', label: '6–8 hrs', value: '6-8' },
  { key: 'gt8', label: '>8 hrs', value: '>8' }
]

/** Multi-select working conditions (stored in lifestyle notes JSON + frame_pref summary). */
const RX_WORKING_CONDITION_OPTIONS = [
  { key: 'computer', label: 'Computer use' },
  { key: 'mobile', label: 'Mobile use' },
  { key: 'daylight', label: 'Day light work' },
  { key: 'desk', label: 'Desk work' },
  { key: 'teaching', label: 'Teaching' },
  { key: 'cooking', label: 'Cooking' }
]

/** Family eye history quick-select. */
const RX_FAMILY_EYE_HISTORY_OPTIONS = [
  { key: 'none', label: 'None', value: 'None' },
  { key: 'glaucoma', label: 'Glaucoma', value: 'Glaucoma' },
  { key: 'cataract', label: 'Cataract', value: 'Cataract' },
  { key: 'macular', label: 'Macular degeneration', value: 'Macular degeneration' }
]

/** Pre-test / vision acuity dropdown values (eye_tests.re_va / le_va). */
const RX_VISION_ACUITY_OPTIONS = [
  { key: '6/6', label: '6/6' },
  { key: '6/9', label: '6/9' },
  { key: '6/12', label: '6/12' },
  { key: '6/18', label: '6/18' },
  { key: '6/24', label: '6/24' },
  { key: '6/36', label: '6/36' },
  { key: '6/60', label: '6/60' },
  { key: 'CF', label: 'CF' },
  { key: 'NLP', label: 'NLP' }
]

const RX_WIZARD_STEPS = [
  { key: 'patient', label: 'Patient', icon: '👤' },
  { key: 'lifestyle', label: 'Lifestyle', icon: '♥' },
  { key: 'eyetest', label: 'Eye test', icon: '👁' }
]

/** Lens type quick-select (eye_tests.lens_type). */
const RX_LENS_TYPE_OPTIONS = [
  { key: 'sv', label: 'Single vision (SV)', value: 'Single vision' },
  { key: 'progressive', label: 'Progressive', value: 'Progressive' },
  { key: 'bifocal', label: 'Bifocal', value: 'Bifocal' },
  { key: 'office', label: 'Computer / office', value: 'Computer / office' },
  { key: 'reading', label: 'Reading', value: 'Reading' },
  { key: 'plano', label: 'Plano / zero power', value: 'Plano' }
]

function rxFmtSphLabel (v, key) {
  if (v === 0) return '+0.00'
  if (v > 0) return '+' + key
  return key
}

function rxFmtAddLabel (v, key) {
  if (v === 0) return '+0.00'
  return '+' + key
}

function rxFmtPdLabel (_v, key) {
  return key + ' mm'
}

function rxBuildDecimalOptions (min, max, step, decimals, formatLabel) {
  const out = []
  const steps = Math.round((max - min) / step)
  for (let i = 0; i <= steps; i++) {
    const raw = min + i * step
    const v = Math.round(raw * Math.pow(10, decimals)) / Math.pow(10, decimals)
    const key = v.toFixed(decimals)
    out.push({
      key,
      label: formatLabel ? formatLabel(v, key) : key,
      value: key
    })
  }
  return out
}

function rxFmtCylLabel (v, key) {
  if (v === 0) return '0.00'
  if (v > 0) return '+' + key
  return key
}

function rxBuildCylOptions () {
  return rxBuildDecimalOptions(-6, 6, 0.25, 2, rxFmtCylLabel)
}

function rxBuildAxisOptions () {
  const out = []
  for (let a = 0; a <= 180; a += 5) {
    const key = String(a)
    out.push({ key, label: a + '°', value: key })
  }
  return out
}

const RX_PRESCRIPTION_SPH_OPTIONS = rxBuildDecimalOptions(-20, 20, 0.25, 2, rxFmtSphLabel)
const RX_PRESCRIPTION_CYL_OPTIONS = rxBuildCylOptions()
const RX_PRESCRIPTION_AXIS_OPTIONS = rxBuildAxisOptions()
const RX_PRESCRIPTION_ADD_OPTIONS = rxBuildDecimalOptions(0, 4, 0.25, 2, rxFmtAddLabel)
const RX_PD_OPTIONS = rxBuildDecimalOptions(48, 72, 0.5, 1, rxFmtPdLabel)

function getRxModalCatalog () {
  return {
    screen_time_options: RX_SCREEN_TIME_OPTIONS,
    working_condition_options: RX_WORKING_CONDITION_OPTIONS,
    family_eye_history_options: RX_FAMILY_EYE_HISTORY_OPTIONS,
    vision_acuity_options: RX_VISION_ACUITY_OPTIONS,
    wizard_steps: RX_WIZARD_STEPS,
    prescription_sph_options: RX_PRESCRIPTION_SPH_OPTIONS,
    prescription_cyl_options: RX_PRESCRIPTION_CYL_OPTIONS,
    prescription_axis_options: RX_PRESCRIPTION_AXIS_OPTIONS,
    prescription_add_options: RX_PRESCRIPTION_ADD_OPTIONS,
    pd_options: RX_PD_OPTIONS,
    lens_type_options: RX_LENS_TYPE_OPTIONS
  }
}

module.exports = {
  RX_SCREEN_TIME_OPTIONS,
  RX_WORKING_CONDITION_OPTIONS,
  RX_FAMILY_EYE_HISTORY_OPTIONS,
  RX_VISION_ACUITY_OPTIONS,
  RX_WIZARD_STEPS,
  RX_LENS_TYPE_OPTIONS,
  RX_PRESCRIPTION_SPH_OPTIONS,
  RX_PRESCRIPTION_CYL_OPTIONS,
  RX_PRESCRIPTION_AXIS_OPTIONS,
  RX_PRESCRIPTION_ADD_OPTIONS,
  RX_PD_OPTIONS,
  getRxModalCatalog
}
