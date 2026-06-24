import React, { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Grid,
} from '@mui/material';

const initialComplianceData = {
  licenses: [
    {
      id: 1,
      name: '药品经营许可证',
      number: 'JY12345678',
      issueDate: '2023-01-01',
      expiryDate: '2028-01-01',
      status: '有效',
    },
    {
      id: 2,
      name: 'GSP认证证书',
      number: 'GSP98765432',
      issueDate: '2023-02-01',
      expiryDate: '2028-02-01',
      status: '有效',
    },
  ],
  inspections: [
    {
      id: 1,
      type: '日常检查',
      date: '2024-01-15',
      inspector: '药监局',
      result: '通过',
      notes: '各项指标符合要求',
    },
    {
      id: 2,
      type: '专项检查',
      date: '2024-02-01',
      inspector: '药监局',
      result: '通过',
      notes: '药品储存条件符合要求',
    },
  ],
  alerts: [
    {
      id: 1,
      type: '许可证到期提醒',
      message: 'GSP认证证书将在6个月后到期',
      severity: 'warning',
      date: '2024-02-20',
    },
    {
      id: 2,
      type: '库存预警',
      message: '部分药品库存低于安全库存水平',
      severity: 'error',
      date: '2024-02-19',
    },
  ],
};

function Compliance() {
  const [complianceData] = useState(initialComplianceData);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <div>
      <Typography variant="h4" gutterBottom>
        合规管理
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              证照管理
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>证照名称</TableCell>
                    <TableCell>证照编号</TableCell>
                    <TableCell>发证日期</TableCell>
                    <TableCell>有效期至</TableCell>
                    <TableCell>状态</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {complianceData.licenses.map((license) => (
                    <TableRow key={license.id}>
                      <TableCell>{license.name}</TableCell>
                      <TableCell>{license.number}</TableCell>
                      <TableCell>{license.issueDate}</TableCell>
                      <TableCell>{license.expiryDate}</TableCell>
                      <TableCell>
                        <Chip
                          label={license.status}
                          color={license.status === '有效' ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              检查记录
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>检查类型</TableCell>
                    <TableCell>检查日期</TableCell>
                    <TableCell>检查单位</TableCell>
                    <TableCell>检查结果</TableCell>
                    <TableCell>备注</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {complianceData.inspections.map((inspection) => (
                    <TableRow key={inspection.id}>
                      <TableCell>{inspection.type}</TableCell>
                      <TableCell>{inspection.date}</TableCell>
                      <TableCell>{inspection.inspector}</TableCell>
                      <TableCell>
                        <Chip
                          label={inspection.result}
                          color={inspection.result === '通过' ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{inspection.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              合规提醒
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>提醒类型</TableCell>
                    <TableCell>提醒内容</TableCell>
                    <TableCell>提醒日期</TableCell>
                    <TableCell>操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {complianceData.alerts.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell>{alert.type}</TableCell>
                      <TableCell>{alert.message}</TableCell>
                      <TableCell>{alert.date}</TableCell>
                      <TableCell>
                        <Button size="small" color="primary">
                          处理
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
}

export default Compliance; 