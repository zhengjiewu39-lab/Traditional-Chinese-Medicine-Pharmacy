import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, TextField, Button, IconButton, List, ListItem,
  ListItemText, ListItemSecondaryAction, Divider, Chip, Alert, LinearProgress,
  FormControl, InputLabel, Select, MenuItem, Dialog, DialogTitle, DialogContent,
  DialogActions, Autocomplete,
} from '@mui/material';
import {
  Add, Remove, Delete, PointOfSale, Search, Receipt, CheckCircle, Person, QrCode2,
} from '@mui/icons-material';
import { billingApi, herbsApi, customerApi, prescriptionApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const PAY_METHODS = ['微信支付', '支付宝', '现金', '银联', '医保'];

function Billing() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [herbs, setHerbs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [pickupCode, setPickupCode] = useState(searchParams.get('code') || '');
  const [linkedRx, setLinkedRx] = useState(null);
  const [prefillWarnings, setPrefillWarnings] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('微信支付');
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, c] = await Promise.all([herbsApi.getAllHerbs(), customerApi.getCustomerData()]);
      setHerbs(h.data);
      setCustomers(c.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadPickup = useCallback(async (code) => {
    if (!code?.trim()) return;
    setError('');
    try {
      const res = await prescriptionApi.getPickupByCode(code.trim().toUpperCase());
      const { prescription, prefill, patient } = res.data;
      if (prescription.status === '已完成') {
        setError('该处方已完成取药');
        return;
      }
      setLinkedRx(prescription);
      setPrefillWarnings({ missing: prefill.missing, lowStock: prefill.lowStock });
      if (prefill.items?.length) {
        setCart(prefill.items.map(i => ({
          herbId: i.herbId, name: i.name, price: i.price, unit: i.unit,
          quantity: i.quantity, stock: i.stock, fromPrescription: true,
        })));
      }
      if (patient?.customerId) {
        const cust = customers.find(c => c.id === patient.customerId);
        if (cust) setCustomer(cust);
      } else if (prescription.patientName) {
        const cust = customers.find(c => c.name === prescription.patientName);
        if (cust) setCustomer(cust);
      }
    } catch {
      setError('取药码无效');
      setLinkedRx(null);
    }
  }, [customers]);

  useEffect(() => {
    const code = searchParams.get('code');
    if (code && !loading && customers.length) loadPickup(code);
  }, [searchParams, loading, customers, loadPickup]);

  const filteredHerbs = useMemo(() => {
    if (!search) return herbs.slice(0, 12);
    const q = search.toLowerCase();
    return herbs.filter(h => h.name.includes(search) || h.pinyin?.includes(q) || h.category?.includes(search));
  }, [herbs, search]);

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const total = Math.max(0, subtotal - discount);

  const addToCart = (herb) => {
    setCart(prev => {
      const existing = prev.find(c => c.herbId === herb.id);
      if (existing) {
        return prev.map(c => c.herbId === herb.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { herbId: herb.id, name: herb.name, price: herb.price, unit: herb.unit, quantity: 1, stock: herb.stock }];
    });
  };

  const updateQty = (herbId, delta) => {
    setCart(prev => prev.map(c => {
      if (c.herbId !== herbId) return c;
      return { ...c, quantity: Math.max(1, c.quantity + delta) };
    }));
  };

  const removeItem = (herbId) => setCart(prev => prev.filter(c => c.herbId !== herbId));

  const handleCheckout = async () => {
    if (cart.length === 0) { setError('购物车为空'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await billingApi.checkout({
        customerId: customer?.id,
        customerName: customer?.name || linkedRx?.patientName,
        items: cart.map(c => ({ herbId: c.herbId, name: c.name, quantity: c.quantity })),
        paymentMethod,
        discount: Number(discount) || 0,
        prescriptionId: linkedRx?.id,
        cashier: user?.name || '收银员',
      });
      setReceipt(res.data);
      setCart([]);
      setDiscount(0);
      setLinkedRx(null);
      setPickupCode('');
      setPrefillWarnings(null);
      load();
    } catch (e) {
      setError(e.response?.data?.message || '结算失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>智慧收银台</Typography>
          <Typography variant="body2" color="text.secondary">取药码预填 · 自动扣库存 · 处方状态同步</Typography>
        </Box>
        <Chip icon={<PointOfSale />} label={`收银员：${user?.name || '—'}`} color="primary" variant="outlined" />
      </Box>

      <Paper sx={{ p: 2, mb: 3, bgcolor: 'primary.50' }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <QrCode2 color="primary" />
          <TextField
            size="small" label="扫描/输入取药码" placeholder="TCM128456"
            value={pickupCode} onChange={e => setPickupCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && loadPickup(pickupCode)}
            sx={{ flex: 1, minWidth: 200 }}
          />
          <Button variant="contained" onClick={() => loadPickup(pickupCode)}>载入处方</Button>
        </Box>
        {linkedRx && (
          <Alert severity="success" sx={{ mt: 2 }}>
            已关联处方：{linkedRx.patientName} · {linkedRx.diagnosis} · {linkedRx.pickupCode}
          </Alert>
        )}
        {prefillWarnings?.lowStock?.length > 0 && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            库存不足：{prefillWarnings.lowStock.map(i => `${i.name}(需${i.need}剩${i.stock})`).join('、')}
          </Alert>
        )}
        {prefillWarnings?.missing?.length > 0 && (
          <Alert severity="error" sx={{ mt: 1 }}>
            未找到药材：{prefillWarnings.missing.map(i => i.name).join('、')}
          </Alert>
        )}
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <TextField
              fullWidth size="small" placeholder="搜索药品名称/拼音/类别"
              value={search} onChange={e => setSearch(e.target.value)}
              InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} /> }}
            />
          </Paper>
          <Grid container spacing={1}>
            {filteredHerbs.map(herb => (
              <Grid item xs={6} sm={4} md={3} key={herb.id}>
                <Paper
                  sx={{ p: 1.5, cursor: herb.stock > 0 ? 'pointer' : 'not-allowed', opacity: herb.stock > 0 ? 1 : 0.5, '&:hover': { bgcolor: herb.stock > 0 ? 'primary.50' : 'inherit' } }}
                  onClick={() => herb.stock > 0 && addToCart(herb)}
                >
                  <Typography variant="subtitle2" fontWeight={600} noWrap>{herb.name}</Typography>
                  <Typography variant="body2" color="primary.main">¥{herb.price}/{herb.unit}</Typography>
                  <Typography variant="caption" color={herb.stock <= herb.minStock ? 'error.main' : 'text.secondary'}>
                    库存 {herb.stock}{herb.unit}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2, position: 'sticky', top: 80 }}>
            <Typography variant="h6" gutterBottom fontWeight={600}>购物车</Typography>

            <Autocomplete
              options={customers}
              getOptionLabel={o => `${o.name} (${o.phone})`}
              value={customer}
              onChange={(_, v) => setCustomer(v)}
              renderInput={params => <TextField {...params} size="small" label="关联客户（可选）" />}
              sx={{ mb: 2 }}
            />

            <List dense sx={{ maxHeight: 280, overflow: 'auto', mb: 2 }}>
              {cart.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>输入取药码或点击药品添加</Typography>}
              {cart.map(item => (
                <ListItem key={item.herbId} divider>
                  <ListItemText
                    primary={<>{item.name} {item.fromPrescription && <Chip label="处方" size="small" sx={{ ml: 0.5, height: 18 }} />}</>}
                    secondary={`¥${item.price} × ${item.quantity} = ¥${(item.price * item.quantity).toFixed(2)}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton size="small" onClick={() => updateQty(item.herbId, -1)}><Remove fontSize="small" /></IconButton>
                    <Typography component="span" sx={{ mx: 0.5 }}>{item.quantity}</Typography>
                    <IconButton size="small" onClick={() => updateQty(item.herbId, 1)}><Add fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => removeItem(item.herbId)}><Delete fontSize="small" /></IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>

            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography>小计</Typography><Typography>¥{subtotal.toFixed(2)}</Typography>
            </Box>
            <TextField
              size="small" label="优惠金额" type="number" fullWidth sx={{ mb: 1 }}
              value={discount} onChange={e => setDiscount(e.target.value)}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" fontWeight={700}>应付</Typography>
              <Typography variant="h6" fontWeight={700} color="primary.main">¥{total.toFixed(2)}</Typography>
            </Box>

            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>支付方式</InputLabel>
              <Select value={paymentMethod} label="支付方式" onChange={e => setPaymentMethod(e.target.value)}>
                {PAY_METHODS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </Select>
            </FormControl>

            <Button
              variant="contained" fullWidth size="large" startIcon={<PointOfSale />}
              disabled={cart.length === 0 || submitting} onClick={handleCheckout}
            >
              {submitting ? '结算中...' : linkedRx ? '确认收款并完成取药' : '确认收款'}
            </Button>
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={Boolean(receipt)} onClose={() => setReceipt(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ textAlign: 'center' }}>
          <CheckCircle color="success" sx={{ fontSize: 48, display: 'block', mx: 'auto', mb: 1 }} />
          结算成功
        </DialogTitle>
        <DialogContent>
          <Typography align="center" gutterBottom>小票号：{receipt?.bill?.billNo}</Typography>
          <Typography align="center" variant="h5" color="primary.main" fontWeight={700}>¥{receipt?.bill?.amount}</Typography>
          {linkedRx && <Alert severity="success" sx={{ mt: 2 }}>处方 {linkedRx.pickupCode} 已完成取药</Alert>}
          <Divider sx={{ my: 2 }} />
          {(receipt?.bill?.items || []).map((i, idx) => (
            <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2">{i.name} ×{i.quantity}</Typography>
              <Typography variant="body2">¥{(i.price * i.quantity).toFixed(2)}</Typography>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReceipt(null)}>完成</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Billing;
