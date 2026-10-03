/**
 * Desk-specific AI drafts. AI prepares text and confirmable requests.
 * It cannot approve, dispense, flip the kill switch, or promote live.
 */
const repo = require('./workflowRepository');
const pharmacyOps = require('./pharmacyOps');
const { ServiceError } = require('./errors');
const { fetchPubmed, listStored } = require('../knowledge/authorityIngest');

const FORBIDDEN = new Set(['kill_switch', 'promote_live', 'approve', 'dispense', 'set_api_key']);
const DECISIONS = 'adminProposalDecisions';

function lastOutput(c) {
  return c.analyses?.at(-1)?.output || null;
}

function proposalIdOf(body) {
  if (body?.id) return String(body.id);
  if (body?.type === 'restock') {
    const ids = body.payload?.inventoryIds || [];
    return ids.length === 1 ? `restock-${ids[0]}` : `restock-${ids.join(',')}`;
  }
  if (body?.type === 'knowledge_fetch') return `knowledge-${String(body.payload?.herb || '').trim()}`;
  if (body?.type === 'info') return 'backlog-review';
  return String(body?.type || 'unknown');
}

function listDecisions() {
  return (repo.listDocs(DECISIONS) || [])
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
    .slice(0, 12);
}

function recordDecision(row) {
  const rec = {
    ...row,
    at: row.at || new Date().toISOString(),
  };
  repo.saveDoc(DECISIONS, rec.id, rec);
  return rec;
}

function decisionById() {
  const map = new Map();
  for (const d of repo.listDocs(DECISIONS) || []) map.set(d.id, d);
  return map;
}

function pendingRestockIds(desk) {
  return new Set((desk.pendingRequests || []).map((r) => Number(r.inventoryId)));
}

function fetchedHerbs() {
  try {
    return new Set((listStored() || []).map((r) => r.herb).filter(Boolean));
  } catch {
    return new Set();
  }
}

function dispensingBrief(c, plan) {
  const out = lastOutput(c);
  const herbs = c.prescription?.herbs || [];
  const doses = Number(c.prescription?.doseCount) || 1;
  const official = out?.deskNotes?.dispensing || null;
  return {
    caseId: c.caseId,
    state: c.state,
    cannotExecute: true,
    reviewStatus: out?.deskNotes?.reviewStatus || 'deterministic_fallback',
    note: official || '按处方称量，不得改味改量。缺味或超差交药师复核。',
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
  const decidedMap = decisionById();
  const openRestock = pendingRestockIds(desk);
  const knownDrafts = fetchedHerbs();
  for (const r of desk.restock || []) {
    const id = `restock-${r.inventoryId}`;
    if (decidedMap.get(id)?.decision === 'reject') continue;
    if (openRestock.has(Number(r.inventoryId))) continue;
    proposals.push({
      id,
      type: 'restock',
      title: `建议补货 ${r.name} ${r.suggestedQty}${r.unit || ''}`,
      detail: `库存 ${r.stock}，最低 ${r.minStock}，待配 ${r.pendingDemand || 0}。生成待验收需求，不直接加库存。`,
      payload: { inventoryIds: [r.inventoryId] },
      needsConfirm: true,
    });
    if (proposals.filter((p) => p.type === 'restock').length >= 8) break;
  }
  for (const herb of [...unknown].filter(Boolean)) {
    if (!(herb === '防风' || /[\u4e00-\u9fff]/.test(herb))) continue;
    const id = `knowledge-${herb}`;
    if (decidedMap.has(id) || knownDrafts.has(herb)) continue;
    proposals.push({
      id,
      type: 'knowledge_fetch',
      title: `检索「${herb}」题录草稿`,
      detail: '写入 PubMed 题录草稿，非正式药典，检索后仍须药师/管理员审看。',
      payload: { herb },
      needsConfirm: true,
    });
    if (proposals.filter((p) => p.type === 'knowledge_fetch').length >= 5) break;
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
    pendingReceipts: openRestock.size,
    proposals,
    decided: listDecisions(),
  };
}

async function confirmAdminProposal(body, actor) {
  const type = String(body?.type || '');
  if (FORBIDDEN.has(type)) {
    throw new ServiceError(403, 'admin_reserved', 'This action stays with the administrator and cannot be auto-applied.');
  }
  const id = proposalIdOf(body);
  const title = type === 'restock'
    ? `补货 ${JSON.stringify(body.payload?.inventoryIds || [])}`
    : type === 'knowledge_fetch'
      ? `检索「${String(body.payload?.herb || '').trim()}」`
      : type;
  if (body?.decision === 'reject') {
    const decision = recordDecision({
      id, type, title, decision: 'reject', applied: false, actorId: String(actor?.id || ''),
      note: 'Rejected by administrator. Nothing was written.',
    });
    return { ok: true, applied: false, type, id, note: decision.note, brief: adminBrief() };
  }
  if (type === 'restock') {
    const out = pharmacyOps.proposeRestock(actor, { inventoryIds: body.payload?.inventoryIds || [] });
    recordDecision({
      id, type, title: out.requests?.[0] ? `补货 ${out.requests[0].name}` : title,
      decision: 'accept', applied: true, actorId: String(actor?.id || ''),
      note: out.note, requestCount: (out.requests || []).length,
    });
    return { ...out, ok: true, applied: true, type, id, brief: adminBrief() };
  }
  if (type === 'knowledge_fetch') {
    const herb = String(body.payload?.herb || '').trim();
    if (!herb) throw new ServiceError(400, 'herb_required', 'herb is required');
    const out = await fetchPubmed(herb, { retmax: 3 });
    recordDecision({
      id, type, title: `检索「${herb}」`, decision: 'accept', applied: true,
      actorId: String(actor?.id || ''), written: out.written,
      note: `Wrote ${out.written} PubMed draft(s). Not pharmacopoeia.`,
    });
    return { ok: true, applied: true, type, id, written: out.written, clinicalUse: false, brief: adminBrief() };
  }
  if (type === 'info') return { ok: true, applied: false, type, id, note: 'Information only.', brief: adminBrief() };
  throw new ServiceError(400, 'unknown_proposal', `Unknown proposal type ${type}`);
}

function assist(lane, { caseRecord, plan } = {}) {
  if (lane === 'dispensing') return { lane, brief: caseRecord ? dispensingBrief(caseRecord, plan) : null };
  if (lane === 'admin') return { lane, brief: adminBrief() };
  if (lane === 'screening') {
    const out = lastOutput(caseRecord || {});
    return { lane, brief: out?.deskNotes || null, cannotExecute: true };
  }
  throw new ServiceError(400, 'unknown_lane', 'lane must be screening, dispensing or admin');
}

module.exports = { assist, confirmAdminProposal, dispensingBrief, adminBrief, FORBIDDEN };
