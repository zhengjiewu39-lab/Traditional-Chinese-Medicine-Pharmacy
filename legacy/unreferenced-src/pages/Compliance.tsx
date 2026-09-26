import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
} from '@mui/lab';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Search as SearchIcon,
  VerifiedUser as VerifiedUserIcon,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const complianceData = [
  { name: '药品合规', 检查: 98 },
  { name: '订单合规', 检查: 95 },
  { name: '供应链合规', 检查: 97 },
  { name: '客户隐私', 检查: 99 },
];

const blockchainTrace = [
  { step: '采购', status: 'success', time: '2024-03-01' },
  { step: '入库', status: 'success', time: '2024-03-02' },
  { step: '分销', status: 'success', time: '2024-03-05' },
  { step: '销售', status: 'success', time: '2024-03-10' },
  { step: '售后', status: 'success', time: '2024-03-15' },
];

const Compliance: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        监管合规
      </Typography>
      <Grid container spacing={3}>
        {/* 合规检查卡片 */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                药品合规率
              </Typography>
              <Typography variant="h5">98%</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                订单合规率
              </Typography>
              <Typography variant="h5">95%</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                供应链合规率
              </Typography>
              <Typography variant="h5">97%</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                客户隐私合规率
              </Typography>
              <Typography variant="h5">99%</Typography>
            </CardContent>
          </Card>
        </Grid>
        {/* 区块链追溯 */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              区块链追溯
            </Typography>
            <Timeline position="alternate">
              {blockchainTrace.map((item, idx) => (
                <TimelineItem key={idx}>
                  <TimelineSeparator>
                    <TimelineDot color={item.status === 'success' ? 'success' : 'error'}>
                      {item.status === 'success' ? <CheckCircleIcon /> : <ErrorIcon />}
                    </TimelineDot>
                    {idx < blockchainTrace.length - 1 && <TimelineConnector />}
                  </TimelineSeparator>
                  <TimelineContent>
                    <Typography>{item.step}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {item.time}
                    </Typography>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          </Paper>
        </Grid>
        {/* AI合规分析与数据可视化 */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              AI合规分析
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={complianceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="检查" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
            <Box sx={{ mt: 2 }}>
              <Button variant="contained" startIcon={<SearchIcon />}>启动AI合规分析</Button>
              <Button variant="outlined" startIcon={<VerifiedUserIcon />} sx={{ ml: 2 }}>导出合规报告</Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Compliance; 