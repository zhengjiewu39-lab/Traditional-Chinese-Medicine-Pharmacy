# 中药数字药学服务系统

这是一个**药师监督、患者参与**的 AI 中药用药支持与随访**研究原型**。

> **AI不独立诊断、开方或批准处方。**  
> 系统使用**合成演示数据**，**尚未通过真实临床验证**。  
> 不得用于真实发药或患者照护。

**工作题目。** *面向线上中药药学服务的证据支持型AI决策辅助：系统开发与合成病例评估。*

本轮研究问题：风险相关主动追问（相对通用澄清）是否降低独立评审判定的不安全最终建议比例。供应仿真与配货 Agent 已归档（标签 `v1.0.0-research`）。模拟运行不是临床验证。系统不能在自动学习后自行部署新模型。

研究员首页：`/research/evaluation`。默认 CI 只跑数字药学核心检查。真实模型比较是显式步骤，缺密钥时如实退出。

## 产品边界

| 角色 | 可以做 | 不可以做 |
|---|---|---|
| AI | 药学审核提示（规则，或显式配置的真实模型） | 独立诊断、开方、改方、批准、扣库、关闭随访；说明草稿与随访摘要目前是人工流程，不是已实现的模型任务 |
| 药师 | 审核、批准、说明发布、随访处置 | 代填第二审核人 ID 不算双签 |
| 患者 | 资料、澄清问答、已发布说明、反馈 | 覆盖专业安全阻断、修改剂量、解除硬阻断 |
| 调剂员 | 执行已批准的调剂与煎药 | 批准处方或改临床内容 |
| 管理员 | 系统配置、AI 总开关 | 凭管理员身份取得药师或处方权 |
| 研究员 | 合成或经授权处理的研究数据与评估 | 访问患者令牌或批准处方 |

默认首页是工作台（`/workbench`）。研究员首页是 `/research/evaluation`。供应仿真、运营配货 Agent 已移到 `archive/`，历史标签 `v1.0.0-research` 可恢复。

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

员工：工作台 `/workbench`、患者与处方 `/patients` `/intake` `/doctor`、药师审核 `/ai/review-queue`、调剂与交付 `/dispensing`、患者随访 `/ai/follow-up`、知识中心 `/ai/knowledge`。管理设置与研究评估按角色显示。

患者：我的资料 `/patient/profile`、我的处方 `/patient/me`、澄清 `/patient/clarification/:token`、确认 `/patient/confirmation/:token`、反馈 `/patient/feedback/:token`。

未配置真实模型时界面显示「AI未连接/仅规则」，不会把 mock 当作真实服务。捆绑知识 `synthetic-demo-kb.json` 是合成演示知识，不是药典。

```bash
npm run ai:evaluate          # 合成病例 + mock，工程回归
npm run ai:evaluate:compare  # 交互病例包主实验 A/B/C/D + RAG_off；缺密钥退出码 2，不写占位成绩
AI_COMPARE_ALLOW_MOCK=1 npm run ai:evaluate:compare   # mock 交互循环，写入 results-mock
AI_COMPARE_PACK=benchmarks/ai-review/cases-v1.json AI_COMPARE_ALLOW_MOCK=1 npm run ai:evaluate:compare  # 工程规则包
./scripts/backup-data.sh     # 迁移前备份 JSON/SQLite
```

主实验组：A 固定问卷+规则；B 固定问卷+规则+真实 LLM+检索；C 同 B + 通用澄清；D 同 B + 风险相关主动追问与停止。主要比较 D 与 C。关闭检索是独立消融组 `RAG_off`，不再把 B 写成无检索。

## 验收命令

```bash
npm ci
npm run lint
npm run test:server
npm run ai:evaluate
CI=true npm run build
npm audit --omit=dev
```

工程评估标注：**Engineering evaluation on synthetic standardized cases. Not a clinical validation.**

## 文档

- 平台架构：[docs/ai-pharmacy-architecture.md](docs/ai-pharmacy-architecture.md)
- 安全边界：[docs/ai-safety-boundaries.md](docs/ai-safety-boundaries.md)
- 药师治理：[docs/pharmacist-governance.md](docs/pharmacist-governance.md)
- 患者参与：[docs/patient-participation.md](docs/patient-participation.md)
- AI 评估协议：[docs/ai-evaluation-protocol.md](docs/ai-evaluation-protocol.md)
- 知识治理：[docs/knowledge-governance.md](docs/knowledge-governance.md)
- 临床验证限制：[docs/clinical-validation-limitations.md](docs/clinical-validation-limitations.md)
- 本轮验收：[validation-report.md](validation-report.md)、[remaining-blockers.md](remaining-blockers.md)
- 归档说明：[archive/README.md](archive/README.md)
- 文档总索引：[docs/README.md](docs/README.md)

旧供应仿真结果仍冻结于标签 `v1.0.0-research`，不挪作数字健康成绩。当前论文不声称降低真实不良反应、提高真实依从性或改善真实疗效。软件测试通过不是临床验证。

## 生产部署

设置强随机 `TCM_JWT_SECRET` 与 `TCM_USERS_JSON`（bcrypt `passwordHash`）。`ALLOW_DEMO_AUTH` 默认 false。**禁止**在生产环境使用 `AI_PROVIDER=mock`。未配置真实模型时，系统以硬规则引擎运行。
