import React, { useEffect, useState } from 'react';
import {
  Alert, Box, Button, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { aiGovernanceApi } from '../services/aiApi';
import { formatApiError } from '../config/httpClient';

const PRESETS = [
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', needsKey: true },
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', needsKey: true },
  { id: 'ollama', label: '本地 Ollama', baseUrl: 'http://127.0.0.1:11434/v1', model: 'llama3.1', needsKey: false },
  { id: 'custom', label: '自定义兼容接口', baseUrl: '', model: '', needsKey: true },
];

function errorText(e) {
  const err = e.response?.data?.error;
  if (!err) return formatApiError(e);
  if (err.detail && err.detail !== err.message) return `${err.message}（${err.detail}）`;
  return err.message || formatApiError(e);
}

export default function ConnectRealAi({ onSaved }) {
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
      setErr('DeepSeek / OpenAI 必须填写 API Key。请从 platform.deepseek.com 复制完整密钥（以 sk- 开头）。');
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
      setErr(errorText(e));
      setBusy(false);
      return;
    }
    try {
      const test = await aiGovernanceApi.testProvider();
      setMsg(test.data.isMock
        ? '已保存，但仍是模拟模型（未通过真实调用）。请确认密钥和地址。'
        : `真实模型已接通：${test.data.model}，延迟 ${test.data.latencyMs}ms。之后开方会由该模型驱动筛查。`);
      setApiKey('');
      await load();
      if (onSaved) onSaved();
    } catch (e) {
      setErr(`配置已保存，但测试调用失败：${errorText(e)}。可检查密钥、余额，以及本机能否访问 ${baseUrl}。`);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>接入真实 AI</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        DeepSeek 选好提供方、粘贴 platform.deepseek.com 的 API Key 即可。密钥只保存在本机，不会出现在页面、日志或审计里。AI 仍不能自己批准或发药。
      </Typography>
      {local?.configured && (
        <Alert severity={local.apiKeyConfigured ? 'success' : 'warning'} sx={{ mb: 2 }}>
          已配置 {local.endpointHost} / {local.model}；密钥{local.apiKeyConfigured ? '已保存' : '尚未填写'}。
        </Alert>
      )}
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
      {msg && <Alert severity="info" sx={{ mb: 2 }}>{msg}</Alert>}
      <Stack spacing={2}>
        <TextField select label="提供方" value={preset} onChange={(e) => applyPreset(e.target.value)}>
          {PRESETS.map((p) => <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>)}
        </TextField>
        <TextField label="接口地址" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.deepseek.com/v1" />
        <TextField label="模型名" value={model} onChange={(e) => setModel(e.target.value)} placeholder="deepseek-chat" />
        <TextField
          label={needsKey ? 'API Key' : 'API Key（本地 Ollama 可留空）'}
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="off"
          helperText={preset === 'deepseek' ? '使用 deepseek-chat；不要填完整 /chat/completions 路径。' : ' '}
        />
        <Button variant="contained" disabled={busy || !baseUrl || !model} onClick={save}>
          {busy ? '正在接通…' : '保存并测试真实模型'}
        </Button>
      </Stack>
    </Box>
  );
}
