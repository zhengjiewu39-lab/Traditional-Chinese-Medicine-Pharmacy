import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Box, CssBaseline, Drawer, IconButton, List, ListItemIcon,
  ListItemText, Toolbar, Typography, Avatar, Menu, MenuItem, Divider,
  Collapse, ListItemButton, Chip, alpha,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Science,
  Assessment,
  PlayArrow,
  AssignmentTurnedIn,
  Inventory,
  Logout,
  AccountCircle,
  KeyboardArrowDown,
  KeyboardArrowUp,
  LocalPharmacy,
  AdminPanelSettings,
  SpaceDashboard,
  MoveToInbox,
  MedicalServices,
  People,
  Description,
  GppMaybe,
  MenuBook,
  FactCheck,
  Scale,
  QrCode2,
  PointOfSale,
  LocalShipping,
  ShoppingCart,
  Insights,
  VerifiedUser,
  VolunteerActivism,
  Policy,
  Handyman,
  Person,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { buildNav, getPageTitleForPath } from '../config/navigation';
import SimulationDisclaimer from './SimulationDisclaimer';
import SyntheticDataNotice from './ai/SyntheticDataNotice';
import ApiStatusBanner from './ApiStatusBanner';
import LanguageSwitcher from './LanguageSwitcher';
import { useLanguage } from '../i18n/LanguageContext';

const drawerWidth = 260;

const ICONS = {
  overview: Dashboard,
  scenario: Science,
  strategies: Assessment,
  run: PlayArrow,
  results: Assessment,
  reproducibility: AssignmentTurnedIn,
  archive: AssignmentTurnedIn,
  documentation: Science,
  legacy: Inventory,
  workbench: SpaceDashboard,
  intake: MoveToInbox,
  doctor: MedicalServices,
  patients: People,
  customers: People,
  templates: Description,
  aiSafety: GppMaybe,
  knowledge: MenuBook,
  review: FactCheck,
  dispensing: Scale,
  pickup: QrCode2,
  billing: PointOfSale,
  delivery: LocalShipping,
  inventory: Inventory,
  orders: ShoppingCart,
  operations: Insights,
  quality: VerifiedUser,
  patientService: VolunteerActivism,
  governance: Policy,
};

const ROLE_ICONS = {
  admin: AdminPanelSettings,
  pharmacist: LocalPharmacy,
  technician: Handyman,
  researcher: Science,
  patient: Person,
};

function NavIcon({ icon }) {
  const Icon = ICONS[icon] || Dashboard;
  return <Icon fontSize="small" />;
}

function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [openSubMenus, setOpenSubMenus] = useState({});
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const { t } = useLanguage();
  const role = user?.role;
  const RoleIcon = ROLE_ICONS[role] || AccountCircle;
  const isTwinPage = location.pathname.startsWith('/simulation');

  const sections = useMemo(() => buildNav(t, role), [t, role]);
  const pageTitle = getPageTitleForPath(location.pathname, t);

  const isPathActive = (path) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 2, px: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>
          {t('app.title')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('app.subtitle')}
        </Typography>
        <Chip
          size="small"
          icon={<RoleIcon sx={{ fontSize: 14 }} />}
          label={t(`roles.${role}`)}
          color={isAdmin ? 'primary' : 'secondary'}
          sx={{ mt: 1, height: 22, fontSize: '0.7rem' }}
        />
      </Toolbar>
      <Divider />
      <List sx={{ px: 1, py: 1, flex: 1, overflowY: 'auto' }}>
        {sections.map((section) => (
          <Box key={section.sectionKey} sx={{ mb: 1.5 }}>
            <Typography
              variant="caption"
              sx={{
                px: 1.5, py: 0.5, display: 'block', fontWeight: 700,
                color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}
            >
              {section.section}
            </Typography>
            {section.items.map((item) => {
              if (item.children) {
                const open = openSubMenus[item.labelKey];
                return (
                  <React.Fragment key={item.labelKey}>
                    <ListItemButton onClick={() => setOpenSubMenus((p) => ({ ...p, [item.labelKey]: !p[item.labelKey] }))}>
                      <ListItemIcon sx={{ minWidth: 38 }}><NavIcon icon={item.icon} /></ListItemIcon>
                      <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 600 }} />
                      {open ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                    </ListItemButton>
                    <Collapse in={open} unmountOnExit>
                      <List disablePadding>
                        {item.children.map((child) => (
                          <ListItemButton
                            key={child.path}
                            selected={location.pathname === child.path}
                            onClick={() => { navigate(child.path); setMobileOpen(false); }}
                            sx={{ pl: 4, borderRadius: 1.5, mx: 0.5, mb: 0.25 }}
                          >
                            <ListItemText primary={child.text} primaryTypographyProps={{ fontSize: '0.8125rem' }} />
                          </ListItemButton>
                        ))}
                      </List>
                    </Collapse>
                  </React.Fragment>
                );
              }
              return (
                <ListItemButton
                  key={item.path}
                  selected={isPathActive(item.path)}
                  onClick={() => { navigate(item.path); setMobileOpen(false); }}
                  sx={{ borderRadius: 1.5, mx: 0.5, mb: 0.25 }}
                >
                  <ListItemIcon sx={{ minWidth: 38, color: isPathActive(item.path) ? 'primary.main' : 'text.secondary' }}>
                    <NavIcon icon={item.icon} />
                  </ListItemIcon>
                  <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: isPathActive(item.path) ? 700 : 500 }} />
                </ListItemButton>
              );
            })}
          </Box>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(!mobileOpen)} sx={{ mr: 2, display: { sm: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            {pageTitle}
          </Typography>
          <LanguageSwitcher />
          <Chip
            label={t(`roles.${role}Mode`)}
            size="small"
            sx={{ mr: 2, bgcolor: alpha('#fff', 0.15), color: '#fff', fontWeight: 600 }}
          />
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} color="inherit">
            <Avatar sx={{ width: 34, height: 34, bgcolor: isAdmin ? 'secondary.main' : 'primary.light' }}>
              {user?.name?.[0] || <AccountCircle />}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <MenuItem disabled>
              <Typography variant="body2">{user?.name} · {t(`roles.${role}`)}</Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { logout(); navigate('/login'); }}>
              <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
              <ListItemText>{t('auth.logout')}</ListItemText>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
        <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)} sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: drawerWidth } }}>
          {drawer}
        </Drawer>
        <Drawer variant="permanent" sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' } }} open>
          {drawer}
        </Drawer>
      </Box>
      <Box component="main" sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` }, mt: '64px' }}>
        {isTwinPage && <ApiStatusBanner />}
        {!isTwinPage && <SyntheticDataNotice />}
        {children}
        {isTwinPage && <SimulationDisclaimer />}
      </Box>
    </Box>
  );
}

export default Layout;
