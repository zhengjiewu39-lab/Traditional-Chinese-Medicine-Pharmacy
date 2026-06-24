import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  Grid,
  Paper,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Alert,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from '@mui/material';
import {
  Upload as UploadIcon,
  CheckCircle as CheckIcon,
  MedicalServices as MedicalIcon,
  HealthAndSafety as HealthIcon,
  Info as InfoIcon,
  CloudUpload as CloudUploadIcon,
  WarningAmber as WarningIcon,
  Search as SearchIcon,
  Print as PrintIcon,
  History as HistoryIcon,
  Assignment as AssignmentIcon,
  Save as SaveIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';

// 模拟中药数据库
const herbsDatabase = [
  { name: '黄芪', commonDosage: '10-30g', nature: '甘温', meridians: '肺、脾经', functions: '补气升阳，益卫固表，利水消肿，托毒排脓，生肌', contraindications: '表实邪盛、热病初起、阴虚火旺者慎用' },
  { name: '当归', commonDosage: '6-15g', nature: '甘温', meridians: '肝、心、脾经', functions: '补血活血，调经止痛，润肠通便', contraindications: '湿盛中满及大便溏泄者慎用' },
  { name: '白芍', commonDosage: '6-15g', nature: '苦酸微寒', meridians: '肝、脾经', functions: '养血敛阴，柔肝止痛，平抑肝阳', contraindications: '脾胃虚寒、腹泻者慎用' },
  { name: '川芎', commonDosage: '3-9g', nature: '辛温', meridians: '肝、胆、心包经', functions: '活血行气，祛风止痛', contraindications: '孕妇慎用' },
  { name: '熟地黄', commonDosage: '10-30g', nature: '甘温', meridians: '肝、肾经', functions: '滋阴补血，益精填髓', contraindications: '脾虚有湿、食少便溏者慎用' },
  { name: '陈皮', commonDosage: '3-10g', nature: '辛苦温', meridians: '肺、脾经', functions: '理气健脾，燥湿化痰', contraindications: '阴虚燥咳、津液亏损者慎用' },
  { name: '茯苓', commonDosage: '9-15g', nature: '甘淡平', meridians: '心、肺、脾、肾经', functions: '利水渗湿，健脾宁心', contraindications: '小便不利属于气化不利者慎用' },
  { name: '甘草', commonDosage: '3-10g', nature: '甘平', meridians: '心、肺、脾、胃经', functions: '益气补中，清热解毒，祛痰止咳，缓急止痛，调和诸药', contraindications: '水肿、高血压者慎用' },
  { name: '人参', commonDosage: '3-9g', nature: '甘微苦，微温', meridians: '脾、肺经', functions: '大补元气，复脉固脱，补脾益肺，生津安神', contraindications: '实证、热病初起慎用' },
  { name: '白术', commonDosage: '6-12g', nature: '甘，温', meridians: '脾、胃经', functions: '健脾益气，燥湿利水，止汗，安胎', contraindications: '阴虚内热、口渴便秘者慎用' },
  { name: '黄芩', commonDosage: '6-15g', nature: '苦，寒', meridians: '肺、胆、肝、大肠经', functions: '清热燥湿，泻火解毒，止血，安胎', contraindications: '脾胃虚寒、气虚体弱者慎用' },
  { name: '板蓝根', commonDosage: '15-60g', nature: '苦，寒', meridians: '心、肺、胃经', functions: '清热解毒，凉血，利咽', contraindications: '脾胃虚寒者慎用' },
  { name: '桂枝', commonDosage: '3-10g', nature: '辛、甘，温', meridians: '心、肺、膀胱经', functions: '发汗解表，温通经脉，助阳化气', contraindications: '阴虚发热、多汗者慎用' },
  { name: '麻黄', commonDosage: '3-9g', nature: '辛、微苦，温', meridians: '肺、膀胱经', functions: '发汗解表，宣肺平喘，利水消肿', contraindications: '外感风热、内有实热、阴虚盗汗者慎用' },
  { name: '枸杞子', commonDosage: '6-15g', nature: '甘，平', meridians: '肝、肾、肺经', functions: '滋补肝肾，益精明目，养血', contraindications: '脾虚有湿、大便溏泄者慎用' }
];

// 模拟处方历史记录
const prescriptionHistory = [
  {
    id: 1,
    patientInfo: { name: '张三', age: 45, gender: '男' },
    date: '2023-10-15',
    diagnosis: '气血两虚',
    prescription: '黄芪15g，当归10g，白芍10g，川芎6g，熟地黄15g，陈皮6g，茯苓10g，甘草6g',
    reviewer: '李医师',
    status: '已通过'
  },
  {
    id: 2,
    patientInfo: { name: '李四', age: 32, gender: '女' },
    date: '2023-10-16',
    diagnosis: '肝郁气滞',
    prescription: '柴胡10g，白芍12g，当归10g，陈皮6g，甘草5g，香附10g，枳壳6g',
    reviewer: '王药师',
    status: '需修改'
  },
  {
    id: 3,
    patientInfo: { name: '王五', age: 68, gender: '男' },
    date: '2023-10-17',
    diagnosis: '肾阳不足',
    prescription: '熟地黄15g，山药15g，牛膝10g，杜仲12g，枸杞子15g，淫羊藿10g，桂枝6g，甘草5g',
    reviewer: '李医师',
    status: '已通过'
  }
];

// 主组件
function PrescriptionReview() {
  const [prescription, setPrescription] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [loading, setLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState(null);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('input'); // 'input', 'review', 'history'
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  // 解析处方文本为药材列表
  const parsePrescription = (text) => {
    if (!text) return [];
    
    // 支持多种分隔符：逗号，中文逗号，顿号，空格，换行
    const herbs = text.split(/[,，、\s\n]+/).filter(item => item.trim());
    
    return herbs.map(herb => {
      // 尝试提取药材名称和剂量
      const match = herb.match(/^([\u4e00-\u9fa5]+)([0-9]+[gG]?)?$/);
      
      if (match) {
        const herbName = match[1];
        const dosage = match[2] || '';
        
        // 查找数据库中的药材信息
        const herbInfo = herbsDatabase.find(h => h.name === herbName);
        
        if (herbInfo) {
          return {
            ...herbInfo,
            dosage: dosage || herbInfo.commonDosage,
            validDosage: true,
            exists: true
          };
        } else {
          return {
            name: herbName,
            dosage: dosage,
            exists: false,
            validDosage: !!dosage
          };
        }
      } else {
        return {
          name: herb,
          exists: false,
          validDosage: false
        };
      }
    });
  };

  // 检查处方中药材剂量是否在合理范围
  const checkDosage = (herb) => {
    if (!herb.exists || !herb.commonDosage) return true;
    
    const dosageNum = parseInt(herb.dosage);
    const [min, max] = herb.commonDosage.split('-').map(d => parseInt(d));
    
    return dosageNum >= min && dosageNum <= max;
  };

  // 检查药材相互作用
  const checkInteractions = (herbs) => {
    const interactions = [];
    
    // 简单示例，实际应包含更全面的药物相互作用数据
    if (herbs.some(h => h.name === '麻黄') && herbs.some(h => h.name === '桂枝')) {
      interactions.push({
        herbs: ['麻黄', '桂枝'],
        effect: '发汗作用增强，易伤阴液',
        severity: 'medium'
      });
    }
    
    if (herbs.some(h => h.name === '黄芪') && herbs.some(h => h.name === '甘草')) {
      interactions.push({
        herbs: ['黄芪', '甘草'],
        effect: '同为补气药，大剂量同用可能导致水钠潴留',
        severity: 'low'
      });
    }
    
    return interactions;
  };

  // 分析处方功效
  const analyzePrescriptionEffects = (herbs) => {
    const validHerbs = herbs.filter(h => h.exists);
    
    // 检查处方中药物的属性统计
    const properties = {
      sweet: validHerbs.filter(h => h.nature.includes('甘')).length,
      bitter: validHerbs.filter(h => h.nature.includes('苦')).length,
      spicy: validHerbs.filter(h => h.nature.includes('辛')).length,
      sour: validHerbs.filter(h => h.nature.includes('酸')).length,
      salty: validHerbs.filter(h => h.nature.includes('咸')).length,
      cold: validHerbs.filter(h => h.nature.includes('寒')).length,
      cool: validHerbs.filter(h => h.nature.includes('凉')).length,
      neutral: validHerbs.filter(h => h.nature.includes('平')).length,
      warm: validHerbs.filter(h => h.nature.includes('温')).length,
      hot: validHerbs.filter(h => h.nature.includes('热')).length,
    };
    
    // 简化的功效分析逻辑
    const effects = [];
    
    if (properties.warm + properties.hot > properties.cold + properties.cool) {
      effects.push('温性为主，具有温阳作用');
    } else if (properties.cold + properties.cool > properties.warm + properties.hot) {
      effects.push('寒性为主，具有清热作用');
    } else {
      effects.push('寒热平衡，性质较为中和');
    }
    
    if (properties.sweet > 3) {
      effects.push('甘味较多，具有补益作用');
    }
    
    if (properties.bitter > 3) {
      effects.push('苦味较多，具有清泄作用');
    }
    
    if (properties.spicy > 3) {
      effects.push('辛味较多，具有发散作用');
    }
    
    if (validHerbs.some(h => h.functions.includes('补气'))) {
      effects.push('具有补气功效');
    }
    
    if (validHerbs.some(h => h.functions.includes('补血') || h.functions.includes('养血'))) {
      effects.push('具有补血功效');
    }
    
    if (validHerbs.some(h => h.functions.includes('活血'))) {
      effects.push('具有活血化瘀功效');
    }
    
    return effects;
  };

  // 审核处方
  const reviewPrescription = () => {
    try {
      setLoading(true);
      setError('');

      if (!prescription) {
        throw new Error('请输入处方内容');
      }

      // 解析处方
      const herbs = parsePrescription(prescription);
      
      if (herbs.length === 0) {
        throw new Error('未能识别任何中药材，请检查格式');
      }
      
      // 药材存在性检查
      const nonExistentHerbs = herbs.filter(h => !h.exists);
      
      // 剂量检查
      const invalidDosageHerbs = herbs.filter(h => !checkDosage(h));
      
      // 药物相互作用检查
      const interactions = checkInteractions(herbs);
      
      // 处方功效分析
      const effects = analyzePrescriptionEffects(herbs);
      
      // 生成审核结果
      const result = {
        herbs,
        nonExistentHerbs,
        invalidDosageHerbs,
        interactions,
        effects,
        patientInfo: {
          name: patientName || '未填写',
          age: patientAge || '未填写',
          gender: patientGender || '未填写',
        },
        diagnosis: diagnosis || '未填写',
        overallStatus: nonExistentHerbs.length > 0 || invalidDosageHerbs.length > 0 
          ? '需修改' 
          : interactions.some(i => i.severity === 'high')
            ? '需注意'
            : '建议通过'
      };
      
      setReviewResult(result);
      setViewMode('review');
    } catch (err) {
      console.error('处方审核失败:', err);
      setError(err.message || '处方审核失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 清除表单和结果
  const clearForm = () => {
    setPrescription('');
    setPatientName('');
    setPatientAge('');
    setPatientGender('');
    setDiagnosis('');
    setReviewResult(null);
    setError('');
    setViewMode('input');
  };

  // 显示历史记录详情
  const viewHistoryDetail = (item) => {
    setSelectedHistoryItem(item);
    setConfirmDialogOpen(true);
  };

  // 确认使用历史记录
  const confirmUseHistory = () => {
    if (selectedHistoryItem) {
      setPrescription(selectedHistoryItem.prescription);
      setPatientName(selectedHistoryItem.patientInfo.name);
      setPatientAge(selectedHistoryItem.patientInfo.age.toString());
      setPatientGender(selectedHistoryItem.patientInfo.gender);
      setDiagnosis(selectedHistoryItem.diagnosis);
      setConfirmDialogOpen(false);
      setViewMode('input');
    }
  };

  // 渲染处方输入表单
  const renderInputForm = () => {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          处方信息录入
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField
              label="患者姓名"
              fullWidth
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              disabled={loading}
              sx={{ mb: 2 }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="年龄"
              fullWidth
              type="number"
              value={patientAge}
              onChange={(e) => setPatientAge(e.target.value)}
              disabled={loading}
              sx={{ mb: 2 }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="gender-label">性别</InputLabel>
              <Select
                labelId="gender-label"
                value={patientGender}
                label="性别"
                onChange={(e) => setPatientGender(e.target.value)}
                disabled={loading}
              >
                <MenuItem value="男">男</MenuItem>
                <MenuItem value="女">女</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <TextField
          label="诊断"
          fullWidth
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          disabled={loading}
          sx={{ mb: 2 }}
        />

        <TextField
          label="处方内容"
          multiline
          rows={6}
          fullWidth
          value={prescription}
          onChange={(e) => setPrescription(e.target.value)}
          placeholder="例如：黄芪15g，当归10g，白芍10g，川芎6g，熟地黄15g，陈皮6g，茯苓10g，甘草6g"
          disabled={loading}
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
          <Button
            variant="outlined"
            onClick={clearForm}
            disabled={loading || (!prescription && !patientName && !patientAge && !patientGender && !diagnosis)}
          >
            清除
          </Button>
          <Box>
            <Button
              variant="outlined"
              onClick={() => setViewMode('history')}
              startIcon={<HistoryIcon />}
              sx={{ mr: 1 }}
              disabled={loading}
            >
              历史处方
            </Button>
            <Button
              variant="contained"
              onClick={reviewPrescription}
              disabled={loading || !prescription}
              startIcon={loading ? <CircularProgress size={20} /> : <HealthIcon />}
            >
              {loading ? '审核中...' : '审核处方'}
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>
    );
  };

  // 渲染审核结果
  const renderReviewResult = () => {
    if (!reviewResult) return null;

    const { herbs, nonExistentHerbs, invalidDosageHerbs, interactions, effects, patientInfo, diagnosis, overallStatus } = reviewResult;

    const getSeverityColor = (severity) => {
      switch (severity) {
        case 'high': return 'error';
        case 'medium': return 'warning';
        case 'low': return 'info';
        default: return 'default';
      }
    };

    const getStatusColor = (status) => {
      switch (status) {
        case '需修改': return 'error';
        case '需注意': return 'warning';
        case '建议通过': return 'success';
        default: return 'default';
      }
    };

    return (
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            处方审核结果
          </Typography>
          <Chip
            label={overallStatus}
            color={getStatusColor(overallStatus)}
          />
        </Box>
        <Divider sx={{ mb: 2 }} />

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  患者信息
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">姓名</Typography>
                    <Typography variant="body1">{patientInfo.name}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">年龄</Typography>
                    <Typography variant="body1">{patientInfo.age}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">性别</Typography>
                    <Typography variant="body1">{patientInfo.gender}</Typography>
                  </Grid>
                </Grid>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>诊断</Typography>
                <Typography variant="body1">{diagnosis}</Typography>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  处方组成
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>药材</TableCell>
                        <TableCell>剂量</TableCell>
                        <TableCell>性味</TableCell>
                        <TableCell>状态</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {herbs.map((herb, index) => (
                        <TableRow key={index}>
                          <TableCell>{herb.name}</TableCell>
                          <TableCell>{herb.dosage}</TableCell>
                          <TableCell>{herb.exists ? herb.nature : '未知'}</TableCell>
                          <TableCell>
                            {!herb.exists ? (
                              <Chip size="small" label="未知药材" color="error" />
                            ) : invalidDosageHerbs.includes(herb) ? (
                              <Chip size="small" label="剂量异常" color="warning" />
                            ) : (
                              <Chip size="small" label="正常" color="success" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            {nonExistentHerbs.length > 0 && (
              <Alert severity="error" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  未识别药材 ({nonExistentHerbs.length})
                </Typography>
                <Typography variant="body2">
                  {nonExistentHerbs.map(h => h.name).join('、')}
                </Typography>
              </Alert>
            )}

            {invalidDosageHerbs.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  剂量异常药材 ({invalidDosageHerbs.length})
                </Typography>
                <List dense>
                  {invalidDosageHerbs.map((herb, index) => (
                    <ListItem key={index}>
                      <ListItemText
                        primary={`${herb.name} ${herb.dosage}`}
                        secondary={`推荐剂量: ${herb.commonDosage}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Alert>
            )}

            {interactions.length > 0 && (
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    药物相互作用
                  </Typography>
                  <List dense>
                    {interactions.map((item, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <WarningIcon color={getSeverityColor(item.severity)} />
                        </ListItemIcon>
                        <ListItemText
                          primary={item.herbs.join(' + ')}
                          secondary={item.effect}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            )}

            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  处方功效分析
                </Typography>
                <List dense>
                  {effects.map((effect, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <CheckIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary={effect} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button
            variant="outlined"
            onClick={() => setViewMode('input')}
            sx={{ mr: 1 }}
          >
            返回编辑
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            color="primary"
          >
            保存处方
          </Button>
        </Box>
      </Paper>
    );
  };

  // 渲染历史处方记录
  const renderPrescriptionHistory = () => {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          历史处方记录
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>日期</TableCell>
                <TableCell>患者</TableCell>
                <TableCell>诊断</TableCell>
                <TableCell>处方</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {prescriptionHistory.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.date}</TableCell>
                  <TableCell>{`${item.patientInfo.name} (${item.patientInfo.age}岁 ${item.patientInfo.gender})`}</TableCell>
                  <TableCell>{item.diagnosis}</TableCell>
                  <TableCell>
                    <Tooltip title={item.prescription}>
                      <Typography
                        sx={{
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {item.prescription}
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={item.status}
                      color={item.status === '已通过' ? 'success' : 'warning'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => viewHistoryDetail(item)}>
                      <SearchIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Button
            variant="outlined"
            onClick={() => setViewMode('input')}
          >
            返回
          </Button>
        </Box>
      </Paper>
    );
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 2, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          处方审理系统
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          辅助药师完成中药处方审核，提高处方合理性和安全性
        </Typography>
      </Box>

      {viewMode === 'input' && renderInputForm()}
      {viewMode === 'review' && renderReviewResult()}
      {viewMode === 'history' && renderPrescriptionHistory()}

      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
      >
        <DialogTitle>使用历史处方</DialogTitle>
        <DialogContent>
          <DialogContentText>
            是否将此历史处方信息加载到当前表单中？这将覆盖您当前输入的信息。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>取消</Button>
          <Button onClick={confirmUseHistory} variant="contained">确认</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default PrescriptionReview; 