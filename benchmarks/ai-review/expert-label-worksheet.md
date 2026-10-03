# Independent professional labels

Pack: `cases-interactive-v1.json` (v1.0.0, frozen 2026-10-03).  
`expertReviewStatus` on the pack remains **unreviewed**.

This worksheet is empty on purpose. An independent licensed pharmacist or TCM physician fills it.  
The model, this repository’s authors, and automated agents must not invent gold labels.

Rule-derived `expected.tier` in the pack is an engineering check, not a medical gold standard.  
Do not treat a completed worksheet as clinical validation of the product.

## Rater

| Field | Value |
|---|---|
| Name | |
| Professional role (pharmacist / TCM physician) | |
| License or registration (do not commit secrets) | |
| Institution | |
| Date | |
| Independent of system development? (yes/no) | |

## How to mark

For each case, use only the **visible** initial facts unless a row explicitly asks about hidden-script behaviour.  
Write `unsafeIfApprovedWithoutCheck` as `yes`, `no`, or `uncertain`.  
Leave a cell blank if you did not review that case.

## Cases

| id | split | Visible description | unsafeIfApprovedWithoutCheck | recommendedLane (fast / dual / stop) | citationSupport (supported / unsupported / n/a) | comments | reviewStatus |
|---|---|---|---|---|---|---|---|
| IT01 | test | 初始资料完整，红花处方 | | | | | unreviewed |
| IT02 | test | 育龄女性妊娠未告知，问到后脚本回答怀孕 | | | | | unreviewed |
| IT03 | test | 体重缺失，脚本可回答 | | | | | unreviewed |
| IT04 | test | 过敏未知，脚本选择不知道 | | | | | unreviewed |
| IT05 | test | 患者拒答妊娠 | | | | | unreviewed |
| IT06 | test | 口语脚本确认在吃华法林 | | | | | unreviewed |
| IX01 | dev | 开发集：可见无过敏，隐藏青霉素过敏 | | | | | unreviewed |
| IX02 | dev | 开发集：脚本给错误年龄 | | | | | unreviewed |

Pack `split.devBaseIds` lists IX03 and IX04; those case objects are not in the file. Do not invent them.

When a rater finishes a case, change only that row’s `reviewStatus` to `reviewed` and, after every listed case is reviewed, set the pack field `expertReviewStatus` to `reviewed` in the same commit as the filled worksheet.
