'use strict';

/**
 * Published job openings seed — replaced by DB/API when Army hiring tables ship.
 * Only `status: 'PUBLISHED'` rows appear on the public careers portal.
 */
const ARMY_CAREERS_PUBLISHED_JOBS = [
  {
    slug: 'sales-associate-malad',
    title: 'Sales Associate',
    department_key: 'SALES',
    store_name: 'Malad Store',
    employment_type: 'FULL_TIME',
    employment_type_label: 'Full-time',
    vacancies: 2,
    location: 'Malad West, Mumbai',
    apply_by: '2026-06-15',
    about:
      'Help customers choose the right eyewear, explain lens options, and deliver a great in-store experience. You will work with the store team to meet daily sales targets and maintain display standards.',
    requirements: [
      'Good communication and customer-first attitude',
      'Basic understanding of eyewear or retail sales',
      'Willing to work store shifts including weekends'
    ]
  },
  {
    slug: 'optometrist-bandra',
    title: 'Optometrist',
    department_key: 'OPTOMETRY',
    store_name: 'Bandra Store',
    employment_type: 'FULL_TIME',
    employment_type_label: 'Full-time',
    vacancies: 1,
    location: 'Bandra West, Mumbai',
    apply_by: '2026-06-30',
    about:
      'Conduct eye examinations, recommend lenses, and support the sales team with clinical guidance. You will maintain accurate records and follow Eyewoot clinical protocols.',
    requirements: [
      'Valid optometry qualification and registration',
      'Experience with refraction and contact lens fitting',
      'Comfortable explaining prescriptions to customers'
    ]
  },
  {
    slug: 'lab-technician-juhu',
    title: 'Lab Technician',
    department_key: 'LAB',
    store_name: 'Juhu Store',
    employment_type: 'CONTRACT',
    employment_type_label: 'Contract',
    vacancies: 1,
    location: 'Juhu, Mumbai',
    apply_by: '2026-06-10',
    about:
      'Process lens orders, manage edging and fitting workflows, and coordinate with store teams for timely delivery. Quality checks and lab hygiene are part of daily work.',
    requirements: [
      'Hands-on lens lab or optical workshop experience',
      'Attention to detail on power and axis measurements',
      'Ability to meet daily dispatch targets'
    ]
  },
  {
    slug: 'store-manager-powai',
    title: 'Store Manager',
    department_key: 'MGMT',
    store_name: 'Powai Store',
    employment_type: 'FULL_TIME',
    employment_type_label: 'Full-time',
    vacancies: 1,
    location: 'Powai, Mumbai',
    apply_by: '2026-06-25',
    about:
      'Lead the store team, drive sales performance, manage roster and customer experience. You will report to regional leadership and uphold Eyewoot operating standards.',
    requirements: [
      '3+ years retail or optical store leadership',
      'Strong people management and sales coaching',
      'Comfortable with daily reporting and store KPIs'
    ]
  },
  {
    slug: 'senior-sales-associate-andheri',
    title: 'Senior Sales Associate',
    department_key: 'SALES',
    store_name: 'Andheri Store',
    employment_type: 'FULL_TIME',
    employment_type_label: 'Full-time',
    vacancies: 2,
    location: 'Andheri West, Mumbai',
    apply_by: '2026-06-20',
    about:
      'Support premium sales, mentor junior associates, and handle complex lens and frame consultations. You will help maintain visual merchandising and conversion targets.',
    requirements: [
      '2+ years optical or premium retail sales',
      'Confident with upselling lens packages',
      'Team player with shift flexibility'
    ]
  },
  {
    slug: 'admin-executive-hq',
    title: 'Admin Executive',
    department_key: 'ADMIN',
    store_name: 'HQ Mumbai',
    employment_type: 'FULL_TIME',
    employment_type_label: 'Full-time',
    vacancies: 1,
    location: 'Andheri East, Mumbai',
    apply_by: '2026-06-18',
    about:
      'Support HQ operations with documentation, vendor coordination, and internal HR admin tasks. You will work closely with the Army HR team on day-to-day workflows.',
    requirements: [
      'Graduate with strong written communication',
      'Comfortable with spreadsheets and email workflows',
      'Organised and reliable with deadlines'
    ]
  }
];

function listPublishedArmyCareersJobs(filters) {
  const dept = filters && filters.department_key
    ? String(filters.department_key).trim().toUpperCase()
    : '';
  const q = filters && filters.q ? String(filters.q).trim().toLowerCase() : '';

  return ARMY_CAREERS_PUBLISHED_JOBS.filter((job) => {
    if (dept && job.department_key !== dept) return false;
    if (!q) return true;
    const haystack = [
      job.title,
      job.store_name,
      job.location,
      job.employment_type_label
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  }).map((job) => ({
    slug: job.slug,
    title: job.title,
    department_key: job.department_key,
    store_name: job.store_name,
    employment_type: job.employment_type,
    employment_type_label: job.employment_type_label,
    vacancies: job.vacancies,
    apply_by: job.apply_by
  }));
}

function getPublishedArmyCareersJobBySlug(slug) {
  const normalized = String(slug || '').trim().toLowerCase();
  const job = ARMY_CAREERS_PUBLISHED_JOBS.find((row) => row.slug === normalized);
  if (!job) return null;
  return { ...job };
}

module.exports = {
  ARMY_CAREERS_PUBLISHED_JOBS,
  listPublishedArmyCareersJobs,
  getPublishedArmyCareersJobBySlug
};
