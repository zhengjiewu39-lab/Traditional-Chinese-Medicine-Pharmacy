# Browser role acceptance (2026-10-03)

Local app: frontend `http://localhost:3000`, API `http://localhost:3002`.  
Demo data only. This is not a clinic go-live.

| Role | Account | Home | Main action | Forbidden path | Result |
|---|---|---|---|---|---|
| 医师 | prescriber | `/doctor` | Selected 张三 · P1, submitted 黄芪15g，当归10g，白芍10g，川芎6g，甘草6g → `case_musuf8vd_295868e161d2` (`68e161d2`) `pharmacist_review_required` | `/ai/governance` → 无权访问 | pass |
| 药师 | pharmacist | `/ai/review-queue` (双审 5) | Opened `case_musuf8vd_295868e161d2`; 一审/驳回可见，未签字 | `/research/desk` → 无权访问 | pass |
| 药师二 | pharmacist2 | `/ai/review-queue` (双审 5) | Same case visible; 一审签字 visible | `/billing` → 无权访问 | pass |
| 调剂员 | technician | `/dispensing` (0 待调剂) | Opened `/inventory` (62 药品种类) | `/ai/review-queue` → 无权访问 | pass |
| 患者 P1 | patient / P1 | `/patient/me` | Saw `68e161d2` and older P1 cases; opened `/patient/clarifications` | `/ai/review-queue` → 无权访问 | pass |
| 管理员 | admin | `/ai/governance` | DeepSeek overlay: `api.deepseek.com` / `deepseek-chat`, key saved, **AI_MODE=shadow**, kill switch on | `/doctor` → 无权访问 | pass |
| 研究员 | researcher | `/research/desk` | Opened `/research/evaluation` (“No live-model file committed”) | `/ai/review-queue` → 无权访问 | pass |

## Notes seen in the walkthrough

- Doctor list and review title use the last 8 characters of `caseId`. Navigating to `/ai/reviews/68e161d2` returned “Case not found”; the full id works.
- Queue tables are clickable rows, not buttons, so they do not appear as interactive controls in the accessibility snapshot.
- Doctor / pharmacist screens showed `规则引擎摘要（undefined）`.
- Patient P1 confirmation cards for older cases showed ages 68 and 40; those are the ages stored on those cases, not a re-check of the directory row (男 45岁).
- Screening of the new case recorded `deepseek-chat` and abstain / clarification_required. Governance still labels the provider **shadow** (results stored; product copy says they do not drive the clinical UI). No A3 approve/override was attempted.

No role was used to promote the overlay from shadow to live. No independent expert labels were written.
