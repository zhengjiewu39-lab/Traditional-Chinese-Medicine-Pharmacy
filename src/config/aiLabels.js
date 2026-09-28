export const AI_LABEL = 'AI生成，需药师审核';
export const SYNTHETIC_LABEL = '合成演示数据，不代表真实患者';

export const STATE_LABELS = {
  received: '已接收',
  information_incomplete: '信息不完整',
  ai_screening: 'AI筛查中',
  pharmacist_review_required: '待药师审核',
  pharmacist_approved: '药师已批准',
  pharmacist_rejected: '药师已驳回',
  returned_to_prescriber: '已退回医师',
  patient_confirmation_required: '待患者确认',
  patient_confirmed: '患者已确认',
  patient_declined: '患者已拒绝',
  dispensing: '调剂中',
  pharmacist_final_check: '待药师复核',
  ready_for_pickup: '待取药/配送',
  completed: '已完成',
};

export const STATE_COLORS = {
  information_incomplete: 'warning',
  pharmacist_review_required: 'info',
  pharmacist_approved: 'success',
  pharmacist_rejected: 'error',
  returned_to_prescriber: 'error',
  patient_confirmation_required: 'secondary',
  patient_declined: 'default',
  pharmacist_final_check: 'info',
  ready_for_pickup: 'success',
  completed: 'default',
};

export const TIER_LABELS = {
  A0: 'A0 自动（仅记录）',
  A1: 'A1 未见规则风险',
  A2: 'A2 需药师判断',
  A3: 'A3 强制阻断',
};

export const TIER_COLORS = { A0: 'default', A1: 'success', A2: 'warning', A3: 'error' };

export const RECOMMENDATION_LABELS = {
  pass_to_pharmacist: '提交药师审核',
  clarification_required: '需补充信息',
  hard_stop: '硬性阻断',
  refer_to_prescriber: '建议联系处方医师',
};

export const OVERRIDE_REASONS = [
  { value: 'false_positive', label: '误报（规则不适用于本例）' },
  { value: 'patient_context', label: '患者具体情况已评估' },
  { value: 'evidence_outdated', label: '证据已过时' },
  { value: 'rule_not_applicable', label: '规则不适用' },
  { value: 'model_misinterpretation', label: '模型理解错误' },
  { value: 'other', label: '其他（需填写说明）' },
];

export const ABSTAIN_REASON_LABELS = {
  model_unavailable: '模型未启用',
  ai_disabled_by_kill_switch: 'AI总开关已关闭',
  model_timeout: '模型超时',
  model_error: '模型调用失败',
  schema_invalid: '模型输出不符合结构',
  prompt_injection_suspected: '疑似指令注入',
  input_too_long: '输入过长',
  citation_not_found: '引用了不存在的证据',
  autonomous_clinical_output: '模型输出包含诊断/开方表述',
  prescription_modification_attempt: '模型试图修改药味或剂量',
  key_information_missing: '关键信息缺失',
  no_evidence: '部分风险项缺少已审核证据',
  hard_rule_model_conflict: '模型与硬规则冲突',
};

export const SEMANTIC_STATUS_LABELS = {
  ok: '模型输出已通过校验',
  disabled: '模型未启用（仅规则）',
  disabled_by_kill_switch: 'AI已关闭（仅规则）',
  timeout: '模型超时（已回退规则）',
  error: '模型错误（已回退规则）',
  schema_invalid: '输出不合规（已回退规则）',
  policy_violation: '输出违反安全策略（已丢弃）',
  skipped_injection: '疑似注入（未调用模型）',
  skipped_input_too_long: '输入过长（未调用模型）',
};
