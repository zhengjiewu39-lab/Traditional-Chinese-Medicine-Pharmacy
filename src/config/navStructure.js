/** Navigation structure with i18n label keys and stable icon ids */

export const RESEARCH_HOME = '/simulation/overview';

export const NAV_STRUCTURE = [
  {
    sectionKey: 'nav.sectionStudy',
    items: [
      { labelKey: 'nav.overview', path: '/simulation/overview', icon: 'overview' },
      { labelKey: 'nav.scenario', path: '/simulation/scenario', icon: 'scenario' },
      { labelKey: 'nav.strategies', path: '/simulation/strategies', icon: 'strategies' },
      { labelKey: 'nav.run', path: '/simulation/run', icon: 'run' },
      { labelKey: 'nav.results', path: '/simulation/results', icon: 'results' },
      { labelKey: 'nav.reproducibility', path: '/simulation/reproducibility', icon: 'reproducibility' },
    ],
  },
  {
    sectionKey: 'nav.sectionLegacy',
    items: [
      {
        labelKey: 'nav.legacyGroup',
        icon: 'legacy',
        children: [
          { labelKey: 'nav.legacyDashboard', path: '/legacy/dashboard' },
          { labelKey: 'nav.legacyDistribution', path: '/legacy/distribution' },
          { labelKey: 'nav.legacyInventory', path: '/legacy/inventory' },
          { labelKey: 'nav.legacyResearch', path: '/legacy/research' },
          { labelKey: 'nav.legacyRx', path: '/legacy/prescriptions/review' },
        ],
      },
    ],
  },
];

export function buildNav(t) {
  return NAV_STRUCTURE.map((section) => ({
    section: t(section.sectionKey),
    sectionKey: section.sectionKey,
    items: section.items.map((item) => ({
      ...item,
      text: t(item.labelKey),
      children: item.children?.map((c) => ({ ...c, text: t(c.labelKey) })),
    })),
  }));
}

export function getPageTitleForPath(pathname, t) {
  for (const section of NAV_STRUCTURE) {
    for (const item of section.items) {
      if (item.path === pathname) return t(item.labelKey);
      if (item.children) {
        const c = item.children.find((x) => x.path === pathname);
        if (c) return t(c.labelKey);
      }
    }
  }
  if (pathname.startsWith('/simulation')) return t('app.defaultPageTitle');
  if (pathname.startsWith('/legacy')) return t('app.legacyPageTitle');
  return t('app.defaultPageTitle');
}
