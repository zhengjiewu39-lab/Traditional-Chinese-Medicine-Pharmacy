import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActionArea,
  CardActions,
  TextField,
  Button,
  Chip,
  InputAdornment,
  IconButton,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  LocalHospital as MedicalIcon,
  BookmarkBorder as BookmarkIcon,
  MenuBook as BookIcon,
  WarningAmber as WarningIcon,
  Nature as NatureIcon,
  Science as ScienceIcon,
} from '@mui/icons-material';

// 示例中药数据
const herbsData = [
  {
    id: 1,
    name: '黄芪',
    latinName: 'Astragalus membranaceus',
    alias: '蜜芪、棉芪',
    category: '补气药',
    image: 'https://placehold.co/300x200?text=黄芪',
    description: '黄芪味甘、性微温，归肺、脾、肝、肾经。具有补气固表，利水消肿，托毒排脓，生肌的功效。',
    properties: {
      taste: '甘',
      nature: '微温',
      channels: ['肺', '脾', '肝', '肾'],
    },
    functions: [
      '补气升阳',
      '固表止汗',
      '利水消肿',
      '托毒排脓',
      '生肌',
    ],
    commonUsage: '用于气虚乏力、自汗、气虚水肿、慢性肾炎蛋白尿、慢性溃疡久不愈合等。',
    dosage: '10-30g',
    precautions: '表实邪盛者慎用。阴虚火旺者忌服。',
    isFavorite: true,
  },
  {
    id: 2,
    name: '当归',
    latinName: 'Angelica sinensis',
    alias: '干归、秦归',
    category: '补血药',
    image: 'https://placehold.co/300x200?text=当归',
    description: '当归味甘、辛，性温，归肝、心、脾经。具有补血活血，调经止痛，润肠通便的功效。',
    properties: {
      taste: '甘、辛',
      nature: '温',
      channels: ['肝', '心', '脾'],
    },
    functions: [
      '补血活血',
      '调经止痛',
      '润肠通便',
    ],
    commonUsage: '用于血虚萎黄、月经不调、经闭痛经、虚寒腹痛、肠燥便秘等。',
    dosage: '6-15g',
    precautions: '阴虚火旺及湿热盛者慎用。',
    isFavorite: false,
  },
  {
    id: 3,
    name: '白芍',
    latinName: 'Paeonia lactiflora',
    alias: '芍药、白药',
    category: '补血药',
    image: 'https://placehold.co/300x200?text=白芍',
    description: '白芍味苦、酸，性微寒，归肝、脾经。具有养血柔肝，缓中止痛，平抑肝阳的功效。',
    properties: {
      taste: '苦、酸',
      nature: '微寒',
      channels: ['肝', '脾'],
    },
    functions: [
      '养血柔肝',
      '缓中止痛',
      '平抑肝阳',
    ],
    commonUsage: '用于肝脾不调、腹痛腹泻、月经不调、痛经等。',
    dosage: '6-15g',
    precautions: '脾胃虚寒、泄泻者慎用。',
    isFavorite: true,
  },
  {
    id: 4,
    name: '川芎',
    latinName: 'Ligusticum chuanxiong',
    alias: '芎藭、香果',
    category: '活血化瘀药',
    image: 'https://placehold.co/300x200?text=川芎',
    description: '川芎味辛，性温，归肝、胆、心包经。具有活血行气，祛风止痛的功效。',
    properties: {
      taste: '辛',
      nature: '温',
      channels: ['肝', '胆', '心包'],
    },
    functions: [
      '活血行气',
      '祛风止痛',
    ],
    commonUsage: '用于月经不调、经闭痛经、跌打损伤、风湿痹痛、头痛等。',
    dosage: '3-10g',
    precautions: '孕妇慎用。阴虚火旺及出血性疾病者忌服。',
    isFavorite: false,
  },
  {
    id: 5,
    name: '熟地黄',
    latinName: 'Rehmannia glutinosa',
    alias: '地黄、干地黄',
    category: '补血药',
    image: 'https://placehold.co/300x200?text=熟地黄',
    description: '熟地黄味甘，性微温，归肝、肾经。具有滋阴补血，益精填髓的功效。',
    properties: {
      taste: '甘',
      nature: '微温',
      channels: ['肝', '肾'],
    },
    functions: [
      '滋阴补血',
      '益精填髓',
    ],
    commonUsage: '用于血虚萎黄、心悸失眠、眩晕耳鸣、腰膝酸软、消渴、月经不调等。',
    dosage: '10-30g',
    precautions: '脾胃虚弱、食少便溏、湿盛者慎用。',
    isFavorite: true,
  },
  {
    id: 6,
    name: '茯苓',
    latinName: 'Poria cocos',
    alias: '茯苓、白茯苓',
    category: '利水渗湿药',
    image: 'https://placehold.co/300x200?text=茯苓',
    description: '茯苓味甘、淡，性平，归心、肺、脾、肾经。具有利水渗湿，健脾和胃，宁心安神的功效。',
    properties: {
      taste: '甘、淡',
      nature: '平',
      channels: ['心', '肺', '脾', '肾'],
    },
    functions: [
      '利水渗湿',
      '健脾和胃',
      '宁心安神',
    ],
    commonUsage: '用于水肿尿少、痰饮眩悸、脾虚食少、便溏泄泻、心神不安、失眠健忘等。',
    dosage: '10-15g',
    precautions: '气虚下陷者慎用。',
    isFavorite: false,
  },
];

// 示例处方数据
const prescriptions = [
  {
    id: 1,
    name: '四君子汤',
    herbs: ['人参', '白术', '茯苓', '甘草'],
    category: '补气剂',
    function: '补气健脾',
    application: '适用于脾胃虚弱、气虚乏力、食欲不振、倦怠无力等症。',
  },
  {
    id: 2,
    name: '四物汤',
    herbs: ['当归', '川芎', '白芍', '熟地黄'],
    category: '补血剂',
    function: '补血调经',
    application: '适用于血虚萎黄、月经不调、血虚引起的各种症状。',
  },
  {
    id: 3,
    name: '六味地黄丸',
    herbs: ['熟地黄', '山茱萸', '山药', '泽泻', '牡丹皮', '茯苓'],
    category: '滋阴剂',
    function: '滋阴补肾',
    application: '适用于肾阴虚引起的腰膝酸软、盗汗、头晕耳鸣等症。',
  },
];

const HerbalKnowledgeBase = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHerb, setSelectedHerb] = useState<any>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [herbs, setHerbs] = useState(herbsData);

  // 处理搜索
  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  // 过滤药材
  const filteredHerbs = herbs.filter(herb => 
    herb.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    herb.alias.toLowerCase().includes(searchTerm.toLowerCase()) ||
    herb.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 打开药材详情
  const handleOpenHerbDetails = (herb: any) => {
    setSelectedHerb(herb);
    setOpenDialog(true);
  };

  // 关闭详情对话框
  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  // 处理标签切换
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // 处理收藏
  const handleToggleFavorite = (id: number) => {
    setHerbs(herbs.map(herb => 
      herb.id === id 
        ? { ...herb, isFavorite: !herb.isFavorite } 
        : herb
    ));
  };

  // 查找包含指定药材的处方
  const findPrescriptionsWithHerb = (herbName: string) => {
    return prescriptions.filter(prescription => 
      prescription.herbs.includes(herbName)
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
        <Typography variant="h4" gutterBottom>
          中药知识库
        </Typography>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="搜索中药名称、别名或分类..."
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
          </Grid>
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip label="补气药" onClick={() => setSearchTerm('补气药')} color="primary" variant={searchTerm === '补气药' ? 'filled' : 'outlined'} />
              <Chip label="补血药" onClick={() => setSearchTerm('补血药')} color="primary" variant={searchTerm === '补血药' ? 'filled' : 'outlined'} />
              <Chip label="活血化瘀药" onClick={() => setSearchTerm('活血化瘀药')} color="primary" variant={searchTerm === '活血化瘀药' ? 'filled' : 'outlined'} />
              <Chip label="利水渗湿药" onClick={() => setSearchTerm('利水渗湿药')} color="primary" variant={searchTerm === '利水渗湿药' ? 'filled' : 'outlined'} />
              <Chip label="清热药" onClick={() => setSearchTerm('清热药')} color="primary" variant={searchTerm === '清热药' ? 'filled' : 'outlined'} />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {filteredHerbs.map(herb => (
          <Grid item xs={12} sm={6} md={4} key={herb.id}>
            <Card>
              <CardActionArea onClick={() => handleOpenHerbDetails(herb)}>
                <CardMedia
                  component="img"
                  height="140"
                  image={herb.image}
                  alt={herb.name}
                />
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Typography variant="h6" component="div">
                      {herb.name}
                    </Typography>
                    <Chip 
                      label={herb.category} 
                      size="small" 
                      color="primary" 
                      variant="outlined" 
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    别名: {herb.alias}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    性味: {herb.properties.nature}，{herb.properties.taste}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1, mb: 1 }}>
                    功效:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    {herb.functions.slice(0, 3).map((func, idx) => (
                      <Chip key={idx} label={func} size="small" />
                    ))}
                    {herb.functions.length > 3 && (
                      <Chip label={`+${herb.functions.length - 3}`} size="small" variant="outlined" />
                    )}
                  </Box>
                </CardContent>
              </CardActionArea>
              <Divider />
              <CardActions>
                <Button size="small" onClick={() => handleOpenHerbDetails(herb)}>
                  详细信息
                </Button>
                <IconButton 
                  aria-label="收藏" 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleFavorite(herb.id);
                  }}
                  color={herb.isFavorite ? "primary" : "default"}
                >
                  {herb.isFavorite ? <FavoriteIcon /> : <FavoriteBorderIcon />}
                </IconButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* 药材详情对话框 */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        {selectedHerb && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">
                  {selectedHerb.name}
                </Typography>
                <Box>
                  <Chip 
                    label={selectedHerb.category} 
                    color="primary" 
                    sx={{ mr: 1 }} 
                  />
                  <IconButton 
                    color={selectedHerb.isFavorite ? "primary" : "default"} 
                    onClick={() => handleToggleFavorite(selectedHerb.id)}
                  >
                    {selectedHerb.isFavorite ? <FavoriteIcon /> : <FavoriteBorderIcon />}
                  </IconButton>
                </Box>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ mb: 2 }}>
                <Tabs value={tabValue} onChange={handleTabChange}>
                  <Tab label="基本信息" />
                  <Tab label="功效应用" />
                  <Tab label="相关处方" />
                </Tabs>
              </Box>

              {/* 基本信息 */}
              {tabValue === 0 && (
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <img
                      src={selectedHerb.image}
                      alt={selectedHerb.name}
                      style={{ width: '100%', borderRadius: '4px' }}
                    />
                  </Grid>
                  <Grid item xs={12} md={8}>
                    <Typography variant="subtitle1" gutterBottom>
                      基本信息
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemIcon>
                          <BookIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText 
                          primary="中文名称" 
                          secondary={selectedHerb.name} 
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <BookIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText 
                          primary="拉丁名称" 
                          secondary={selectedHerb.latinName} 
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <BookIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText 
                          primary="别名" 
                          secondary={selectedHerb.alias} 
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <MedicalIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText 
                          primary="性味" 
                          secondary={`${selectedHerb.properties.nature}，${selectedHerb.properties.taste}`} 
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <MedicalIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText 
                          primary="归经" 
                          secondary={selectedHerb.properties.channels.join('、')} 
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          <ScienceIcon color="primary" />
                        </ListItemIcon>
                        <ListItemText 
                          primary="用量" 
                          secondary={selectedHerb.dosage} 
                        />
                      </ListItem>
                    </List>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" gutterBottom>
                      描述
                    </Typography>
                    <Typography paragraph>
                      {selectedHerb.description}
                    </Typography>
                  </Grid>
                </Grid>
              )}

              {/* 功效应用 */}
              {tabValue === 1 && (
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" gutterBottom>
                      功效
                    </Typography>
                    <List>
                      {selectedHerb.functions.map((func: string, index: number) => (
                        <ListItem key={index}>
                          <ListItemIcon>
                            <NatureIcon color="primary" />
                          </ListItemIcon>
                          <ListItemText primary={func} />
                        </ListItem>
                      ))}
                    </List>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" gutterBottom>
                      常见应用
                    </Typography>
                    <Typography paragraph>
                      {selectedHerb.commonUsage}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" gutterBottom>
                      使用注意事项
                    </Typography>
                    <List>
                      <ListItem>
                        <ListItemIcon>
                          <WarningIcon color="warning" />
                        </ListItemIcon>
                        <ListItemText primary={selectedHerb.precautions} />
                      </ListItem>
                    </List>
                  </Grid>
                </Grid>
              )}

              {/* 相关处方 */}
              {tabValue === 2 && (
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="subtitle1" gutterBottom>
                      常用于以下处方
                    </Typography>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>处方名称</TableCell>
                            <TableCell>组成</TableCell>
                            <TableCell>功效</TableCell>
                            <TableCell>应用</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {findPrescriptionsWithHerb(selectedHerb.name).map((prescription) => (
                            <TableRow key={prescription.id}>
                              <TableCell>{prescription.name}</TableCell>
                              <TableCell>{prescription.herbs.join('、')}</TableCell>
                              <TableCell>{prescription.function}</TableCell>
                              <TableCell>{prescription.application}</TableCell>
                            </TableRow>
                          ))}
                          {findPrescriptionsWithHerb(selectedHerb.name).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} align="center">
                                暂无相关处方记录
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Grid>
                </Grid>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>关闭</Button>
              <Button variant="contained" startIcon={<BookmarkIcon />}>
                添加到常用药材
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default HerbalKnowledgeBase; 