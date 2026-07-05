import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getHomeForRole, isAdminOnlyPath } from '../config/navigation';

/** 药师不可访问运营/组织类路由 */
export function RoleGuard({ children }) {
  const { user, isPharmacist } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  if (isPharmacist && isAdminOnlyPath(pathname)) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" gutterBottom>此功能仅限管理人员</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          药师账号请使用处方审理、患者档案等临床工作台功能
        </Typography>
        <Button variant="contained" onClick={() => navigate(getHomeForRole(user?.role))}>
          返回工作台
        </Button>
      </Box>
    );
  }

  return children;
}

export default RoleGuard;
