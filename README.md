# 智能中药药房平台

这是一个**药师监管、患者参与、AI编排**的智能中药药房研究原型。

> **AI不独立诊断、开方或批准处方。**  
> 系统使用**合成演示数据**，**尚未通过真实临床验证**。  
> 不得用于真实发药、患者照护或现实世界资源配置。

**English working title.** *Design and Technical Validation of a Pharmacist-Governed Agentic AI Platform for Traditional Chinese Medicine Pharmacy: A Synthetic Case and Digital-Twin Study.*

## 产品边界

| 角色 | 可以做 | 不可以做 |
|---|---|---|
| AI | 信息理解、风险筛查、证据检索、解释生成、运营预测、工作流编排 | 独立诊断、开方、改方、批准高风险处方、写入库存 |
| 药师 | 处方安全与调剂放行的最终专业审核 | — |
| 患者 | 信息确认、知情选择、服务偏好、拒绝服务、用药反馈 | 覆盖专业安全阻断、修改药味剂量、解除 A3 硬阻断 |
| 调剂员 | 执行已批准的调剂与煎药任务 | 批准处方 |
| 管理员 | 系统配置、AI 总开关 | 冒充药师批准处方 |
| 研究员 | 去标识化/合成/聚合研究数据 | 访问患者确认令牌或批准处方 |

默认首页是**智能中药药房工作台**（`/workbench`）。供应韧性仿真（含 ERRRA）降级为后台 **药房数字孪生**（`/simulation/*`），算法与论文流水线完整保留。

## 快速启动

需要 **Node 20**（见 `.nvmrc`）。

```bash
cd chinese-medicine-pharmacy
npm ci
npm run dev          # API :3002 + 前端 :3000
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。开发演示账号（仅 `ALLOW_DEMO_AUTH` / 非生产）：

| 用户 | 密码 | 角色 |
|---|---|---|
| admin | admin123 | 管理员 |
| pharmacist | pharm123 | 药师 |
| pharmacist2 | pharm456 | 药师（二次复核） |
| technician | tech123 | 调剂员 |
| researcher | research123 | 研究员 |
| patient | patient123 | 患者（合成） |

## 一级导航

1. 智能工作台 `/workbench`
2. 患者与处方接收 `/intake`
3. AI处方安全中心 `/ai/cases`
4. 药师审核队列 `/ai/review-queue`
5. 调剂与复核 `/dispensing`
6. 煎药与配送 `/distribution`
7. 库存与采购 `/inventory`
8. 质量追溯 `/traceability`
9. 患者用药服务 `/patient-service`（公开确认页 `/patient/confirmation/:token`）
10. AI治理中心 `/ai/governance`
11. 药房数字孪生 `/simulation/overview`
12. Legacy演示功能 `/legacy/dashboard`

## 验收命令

```bash
npm ci
npm run lint
npm run simulation:test
npm run ai:evaluate
CI=true npm run build
npm audit --omit=dev
npm run paper:quick
```

工程评估标注：**Engineering evaluation on synthetic standardized cases. Not a clinical validation.**

## 文档

- 平台架构：[docs/ai-pharmacy-architecture.md](docs/ai-pharmacy-architecture.md)
- 安全边界：[docs/ai-safety-boundaries.md](docs/ai-safety-boundaries.md)
- 药师治理：[docs/pharmacist-governance.md](docs/pharmacist-governance.md)
- 患者参与：[docs/patient-participation.md](docs/patient-participation.md)
- AI 评估协议：[docs/ai-evaluation-protocol.md](docs/ai-evaluation-protocol.md)
- 知识治理：[docs/knowledge-governance.md](docs/knowledge-governance.md)
- 数字孪生桥接：[docs/digital-twin-integration.md](docs/digital-twin-integration.md)
- 临床验证限制：[docs/clinical-validation-limitations.md](docs/clinical-validation-limitations.md)
- 本轮验收：[AI_PHARMACY_VALIDATION_REPORT.md](AI_PHARMACY_VALIDATION_REPORT.md)
- 文档总索引：[docs/README.md](docs/README.md)

供应韧性仿真（引擎 v4、矩阵 v2.0.0、ERRRA v2.0.0）仍冻结于标签 `v1.0.0-research`。详见 [FINAL_VALIDATION_REPORT.md](FINAL_VALIDATION_REPORT.md) 与 [药房数字孪生文档](docs/model-specification.md)。论文结果不因本次 UI/工作流重构而改变。

## 生产部署

设置强随机 `TCM_JWT_SECRET` 与 `TCM_USERS_JSON`（bcrypt `passwordHash`）。`ALLOW_DEMO_AUTH` 默认 false。**禁止**在生产环境使用 `AI_PROVIDER=mock`。未配置真实模型时，系统以硬规则引擎运行。
