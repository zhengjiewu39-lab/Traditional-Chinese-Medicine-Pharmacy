const express = require('express');
const fs = require('fs');
const path = require('path');
const { requirePermission, sendError } = require('../security/rbac');
const { handle } = require('../routes/aiHttp');

const router = express.Router();

router.get('/', requirePermission('research:evaluation'), handle(async (req, res) => {
  const mockPath = path.resolve(__dirname, '../../benchmarks/ai-review/results/latest.md');
  const liveDir = path.resolve(__dirname, '../../benchmarks/ai-review/results-live');
  const liveJson = path.join(liveDir, 'latest.json');
  const liveExists = fs.existsSync(liveJson);
  res.json({
    home: '/research/evaluation',
    paperQuestion: '患者信息缺失或矛盾时，证据检索和结构化澄清是否能提高AI药学审核提示的可靠性。',
    mockEngineeringReport: fs.existsSync(mockPath) ? { path: 'benchmarks/ai-review/results/latest.md', notLiveModel: true } : null,
    liveModelReport: liveExists ? { path: 'benchmarks/ai-review/results-live/latest.json', generated: true } : { present: false, reason: 'No live-model file committed. Run npm run ai:evaluate:live with a real provider.' },
    groups: ['A_rules', 'B_llm', 'C_retrieval_llm', 'D_retrieval_clarification_llm'],
    warning: 'Mock reports are engineering regression only. They do not measure live LLM clinical performance.',
    medwear: { enabled: false, reason: 'No real MedWear interface; integration is disabled.' },
  });
}));

router.get('/export', requirePermission('research:evaluation'), handle(async (req, res) => {
  if (req.user.role === 'researcher') {
    return sendError(res, 403, 'forbidden', 'Research export does not include patient identifiers or tokens');
  }
  return sendError(res, 403, 'forbidden', 'Use the evaluation script for de-identified protocol exports');
}));

module.exports = router;
