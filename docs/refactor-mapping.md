# 研究平台改造映射与分阶段计划

## 新定位

**面向公共卫生应急场景的社区药房网络药品可及性与供应韧性仿真优化平台**  
（Simulation only · Synthetic data · 非临床、非真实运营）

## 现有结构 → 新架构映射

| 现有路径 | 处置 | 新用途 / 说明 |
|---------|------|----------------|
| `src/pages/Dashboard.js`, `OperationsDashboard.js` | Legacy Demo | `/legacy/dashboard` |
| `src/pages/PrescriptionReview.js`, `DoctorWorkbench.js`, `PatientPickup.js`, `PatientRecords.js` | Legacy Demo | 临床/患者相关，默认隐藏 |
| `src/pages/Customers.js`, `MembershipManagement.js`, `Billing.js` | Legacy Demo | CRM/会员/收银 |
| `src/pages/Organization*.js`, `organization/*` | Legacy Demo | 人事组织 |
| `src/pages/Orders.js`, `OrderManagement.tsx` | Legacy Demo | 原订单配送演示 |
| `src/pages/Distribution.js` | Legacy Demo | 原分销 KPI 演示（非仿真引擎） |
| `src/pages/ResearchHub.js` | Legacy Demo | 原处方 CDSS 科研，与供应链仿真分离 |
| `src/pages/Inventory.js` | Legacy Demo | 原库存 CRUD |
| `server/services/prescriptionAnalyzer.js`, `cdssEngine.js`, `routes/research.js` | 保留不动 | Legacy API |
| `server/data/store.js`, `seed.js` | 保留 | Legacy 业务数据；仿真实验独立目录 |
| **新增** `server/simulation/*` | 研究核心 | 场景、策略、仿真、指标、实验库 |
| **新增** `server/routes/simulation.js` | 研究 API | `/api/simulation/*` |
| **新增** `src/pages/simulation/*` | 研究 UI | Overview ~ Reproducibility |
| **新增** `src/config/researchNavigation.js` | 主导航 | 6 个研究页面 + Legacy 入口 |

## 分阶段计划（实施状态）

1. **映射与计划** — `docs/refactor-mapping.md`（本文档）
2. **领域模型与 RNG** — `scenarioSchema.js`, `rng.js`, `scenarioGenerator.js`, `defaultScenarios.js`
3. **仿真引擎与基线策略** — `inventoryEngine.js`, `distributionEngine.js`, `policyEngine.js`, `simulationEngine.js`
4. **公平策略与指标** — `metricsEngine.js`, `equity-aware` 策略
5. **前端** — 6 页 + 导航 + 免责声明页脚
6. **实验持久化与导出** — `experimentRepository.js`, `exportService.js`, API
7. **测试与文档** — `server/simulation/__tests__`, `README.md`, `docs/methodology.md`

## 算法与命名（禁止泛称 AI）

| 策略 ID | 名称 | 说明 |
|---------|------|------|
| `fixed-allocation-v1` | Fixed allocation baseline | 按人口比例固定补货配额 |
| `reorder-point-v1` | Reorder point (s, Q) | 再订货点 + 固定批量 Q |
| `cost-first-v1` | Cost-first heuristic | 最小化订货与运输成本启发式 |
| `equity-aware-v1` | Equity-aware multi-objective | 成本 + 缺货 + 等待 + 不平等惩罚 |

原 Orders 页面中的“配送优化”为前端 mock，**未**接入本仿真；若未来接入应单独注册为 `legacy-route-heuristic-v0`。
