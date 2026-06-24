import React, { useState } from 'react';
import {
  Container,
  Typography,
  Grid,
  Paper,
  TextField,
  Button,
  Card,
  CardContent,
  CardMedia,
  Box,
  Stepper,
  Step,
  StepLabel,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Search,
  QrCode,
  Agriculture,
  LocalShipping,
  Inventory,
  VerifiedUser,
  Lock,
  Timeline,
  CloudUpload,
  Check,
} from '@mui/icons-material';

// 模拟区块链溯源数据
const traceabilityData = {
  '20230501001': {
    id: '20230501001',
    name: '西洋参',
    origin: '吉林省集安市',
    producer: '吉林参茸有限公司',
    harvestDate: '2023-02-15',
    batchNumber: 'XYS-2023-0215-A',
    testingResults: '合格',
    image: 'https://via.placeholder.com/400x200?text=西洋参',
    blocks: [
      {
        timestamp: '2023-02-15 09:30:25',
        location: '吉林省集安市',
        operation: '采收',
        operator: '张农民',
        data: '西洋参采收，质量良好，总重量50kg',
        hash: '0x8f7d8b6a5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f',
      },
      {
        timestamp: '2023-02-16 14:20:10',
        location: '吉林省集安市',
        operation: '初加工',
        operator: '李加工',
        data: '西洋参清洗，切片，烘干，包装',
        hash: '0x7e6f5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e',
      },
      {
        timestamp: '2023-02-20 08:45:30',
        location: '吉林省长春市',
        operation: '质检',
        operator: '王质检',
        data: '西洋参成分检测，合格',
        hash: '0x6d5e4f3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e',
      },
      {
        timestamp: '2023-03-05 10:15:45',
        location: '北京市丰台区',
        operation: '入库',
        operator: '赵仓管',
        data: '西洋参入库，仓库编号A-123',
        hash: '0x5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d',
      },
      {
        timestamp: '2023-05-01 11:30:00',
        location: '北京市海淀区',
        operation: '销售',
        operator: '钱店长',
        data: '西洋参销售至终端药店',
        hash: '0x4b3a2c1d0e9f8a7b6c5d4e3f2g1h0i9j8k7l6m5n',
      },
    ]
  },
  '20230425002': {
    id: '20230425002',
    name: '当归',
    origin: '甘肃省定西市',
    producer: '甘肃中药材种植基地',
    harvestDate: '2022-10-10',
    batchNumber: 'DG-2022-1010-B',
    testingResults: '合格',
    image: 'https://via.placeholder.com/400x200?text=当归',
    blocks: [
      {
        timestamp: '2022-10-10 08:15:20',
        location: '甘肃省定西市',
        operation: '采收',
        operator: '李农民',
        data: '当归采收，质量良好，总重量100kg',
        hash: '0xa1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
      },
      {
        timestamp: '2022-10-12 13:40:35',
        location: '甘肃省定西市',
        operation: '初加工',
        operator: '王加工',
        data: '当归清洗，切片，烘干，包装',
        hash: '0xb2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0a1',
      },
      {
        timestamp: '2022-10-25 09:30:15',
        location: '甘肃省兰州市',
        operation: '质检',
        operator: '张质检',
        data: '当归成分检测，合格',
        hash: '0xc3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0a1b2',
      },
      {
        timestamp: '2022-11-10 14:25:40',
        location: '北京市丰台区',
        operation: '入库',
        operator: '赵仓管',
        data: '当归入库，仓库编号B-456',
        hash: '0xd4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0a1b2c3',
      },
      {
        timestamp: '2023-04-25 16:10:50',
        location: '北京市朝阳区',
        operation: '销售',
        operator: '孙店长',
        data: '当归销售至终端药店',
        hash: '0xe5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0a1b2c3d4',
      },
    ]
  }
};

function TraceabilitySystem() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentBlock, setCurrentBlock] = useState(null);

  const handleSearch = () => {
    const result = traceabilityData[searchTerm];
    setSearchResult(result || null);
    
    if (result) {
      setActiveStep(0);
    }
  };

  const handleBlockClick = (block) => {
    setCurrentBlock(block);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleStepChange = (step) => {
    setActiveStep(step);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
        中药溯源系统
      </Typography>

      <Paper sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="输入产品溯源码"
              variant="outlined"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="例如: 20230501001"
              InputProps={{
                startAdornment: <QrCode color="action" sx={{ mr: 1 }} />,
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<Search />}
              onClick={handleSearch}
              sx={{ mr: 2 }}
            >
              查询溯源信息
            </Button>
            <Button
              variant="outlined"
              startIcon={<CloudUpload />}
            >
              上传新产品
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {searchResult && (
        <Grid container spacing={4}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardMedia
                component="img"
                height="200"
                image={searchResult.image}
                alt={searchResult.name}
              />
              <CardContent>
                <Typography variant="h5" component="div" gutterBottom>
                  {searchResult.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>产品批次:</strong> {searchResult.batchNumber}
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>产地:</strong> {searchResult.origin}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>采收日期:</strong> {searchResult.harvestDate}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2">
                      <strong>生产商:</strong> {searchResult.producer}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>质检结果:</strong>
                      <Chip
                        label={searchResult.testingResults}
                        color="success"
                        size="small"
                        sx={{ ml: 1 }}
                      />
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
            <Paper sx={{ p: 2, mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                区块链信息
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Lock color="primary" sx={{ mr: 1 }} />
                <Typography variant="body2">
                  本溯源信息使用区块链技术存储，防篡改、可追溯
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <VerifiedUser color="success" sx={{ mr: 1 }} />
                <Typography variant="body2">
                  所有记录均经过验证确认并加盖数字签名
                </Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                溯源链路
              </Typography>
              <Stepper activeStep={activeStep} orientation="vertical">
                {searchResult.blocks.map((block, index) => (
                  <Step key={index}>
                    <StepLabel
                      onClick={() => handleStepChange(index)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <Typography variant="subtitle1">{block.operation}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {block.timestamp}
                        </Typography>
                      </Box>
                    </StepLabel>
                    {activeStep === index && (
                      <Box sx={{ ml: 3, mt: 1, mb: 2 }}>
                        <List dense>
                          <ListItem>
                            <ListItemIcon>
                              <Timeline fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary="操作时间"
                              secondary={block.timestamp}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemIcon>
                              <Agriculture fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary="操作人员"
                              secondary={block.operator}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemIcon>
                              <LocalShipping fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary="操作地点"
                              secondary={block.location}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemIcon>
                              <Inventory fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                              primary="操作内容"
                              secondary={block.data}
                            />
                          </ListItem>
                        </List>
                        <Box sx={{ mt: 1, textAlign: 'right' }}>
                          <Button
                            variant="outlined"
                            size="small"
                            color="primary"
                            onClick={() => handleBlockClick(block)}
                          >
                            查看区块详情
                          </Button>
                        </Box>
                      </Box>
                    )}
                  </Step>
                ))}
              </Stepper>
            </Paper>
          </Grid>
        </Grid>
      )}

      {!searchResult && searchTerm && (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="error" gutterBottom>
            未找到相关溯源信息
          </Typography>
          <Typography variant="body1">
            请检查溯源码是否正确，或尝试其他产品的溯源码
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            示例溯源码: 20230501001, 20230425002
          </Typography>
        </Paper>
      )}

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md">
        <DialogTitle>区块详情信息</DialogTitle>
        <DialogContent>
          {currentBlock && (
            <>
              <DialogContentText component="div">
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  区块哈希值: <code>{currentBlock.hash}</code>
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2">
                      <strong>时间戳:</strong> {currentBlock.timestamp}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2">
                      <strong>操作地点:</strong> {currentBlock.location}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2">
                      <strong>操作类型:</strong> {currentBlock.operation}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2">
                      <strong>操作人员:</strong> {currentBlock.operator}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2">
                      <strong>数据内容:</strong> {currentBlock.data}
                    </Typography>
                  </Grid>
                </Grid>
              </DialogContentText>
              <Box sx={{ mt: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="caption" display="block" gutterBottom>
                  区块链验证信息
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <Check color="success" fontSize="small" sx={{ mr: 1 }} />
                  <Typography variant="body2">
                    数字签名已验证
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <Check color="success" fontSize="small" sx={{ mr: 1 }} />
                  <Typography variant="body2">
                    区块数据完整性已验证
                  </Typography>
                </Box>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default TraceabilitySystem; 