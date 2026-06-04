'use strict';

const ARMY_STORE_ORIENTATION_CATALOG = [
  { key: 'STORE_TOUR', label: 'Physical store tour completed' },
  { key: 'TEAM_INTRO', label: 'Introduced to full team' },
  { key: 'POS_WALKTHROUGH', label: 'Store OS / POS walkthrough' },
  { key: 'STORE_POLICIES', label: 'Store-specific policies explained' },
  { key: 'PRODUCT_BASICS', label: 'Product knowledge basics covered' },
  { key: 'MANAGER_SIGNOFF', label: 'Store Manager sign-off' }
];

function getArmyStoreOrientationCatalog() { return ARMY_STORE_ORIENTATION_CATALOG.map((r) => ({ ...r })); }

module.exports = { getArmyStoreOrientationCatalog };
