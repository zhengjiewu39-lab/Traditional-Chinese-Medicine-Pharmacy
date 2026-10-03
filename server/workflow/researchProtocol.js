/**
 * Researcher-owned review protocol. Routes pharmacist work (fast vs dual)
 * from AI screening results. Does not approve prescriptions or change doses.
 * A3 hard stops cannot be relaxed by protocol edits.
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
      minTier: ['A1', 'A2'].includes(body.dualReview?.minTier) ? body.dualReview.minTier : cur.dualReview.minTier,
      onAbstain: body.dualReview?.onAbstain ?? cur.dualReview.onAbstain,
    },
    version: (cur.version || 1) + 1,
    updatedBy: String(actor.id),
    updatedAt: new Date().toISOString(),
  };
  repo.settings().set({ researchProtocol: next });
  return next;
}

function freezeProtocol(c) {
  if (!c.protocolSnapshot) {
    const proto = getProtocol();
    c.protocolSnapshot = {
      version: proto.version,
      fastTrack: { ...proto.fastTrack },
      dualReview: { ...proto.dualReview },
      note: proto.note,
      frozenAt: new Date().toISOString(),
    };
  }
  return c.protocolSnapshot;
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

function signTarget(c, analysis) {
  const latest = analysis || c.analyses?.at(-1);
  return {
    contentVersion: c.contentVersion,
    contentHash: c.contentHash,
    analysisId: latest?.analysisId || null,
    protocolVersion: freezeProtocol(c).version,
  };
}

function signMatches(sign, target) {
  return Boolean(
    sign
    && target
    && sign.contentVersion === target.contentVersion
    && sign.contentHash === target.contentHash
    && sign.analysisId === target.analysisId
    && sign.protocolVersion === target.protocolVersion,
  );
}

function archiveDual(c, reason) {
  if (!c.secondReview) return;
  c.secondReviewHistory = c.secondReviewHistory || [];
  c.secondReviewHistory.push({
    ...c.secondReview,
    archivedAt: new Date().toISOString(),
    archivedReason: reason,
  });
  c.secondReview = null;
}

function applyReviewProtocol(c) {
  const proto = freezeProtocol(c);
  const out = c.analyses?.at(-1)?.output;
  const lane = assignLane(out, proto);
  c.reviewLane = lane;
  const target = signTarget(c, c.analyses?.at(-1));
  if (c.secondReview) {
    const signs = (c.secondReview.signs || []).filter((s) => signMatches(s, target));
    if (c.secondReview.status === 'completed') {
      const people = new Set(signs.map((s) => s.actorId));
      if (people.size >= 2) return lane;
      archiveDual(c, 'stale_completed_signature');
    } else if (c.secondReview.target && !signMatches(c.secondReview.target, target) && !signs.length) {
      archiveDual(c, 'stale_pending_signature');
    } else {
      c.secondReview.signs = signs;
      c.secondReview.target = target;
      if (!signs.length) {
        c.secondReview.firstSigner = null;
        c.secondReview.firstSignedAt = null;
      }
    }
  }
  if (lane === 'dual' && c.state === 'pharmacist_review_required' && c.secondReview?.status !== 'pending') {
    c.secondReview = {
      status: 'pending',
      requestedBy: 'research_protocol',
      requestedAt: new Date().toISOString(),
      reason: 'dual_review_uncertain_or_severe',
      mode: 'dual',
      target,
      signs: [],
      firstSigner: null,
      firstSignedAt: null,
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
  freezeProtocol,
  signTarget,
  signMatches,
  archiveDual,
};
