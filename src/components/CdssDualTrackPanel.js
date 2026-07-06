import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Stack,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
} from '@mui/material';
import {
  Gavel as RuleIcon,
  Psychology as MlIcon,
  MergeType as JointIcon,
  Error as ErrorIcon,
  WarningAmber as WarningIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';

const FEATURE_LABELS = {
  herb_count_norm: '药味数偏多',
  has_dosage_high: '超剂量',
  has_dosage_low: '剂量偏低',
  has_18fan: '十八反',
  has_19wei: '十九畏',
  has_incompatible_pair: '配伍禁忌',
  licorice_ratio_high: '甘草比例偏高',
  elderly_patient: '老年患者',
  pediatric_patient: '儿童患者',
  warm_cold_mix: '寒热并用',
};

function alertIcon(level) {
  if (level === 'error') return <ErrorIcon color="error" fontSize="small" />;
  if (level === 'warning') return <WarningIcon color="warning" fontSize="small" />;
  return <CheckIcon color="success" fontSize="small" />;
}

function statusColor(status) {
  if (status === '需修改') return 'error';
  if (status === '建议复核') return 'warning';
  return 'success';
}

function evidenceChip(evidenceLevel) {
  const map = {
    deterministic: { label: '确定性证据', color: 'error' },
    'rule-based': { label: '规则证据', color: 'warning' },
    probabilistic: { label: '概率证据', color: 'info' },
  };
  const cfg = map[evidenceLevel] || { label: evidenceLevel, color: 'default' };
  return <Chip size="small" label={cfg.label} color={cfg.color} variant="outlined" />;
}

function adrRiskColor(level) {
  if (level === 'high') return 'error';
  if (level === 'moderate') return 'warning';
  return 'success';
}

function FeatureBar({ label, weight, maxWeight }) {
  const pct = maxWeight > 0 ? Math.min(100, (Math.abs(weight) / maxWeight) * 100) : 0;
  return (
    <Box sx={{ mb: 1.2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
        <Typography variant="caption" fontWeight={600}>{label}</Typography>
        <Typography variant="caption" color="text.secondary">{weight > 0 ? '+' : ''}{weight}</Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        color={weight > 0 ? 'error' : 'success'}
        sx={{ height: 8, borderRadius: 4 }}
      />
    </Box>
  );
}

export default function CdssDualTrackPanel({ cdss }) {
  if (!cdss?.tracks) return null;

  const { ruleEngine, ml } = cdss.tracks;
  const joint = cdss.joint || {};
  const adr = cdss.adrPrevention || {};
  const maxAttr = Math.max(
    ...(ml.featureAttributions || []).map((f) => Math.abs(f.weight)),
    1
  );

  return (
    <Box sx={{ mt: 2 }}>
      {adr.adrRiskScore != null && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderColor: 'warning.main' }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>不良反应预防评估 (ADR Prevention)</Typography>
            <Chip
              label={`风险 ${adr.riskLevel?.labelZh || '—'}`}
              color={adrRiskColor(adr.riskLevel?.level)}
            />
            <Chip label={`ADR 评分 ${(adr.adrRiskScore * 100).toFixed(0)}`} variant="outlined" />
          </Stack>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, adr.adrRiskScore * 100)}
            color={adrRiskColor(adr.riskLevel?.level)}
            sx={{ height: 10, borderRadius: 5, mb: 1.5 }}
          />
          {(adr.categories || []).length > 0 && (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
              {adr.categories.map((cat) => (
                <Chip
                  key={cat.id}
                  size="small"
                  label={`${cat.nameZh} (${(cat.alerts || cat.mlContributions || []).length})`}
                  color={cat.evidenceLevel === 'deterministic' ? 'error' : 'default'}
                  variant="outlined"
                />
              ))}
            </Stack>
          )}
          {(adr.preventionActions || []).length > 0 && (
            <Alert severity="info" sx={{ mt: 1 }}>
              <Typography variant="caption" fontWeight={700} display="block" gutterBottom>预防建议</Typography>
              {adr.preventionActions.map((a, i) => (
                <Typography key={i} variant="body2">• {a}</Typography>
              ))}
            </Alert>
          )}
          {adr.clinicalDisclaimer && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              {adr.clinicalDisclaimer}
            </Typography>
          )}
        </Paper>
      )}

      <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'rgba(92, 141, 137, 0.06)' }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <JointIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={700}>联合决策输出 (HAR-CDSS)</Typography>
          <Chip label={joint.status || cdss.status} color={statusColor(joint.status || cdss.status)} />
          <Chip label={`综合评分 ${joint.score ?? cdss.score}`} variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {joint.summary || cdss.summary}
        </Typography>
      </Paper>

      <Grid container spacing={2}>
        {/* Track 1: Rule Engine */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <RuleIcon color="primary" />
              <Typography variant="subtitle2" fontWeight={700}>轨道 1 · 专家规则引擎</Typography>
              <Chip size="small" label={`评分 ${ruleEngine.score}`} />
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
              十八反 / 十九畏 / 超剂量 · 确定性警报
            </Typography>
            <Divider sx={{ mb: 1 }} />
            {(ruleEngine.deterministicAlerts || ruleEngine.alerts || []).length === 0 ? (
              <Alert severity="success" icon={<CheckIcon />}>未发现确定性禁忌或超量</Alert>
            ) : (
              <List dense disablePadding>
                {(ruleEngine.deterministicAlerts || ruleEngine.alerts).map((a, i) => (
                  <ListItem key={i} disableGutters>
                    <ListItemIcon sx={{ minWidth: 32 }}>{alertIcon(a.level)}</ListItemIcon>
                    <ListItemText
                      primary={a.message}
                      secondary={
                        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Typography variant="caption" component="span">[{a.type}]</Typography>
                          {evidenceChip(a.evidenceLevel || (a.deterministic !== false ? 'deterministic' : 'probabilistic'))}
                        </Stack>
                      }
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Track 2: ML */}
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <MlIcon color="secondary" />
              <Typography variant="subtitle2" fontWeight={700}>轨道 2 · 可解释 ML</Typography>
              <Chip size="small" label={`ML 评分 ${ml.score}`} />
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              特征向量化 → 线性权重 → 风险概率 + 归因
            </Typography>

            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                需修改概率 (ADR 修订风险): <strong>{((ml.probabilities?.needs_revision || ml.adrRevisionProbability || 0) * 100).toFixed(1)}%</strong>
                {' · '}
                建议复核概率: <strong>{((ml.probabilities?.review || ml.adrReviewProbability || 0) * 100).toFixed(1)}%</strong>
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(ml.probabilities?.needs_revision || ml.adrRevisionProbability || 0) * 100}
                color="error"
                sx={{ height: 10, borderRadius: 5, mb: 0.5 }}
              />
            </Box>

            <Divider sx={{ mb: 1 }} />
            <Typography variant="caption" fontWeight={700} display="block" sx={{ mb: 1 }}>
              Top 特征归因 (Feature Weights)
            </Typography>
            {(ml.featureAttributions || []).length === 0 ? (
              <Typography variant="body2" color="text.secondary">无显著风险特征</Typography>
            ) : (
              ml.featureAttributions.map((f) => (
                <FeatureBar
                  key={f.feature}
                  label={f.label || FEATURE_LABELS[f.feature] || f.feature}
                  weight={f.weight}
                  maxWeight={maxAttr}
                />
              ))
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
