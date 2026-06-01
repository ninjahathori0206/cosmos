'use strict';

/** Candidate pipeline statuses visible on public status tracker + admin. */
const ARMY_APPLICATION_STATUS_CATALOG = [
  { key: 'APPLIED', label: 'Applied', hint: 'We received your application and will review it shortly.', badgeClass: 'status-applied' },
  { key: 'SCREENING', label: 'Screening', hint: 'Our HR team is reviewing your application. We will contact you on WhatsApp for the next step.', badgeClass: 'status-screening' },
  { key: 'INTERVIEW', label: 'Interview', hint: 'You are in an active interview stage. Check WhatsApp for your schedule.', badgeClass: 'status-interview' },
  { key: 'ON_HOLD', label: 'On hold', hint: 'Your application is on hold. We may reach out if the role reopens.', badgeClass: 'status-hold' },
  { key: 'SELECTED', label: 'Selected', hint: 'Congratulations — you have been selected. Offer details will follow on WhatsApp.', badgeClass: 'status-selected' },
  { key: 'OFFER_ISSUED', label: 'Offer issued', hint: 'Your offer letter has been sent. Please review and accept via the link we shared.', badgeClass: 'status-offer' },
  { key: 'OFFER_ACCEPTED', label: 'Offer accepted', hint: 'Thank you for accepting. HR will confirm your joining date.', badgeClass: 'status-offer' },
  { key: 'NOT_SELECTED', label: 'Not selected', hint: 'Thank you for your interest. You may apply again for other openings.', badgeClass: 'status-rejected' },
  { key: 'JOINED', label: 'Joined', hint: 'Welcome to Eyewoot — you are now part of the team.', badgeClass: 'status-joined' }
];

const ARMY_APPLICATION_STATUS_KEYS = ARMY_APPLICATION_STATUS_CATALOG.map((row) => row.key);

function getArmyApplicationStatusCatalog() {
  return ARMY_APPLICATION_STATUS_CATALOG.map((row) => ({ ...row }));
}

function getArmyApplicationStatusByKey(key) {
  const normalized = String(key || '').trim().toUpperCase();
  return ARMY_APPLICATION_STATUS_CATALOG.find((row) => row.key === normalized) || null;
}

function isAllowedArmyApplicationStatusKey(key) {
  return ARMY_APPLICATION_STATUS_KEYS.includes(String(key || '').trim().toUpperCase());
}

module.exports = {
  ARMY_APPLICATION_STATUS_CATALOG,
  ARMY_APPLICATION_STATUS_KEYS,
  getArmyApplicationStatusCatalog,
  getArmyApplicationStatusByKey,
  isAllowedArmyApplicationStatusKey
};
