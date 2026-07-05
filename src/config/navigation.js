/** 管理员：运营、组织、分销、会员 */
export const ADMIN_NAV = [
  {
    section: '运营中心',
    items: [
      { text: '运营驾驶舱', path: '/dashboard' },
      { text: '智慧收银台', path: '/billing', badge: 'HOT' },
      { text: '订单管理', path: '/orders' },
      { text: '客户管理', path: '/customers' },
      { text: '会员管理', path: '/membership' },
      { text: '分销网络', path: '/distribution' },
    ],
  },
  {
    section: '组织与合规',
    items: [
      {
        text: '组织结构',
        children: [
          { text: '部门管理', path: '/organization' },
          { text: '人员管理', path: '/organization/personnel' },
          { text: '职位管理', path: '/organization/positions' },
          { text: '绩效管理', path: '/organization/performance' },
        ],
      },
      { text: '监管合规', path: '/compliance' },
      { text: '科研评价中心', path: '/research', badge: 'NEW' },
    ],
  },
  {
    section: '供应链',
    items: [
      { text: '库存管理', path: '/inventory' },
      { text: '处方统计分析', path: '/prescriptions/analytics' },
    ],
  },
];

/** 药师：处方、患者、审方、知识 */
export const PHARMACIST_NAV = [
  {
    section: '临床工作台',
    items: [
      { text: 'AI 处方审理', path: '/prescriptions/review', badge: 'HOT' },
      { text: '医生工作台', path: '/doctor', badge: 'NEW' },
      { text: '智慧收银台', path: '/billing' },
      { text: '取药查询', path: '/pickup' },
      { text: '患者档案', path: '/patients' },
    ],
  },
  {
    section: '处方与知识',
    items: [
      { text: '处方模板库', path: '/prescriptions/templates' },
      { text: '中药知识库', path: '/knowledge' },
      { text: '中药溯源', path: '/traceability' },
      { text: '质量管理', path: '/quality' },
    ],
  },
  {
    section: '学习与库存',
    items: [
      { text: '药师培训', path: '/training' },
      { text: '库存查询', path: '/inventory' },
    ],
  },
];

export const ADMIN_ONLY_PATHS = [
  '/dashboard',
  '/distribution',
  '/organization',
  '/organization/personnel',
  '/organization/positions',
  '/organization/performance',
  '/compliance',
  '/research',
  '/customers',
  '/membership',
  '/orders',
  '/prescriptions/analytics',
];

export const PHARMACIST_HOME = '/prescriptions/review';
export const ADMIN_HOME = '/dashboard';

export function getNavForRole(role) {
  return role === 'pharmacist' ? PHARMACIST_NAV : ADMIN_NAV;
}

export function getHomeForRole(role) {
  return role === 'pharmacist' ? PHARMACIST_HOME : ADMIN_HOME;
}

export function getPageTitle(pathname, role) {
  const nav = getNavForRole(role);
  for (const section of nav) {
    for (const item of section.items) {
      if (item.path === pathname) return item.text;
      if (item.children) {
        const child = item.children.find((c) => c.path === pathname);
        if (child) return child.text;
      }
    }
  }
  return '中药连锁药房';
}

export function isAdminOnlyPath(pathname) {
  return ADMIN_ONLY_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
