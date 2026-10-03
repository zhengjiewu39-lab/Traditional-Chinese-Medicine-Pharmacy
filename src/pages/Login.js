import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Box, Typography, TextField, Button, Paper, Alert, Stack,
  Dialog, DialogTitle, DialogContent, List, ListItemButton, ListItemText, CircularProgress,
} from '@mui/material';
import {
  AdminPanelSettings, LocalPharmacy, Handyman, Science, Person, MedicalServices,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { getHomeForRole } from '../config/navigation';
import { useLanguage } from '../i18n/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { authApi } from '../services/api';

const CLINICAL_ACCOUNTS = [
  { username: 'prescriber', password: 'doc123', role: 'prescriber', Icon: MedicalServices },
  { username: 'pharmacist', password: 'pharm123', role: 'pharmacist', Icon: LocalPharmacy },
  { username: 'pharmacist2', password: 'pharm456', role: 'pharmacist', Icon: LocalPharmacy },
];
const SUPPORT_ACCOUNTS = [
  { username: 'technician', password: 'tech123', role: 'technician', Icon: Handyman },
  { username: 'admin', password: 'admin123', role: 'admin', Icon: AdminPanelSettings },
  { username: 'researcher', password: 'research123', role: 'researcher', Icon: Science },
];

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [directory, setDirectory] = useState([]);
  const [dirLoading, setDirLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLanguage();

  const signIn = async (u, p, extra = {}) => {
    try {
      setError('');
      setLoading(true);
      const loggedIn = await login(u, p, extra);
      navigate(getHomeForRole(loggedIn?.role));
    } catch {
      setError(t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const loadDirectory = async (q) => {
    setDirLoading(true);
    try {
      const r = await authApi.demoPatients({ q: q || undefined, limit: 40 });
      setDirectory(r.data.patients || []);
    } catch {
      setDirectory([]);
    } finally {
      setDirLoading(false);
    }
  };

  useEffect(() => {
    if (!pickerOpen) return undefined;
    const tmr = setTimeout(() => loadDirectory(query), 200);
    return () => clearTimeout(tmr);
  }, [pickerOpen, query]);

  const handleSubmit = (e) => {
    e.preventDefault();
    signIn(username, password);
  };

  const accountButton = ({ username: u, password: p, role, Icon }) => (
    <Button
      key={u}
      size="small"
      variant="outlined"
      startIcon={<Icon />}
      disabled={loading}
      onClick={() => signIn(u, p)}
    >
      {u === 'pharmacist2' ? t('roles.pharmacist2') : t(`roles.${role}`)}
    </Button>
  );

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
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, mb: 0.5 }}>{t('login.clinicalGroup')}</Typography>
          <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap>
            {CLINICAL_ACCOUNTS.map(accountButton)}
            <Button size="small" variant="outlined" startIcon={<Person />} disabled={loading} onClick={() => setPickerOpen(true)}>
              {t('roles.patient')}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, mb: 0.5 }}>{t('login.supportGroup')}</Typography>
          <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap>
            {SUPPORT_ACCOUNTS.map(accountButton)}
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block" textAlign="center" sx={{ mt: 1 }}>
            {t('login.demoAccounts')}
          </Typography>
        </Paper>
      </Box>
      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('login.pickPatient')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{t('login.pickPatientHint')}</Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label={t('login.pickPatientSearch')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ mb: 1 }}
          />
          {dirLoading && <Box sx={{ textAlign: 'center', py: 2 }}><CircularProgress size={22} /></Box>}
          <List dense>
            {directory.map((p) => (
              <ListItemButton
                key={p.patientRef}
                disabled={loading}
                onClick={() => { setPickerOpen(false); signIn(p.patientRef, 'patient123'); }}
              >
                <ListItemText
                  primary={`${p.name} · ${p.patientRef}`}
                  secondary={t('login.pickPatientMeta', { age: p.age ?? '—', gender: p.gender || '—' })}
                />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
      </Dialog>
    </Container>
  );
}

export default Login;
