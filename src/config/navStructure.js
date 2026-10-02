/**
 * Role menus after digital-pharmacy reconstruction.
 * Clinical path: prescriber → pharmacist → pharmacist 2 → patient.
 */

export const WORKBENCH_HOME = '/workbench';
export const RESEARCH_HOME = '/research/evaluation';
export const PATIENT_HOME = '/patient/me';
export const PRESCRIBER_HOME = '/doctor';
export const PHARMACIST_HOME = '/ai/review-queue';
export const TECHNICIAN_HOME = '/dispensing';
export const ADMIN_HOME = '/ai/governance';

const PRESCRIBER = ['prescriber'];
const PHARMACIST = ['pharmacist'];
const TECH = ['technician'];
const ADMIN = ['admin'];
const RESEARCHER = ['researcher'];
const PATIENT = ['patient'];

export const NAV_STRUCTURE = [
  {
    sectionKey: 'nav.sectionWorkbench',
    items: [
      { labelKey: 'nav.workbench', path: '/workbench', icon: 'workbench', roles: [...PRESCRIBER, ...PHARMACIST, ...TECH, ...ADMIN] },
    ],
  },
  {
    sectionKey: 'nav.sectionPathPrescriber',
    items: [
      { labelKey: 'nav.doctor', path: '/doctor', icon: 'doctor', roles: PRESCRIBER },
      { labelKey: 'nav.templates', path: '/prescriptions/templates', icon: 'templates', roles: PRESCRIBER },
      { labelKey: 'nav.intake', path: '/intake', icon: 'intake', roles: [...PHARMACIST, ...TECH] },
    ],
  },
  {
    sectionKey: 'nav.sectionRecords',
    items: [
      { labelKey: 'nav.patients', path: '/patients', icon: 'patients', roles: [...PRESCRIBER, ...PHARMACIST] },
      { labelKey: 'nav.aiCases', path: '/ai/cases', icon: 'aiSafety', roles: [...PRESCRIBER, ...PHARMACIST, ...ADMIN] },
    ],
  },
  {
    sectionKey: 'nav.sectionPathPharmacist',
    items: [
      { labelKey: 'nav.reviewQueue', path: '/ai/review-queue', icon: 'review', roles: PHARMACIST },
    ],
  },
  {
    sectionKey: 'nav.sectionPathDispense',
    items: [
      { labelKey: 'nav.dispensing', path: '/dispensing', icon: 'dispensing', roles: [...PHARMACIST, ...TECH] },
      { labelKey: 'nav.pickup', path: '/pickup', icon: 'pickup', roles: TECH },
      { labelKey: 'nav.distribution', path: '/distribution', icon: 'delivery', roles: TECH },
    ],
  },
  {
    sectionKey: 'nav.sectionFollowUp',
    items: [
      { labelKey: 'nav.followUp', path: '/ai/follow-up', icon: 'patientService', roles: PHARMACIST },
      { labelKey: 'nav.patientService', path: '/patient-service', icon: 'patientService', roles: PHARMACIST },
    ],
  },
  {
    sectionKey: 'nav.sectionKnowledge',
    items: [
      { labelKey: 'nav.aiKnowledge', path: '/ai/knowledge', icon: 'knowledge', roles: [...PRESCRIBER, ...PHARMACIST, ...RESEARCHER, ...ADMIN] },
    ],
  },
  {
    sectionKey: 'nav.sectionPathPatient',
    items: [
      { labelKey: 'nav.myProfile', path: '/patient/profile', icon: 'patients', roles: PATIENT },
      { labelKey: 'nav.myPrescriptions', path: '/patient/me', icon: 'patientService', roles: PATIENT },
      { labelKey: 'nav.myClarifications', path: '/patient/me', icon: 'aiSafety', roles: PATIENT },
      { labelKey: 'nav.myEducation', path: '/patient/me', icon: 'knowledge', roles: PATIENT },
      { labelKey: 'nav.myFeedback', path: '/patient/me', icon: 'patientService', roles: PATIENT },
    ],
  },
  {
    sectionKey: 'nav.sectionSupportOps',
    items: [
      { labelKey: 'nav.inventory', path: '/inventory', icon: 'inventory', roles: [...TECH, ...ADMIN] },
      { labelKey: 'nav.orders', path: '/orders', icon: 'orders', roles: ADMIN },
      { labelKey: 'nav.billing', path: '/billing', icon: 'billing', roles: ADMIN },
      { labelKey: 'nav.traceability', path: '/traceability', icon: 'quality', roles: [...TECH, ...ADMIN] },
    ],
  },
  {
    sectionKey: 'nav.sectionGovernance',
    items: [
      { labelKey: 'nav.governance', path: '/ai/governance', icon: 'governance', roles: [...ADMIN, ...RESEARCHER] },
      { labelKey: 'nav.researchEval', path: '/research/evaluation', icon: 'documentation', roles: [...RESEARCHER, ...ADMIN] },
    ],
  },
];

export const HIDDEN_ROUTES = [
  { prefix: '/ai/reviews/', roles: [...PHARMACIST, ...TECH, ...PRESCRIBER, ...ADMIN] },
];

export function buildNav(t, role) {
  return NAV_STRUCTURE.map((section) => ({
    section: t(section.sectionKey),
    sectionKey: section.sectionKey,
    items: section.items
      .filter((item) => !role || !item.roles || item.roles.includes(role))
      .map((item) => ({ ...item, text: t(item.labelKey) })),
  })).filter((s) => s.items.length > 0);
}

export function rolesForPath(pathname) {
  const found = new Set();
  for (const section of NAV_STRUCTURE) {
    for (const item of section.items) {
      if (pathname === item.path || pathname.startsWith(`${item.path}/`)) {
        (item.roles || []).forEach((r) => found.add(r));
      }
    }
  }
  const hidden = HIDDEN_ROUTES.find((h) => pathname.startsWith(h.prefix));
  if (hidden) hidden.roles.forEach((r) => found.add(r));
  return found.size ? [...found] : null;
}

export function getPageTitleForPath(pathname, t) {
  for (const section of NAV_STRUCTURE) {
    for (const item of section.items) {
      if (item.path === pathname) return t(item.labelKey);
    }
  }
  if (pathname.startsWith('/ai/reviews/')) return t('nav.reviewDetail');
  if (pathname.startsWith('/research')) return t('nav.researchEval');
  return t('app.defaultPageTitle');
}
