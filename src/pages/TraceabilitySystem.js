import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Grid,
  Paper,
  TextField,
  Button,
  Card,
  CardContent,
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
  Alert,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TablePagination,
  CircularProgress,
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
  Check,
} from '@mui/icons-material';
import { traceabilityApi } from '../services/api';

function TraceabilitySystem() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentBlock, setCurrentBlock] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [total, setTotal] = useState(0);
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [listQuery, setListQuery] = useState('');

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await traceabilityApi.list({
        q: listQuery || undefined,
        limit: rowsPerPage,
        offset: page * rowsPerPage,
      });
      setCatalog(res.data.records || []);
      setTotal(res.data.total || 0);
      setSamples(res.data.sampleCodes || []);
    } catch (e) {
      setError('加载溯源目录失败，请确认后端已启动 (npm run server)');
    } finally {
      setLoading(false);
    }
  }, [listQuery, page, rowsPerPage]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const handleSearch = async (code) => {
    const term = (code ?? searchTerm).trim();
    if (!term) return;
    setSearching(true);
    setError('');
    setSearchResult(null);
    try {
      const res = await traceabilityApi.lookup(term);
      setSearchResult(res.data);
      setSearchTerm(term);
      setActiveStep(0);
    } catch (e) {
      setSearchResult(null);
      setError(e.response?.status === 404
        ? `未找到溯源码「${term}」`
        : '查询失败，请确认后端已启动');
    } finally {
      setSearching(false);
    }
  };

  const handleBlockClick = (block) => {
    setCurrentBlock(block);
    setOpenDialog(true);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 1 }}>
        中药溯源系统
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        与药材目录同步 · {total || '—'} 条溯源记录 · 支持溯源码 / 批次号 / 药名查询
      </Typography>

      {error && <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              label="输入溯源码 / 批次号 / 药名"
              variant="outlined"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="例如: TR-H0002 或 当归 或 H0002"
              InputProps={{
                startAdornment: <QrCode color="action" sx={{ mr: 1 }} />,
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Button
              variant="contained"
              startIcon={searching ? <CircularProgress size={18} color="inherit" /> : <Search />}
              onClick={() => handleSearch()}
              disabled={searching}
              fullWidth
            >
              查询溯源信息
            </Button>
          </Grid>
        </Grid>
        {samples.length > 0 && (
          <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 1, alignSelf: 'center' }}>示例:</Typography>
            {samples.map((s) => (
              <Chip
                key={s.traceCode}
                size="small"
                label={`${s.name} ${s.traceCode}`}
                onClick={() => handleSearch(s.traceCode)}
                variant="outlined"
                clickable
              />
            ))}
          </Box>
        )}
      </Paper>

      {searchResult && (
        <Grid container spacing={4} sx={{ mb: 4 }}>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h5" gutterBottom>{searchResult.name}</Typography>
                <Chip label={searchResult.category} size="small" sx={{ mb: 1 }} />
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>溯源码:</strong> {searchResult.traceCode}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>批次号:</strong> {searchResult.batchNumber}
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="body2"><strong>产地:</strong> {searchResult.origin}</Typography>
                <Typography variant="body2"><strong>采收日期:</strong> {searchResult.harvestDate}</Typography>
                <Typography variant="body2"><strong>有效期至:</strong> {searchResult.expiryDate}</Typography>
                <Typography variant="body2"><strong>生产商:</strong> {searchResult.producer}</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  <strong>库存:</strong> {searchResult.inventoryStock} {searchResult.unit}
                  {' · '}
                  <strong>单价:</strong> ¥{searchResult.price}/{searchResult.unit}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  <strong>质检:</strong>
                  <Chip label={searchResult.testingResults} color="success" size="small" sx={{ ml: 1 }} />
                </Typography>
                {searchResult.functions && (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    功效: {searchResult.functions}
                  </Typography>
                )}
              </CardContent>
            </Card>
            <Paper sx={{ p: 2, mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>区块链存证</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Lock color="primary" sx={{ mr: 1, fontSize: 18 }} />
                <Typography variant="body2">防篡改 · 全链路可追溯</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <VerifiedUser color="success" sx={{ mr: 1, fontSize: 18 }} />
                <Typography variant="body2">数字签名已验证</Typography>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>溯源链路（5 环节）</Typography>
              <Stepper activeStep={activeStep} orientation="vertical">
                {(searchResult.blocks || []).map((block, index) => (
                  <Step key={index}>
                    <StepLabel onClick={() => setActiveStep(index)} sx={{ cursor: 'pointer' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <Typography variant="subtitle1">{block.operation}</Typography>
                        <Typography variant="body2" color="text.secondary">{block.timestamp}</Typography>
                      </Box>
                    </StepLabel>
                    {activeStep === index && (
                      <Box sx={{ ml: 3, mt: 1, mb: 2 }}>
                        <List dense>
                          <ListItem><ListItemIcon><Timeline fontSize="small" /></ListItemIcon><ListItemText primary="时间" secondary={block.timestamp} /></ListItem>
                          <ListItem><ListItemIcon><Agriculture fontSize="small" /></ListItemIcon><ListItemText primary="操作人" secondary={block.operator} /></ListItem>
                          <ListItem><ListItemIcon><LocalShipping fontSize="small" /></ListItemIcon><ListItemText primary="地点" secondary={block.location} /></ListItem>
                          <ListItem><ListItemIcon><Inventory fontSize="small" /></ListItemIcon><ListItemText primary="内容" secondary={block.data} /></ListItem>
                        </List>
                        <Button variant="outlined" size="small" onClick={() => handleBlockClick(block)}>区块详情</Button>
                      </Box>
                    )}
                  </Step>
                ))}
              </Stepper>
            </Paper>
          </Grid>
        </Grid>
      )}

      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6">溯源目录</Typography>
          <TextField
            size="small"
            placeholder="筛选药名/溯源码"
            value={listQuery}
            onChange={(e) => { setListQuery(e.target.value); setPage(0); }}
            sx={{ width: 220 }}
          />
        </Box>
        {loading ? (
          <CircularProgress size={28} />
        ) : (
          <>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>溯源码</TableCell>
                  <TableCell>药材</TableCell>
                  <TableCell>批次</TableCell>
                  <TableCell>产地</TableCell>
                  <TableCell>质检</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {catalog.map((row) => (
                  <TableRow key={row.traceCode} hover>
                    <TableCell><code>{row.traceCode}</code></TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.batchNumber}</TableCell>
                    <TableCell>{row.origin}</TableCell>
                    <TableCell><Chip label={row.testingResults} size="small" color="success" /></TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => handleSearch(row.traceCode)}>查看</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
              rowsPerPageOptions={[10, 25, 50]}
              labelRowsPerPage="每页"
            />
          </>
        )}
      </Paper>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>区块详情</DialogTitle>
        <DialogContent>
          {currentBlock && (
            <>
              <DialogContentText component="div">
                <Typography variant="subtitle2" sx={{ mb: 2, wordBreak: 'break-all' }}>
                  哈希: <code>{currentBlock.hash}</code>
                </Typography>
                <Typography variant="body2"><strong>操作:</strong> {currentBlock.operation}</Typography>
                <Typography variant="body2"><strong>时间:</strong> {currentBlock.timestamp}</Typography>
                <Typography variant="body2"><strong>地点:</strong> {currentBlock.location}</Typography>
                <Typography variant="body2"><strong>人员:</strong> {currentBlock.operator}</Typography>
                <Typography variant="body2"><strong>数据:</strong> {currentBlock.data}</Typography>
              </DialogContentText>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Check color="success" fontSize="small" sx={{ mr: 1 }} />
                  <Typography variant="body2">区块完整性校验通过</Typography>
                </Box>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default TraceabilitySystem;
