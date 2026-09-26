# Frozen scenario matrix v1.1.0

Horizon 120 days: warm-up [0,30), disruption [30,60), recovery [60,120). 14 scenarios; 100 common-random-number test seeds each. All values synthetic.

| Key | Label | Events | Capacity × | Inbound coverage | WH stock (days) | Pharmacy stock (days) |
| --- | --- | --- | --- | --- | --- | --- |
| S01-baseline | No disturbance | none | 1 | 1.2 | 20 | 10 |
| S02-surge-low | Demand surge ×1.3 | demandSurge ×1.3 (all regions, day 30–59) | 1 | 1.2 | 20 | 10 |
| S03-surge-mid | Demand surge ×1.6 | demandSurge ×1.6 (all regions, day 30–59) | 1 | 1.2 | 20 | 10 |
| S04-surge-high | Demand surge ×2.0 | demandSurge ×2 (all regions, day 30–59) | 1 | 1.2 | 20 | 10 |
| S05-supply-low | Supply at 75% | supplyDisruption ×0.75 (all regions, day 30–59) | 1 | 1.2 | 20 | 10 |
| S06-supply-mid | Supply at 50% | supplyDisruption ×0.5 (all regions, day 30–59) | 1 | 1.2 | 20 | 10 |
| S07-supply-high | Supply at 25% | supplyDisruption ×0.25 (all regions, day 30–59) | 1 | 1.2 | 20 | 10 |
| S08-rural-road | Rural road disruption (transit ×2) | roadDisruption ×2 (rural, day 30–59) | 1 | 1.2 | 20 | 10 |
| S09-surge-supply | Surge ×1.6 + supply 50% | demandSurge ×1.6 (all regions, day 30–59); supplyDisruption ×0.5 (all regions, day 30–59) | 1 | 1.2 | 20 | 10 |
| S10-surge-supply-road | Surge ×1.6 + supply 50% + rural road ×2 | demandSurge ×1.6 (all regions, day 30–59); supplyDisruption ×0.5 (all regions, day 30–59); roadDisruption ×2 (rural, day 30–59) | 1 | 1.2 | 20 | 10 |
| S11-long-lead | S09 + structural lead times ×2.5 | demandSurge ×1.6 (all regions, day 30–59); supplyDisruption ×0.5 (all regions, day 30–59) | 1 | 1.2 | 20 | 10 |
| S12-limited-warehouse | S09 + warehouse stock 5 days, inbound 1.0× | demandSurge ×1.6 (all regions, day 30–59); supplyDisruption ×0.5 (all regions, day 30–59) | 1 | 1 | 5 | 10 |
| S13-limited-capacity | S09 + dispatch/truck capacity ×0.7 | demandSurge ×1.6 (all regions, day 30–59); supplyDisruption ×0.5 (all regions, day 30–59) | 0.7 | 1.2 | 20 | 10 |
| S14-extreme | Extreme: surge ×2.2 + supply 20% + rural road ×2.5 + lead ×2 + capacity ×0.8 | demandSurge ×2.2 (all regions, day 30–59); supplyDisruption ×0.2 (all regions, day 30–59); roadDisruption ×2.5 (rural, day 30–59); leadTimeExtension ×2 (rural+suburban, day 30–59) | 0.8 | 1.2 | 20 | 10 |

Matrix revisions: v1.0.0: initial matrix (upstreamInboundCoverage 1.05) v1.1.0: upstreamInboundCoverage 1.05 → 1.2 (all scenarios except S12, which keeps its own 1.0) — Mechanics check on non-reporting seeds 1–3 showed backlog accumulated during disruption could not be cleared within the 60-day recovery phase under any policy, so every recovery-time metric was right-censored. Applied before any calibration- or test-seed run; affects all policies identically.
