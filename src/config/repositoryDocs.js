/**
 * GitHub blob URLs for repository documentation (repo root = project root on main).
 * @see docs/README.md
 */

export const GITHUB_REPO = 'https://github.com/zhengjiewu39-lab/Traditional-Chinese-Medicine-Pharmacy';
export const GITHUB_BLOB_MAIN = `${GITHUB_REPO}/blob/main`;

/** @param {string} repoPath path from repository root, e.g. `docs/metrics.md` */
export function githubBlobUrl(repoPath) {
  const p = repoPath.replace(/^\//, '');
  return `${GITHUB_BLOB_MAIN}/${p}`;
}

/** Simulation research documentation shown on /simulation/documentation */
export const SIMULATION_DOC_SECTIONS = [
  {
    sectionKey: 'docsPage.sectionAiPharmacy',
    items: [
      { path: 'AI_PHARMACY_VALIDATION_REPORT.md', titleKey: 'docs.aiValidationReport' },
      { path: 'docs/ai-pharmacy-architecture.md', titleKey: 'docs.aiArchitecture' },
      { path: 'docs/ai-safety-boundaries.md', titleKey: 'docs.aiSafety' },
      { path: 'docs/pharmacist-governance.md', titleKey: 'docs.pharmacistGov' },
      { path: 'docs/patient-participation.md', titleKey: 'docs.patientPart' },
      { path: 'docs/ai-evaluation-protocol.md', titleKey: 'docs.aiEval' },
      { path: 'docs/knowledge-governance.md', titleKey: 'docs.knowledgeGov' },
      { path: 'docs/digital-twin-integration.md', titleKey: 'docs.digitalTwin' },
      { path: 'docs/clinical-validation-limitations.md', titleKey: 'docs.clinicalLimits' },
    ],
  },
  {
    sectionKey: 'docsPage.sectionCore',
    items: [
      { path: 'FINAL_VALIDATION_REPORT.md', titleKey: 'docs.finalReport' },
      { path: 'MODEL_CARD.md', titleKey: 'docs.modelCard' },
      { path: 'docs/model-specification.md', titleKey: 'docs.modelSpec' },
      { path: 'docs/metrics.md', titleKey: 'docs.metrics' },
      { path: 'docs/experiment-protocol.md', titleKey: 'docs.experimentProtocol' },
      { path: 'docs/verification-validation.md', titleKey: 'docs.verification' },
      { path: 'docs/result-interpretation.md', titleKey: 'docs.resultInterpretation' },
      { path: 'docs/data-dictionary.md', titleKey: 'docs.dataDictionary' },
      { path: 'docs/algorithm.md', titleKey: 'docs.algorithm' },
    ],
  },
  {
    sectionKey: 'docsPage.sectionMethods',
    items: [
      { path: 'docs/methodology.md', titleKey: 'docs.methodology' },
      { path: 'docs/assumptions.md', titleKey: 'docs.assumptions' },
      { path: 'docs/reproducibility.md', titleKey: 'docs.reproducibility' },
      { path: 'docs/limitations.md', titleKey: 'docs.limitations' },
      { path: 'docs/simulate-checklist.md', titleKey: 'docs.simulateChecklist' },
      { path: 'docs/stress-checklist.md', titleKey: 'docs.stressChecklist' },
      { path: 'docs/paper-outline.md', titleKey: 'docs.paperOutline' },
    ],
  },
  {
    sectionKey: 'docsPage.sectionPaper',
    items: [
      { path: 'paper/tables/main.md', titleKey: 'docs.paperMain' },
      { path: 'paper/tables/scenarios.md', titleKey: 'docs.paperScenarios' },
      { path: 'paper/tables/parameters.md', titleKey: 'docs.paperParameters' },
      { path: 'paper/tables/ablation.md', titleKey: 'docs.paperAblation' },
      { path: 'paper/tables/sensitivity.md', titleKey: 'docs.paperSensitivity' },
      { path: 'paper/tables/stress.md', titleKey: 'docs.paperStress' },
      { path: 'paper/results/manifest.json', titleKey: 'docs.paperManifest' },
    ],
  },
  {
    sectionKey: 'docsPage.sectionMeta',
    items: [
      { path: 'README.md', titleKey: 'docs.readme' },
      { path: 'CHANGELOG.md', titleKey: 'docs.changelog' },
      { path: 'CITATION.cff', titleKey: 'docs.citation' },
      { path: 'docs/README.md', titleKey: 'docs.index' },
      { path: 'docs/migration-final-research.md', titleKey: 'docs.migration' },
      { path: 'docs/refactor-mapping.md', titleKey: 'docs.refactorMapping' },
      { path: 'docs/legacy-cdss.md', titleKey: 'docs.legacyCdss' },
      { path: 'docs/archive/v3/model-validation.md', titleKey: 'docs.archiveV3' },
    ],
  },
  {
    sectionKey: 'docsPage.sectionLegacyCdss',
    items: [
      { path: 'docs/legacy-cdss/ETHICS.md', titleKey: 'docs.legacyEthics' },
      { path: 'docs/legacy-cdss/LITERATURE.md', titleKey: 'docs.legacyLiterature' },
      { path: 'docs/legacy-cdss/REPRODUCIBILITY.md', titleKey: 'docs.legacyReproducibility' },
      { path: 'docs/legacy-cdss/EVALUATION.md', titleKey: 'docs.legacyEvaluation' },
    ],
  },
];
