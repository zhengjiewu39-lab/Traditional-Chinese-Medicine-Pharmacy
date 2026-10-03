import React, { useState, useEffect, useRef } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Card,
  CardContent,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Snackbar,
  Autocomplete,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Delete as DeleteIcon,
  SmartToy as AIIcon,
  Route as RouteIcon,
  Add as AddIcon,
  DirectionsCar as VehicleIcon,
  Speed as SpeedIcon,
  Save as SaveIcon,
  AccessTime as TimeIcon,
  Send as SendIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

import { ordersApi, herbsApi } from '../services/api';

const initialOrders = [];

const statusMap = {
  '已完成': 'success',
  '处理中': 'primary',
  '待付款': 'warning',
  '已取消': 'error',
  '已发货': 'info',
};

function Orders() {
  const [orders, setOrders] = useState(initialOrders);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  
  // AI 驱动配送优化相关状态
  const [openAIDialog, setOpenAIDialog] = useState(false);
  const [optimizationLoading, setOptimizationLoading] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [selectedVehicle, setSelectedVehicle] = useState('vehicle1');
  
  // 自动添加新订单相关状态
  const [autoAddEnabled, setAutoAddEnabled] = useState(false);
  const [openNewOrderDialog, setOpenNewOrderDialog] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState({
    customerName: '',
    total: 0,
    shippingAddress: '',
    paymentMethod: '微信支付',
    status: '待付款',
    items: [],
  });
  const [catalogHerbs, setCatalogHerbs] = useState([]);
  const [receiveIntoStock, setReceiveIntoStock] = useState(true);
  const [newOrderItem, setNewOrderItem] = useState({
    name: '',
    herbId: null,
    quantity: 1,
    price: 0,
    unit: '',
    stock: 0,
  });
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success',
  });
  const catalogHerbsRef = useRef([]);
  catalogHerbsRef.current = catalogHerbs;

  useEffect(() => {
    ordersApi.getOrders().then((res) => {
      if (res.data?.length) setOrders(res.data);
    }).catch(console.error);
    herbsApi.getAllHerbs().then((res) => {
      setCatalogHerbs(res.data || []);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!autoAddEnabled) return undefined;
    const timer = setInterval(() => {
      const medicines = catalogHerbsRef.current.filter((h) => Number(h.stock) >= 0);
      if (!medicines.length) return;
      const medicine = medicines[Math.floor(Math.random() * medicines.length)];
      const quantity = Math.floor(Math.random() * 5) + 1;
      const customers = ['王明', '李芳', '张伟', '赵丽', '刘强', '陈红', '杨雪', '周刚'];
      const addresses = [
        '北京市朝阳区建国路88号', '上海市浦东新区陆家嘴1号', '广州市天河区体育西路12号',
        '深圳市南山区科技园路33号', '成都市锦江区红星路18号',
      ];
      const order = {
        customerName: customers[Math.floor(Math.random() * customers.length)],
        date: new Date().toISOString().slice(0, 10),
        items: [{ herbId: medicine.id, name: medicine.name, quantity, price: medicine.price, unit: medicine.unit }],
        shippingAddress: addresses[Math.floor(Math.random() * addresses.length)],
        paymentMethod: '微信支付',
        status: '待付款',
        deductStock: false,
        receiveIntoStock: false,
      };
      ordersApi.createOrder(order).then((res) => {
        setOrders((prev) => [res.data, ...prev]);
        herbsApi.getAllHerbs().then((r) => setCatalogHerbs(r.data || [])).catch(() => {});
        setNotification({
          open: true,
          message: `系统已自动添加新订单: ${res.data.orderNo || res.data.id}`,
          severity: 'info',
        });
      }).catch((e) => {
        setNotification({
          open: true,
          message: e.response?.data?.message || '自动订单未写入：药品须在仓库目录中',
          severity: 'error',
        });
      });
    }, 30000);
    return () => clearInterval(timer);
  }, [autoAddEnabled]);

  const getStatusColor = (status) => {
    return statusMap[status] || 'default';
  };

  // 处理新订单提交
  const handleSubmitNewOrder = async () => {
    if (!newOrderForm.customerName || !newOrderForm.shippingAddress || newOrderForm.items.length === 0) {
      setNotification({
        open: true,
        message: '请填写完整订单信息',
        severity: 'error',
      });
      return;
    }
    
    const total = newOrderForm.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
    const newOrder = {
      customerName: newOrderForm.customerName,
      date: new Date().toISOString().split('T')[0],
      total: parseFloat(total.toFixed(2)),
      status: '待付款',
      items: newOrderForm.items,
      shippingAddress: newOrderForm.shippingAddress,
      paymentMethod: newOrderForm.paymentMethod,
      deductStock: false,
      receiveIntoStock,
      orderType: receiveIntoStock ? '采购' : '销售',
    };

    try {
      const res = await ordersApi.createOrder(newOrder);
      setOrders((prev) => [res.data, ...prev]);
      herbsApi.getAllHerbs().then((r) => setCatalogHerbs(r.data || [])).catch(() => {});
    } catch (e) {
      setNotification({
        open: true,
        message: e.response?.data?.message || '创建订单失败。药品必须在仓库目录中。',
        severity: 'error',
      });
      return;
    }
    setOpenNewOrderDialog(false);
    setNewOrderForm({
      customerName: '',
      total: 0,
      shippingAddress: '',
      paymentMethod: '微信支付',
      status: '待付款',
      items: [],
    });
    
    setNotification({
      open: true,
      message: `成功创建订单: ${newOrder.customerName}`,
      severity: 'success',
    });
  };
  
  // 添加新订单项
  const handleAddOrderItem = () => {
    if (!newOrderItem.herbId || !newOrderItem.name || newOrderItem.quantity <= 0) {
      setNotification({ open: true, message: '请从仓库目录选择药品', severity: 'error' });
      return;
    }

    setNewOrderForm({
      ...newOrderForm,
      items: [...newOrderForm.items, {
        herbId: newOrderItem.herbId,
        name: newOrderItem.name,
        quantity: newOrderItem.quantity,
        price: newOrderItem.price,
        unit: newOrderItem.unit,
      }],
    });

    setNewOrderItem({
      name: '',
      herbId: null,
      quantity: 1,
      price: 0,
      unit: '',
      stock: 0,
    });
  };
  
  // 删除订单项
  const handleRemoveOrderItem = (index) => {
    const updatedItems = [...newOrderForm.items];
    updatedItems.splice(index, 1);
    setNewOrderForm({
      ...newOrderForm,
      items: updatedItems
    });
  };
  
  // 查看订单详情
  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setOpenViewDialog(true);
  };

  // 处理AI配送优化
  const handleOpenAIOptimization = () => {
    setOpenAIDialog(true);
    performAIOptimization();
  };
  
  const performAIOptimization = () => {
    setOptimizationLoading(true);
    
    // 模拟AI处理时间
    setTimeout(() => {
      const pendingOrders = orders.filter(order => 
        order.status === '待付款' || order.status === '处理中'
      );
      
      if (pendingOrders.length === 0) {
        setOptimizationResult({
          success: false,
          message: '没有需要配送的订单',
        });
        setOptimizationLoading(false);
        return;
      }
      
      // 模拟AI生成的优化配送路线
      const result = {
        success: true,
        vehicle: selectedVehicle,
        vehicleDetails: {
          vehicle1: { name: '配送车辆 1', capacity: '300kg', fuelEfficiency: '8L/100km' },
          vehicle2: { name: '配送车辆 2', capacity: '500kg', fuelEfficiency: '10L/100km' },
          vehicle3: { name: '配送车辆 3', capacity: '200kg', fuelEfficiency: '6L/100km' },
        }[selectedVehicle],
        ordersToDeliver: pendingOrders,
        optimizedRoute: generateOptimizedRoute(pendingOrders),
        estimatedDeliveryTimes: pendingOrders.reduce((acc, order) => {
          acc[order.id] = {
            order: order,
            estimatedTime: `${Math.floor(Math.random() * 3) + 1}小时${Math.floor(Math.random() * 50) + 10}分钟`,
            distance: `${Math.floor(Math.random() * 15) + 5}公里`,
          };
          return acc;
        }, {}),
        totalDistance: `${Math.floor(Math.random() * 50) + 30}公里`,
        totalTime: `${Math.floor(Math.random() * 5) + 3}小时${Math.floor(Math.random() * 50) + 10}分钟`,
        fuelSaved: `${Math.floor(Math.random() * 5) + 2}升`,
        carbonReduction: `${Math.floor(Math.random() * 10) + 5}kg`,
      };
      
      setOptimizationResult(result);
      setOptimizationLoading(false);
    }, 2000);
  };
  
  // 生成优化路线
  const generateOptimizedRoute = (ordersToDeliver) => {
    // 模拟AI生成的优化路线
    const startPoint = { name: '配送中心', address: '北京市丰台区丰科路6号' };
    const routePoints = [startPoint];
    
    // 通过模拟的AI算法排序订单
    const sortedOrders = [...ordersToDeliver].sort(() => Math.random() - 0.5);
    
    sortedOrders.forEach(order => {
      routePoints.push({
        name: order.customerName,
        address: order.shippingAddress,
        orderId: order.id
      });
    });
    
    // 最后回到起点
    routePoints.push(startPoint);
    
    return routePoints;
  };
  
  // 应用AI优化结果
  const applyAIOptimization = () => {
    if (!optimizationResult || !optimizationResult.success) return;
    
    // 将所有待处理订单更新为处理中
    const updatedOrders = orders.map(order => {
      if (order.status === '待付款' && optimizationResult.ordersToDeliver.some(o => o.id === order.id)) {
        return { ...order, status: '处理中' };
      }
      return order;
    });
    
    setOrders(updatedOrders);
    setOpenAIDialog(false);
    
    setNotification({
      open: true,
      message: 'AI优化的配送方案已应用',
      severity: 'success',
    });
  };
  
  // 关闭通知
  const handleCloseNotification = () => {
    setNotification({
      ...notification,
      open: false,
    });
  };

  return (
    <div>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4">采购与订单</Typography>
          <Typography variant="body2" color="text.secondary">药品只能从仓库目录选择，数量与收银、溯源共用可用批次</Typography>
        </Box>
        <Box>
          <FormControlLabel
            control={
              <Switch
                checked={autoAddEnabled}
                onChange={(e) => setAutoAddEnabled(e.target.checked)}
                color="secondary"
              />
            }
            label="自动添加新订单"
            sx={{ mr: 2 }}
          />
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AIIcon />}
            onClick={handleOpenAIOptimization}
            sx={{ mr: 2 }}
          >
            AI优化配送
          </Button>
          <Button 
            variant="contained" 
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setOpenNewOrderDialog(true)}
          >
            新建订单
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>订单编号</TableCell>
              <TableCell>客户名称</TableCell>
              <TableCell>日期</TableCell>
              <TableCell>订单内容</TableCell>
              <TableCell>总金额</TableCell>
              <TableCell>状态</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>{order.id}</TableCell>
                <TableCell>{order.customerName}</TableCell>
                <TableCell>{order.date}</TableCell>
                <TableCell>
                  {order.items.map((item, index) => (
                    <div key={index}>
                      {item.name} x {item.quantity}
                    </div>
                  ))}
                </TableCell>
                <TableCell>¥{order.total}</TableCell>
                <TableCell>
                  <Chip
                    label={order.status}
                    color={getStatusColor(order.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Tooltip title="查看详情">
                    <IconButton
                      size="small"
                      onClick={() => handleViewOrder(order)}
                    >
                      <VisibilityIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 订单详情对话框 */}
      <Dialog
        open={openViewDialog}
        onClose={() => setOpenViewDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>订单详情</DialogTitle>
        <DialogContent>
          {selectedOrder && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Typography variant="subtitle1">基本信息</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="订单编号"
                      value={selectedOrder.id}
                      disabled
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="客户名称"
                      value={selectedOrder.customerName}
                      disabled
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="订单日期"
                      value={selectedOrder.date}
                      disabled
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="支付方式"
                      value={selectedOrder.paymentMethod}
                      disabled
                    />
                  </Grid>
                </Grid>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle1">商品清单</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>商品名称</TableCell>
                        <TableCell>数量</TableCell>
                        <TableCell>单价</TableCell>
                        <TableCell>小计</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedOrder.items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>¥{item.price.toFixed(2)}</TableCell>
                          <TableCell>¥{(item.quantity * item.price).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle1">配送信息</Typography>
                <TextField
                  fullWidth
                  label="配送地址"
                  value={selectedOrder.shippingAddress}
                  disabled
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenViewDialog(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* AI配送优化对话框 */}
      <Dialog
        open={openAIDialog}
        onClose={() => setOpenAIDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <AIIcon sx={{ mr: 1 }} /> 
          AI驱动的订单配送优化
        </DialogTitle>
        <DialogContent>
          {optimizationLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4 }}>
              <CircularProgress size={60} />
              <Typography variant="h6" sx={{ mt: 2 }}>
                AI正在分析订单数据并生成最优配送方案...
              </Typography>
            </Box>
          ) : optimizationResult && !optimizationResult.success ? (
            <Alert severity="warning" sx={{ my: 2 }}>
              <AlertTitle>无法生成配送方案</AlertTitle>
              {optimizationResult.message}
            </Alert>
          ) : optimizationResult && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      配送车辆选择
                    </Typography>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                      <InputLabel>选择配送车辆</InputLabel>
                      <Select
                        value={selectedVehicle}
                        label="选择配送车辆"
                        onChange={(e) => setSelectedVehicle(e.target.value)}
                      >
                        <MenuItem value="vehicle1">配送车辆 1</MenuItem>
                        <MenuItem value="vehicle2">配送车辆 2</MenuItem>
                        <MenuItem value="vehicle3">配送车辆 3</MenuItem>
                      </Select>
                    </FormControl>
                    
                    {optimizationResult.vehicleDetails && (
                      <Box>
                        <Typography variant="subtitle2">车辆信息:</Typography>
                        <Typography variant="body2">
                          载重能力: {optimizationResult.vehicleDetails.capacity}
                        </Typography>
                        <Typography variant="body2">
                          油耗: {optimizationResult.vehicleDetails.fuelEfficiency}
                        </Typography>
                      </Box>
                    )}
                    
                    <Divider sx={{ my: 2 }} />
                    
                    <Typography variant="subtitle1" gutterBottom>
                      优化结果
                    </Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <RouteIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="body2">
                        总配送距离: {optimizationResult.totalDistance}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <TimeIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="body2">
                        预计总时间: {optimizationResult.totalTime}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <SpeedIcon color="success" sx={{ mr: 1 }} />
                      <Typography variant="body2">
                        节省燃油: {optimizationResult.fuelSaved}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <VehicleIcon color="success" sx={{ mr: 1 }} />
                      <Typography variant="body2">
                        减少碳排放: {optimizationResult.carbonReduction}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={8}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      AI优化配送路线
                    </Typography>
                    
                    <List>
                      {optimizationResult.optimizedRoute.map((point, index) => (
                        <React.Fragment key={index}>
                          <ListItem>
                            <ListItemIcon>
                              {index === 0 || index === optimizationResult.optimizedRoute.length - 1 ? (
                                <VehicleIcon color="primary" />
                              ) : (
                                <SendIcon color="secondary" />
                              )}
                            </ListItemIcon>
                            <ListItemText
                              primary={point.name}
                              secondary={point.address}
                            />
                            {point.orderId && optimizationResult.estimatedDeliveryTimes[point.orderId] && (
                              <Chip
                                label={`预计: ${optimizationResult.estimatedDeliveryTimes[point.orderId].estimatedTime}`}
                                size="small"
                                color="info"
                                sx={{ ml: 1 }}
                              />
                            )}
                          </ListItem>
                          {index < optimizationResult.optimizedRoute.length - 1 && (
                            <Box sx={{ display: 'flex', alignItems: 'center', pl: 8, py: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                行驶约 {(point.orderId && optimizationResult.estimatedDeliveryTimes[point.orderId]?.distance) || '5-10'} 公里
                              </Typography>
                            </Box>
                          )}
                        </React.Fragment>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAIDialog(false)}>
            取消
          </Button>
          <Button
            disabled={optimizationLoading || !optimizationResult || !optimizationResult.success}
            variant="contained"
            color="primary"
            onClick={applyAIOptimization}
            startIcon={<SaveIcon />}
          >
            应用优化方案
          </Button>
          <Button
            disabled={optimizationLoading}
            onClick={performAIOptimization}
            startIcon={<RefreshIcon />}
          >
            重新优化
          </Button>
        </DialogActions>
      </Dialog>

      {/* 新建订单对话框 */}
      <Dialog
        open={openNewOrderDialog}
        onClose={() => setOpenNewOrderDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          创建新订单
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="客户名称"
                required
                value={newOrderForm.customerName}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, customerName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="支付方式"
                select
                value={newOrderForm.paymentMethod}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, paymentMethod: e.target.value })}
              >
                <MenuItem value="微信支付">微信支付</MenuItem>
                <MenuItem value="支付宝">支付宝</MenuItem>
                <MenuItem value="银联">银联</MenuItem>
                <MenuItem value="现金支付">现金支付</MenuItem>
              </TextField>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="配送地址"
                required
                multiline
                rows={2}
                value={newOrderForm.shippingAddress}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, shippingAddress: e.target.value })}
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch checked={receiveIntoStock} onChange={(e) => setReceiveIntoStock(e.target.checked)} />}
                label="采购入库（确认后增加仓库可用库存，与收银/溯源同步）"
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                添加商品
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Autocomplete
                    options={catalogHerbs}
                    getOptionLabel={(o) => o.name ? `${o.name}（库存 ${o.stock}${o.unit || ''}）` : ''}
                    value={catalogHerbs.find((h) => h.id === newOrderItem.herbId) || null}
                    onChange={(_, v) => setNewOrderItem({
                      name: v?.name || '',
                      herbId: v?.id || null,
                      quantity: newOrderItem.quantity,
                      price: v?.price || 0,
                      unit: v?.unit || '',
                      stock: v?.stock || 0,
                    })}
                    renderInput={(params) => <TextField {...params} label="仓库药品" required />}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="数量"
                    type="number"
                    inputProps={{ min: 1 }}
                    value={newOrderItem.quantity}
                    onChange={(e) => setNewOrderItem({ ...newOrderItem, quantity: parseInt(e.target.value) || 1 })}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="单价"
                    type="number"
                    inputProps={{ min: 0, step: 0.01 }}
                    value={newOrderItem.price}
                    onChange={(e) => setNewOrderItem({ ...newOrderItem, price: parseFloat(e.target.value) || 0 })}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    onClick={handleAddOrderItem}
                    sx={{ height: '100%' }}
                  >
                    添加
                  </Button>
                </Grid>
              </Grid>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom>
                商品清单
              </Typography>
              {newOrderForm.items && newOrderForm.items.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>商品名称</TableCell>
                        <TableCell>仓库库存</TableCell>
                        <TableCell>数量</TableCell>
                        <TableCell>单价</TableCell>
                        <TableCell>小计</TableCell>
                        <TableCell>操作</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {newOrderForm.items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>{catalogHerbs.find((h) => h.id === item.herbId)?.stock ?? '—'}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>¥{item.price.toFixed(2)}</TableCell>
                          <TableCell>¥{(item.quantity * item.price).toFixed(2)}</TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveOrderItem(index)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={4} align="right">
                          <Typography variant="subtitle2">总计:</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="subtitle2">
                            ¥{newOrderForm.items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info" sx={{ mt: 1 }}>
                  尚未添加商品，请添加至少一件商品
                </Alert>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNewOrderDialog(false)}>
            取消
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSubmitNewOrder}
            disabled={!newOrderForm.customerName || !newOrderForm.shippingAddress || !newOrderForm.items.length}
          >
            创建订单
          </Button>
        </DialogActions>
      </Dialog>

      {/* 通知提示 */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity}>
          {notification.message}
        </Alert>
      </Snackbar>
    </div>
  );
}

export default Orders; 