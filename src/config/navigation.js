import { RESEARCH_HOME, buildNav, getPageTitleForPath } from './navStructure';

export { RESEARCH_HOME, buildNav, getPageTitleForPath };

export const ADMIN_ONLY_PATHS = [
  '/legacy/dashboard',
  '/legacy/distribution',
  '/legacy/organization',
  '/legacy/organization/personnel',
  '/legacy/organization/positions',
  '/legacy/organization/performance',
  '/legacy/compliance',
  '/legacy/customers',
  '/legacy/membership',
  '/legacy/orders',
  '/legacy/prescriptions/analytics',
];

export const PHARMACIST_HOME = RESEARCH_HOME;
export const ADMIN_HOME = RESEARCH_HOME;

export function getHomeForRole() {
  return RESEARCH_HOME;
}

export function isAdminOnlyPath(pathname) {
  return ADMIN_ONLY_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
