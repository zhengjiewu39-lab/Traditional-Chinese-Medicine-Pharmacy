import React, { useState } from 'react';
import {
  Container,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Box,
  TextField,
  InputAdornment,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Search,
  Add,
  CheckCircle,
  Cancel,
  WarningAmber,
  Assignment,
  Science,
  Timeline,
  SaveAlt,
  SmartToy,
} from '@mui/icons-material';

// 模拟质量检测数据
const qualityRecords = [
  {
    id: 'QC-20230510-001',
    product: '六味地黄丸',
    batch: 'LW-20230425-A',
    date: '2023-05-10',
    inspector: '张质检',
    result: '合格',
    metrics: {
      appearance: 96,
      weight: 98,
      uniformity: 95,
      humidity: 92,
      activeIngredients: 94,
      impurity: 97,
    },
    notes: '各项指标均符合质量标准要求'
  },
  {
    id: 'QC-20230508-002',
    product: '藿香正气水',
    batch: 'HX-20230420-B',
    date: '2023-05-08',
    inspector: '李质检',
    result: '合格',
    metrics: {
      appearance: 95,
      weight: 97,
      uniformity: 94,
      humidity: 96,
      activeIngredients: 93,
      impurity: 95,
    },
    notes: '所有测试均通过'
  },
  {
    id: 'QC-20230505-003',
    product: '板蓝根颗粒',
    batch: 'BLG-20230415-C',
    date: '2023-05-05',
    inspector: '王质检',
    result: '不合格',
    metrics: {
      appearance: 88,
      weight: 92,
      uniformity: 76,
      humidity: 85,
      activeIngredients: 82,
      impurity: 64,
    },
    notes: '均匀度和杂质含量不符合标准，需返工处理'
  },
  {
    id: 'QC-20230502-004',
    product: '人参片',
    batch: 'RS-20230410-A',
    date: '2023-05-02',
    inspector: '赵质检',
    result: '合格',
    metrics: {
      appearance: 98,
      weight: 96,
      uniformity: 97,
      humidity: 95,
      activeIngredients: 99,
      impurity: 96,
    },
    notes: '各项指标均优良'
  },
  {
    id: 'QC-20230501-005',
    product: '复方丹参片',
    batch: 'FD-20230405-B',
    date: '2023-05-01',
    inspector: '钱质检',
    result: '待复检',
    metrics: {
      appearance: 94,
      weight: 95,
      uniformity: 89,
      humidity: 87,
      activeIngredients: 91,
      impurity: 88,
    },
    notes: '湿度和均匀度稍有偏差，需复检确认'
  },
];

// 模拟SOP数据
const sopDocuments = [
  { id: 'SOP-001', title: '中药材验收标准操作规程', department: '质量部', version: '2.3', date: '2023-01-15' },
  { id: 'SOP-002', title: '中药饮片炮制标准操作规程', department: '生产部', version: '3.1', date: '2023-02-10' },
  { id: 'SOP-003', title: '中成药生产标准操作规程', department: '生产部', version: '2.5', date: '2023-01-20' },
  { id: 'SOP-004', title: '产品检验标准操作规程', department: '质量部', version: '3.2', date: '2023-03-05' },
  { id: 'SOP-005', title: '药材存储标准操作规程', department: '仓储部', version: '2.0', date: '2023-02-28' },
];

function QualityManagement() {
  const [tabValue, setTabValue] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleOpenDetails = (record) => {
    setSelectedRecord(record);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleAiAnalysis = () => {
    setIsAnalyzing(true);
    
    // 模拟AI分析过程
    setTimeout(() => {
      setIsAnalyzing(false);
      setAiAnalysisResult({
        summary: '产品质量整体良好，存在少量可改进空间',
        issues: [
          '板蓝根颗粒的均匀度和杂质含量问题突出，建议优化生产工艺',
          '复方丹参片的湿度管理需要加强，可能与存储环境有关'
        ],
        recommendations: [
          '调整板蓝根颗粒的粉碎和筛选工艺',
          '提高仓库湿度控制能力',
          '对质检员进行进一步培训，提高检测一致性'
        ],
        trend: '近30天质量合格率为80%，较上月提升5%'
      });
    }, 2000);
  };

  // 过滤记录
  const filteredRecords = qualityRecords.filter(record => 
    record.product.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.batch.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 过滤SOP文档
  const filteredSops = sopDocuments.filter(sop => 
    sop.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sop.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom component="div" sx={{ mb: 4 }}>
        质量管理系统
      </Typography>
      
      <Paper sx={{ mb: 4 }}>
        <Tabs value={tabValue} onChange={handleTabChange} centered>
          <Tab label="质量检测记录" icon={<Science />} iconPosition="start" />
          <Tab label="标准操作规程" icon={<Assignment />} iconPosition="start" />
          <Tab label="AI质量分析" icon={<SmartToy />} iconPosition="start" />
        </Tabs>
      </Paper>

      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between' }}>
        <TextField
          label="搜索"
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={handleSearch}
          sx={{ width: '300px' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
        <Button
          variant="contained"
          color="primary"
          startIcon={<Add />}
          sx={{ display: tabValue === 2 ? 'none' : 'flex' }}
        >
          {tabValue === 0 ? '新增检测记录' : '添加SOP文档'}
        </Button>
      </Box>

      {/* 质量检测记录 */}
      {tabValue === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>检测ID</TableCell>
                <TableCell>产品名称</TableCell>
                <TableCell>生产批次</TableCell>
                <TableCell>检测日期</TableCell>
                <TableCell>检测员</TableCell>
                <TableCell>结果</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{record.id}</TableCell>
                  <TableCell>{record.product}</TableCell>
                  <TableCell>{record.batch}</TableCell>
                  <TableCell>{record.date}</TableCell>
                  <TableCell>{record.inspector}</TableCell>
                  <TableCell>
                    <Chip
                      label={record.result}
                      color={
                        record.result === '合格' ? 'success' :
                        record.result === '不合格' ? 'error' : 'warning'
                      }
                      size="small"
                      icon={
                        record.result === '合格' ? <CheckCircle /> :
                        record.result === '不合格' ? <Cancel /> : <WarningAmber />
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      onClick={() => handleOpenDetails(record)}
                    >
                      详情
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* SOP文档 */}
      {tabValue === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>文档编号</TableCell>
                <TableCell>文档标题</TableCell>
                <TableCell>部门</TableCell>
                <TableCell>版本</TableCell>
                <TableCell>更新日期</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSops.map((sop) => (
                <TableRow key={sop.id}>
                  <TableCell>{sop.id}</TableCell>
                  <TableCell>{sop.title}</TableCell>
                  <TableCell>{sop.department}</TableCell>
                  <TableCell>{sop.version}</TableCell>
                  <TableCell>{sop.date}</TableCell>
                  <TableCell>
                    <Button
                      size="small"
                      startIcon={<SaveAlt />}
                    >
                      下载
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* AI质量分析 */}
      {tabValue === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                AI质量趋势分析
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                利用人工智能分析最近的质量检测数据，提供质量趋势和改进建议
              </Typography>
              {!aiAnalysisResult && !isAnalyzing && (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<Timeline />}
                  onClick={handleAiAnalysis}
                >
                  开始分析
                </Button>
              )}
              {isAnalyzing && (
                <Box sx={{ width: '100%', mt: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    正在分析中，请稍候...
                  </Typography>
                  <LinearProgress />
                </Box>
              )}
            </Paper>
          </Grid>
          
          {aiAnalysisResult && (
            <>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" color="primary" gutterBottom>
                      分析总结
                    </Typography>
                    <Typography variant="body1" paragraph>
                      {aiAnalysisResult.summary}
                    </Typography>
                    <Typography variant="h6" color="primary" gutterBottom>
                      发现的问题
                    </Typography>
                    <Box component="ul" sx={{ pl: 2 }}>
                      {aiAnalysisResult.issues.map((issue, index) => (
                        <Typography component="li" key={index} variant="body2" paragraph>
                          {issue}
                        </Typography>
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" color="primary" gutterBottom>
                      改进建议
                    </Typography>
                    <Box component="ol" sx={{ pl: 2 }}>
                      {aiAnalysisResult.recommendations.map((rec, index) => (
                        <Typography component="li" key={index} variant="body2" paragraph>
                          {rec}
                        </Typography>
                      ))}
                    </Box>
                    <Typography variant="h6" color="primary" gutterBottom>
                      质量趋势
                    </Typography>
                    <Typography variant="body1">
                      {aiAnalysisResult.trend}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </>
          )}
        </Grid>
      )}

      {/* 检测详情对话框 */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        {selectedRecord && (
          <>
            <DialogTitle>
              质量检测详情 - {selectedRecord.id}
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1">
                    产品: {selectedRecord.product}
                  </Typography>
                  <Typography variant="subtitle1">
                    批次: {selectedRecord.batch}
                  </Typography>
                  <Typography variant="subtitle1">
                    检测日期: {selectedRecord.date}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1">
                    检测员: {selectedRecord.inspector}
                  </Typography>
                  <Typography variant="subtitle1">
                    结果: 
                    <Chip
                      label={selectedRecord.result}
                      color={
                        selectedRecord.result === '合格' ? 'success' :
                        selectedRecord.result === '不合格' ? 'error' : 'warning'
                      }
                      size="small"
                      sx={{ ml: 1 }}
                    />
                  </Typography>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>
                    检测指标:
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" gutterBottom>
                          外观: {selectedRecord.metrics.appearance}%
                        </Typography>
                        <LinearProgress 
                          variant="determinate" 
                          value={selectedRecord.metrics.appearance} 
                          color={selectedRecord.metrics.appearance >= 90 ? 'success' : 
                                selectedRecord.metrics.appearance >= 80 ? 'warning' : 'error'}
                        />
                      </Box>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" gutterBottom>
                          重量: {selectedRecord.metrics.weight}%
                        </Typography>
                        <LinearProgress 
                          variant="determinate" 
                          value={selectedRecord.metrics.weight}
                          color={selectedRecord.metrics.weight >= 90 ? 'success' : 
                                 selectedRecord.metrics.weight >= 80 ? 'warning' : 'error'}
                        />
                      </Box>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" gutterBottom>
                          均匀度: {selectedRecord.metrics.uniformity}%
                        </Typography>
                        <LinearProgress 
                          variant="determinate" 
                          value={selectedRecord.metrics.uniformity}
                          color={selectedRecord.metrics.uniformity >= 90 ? 'success' : 
                                 selectedRecord.metrics.uniformity >= 80 ? 'warning' : 'error'}
                        />
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" gutterBottom>
                          湿度: {selectedRecord.metrics.humidity}%
                        </Typography>
                        <LinearProgress 
                          variant="determinate" 
                          value={selectedRecord.metrics.humidity}
                          color={selectedRecord.metrics.humidity >= 90 ? 'success' : 
                                 selectedRecord.metrics.humidity >= 80 ? 'warning' : 'error'}
                        />
                      </Box>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" gutterBottom>
                          有效成分: {selectedRecord.metrics.activeIngredients}%
                        </Typography>
                        <LinearProgress 
                          variant="determinate" 
                          value={selectedRecord.metrics.activeIngredients}
                          color={selectedRecord.metrics.activeIngredients >= 90 ? 'success' : 
                                 selectedRecord.metrics.activeIngredients >= 80 ? 'warning' : 'error'}
                        />
                      </Box>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" gutterBottom>
                          杂质: {selectedRecord.metrics.impurity}%
                        </Typography>
                        <LinearProgress 
                          variant="determinate" 
                          value={selectedRecord.metrics.impurity}
                          color={selectedRecord.metrics.impurity >= 90 ? 'success' : 
                                 selectedRecord.metrics.impurity >= 80 ? 'warning' : 'error'}
                        />
                      </Box>
                    </Grid>
                  </Grid>
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="subtitle1" gutterBottom>
                    备注:
                  </Typography>
                  <Typography variant="body2">
                    {selectedRecord.notes}
                  </Typography>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>关闭</Button>
              <Button variant="contained" color="primary">
                导出报告
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
}

export default QualityManagement; 