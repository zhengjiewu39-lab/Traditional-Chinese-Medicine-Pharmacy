import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar, Box, CssBaseline, Drawer, IconButton, List, ListItemIcon,
  ListItemText, Toolbar, Typography, Avatar, Menu, MenuItem, Divider,
  Collapse, ListItemButton, Chip, alpha,
} from '@mui/material';
import {
  Menu as MenuIcon, Dashboard, PointOfSale, ShoppingCart, People,
  CardMembership, NetworkCheck, Business, Gavel, Science, Inventory,
  Assessment, Logout, AccountCircle, ReceiptLong, Healing, QrCode,
  PersonSearch, Book, AssignmentTurnedIn, School, KeyboardArrowDown,
  KeyboardArrowUp, LocalPharmacy, AdminPanelSettings,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { getNavForRole, getPageTitle } from '../config/navigation';

const drawerWidth = 260;

const ICONS = {
  '运营驾驶舱': Dashboard,
  '智慧收银台': PointOfSale,
  '订单管理': ShoppingCart,
  '客户管理': People,
  '会员管理': CardMembership,
  '分销网络': NetworkCheck,
  '组织结构': Business,
  '监管合规': Gavel,
  '科研评价中心': Science,
  '库存管理': Inventory,
  '库存查询': Inventory,
  '处方统计分析': Assessment,
  'AI 处方审理': ReceiptLong,
  '医生工作台': Healing,
  '取药查询': QrCode,
  '患者档案': PersonSearch,
  '处方模板库': ReceiptLong,
  '中药知识库': Book,
  '中药溯源': QrCode,
  '质量管理': AssignmentTurnedIn,
  '药师培训': School,
  '部门管理': Business,
  '人员管理': People,
  '职位管理': Business,
  '绩效管理': Assessment,
};

function NavIcon({ name }) {
  const Icon = ICONS[name] || Dashboard;
  return <Icon fontSize="small" />;
}

function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [openSubMenus, setOpenSubMenus] = useState({});
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin, isPharmacist } = useAuth();

  const sections = useMemo(() => getNavForRole(user?.role), [user?.role]);
  const pageTitle = getPageTitle(location.pathname, user?.role);

  const isPathActive = (path) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 2, px: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: 'primary.main' }}>
          中药连锁药房
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {isPharmacist ? '药师临床工作台' : '运营管理平台'}
        </Typography>
        <Chip
          size="small"
          icon={isAdmin ? <AdminPanelSettings sx={{ fontSize: 14 }} /> : <LocalPharmacy sx={{ fontSize: 14 }} />}
          label={isAdmin ? '管理员' : '药师'}
          color={isAdmin ? 'primary' : 'secondary'}
          sx={{ mt: 1, height: 22, fontSize: '0.7rem' }}
        />
      </Toolbar>
      <Divider />
      <List sx={{ px: 1, py: 1, flex: 1, overflowY: 'auto' }}>
        {sections.map((section) => (
          <Box key={section.section} sx={{ mb: 1.5 }}>
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
                const open = openSubMenus[item.text];
                return (
                  <React.Fragment key={item.text}>
                    <ListItemButton onClick={() => setOpenSubMenus((p) => ({ ...p, [item.text]: !p[item.text] }))}>
                      <ListItemIcon sx={{ minWidth: 38 }}><NavIcon name={item.text} /></ListItemIcon>
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
                    <NavIcon name={item.text} />
                  </ListItemIcon>
                  <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: isPathActive(item.path) ? 700 : 500 }} />
                  {item.badge && (
                    <Chip label={item.badge} size="small" color="error" sx={{ height: 18, fontSize: '0.6rem' }} />
                  )}
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
          <Chip
            label={isPharmacist ? '药师模式' : '管理模式'}
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
              <Typography variant="body2">{user?.name} · {isAdmin ? '管理员' : '药师'}</Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { logout(); navigate('/login'); }}>
              <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
              <ListItemText>退出登录</ListItemText>
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
        {children}
      </Box>
    </Box>
  );
}

export default Layout;
