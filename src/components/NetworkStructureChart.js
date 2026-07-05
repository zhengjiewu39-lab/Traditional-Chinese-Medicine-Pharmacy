import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';

const REGION_HEADER_COLORS = ['#0d9488', '#2563eb', '#7c3aed', '#ea580c', '#db2777', '#0891b2', '#4f46e5'];

export default function NetworkStructureChart({ distributors = [] }) {
  const regions = useMemo(() => {
    const groups = {};
    (distributors || []).forEach((dist) => {
      if (!dist) return;
      const region = (dist.region || '其他').replace('地区', '');
      if (!groups[region]) {
        groups[region] = { name: region, total: 0, items: [] };
      }
      groups[region].items.push(dist);
      groups[region].total += dist.currentSales || 0;
    });
    return Object.values(groups).sort((a, b) => b.total - a.total);
  }, [distributors]);

  const grandTotal = regions.reduce((sum, r) => sum + r.total, 0) || 1;

  if (!regions.length) {
    return (
      <Box
        sx={{
          minHeight: 480,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#f1f5f9',
          borderRadius: 2,
          border: '1px solid #cbd5e1',
        }}
      >
        <Typography color="text.secondary">暂无分销商数据</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: 480,
        bgcolor: '#e2e8f0',
        borderRadius: 2,
        p: 2,
        border: '1px solid #94a3b8',
      }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'stretch' }}>
        {regions.map((region, index) => {
          const share = Math.max(22, (region.total / grandTotal) * 100);
          return (
            <Box
              key={region.name}
              sx={{
                flex: `1 1 ${share}%`,
                minWidth: 160,
                minHeight: 180,
                bgcolor: '#fff',
                border: '2px solid #1e293b',
                borderRadius: 1,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box
                sx={{
                  px: 1.5,
                  py: 1,
                  bgcolor: REGION_HEADER_COLORS[index % REGION_HEADER_COLORS.length],
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {region.name} · ¥{(region.total / 10000).toFixed(0)}万 · {region.items.length} 家
              </Box>
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 0.75,
                  p: 1,
                  alignContent: 'flex-start',
                }}
              >
                {region.items.map((dist) => {
                  const weight = Math.max(100, Math.sqrt(dist.currentSales || 0) / 35);
                  return (
                    <Box
                      key={dist.id}
                      sx={{
                        flex: `1 1 ${weight}px`,
                        minWidth: 100,
                        minHeight: 64,
                        bgcolor: dist.status === 'active' ? '#2563eb' : '#64748b',
                        color: '#fff',
                        borderRadius: 1,
                        p: 1,
                        border: '1px solid #0f172a',
                      }}
                    >
                      <Typography variant="caption" fontWeight={700} sx={{ display: 'block', lineHeight: 1.3 }}>
                        {dist.name}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.92 }}>
                        ¥{((dist.currentSales || 0) / 10000).toFixed(0)}万
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block', opacity: 0.85, fontSize: 10 }}>
                        {dist.status === 'active' ? '活跃' : '非活跃'}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
