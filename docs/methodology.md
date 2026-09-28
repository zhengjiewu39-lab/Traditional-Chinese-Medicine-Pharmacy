# Methodology — synthetic pharmacy supply simulation (engine v4)

## Purpose

The platform simulates **community pharmacy networks** under compound public-health-style disturbances. It compares replenishment and allocation rules on equitable access to essential medicines, supply resilience and cost.

It does **not** model patients, clinical outcomes or real transactions. Every input and output is synthetic. All parameter values are synthetic scenario assumptions (合成场景假设), and conclusions hold only within the predefined simulation scenarios (在预定义仿真场景中). They cannot be used to infer real policy effects.

| Topic | Document |
|---|---|
| Dynamics, formulas, policies, ERRRA | [model-specification.md](model-specification.md) |
| Metric definitions | [metrics.md](metrics.md) |
| Frozen design, seeds, statistics | [experiment-protocol.md](experiment-protocol.md) |
| Tests and validation status | [verification-validation.md](verification-validation.md) |
| How to read the results | [result-interpretation.md](result-interpretation.md) |
| Field-level definitions | [data-dictionary.md](data-dictionary.md) |
| Parameter values | `paper/tables/parameters.md`, `paper/tables/scenarios.md` (generated) |

## Simulation summary

- **Time step:** one day. The horizon is 120 days: warm-up days 1–30, shock days 31–60, recovery days 61–120.
- **Network:** suppliers (a primary and a backup per warehouse) → regional warehouses → community pharmacies in urban, suburban and rural regions. Neighbouring pharmacies in the same region can make lateral emergency transfers.
- **Inventory position:** every replenishment rule uses \(IP = \text{onHand} + \text{onOrder} - \text{backlog}\).
- **Demand:** Gaussian noise around a population-scaled mean, multiplied by active surges. It is drawn before any policy acts (common random numbers).
- **Backorders:** unmet demand is backordered and served FIFO. Waiting time per unit is recorded; units still waiting at the horizon are censored.
- **Warehouses:** a base-stock upstream rule toward a target of 10 days of served demand, limited by `capacityInStandardUnits` (standard units summed over SKUs; not a volume model).
- **Suppliers:** capacity, lead time, daily reliability and unit cost per tier. `supplyDisruption` events act on suppliers only. The backup tier is used only when redundancy is on.
- **Capacity toward pharmacies:** a daily dispatch cap and a truck cap per warehouse. Rank policies keep their priority order; the two rationing baselines are rationed proportionally.
- **Costs (synthetic currency):** procurement, transport, fixed order, pharmacy and warehouse holding, upstream supply and lateral transfer. The stockout penalty is reported separately.
- **Audit:** every run ends with a mandatory stock-balance audit at pharmacy, warehouse and network level. A failure aborts the run.

## Disturbance events

| Type | Effect | Targets |
|---|---|---|
| `demandSurge` | multiplies regional demand; policies never see the multiplier | `targetRegions` |
| `supplyDisruption` | multiplies supplier capacity (0 = down) | `supplierTier` (primary / backup / all), `targetWarehouses` or `targetSuppliers` |
| `roadDisruption` | multiplies base transit time | `targetRegions` |
| `leadTimeExtension` | multiplies the SKU lead-time part of transit | `targetRegions` |

An event is active when `startDay ≤ t < startDay + durationDays`. `targetRegions` on a supplyDisruption is a validation error.

## Policies

| Name | Id | Type |
|---|---|---|
| fixed-allocation | `fixed-allocation` | periodic order-up-to on prior demand, staggered reviews, proportional rationing |
| tuned-sQ | `reorder-point` | (s, Q) with z and qScale per SKU × region type, calibrated on calibration seeds |
| cost-only | `cost-first` | newsvendor (s, S); a line is ordered only when its expected net benefit is positive |
| weighted-equity | `equity-aware` | (s, S) ranked by a weighted score with a multiplicative regional need term |
| ERRRA | `equity-constrained-rolling-horizon` | two-stage allocation heuristic: max–min essential service floor, then cost-aware additions under a regional gap bound |

All five share one selection gate and one ranking and tie-break rule. None is AI or machine learning, and none is an optimizer or claimed to be optimal.

## Fair comparison

- All policies in a comparison share one frozen scenario JSON, the same network mechanisms (backup suppliers, lateral transfers) and identical seeds.
- Paper results come only from the frozen matrix and the 100 test seeds. tuned-sQ is calibrated on 20 disjoint calibration seeds; ERRRA defaults were fixed a priori.
- Paired differences use a percentile bootstrap with a fixed seed.

## Reproducibility

- Randomness comes from seeded streams (`rng.js`); simulation code never calls `Math.random()`.
- Scenario hashes use canonical JSON with sorted keys and explicit rejection of non-JSON values.
- `npm run paper:all` regenerates every table and figure. `npm run research:reproduce` re-runs a stored experiment group and compares every metric exactly.

## Non-applicability

- Not for clinical decisions, dispensing or real logistics.
- Not validated against real pharmacy, supplier or epidemic data.
- Legacy demo modules (prescription CDSS, CRM, …) are out of scope (tag `legacy-cdss-v1`).
