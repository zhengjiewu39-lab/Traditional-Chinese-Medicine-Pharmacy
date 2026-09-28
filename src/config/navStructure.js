/**
 * Navigation: 12 top-level sections of the pharmacist-governed AI pharmacy.
 * `roles` lists who may open an item; the backend enforces the same boundaries independently.
 */

export const WORKBENCH_HOME = '/workbench';
export const RESEARCH_HOME = '/simulation/overview';
export const PATIENT_HOME = '/patient/me';
export const PRESCRIBER_HOME = '/doctor';
export const PHARMACIST_HOME = '/ai/review-queue';
export const TECHNICIAN_HOME = '/dispensing';

const STAFF = ['admin', 'pharmacist', 'technician'];
const CLINICAL = ['admin', 'pharmacist'];
const PRESCRIBERS = ['admin', 'pharmacist', 'prescriber'];
const REVIEWERS = ['admin', 'pharmacist'];
const ALL_INTERNAL = ['admin', 'pharmacist', 'technician', 'researcher'];
const GOVERNANCE = ['admin', 'pharmacist', 'researcher'];

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
    sectionKey: 'nav.sectionWorkbench',
    items: [
      { labelKey: 'nav.workbench', path: '/workbench', icon: 'workbench', roles: STAFF },
    ],
  },
  {
    sectionKey: 'nav.sectionIntake',
    items: [
      { labelKey: 'nav.intake', path: '/intake', icon: 'intake', roles: STAFF },
      { labelKey: 'nav.doctor', path: '/doctor', icon: 'doctor', roles: PRESCRIBERS },
      { labelKey: 'nav.patients', path: '/patients', icon: 'patients', roles: [...STAFF, 'prescriber'] },
      { labelKey: 'nav.customers', path: '/customers', icon: 'customers', roles: CLINICAL },
      { labelKey: 'nav.membership', path: '/membership', icon: 'customers', roles: CLINICAL },
      { labelKey: 'nav.templates', path: '/prescriptions/templates', icon: 'templates', roles: [...STAFF, 'prescriber'] },
    ],
  },
  {
    sectionKey: 'nav.sectionAiSafety',
    items: [
      { labelKey: 'nav.aiCases', path: '/ai/cases', icon: 'aiSafety', roles: [...STAFF, 'prescriber'] },
      { labelKey: 'nav.aiKnowledge', path: '/ai/knowledge', icon: 'knowledge', roles: [...GOVERNANCE, 'prescriber'] },
      { labelKey: 'nav.herbKnowledge', path: '/knowledge', icon: 'knowledge', roles: STAFF },
    ],
  },
  {
    sectionKey: 'nav.sectionReview',
    items: [
      { labelKey: 'nav.reviewQueue', path: '/ai/review-queue', icon: 'review', roles: REVIEWERS },
    ],
  },
  {
    sectionKey: 'nav.sectionDispensing',
    items: [
      { labelKey: 'nav.dispensing', path: '/dispensing', icon: 'dispensing', roles: STAFF },
      { labelKey: 'nav.pickup', path: '/pickup', icon: 'pickup', roles: STAFF },
      { labelKey: 'nav.billing', path: '/billing', icon: 'billing', roles: STAFF },
    ],
  },
  {
    sectionKey: 'nav.sectionDelivery',
    items: [
      { labelKey: 'nav.distribution', path: '/distribution', icon: 'delivery', roles: STAFF },
    ],
  },
  {
    sectionKey: 'nav.sectionInventory',
    items: [
      { labelKey: 'nav.inventory', path: '/inventory', icon: 'inventory', roles: STAFF },
      { labelKey: 'nav.orders', path: '/orders', icon: 'orders', roles: CLINICAL },
      { labelKey: 'nav.operationsAgent', path: '/ai/operations', icon: 'operations', roles: ALL_INTERNAL },
    ],
  },
  {
    sectionKey: 'nav.sectionQuality',
    items: [
      { labelKey: 'nav.traceability', path: '/traceability', icon: 'quality', roles: STAFF },
      { labelKey: 'nav.quality', path: '/quality', icon: 'quality', roles: STAFF },
      { labelKey: 'nav.compliance', path: '/compliance', icon: 'quality', roles: CLINICAL },
    ],
  },
  {
    sectionKey: 'nav.sectionPatientService',
    items: [
      { labelKey: 'nav.patientService', path: '/patient-service', icon: 'patientService', roles: STAFF },
      { labelKey: 'nav.myPrescriptions', path: '/patient/me', icon: 'patientService', roles: ['patient'] },
    ],
  },
  {
    sectionKey: 'nav.sectionGovernance',
    items: [
      { labelKey: 'nav.governance', path: '/ai/governance', icon: 'governance', roles: GOVERNANCE },
    ],
  },
  {
    sectionKey: 'nav.sectionTwin',
    items: TWIN_ITEMS.map((i) => ({ ...i, roles: ALL_INTERNAL })),
  },
  {
    sectionKey: 'nav.sectionLegacy',
    items: [
      { labelKey: 'nav.legacyDemo', path: '/legacy/dashboard', icon: 'legacy', roles: ['admin'] },
      { labelKey: 'nav.legacyOrganization', path: '/legacy/organization', icon: 'legacy', roles: ['admin'] },
      { labelKey: 'nav.legacyAnalytics', path: '/legacy/prescriptions/analytics', icon: 'legacy', roles: ['admin'] },
      { labelKey: 'nav.legacyResearch', path: '/legacy/research', icon: 'legacy', roles: ['admin', 'researcher'] },
      { labelKey: 'nav.legacyTraining', path: '/legacy/training', icon: 'legacy', roles: ['admin', 'pharmacist'] },
    ],
  },
];

/** Routes that are reachable but not listed in the menu, with the roles allowed to open them. */
export const HIDDEN_ROUTES = [
  { prefix: '/ai/reviews/', roles: [...STAFF, 'prescriber'] },
  { prefix: '/legacy/organization/', roles: ['admin'] },
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
  for (const section of NAV_STRUCTURE) {
    for (const item of section.items) {
      if (pathname === item.path || pathname.startsWith(`${item.path}/`)) return item.roles || null;
    }
  }
  const hidden = HIDDEN_ROUTES.find((h) => pathname.startsWith(h.prefix));
  return hidden ? hidden.roles : null;
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
