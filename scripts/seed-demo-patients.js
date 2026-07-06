#!/usr/bin/env node
/**
 * Seed demo patients + linked prescriptions into data/store.json
 * Usage: node scripts/seed-demo-patients.js [--n 500] [--force] [--rx-per-patient 1]
 */

const fs = require('fs');
const { buildSeed } = require('../server/data/seed');
const { ensureDemoPatients, DEMO_PATIENT_COUNT } = require('../server/data/patientGenerator');
const { ensureDemoPrescriptions } = require('../server/data/prescriptionGenerator');
const { ensureCatalogData } = require('../server/data/herbCatalog');
const { ensureTraceabilityData } = require('../server/data/traceabilityGenerator');
const { STORE_FILE, load, save } = require('../server/data/store');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { n: DEMO_PATIENT_COUNT, force: false, rxPerPatient: 1 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--n') opts.n = +args[++i];
    else if (args[i] === '--force') opts.force = true;
    else if (args[i] === '--rx-per-patient') opts.rxPerPatient = +args[++i];
  }
  return opts;
}

function main() {
  const { n, force, rxPerPatient } = parseArgs();

  let store;
  if (!fs.existsSync(STORE_FILE) || force) {
    store = buildSeed();
    console.log(force ? 'Rebuilt store from seed template' : 'Created new store from seed');
  } else {
    store = load();
  }

  const patientsBefore = store.patients?.length || 0;
  const rxBefore = store.prescriptions?.length || 0;

  const patientResult = ensureDemoPatients(store, n);
  const rxResult = ensureDemoPrescriptions(store, rxPerPatient);
  const catalogResult = ensureCatalogData(store);
  const traceResult = ensureTraceabilityData(store);

  store.meta = store.meta || {};
  store.meta.version = 7;
  store.meta.demoPatients = store.patients.length;
  store.meta.demoPrescriptions = store.prescriptions.length;
  store.meta.catalogHerbs = catalogResult.herbTotal;
  store.meta.catalogTemplates = catalogResult.templateTotal;
  store.meta.traceabilityRecords = traceResult.total;
  save(store);

  console.log('\n=== Demo Patient + Prescription Seed ===\n');
  console.log(`Patients: ${patientsBefore} → ${patientResult.total} (+${patientResult.added})`);
  console.log(`Prescriptions: ${rxBefore} → ${rxResult.total} (+${rxResult.added})`);
  console.log(`Herbs: ${catalogResult.herbTotal} (+${catalogResult.herbsAdded}) · Templates: ${catalogResult.templateTotal} (+${catalogResult.tplAdded})`);
  console.log(`Traceability: ${traceResult.total} records · 示例码: ${traceResult.sampleCodes.join(', ')}`);
  console.log(`Store: ${STORE_FILE}\n`);
}

main();
