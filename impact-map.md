# 影响清单：中药数字药学服务系统定向重构

基线：`main` `0790ca91443916b268c766bb87b66526b4aaadd7`（2026-09-29）  
分支：`refactor/digital-pharmacy-service`  
论文问题：患者信息缺失或矛盾时，证据检索和结构化澄清是否能提高 AI 药学审核提示的可靠性。  
产品定位：药师监督下、患者参与的 AI 中药用药支持与随访研究原型。

本清单以仓库实际路径为准。冻结标签已核实存在：`v1.0.0-research`（供应仿真）、`legacy-cdss-v1`（旧处方分析）。二者均可从 Git 历史恢复；本轮归档额外把主应用代码移到 `archive/`，不重写历史。

## 1. 数据存储（现状）

| 存储 | 路径 / 实现 | 调用方 | 决定 |
|---|---|---|---|
| 业务 JSON | `data/store.json` ← `server/data/store.js` | 库存、订单、患者 CRM、客户、追溯、模板 | **迁移**到 SQLite 事务库；JSON 保留为 fixture 与一次性导入源 |
| AI 工作流 JSON | `data/ai/{DATA_MODE}/cases.json` ← `server/workflow/workflowRepository.js` + `server/common/jsonFileStore.js` | 病例、令牌、草稿、建议、取药令牌、学习登记 | **迁移**到同一 SQLite；导入后 JSON 只读备份 |
| 审计链 | `data/ai/{DATA_MODE}/audit-chain.jsonl` ← `server/audit/auditRepository.js` | `workflowService.record` | **保留**追加哈希链；SQLite 存索引，不替代链 |
| 仿真实验 | `data/simulation-experiments/` | `server/simulation/experimentRepository.js` | **归档**；主应用与默认 CI 不再读写 |
| SQLite | 不存在 | — | **新增** `data/ai/{DATA_MODE}/pharmacy.sqlite`（单机原型，`better-sqlite3`） |

迁移方式：版本化 SQL（`server/db/migrations/`），启动时 `migrate()`；若 SQLite 空且存在 `cases.json`/`store.json` 则导入一次并写 `migration_log`；可重复执行（按主键跳过）；失败不覆盖已有行，输出数量校验。回滚：关闭进程、恢复 `.sqlite.bak` 与 JSON 备份。

## 2. 可复用核心（保留，不平行重写）

| 模块 | 路径 | 调用方 | 决定 |
|---|---|---|---|
| 模型适配 | `server/ai/providerAdapter.js`, `openAICompatibleProvider.js`, `mockProvider.js` | `aiRuntime`, `evaluate-live` | 保留。未配置模型显示未连接/仅规则，不把 mock 当真实服务 |
| 三轨编排 | `server/ai/aiOrchestrator.js` | `workflowService.runAnalysis` | 保留。扩展输出合同与证据片段；去掉伪 confidence 展示 |
| 状态机 | `server/workflow/prescriptionStateMachine.js` | 仅 `workflowService.transition` | 保留主状态；澄清/说明/随访用独立任务状态 |
| 工作流 | `server/workflow/workflowService.js` | `server/routes/ai.js`, `patientPortal.js`, `pickupService.js` | 保留为唯一病例突变入口 |
| 草稿 / 建议 | `draftService.js`, `suggestionService.js` | AI 路由 | 保留；建议结构补齐 suggestionId/evidenceRefs/limitations；删除替换候选 |
| 知识 / 审计 / 权限 | `server/knowledge/`, `server/audit/`, `server/security/` | 编排器、路由、认证 | 保留并扩展来源字段、对象级授权 |
| 前端工作台 | `src/pages/ai/*`, `src/pages/patient/*`, `DoctorWorkbench.js` | `src/App.js` | 保留并按角色收敛 |

## 3. 患者资料与令牌（纠正）

| 问题 | 实际代码 | 决定 |
|---|---|---|
| 确认令牌仅批准后发放 | `issuePatientConfirmation` 要求 `pharmacist_approved` / `patient_confirmation_required` | **新增**澄清令牌与独立入口，可在 `information_incomplete` 与待审核使用 |
| 肝肾 boolean、过敏/用药数组 | `caseSchemas.PATIENT`；`ruleTrack` / `redaction` 读同字段 | **扩展**临床事实对象（status/value/来源/版本）；旧 `false`/空数组 → `unknown`，不视为明确没有 |
| 安全信息只追加 | `safetyChangesFrom` 合并数组 | **改为**待核实变更（新增/停用/纠错），保留旧值 |
| 说明绑定处方批准 | `patientView.explanation` 看 `c.approval.valid` | **新增** `PatientEducationDocument`；患者只看 published 且版本有效的文档 |
| 反馈过粗 | `PATIENT_FEEDBACK` 1–5 分 + ADR boolean；`pharmacovigilanceFollowUp.status=open` | **扩展**服用状态与 `FollowUpTask`（负责人、过程、关闭条件） |
| 通用替代同意 | `substitutionConsent`；`substitutionCandidatesFor` | **移除**患者通用替代授权与无来源替换候选；改方仅医师 |

令牌用途拆分：`clarification` / `confirmation` / `feedback` / `pickup`。服务端只存哈希；绑定 `caseId`、`contentVersion`、患者、有效期；旧令牌不能批准新版。

字段级失效：临床事实、处方内容变更 → `contentVersion++`、撤销审核、建议 superseded、重分析。仅配送偏好（fulfillment）不触发重审。

## 4. 证据与评价（纠正）

| 问题 | 实际代码 | 决定 |
|---|---|---|
| 命中有引用即 strong | `evidenceRetriever.retrieve`：`missingEvidenceFor.length===0` → `strong` | 拆成 **检索覆盖** 与 **证据质量**；引用存在 ≠ 引用支持主张 |
| 演示知识 | `server/knowledge/approved-sources/synthetic-demo-kb.json` | 保留工程测试，强制 `synthetic` 标注，不冒充药典 |
| live 延迟包两次调用 | `scripts/ai/evaluate-live.js` `latencyMs` 包两次 `analyzeCase` | 拆分首次/重复调用耗时；最终风险级别与模型原始输出分列 |
| 64 例 mock 报告 | `benchmarks/ai-review/` | 保留工程回归；**不得**作为真实 LLM 成绩 |
| results-live 无提交结果 | `benchmarks/ai-review/results-live/*.json` gitignore | 真实调用才写；无密钥阻塞并如实报告 |

## 5. 按模块：保留 / 合并 / 移除

### 5.1 从主应用移出（归档后删除路由、权限、导航、脚本、CI）

依赖已查：仿真栈只被 `server.js`、`rbac` 研究员前缀、`src/pages/simulation/*`、`simulationApi.js`、论文脚本、CI 使用；**不**被调剂/库存/审核核心调用。运营 Agent 只被 `server/routes/ai.js` 与 `/ai/operations` 使用。工作台 `shortage`/`nearExpiry` 来自 `analyzeOperations()`，归档后改为库存仓储计数，不经仿真。

| 代码 | 归档位置 | 恢复 |
|---|---|---|
| `src/pages/simulation/`、`src/services/simulationApi.js` | `archive/simulation-research/` | 标签 `v1.0.0-research` 或本目录 |
| `server/routes/simulation.js`、`server/simulation/`、`server/__tests__/simulationRoutes.test.js` | 同上 | 同上 |
| `scripts/paper/`、`scripts/simulation-demo.js`、`scripts/simulation-export.js`、`scripts/verify-simulation-api.js`、`scripts/research-reproduce.js` | 同上 | 同上 |
| `server/ai/digitalTwinBridge.js`、`server/ai/operationsAgent.js`、`src/pages/ai/OperationsAgent.js` | `archive/operations-agent/` | Git 历史 + 本目录 |
| `src/pages/OperationsDashboard.js`、`ResearchHub.js`、`PrescriptionAnalytics.js`、`PharmacistTraining.js`、`PrescriptionReview.js`（未挂路由） | `archive/legacy-demos/` | Git 历史 + 本目录 |
| `src/pages/Organization.js`、`src/pages/organization/*` | 同上 | 同上 |
| `src/pages/MembershipManagement.js`（纯前端 mock，无 API 数据） | 同上 | 无业务数据需迁移 |
| `server/routes/research.js`、旧 CDSS 评价脚本（`evaluate-ablation-legacy.js` 等） | `archive/legacy-cdss/` | 标签 `legacy-cdss-v1` |
| `src/config/researchNavigation.js`（无引用） | 删除 | 无 |

主应用 **不再挂载** `/api/simulation`、`/api/ai/operations*`、`/api/research`。测试断言这些端点 404。

### 5.2 合并

| 来源 | 目标 | 迁移 |
|---|---|---|
| `src/pages/Patients`（`PatientRecords.js`）+ `Customers.js` + 会员身份字段 | **患者主档** `/patients` | 保留 `legacyPatientId`/`legacyCustomerId` 与订单外键；去掉积分、消费等级、营销 UI 与活跃逻辑。`server/routes/customers.js` 降为只读 ID 映射，禁止营销写 |
| `HerbalKnowledgeBase.js`（本地 mock）+ `KnowledgeSources.js` | **知识中心** `/ai/knowledge` | 药材目录走 `server/routes/herbs.js` / `herbCatalog`；证据走 `sourceRegistry`。目录行 **不**自动成为临床证据 |
| `QualityManagement.js`、`Compliance.js`（静态 mock） | 追溯页质量区 + 管理设置 | 无后端动作，不保留独立路由 |
| 工作台 | `/workbench` 全员首页（按角色过滤磁贴） | 待补资料、待审核、待调剂、待复核、待随访、AI 真实运行状态。去掉运营配货入口 |

### 5.3 保留为药房业务（可精简，不脱离调剂）

`Inventory.js`、`Orders.js`（收费/扣库入口）、`Billing.js`、`TraceabilitySystem.js`、`PatientPickup.js`、`Distribution.js`（配送状态）、`DispensingBoard.js`、`PrescriptionTemplates.js`、`DoctorWorkbench.js`、审核/患者页。

POS 不再扩展营销。扣库必须进 SQLite 事务 + 幂等键；药师批准 ≠ 已发药。

## 6. 界面与权限

员工导航：工作台、患者与处方、药师审核、调剂与交付、患者随访、知识中心；管理设置与研究评估按角色。  
患者导航：我的资料、我的处方、待补充问题、经审核的用药说明、反馈与随访。  
研究员首页：`/research/evaluation`（不再是 `/simulation/overview`）。

| 角色 | 服务器权限要点 |
|---|---|
| prescriber | 改方/提交；不能审自己的方 |
| pharmacist | 审核/批准/说明发布/随访；`requirePharmacistCredential` |
| technician | 授权调剂与交付；不能改临床内容、不能批准 |
| patient | 仅自身资料与反馈；令牌绑定对象 |
| admin | 系统配置；**不能**凭 admin 取得药师或处方权（现状：`rx:review_decision` 含 admin，状态机 `PHARMACIST_ONLY_TARGETS` 允许 admin — **改为拒绝**） |
| researcher | 仅合成/授权研究数据；禁止令牌与患者明细 |

多资格由 JWT/`credentials` 服务端验证，前端切角色无效。二次审核：两名药师各自登录提交；`secondReviewerId` 代填不构成双签（`learningLoop.reviewLabel` 现状仅校验账号存在 — **改为拒绝代填**）。

`ROLE_API_PREFIXES.researcher` 去掉 `/api/simulation`、`/api/research`、operations，改为 `/api/research/evaluation` 与治理只读。

## 7. 新增领域对象

均挂在现有 case / PATIENT 上，不另起无关联 patient 对象。

- **ClinicalFact / MedicationItem / AllergyItem**：status 白名单、变更历史、专业核实  
- **ClarificationTask**：taskId、caseId、caseContentVersion、fieldPath 白名单、question、reason、requiredForDecision、source、status、response、assignedTo  
- **PatientEducationDocument**：draft/review_required/approved/published/superseded；绑定病例版本与文本版本  
- **FollowUpTask**：owner、dueAt、联系记录、关闭人；AI 不可关闭  
- **Observation（预留）**：MedWear 结构位；无真实接口则禁用，不造同步按钮  

## 8. 测试对照（本轮必须覆盖的场景）

新增 `server/__tests__/digitalPharmacy.test.js`（及权限/事务集成），对应说明第 15 节 12 条。默认 CI：lint、server 核心测试、`ai:evaluate`（mock）、frontend build。删除 `simulation:demo`、`paper:quick`、`research:reproduce`。真实模型实验：`npm run ai:evaluate:live` 显式独立步骤。

医师旧分析：`DoctorWorkbench` 已走 `aiDraftsApi`/`aiCasesApi`；孤儿页 `PrescriptionReview.js` 归档。`/api/analytics` 无 UI 调用方，随旧 CDSS 归档或 410。

## 9. 不在本轮伪造的内容

剂量阈值、禁忌列表、急症阈值、药师审核签名、真实患者数据、真实 LLM 成绩、SMS 已发送、FHIR 已兼容、临床验证通过。专业知识与标注阻塞写入 `remaining-blockers.md`。
