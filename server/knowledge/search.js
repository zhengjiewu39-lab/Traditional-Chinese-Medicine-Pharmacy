/**
 * Local knowledge search over sealed sources, authority catalog, stored PubMed drafts,
 * and inventory herb names. Does not invent pharmacopoeia text.
 */
const { loadRegistry } = require('./sourceRegistry');
const { catalog, listStored } = require('./authorityIngest');
const { getStore } = require('../data/store');

function excerpt(text, q, n = 180) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const i = s.toLowerCase().indexOf(String(q).toLowerCase());
  if (i < 0) return s.slice(0, n);
  const start = Math.max(0, i - 40);
  return `${start ? '…' : ''}${s.slice(start, start + n)}${start + n < s.length ? '…' : ''}`;
}

function matches(hay, q) {
  return String(hay || '').toLowerCase().includes(q);
}

function searchKnowledge(raw) {
  const query = String(raw || '').trim();
  if (!query) {
    return {
      query: '',
      hits: [],
      note: 'Enter a herb name or topic. This search does not invent Chinese Pharmacopoeia text.',
    };
  }
  const q = query.toLowerCase();
  const hits = [];

  for (const e of loadRegistry().entries) {
    const hay = [e.sourceId, e.title, e.authority, e.content, ...(e.scope?.herbs || []), ...(e.scope?.topics || [])].join('\n');
    if (!matches(hay, q)) continue;
    hits.push({
      kind: 'local_source',
      id: e.sourceId,
      title: e.title,
      authority: e.authority,
      reviewStatus: e.reviewStatus,
      usable: e.usable,
      synthetic: e.synthetic !== false,
      clinicalUse: e.clinicalUse === true,
      snippet: excerpt(e.content, query),
      sourceUrl: e.sourceUrl || null,
    });
  }

  for (const s of catalog().sources) {
    const hay = [s.id, s.name, s.authority, s.note, s.verifyUrl].join('\n');
    if (!matches(hay, q)) continue;
    hits.push({
      kind: 'authority_catalog',
      id: s.id,
      title: s.name,
      authority: s.authority,
      access: s.access || null,
      snippet: s.note || '',
      sourceUrl: s.verifyUrl || null,
      clinicalUse: false,
    });
  }

  for (const r of listStored({ withDocument: true })) {
    let doc = {};
    try { doc = JSON.parse(r.document || '{}'); } catch { doc = {}; }
    const hay = [r.herb, r.pmid, r.source_url, doc.title, doc.content, doc.fragment].join('\n');
    if (!matches(hay, q)) continue;
    hits.push({
      kind: 'pubmed_draft',
      id: r.id,
      title: doc.title || `PMID ${r.pmid}`,
      authority: 'NCBI PubMed',
      reviewStatus: r.review_status,
      snippet: excerpt(doc.content || doc.title || '', query),
      sourceUrl: r.source_url,
      pmid: r.pmid,
      clinicalUse: false,
    });
  }

  for (const h of (getStore().herbs || []).slice(0, 400)) {
    if (!matches(`${h.name || ''} ${h.id || ''} ${h.category || ''}`, q)) continue;
    hits.push({
      kind: 'herb_catalog',
      id: String(h.id),
      title: h.name,
      authority: '本店库存目录',
      snippet: '库存标识，不是临床证据，也不是药典正文。',
      catalogOnly: true,
      clinicalUse: false,
    });
  }

  return {
    query,
    hits,
    note: 'Local search only. Chinese Pharmacopoeia full text is not available here. A hit is not a clinical approval.',
  };
}

module.exports = { searchKnowledge, excerpt };
