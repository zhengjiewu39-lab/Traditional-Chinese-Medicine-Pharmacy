import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Box, Typography, TextField, Button, Paper, Alert, Stack } from '@mui/material';
import { AdminPanelSettings, LocalPharmacy } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { getHomeForRole } from '../config/navigation';
import { useLanguage } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLanguage();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      const loggedIn = await login(username, password);
      navigate(getHomeForRole(loggedIn?.role));
    } catch {
      setError(t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box sx={{ alignSelf: 'flex-end', mb: 1 }}>
          <LanguageSwitcher sx={{ '& .MuiToggleButton-root': { color: 'text.primary', borderColor: 'divider' } }} />
        </Box>
        <Paper elevation={3} sx={{ padding: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <Typography component="h1" variant="h5" sx={{ mb: 1, fontWeight: 700, textAlign: 'center' }}>
            {t('login.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
            {t('login.subtitle')}
          </Typography>
          {error && <Alert severity="error" sx={{ width: '100%', mb: 2 }}>{error}</Alert>}
          <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <TextField
              margin="normal"
              required
              fullWidth
              label={t('login.username')}
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              label={t('login.password')}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={loading}>
              {loading ? t('auth.loggingIn') : t('auth.login')}
            </Button>
          </Box>
          <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AdminPanelSettings />}
              disabled={loading}
              onClick={async () => {
                try {
                  setLoading(true);
                  const u = await login('admin', 'admin123');
                  navigate(getHomeForRole(u?.role));
                } catch { setError(t('auth.loginFailed')); } finally { setLoading(false); }
              }}
            >
              {t('roles.admin')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<LocalPharmacy />}
              disabled={loading}
              onClick={async () => {
                try {
                  setLoading(true);
                  const u = await login('pharmacist', 'pharm123');
                  navigate(getHomeForRole(u?.role));
                } catch { setError(t('auth.loginFailed')); } finally { setLoading(false); }
              }}
            >
              {t('roles.pharmacist')}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" textAlign="center" sx={{ mt: 1 }}>
            {t('login.demoAdmin')} · {t('login.demoPharm')}
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
}

export default Login;
