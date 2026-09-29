import React, { useEffect, useState } from 'react';
import {
  Alert, Box, Button, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { aiGovernanceApi } from '../services/aiApi';
import { formatApiError } from '../config/httpClient';
import { useLanguage } from '../i18n/LanguageContext';

const PRESETS = [
  { id: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', needsKey: true },
  { id: 'deepseek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', needsKey: true },
  { id: 'ollama', baseUrl: 'http://127.0.0.1:11434/v1', model: 'llama3.1', needsKey: false },
  { id: 'custom', baseUrl: '', model: '', needsKey: true },
];

function errorText(e, t) {
  const err = e.response?.data?.error;
  if (!err) return formatApiError(e);
  if (err.detail && err.detail !== err.message) return formatApiError(e);
  return formatApiError(e) || t('errors.requestFailed');
}

export default function ConnectRealAi({ onSaved }) {
  const { t } = useLanguage();
  const [preset, setPreset] = useState('deepseek');
  const [baseUrl, setBaseUrl] = useState(PRESETS[1].baseUrl);
  const [model, setModel] = useState(PRESETS[1].model);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [local, setLocal] = useState(null);

  const load = async () => {
    try {
      const r = await aiGovernanceApi.runtime();
      setLocal(r.data.local);
    } catch {
      setLocal(null);
    }
  };

  useEffect(() => { load(); }, []);

  const applyPreset = (id) => {
    setPreset(id);
    const p = PRESETS.find((x) => x.id === id);
    if (p) {
      setBaseUrl(p.baseUrl);
      setModel(p.model);
    }
  };

  const needsKey = (PRESETS.find((p) => p.id === preset) || PRESETS[0]).needsKey;
  const hasKey = Boolean(apiKey.trim()) || Boolean(local?.apiKeyConfigured);

  const save = async () => {
    if (needsKey && !hasKey) {
      setErr(t('ai.connect.needKey'));
      return;
    }
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      await aiGovernanceApi.saveProvider({
        preset: preset === 'custom' ? undefined : preset,
        baseUrl: baseUrl.trim(),
        model: model.trim(),
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        timeoutMs: 45000,
        dataResidency: preset === 'ollama' ? 'on-prem' : 'external',
      });
    } catch (e) {
      setErr(errorText(e, t));
      setBusy(false);
      return;
    }
    try {
      const test = await aiGovernanceApi.testProvider();
      setMsg(test.data.isMock
        ? t('ai.connect.savedMock')
        : t('ai.connect.savedLive', { model: test.data.model, ms: test.data.latencyMs }));
      setApiKey('');
      await load();
      if (onSaved) onSaved();
    } catch (e) {
      setErr(t('ai.connect.savedFail', { err: errorText(e, t), url: baseUrl }));
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{t('ai.connect.title')}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{t('ai.connect.intro')}</Typography>
      {local?.configured && (
        <Alert severity={local.apiKeyConfigured ? 'success' : 'warning'} sx={{ mb: 2 }}>
          {t('ai.connect.configured', {
            host: local.endpointHost,
            model: local.model,
            key: local.apiKeyConfigured ? t('ai.connect.keySaved') : t('ai.connect.keyMissing'),
          })}
        </Alert>
      )}
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {msg && <Alert severity="info" sx={{ mb: 2 }}>{msg}</Alert>}
      <Stack spacing={2}>
        <TextField select label={t('ai.connect.provider')} value={preset} onChange={(e) => applyPreset(e.target.value)}>
          {PRESETS.map((p) => <MenuItem key={p.id} value={p.id}>{t(`ai.connect.preset.${p.id}`)}</MenuItem>)}
        </TextField>
        <TextField label={t('ai.connect.baseUrl')} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.deepseek.com/v1" />
        <TextField label={t('ai.connect.model')} value={model} onChange={(e) => setModel(e.target.value)} placeholder="deepseek-chat" />
        <TextField
          label={needsKey ? t('ai.connect.key') : t('ai.connect.keyOptional')}
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="off"
          helperText={preset === 'deepseek' ? t('ai.connect.deepseekHint') : ' '}
        />
        <Button variant="contained" disabled={busy || !baseUrl || !model} onClick={save}>
          {busy ? t('ai.connect.saving') : t('ai.connect.save')}
        </Button>
      </Stack>
    </Box>
  );
}
