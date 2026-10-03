/**
 * NCBI E-utilities connector. Stores only what PubMed returns.
 * Does not invent abstracts, doses, or pharmacopoeia text.
 */
const { hashObject } = require('../common/hash');

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

const LATIN = {
  黄芪: 'Astragalus membranaceus',
  甘草: 'Glycyrrhiza uralensis',
  当归: 'Angelica sinensis',
  白术: 'Atractylodes macrocephala',
  茯苓: 'Wolfiporia cocos',
  人参: 'Panax ginseng',
  附子: 'Aconitum carmichaelii',
  丹参: 'Salvia miltiorrhiza',
  川芎: 'Ligusticum chuanxiong',
  黄连: 'Coptis chinensis',
};

function queryFor(herb) {
  const latin = LATIN[herb];
  const parts = [`"${herb}"[Title/Abstract]`];
  if (latin) parts.push(`"${latin}"[Title/Abstract]`);
  return `(${parts.join(' OR ')}) AND (traditional Chinese medicine OR herbal)`;
}

function parseSearch(json) {
  const ids = json?.esearchresult?.idlist || [];
  return ids.map(String);
}

function parseSummaries(json) {
  const result = json?.result || {};
  const uids = result.uids || [];
  return uids.map((id) => {
    const row = result[id] || {};
    const title = String(row.title || '').trim();
    const source = String(row.source || row.fulljournalname || '').trim();
    const year = String(row.pubdate || '').slice(0, 4);
    const authors = Array.isArray(row.authors) ? row.authors.map((a) => a.name).filter(Boolean).slice(0, 8) : [];
    const url = `https://pubmed.ncbi.nlm.nih.gov/${id}/`;
    const content = [title, authors.join(', '), `${source} ${year}`.trim(), url].filter(Boolean).join('\n');
    return {
      pmid: String(id),
      title: title || `PMID ${id}`,
      source,
      year,
      authors,
      url,
      content,
    };
  }).filter((r) => r.pmid);
}

async function searchHerb(herb, { fetchImpl = fetch, retmax = 5, email = process.env.NCBI_EMAIL || 'tcm-research-prototype@localhost' } = {}) {
  const name = String(herb || '').trim();
  if (!name) throw new Error('herb required');
  const common = `tool=tcm-digital-pharmacy&email=${encodeURIComponent(email)}`;
  const searchUrl = `${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&retmax=${Number(retmax) || 5}&term=${encodeURIComponent(queryFor(name))}&${common}`;
  const searchRes = await fetchImpl(searchUrl);
  if (!searchRes.ok) throw new Error(`PubMed search HTTP ${searchRes.status}`);
  const ids = parseSearch(await searchRes.json());
  if (!ids.length) return { herb: name, query: queryFor(name), records: [] };
  const sumUrl = `${EUTILS}/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}&${common}`;
  const sumRes = await fetchImpl(sumUrl);
  if (!sumRes.ok) throw new Error(`PubMed summary HTTP ${sumRes.status}`);
  const records = parseSummaries(await sumRes.json()).map((r) => ({
    ...r,
    herb: name,
    retrievedAt: new Date().toISOString(),
    connector: 'pubmed',
    authority: 'U.S. National Library of Medicine',
    sourceUrl: r.url,
    hash: hashObject({ pmid: r.pmid, title: r.title, content: r.content }),
    reviewStatus: 'draft',
    clinicalUse: false,
    synthetic: false,
    fragment: r.title,
    section: 'title_authors_journal',
    page: null,
    population: null,
    evidenceQuality: 'not_assessed',
  }));
  return { herb: name, query: queryFor(name), records };
}

module.exports = { queryFor, parseSearch, parseSummaries, searchHerb, LATIN };
