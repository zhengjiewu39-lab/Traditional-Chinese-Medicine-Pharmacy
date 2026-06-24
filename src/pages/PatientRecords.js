import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  Box,
  Grid,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import {
  Person,
  Search,
  Add,
  Edit,
  Delete,
  Visibility,
  ContentPaste,
  Close,
} from '@mui/icons-material';

// 模拟病人数据
const initialPatients = [
  {
    id: 1,
    name: '张三',
    gender: '男',
    age: 45,
    phone: '13800138001',
    address: '北京市海淀区中关村大街1号',
    medicalHistory: ['高血压', '糖尿病'],
    recentVisits: '2023-05-10',
    prescriptionCount: 8,
  },
  {
    id: 2,
    name: '李四',
    gender: '女',
    age: 32,
    phone: '13900139002',
    address: '北京市朝阳区建国路2号',
    medicalHistory: ['过敏性鼻炎'],
    recentVisits: '2023-05-15',
    prescriptionCount: 3,
  },
  {
    id: 3,
    name: '王五',
    gender: '男',
    age: 68,
    phone: '13700137003',
    address: '北京市西城区西长安街3号',
    medicalHistory: ['冠心病', '高血脂', '骨质疏松'],
    recentVisits: '2023-05-20',
    prescriptionCount: 12,
  },
];

// 模拟处方数据
const patientPrescriptions = {
  1: [
    { id: 101, date: '2023-05-10', doctor: '赵医生', herbs: ['黄芪', '当归', '白芍', '茯苓'], status: '已完成' },
    { id: 102, date: '2023-04-12', doctor: '赵医生', herbs: ['黄芪', '党参', '白术', '甘草'], status: '已完成' },
    { id: 103, date: '2023-03-15', doctor: '李医生', herbs: ['丹参', '赤芍', '川芎', '红花'], status: '已完成' },
  ],
  2: [
    { id: 201, date: '2023-05-15', doctor: '李医生', herbs: ['苏叶', '荆芥', '防风', '白芷'], status: '已完成' },
    { id: 202, date: '2023-04-20', doctor: '王医生', herbs: ['黄芩', '黄连', '栀子', '甘草'], status: '已完成' },
  ],
  3: [
    { id: 301, date: '2023-05-20', doctor: '张医生', herbs: ['丹参', '三七', '黄芪', '当归'], status: '进行中' },
    { id: 302, date: '2023-05-05', doctor: '张医生', herbs: ['黄芪', '党参', '白术', '茯苓'], status: '已完成' },
    { id: 303, date: '2023-04-18', doctor: '赵医生', herbs: ['杜仲', '续断', '狗脊', '补骨脂'], status: '已完成' },
  ],
};

function PatientRecords() {
  const [patients, setPatients] = useState(initialPatients);
  const [filteredPatients, setFilteredPatients] = useState(initialPatients);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openHistoryDialog, setOpenHistoryDialog] = useState(false);

  useEffect(() => {
    const results = patients.filter(patient =>
      patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.phone.includes(searchTerm)
    );
    setFilteredPatients(results);
  }, [searchTerm, patients]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setOpenDialog(true);
  };

  const handleOpenHistory = (patient) => {
    setSelectedPatient(patient);
    setOpenHistoryDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleCloseHistoryDialog = () => {
    setOpenHistoryDialog(false);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom component="div" sx={{ mb: 4 }}>
        患者档案管理
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">患者列表</Typography>
                <Box display="flex" alignItems="center">
                  <TextField
                    label="搜索患者"
                    variant="outlined"
                    size="small"
                    value={searchTerm}
                    onChange={handleSearch}
                    InputProps={{
                      startAdornment: <Search color="action" sx={{ mr: 1 }} />,
                    }}
                  />
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<Add />}
                    sx={{ ml: 2 }}
                  >
                    新增患者
                  </Button>
                </Box>
              </Box>

              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>姓名</TableCell>
                      <TableCell>性别</TableCell>
                      <TableCell>年龄</TableCell>
                      <TableCell>联系电话</TableCell>
                      <TableCell>病史</TableCell>
                      <TableCell>最近就诊</TableCell>
                      <TableCell>处方数量</TableCell>
                      <TableCell>操作</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredPatients.map((patient) => (
                      <TableRow key={patient.id}>
                        <TableCell>{patient.name}</TableCell>
                        <TableCell>{patient.gender}</TableCell>
                        <TableCell>{patient.age}</TableCell>
                        <TableCell>{patient.phone}</TableCell>
                        <TableCell>
                          {patient.medicalHistory.map((item, index) => (
                            <Chip
                              key={index}
                              label={item}
                              size="small"
                              sx={{ mr: 0.5, mb: 0.5 }}
                            />
                          ))}
                        </TableCell>
                        <TableCell>{patient.recentVisits}</TableCell>
                        <TableCell>{patient.prescriptionCount}</TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleSelectPatient(patient)}
                          >
                            <Visibility fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="secondary"
                            onClick={() => handleOpenHistory(patient)}
                          >
                            <ContentPaste fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 患者详情对话框 */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          患者详细信息
          <IconButton
            aria-label="close"
            onClick={handleCloseDialog}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
            }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedPatient && (
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="subtitle1">姓名：{selectedPatient.name}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle1">性别：{selectedPatient.gender}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle1">年龄：{selectedPatient.age}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle1">联系电话：{selectedPatient.phone}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle1">住址：{selectedPatient.address}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle1">
                  病史：
                  {selectedPatient.medicalHistory.map((item, index) => (
                    <Chip
                      key={index}
                      label={item}
                      size="small"
                      sx={{ ml: 1 }}
                    />
                  ))}
                </Typography>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="primary">
            关闭
          </Button>
          <Button color="secondary" startIcon={<Edit />}>
            编辑
          </Button>
        </DialogActions>
      </Dialog>

      {/* 处方历史对话框 */}
      <Dialog open={openHistoryDialog} onClose={handleCloseHistoryDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          处方历史记录 - {selectedPatient?.name}
          <IconButton
            aria-label="close"
            onClick={handleCloseHistoryDialog}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
            }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedPatient && (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>日期</TableCell>
                    <TableCell>医师</TableCell>
                    <TableCell>处方药材</TableCell>
                    <TableCell>状态</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {patientPrescriptions[selectedPatient.id]?.map((prescription) => (
                    <TableRow key={prescription.id}>
                      <TableCell>{prescription.date}</TableCell>
                      <TableCell>{prescription.doctor}</TableCell>
                      <TableCell>
                        {prescription.herbs.map((herb, index) => (
                          <Chip
                            key={index}
                            label={herb}
                            size="small"
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={prescription.status}
                          color={prescription.status === '已完成' ? 'success' : 'warning'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseHistoryDialog} color="primary">
            关闭
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default PatientRecords; 