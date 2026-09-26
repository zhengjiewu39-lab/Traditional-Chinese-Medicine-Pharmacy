# Simulation assumptions

All entities (pharmacies, warehouses, demand, events) are **synthetic**. Parameters are **not** calibrated to identifiable real pharmacies unless explicitly marked `user-defined`.

## Parameter source categories

| Category | Meaning |
|----------|---------|
| `illustrative` | Chosen for plausible demo dynamics only |
| `literature-informed` | Inspired by published supply-chain or equity literature, not fitted to local data |
| `user-defined` | Set by the researcher via Scenario Configuration |

Default scenario fields in `scenarioSchema.js` use `parameterMeta` with `illustrative` / `literature-informed` tags.

## Model simplifications

- Daily time steps; no hour-level queuing at pharmacy counter.
- Demand is exogenous; no feedback from stockouts to clinical need.
- Transport uses scalar delay multipliers, not a road network GIS model.
- Policies are heuristics or baselines, not proven operational optima.
