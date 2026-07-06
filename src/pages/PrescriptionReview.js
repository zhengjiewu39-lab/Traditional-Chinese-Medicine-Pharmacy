import React, { useState, useEffect, useCallback } from 'react';
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
  DialogTitle,
  TablePagination,
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

import { prescriptionApi, herbsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import CdssDualTrackPanel from '../components/CdssDualTrackPanel';

function rxToText(rx) {
  if (rx.prescriptionText) return rx.prescriptionText;
  return (rx.herbs || []).map((h) => `${h.name}${h.dosage || ''}`).join('，');
}

function statusChipColor(status) {
  if (['已完成', '待取药', '已通过', '已审核'].includes(status)) return 'success';
  if (['待审核', '建议复核', '需注意'].includes(status)) return 'warning';
  if (['需修改', '已驳回'].includes(status)) return 'error';
  return 'default';
}

// 主组件
function PrescriptionReview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [herbsDatabase, setHerbsDatabase] = useState([]);
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
  const [savedRx, setSavedRx] = useState(null);
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyPage, setHistoryPage] = useState(0);
  const [historyRowsPerPage, setHistoryRowsPerPage] = useState(20);
  const [selectedPatientId, setSelectedPatientId] = useState(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await prescriptionApi.getAllPrescriptions();
      const sorted = (res.data || []).sort((a, b) => (a.date < b.date ? 1 : -1));
      setHistoryList(sorted);
    } catch (e) {
      console.error(e);
      setError('加载历史处方失败，请确认后端已启动');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'history') loadHistory();
  }, [viewMode, loadHistory]);

  useEffect(() => {
    herbsApi.getAllHerbs()
      .then((res) => setHerbsDatabase(res.data || []))
      .catch(() => setHerbsDatabase([]));
  }, []);

  const handleSavePrescription = async (approve = false) => {
    try {
      setLoading(true);
      const herbs = parsePrescription(prescription).map(h => ({
        name: h.name,
        dosage: h.dosage || h.commonDosage || '10g',
      }));
      const created = await prescriptionApi.createPrescription({
        patientId: selectedPatientId || undefined,
        patientName: patientName || '未登记',
        doctor: user?.name || '医生',
        diagnosis,
        herbs,
        prescriptionText: prescription,
        patientAge: patientAge ? Number(patientAge) : undefined,
        patientGender,
        reviewScore: reviewResult?.score ?? reviewResult?.apiAnalysis?.score,
      });
      let final = created.data;
      if (approve) {
        const approved = await prescriptionApi.approvePrescription(final.id, { reviewer: user?.name, reviewScore: final.reviewScore });
        final = approved.data;
      }
      setSavedRx(final);
    } catch (e) {
      setError(e.response?.data?.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

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

  const buildReviewResult = (text, apiResult, meta = {}) => {
    const herbs = parsePrescription(text);
    const nonExistentHerbs = herbs.filter((h) => !h.exists);
    const invalidDosageHerbs = herbs.filter((h) => !checkDosage(h));
    const interactions = checkInteractions(herbs);
    const effects = analyzePrescriptionEffects(herbs);
    const data = apiResult?.data ?? apiResult;

    return {
      herbs,
      nonExistentHerbs,
      invalidDosageHerbs,
      interactions,
      effects,
      apiAnalysis: data,
      cdss: data,
      patientInfo: meta.patientInfo || { name: '未填写', age: '未填写', gender: '未填写' },
      diagnosis: meta.diagnosis || '未填写',
      overallStatus: data?.joint?.status || data?.status || (nonExistentHerbs.length > 0 || invalidDosageHerbs.length > 0
        ? '需修改'
        : interactions.some((i) => i.severity === 'high')
          ? '需注意'
          : '建议通过'),
      score: data?.joint?.score ?? data?.score,
      warnings: data?.warnings || [],
      suggestions: data?.suggestions || [],
    };
  };

  // 分析处方功效
  const analyzePrescriptionEffects = (herbs) => {
    const validHerbs = herbs.filter(h => h.exists);
    
    // 检查处方中药物的属性统计
    const properties = {
      sweet: validHerbs.filter(h => h.nature?.includes('甘')).length,
      bitter: validHerbs.filter(h => h.nature?.includes('苦')).length,
      spicy: validHerbs.filter(h => h.nature?.includes('辛')).length,
      sour: validHerbs.filter(h => h.nature?.includes('酸')).length,
      salty: validHerbs.filter(h => h.nature?.includes('咸')).length,
      cold: validHerbs.filter(h => h.nature?.includes('寒')).length,
      cool: validHerbs.filter(h => h.nature?.includes('凉')).length,
      neutral: validHerbs.filter(h => h.nature?.includes('平')).length,
      warm: validHerbs.filter(h => h.nature?.includes('温')).length,
      hot: validHerbs.filter(h => h.nature?.includes('热')).length,
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
    
    if (validHerbs.some(h => h.functions?.includes('补气'))) {
      effects.push('具有补气功效');
    }
    
    if (validHerbs.some(h => h.functions?.includes('补血') || h.functions?.includes('养血'))) {
      effects.push('具有补血功效');
    }
    
    if (validHerbs.some(h => h.functions?.includes('活血'))) {
      effects.push('具有活血化瘀功效');
    }
    
    return effects;
  };

  // 审核处方
  const reviewPrescription = async () => {
    try {
      setLoading(true);
      setError('');

      if (!prescription) {
        throw new Error('请输入处方内容');
      }

      const apiResult = await prescriptionApi.analyzePrescriptionCdss({
        prescription,
        patientAge: patientAge ? Number(patientAge) : undefined,
        patientGender,
        diagnosis,
      });

      setReviewResult(buildReviewResult(prescription, apiResult, {
        patientInfo: {
          name: patientName || '未填写',
          age: patientAge || '未填写',
          gender: patientGender || '未填写',
        },
        diagnosis: diagnosis || '未填写',
      }));
      setViewMode('review');
    } catch (err) {
      console.error('处方审核失败:', err);
      setError(err.response?.data?.message || err.message || '处方审核失败，请重试');
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
  const applyHistoryItem = (item) => {
    const text = rxToText(item);
    setPrescription(text);
    setPatientName(item.patientName || '');
    setPatientAge(item.patientAge != null ? String(item.patientAge) : '');
    setPatientGender(item.patientGender || '');
    setDiagnosis(item.diagnosis || '');
    setSelectedPatientId(item.patientId || null);
    setReviewResult(null);
    setViewMode('input');
  };

  const confirmUseHistory = () => {
    if (selectedHistoryItem) {
      applyHistoryItem(selectedHistoryItem);
      setConfirmDialogOpen(false);
    }
  };

  const loadHistoryAndReview = async (item) => {
    applyHistoryItem(item);
    setLoading(true);
    setError('');
    try {
      const apiResult = await prescriptionApi.analyzePrescriptionCdss({
        prescription: rxToText(item),
        patientAge: item.patientAge,
        patientGender: item.patientGender,
        diagnosis: item.diagnosis,
      });
      setReviewResult(buildReviewResult(rxToText(item), apiResult, {
        patientInfo: {
          name: item.patientName || '未填写',
          age: item.patientAge ?? '未填写',
          gender: item.patientGender || '未填写',
        },
        diagnosis: item.diagnosis || '未填写',
      }));
      setViewMode('review');
    } catch (err) {
      setError(err.response?.data?.message || 'ADR 评估失败');
      setViewMode('input');
    } finally {
      setLoading(false);
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
              {loading ? 'ADR 评估中...' : '运行 ADR 预防评估'}
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

    const {
      herbs = [],
      nonExistentHerbs = [],
      invalidDosageHerbs = [],
      interactions = [],
      effects = [],
      patientInfo = {},
      diagnosis = '未填写',
      overallStatus = '—',
    } = reviewResult;

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
            不良反应预防评估结果
          </Typography>
          <Chip
            label={overallStatus}
            color={getStatusColor(overallStatus)}
          />
        </Box>
        {reviewResult?.score != null && (
          <Chip label={`ADR 综合评分 ${reviewResult.score}`} color="primary" sx={{ mr: 1 }} />
        )}
        <CdssDualTrackPanel cdss={reviewResult?.cdss} />
        {reviewResult?.apiAnalysis?.warnings?.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2, mt: 1 }}>
            {(reviewResult.apiAnalysis.warnings || reviewResult.warnings || []).slice(0, 3).map((w, i) => (
              <Typography key={i} variant="body2">{w.message || w}</Typography>
            ))}
          </Alert>
        )}
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

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3, flexWrap: 'wrap', gap: 1 }}>
          <Button variant="outlined" onClick={() => setViewMode('input')}>返回编辑</Button>
          <Button variant="outlined" startIcon={<SaveIcon />} onClick={() => handleSavePrescription(false)}>保存待审</Button>
          <Button variant="contained" startIcon={<CheckIcon />} color="success" onClick={() => handleSavePrescription(true)}>
            审方通过并发码
          </Button>
        </Box>
        {savedRx?.pickupCode && (
          <Alert severity="success" sx={{ mt: 2 }}>
            取药码：<strong>{savedRx.pickupCode}</strong>
            <Button size="small" sx={{ ml: 2 }} onClick={() => navigate(`/billing?code=${savedRx.pickupCode}`)}>去收银</Button>
          </Alert>
        )}
      </Paper>
    );
  };

  // 渲染历史处方记录
  const renderPrescriptionHistory = () => {
    const filtered = historyList.filter((item) => {
      if (!historySearch.trim()) return true;
      const q = historySearch.trim();
      return (
        item.patientName?.includes(q)
        || item.diagnosis?.includes(q)
        || rxToText(item).includes(q)
        || String(item.patientId).includes(q)
      );
    });
    const paged = filtered.slice(
      historyPage * historyRowsPerPage,
      historyPage * historyRowsPerPage + historyRowsPerPage
    );

    return (
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6">历史处方记录</Typography>
          <Chip label={`共 ${filtered.length} 条`} size="small" />
        </Box>
        <TextField
          size="small"
          placeholder="搜索患者 / 诊断 / 处方"
          value={historySearch}
          onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(0); }}
          sx={{ mb: 2, width: 320 }}
          InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} /> }}
        />
        <Divider sx={{ mb: 2 }} />

        {historyLoading ? (
          <CircularProgress size={28} />
        ) : (
          <>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>日期</TableCell>
                    <TableCell>患者</TableCell>
                    <TableCell>诊断</TableCell>
                    <TableCell>处方</TableCell>
                    <TableCell>CDSS</TableCell>
                    <TableCell>状态</TableCell>
                    <TableCell>操作</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paged.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell>{item.date}</TableCell>
                      <TableCell>{`${item.patientName} (${item.patientAge ?? '—'}岁 ${item.patientGender || ''})`}</TableCell>
                      <TableCell>{item.diagnosis}</TableCell>
                      <TableCell>
                        <Tooltip title={rxToText(item)}>
                          <Typography sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {rxToText(item)}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        {item.cdssStatus && (
                          <Chip size="small" label={item.cdssStatus} color={statusChipColor(item.cdssStatus)} variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip label={item.status} color={statusChipColor(item.status)} size="small" />
                      </TableCell>
                      <TableCell>
                        <Button size="small" onClick={() => viewHistoryDetail(item)}>载入</Button>
                        <Button size="small" color="primary" onClick={() => loadHistoryAndReview(item)}>ADR 审理</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filtered.length}
              page={historyPage}
              onPageChange={(_, p) => setHistoryPage(p)}
              rowsPerPage={historyRowsPerPage}
              onRowsPerPageChange={(e) => { setHistoryRowsPerPage(+e.target.value); setHistoryPage(0); }}
              rowsPerPageOptions={[10, 20, 50, 100]}
              labelRowsPerPage="每页"
            />
          </>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2, gap: 1 }}>
          <Button variant="outlined" onClick={loadHistory} startIcon={<HistoryIcon />}>刷新</Button>
          <Button variant="outlined" onClick={() => setViewMode('input')}>返回</Button>
        </Box>
      </Paper>
    );
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 2, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          草药不良反应预防 CDSS
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          融合专家知识规则与可解释机器学习 · 辅助药师识别配伍禁忌、剂量风险与潜在 ADR 信号
        </Typography>
        <Chip label="HAR-CDSS v1.0" size="small" color="primary" variant="outlined" sx={{ mt: 0.5 }} />
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