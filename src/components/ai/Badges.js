import React from 'react';
import { Chip, Stack } from '@mui/material';
import { SmartToy } from '@mui/icons-material';
import {
  AI_LABEL, STATE_LABELS, STATE_COLORS, TIER_LABELS, TIER_COLORS,
} from '../../config/aiLabels';

export function RiskTierChip({ tier, size = 'small' }) {
  if (!tier) return <Chip size={size} label="未筛查" variant="outlined" />;
  return <Chip size={size} color={TIER_COLORS[tier]} label={TIER_LABELS[tier] || tier} />;
}

export function StateChip({ state, size = 'small' }) {
  return <Chip size={size} variant="outlined" color={STATE_COLORS[state] || 'default'} label={STATE_LABELS[state] || state} />;
}

export function AiLabel({ isMock }) {
  return (
    <Stack direction="row" spacing={1} component="span">
      <Chip size="small" icon={<SmartToy />} color="secondary" variant="outlined" label={AI_LABEL} />
      {isMock && <Chip size="small" color="warning" label="模拟模型输出（非真实AI）" />}
    </Stack>
  );
}
