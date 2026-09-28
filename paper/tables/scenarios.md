# Frozen scenario matrix v2.0.0

Horizon 120 days: warm-up days 1–30, shock days 31–60, recovery days 61–120. 9 scenarios; 100 common-random-number test seeds each. All values are synthetic scenario assumptions (合成场景假设).

| Key | Label | Events | Capacity × | Dispatch / truck coverage | WH stock (days) | Supplier lead primary / backup | Scenario hash |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M1-normal | Normal baseline (no events) | none | 1 | 1.5 / 1.5 | 10 | 2 / 5 | 23e6c4963f22 |
| M2-demand-surge | Demand surge ×1.6 (all regions) | demandSurge ×1.6 (all regions, day 31–60) | 1 | 1.5 / 1.5 | 10 | 2 / 5 | d1e26a138f0d |
| M3-supply-disruption | Upstream disruption: primary suppliers down (backup available) | supply ×0 (primary suppliers, day 31–60) | 1 | 1.5 / 1.5 | 10 | 2 / 5 | 92a303dd934d |
| M4-transport-disruption | Road disruption: rural transit ×2.5, suburban ×1.5 | roadDisruption ×2.5 (rural, day 31–60); roadDisruption ×1.5 (suburban, day 31–60) | 1 | 1.5 / 1.5 | 10 | 2 / 5 | 93fdb943702c |
| M5-compound | Compound: surge ×1.6 + primary supply 50 % + rural transit ×2 | demandSurge ×1.6 (all regions, day 31–60); supply ×0.5 (primary suppliers, day 31–60); roadDisruption ×2 (rural, day 31–60) | 1 | 1.5 / 1.5 | 10 | 2 / 5 | 27b56d3394d2 |
| M6-long-lead | M5 + structural supplier and SKU lead times ×2.5 | demandSurge ×1.6 (all regions, day 31–60); supply ×0.5 (primary suppliers, day 31–60); roadDisruption ×2 (rural, day 31–60) | 1 | 1.5 / 1.5 | 10 | 5 / 12 | 4c5c9bde7751 |
| M7-tight-warehouse | M5 + warehouse stock and target 4 days | demandSurge ×1.6 (all regions, day 31–60); supply ×0.5 (primary suppliers, day 31–60); roadDisruption ×2 (rural, day 31–60) | 1 | 1.5 / 1.5 | 4 | 2 / 5 | db3076596463 |
| M8-tight-transport | M5 + dispatch and truck capacity 1.1 × baseline demand | demandSurge ×1.6 (all regions, day 31–60); supply ×0.5 (primary suppliers, day 31–60); roadDisruption ×2 (rural, day 31–60) | 1 | 1.1 / 1.1 | 10 | 2 / 5 | f27654c8aee5 |
| M9-extreme | Extreme: surge ×2.2 + all suppliers at 40 % + rural transit ×2.5 + lead ×2 + capacity ×0.8 | demandSurge ×2.2 (all regions, day 31–60); supply ×0.4 (all suppliers, day 31–60); roadDisruption ×2.5 (rural, day 31–60); leadTimeExtension ×2 (rural+suburban, day 31–60) | 0.8 | 1.5 / 1.5 | 10 | 2 / 5 | a1eaa3dbc93b |

Matrix revisions:

- v1.0.0: initial matrix, engine v3 (upstreamInboundCoverage 1.05)
- v1.1.0: upstreamInboundCoverage 1.05 → 1.2 — backlog could not clear within the recovery phase under any policy (engine v3).
- v2.0.0: engine v4: supplier network (primary + backup per warehouse), supplier-scoped supply disruptions, lateral transfers, warehouse capacity; nine scenarios M1–M9 built from SCENARIO_PRESETS; base warehouse stock 20 → 10 days; M3 = primary suppliers down; M7 warehouse stock 4 days — Supply disruptions in v1 throttled whole-warehouse dispatch; in v4 they act on suppliers and reach pharmacies through warehouse stock. With 20 days of warehouse stock a single-mechanism shock of 30 days was absorbed completely (no shortage under any policy, checked on non-reporting seeds 1–3), so the base buffer was set below the deficit of a primary-supplier outage (0.6 × 30 = 18 demand-days). Applied before any calibration- or test-seed run and identically to every policy.
