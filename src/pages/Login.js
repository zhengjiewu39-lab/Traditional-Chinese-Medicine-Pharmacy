import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Box, Typography, TextField, Button, Paper, Alert, Chip, Stack } from '@mui/material';
import { AdminPanelSettings, LocalPharmacy } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { getHomeForRole } from '../config/navigation';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      const loggedIn = await login(username, password);
      navigate(getHomeForRole(loggedIn?.role));
    } catch (error) {
      setError('登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <Typography component="h1" variant="h5" sx={{ mb: 1, fontWeight: 700 }}>
            中药药房管理系统
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
            管理员侧重运营 · 药师侧重处方与患者
          </Typography>
          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
              {error}
            </Alert>
          )}
          <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label="用户名"
              name="username"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="密码"
              type="password"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </Button>
          </Box>
          <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AdminPanelSettings />}
              disabled={loading}
              onClick={async () => {
                setUsername('admin');
                setPassword('admin123');
                try {
                  setLoading(true);
                  const u = await login('admin', 'admin123');
                  navigate(getHomeForRole(u?.role));
                } catch { setError('登录失败'); } finally { setLoading(false); }
              }}
            >
              管理员
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<LocalPharmacy />}
              disabled={loading}
              onClick={async () => {
                setUsername('pharmacist');
                setPassword('pharm123');
                try {
                  setLoading(true);
                  const u = await login('pharmacist', 'pharm123');
                  navigate(getHomeForRole(u?.role));
                } catch { setError('登录失败'); } finally { setLoading(false); }
              }}
            >
              药师
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" textAlign="center" sx={{ mt: 1 }}>
            admin / admin123 · pharmacist / pharm123
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
}

export default Login; 