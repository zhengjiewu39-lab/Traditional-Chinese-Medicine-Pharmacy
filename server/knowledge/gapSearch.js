/**
 * When sealed knowledge does not cover a herb, look up cached then live PubMed titles.
 * Drafts are not pharmacopoeia and cannot approve a dose.
 */
const { listStored, fetchPubmed } = require('./authorityIngest');

function toDraftView(record) {
  const pmid = record.pmid || record.id?.replace(/^KS-PMID-/, '');
  const title = record.title || `PMID ${pmid}`;
  const content = record.content || [title, record.source_url || record.url].filter(Boolean).join('\n');
  return {
    sourceId: `KS-PMID-${pmid}`,
    title,
    authority: 'NCBI PubMed',
    version: 'pubmed-title',
    effectiveDate: record.retrievedAt || record.retrieved_at || null,
    content: `【PubMed 题录草稿，不是中国药典，不能单独批准用药】\n${content}`,
    hash: record.hash || record.content_hash || `pmid-${pmid}`,
    excerpt: String(title).slice(0, 280),
    synthetic: false,
    sourceType: 'pubmed_draft',
    clinicalUse: false,
    reviewStatus: record.reviewStatus || record.review_status || 'draft',
    sourceUrl: record.sourceUrl || record.source_url || record.url || null,
  };
}

function cachedForHerb(herb) {
  const rows = listStored({ withDocument: true }).filter((r) => r.herb === herb);
  return rows.slice(0, 3).map((r) => {
    let doc = {};
    try { doc = JSON.parse(r.document || '{}'); } catch { doc = {}; }
    return toDraftView({ ...doc, pmid: r.pmid, content_hash: r.content_hash, source_url: r.source_url, retrieved_at: r.retrieved_at, review_status: r.review_status });
  });
}

async function searchGaps({ unknownHerbs = [], herbNames = [], fetchImpl, searchHerbImpl, maxHerbs = 3, retmax = 3 } = {}) {
  const ordered = [...new Set([...(unknownHerbs || []), ...(herbNames || [])].map((n) => String(n || '').trim()).filter(Boolean))].slice(0, maxHerbs);
  const drafts = [];
  const queried = [];
  const lookup = searchHerbImpl || ((herb, opts) => fetchPubmed(herb, opts));
  for (const herb of ordered) {
    if (!searchHerbImpl) {
      const cached = cachedForHerb(herb);
      if (cached.length) {
        drafts.push(...cached);
        queried.push({ herb, source: 'cache', n: cached.length });
        continue;
      }
    }
    try {
      const out = await lookup(herb, { fetchImpl, retmax });
      const views = (out.records || []).map(toDraftView);
      drafts.push(...views);
      queried.push({ herb, source: searchHerbImpl ? 'stub' : 'pubmed', n: views.length });
    } catch (err) {
      queried.push({ herb, source: 'error', error: err.message, n: 0 });
    }
  }
  const byId = new Map(drafts.map((d) => [d.sourceId, d]));
  return {
    drafts: [...byId.values()],
    queried,
    clinicalUse: false,
    note: 'PubMed titles only. Not Chinese Pharmacopoeia. A hit is not permission to dispense.',
  };
}

function mergeRetrieval(retrieval, search) {
  if (!search?.drafts?.length) return retrieval;
  const seen = new Set((retrieval.researchDrafts || []).map((e) => e.sourceId));
  const extra = search.drafts.filter((d) => !seen.has(d.sourceId));
  return {
    ...retrieval,
    researchDrafts: [...(retrieval.researchDrafts || []), ...extra],
    externalSearch: {
      used: true,
      draftCount: extra.length,
      queried: search.queried,
      clinicalUse: false,
      liftsNoEvidence: false,
      note: search.note,
    },
  };
}

module.exports = { searchGaps, mergeRetrieval, toDraftView };
