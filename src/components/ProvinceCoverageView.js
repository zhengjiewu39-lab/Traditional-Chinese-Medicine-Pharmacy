import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Stack,
  Tooltip,
  LinearProgress,
} from '@mui/material';

/** 全国省份按大区划分（与业务区域一致） */
const CHINA_REGIONS = [
  {
    name: '华北',
    provinces: ['北京市', '天津市', '河北省', '山西省', '内蒙古自治区'],
  },
  {
    name: '东北',
    provinces: ['辽宁省', '吉林省', '黑龙江省'],
  },
  {
    name: '华东',
    provinces: ['上海市', '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省'],
  },
  {
    name: '华中',
    provinces: ['河南省', '湖北省', '湖南省'],
  },
  {
    name: '华南',
    provinces: ['广东省', '广西壮族自治区', '海南省'],
  },
  {
    name: '西南',
    provinces: ['重庆市', '四川省', '贵州省', '云南省', '西藏自治区'],
  },
  {
    name: '西北',
    provinces: ['陕西省', '甘肃省', '青海省', '宁夏回族自治区', '新疆维吾尔自治区'],
  },
];

const ALL_PROVINCES = CHINA_REGIONS.flatMap((r) => r.provinces);

function normalizeProvince(name) {
  return String(name || '').trim();
}

function provinceMatches(coverageName, provinceName) {
  const c = normalizeProvince(coverageName);
  const p = normalizeProvince(provinceName);
  if (!c || !p) return false;
  if (c === p) return true;
  if (c.includes(p.replace(/[省市]$/, ''))) return true;
  if (p.includes(c.replace(/[省市]$/, ''))) return true;
  // 广西省 -> 广西壮族自治区
  if (c === '广西省' && p.includes('广西')) return true;
  return false;
}

function buildCoverageMap(distributors) {
  const map = {};
  ALL_PROVINCES.forEach((p) => {
    map[p] = { active: [], inactive: [] };
  });

  (distributors || []).forEach((dist) => {
    (dist.coverage || '').split('、').forEach((raw) => {
      const token = raw.trim();
      if (!token) return;
      ALL_PROVINCES.forEach((province) => {
        if (provinceMatches(token, province)) {
          if (dist.status === 'active') map[province].active.push(dist.name);
          else map[province].inactive.push(dist.name);
        }
      });
    });
  });

  return map;
}

function ProvinceCell({ province, info }) {
  const covered = info.active.length > 0 || info.inactive.length > 0;
  const tooltip = covered
    ? [
        info.active.length ? `活跃：${info.active.join('、')}` : '',
        info.inactive.length ? `非活跃：${info.inactive.join('、')}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '暂无分销商覆盖';

  const shortName = province
    .replace(/壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区/g, '')
    .replace(/[省市]/g, '');

  return (
    <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{tooltip}</span>} arrow>
      <Paper
        variant="outlined"
        sx={{
          p: 1,
          textAlign: 'center',
          minHeight: 56,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          bgcolor: covered ? 'rgba(92, 141, 137, 0.08)' : 'background.paper',
          borderColor: covered ? 'primary.main' : 'divider',
          borderWidth: covered ? 1.5 : 1,
          cursor: 'default',
        }}
      >
        <Typography variant="body2" fontWeight={covered ? 700 : 500}>
          {shortName}
        </Typography>
        {covered ? (
          <Typography variant="caption" color="text.secondary">
            {info.active.length + info.inactive.length} 家
          </Typography>
        ) : (
          <Typography variant="caption" color="text.disabled">
            未覆盖
          </Typography>
        )}
      </Paper>
    </Tooltip>
  );
}

export default function ProvinceCoverageView({ distributors = [] }) {
  const coverageMap = useMemo(() => buildCoverageMap(distributors), [distributors]);

  const stats = useMemo(() => {
    let covered = 0;
    let activeProvinces = 0;
    ALL_PROVINCES.forEach((p) => {
      const info = coverageMap[p];
      if (info.active.length || info.inactive.length) {
        covered += 1;
        if (info.active.length) activeProvinces += 1;
      }
    });
    return {
      total: ALL_PROVINCES.length,
      covered,
      uncovered: ALL_PROVINCES.length - covered,
      rate: Math.round((covered / ALL_PROVINCES.length) * 100),
      activeProvinces,
      distributorCount: distributors.length,
    };
  }, [coverageMap, distributors.length]);

  return (
    <Box>
      <Paper sx={{ p: 2, mb: 2, bgcolor: 'rgba(92, 141, 137, 0.04)' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">
              已覆盖省份
            </Typography>
            <Typography variant="h5" fontWeight={700} color="primary.main">
              {stats.covered}/{stats.total}
            </Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">
              覆盖率
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {stats.rate}%
            </Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">
              活跃覆盖
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {stats.activeProvinces} 省
            </Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">
              分销商总数
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {stats.distributorCount}
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <LinearProgress
              variant="determinate"
              value={stats.rate}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Grid>
        </Grid>
      </Paper>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Chip size="small" label="已覆盖" color="primary" variant="outlined" />
        <Chip size="small" label="未覆盖" variant="outlined" />
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
          悬停省份可查看对应分销商
        </Typography>
      </Stack>

      {CHINA_REGIONS.map((region) => (
        <Box key={region.name} sx={{ mb: 2.5 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            {region.name}
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              (
              {region.provinces.filter((p) => {
                const info = coverageMap[p];
                return info.active.length || info.inactive.length;
              }).length}
              /{region.provinces.length} 已覆盖)
            </Typography>
          </Typography>
          <Grid container spacing={1}>
            {region.provinces.map((province) => (
              <Grid item xs={4} sm={3} md={2} key={province}>
                <ProvinceCell province={province} info={coverageMap[province]} />
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}
    </Box>
  );
}
