import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Chip,
  Divider,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileCopy as CopyIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';

// 示例处方模板数据
const initialTemplates = [
  {
    id: 1,
    name: '四君子汤',
    category: '补气方',
    description: '补脾益气，常用于脾胃虚弱、气血不足',
    compositions: [
      { name: '人参', dosage: '9g' },
      { name: '白术', dosage: '9g' },
      { name: '茯苓', dosage: '9g' },
      { name: '甘草', dosage: '6g' },
    ],
    createdBy: '张医师',
    createdAt: '2023-01-10',
    isFavorite: true,
  },
  {
    id: 2,
    name: '四物汤',
    category: '补血方',
    description: '补血调经，用于血虚诸证',
    compositions: [
      { name: '当归', dosage: '9g' },
      { name: '川芎', dosage: '6g' },
      { name: '白芍', dosage: '9g' },
      { name: '熟地黄', dosage: '9g' },
    ],
    createdBy: '李医师',
    createdAt: '2023-02-15',
    isFavorite: false,
  },
  {
    id: 3,
    name: '六味地黄丸',
    category: '滋阴方',
    description: '滋阴补肾，用于肾阴亏虚',
    compositions: [
      { name: '熟地黄', dosage: '24g' },
      { name: '山茱萸', dosage: '12g' },
      { name: '山药', dosage: '12g' },
      { name: '泽泻', dosage: '9g' },
      { name: '牡丹皮', dosage: '9g' },
      { name: '茯苓', dosage: '9g' },
    ],
    createdBy: '王医师',
    createdAt: '2023-03-20',
    isFavorite: true,
  },
  {
    id: 4,
    name: '柴胡疏肝散',
    category: '疏肝理气方',
    description: '疏肝理气，用于肝郁气滞',
    compositions: [
      { name: '柴胡', dosage: '12g' },
      { name: '白芍', dosage: '9g' },
      { name: '陈皮', dosage: '9g' },
      { name: '甘草', dosage: '6g' },
      { name: '香附', dosage: '9g' },
    ],
    createdBy: '刘医师',
    createdAt: '2023-04-05',
    isFavorite: false,
  },
];

const PrescriptionTemplates = () => {
  const [templates, setTemplates] = useState(initialTemplates);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // 处理搜索
  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  // 过滤模板
  const filteredTemplates = templates.filter(template => 
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    template.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 添加/编辑模板对话框
  const handleOpenDialog = (template = null) => {
    setSelectedTemplate(template);
    setOpenDialog(true);
  };

  // 关闭对话框
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedTemplate(null);
  };

  // 处理收藏
  const handleToggleFavorite = (id: number) => {
    setTemplates(templates.map(template => 
      template.id === id 
        ? { ...template, isFavorite: !template.isFavorite } 
        : template
    ));
  };

  // 查看详情
  const handleViewDetails = (template: any) => {
    setSelectedTemplate(template);
    setDetailsOpen(true);
  };

  // 关闭详情
  const handleCloseDetails = () => {
    setDetailsOpen(false);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
        <Typography variant="h4" gutterBottom>
          处方模板库
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          添加模板
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          placeholder="搜索模板名称、分类或描述..."
          value={searchTerm}
          onChange={handleSearch}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton>
                  <FilterIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      <Grid container spacing={3}>
        {filteredTemplates.map(template => (
          <Grid item xs={12} md={6} lg={4} key={template.id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Typography variant="h6" component="div">
                    {template.name}
                  </Typography>
                  <IconButton 
                    color={template.isFavorite ? "primary" : "default"} 
                    onClick={() => handleToggleFavorite(template.id)}
                  >
                    {template.isFavorite ? <BookmarkIcon /> : <BookmarkBorderIcon />}
                  </IconButton>
                </Box>
                
                <Chip 
                  label={template.category} 
                  size="small" 
                  color="primary" 
                  variant="outlined" 
                  sx={{ mb: 1 }} 
                />
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {template.description}
                </Typography>
                
                <Typography variant="body2" sx={{ mb: 1 }}>
                  组成：
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  {template.compositions.slice(0, 3).map((comp, index) => (
                    <Chip 
                      key={index}
                      label={`${comp.name} ${comp.dosage}`}
                      size="small"
                      sx={{ mr: 0.5, mb: 0.5 }}
                    />
                  ))}
                  {template.compositions.length > 3 && (
                    <Chip 
                      label={`+${template.compositions.length - 3}味`}
                      size="small"
                      variant="outlined"
                      sx={{ mr: 0.5, mb: 0.5 }}
                    />
                  )}
                </Box>
                
                <Typography variant="caption" color="text.secondary">
                  创建者: {template.createdBy} | 创建时间: {template.createdAt}
                </Typography>
              </CardContent>
              <Divider />
              <CardActions>
                <Button size="small" onClick={() => handleViewDetails(template)}>查看详情</Button>
                <Button size="small" startIcon={<CopyIcon />}>复制到处方</Button>
                <IconButton size="small">
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* 详情对话框 */}
      <Dialog open={detailsOpen} onClose={handleCloseDetails} maxWidth="md" fullWidth>
        {selectedTemplate && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {selectedTemplate.name}
                <Chip label={selectedTemplate.category} color="primary" />
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="subtitle1" gutterBottom>
                处方描述
              </Typography>
              <Typography paragraph>
                {selectedTemplate.description}
              </Typography>

              <Typography variant="subtitle1" gutterBottom>
                组成药材
              </Typography>
              <List dense>
                {selectedTemplate.compositions.map((comp: any, index: number) => (
                  <ListItem key={index}>
                    <ListItemText 
                      primary={comp.name} 
                      secondary={`用量: ${comp.dosage}`} 
                    />
                  </ListItem>
                ))}
              </List>

              <Typography variant="subtitle1" gutterBottom>
                用法用量
              </Typography>
              <Typography paragraph>
                水煎服，日1剂，早晚分服。
              </Typography>

              <Typography variant="subtitle1" gutterBottom>
                功效与主治
              </Typography>
              <Typography paragraph>
                {selectedTemplate.category === '补气方' && '补气健脾，适用于脾胃虚弱、倦怠乏力、食欲不振等症。'}
                {selectedTemplate.category === '补血方' && '补血调经，适用于血虚萎黄、月经不调、产后血虚等症。'}
                {selectedTemplate.category === '滋阴方' && '滋阴补肾，适用于肾阴亏虚、腰膝酸软、头晕耳鸣等症。'}
                {selectedTemplate.category === '疏肝理气方' && '疏肝理气，适用于肝郁气滞、胸胁胀痛、情志不畅等症。'}
              </Typography>

              <Typography variant="subtitle1" gutterBottom>
                注意事项
              </Typography>
              <Typography paragraph>
                {selectedTemplate.category === '补气方' && '表实邪盛者慎用；脾胃积热者慎用。'}
                {selectedTemplate.category === '补血方' && '血热妄行者慎用；月经量多者慎用。'}
                {selectedTemplate.category === '滋阴方' && '脾胃虚寒、大便溏泄者慎用。'}
                {selectedTemplate.category === '疏肝理气方' && '肝阳上亢者慎用；阴虚火旺者慎用。'}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDetails}>关闭</Button>
              <Button variant="contained" startIcon={<CopyIcon />}>
                复制到处方
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* 添加/编辑模板对话框 */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedTemplate ? '编辑处方模板' : '添加处方模板'}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="模板名称"
                variant="outlined"
                margin="normal"
                defaultValue={selectedTemplate?.name}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="分类"
                variant="outlined"
                margin="normal"
                defaultValue={selectedTemplate?.category}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="描述"
                variant="outlined"
                margin="normal"
                multiline
                rows={2}
                defaultValue={selectedTemplate?.description}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                药材组成
              </Typography>
              {/* 这里省略药材组成的编辑界面 */}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button variant="contained">保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PrescriptionTemplates; 