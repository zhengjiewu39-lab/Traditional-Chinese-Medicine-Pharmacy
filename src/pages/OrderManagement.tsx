import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  Snackbar,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocalShipping as ShippingIcon,
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

interface Order {
  id: string;
  customerName: string;
  orderDate: string;
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  items: OrderItem[];
  shippingAddress: string;
  paymentMethod: string;
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

const initialOrders: Order[] = [
  {
    id: 'ORD001',
    customerName: '张三',
    orderDate: '2024-03-15',
    totalAmount: 1280.00,
    status: 'pending',
    items: [
      { id: '1', name: '人参', quantity: 2, price: 500.00 },
      { id: '2', name: '当归', quantity: 3, price: 93.33 },
    ],
    shippingAddress: '北京市朝阳区建国路88号',
    paymentMethod: '微信支付',
  },
  {
    id: 'ORD002',
    customerName: '李四',
    orderDate: '2024-03-14',
    totalAmount: 560.00,
    status: 'processing',
    items: [
      { id: '3', name: '黄芪', quantity: 4, price: 140.00 },
    ],
    shippingAddress: '上海市浦东新区陆家嘴1号',
    paymentMethod: '支付宝',
  },
];

const statusColors = {
  pending: 'warning',
  processing: 'info',
  shipped: 'primary',
  delivered: 'success',
  cancelled: 'error',
} as const;

const statusLabels = {
  pending: '待处理',
  processing: '处理中',
  shipped: '已发货',
  delivered: '已送达',
  cancelled: '已取消',
} as const;

const OrderManagement: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogType, setDialogType] = useState<'view' | 'edit'>('view');
  
  // AI 驱动配送优化相关状态
  const [openAIDialog, setOpenAIDialog] = useState(false);
  const [optimizationLoading, setOptimizationLoading] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<any>(null);
  const [selectedVehicle, setSelectedVehicle] = useState('vehicle1');
  
  // 自动添加新订单相关状态
  const [autoAddEnabled, setAutoAddEnabled] = useState(false);
  const [openNewOrderDialog, setOpenNewOrderDialog] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState<Partial<Order>>({
    customerName: '',
    totalAmount: 0,
    shippingAddress: '',
    paymentMethod: '微信支付',
    status: 'pending',
    items: [],
  });
  const [newOrderItem, setNewOrderItem] = useState({
    name: '',
    quantity: 1,
    price: 0,
  });
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'info' | 'warning' | 'error',
  });

  // 自动添加订单计时器
  useEffect(() => {
    let autoAddInterval: ReturnType<typeof setInterval> | null = null;
    
    if (autoAddEnabled) {
      autoAddInterval = setInterval(() => {
        const randomOrder = generateRandomOrder();
        addNewOrder(randomOrder);
        
        setNotification({
          open: true,
          message: `系统已自动添加新订单: ${randomOrder.id}`,
          severity: 'info',
        });
      }, 30000); // 每30秒自动添加一个订单
    }
    
    return () => {
      if (autoAddInterval) {
        clearInterval(autoAddInterval);
      }
    };
  }, [autoAddEnabled]);

  const handleOpenDialog = (order: Order, type: 'view' | 'edit') => {
    setSelectedOrder(order);
    setDialogType(type);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedOrder(null);
  };

  const handleStatusChange = (orderId: string, newStatus: Order['status']) => {
    setOrders(orders.map(order =>
      order.id === orderId ? { ...order, status: newStatus } : order
    ));
  };

  // 生成随机订单
  const generateRandomOrder = (): Order => {
    const customers = ['王明', '李芳', '张伟', '赵丽', '刘强', '陈红', '杨雪', '周刚'];
    const medicines = [
      { name: '人参', price: 500 },
      { name: '当归', price: 93.33 },
      { name: '黄芪', price: 140 },
      { name: '枸杞', price: 120 },
      { name: '灵芝', price: 400 },
      { name: '何首乌', price: 180 },
      { name: '百合', price: 150 },
      { name: '甘草', price: 60 }
    ];
    const addresses = [
      '北京市朝阳区建国路88号',
      '上海市浦东新区陆家嘴1号',
      '广州市天河区体育西路12号',
      '深圳市南山区科技园路33号',
      '成都市锦江区红星路18号',
      '杭州市西湖区文三路99号',
      '武汉市江汉区解放大道66号',
      '南京市鼓楼区中山北路1号'
    ];
    const paymentMethods = ['微信支付', '支付宝', '银联', '现金支付'];
    
    // 随机生成订单项
    const itemCount = Math.floor(Math.random() * 3) + 1;
    const items: OrderItem[] = [];
    let totalAmount = 0;
    
    for (let i = 0; i < itemCount; i++) {
      const medicine = medicines[Math.floor(Math.random() * medicines.length)];
      const quantity = Math.floor(Math.random() * 5) + 1;
      const item: OrderItem = {
        id: `item-${Date.now()}-${i}`,
        name: medicine.name,
        quantity: quantity,
        price: medicine.price
      };
      items.push(item);
      totalAmount += item.price * item.quantity;
    }
    
    // 生成当前日期
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const orderDate = `${year}-${month}-${day}`;
    
    // 生成订单ID
    const orderNumber = Math.floor(1000 + Math.random() * 9000);
    
    return {
      id: `ORD${orderNumber}`,
      customerName: customers[Math.floor(Math.random() * customers.length)],
      orderDate: orderDate,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      status: 'pending',
      items: items,
      shippingAddress: addresses[Math.floor(Math.random() * addresses.length)],
      paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)]
    };
  };
  
  // 添加新订单
  const addNewOrder = (order: Order) => {
    setOrders([order, ...orders]);
  };
  
  // 处理新订单提交
  const handleSubmitNewOrder = () => {
    if (!newOrderForm.customerName || !newOrderForm.shippingAddress || newOrderForm.items?.length === 0) {
      setNotification({
        open: true,
        message: '请填写完整订单信息',
        severity: 'error',
      });
      return;
    }
    
    const totalAmount = newOrderForm.items?.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0;
    
    const newOrder: Order = {
      id: `ORD${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: newOrderForm.customerName || '',
      orderDate: new Date().toISOString().split('T')[0],
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      status: 'pending',
      items: newOrderForm.items || [],
      shippingAddress: newOrderForm.shippingAddress || '',
      paymentMethod: newOrderForm.paymentMethod || '微信支付',
    };
    
    addNewOrder(newOrder);
    setOpenNewOrderDialog(false);
    setNewOrderForm({
      customerName: '',
      totalAmount: 0,
      shippingAddress: '',
      paymentMethod: '微信支付',
      status: 'pending',
      items: [],
    });
    
    setNotification({
      open: true,
      message: `成功创建订单: ${newOrder.id}`,
      severity: 'success',
    });
  };
  
  // 添加新订单项
  const handleAddOrderItem = () => {
    if (!newOrderItem.name || newOrderItem.quantity <= 0 || newOrderItem.price <= 0) {
      return;
    }
    
    const newItem: OrderItem = {
      id: `item-${Date.now()}`,
      name: newOrderItem.name,
      quantity: newOrderItem.quantity,
      price: newOrderItem.price,
    };
    
    setNewOrderForm({
      ...newOrderForm,
      items: [...(newOrderForm.items || []), newItem],
    });
    
    setNewOrderItem({
      name: '',
      quantity: 1,
      price: 0,
    });
  };
  
  // 删除订单项
  const handleRemoveOrderItem = (itemId: string) => {
    setNewOrderForm({
      ...newOrderForm,
      items: newOrderForm.items?.filter(item => item.id !== itemId) || [],
    });
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
        order.status === 'pending' || order.status === 'processing'
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
        }, {} as Record<string, any>),
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
  const generateOptimizedRoute = (ordersToDeliver: Order[]) => {
    // 模拟AI生成的优化路线
    const startPoint = { name: '配送中心', address: '北京市丰台区丰科路6号' };
    const routePoints: Array<{ name: string; address: string; orderId?: string }> = [startPoint];
    
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
      if (order.status === 'pending' && optimizationResult.ordersToDeliver.some((o: Order) => o.id === order.id)) {
        return { ...order, status: 'processing' as const };
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
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          订单管理
        </Typography>
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
              <TableCell>订单日期</TableCell>
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
                <TableCell>{order.orderDate}</TableCell>
                <TableCell>¥{order.totalAmount.toFixed(2)}</TableCell>
                <TableCell>
                  <Chip
                    label={statusLabels[order.status]}
                    color={statusColors[order.status]}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Tooltip title="查看详情">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(order, 'view')}
                    >
                      <VisibilityIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="编辑订单">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(order, 'edit')}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="更新状态">
                    <IconButton
                      size="small"
                      onClick={() => {
                        const currentIndex = Object.keys(statusLabels).indexOf(order.status);
                        const nextStatus = Object.keys(statusLabels)[
                          (currentIndex + 1) % Object.keys(statusLabels).length
                        ] as Order['status'];
                        handleStatusChange(order.id, nextStatus);
                      }}
                    >
                      <ShippingIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {dialogType === 'view' ? '订单详情' : '编辑订单'}
        </DialogTitle>
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
                      disabled={dialogType === 'view'}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="订单日期"
                      value={selectedOrder.orderDate}
                      disabled
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="支付方式"
                      value={selectedOrder.paymentMethod}
                      disabled={dialogType === 'view'}
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
                      {selectedOrder.items.map((item) => (
                        <TableRow key={item.id}>
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
                  disabled={dialogType === 'view'}
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>
            {dialogType === 'view' ? '关闭' : '取消'}
          </Button>
          {dialogType === 'edit' && (
            <Button variant="contained" onClick={handleCloseDialog}>
              保存
            </Button>
          )}
        </DialogActions>
      </Dialog>

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
                                行驶约 {point.orderId && optimizationResult.estimatedDeliveryTimes[point.orderId]?.distance || '5-10'} 公里
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
              <Typography variant="subtitle1" gutterBottom>
                添加商品
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="商品名称"
                    value={newOrderItem.name}
                    onChange={(e) => setNewOrderItem({ ...newOrderItem, name: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="数量"
                    type="number"
                    InputProps={{ inputProps: { min: 1 } }}
                    value={newOrderItem.quantity}
                    onChange={(e) => setNewOrderItem({ ...newOrderItem, quantity: parseInt(e.target.value) || 1 })}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="单价"
                    type="number"
                    InputProps={{ inputProps: { min: 0, step: 0.01 } }}
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
                        <TableCell>数量</TableCell>
                        <TableCell>单价</TableCell>
                        <TableCell>小计</TableCell>
                        <TableCell>操作</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {newOrderForm.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>¥{item.price.toFixed(2)}</TableCell>
                          <TableCell>¥{(item.quantity * item.price).toFixed(2)}</TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveOrderItem(item.id)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={3} align="right">
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
            disabled={!newOrderForm.customerName || !newOrderForm.shippingAddress || !newOrderForm.items?.length}
          >
            创建订单
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default OrderManagement; 