'use strict';

const ARMY_OFFER_STATUS_CATALOG = [
  { key: 'DRAFT', label: 'Draft', badgeClass: 'b-gray' },
  { key: 'ISSUED', label: 'Issued', badgeClass: 'b-blue' },
  { key: 'ACCEPTED', label: 'Accepted', badgeClass: 'b-green' },
  { key: 'WITHDRAWN', label: 'Withdrawn', badgeClass: 'b-red' }
];

function getArmyOfferStatusCatalog() { return ARMY_OFFER_STATUS_CATALOG.map((r) => ({ ...r })); }
function isAllowedArmyOfferStatusKey(key) {
  return ARMY_OFFER_STATUS_CATALOG.some((r) => r.key === String(key || '').trim().toUpperCase());
}

module.exports = { getArmyOfferStatusCatalog, isAllowedArmyOfferStatusKey };
