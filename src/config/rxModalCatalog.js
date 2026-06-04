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

function getRxModalCatalog () {
  return {
    screen_time_options: RX_SCREEN_TIME_OPTIONS,
    working_condition_options: RX_WORKING_CONDITION_OPTIONS,
    family_eye_history_options: RX_FAMILY_EYE_HISTORY_OPTIONS,
    vision_acuity_options: RX_VISION_ACUITY_OPTIONS,
    wizard_steps: RX_WIZARD_STEPS
  }
}

module.exports = {
  RX_SCREEN_TIME_OPTIONS,
  RX_WORKING_CONDITION_OPTIONS,
  RX_FAMILY_EYE_HISTORY_OPTIONS,
  RX_VISION_ACUITY_OPTIONS,
  RX_WIZARD_STEPS,
  getRxModalCatalog
}
