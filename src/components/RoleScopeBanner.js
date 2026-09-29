import React from 'react';
import { Alert, Stack, Chip, Typography } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { isClinicalPathRole } from '../config/navigation';
import { useLanguage } from '../i18n/LanguageContext';

export default function RoleScopeBanner() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const role = user?.role;
  if (!role) return null;
  const isSecond = user?.username === 'pharmacist2';
  if (isClinicalPathRole(role)) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>{t('workflow.title')}</Typography>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
          <Chip size="small" color={role === 'prescriber' ? 'primary' : 'default'} label={t('workflow.prescriber')} />
          <Chip size="small" color={role === 'pharmacist' && !isSecond ? 'primary' : 'default'} label={t('workflow.pharmacist')} />
          <Chip size="small" color={isSecond ? 'primary' : 'default'} label={t('workflow.pharmacist2')} />
          <Chip size="small" color={role === 'patient' ? 'primary' : 'default'} label={t('workflow.patient')} />
        </Stack>
        <Typography variant="caption" color="text.secondary">{t('workflow.support')}</Typography>
      </Alert>
    );
  }
  return (
    <Alert severity="warning" sx={{ mb: 2 }}>
      {t('workflow.auxiliary', { role: t(`roles.${role}`) })}
    </Alert>
  );
}
