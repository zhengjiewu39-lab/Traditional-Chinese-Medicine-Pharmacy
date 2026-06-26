import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Grid, Tabs, Tab, Button, Chip, Alert, LinearProgress,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Card, CardContent,
  Accordion, AccordionSummary, AccordionDetails, Link,
} from '@mui/material';
import {
  Science, PlayArrow, CompareArrows, Dataset, Gavel, ExpandMore, Refresh, CheckCircle,
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import { researchApi } from '../services/api';

const ENGINE_LABELS = {
  'rule-engine-v3': '规则引擎 v3',
  'ml-interpretable-v1': '可解释 ML',
  'baseline-keyword': 'Baseline 关键词',
  'baseline-naive': 'Baseline  naive',
};

const LABEL_COLOR = { approved: 'success', review: 'warning', needs_revision: 'error' };
const LABEL_ZH = { approved: '通过', review: '建议复核', needs_revision: '需修改' };

function TabPanel({ value, index, children }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

function ResearchHub() {
  const [tab, setTab] = useState(0);
  const [results, setResults] = useState(null);
  const [dataset, setDataset] = useState(null);
  const [rules, setRules] = useState(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [compareInput, setCompareInput] = useState({
    prescription: '甘草10g，甘遂5g',
    diagnosis: '水肿',
    patientAge: 50,
    patientGender: '男',
  });
  const [compareResults, setCompareResults] = useState(null);
  const [comparing, setComparing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, ds, rl] = await Promise.all([
        researchApi.getResults(),
        researchApi.getDataset(),
        researchApi.getRules(),
      ]);
      setResults(res.data?.engines ? res.data : null);
      setDataset(ds.data);
      setRules(rl.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runEval = async () => {
    setEvaluating(true);
    try {
      const res = await researchApi.runEvaluation();
      setResults(res.data);
    } finally {
      setEvaluating(false);
    }
  };

  const runCompare = async () => {
    setComparing(true);
    try {
      const res = await researchApi.compareAll(compareInput);
      setCompareResults(res.data.results);
    } finally {
      setComparing(false);
    }
  };

  const chartData = (results?.comparison || []).map(r => ({
    name: ENGINE_LABELS[r.engine] || r.engine,
    engine: r.engine,
    准确率: r.accuracy,
    'Macro-F1': r.macroF1,
    '修订检出F1': results.engines?.[r.engine]?.metrics?.binaryNeedsRevision?.f1 ?? 0,
  }));

  const radarData = chartData.map(d => ({
    engine: d.name,
    准确率: d.准确率 * 100,
    MacroF1: d['Macro-F1'] * 100,
    安全F1: d['修订检出F1'] * 100,
  }));

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            <Science sx={{ mr: 1, verticalAlign: 'middle' }} />
            科研评价中心
          </Typography>
          <Typography variant="body2" color="text.secondary">
            公开基准数据集 · 多引擎对比 · 可复现实验 · 伦理合规
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<Refresh />} onClick={load}>刷新</Button>
          <Button variant="contained" startIcon={<PlayArrow />} onClick={runEval} disabled={evaluating}>
            {evaluating ? '运行中...' : '重新运行 Benchmark'}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: '基准样本', value: dataset?.cases?.length || 24, icon: <Dataset /> },
          { label: '对比引擎', value: 4, icon: <CompareArrows /> },
          { label: '规则药材', value: Object.keys(rules?.herbRules || {}).length, icon: <Science /> },
          { label: '最佳 Macro-F1', value: results?.comparison?.[0]?.macroF1?.toFixed(3) || '—', icon: <CheckCircle /> },
        ].map(s => (
          <Grid item xs={6} md={3} key={s.label}>
            <Card><CardContent sx={{ textAlign: 'center', py: 1.5 }}>
              <Box sx={{ color: 'primary.main', mb: 0.5 }}>{s.icon}</Box>
              <Typography variant="h5" fontWeight={700}>{s.value}</Typography>
              <Typography variant="caption" color="text.secondary">{s.label}</Typography>
            </CardContent></Card>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          <Tab label="实验结果" />
          <Tab label="引擎对比 playground" />
          <Tab label="公开数据集" />
          <Tab label="伦理与文献" />
        </Tabs>

        <Box sx={{ p: 2 }}>
          <TabPanel value={tab} index={0}>
            {!results?.engines ? (
              <Alert severity="info" action={<Button onClick={runEval}>运行实验</Button>}>
                暂无评价结果，点击运行 Benchmark（需 API 服务已启动）
              </Alert>
            ) : (
              <>
                <Alert severity="success" sx={{ mb: 2 }}>
                  数据集 {results.dataset} · n={results.n} · 评估时间 {new Date(results.evaluatedAt).toLocaleString()}
                </Alert>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={7}>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>引擎性能对比</Typography>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 1]} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
                        <Tooltip formatter={v => `${(v * 100).toFixed(1)}%`} />
                        <Legend />
                        <Bar dataKey="准确率" fill="#1565C0" />
                        <Bar dataKey="Macro-F1" fill="#6A1B9A" />
                        <Bar dataKey="修订检出F1" fill="#C62828" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Grid>
                  <Grid item xs={12} md={5}>
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>综合雷达图</Typography>
                    <ResponsiveContainer width="100%" height={280}>
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="engine" tick={{ fontSize: 10 }} />
                        <PolarRadiusAxis domain={[0, 100]} />
                        <Radar name="准确率" dataKey="准确率" stroke="#1565C0" fill="#1565C0" fillOpacity={0.3} />
                        <Radar name="Macro-F1" dataKey="MacroF1" stroke="#6A1B9A" fill="#6A1B9A" fillOpacity={0.3} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </Grid>
                </Grid>
                <Table size="small" sx={{ mt: 2 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>排名</TableCell>
                      <TableCell>引擎</TableCell>
                      <TableCell>准确率</TableCell>
                      <TableCell>Macro-F1</TableCell>
                      <TableCell>修订检出 F1</TableCell>
                      <TableCell>误判数</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(results.comparison || []).map((r, i) => (
                      <TableRow key={r.engine}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell><strong>{ENGINE_LABELS[r.engine] || r.engine}</strong></TableCell>
                        <TableCell>{(r.accuracy * 100).toFixed(1)}%</TableCell>
                        <TableCell>{(r.macroF1 * 100).toFixed(1)}%</TableCell>
                        <TableCell>{((results.engines[r.engine]?.metrics?.binaryNeedsRevision?.f1 || 0) * 100).toFixed(1)}%</TableCell>
                        <TableCell>{results.engines[r.engine]?.mismatches?.length || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  完整报告：benchmarks/results/latest.json · CI 自动运行 npm run evaluate
                </Typography>
              </>
            )}
          </TabPanel>

          <TabPanel value={tab} index={1}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={5}>
                <TextField fullWidth multiline rows={3} label="处方" sx={{ mb: 2 }}
                  value={compareInput.prescription}
                  onChange={e => setCompareInput({ ...compareInput, prescription: e.target.value })}
                />
                <TextField fullWidth label="诊断" sx={{ mb: 2 }}
                  value={compareInput.diagnosis}
                  onChange={e => setCompareInput({ ...compareInput, diagnosis: e.target.value })}
                />
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <TextField fullWidth type="number" label="年龄"
                      value={compareInput.patientAge}
                      onChange={e => setCompareInput({ ...compareInput, patientAge: +e.target.value })}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField fullWidth label="性别"
                      value={compareInput.patientGender}
                      onChange={e => setCompareInput({ ...compareInput, patientGender: e.target.value })}
                    />
                  </Grid>
                </Grid>
                <Button variant="contained" sx={{ mt: 2 }} startIcon={<CompareArrows />}
                  onClick={runCompare} disabled={comparing} fullWidth>
                  {comparing ? '分析中...' : '四引擎并行分析'}
                </Button>
              </Grid>
              <Grid item xs={12} md={7}>
                {!compareResults ? (
                  <Alert severity="info">输入处方后点击「四引擎并行分析」，对比规则引擎、ML 与 Baseline</Alert>
                ) : compareResults.map(({ engine, result }) => (
                  <Paper key={engine} variant="outlined" sx={{ p: 2, mb: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography fontWeight={600}>{ENGINE_LABELS[engine] || engine}</Typography>
                      <Chip label={LABEL_ZH[result.label] || result.status} size="small"
                        color={LABEL_COLOR[result.label] || 'default'} />
                    </Box>
                    <Typography variant="body2" color="text.secondary">评分 {result.score} · {result.engine}</Typography>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>{result.summary}</Typography>
                    {result.warnings?.slice(0, 2).map((w, i) => (
                      <Typography key={i} variant="caption" display="block" color="error.main">{w.message}</Typography>
                    ))}
                    {result.explainability?.topContributions?.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="primary">ML 归因：</Typography>
                        {result.explainability.topContributions.map(c => (
                          <Chip key={c.feature} label={`${c.feature} (${c.contribution})`} size="small" sx={{ mr: 0.5, mt: 0.5 }} />
                        ))}
                      </Box>
                    )}
                  </Paper>
                ))}
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tab} index={2}>
            <Alert severity="info" sx={{ mb: 2 }}>
              {dataset?.description} · 许可 {dataset?.license}
            </Alert>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>处方</TableCell>
                  <TableCell>专家标签</TableCell>
                  <TableCell>理由</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(dataset?.cases || []).map(c => (
                  <TableRow key={c.id} hover sx={{ cursor: 'pointer' }}
                    onClick={() => { setCompareInput({ ...compareInput, prescription: c.prescription, diagnosis: c.diagnosis, patientAge: c.patientAge, patientGender: c.patientGender }); setTab(1); }}>
                    <TableCell>{c.id}</TableCell>
                    <TableCell sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.prescription || '(空)'}</TableCell>
                    <TableCell><Chip label={LABEL_ZH[c.expertLabel]} size="small" color={LABEL_COLOR[c.expertLabel]} /></TableCell>
                    <TableCell><Typography variant="caption">{c.rationale}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabPanel>

          <TabPanel value={tab} index={3}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}><Gavel sx={{ mr: 1 }} /> 伦理与隐私</AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" paragraph>
                  本系统为<strong>决策辅助演示/科研原型</strong>，不可替代持证药师审核。基准数据均为合成脱敏处方，不含真实患者 PHI。
                </Typography>
                <Typography variant="body2" component="ul" sx={{ pl: 2 }}>
                  <li>运行时患者数据仅存本地 data/store.json，不提交至 GitHub</li>
                  <li>审方/ML 输出可能存在漏报与误报，须人工复核</li>
                  <li>生产环境需加密存储、RBAC、审计日志</li>
                </Typography>
                <Link href="https://github.com/zhengjiewu39-lab/Traditional-Chinese-Medicine-Pharmacy/blob/main/docs/ETHICS.md" target="_blank">完整伦理文档 →</Link>
              </AccordionDetails>
            </Accordion>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}><Science sx={{ mr: 1 }} /> 文献与方法论</AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" component="ul" sx={{ pl: 2 }}>
                  <li>中国药典配伍禁忌（十八反、十九畏）</li>
                  <li>WHO 传统医学战略框架</li>
                  <li>可解释 AI：线性特征归因（非黑盒深度学习）</li>
                  <li>评价指标：Accuracy、Macro-F1、修订类 Binary-F1</li>
                </Typography>
                <Link href="https://github.com/zhengjiewu39-lab/Traditional-Chinese-Medicine-Pharmacy/blob/main/docs/LITERATURE.md" target="_blank">参考文献 →</Link>
              </AccordionDetails>
            </Accordion>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}><PlayArrow sx={{ mr: 1 }} /> 可复现步骤</AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" component="pre" sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1, fontSize: '0.8rem' }}>
{`npm install
npm run test:server
npm run evaluate
docker compose up --build`}
                </Typography>
                <Typography variant="caption" color="text.secondary">GitHub Actions 在每次 push 时自动运行测试与 benchmark</Typography>
              </AccordionDetails>
            </Accordion>
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
}

export default ResearchHub;
