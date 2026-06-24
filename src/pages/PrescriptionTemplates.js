import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Paper,
  TextField,
  Typography,
  Snackbar,
  Alert,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  FileCopy as CopyIcon,
  MedicalServices as MedicalIcon,
  FolderSpecial as FolderIcon,
} from '@mui/icons-material';

// 模拟数据 - 扩展为25种经典方剂
const mockTemplates = [
  {
    id: 1,
    name: '四君子汤',
    description: '用于脾胃虚弱、气血不足、食少便溏',
    herbs: [
      { name: '人参', dosage: '9g' },
      { name: '白术', dosage: '9g' },
      { name: '茯苓', dosage: '9g' },
      { name: '甘草', dosage: '6g' }
    ]
  },
  {
    id: 2,
    name: '补中益气汤',
    description: '用于脾胃虚弱、气虚下陷、中气不足',
    herbs: [
      { name: '黄芪', dosage: '15g' },
      { name: '人参', dosage: '9g' },
      { name: '白术', dosage: '9g' },
      { name: '甘草', dosage: '6g' },
      { name: '当归', dosage: '6g' },
      { name: '陈皮', dosage: '6g' },
      { name: '升麻', dosage: '3g' },
      { name: '柴胡', dosage: '3g' }
    ]
  },
  {
    id: 3,
    name: '六味地黄丸',
    description: '用于肾阴虚、腰膝酸软、盗汗、五心烦热',
    herbs: [
      { name: '熟地黄', dosage: '24g' },
      { name: '山茱萸', dosage: '12g' },
      { name: '山药', dosage: '12g' },
      { name: '泽泻', dosage: '9g' },
      { name: '牡丹皮', dosage: '9g' },
      { name: '茯苓', dosage: '9g' }
    ]
  },
  {
    id: 4,
    name: '八珍汤',
    description: '用于气血两虚、面色萎黄、神疲乏力',
    herbs: [
      { name: '人参', dosage: '9g' },
      { name: '白术', dosage: '9g' },
      { name: '茯苓', dosage: '9g' },
      { name: '甘草', dosage: '3g' },
      { name: '当归', dosage: '9g' },
      { name: '白芍', dosage: '9g' },
      { name: '川芎', dosage: '6g' },
      { name: '熟地黄', dosage: '12g' }
    ]
  },
  {
    id: 5,
    name: '逍遥散',
    description: '用于肝郁气滞、胁肋胀痛、脾虚湿阻',
    herbs: [
      { name: '柴胡', dosage: '6g' },
      { name: '当归', dosage: '9g' },
      { name: '白芍', dosage: '9g' },
      { name: '白术', dosage: '9g' },
      { name: '茯苓', dosage: '9g' },
      { name: '甘草', dosage: '3g' },
      { name: '薄荷', dosage: '3g' },
      { name: '生姜', dosage: '3g' }
    ]
  },
  {
    id: 6,
    name: '二陈汤',
    description: '用于湿痰咳嗽、胸闷痰多、痰湿内阻',
    herbs: [
      { name: '陈皮', dosage: '9g' },
      { name: '半夏', dosage: '9g' },
      { name: '茯苓', dosage: '9g' },
      { name: '甘草', dosage: '3g' }
    ]
  },
  {
    id: 7,
    name: '小柴胡汤',
    description: '用于少阳病、往来寒热、胸胁苦满',
    herbs: [
      { name: '柴胡', dosage: '24g' },
      { name: '黄芩', dosage: '9g' },
      { name: '人参', dosage: '9g' },
      { name: '半夏', dosage: '9g' },
      { name: '甘草', dosage: '6g' },
      { name: '生姜', dosage: '9g' },
      { name: '大枣', dosage: '4枚' }
    ]
  },
  {
    id: 8,
    name: '温胆汤',
    description: '用于痰热内扰、胸闷不舒、虚烦不眠',
    herbs: [
      { name: '半夏', dosage: '9g' },
      { name: '陈皮', dosage: '9g' },
      { name: '茯苓', dosage: '9g' },
      { name: '枳实', dosage: '9g' },
      { name: '竹茹', dosage: '6g' },
      { name: '甘草', dosage: '3g' }
    ]
  },
  {
    id: 9,
    name: '桂枝汤',
    description: '用于风寒表证、恶风发热、头痛、汗出',
    herbs: [
      { name: '桂枝', dosage: '9g' },
      { name: '白芍', dosage: '9g' },
      { name: '生姜', dosage: '9g' },
      { name: '大枣', dosage: '4枚' },
      { name: '甘草', dosage: '6g' }
    ]
  },
  {
    id: 10,
    name: '麻黄汤',
    description: '用于风寒表实证、恶寒发热、无汗而喘',
    herbs: [
      { name: '麻黄', dosage: '9g' },
      { name: '桂枝', dosage: '6g' },
      { name: '杏仁', dosage: '9g' },
      { name: '甘草', dosage: '3g' }
    ]
  },
  {
    id: 11,
    name: '归脾汤',
    description: '用于脾不统血、心脾两虚、失眠健忘',
    herbs: [
      { name: '人参', dosage: '9g' },
      { name: '白术', dosage: '9g' },
      { name: '茯苓', dosage: '9g' },
      { name: '甘草', dosage: '3g' },
      { name: '当归', dosage: '9g' },
      { name: '龙眼肉', dosage: '9g' },
      { name: '远志', dosage: '9g' },
      { name: '酸枣仁', dosage: '9g' },
      { name: '黄芪', dosage: '9g' },
      { name: '木香', dosage: '6g' },
      { name: '生姜', dosage: '3g' }
    ]
  },
  {
    id: 12,
    name: '天王补心丹',
    description: '用于心脾两虚、心悸怔忡、失眠多梦',
    herbs: [
      { name: '生地黄', dosage: '15g' },
      { name: '人参', dosage: '6g' },
      { name: '丹参', dosage: '6g' },
      { name: '玄参', dosage: '6g' },
      { name: '天门冬', dosage: '6g' },
      { name: '麦门冬', dosage: '6g' },
      { name: '当归', dosage: '6g' },
      { name: '五味子', dosage: '6g' },
      { name: '酸枣仁', dosage: '6g' },
      { name: '柏子仁', dosage: '6g' },
      { name: '茯苓', dosage: '6g' },
      { name: '远志', dosage: '3g' }
    ]
  },
  {
    id: 13,
    name: '半夏白术天麻汤',
    description: '用于眩晕头痛、痰湿中阻、胃脘不适',
    herbs: [
      { name: '半夏', dosage: '9g' },
      { name: '白术', dosage: '9g' },
      { name: '天麻', dosage: '9g' },
      { name: '茯苓', dosage: '9g' },
      { name: '橘红', dosage: '9g' },
      { name: '甘草', dosage: '3g' },
      { name: '生姜', dosage: '3片' }
    ]
  },
  {
    id: 14,
    name: '当归四逆汤',
    description: '用于血虚寒凝、手足厥冷、脉细欲绝',
    herbs: [
      { name: '当归', dosage: '9g' },
      { name: '桂枝', dosage: '9g' },
      { name: '芍药', dosage: '9g' },
      { name: '细辛', dosage: '3g' },
      { name: '通草', dosage: '6g' },
      { name: '大枣', dosage: '4枚' },
      { name: '甘草', dosage: '6g' }
    ]
  },
  {
    id: 15,
    name: '金匮肾气丸',
    description: '用于肾阳虚、腰膝酸软、小便频数',
    herbs: [
      { name: '熟地黄', dosage: '24g' },
      { name: '山茱萸', dosage: '12g' },
      { name: '山药', dosage: '12g' },
      { name: '泽泻', dosage: '9g' },
      { name: '牡丹皮', dosage: '9g' },
      { name: '茯苓', dosage: '9g' },
      { name: '肉桂', dosage: '6g' },
      { name: '附子', dosage: '6g' }
    ]
  },
  {
    id: 16,
    name: '十全大补汤',
    description: '用于气血亏虚、体弱乏力、面色萎黄',
    herbs: [
      { name: '人参', dosage: '9g' },
      { name: '白术', dosage: '9g' },
      { name: '茯苓', dosage: '9g' },
      { name: '甘草', dosage: '3g' },
      { name: '当归', dosage: '9g' },
      { name: '川芎', dosage: '6g' },
      { name: '白芍', dosage: '9g' },
      { name: '熟地黄', dosage: '12g' },
      { name: '黄芪', dosage: '15g' },
      { name: '肉桂', dosage: '3g' }
    ]
  },
  {
    id: 17,
    name: '大承气汤',
    description: '用于阳明腑实证、腹部胀满、大便秘结',
    herbs: [
      { name: '大黄', dosage: '12g' },
      { name: '厚朴', dosage: '9g' },
      { name: '枳实', dosage: '9g' },
      { name: '芒硝', dosage: '9g' }
    ]
  },
  {
    id: 18,
    name: '四物汤',
    description: '用于血虚证、月经不调、面色萎黄',
    herbs: [
      { name: '当归', dosage: '9g' },
      { name: '川芎', dosage: '6g' },
      { name: '白芍', dosage: '9g' },
      { name: '熟地黄', dosage: '12g' }
    ]
  },
  {
    id: 19,
    name: '白虎汤',
    description: '用于阳明热盛、壮热烦渴、汗出脉洪大',
    herbs: [
      { name: '石膏', dosage: '30g' },
      { name: '知母', dosage: '9g' },
      { name: '甘草', dosage: '3g' },
      { name: '粳米', dosage: '9g' }
    ]
  },
  {
    id: 20,
    name: '麻杏石甘汤',
    description: '用于外感风寒、内有郁热、咳嗽气喘',
    herbs: [
      { name: '麻黄', dosage: '9g' },
      { name: '杏仁', dosage: '9g' },
      { name: '石膏', dosage: '18g' },
      { name: '甘草', dosage: '3g' }
    ]
  },
  {
    id: 21,
    name: '黄连解毒汤',
    description: '用于三焦热盛、心烦不寐、口燥咽干',
    herbs: [
      { name: '黄连', dosage: '6g' },
      { name: '黄芩', dosage: '9g' },
      { name: '黄柏', dosage: '6g' },
      { name: '栀子', dosage: '9g' }
    ]
  },
  {
    id: 22,
    name: '当归补血汤',
    description: '用于血虚证、面色萎黄、心悸眩晕',
    herbs: [
      { name: '当归', dosage: '30g' },
      { name: '黄芪', dosage: '30g' }
    ]
  },
  {
    id: 23,
    name: '越鞠丸',
    description: '用于气、血、痰、火、食五种郁结',
    herbs: [
      { name: '香附', dosage: '6g' },
      { name: '苍术', dosage: '6g' },
      { name: '栀子', dosage: '6g' },
      { name: '川芎', dosage: '6g' },
      { name: '神曲', dosage: '6g' }
    ]
  },
  {
    id: 24,
    name: '柴胡疏肝散',
    description: '用于肝郁气滞、胁肋胀痛、脘腹痞闷',
    herbs: [
      { name: '柴胡', dosage: '9g' },
      { name: '香附', dosage: '9g' },
      { name: '陈皮', dosage: '6g' },
      { name: '川芎', dosage: '6g' },
      { name: '枳壳', dosage: '6g' },
      { name: '芍药', dosage: '9g' },
      { name: '甘草', dosage: '3g' }
    ]
  },
  {
    id: 25,
    name: '清营汤',
    description: '用于温热病热入营分、高热烦躁、神昏谵语',
    herbs: [
      { name: '犀角', dosage: '3g' },
      { name: '生地黄', dosage: '15g' },
      { name: '玄参', dosage: '9g' },
      { name: '竹叶', dosage: '6g' },
      { name: '麦冬', dosage: '9g' },
      { name: '丹参', dosage: '9g' },
      { name: '黄连', dosage: '3g' },
      { name: '银花', dosage: '9g' },
      { name: '连翘', dosage: '9g' }
    ]
  }
];

const PrescriptionTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState({ name: '', description: '', herbs: [] });
  const [currentHerb, setCurrentHerb] = useState({ name: '', dosage: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

  // 获取所有模板
  useEffect(() => {
    // 使用模拟数据
    setTemplates(mockTemplates);
  }, []);

  // 搜索处理
  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const filteredTemplates = templates.filter(template => 
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.herbs.some(herb => herb.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // 对话框处理
  const handleOpenDialog = (template = null) => {
    if (template) {
      setCurrentTemplate({...template});
      setIsEditing(true);
    } else {
      setCurrentTemplate({ name: '', description: '', herbs: [] });
      setIsEditing(false);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setCurrentHerb({ name: '', dosage: '' });
  };

  // 处方模板处理
  const handleTemplateChange = (e) => {
    const { name, value } = e.target;
    setCurrentTemplate(prev => ({ ...prev, [name]: value }));
  };

  // 药材处理
  const handleHerbChange = (e) => {
    const { name, value } = e.target;
    setCurrentHerb(prev => ({ ...prev, [name]: value }));
  };

  const handleAddHerb = () => {
    if (currentHerb.name.trim() === '') return;

    setCurrentTemplate(prev => ({
      ...prev,
      herbs: [...prev.herbs, { ...currentHerb }]
    }));
    setCurrentHerb({ name: '', dosage: '' });
  };

  const handleRemoveHerb = (index) => {
    setCurrentTemplate(prev => ({
      ...prev,
      herbs: prev.herbs.filter((_, i) => i !== index)
    }));
  };

  // 保存处方模板
  const handleSaveTemplate = async () => {
    try {
      if (currentTemplate.name.trim() === '') {
        showNotification('请输入处方模板名称', 'error');
        return;
      }

      if (currentTemplate.herbs.length === 0) {
        showNotification('请至少添加一味药材', 'error');
        return;
      }

      // 模拟保存处理
      if (isEditing) {
        setTemplates(prev => 
          prev.map(item => 
            item.id === currentTemplate.id ? currentTemplate : item
          )
        );
        showNotification('处方模板更新成功', 'success');
      } else {
        const newTemplate = {
          ...currentTemplate,
          id: Date.now() // 模拟生成ID
        };
        setTemplates(prev => [...prev, newTemplate]);
        showNotification('处方模板创建成功', 'success');
      }

      handleCloseDialog();
    } catch (error) {
      console.error('保存处方模板失败:', error);
      showNotification('保存处方模板失败', 'error');
    }
  };

  // 删除处方模板
  const handleDeleteTemplate = async (id) => {
    try {
      // 模拟删除
      setTemplates(prev => prev.filter(item => item.id !== id));
      showNotification('处方模板已删除', 'success');
    } catch (error) {
      console.error('删除处方模板失败:', error);
      showNotification('删除处方模板失败', 'error');
    }
  };

  // 复制处方模板
  const handleCopyTemplate = (template) => {
    const newTemplate = {
      ...template,
      name: `${template.name} (复制)`,
      id: undefined
    };
    handleOpenDialog(newTemplate);
  };

  // 通知处理
  const showNotification = (message, severity) => {
    setNotification({ open: true, message, severity });
  };

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 2, mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          处方模板库
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          管理常用处方模板，提高配药效率
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <TextField
                placeholder="搜索处方模板或药材..."
                variant="outlined"
                size="small"
                value={searchQuery}
                onChange={handleSearch}
                sx={{ width: '50%' }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
              >
                新建模板
              </Button>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {filteredTemplates.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <FolderIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  {searchQuery ? '没有找到匹配的处方模板' : '暂无处方模板'}
                </Typography>
                {searchQuery ? (
                  <Typography variant="body2" color="text.secondary">
                    尝试使用其他关键词搜索
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    点击"新建模板"按钮创建您的第一个处方模板
                  </Typography>
                )}
              </Box>
            ) : (
              <Grid container spacing={3}>
                {filteredTemplates.map(template => (
                  <Grid item xs={12} md={6} key={template.id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="h6" gutterBottom>
                            {template.name}
                          </Typography>
    <Box>
                            <IconButton 
                              aria-label="复制" 
                              size="small"
                              onClick={() => handleCopyTemplate(template)}
                            >
                              <CopyIcon fontSize="small" />
                            </IconButton>
                            <IconButton 
                              aria-label="编辑" 
                              size="small"
                              onClick={() => handleOpenDialog(template)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton 
                              aria-label="删除" 
                              size="small"
                              onClick={() => handleDeleteTemplate(template.id)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
    </Box>
                        
                        {template.description && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {template.description}
                          </Typography>
                        )}
                        
                        <Divider sx={{ mb: 1 }} />
                        
                        <List dense>
                          {template.herbs.map((herb, index) => (
                            <ListItem key={index}>
                              <ListItemIcon>
                                <MedicalIcon color="primary" fontSize="small" />
                              </ListItemIcon>
                              <ListItemText 
                                primary={`${herb.name} ${herb.dosage || ''}`} 
                              />
                            </ListItem>
                          ))}
                        </List>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* 添加/编辑处方模板对话框 */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          {isEditing ? '编辑处方模板' : '新建处方模板'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="name"
            label="模板名称"
            type="text"
            fullWidth
            variant="outlined"
            value={currentTemplate.name}
            onChange={handleTemplateChange}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            name="description"
            label="模板描述（适用疾病、功效等）"
            type="text"
            fullWidth
            multiline
            rows={2}
            variant="outlined"
            value={currentTemplate.description}
            onChange={handleTemplateChange}
            sx={{ mb: 3 }}
          />

          <Typography variant="subtitle1" gutterBottom>
            药材列表
          </Typography>
          
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={5}>
              <TextField
                name="name"
                label="药材名称"
                type="text"
                fullWidth
                variant="outlined"
                size="small"
                value={currentHerb.name}
                onChange={handleHerbChange}
              />
            </Grid>
            <Grid item xs={5}>
              <TextField
                name="dosage"
                label="用量（如：10g）"
                type="text"
                fullWidth
                variant="outlined"
                size="small"
                value={currentHerb.dosage}
                onChange={handleHerbChange}
              />
            </Grid>
            <Grid item xs={2}>
              <Button
                variant="contained"
                fullWidth
                onClick={handleAddHerb}
                disabled={!currentHerb.name}
                sx={{ height: '100%' }}
              >
                添加
              </Button>
            </Grid>
          </Grid>

          <Paper variant="outlined" sx={{ p: 2, maxHeight: 300, overflow: 'auto' }}>
            {currentTemplate.herbs.length === 0 ? (
              <Typography variant="body2" color="text.secondary" align="center">
                暂无药材，请添加药材
              </Typography>
            ) : (
              <List dense>
                {currentTemplate.herbs.map((herb, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <MedicalIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={`${herb.name} ${herb.dosage || ''}`} />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" aria-label="删除" onClick={() => handleRemoveHerb(index)}>
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button onClick={handleSaveTemplate} variant="contained">保存</Button>
        </DialogActions>
      </Dialog>

      {/* 通知提示 */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity} variant="filled">
          {notification.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default PrescriptionTemplates; 