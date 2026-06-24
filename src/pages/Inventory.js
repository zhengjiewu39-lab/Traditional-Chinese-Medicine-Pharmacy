import React, { useState } from 'react';
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
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';

const initialInventory = [
  {
    id: 1,
    name: '人参',
    category: '补气药',
    quantity: 100,
    unit: '克',
    price: 200,
    expiryDate: '2024-12-31',
  },
  {
    id: 2,
    name: '当归',
    category: '补血药',
    quantity: 150,
    unit: '克',
    price: 50,
    expiryDate: '2024-12-31',
  },
  {
    id: 3,
    name: '黄芪',
    category: '补气药',
    quantity: 200,
    unit: '克',
    price: 30,
    expiryDate: '2024-12-31',
  },
];

function Inventory() {
  const [inventory, setInventory] = useState(initialInventory);
  const [open, setOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    category: '',
    quantity: '',
    unit: '',
    price: '',
    expiryDate: '',
  });

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleAddItem = () => {
    setInventory([
      ...inventory,
      {
        id: inventory.length + 1,
        ...newItem,
        quantity: Number(newItem.quantity),
        price: Number(newItem.price),
      },
    ]);
    setNewItem({
      name: '',
      category: '',
      quantity: '',
      unit: '',
      price: '',
      expiryDate: '',
    });
    handleClose();
  };

  return (
    <div>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">库存管理</Typography>
        <Button variant="contained" color="primary" onClick={handleClickOpen}>
          添加药品
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>药品名称</TableCell>
              <TableCell>类别</TableCell>
              <TableCell>数量</TableCell>
              <TableCell>单位</TableCell>
              <TableCell>单价</TableCell>
              <TableCell>有效期</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {inventory.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.category}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>{item.unit}</TableCell>
                <TableCell>{item.price}</TableCell>
                <TableCell>{item.expiryDate}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>添加新药品</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="药品名称"
            fullWidth
            value={newItem.name}
            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label="类别"
            fullWidth
            value={newItem.category}
            onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
          />
          <TextField
            margin="dense"
            label="数量"
            type="number"
            fullWidth
            value={newItem.quantity}
            onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
          />
          <TextField
            margin="dense"
            label="单位"
            fullWidth
            value={newItem.unit}
            onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
          />
          <TextField
            margin="dense"
            label="单价"
            type="number"
            fullWidth
            value={newItem.price}
            onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
          />
          <TextField
            margin="dense"
            label="有效期"
            type="date"
            fullWidth
            value={newItem.expiryDate}
            onChange={(e) => setNewItem({ ...newItem, expiryDate: e.target.value })}
            InputLabelProps={{
              shrink: true,
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>取消</Button>
          <Button onClick={handleAddItem} color="primary">
            添加
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default Inventory; 