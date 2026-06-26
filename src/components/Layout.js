import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Collapse,
  ListItemButton,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Inventory,
  ShoppingCart,
  People,
  Gavel,
  AccountCircle,
  Logout,
  Business,
  NetworkCheck,
  ReceiptLong,
  Book,
  Healing,
  PersonSearch,
  FactCheck,
  KeyboardArrowDown,
  KeyboardArrowUp,
  QrCode,
  Analytics,
  School,
  AssignmentTurnedIn,
  CardMembership,
  PersonAdd,
  Assessment,
  WorkOutline,
  PointOfSale,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const drawerWidth = 240;

const menuItems = [
  { text: '运营驾驶舱', icon: <Dashboard />, path: '/dashboard' },
  { text: '智慧收银台', icon: <PointOfSale />, path: '/billing', badge: 'HOT' },
  { text: '医生工作台', icon: <Healing />, path: '/doctor', badge: 'NEW' },
  { text: '取药查询', icon: <QrCode />, path: '/pickup' },
  { 
    text: '组织结构', 
    icon: <Business />, 
    children: [
      { text: '部门管理', path: '/organization' },
      { text: '人员管理', path: '/organization/personnel' },
      { text: '职位管理', path: '/organization/positions' },
      { text: '绩效管理', path: '/organization/performance' },
    ] 
  },
  { text: '订单管理', icon: <ShoppingCart />, path: '/orders' },
  { text: '库存管理', icon: <Inventory />, path: '/inventory' },
  { text: '分销网络', icon: <NetworkCheck />, path: '/distribution' },
  { text: '客户管理', icon: <People />, path: '/customers' },
  { 
    text: '处方管理', 
    icon: <ReceiptLong />, 
    children: [
      { text: 'AI处方审理', path: '/prescriptions/review' },
      { text: '处方模板库', path: '/prescriptions/templates' },
      { text: '处方统计分析', path: '/prescriptions/analytics' },
    ] 
  },
  { text: '中药知识库', icon: <Book />, path: '/knowledge' },
  { text: '中药溯源', icon: <QrCode />, path: '/traceability' },
  { text: '患者档案', icon: <PersonSearch />, path: '/patients' },
  { text: '质量管理', icon: <AssignmentTurnedIn />, path: '/quality' },
  { text: '药师培训', icon: <School />, path: '/training' },
  { text: '会员管理', icon: <CardMembership />, path: '/membership' },
  { text: '监管合规', icon: <Gavel />, path: '/compliance' },
];

function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [openSubMenus, setOpenSubMenus] = useState({});
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSubMenuToggle = (text) => {
    setOpenSubMenus(prev => ({
      ...prev,
      [text]: !prev[text]
    }));
  };

  const isPathActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          中药连锁药房
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          item.children ? (
            <React.Fragment key={item.text}>
              <ListItemButton onClick={() => handleSubMenuToggle(item.text)}>
                <ListItemIcon>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} />
                {openSubMenus[item.text] ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
              </ListItemButton>
              <Collapse in={openSubMenus[item.text]} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {item.children.map((child) => (
                    <ListItemButton 
                      key={child.text} 
                      onClick={() => navigate(child.path)}
                      selected={location.pathname === child.path}
                      sx={{ pl: 4 }}
                    >
                      <ListItemText primary={child.text} />
                    </ListItemButton>
                  ))}
                </List>
              </Collapse>
            </React.Fragment>
          ) : (
            <ListItem
              button
              key={item.text}
              onClick={() => navigate(item.path)}
              selected={isPathActive(item.path)}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItem>
          )
        ))}
      </List>
    </div>
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
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {location.pathname === '/dashboard' ? '中药连锁药房' : (
              menuItems.find(item => 
                item.path === location.pathname || 
                (item.children && item.children.some(child => child.path === location.pathname))
              )?.text || '中药连锁药房'
            )}
          </Typography>
          <IconButton
            size="large"
            edge="end"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleMenuOpen}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32 }}>
              {user?.name?.[0] || <AccountCircle />}
            </Avatar>
          </IconButton>
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem disabled>
              <Typography variant="body2">
                {user?.name || '用户'}
              </Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              <ListItemText>退出登录</ListItemText>
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: '64px',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default Layout; 