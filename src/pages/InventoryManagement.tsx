import React, { useState } from 'react';
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
  IconButton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  LocalShipping as ShippingIcon,
} from '@mui/icons-material';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  specification: string;
  quantity: number;
  minQuantity: number;
  maxQuantity: number;
  unit: string;
  price: number;
  supplier: string;
  location: string;
  lastUpdated: string;
}

const initialInventory: InventoryItem[] = [
  {
    id: 'INV001',
    name: '人参',
    category: '中药材',
    specification: '一等品',
    quantity: 50,
    minQuantity: 20,
    maxQuantity: 100,
    unit: '克',
    price: 500.00,
    supplier: '吉林人参有限公司',
    location: 'A区-01-01',
    lastUpdated: '2024-03-15',
  },
  {
    id: 'INV002',
    name: '当归',
    category: '中药材',
    specification: '统货',
    quantity: 15,
    minQuantity: 30,
    maxQuantity: 200,
    unit: '克',
    price: 93.33,
    supplier: '甘肃中药材有限公司',
    location: 'A区-01-02',
    lastUpdated: '2024-03-14',
  },
];

const InventoryManagement: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogType, setDialogType] = useState<'add' | 'edit'>('add');

  const handleOpenDialog = (item?: InventoryItem, type: 'add' | 'edit' = 'add') => {
    if (item) {
      setSelectedItem(item);
    } else {
      setSelectedItem({
        id: '',
        name: '',
        category: '',
        specification: '',
        quantity: 0,
        minQuantity: 0,
        maxQuantity: 0,
        unit: '',
        price: 0,
        supplier: '',
        location: '',
        lastUpdated: new Date().toISOString().split('T')[0],
      });
    }
    setDialogType(type);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedItem(null);
  };

  const handleSave = () => {
    if (selectedItem) {
      if (dialogType === 'add') {
        setInventory([...inventory, { ...selectedItem, id: `INV${Date.now()}` }]);
      } else {
        setInventory(inventory.map(item =>
          item.id === selectedItem.id ? selectedItem : item
        ));
      }
    }
    handleCloseDialog();
  };

  const getStockStatus = (item: InventoryItem) => {
    const percentage = (item.quantity / item.maxQuantity) * 100;
    if (item.quantity <= item.minQuantity) {
      return { color: 'error', label: '库存不足' };
    } else if (percentage >= 90) {
      return { color: 'warning', label: '库存偏高' };
    } else {
      return { color: 'success', label: '库存正常' };
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">库存管理</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          添加商品
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>商品编号</TableCell>
              <TableCell>商品名称</TableCell>
              <TableCell>分类</TableCell>
              <TableCell>规格</TableCell>
              <TableCell>库存状态</TableCell>
              <TableCell>库存量</TableCell>
              <TableCell>单位</TableCell>
              <TableCell>单价</TableCell>
              <TableCell>操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {inventory.map((item) => {
              const status = getStockStatus(item);
              return (
                <TableRow key={item.id}>
                  <TableCell>{item.id}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{item.specification}</TableCell>
                  <TableCell>
                    <Chip
                      label={status.label}
                      color={status.color}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Box sx={{ width: '100%', mr: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={(item.quantity / item.maxQuantity) * 100}
                          color={status.color}
                        />
                      </Box>
                      <Box sx={{ minWidth: 35 }}>
                        <Typography variant="body2" color="text.secondary">
                          {item.quantity}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell>¥{item.price.toFixed(2)}</TableCell>
                  <TableCell>
                    <Tooltip title="编辑">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(item, 'edit')}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="补货">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setInventory(inventory.map(i =>
                            i.id === item.id
                              ? { ...i, quantity: i.maxQuantity }
                              : i
                          ));
                        }}
                      >
                        <ShippingIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
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
          {dialogType === 'add' ? '添加商品' : '编辑商品'}
        </DialogTitle>
        <DialogContent>
          {selectedItem && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="商品名称"
                  value={selectedItem.name}
                  onChange={(e) => setSelectedItem({ ...selectedItem, name: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="分类"
                  value={selectedItem.category}
                  onChange={(e) => setSelectedItem({ ...selectedItem, category: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="规格"
                  value={selectedItem.specification}
                  onChange={(e) => setSelectedItem({ ...selectedItem, specification: e.target.value })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="单位"
                  value={selectedItem.unit}
                  onChange={(e) => setSelectedItem({ ...selectedItem, unit: e.target.value })}
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  fullWidth
                  label="当前库存"
                  type="number"
                  value={selectedItem.quantity}
                  onChange={(e) => setSelectedItem({ ...selectedItem, quantity: Number(e.target.value) })}
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  fullWidth
                  label="最低库存"
                  type="number"
                  value={selectedItem.minQuantity}
                  onChange={(e) => setSelectedItem({ ...selectedItem, minQuantity: Number(e.target.value) })}
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  fullWidth
                  label="最高库存"
                  type="number"
                  value={selectedItem.maxQuantity}
                  onChange={(e) => setSelectedItem({ ...selectedItem, maxQuantity: Number(e.target.value) })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="单价"
                  type="number"
                  value={selectedItem.price}
                  onChange={(e) => setSelectedItem({ ...selectedItem, price: Number(e.target.value) })}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="供应商"
                  value={selectedItem.supplier}
                  onChange={(e) => setSelectedItem({ ...selectedItem, supplier: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="存放位置"
                  value={selectedItem.location}
                  onChange={(e) => setSelectedItem({ ...selectedItem, location: e.target.value })}
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button variant="contained" onClick={handleSave}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InventoryManagement; 