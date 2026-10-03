/**
 * Researcher-owned review protocol. Routes pharmacist work (fast vs dual)
 * from AI screening results. Does not approve prescriptions or change doses.
 */
const repo = require('./workflowRepository');
const { ServiceError } = require('./errors');

const TIER = { A0: 0, A1: 1, A2: 2, A3: 3 };

const DEFAULT_PROTOCOL = {
  version: 1,
  fastTrack: { enabled: true, maxTier: 'A1', noAbstain: true, noCriticalMissing: true },
  dualReview: { enabled: true, minTier: 'A2', onAbstain: true },
  note: '轻症快审；不确定或较重双审。A3 仍不能批准。AI 只分流，药师签署。',
  updatedBy: null,
  updatedAt: null,
};

function getProtocol() {
  const stored = repo.settings().get().researchProtocol;
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_PROTOCOL };
  return {
    ...DEFAULT_PROTOCOL,
    ...stored,
    fastTrack: { ...DEFAULT_PROTOCOL.fastTrack, ...(stored.fastTrack || {}) },
    dualReview: { ...DEFAULT_PROTOCOL.dualReview, ...(stored.dualReview || {}) },
  };
}

function saveProtocol(body, actor) {
  if (!actor || !['researcher', 'admin'].includes(actor.role)) {
    throw new ServiceError(403, 'researcher_only', 'Only a researcher or admin may change the research protocol');
  }
  const cur = getProtocol();
  const next = {
    ...cur,
    note: typeof body.note === 'string' ? body.note.slice(0, 400) : cur.note,
    fastTrack: {
      enabled: body.fastTrack?.enabled ?? cur.fastTrack.enabled,
      maxTier: body.fastTrack?.maxTier === 'A1' || body.fastTrack?.maxTier === 'A0' ? body.fastTrack.maxTier : cur.fastTrack.maxTier,
      noAbstain: body.fastTrack?.noAbstain ?? cur.fastTrack.noAbstain,
      noCriticalMissing: body.fastTrack?.noCriticalMissing ?? cur.fastTrack.noCriticalMissing,
    },
    dualReview: {
      enabled: body.dualReview?.enabled ?? cur.dualReview.enabled,
      minTier: ['A1', 'A2', 'A3'].includes(body.dualReview?.minTier) ? body.dualReview.minTier : cur.dualReview.minTier,
      onAbstain: body.dualReview?.onAbstain ?? cur.dualReview.onAbstain,
    },
    version: (cur.version || 1) + 1,
    updatedBy: String(actor.id),
    updatedAt: new Date().toISOString(),
  };
  repo.settings().set({ researchProtocol: next });
  return next;
}

function assignLane(output, protocol = getProtocol()) {
  const out = output || {};
  const tier = out.riskTier || 'A2';
  const fast = protocol.fastTrack || DEFAULT_PROTOCOL.fastTrack;
  const dual = protocol.dualReview || DEFAULT_PROTOCOL.dualReview;
  if (tier === 'A3') return 'priority';
  if (dual.enabled && ((dual.onAbstain && out.abstain) || (TIER[tier] || 0) >= (TIER[dual.minTier] || 2))) {
    return 'dual';
  }
  const critical = (out.missingInformation || []).some((m) => m.critical);
  if (
    fast.enabled
    && (TIER[tier] || 0) <= (TIER[fast.maxTier] || 1)
    && !(fast.noAbstain && out.abstain)
    && !(fast.noCriticalMissing && critical)
  ) {
    return 'fast';
  }
  return 'priority';
}

function applyReviewProtocol(c) {
  const out = c.analyses?.at(-1)?.output;
  const lane = assignLane(out);
  c.reviewLane = lane;
  if (lane === 'dual' && c.state === 'pharmacist_review_required') {
    if (c.secondReview?.status === 'completed') return lane;
    c.secondReview = {
      status: 'pending',
      requestedBy: 'research_protocol',
      requestedAt: c.secondReview?.requestedAt || new Date().toISOString(),
      reason: c.secondReview?.reason || 'dual_review_uncertain_or_severe',
      mode: 'dual',
      firstSigner: c.secondReview?.firstSigner || null,
      firstSignedAt: c.secondReview?.firstSignedAt || null,
    };
  }
  return lane;
}

module.exports = {
  DEFAULT_PROTOCOL,
  getProtocol,
  saveProtocol,
  assignLane,
  applyReviewProtocol,
};
