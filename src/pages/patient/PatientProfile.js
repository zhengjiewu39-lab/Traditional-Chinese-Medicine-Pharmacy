import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { patientPortalApi } from '../../services/aiApi';
import { authApi } from '../../services/api';
import { formatApiError } from '../../config/httpClient';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';

function Fact({ label, fact }) {
  if (!fact) return null;
  return (
    <Typography variant="body2" sx={{ mb: 1 }}>
      {label}: <Chip size="small" label={fact.status} /> {fact.status === 'reported' ? String(Array.isArray(fact.value) ? fact.value.join('，') : fact.value ?? '') : ''}
    </Typography>
  );
}

function emptyForm() {
  return { name: '', gender: '男', age: '', phone: '', address: '', medicalHistory: '', allergies: '' };
}

export default function PatientProfile() {
  const { t } = useLanguage();
  const { assumePatient } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [directory, setDirectory] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);

  const load = () => patientPortalApi.myProfile().then((r) => {
    setData(r.data);
    const store = r.data.store || {};
    setForm({
      name: store.name || r.data.profile?.name || '',
      gender: store.gender || '男',
      age: store.age != null ? String(store.age) : '',
      phone: store.phone || '',
      address: store.address || '',
      medicalHistory: (store.medicalHistory || []).join('，'),
      allergies: (store.allergies || []).join('，'),
    });
  }).catch((e) => setError(formatApiError(e)));

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const tmr = setTimeout(() => {
      authApi.demoPatients({ q: query || undefined, limit: 20 }).then((r) => setDirectory(r.data.patients || [])).catch(() => setDirectory([]));
    }, 200);
    return () => clearTimeout(tmr);
  }, [query]);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await patientPortalApi.updateProfile({
        name: form.name,
        gender: form.gender,
        age: form.age === '' ? undefined : Number(form.age),
        phone: form.phone,
        address: form.address,
        medicalHistory: form.medicalHistory,
        allergies: form.allergies,
      });
      setData(r.data);
      setNotice(t('patientProfile.saved'));
      setEditing(false);
      if (r.data.patientRef) await assumePatient(r.data.patientRef);
      await load();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const p = data?.profile || {};
  const store = data?.store;
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>{t('nav.myProfile')}</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}
      <Alert severity="warning" sx={{ mb: 2 }}>{t('patientProfile.identityNote')}</Alert>
      <Paper sx={{ p: 2, mb: 2 }}>
        {!editing ? (
          <>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>{p.name || store?.name || t('ai.unregistered')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('patientProfile.ref')}: {data?.patientRef || p.patientRef || '—'}</Typography>
            {(store?.age != null || p.facts?.ageYears) && (
              <Typography variant="body2" sx={{ mb: 1 }}>{t('patientProfile.age')}: {store?.age ?? p.facts?.ageYears?.value ?? '—'}</Typography>
            )}
            {store?.gender && <Typography variant="body2" sx={{ mb: 1 }}>{t('patientProfile.sex')}: {store.gender}</Typography>}
            {store?.phone && <Typography variant="body2" sx={{ mb: 1 }}>{t('patientProfile.phone')}: {store.phone}</Typography>}
            {store?.address && <Typography variant="body2" sx={{ mb: 1 }}>{t('patientProfile.address')}: {store.address}</Typography>}
            {!!store?.medicalHistory?.length && (
              <Typography variant="body2" sx={{ mb: 1 }}>{t('patientProfile.history')}: {store.medicalHistory.join('，')}</Typography>
            )}
            {!!store?.allergies?.length && (
              <Typography variant="body2" sx={{ mb: 1 }}>{t('patientProfile.allergies')}: {store.allergies.join('，')}</Typography>
            )}
            <Fact label={t('patientProfile.allergies')} fact={p.facts?.allergies} />
            <Fact label={t('patientProfile.medications')} fact={p.facts?.currentMedications} />
            <Fact label={t('patientProfile.pregnancy')} fact={p.facts?.pregnancy} />
            <Fact label={t('patientProfile.liver')} fact={p.facts?.liverImpairment} />
            <Fact label={t('patientProfile.kidney')} fact={p.facts?.renalImpairment} />
            {!p.facts && !store && !error && <Typography variant="body2" color="text.secondary">{t('patientProfile.noFacts')}</Typography>}
            <Button sx={{ mt: 1 }} variant="outlined" onClick={() => setEditing(true)}>{t('patientProfile.edit')}</Button>
          </>
        ) : (
          <Stack spacing={1.5}>
            <TextField size="small" label={t('patientProfile.ref')} value={data?.patientRef || ''} disabled />
            <TextField size="small" label={t('ai.patient')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <TextField size="small" select label={t('patientProfile.sex')} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <MenuItem value="男">男</MenuItem>
              <MenuItem value="女">女</MenuItem>
            </TextField>
            <TextField size="small" type="number" label={t('patientProfile.age')} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            <TextField size="small" label={t('patientProfile.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <TextField size="small" label={t('patientProfile.address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <TextField size="small" label={t('patientProfile.history')} value={form.medicalHistory} onChange={(e) => setForm({ ...form, medicalHistory: e.target.value })} />
            <TextField size="small" label={t('patientProfile.allergies')} value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" disabled={busy} onClick={save}>{t('patientProfile.save')}</Button>
              <Button disabled={busy} onClick={() => setEditing(false)}>{t('patientProfile.cancel')}</Button>
            </Stack>
          </Stack>
        )}
      </Paper>
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{t('patientProfile.switch')}</Typography>
        <TextField size="small" fullWidth label={t('login.pickPatientSearch')} value={query} onChange={(e) => setQuery(e.target.value)} sx={{ mb: 1 }} />
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {directory.map((row) => (
            <Button
              key={row.patientRef}
              size="small"
              variant={row.patientRef === data?.patientRef ? 'contained' : 'outlined'}
              onClick={async () => {
                try {
                  await assumePatient(row.patientRef);
                  setError('');
                  setEditing(false);
                  await load();
                } catch (e) {
                  setError(formatApiError(e));
                }
              }}
            >
              {row.name} · {row.patientRef}
            </Button>
          ))}
        </Stack>
      </Paper>
    </Box>
  );
}
