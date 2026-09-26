# Methodology — synthetic pharmacy supply simulation (engine v3)

## Purpose

The platform simulates **community pharmacy networks** under **compound public-health-style disturbances** to compare essential-medicine replenishment and allocation policies on equitable access and supply resilience. It does **not** model individual patients, clinical outcomes or real pharmacy transactions. All inputs and outputs are **synthetic**, and conclusions hold only 在预定义仿真场景中.

Detailed definitions:

- Dynamics, line economics, policies and ERRRA pseudo-code: [algorithm.md](algorithm.md)
- Metric formulas, units, directions and ranges: [metrics.md](metrics.md)
- Validation design and results: [model-validation.md](model-validation.md), [validation-report.md](validation-report.md)
- Parameter and scenario tables, generated from the frozen matrix: `paper/tables/parameters.md` and `paper/tables/scenarios.md`

## Simulation summary

- **Time step:** one day; the paper horizon is 120 days (30 warm-up, 30 disruption, 60 recovery).
- **Topology:** warehouses supply community pharmacies in urban, suburban and rural regions. Warehouses receive an exogenous upstream inbound scaled by the supply factor.
- **Inventory position:** every replenishment decision uses \(IP = \text{onHand} + \text{onOrder} - \text{backlog}\).
- **Backorders:** unmet demand is backordered and served FIFO when stock arrives. *Synthetic access delay* is measured in backlog unit-days, not clinical waiting time.
- **Capacity:** per-warehouse dispatch cap × supply factor, and a per-warehouse truck cap.
  - Scored policies are served in `policyRank` order through both caps.
  - Unscored baselines are rationed proportionally.
  - Only units the warehouse can actually issue consume capacity.
- **Costs (synthetic currency):** procurement, distance- and road-adjusted transport, a fixed order cost per shipped line, and holding at pharmacies and warehouses. The stockout penalty is reported separately and is not part of `totalCost`.

## Disturbance events

| Type | Effect |
|------|--------|
| `demandSurge` | Multiplies regional demand. Policies never see the multiplier; ERRRA detects a surge only from demand history. |
| `supplyDisruption` | Multiplies each warehouse's daily dispatch cap and upstream inbound |
| `roadDisruption` | Multiplies transit time in the target regions |
| `leadTimeExtension` | Multiplies the lead-time part of transit |

Events are active when `startDay <= day < startDay + durationDays`.

## Policies

| Policy | Type |
|---|---|
| `fixed-allocation` | periodic order-up-to on prior demand, staggered reviews |
| `reorder-point` | (s, Q), tuned per scenario on calibration seeds |
| `cost-first` | newsvendor (s, S); a line is ordered only if its net benefit is positive |
| `equity-aware` | weighted heuristic using the regional deficit signal |
| `equity-constrained-rolling-horizon` | **ERRRA heuristic**: two-stage max–min essential service floor, then cost-aware additions under a regional gap bound |

None of these is AI, and none is claimed to be globally optimal.

## Fair comparison

- All policies in a comparison share one frozen scenario JSON and identical seeds (common random numbers). Demand is drawn before any policy acts.
- Paper results come only from the frozen matrix (`paper/config/scenario-matrix.json`) and the 100 test seeds. Reorder-point tuning uses 20 separate calibration seeds.
- ERRRA parameters are fixed a priori.

## Reproducibility

- Randomness comes from `seededRandom.js` (Mulberry32); simulation code never calls `Math.random()`.
- `npm run paper:all` regenerates every table and figure. `paper/results/manifest.json` records the engine version, the matrix and seed hashes, the git commit and the stage timings.

## Non-applicability

- Not for clinical decision support, dispensing or real logistics contracts.
- Not validated against real epidemic or pharmacy data.
- Legacy demo modules (prescription CDSS, CRM, etc.) are out of scope (tag `legacy-cdss-v1`).
