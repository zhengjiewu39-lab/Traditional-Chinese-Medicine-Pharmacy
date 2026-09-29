import {
  WORKBENCH_HOME, RESEARCH_HOME, PATIENT_HOME, PRESCRIBER_HOME, PHARMACIST_HOME, TECHNICIAN_HOME, ADMIN_HOME,
  buildNav, getPageTitleForPath, rolesForPath,
} from './navStructure';

export {
  WORKBENCH_HOME, RESEARCH_HOME, PATIENT_HOME, PRESCRIBER_HOME, PHARMACIST_HOME, TECHNICIAN_HOME, ADMIN_HOME,
  buildNav, getPageTitleForPath,
};

export function getHomeForRole(role) {
  if (role === 'patient') return PATIENT_HOME;
  if (role === 'researcher') return RESEARCH_HOME;
  if (role === 'prescriber') return PRESCRIBER_HOME;
  if (role === 'pharmacist') return PHARMACIST_HOME;
  if (role === 'technician') return TECHNICIAN_HOME;
  if (role === 'admin') return ADMIN_HOME;
  return WORKBENCH_HOME;
}

export function canAccessPath(role, pathname) {
  const roles = rolesForPath(pathname);
  if (roles) return roles.includes(role);
  return false;
}

export function isClinicalPathRole(role) {
  return ['prescriber', 'pharmacist', 'patient'].includes(role);
}
