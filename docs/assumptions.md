# Simulation assumptions

All entities are **synthetic**: suppliers, warehouses, pharmacies, demand and events. Every parameter in the default scenario and the frozen matrix is labelled in `scenarioSchema.js` `parameterMeta` as a synthetic scenario assumption (合成场景假设). None is estimated from, or calibrated to, real pharmacies, suppliers, patients or epidemics. Parameters that a researcher changes in Scenario Configuration are user-defined and just as synthetic.

## Model simplifications

- Daily time steps; no hour-level queueing at the counter.
- Demand is exogenous: stockouts do not feed back into clinical need, and patients neither switch pharmacy nor abandon a backorder.
- Transport uses scalar transit multipliers per region, not a road-network model.
- Warehouse capacity is counted in standard units summed over SKUs, with no volume, weight or cold chain.
- Suppliers have fixed lead times, a daily capacity and Bernoulli daily reliability; there are no contracts or price dynamics.
- Policies are heuristics or baselines, not proven optima. See [limitations.md](limitations.md) and [model-specification.md](model-specification.md).
