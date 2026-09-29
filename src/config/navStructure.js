/**
 * Role menus. Clinical path: prescriber → pharmacist → pharmacist 2 → patient.
 * Technician, admin, and researcher support that path; they do not approve prescriptions.
 */

export const WORKBENCH_HOME = '/workbench';
export const RESEARCH_HOME = '/simulation/overview';
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

const TWIN_ITEMS = [
  { labelKey: 'nav.overview', path: '/simulation/overview', icon: 'overview' },
  { labelKey: 'nav.scenario', path: '/simulation/scenario', icon: 'scenario' },
  { labelKey: 'nav.strategies', path: '/simulation/strategies', icon: 'strategies' },
  { labelKey: 'nav.run', path: '/simulation/run', icon: 'run' },
  { labelKey: 'nav.results', path: '/simulation/results', icon: 'results' },
  { labelKey: 'nav.archive', path: '/simulation/archive', icon: 'archive' },
  { labelKey: 'nav.reproducibility', path: '/simulation/reproducibility', icon: 'reproducibility' },
  { labelKey: 'nav.documentation', path: '/simulation/documentation', icon: 'documentation' },
];

export const NAV_STRUCTURE = [
  {
    sectionKey: 'nav.sectionPathPrescriber',
    items: [
      { labelKey: 'nav.doctor', path: '/doctor', icon: 'doctor', roles: PRESCRIBER },
      { labelKey: 'nav.templates', path: '/prescriptions/templates', icon: 'templates', roles: PRESCRIBER },
    ],
  },
  {
    sectionKey: 'nav.sectionPathPharmacist',
    items: [
      { labelKey: 'nav.reviewQueue', path: '/ai/review-queue', icon: 'review', roles: PHARMACIST },
      { labelKey: 'nav.intake', path: '/intake', icon: 'intake', roles: [...PHARMACIST, ...TECH] },
      { labelKey: 'nav.herbKnowledge', path: '/knowledge', icon: 'knowledge', roles: [...PHARMACIST, ...TECH] },
    ],
  },
  {
    sectionKey: 'nav.sectionRecords',
    items: [
      { labelKey: 'nav.patients', path: '/patients', icon: 'patients', roles: [...PRESCRIBER, ...PHARMACIST] },
      { labelKey: 'nav.aiCases', path: '/ai/cases', icon: 'aiSafety', roles: [...PRESCRIBER, ...PHARMACIST, ...ADMIN] },
      { labelKey: 'nav.aiKnowledge', path: '/ai/knowledge', icon: 'knowledge', roles: [...PRESCRIBER, ...PHARMACIST, ...RESEARCHER, ...ADMIN] },
    ],
  },
  {
    sectionKey: 'nav.sectionPathPatient',
    items: [
      { labelKey: 'nav.patientService', path: '/patient-service', icon: 'patientService', roles: PHARMACIST },
      { labelKey: 'nav.myPrescriptions', path: '/patient/me', icon: 'patientService', roles: PATIENT },
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
    sectionKey: 'nav.sectionSupportOps',
    items: [
      { labelKey: 'nav.workbench', path: '/workbench', icon: 'workbench', roles: ADMIN },
      { labelKey: 'nav.inventory', path: '/inventory', icon: 'inventory', roles: [...TECH, ...ADMIN] },
      { labelKey: 'nav.orders', path: '/orders', icon: 'orders', roles: ADMIN },
      { labelKey: 'nav.operationsAgent', path: '/ai/operations', icon: 'operations', roles: [...ADMIN, ...RESEARCHER] },
      { labelKey: 'nav.customers', path: '/customers', icon: 'customers', roles: ADMIN },
      { labelKey: 'nav.membership', path: '/membership', icon: 'customers', roles: ADMIN },
      { labelKey: 'nav.billing', path: '/billing', icon: 'billing', roles: ADMIN },
      { labelKey: 'nav.traceability', path: '/traceability', icon: 'quality', roles: [...TECH, ...ADMIN] },
      { labelKey: 'nav.quality', path: '/quality', icon: 'quality', roles: ADMIN },
      { labelKey: 'nav.compliance', path: '/compliance', icon: 'quality', roles: ADMIN },
    ],
  },
  {
    sectionKey: 'nav.sectionGovernance',
    items: [
      { labelKey: 'nav.governance', path: '/ai/governance', icon: 'governance', roles: [...ADMIN, ...RESEARCHER] },
    ],
  },
  {
    sectionKey: 'nav.sectionTwin',
    items: TWIN_ITEMS.map((i) => ({ ...i, roles: [...RESEARCHER, ...ADMIN] })),
  },
  {
    sectionKey: 'nav.sectionLegacy',
    items: [
      { labelKey: 'nav.legacyDemo', path: '/legacy/dashboard', icon: 'legacy', roles: ADMIN },
      { labelKey: 'nav.legacyOrganization', path: '/legacy/organization', icon: 'legacy', roles: ADMIN },
      { labelKey: 'nav.legacyAnalytics', path: '/legacy/prescriptions/analytics', icon: 'legacy', roles: ADMIN },
      { labelKey: 'nav.legacyResearch', path: '/legacy/research', icon: 'legacy', roles: [...ADMIN, ...RESEARCHER] },
      { labelKey: 'nav.legacyTraining', path: '/legacy/training', icon: 'legacy', roles: ADMIN },
    ],
  },
];

/** Reachable but not listed in the menu. */
export const HIDDEN_ROUTES = [
  { prefix: '/ai/reviews/', roles: [...PHARMACIST, ...TECH, ...PRESCRIBER, ...ADMIN] },
  { prefix: '/legacy/organization/', roles: ADMIN },
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
  if (pathname.startsWith('/simulation')) return t('nav.sectionTwin');
  if (pathname.startsWith('/legacy')) return t('app.legacyPageTitle');
  return t('app.defaultPageTitle');
}
