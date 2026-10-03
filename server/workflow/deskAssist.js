/**
 * Desk-specific AI drafts. AI prepares text and confirmable requests.
 * It cannot approve, dispense, flip the kill switch, or promote live.
 */
const repo = require('./workflowRepository');
const pharmacyOps = require('./pharmacyOps');
const { ServiceError } = require('./errors');
const { fetchPubmed } = require('../knowledge/authorityIngest');

const FORBIDDEN = new Set(['kill_switch', 'promote_live', 'approve', 'dispense', 'set_api_key']);

function lastOutput(c) {
  return c.analyses?.at(-1)?.output || null;
}

function dispensingBrief(c, plan) {
  const out = lastOutput(c);
  const herbs = c.prescription?.herbs || [];
  const doses = Number(c.prescription?.doseCount) || 1;
  const notes = out?.deskNotes?.dispensing || out?.shadowResult?.deskNotes?.dispensing || null;
  return {
    caseId: c.caseId,
    state: c.state,
    cannotExecute: true,
    note: notes || '按处方称量，不得改味改量。缺味或超差交药师复核。',
    lines: herbs.map((h) => {
      const line = (plan?.lines || []).find((l) => l.herbName === h.name);
      return {
        name: h.name,
        perDose: h.dosage,
        planned: h.dosage != null ? Number(h.dosage) * doses : null,
        unit: h.unit || 'g',
        location: line?.location || null,
        batch: line?.batchNo || null,
        status: line?.status || 'unknown',
      };
    }),
    ready: plan?.ready !== false,
  };
}

function adminBrief() {
  const byState = repo.countCasesByState();
  const desk = pharmacyOps.planDesk(repo.listCasesInStates([
    'pharmacist_approved', 'patient_confirmation_required', 'patient_confirmed', 'dispensing',
  ]));
  const recent = repo.listCases({ limit: 20 });
  const unknown = new Set();
  for (const c of recent) {
    const out = lastOutput(c);
    for (const a of out?.alerts || []) {
      if (a.code === 'HERB_NOT_IN_RULESET') unknown.add((a.message || '').split(' ')[0]);
    }
    for (const n of out?.ruleTrackResult?.unknownHerbs || []) unknown.add(n);
  }
  const proposals = [];
  for (const r of (desk.restock || []).slice(0, 8)) {
    proposals.push({
      id: `restock-${r.inventoryId}`,
      type: 'restock',
      title: `建议补货 ${r.name} ${r.suggestedQty}${r.unit || ''}`,
      detail: `库存 ${r.stock}，最低 ${r.minStock}，待配 ${r.pendingDemand || 0}。生成待验收需求，不直接加库存。`,
      payload: { inventoryIds: [r.inventoryId] },
      needsConfirm: true,
    });
  }
  for (const herb of [...unknown].filter(Boolean).slice(0, 5)) {
    if (herb === '防风' || /[\u4e00-\u9fff]/.test(herb)) {
      proposals.push({
        id: `knowledge-${herb}`,
        type: 'knowledge_fetch',
        title: `检索「${herb}」题录草稿`,
        detail: '写入 PubMed 题录草稿，非正式药典，检索后仍须药师/管理员审看。',
        payload: { herb },
        needsConfirm: true,
      });
    }
  }
  const pending = byState.pharmacist_review_required || 0;
  if (pending) {
    proposals.push({
      id: 'backlog-review',
      type: 'info',
      title: `待药师审核 ${pending} 件`,
      detail: 'AI 不能代审。请安排药师处理，管理员只做治理终审。',
      needsConfirm: false,
    });
  }
  return {
    cannotExecute: true,
    reservedForAdmin: [...FORBIDDEN],
    note: 'AI 只起草。管理员确认后才生成补货需求或检索草稿。不能批准处方、发药、关闭 AI 或升为 live。',
    pendingReview: pending,
    restockOpen: (desk.restock || []).length,
    proposals,
  };
}

async function confirmAdminProposal(body, actor) {
  const type = String(body?.type || '');
  if (FORBIDDEN.has(type)) {
    throw new ServiceError(403, 'admin_reserved', 'This action stays with the administrator and cannot be auto-applied.');
  }
  if (body?.decision === 'reject') {
    return { ok: true, applied: false, type, note: 'Rejected by administrator. Nothing was written.' };
  }
  if (type === 'restock') {
    return pharmacyOps.proposeRestock(actor, { inventoryIds: body.payload?.inventoryIds || [] });
  }
  if (type === 'knowledge_fetch') {
    const herb = String(body.payload?.herb || '').trim();
    if (!herb) throw new ServiceError(400, 'herb_required', 'herb is required');
    const out = await fetchPubmed(herb, { retmax: 3 });
    return { ok: true, applied: true, type, written: out.written, clinicalUse: false };
  }
  if (type === 'info') return { ok: true, applied: false, type, note: 'Information only.' };
  throw new ServiceError(400, 'unknown_proposal', `Unknown proposal type ${type}`);
}

function assist(lane, { caseRecord, plan } = {}) {
  if (lane === 'dispensing') return { lane, brief: caseRecord ? dispensingBrief(caseRecord, plan) : null };
  if (lane === 'admin') return { lane, brief: adminBrief() };
  if (lane === 'screening') {
    const out = lastOutput(caseRecord || {});
    return { lane, brief: out?.deskNotes || out?.shadowResult?.deskNotes || null };
  }
  throw new ServiceError(400, 'unknown_lane', 'lane must be screening, dispensing or admin');
}

module.exports = { assist, confirmAdminProposal, dispensingBrief, adminBrief, FORBIDDEN };
