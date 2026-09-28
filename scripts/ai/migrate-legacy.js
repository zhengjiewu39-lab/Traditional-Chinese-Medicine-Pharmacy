#!/usr/bin/env node
require('dotenv').config();
const { migrateLegacyPrescriptions } = require('../../server/workflow/legacyMigrate');

migrateLegacyPrescriptions({ role: 'system', id: 'cli-migrate', name: 'cli' }, { analyzeAfter: process.argv.includes('--analyze') })
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
