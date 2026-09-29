import React from 'react';
import { Chip, Stack } from '@mui/material';
import { SmartToy } from '@mui/icons-material';
import {
  AI_LABEL, STATE_LABELS, STATE_COLORS, TIER_LABELS, TIER_COLORS,
} from '../../config/aiLabels';
import { useLanguage } from '../../i18n/LanguageContext';

export function RiskTierChip({ tier, size = 'small' }) {
  const { t } = useLanguage();
  if (!tier) return <Chip size={size} label={t('ai.notScreened')} variant="outlined" />;
  return <Chip size={size} color={TIER_COLORS[tier]} label={t(TIER_LABELS[tier]) || tier} />;
}

export function StateChip({ state, size = 'small' }) {
  const { t } = useLanguage();
  return <Chip size={size} variant="outlined" color={STATE_COLORS[state] || 'default'} label={t(STATE_LABELS[state]) || state} />;
}

export function AiLabel({ isMock }) {
  const { t } = useLanguage();
  return (
    <Stack direction="row" spacing={1} component="span">
      <Chip size="small" icon={<SmartToy />} color="secondary" variant="outlined" label={t(AI_LABEL)} />
      {isMock && <Chip size="small" color="warning" label={t('ai.mockOutput')} />}
    </Stack>
  );
}
