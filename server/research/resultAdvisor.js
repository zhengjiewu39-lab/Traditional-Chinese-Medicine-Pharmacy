/**
 * Research-only interpretation of experiment rows.
 * Does not diagnose, prescribe, approve, or invent clinical facts.
 * Hidden scripts never enter the model payload.
 */
const runtime = require('../ai/aiRuntime');
const { screenOutput } = require('../ai/safetyPolicy');
const { resolveCapabilities, providerForKind } = require('./capabilityPolicy');

const CLINICAL = 'not_evaluated';

function safePayload(job, row) {
  return {
    experimentId: job.experimentId,
    inferenceMode: job.config?.inferenceMode || null,
    inputMode: job.config?.inputMode || 'structured',
    groupId: row.groupId,
    researchCaseId: row.researchCaseId,
    baseId: row.baseId,
    split: row.split || null,
    ok: row.ok,
    filteredRisk: row.filteredRisk || null,
    rawRisk: row.rawRisk || null,
    asked: row.asked || 0,
    answered: row.answered || 0,
    stopReason: row.stopReason || row.error || null,
    engineeringFailure: Boolean(row.engineeringFailure),
    modelFailure: Boolean(row.modelFailure),
    clarificationMode: row.clarificationMode || null,
    extractMode: row.extractTurn?.mode || 'structured_only',
    clinicalAccuracy: CLINICAL,
  };
}

function copy(zh, en, lang) {
  return lang === 'en' ? en : zh;
}

function deterministicResult(job, row, lang) {
  const p = safePayload(job, row);
  const meaning = [];
  const nextSteps = [];
  const caveats = [
    copy('这是合成基础病例的工程解读，不是真实患者，也不是医学金标准。', 'This is an engineering reading of a synthetic base case, not a real patient or a medical gold standard.', lang),
    copy('临床正确性保持 not_evaluated，专家标签仍是 unreviewed。', 'Clinical correctness stays not_evaluated. Expert labels remain unreviewed.', lang),
    copy('模型调用成功不等于医学正确，也不能批准或发药。', 'A successful model call is not medical correctness and cannot approve or dispense.', lang),
  ];

  if (p.extractMode === 'structured_only') {
    meaning.push(copy('本次输入是结构化资料，不能声称已经评价自然语言理解。', 'This run used structured facts only. It does not evaluate natural-language understanding.', lang));
  } else {
    meaning.push(copy('本次走了端到端自然语言路径；仍须由冻结脚本确认候选事实。', 'This run used the end-to-end language path. Candidates still have to be confirmed by the frozen script.', lang));
  }

  if (p.engineeringFailure) {
    meaning.push(copy(`工程失败：${p.stopReason || 'unknown'}。这是任务执行问题，不是漏诊。`, `Engineering failure: ${p.stopReason || 'unknown'}. This is a run error, not a missed diagnosis.`, lang));
    nextSteps.push(copy('查看失败原因后点「重试失败」。已成功的结果不会被覆盖。', 'Inspect the error, then retry failed tasks. Successful rows are not overwritten.', lang));
  } else if (p.modelFailure) {
    meaning.push(copy('模型输出未通过结构或安全过滤。过滤后风险仍以规则轨为准。', 'The model output failed schema or safety checks. The filtered risk still follows the rule track.', lang));
    nextSteps.push(copy('先看「安全过滤后输出」，不要把原始模型文本当成结论。', 'Read the safety-filtered output first. Do not treat the raw model text as a conclusion.', lang));
  } else {
    meaning.push(copy(
      `组 ${p.groupId} 在预算内问了 ${p.asked} 次，脚本有效回答 ${p.answered} 次，停止原因 ${p.stopReason || '—'}，过滤后风险 ${p.filteredRisk || '—'}。`,
      `Group ${p.groupId} asked ${p.asked} time(s), the script answered ${p.answered}, stop reason ${p.stopReason || '—'}, filtered risk ${p.filteredRisk || '—'}.`,
      lang,
    ));
  }

  if (p.asked > 0 && p.answered === 0) {
    meaning.push(copy('脚本没有可确认的事实。源记录缺这项时保持未知，不会补成“无过敏/未孕”。', 'The script had no confirmable fact. Missing source fields stay unknown and are not filled as none.', lang));
    nextSteps.push(copy('打开参考事实视图核对该场景的隐藏脚本（不是已完成的专业标注）。', 'Open the reference-fact view to check the hidden script. This is not a completed expert label.', lang));
  }
  if (p.stopReason === 'burden_cap') {
    nextSteps.push(copy('交互预算用尽。若要比较 C 与 D，保持两边预算相同后再看追问次数。', 'The interaction budget was used up. To compare C and D, keep the same budget on both sides.', lang));
  }
  if (p.groupId === 'D' || p.groupId === 'C') {
    nextSteps.push(copy('主比较是同一基础病例上的 D 对 C，不是新的真实患者。', 'The primary comparison is D versus C on the same base case, not a new real patient.', lang));
  }
  if (job.config?.inferenceMode === 'mock') {
    caveats.unshift(copy('当前任务是 mock，建议只作界面与路径检查。', 'This job is mock. Treat the advice as an interface and path check only.', lang));
  }
  nextSteps.push(copy('需要保留证据时导出去标识化 JSON/CSV。', 'Export de-identified JSON/CSV when you need a frozen record.', lang));

  return {
    scope: 'result',
    lang,
    source: 'rules',
    usedModel: false,
    isMock: job.config?.inferenceMode === 'mock',
    generatedAt: new Date().toISOString(),
    summary: meaning[0],
    meaning,
    nextSteps,
    caveats,
    pathHint: copy('路径：结果表 → 点这一行 → 单病例交互 → 需要时生成 AI 建议。', 'Path: results table → this row → single-case trace → generate AI advice if needed.', lang),
    clinicalCorrectness: CLINICAL,
    payload: p,
  };
}

function deterministicJob(job, rows, lang) {
  const byGroup = {};
  for (const r of rows) {
    byGroup[r.groupId] = byGroup[r.groupId] || { n: 0, asked: 0, answered: 0, fail: 0 };
    const g = byGroup[r.groupId];
    g.n += 1;
    g.asked += r.asked || 0;
    g.answered += r.answered || 0;
    if (!r.ok || r.engineeringFailure) g.fail += 1;
  }
  const meaning = [
    copy(
      `已完成 ${rows.length} 条病例级结果，组统计：${JSON.stringify(byGroup)}。这是多组评估，不是多名真实患者。`,
      `${rows.length} case-level row(s). Group stats: ${JSON.stringify(byGroup)}. These are grouped evaluations, not extra real patients.`,
      lang,
    ),
  ];
  const nextSteps = [
    copy('先点一条结果看交互轨迹，再决定是否扩大范围。', 'Open one result trace before widening the run.', lang),
    copy('不要把未审核指标算成准确率、漏诊率或健康收益。', 'Do not compute accuracy, miss rate, or health benefit from unreviewed labels.', lang),
  ];
  if (job.config?.inferenceMode !== 'real') {
    nextSteps.push(copy('真实模型须管理员批准，并单独确认；默认不要跑满 500 例付费调用。', 'A live model needs admin approval and an extra confirm. Do not run a paid 500-case job by default.', lang));
  }
  return {
    scope: 'job',
    lang,
    source: 'rules',
    usedModel: false,
    isMock: job.config?.inferenceMode === 'mock',
    generatedAt: new Date().toISOString(),
    summary: meaning[0],
    meaning,
    nextSteps,
    caveats: [
      copy('用量未知时显示未知，不填 0。', 'Unknown usage stays unknown and is not filled as 0.', lang),
      copy('临床正确性 not_evaluated。', 'Clinical correctness is not_evaluated.', lang),
    ],
    pathHint: copy('路径：执行区点查看 → 结果表 → 单病例交互。', 'Path: run list → view → results table → single-case trace.', lang),
    clinicalCorrectness: CLINICAL,
    byGroup,
  };
}

const BLOCKING_ADVICE = /autonomous_|herb_added|dose_changed|citation_not_found/;

function outputLooksUnsafe(text) {
  const screened = screenOutput({
    pharmacistExplanation: text,
    patientExplanation: text,
    summary: text,
  }, { canonicalHerbs: [], allowedEvidenceIds: new Set() });
  return (screened.violations || []).some((v) => BLOCKING_ADVICE.test(v.code) || String(v.code).startsWith('autonomous_'));
}

async function maybeModelPolish(base, { job, wantModel, lang }) {
  if (!wantModel) return base;
  const { limits } = require('./experimentJobs');
  const cap = limits();
  const requested = job.config?.inferenceMode === 'real' ? 'real' : 'mock';
  const caps = resolveCapabilities({
    requestedMode: requested,
    groupCfg: { aiEnabled: true, retrievalEnabled: false },
    allowLive: cap.allowLive,
    runtimeEnabled: runtime.isAiEnabled(),
  });
  if (caps.pause || !runtime.isAiEnabled()) {
    return { ...base, source: 'policy_paused', pathHint: copy('全局 AI 已关闭或研究调用未批准，仅保留规则解读，未安排外部模型。', 'The global AI switch is off or live research is not allowed. Only the rule reading is kept; no external model was called.', lang) };
  }
  let provider;
  try {
    provider = providerForKind(caps.providerKind);
  } catch {
    return { ...base, source: 'rules' };
  }
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'nextSteps', 'caveats'],
    properties: {
      summary: { type: 'string' },
      nextSteps: { type: 'array', items: { type: 'string' }, maxItems: 6 },
      caveats: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    },
  };
  try {
    const { dispatchResearchModel } = require('./experimentJobs');
    const raw = await dispatchResearchModel(job.id, provider, {
      messages: [
        {
          role: 'system',
          content: lang === 'en'
            ? 'You interpret TCM pharmacy research-experiment rows. Engineering next steps only. Do not diagnose, prescribe, approve, invent facts, or claim clinical accuracy. Reply JSON {summary,nextSteps,caveats}.'
            : '你解读中药药房研究实验行。只给工程下一步。不要诊断、开方、批准、编造事实或声称临床准确。回复 JSON {summary,nextSteps,caveats}。',
        },
        { role: 'user', content: JSON.stringify({ lang, reading: base, row: base.payload || { byGroup: base.byGroup } }) },
      ],
      jsonSchema: schema,
    });
    const parsed = JSON.parse(raw);
    const blob = [parsed.summary, ...(parsed.nextSteps || []), ...(parsed.caveats || [])].join('\n');
    if (outputLooksUnsafe(blob)) {
      return {
        ...base,
        source: 'rules',
        usedModel: false,
        rejectedUnsafeAdvice: true,
        pathHint: copy('模型解读含自主改量、诊断或绕过药师的文字，已回退为规则解读。', 'The model reading contained autonomous dose, diagnosis, or approval language and was discarded.', lang),
      };
    }
    return {
      ...base,
      source: provider.isMock ? 'mock' : 'shadow_model',
      usedModel: true,
      isMock: Boolean(provider.isMock),
      summary: parsed.summary || base.summary,
      nextSteps: parsed.nextSteps?.length ? parsed.nextSteps : base.nextSteps,
      caveats: [...(parsed.caveats || []), ...base.caveats].slice(0, 8),
    };
  } catch (err) {
    if (err && (err.code === 'quota_paused' || err.code === 'policy_paused' || err.code === 'cancelled')) {
      return { ...base, source: 'policy_paused', usedModel: false };
    }
    return base;
  }
}

async function adviseResult({ job, row, lang = 'zh', wantModel = true }) {
  const base = deterministicResult(job, row, lang === 'en' ? 'en' : 'zh');
  return maybeModelPolish(base, { job, wantModel, lang: base.lang });
}

async function adviseJob({ job, rows, lang = 'zh', wantModel = true }) {
  const base = deterministicJob(job, rows, lang === 'en' ? 'en' : 'zh');
  return maybeModelPolish(base, { job, wantModel, lang: base.lang });
}

module.exports = { safePayload, adviseResult, adviseJob, deterministicResult, deterministicJob, outputLooksUnsafe };
