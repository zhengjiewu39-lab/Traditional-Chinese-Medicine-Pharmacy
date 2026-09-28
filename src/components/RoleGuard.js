import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { getHomeForRole, canAccessPath } from '../config/navigation';
import { useLanguage } from '../i18n/LanguageContext';

export function RoleGuard({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useLanguage();

  if (user && !canAccessPath(user.role, pathname)) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" gutterBottom>{t('roleGuard.title')}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('roleGuard.body')}
        </Typography>
        <Button variant="contained" onClick={() => navigate(getHomeForRole(user.role))}>
          {t('roleGuard.back')}
        </Button>
      </Box>
    );
  }

  return children;
}

export default RoleGuard;
