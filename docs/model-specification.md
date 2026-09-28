# Model specification (engine `simulation-engine-v4.0.0`, scenario schema 3.0.0)

This is the reference description of the simulation model; every formula below is taken from the code named in brackets. All parameters are **synthetic scenario assumptions (合成场景假设)**. No value is estimated from real pharmacies, patients, suppliers or epidemics, and results cannot be read as effects of real policies.

Metric formulas are in [metrics.md](metrics.md). Parameter values are listed in `paper/tables/parameters.md`, which is generated from the frozen matrix.

## 1. Entities and indices

| Symbol | Entity | Code |
|---|---|---|
| \(s\) | supplier: one primary and (optionally) one backup per warehouse | `supplyNetwork.js` |
| \(w\) | regional warehouse; pharmacy \(i\) is served by \(w(i) = i \bmod W\) | `scenarioGenerator.js` |
| \(i\) | community pharmacy, in region type \(r(i) \in\) {urban, suburban, rural} | |
| \(k\) | SKU with priority essential / chronic-care / routine | |
| \(t\) | day, \(t = 0,\dots,T-1\); default \(T = 120\) | `scenarioSchema.js` |

Phases: warm-up days 1–30 (\(t<30\)), shock days 31–60 (\(30 \le t < 60\)), recovery days 61–120.

## 2. State

| Symbol | Meaning |
|---|---|
| \(I_{ik}\), \(B_{ik}\), \(O_{ik}\) | pharmacy on hand, backlog (backordered demand), on order (shipped by a warehouse or a lateral donor, not yet received) |
| \(IP_{ik} = I_{ik} + O_{ik} - B_{ik}\) | inventory position, the only stock quantity any replenishment rule uses |
| \(W_{wk}\), \(P_{wk}\) | warehouse on hand and upstream pipeline (shipped by suppliers, not yet received) |
| backlog queue | FIFO list of (day demanded, units) per pharmacy × SKU, used for waiting times |

Every quantity is an integer number of **standard units** (one unit of any SKU). Warehouse capacity `capacityInStandardUnits` is a limit on total standard units across SKUs, not a volume or pallet model.

## 3. Daily event order [`simulationEngine.js`]

1. **Upstream receipt.** Supplier shipments with arrival day \(\le t\) move from \(P_{wk}\) into \(W_{wk}\).
2. **Pharmacy arrivals.** Warehouse shipments and lateral transfers due on \(t\) move from \(O_{ik}\) into \(I_{ik}\). Backlog is then served FIFO; each served unit records its waiting time \(t - t_{\text{demand}}\).
3. **Demand.** Any remaining backlog is served first (FIFO) from \(I_{ik}\). New demand \(D_{ikt}\) (§4) is then filled from what is left, and the remainder is appended to the backlog queue. A *demand line* (pharmacy × SKU × day with \(D>0\)) is a *stockout incident* if any unit of it is unfilled on that day.
4. **Forecast update** (history only): \(\hat\mu \leftarrow \hat\mu + \alpha e\), \(\hat v \leftarrow (1-\alpha)(\hat v + \alpha e^2)\), \(e = D - \hat\mu\), \(\alpha = 0.3\), prior \(\hat\mu_0 = \bar d_{ik}\) [`forecastEngine.js`].
5. **Holding cost** on pharmacy and warehouse stock.
6. **Regional signals** over the last 7 days: essential fill \(EF_r\), backlog rate \(BR_r\), access delay [`equitySignals.js`].
7. **Lateral transfers** (§7), if enabled.
8. **Replenishment decision** by the policy (§8–§9) → candidate orders with `priorityScore` and `priorityReason`, then the selection gate and ranking.
9. **Warehouse stock and dispatch cap.** Accepted quantity is limited by \(W_{wk}\) and the warehouse's daily dispatch capacity. Rank policies are served in rank order; the proportional baselines are rationed by integer largest remainders. Rejections are logged as `warehouse_stock` or `dispatch_cap` [`dispatchEngine.js`].
10. **Truck cap** per warehouse, with the same ordering or rationing rule.
11. **Ship.** \(W \mathrel{-}= q\), \(O \mathrel{+}= q\); arrival after \(L_{ik} = \max(1, \lceil\tau^{tr}_{ik}\rceil)\) days (§6).
12. **Upstream orders** by every warehouse (§5).
13. Optional daily conservation check (`checkConservation`).

After the last day, `finalizeHorizonBacklog` records units still backordered with their censored waits \(T - t_{\text{demand}}\). The mandatory `inventoryAudit` (§11) runs next; a failure throws `ConservationError` and the run produces no result.

## 4. Demand [`scenarioGenerator.js`]

\[
\bar d_{ik} = \frac{\text{pop}_i}{1000}\,\text{baseDemand}_{r(i)}\,\text{scale}(\text{priority}_k),\qquad
\text{scale} = \{\text{essential}: 1.2,\ \text{chronic-care}: 1.0,\ \text{routine}: 0.75\}
\]
\[
D_{ikt} = \max\!\big(0,\ \mathrm{round}\big(\bar d_{ik}\,(1+\varepsilon_{ikt})\,m_{r(i)}(t)\big)\big),\qquad \varepsilon_{ikt} \sim N(0, \mathrm{CV}_r^2)
\]

\(m_r(t)\) is the product of the magnitudes of active `demandSurge` events targeting \(r\). Pharmacy population is \(\text{pop}_r / n_r \times U(0.95, 1.05)\). All demand draws, supplier reliability draws and populations are generated **before** any policy acts, in a fixed order, from seeded streams. Different policies therefore face identical demand and supply outcomes for the same seed (common random numbers). Policies never see \(m_r(t)\).

## 5. Upstream supply network [`supplyNetwork.js`]

Each warehouse has a primary supplier and, when the backup tier has positive coverage, a backup supplier.

| Parameter | Primary (default) | Backup (default) |
|---|---|---|
| replenishment lead time \(\ell_s\) (days) | 2 | 5 |
| daily capacity \(C_s\) = coverage × \(\sum_{i\in w,k}\bar d_{ik}\) | 1.2 | 0.4 |
| reliability \(\rho_s\) (probability of shipping on a day) | 0.98 | 0.90 |
| unit cost \(c^{up}_s\) | 0.5 | 1.2 |

**Disruption.** Let \(f_s(t)\) be the product of the magnitudes of active `supplyDisruption` events that target \(s\). An event targets explicit `targetSuppliers`, or otherwise every supplier of `supplierTier` (primary by default; `backup` or `all` are also allowed), optionally restricted to `targetWarehouses`. The state is *normal* (\(f=1\)), *degraded* (\(0<f<1\)) or *down* (\(f=0\)). Supply disruptions act only on suppliers and never reduce warehouse dispatch capacity towards pharmacies.

**Available capacity:** \(A_s(t) = \lfloor C_s f_s(t)\rfloor \cdot b_s(t)\), with \(b_s(t) \sim \text{Bernoulli}(\rho_s)\) pre-drawn per seed.

**Warehouse base-stock rule** (identical for every policy):
\[
\text{target}_{wk} = \text{targetStockDays}\cdot\sum_{i\in w}\bar d_{ik},\qquad
\text{req}_{wk} = \max\!\big(0,\ \lceil\text{target}_{wk} - W_{wk} - P_{wk}\rceil\big)
\]
Requests are scaled down (integer largest remainders) so that \(\sum_k (W_{wk} + P_{wk} + \text{req}_{wk}) \le \text{capacityInStandardUnits}_w\). The primary supplier ships up to \(A_s(t)\), split across SKUs in proportion to the requests. With `redundancyEnabled`, the unplaced remainder goes to backup suppliers in ascending unit cost order. Shipments arrive after \(\max(1, \ell_s)\) days and cost \(c^{up}_s\) per unit (`costs.upstreamSupply`).

Defaults: \(\text{capacityInStandardUnits}_w = \max(\text{initial total}, \text{target total}, 45 \times \text{served daily demand})\); initial and target warehouse stock are both 10 days of served demand.

## 6. Warehouse → pharmacy logistics [`distributionEngine.js`, `scenarioGenerator.js`]

- Dispatch capacity per day = `dispatchCapacityCoverage` (default 1.5) × served daily demand × `capacityMultiplier`.
- Truck capacity per day = `truckCapacityCoverage` (default 1.5) × served daily demand × `capacityMultiplier`.
- Transit time:
  \[
  \tau^{tr}_{ik} = \max\!\Big(1,\ \big(\text{transit}_r\,g^{road}_r(t) + 0.25\,\text{lead}_k\,g^{lead}_r(t)\big)\,\Big(1+\frac{\text{dist}_r}{100}\Big)\Big/\max(0.1, \text{road}_r)\Big)
  \]
  where \(g^{road}\) and \(g^{lead}\) are the products of active `roadDisruption` and `leadTimeExtension` magnitudes. The arrival lag is \(L = \max(1,\lceil\tau^{tr}\rceil)\).
- Transport cost per unit: \(c^{tr}_r = \text{transportCostPerUnit}\cdot(\text{dist}_r/50)/\max(0.1,\text{road}_r)\).
- Fixed order cost \(K\) per shipped line.

## 7. Lateral emergency transfers [`lateralTransfers.js`]

These run between pharmacies of the same region type, for essential SKUs only, once per day before replenishment. For a line with warehouse lag \(L_i\) and \(\tau_i = L_i + 1\), let \(\mu_i = \hat\mu_i\tau_i\) and \(\sigma_i = \hat\sigma_i\sqrt{\tau_i}\), and \(ES_i(x) = E[(D - x)^+]\) with \(D \sim N(\mu_i, \sigma_i^2)\).

- **Recipient:** \(IP_i < \mu_i\), and it has not donated this SKU within `cooldownDays` (7).
- **Donor:** no backlog, not a recipient today, has not received this SKU within `cooldownDays`, and surplus \(\lfloor I_j - (\mu_j + z_d\sigma_j)\rfloor > 0\) with \(z_d = 1.65\). The donor with the largest surplus is chosen.
- **Quantity:** \(q = \min(\lceil\mu_i - IP_i\rceil, \text{surplus}_j, \text{capacity left})\), then \(\lceil q/2\rceil\) if \(q\) fails.
- **Execute only if** \(\Delta U = [ES_i(IP_i) - ES_i(IP_i+q)] - [ES_j(IP_j - q) - ES_j(IP_j)] > 0\) (system expected unmet falls), \(p_k\,\Delta U - (c^{lat} q + K^{lat}) > 0\), and the transfer lag \(\max(1,\lceil 1\cdot g^{road}_r\rceil) < L_i\) (it must be faster than the warehouse).
- **Daily capacity per region:** \(\lfloor 0.25 \times \sum\) prior essential daily demand in the region\(\rfloor\).
- **Costs:** \(c^{lat} = 0.4\) per unit and \(K^{lat} = 10\) per transfer (`costs.lateralTransfer`).

Transferred units leave the donor's \(I\) and enter the recipient's \(O\), so both inventory positions are correct on the next decision.

Transfers are a network mechanism available to all policies; `useLateralTransfers: false` turns them off for one run (ERRRA ablation).

## 8. Policy interface and selection gate [`policyEngine.js`]

Every policy builds one planning line per pharmacy × SKU from the current state and history-only forecasts:

| Quantity | Definition |
|---|---|
| \(\tau\) | \(L + 1 + b\); \(b\) = disruption buffer (ERRRA only, 2 days when a disruption is observed) |
| \(\mu_\tau, \sigma_\tau\) | \(\hat\mu\tau\), \(\hat\sigma\sqrt\tau\) |
| \(Q\) | \(\max(1, \mathrm{round}(\min(\sqrt{2\hat\mu K/h},\ 30\hat\mu)))\) |
| cycle | \(\tau_c = \tau + Q/\hat\mu\), with demand \(N(\hat\mu\tau_c, \hat\sigma^2\tau_c)\) |
| \(\Delta ES(q)\) | \(ES(IP) - ES(IP+q)\) over the cycle |
| benefit | \((p_k + w\,\tau/2)\,\Delta ES\); \(p_k\) = stockout penalty, \(w\) = synthetic delay penalty per day |
| cost | \((c_k + c^{tr}_r)q + K + h_k q^2/(2\hat\mu)\) |
| net | benefit − cost |
| \(z^\*\) | \(\Phi^{-1}\big((p - c - c^{tr})/(p + h\tau)\big)\), clipped to \([-1, 3]\) |

**Selection gate** (identical for all policies; the first failing reason is logged):

1. policy-specific `notSelectedReason`
2. `zero_request` if \(q \le 0\)
3. `no_expected_benefit` if expectedBenefit \(\le 0\)
4. `score_below_threshold` if priorityScore \(\le\) `minPriorityScore` (default 0)
5. `no_serving_warehouse`
6. `warehouse_out_of_stock` if \(W_{wk} \le 0\)
7. `no_transport_capacity` if dispatch or truck capacity is 0

**Ranking.** Selected orders are sorted by priorityScore descending. Exactly equal scores fall back to a deterministic `tieBreak`: region type (urban, suburban, rural), then natural pharmacy id, then natural SKU id. Dispatch and truck caps keep this order. For `fixed-allocation` and `reorder-point`, whose mechanism is proportional rationing, the shared capacity is split proportionally instead.

## 9. Policies

| Name (id) | Order rule | expectedBenefit | priorityScore | Shortage handling |
|---|---|---|---|---|
| fixed-allocation (`fixed-allocation`) | Review when \(t \bmod 3 = i \bmod 3\); target \(\lceil\bar d_{ik}(L^{nom} + 3 + 3)\rceil\), \(q = \max(0, \text{target} - IP)\). Ignores observed demand and events. | benefit | \(\Delta ES/q\) | proportional |
| tuned-sQ (`reorder-point`) | \(s = \hat\mu L' + z\hat\sigma\sqrt{L'}\), \(L' = L^{nom}+1\); \(Q = \max(1,\mathrm{round}(q_{scale}\sqrt{2\hat\mu K/h}))\); if \(IP \le s\) order \(nQ\), \(n = \lceil (s-IP)/Q\rceil\). \((z, q_{scale})\) per SKU × region type from calibration seeds (§10). | benefit | \(\Delta ES/q\) | proportional |
| cost-only (`cost-first`) | \((s,S)\): \(s = \mu_\tau + z^\*\sigma_\tau\), \(S = s + Q\) | **net** (so lines with net ≤ 0 fail the gate) | net / q | rank |
| weighted-equity (`equity-aware`) | \((s,S)\) with \(z = 1.65\) | benefit | \(w_s\,pw_k\,\Delta ES\,(1 + \lambda\,\text{need}_r) + w_w v_r B_{ik} - w_c\,\text{cost}\) | rank |
| ERRRA (`equity-constrained-rolling-horizon`) | two-stage plan (below) | benefit | stage 1: \(1 + (1 - SR_r)\) at first allocation; stage 2: \((3 - \text{tier} + x/(1+|x|))/4\), \(x\) = net/q | plans within capacity |

For weighted-equity, \((w_s, w_w, \lambda, w_c) = (1, 0.5, 2, 0.01)\) and \(pw\) = {essential 3, chronic-care 2, routine 1}. The regional need score is
\[
\text{need}_r = (1 - EF_r)\cdot\frac{v_r}{\max_{r'} v_{r'}}\cdot\big(1 + \min(1, BR_r)\big) \in [0, 2]
\]
It is 0 when region \(r\) is fully served, and it increases with the region's unmet share, its vulnerability and its backlog.

### ERRRA allocation heuristic [`errra.js`]

ERRRA is a deterministic two-stage allocation heuristic, recomputed every day from information up to \(t\). It is **not** an optimizer and is not proven optimal. Defaults (fixed a priori, never tuned on test seeds): floor \(\varphi = 0.95\), gap \(\delta = 0.10\), vulnerability tilt \(\beta = 0.05\), projection \(z_p = 1\), batch fraction 0.1, buffer 2 days, surge detection ratio 1.15.

- Projected essential service in region \(r\): \(SR_r(x) = \sum_{l \in E_r}\min(a_l + x_l, n_l)/\sum_{l\in E_r} n_l\), with \(a_l = I_l + O_l\) and \(n_l = \mu_\tau + z_p\sigma_\tau + B_l\).
- **Stage 1 (water-filling toward the floor).** Repeatedly give a batch to the essential line with the lowest coverage in the region minimizing \(\min(SR_r,\varphi) - \beta(v_r - 1)\), subject to per-warehouse capacity \(\min(\text{dispatch}, \text{truck})\) and warehouse stock. Stop when every region reaches \(\varphi\) or nothing feasible remains.
- **Stage 2 (cost-aware additions).** Keep stage 1 fixed. Add units up to the cost-only \((s,S)\) target on lines with net > 0, in tier order (essential, chronic-care, routine), then by net per unit. An essential addition to a non-worst region may not lift its \(SR\) above \(SR_{\text{worst}} + \delta\) while the worst region can still improve.

Stage-1 scores lie in (1, 2] and stage-2 scores in (0.25, 1), so the rank order preserves the lexicographic priority.

**Ablation flags** (each removes one component): `useServiceFloor` (\(\varphi = 0\)), `useVulnerability` (\(\beta = 0\)), `useRollingHorizon` (static prior forecast), `useEssentialPriority` (one tier, stage 1 on all SKUs), `useCompoundAwareness` (neutral lead and supply factors, no buffer, no surge detection), `useLateralTransfers`, `useSupplierRedundancy`.

Compound awareness uses only observable supply-side factors and a history-based surge detector (\(\hat\mu/\hat\mu_0 \ge 1.15\)); it never reads the true demand multiplier.

## 10. Calibration of the tuned-sQ baseline [`scripts/paper/run-all.js`]

Calibration runs per scenario, on calibration seeds only:

1. Evaluate a uniform grid \(z \in \{0.5, 1, 1.65, 2.5, 3.5, 5, 7, 10\}\) × \(q_{scale} \in \{0.5, 1, 2, 3, 5, 8, 12, 18\}\). Extend an axis ×1.5 while the optimum lies on its upper edge (at most 4 times).
2. The objective is the mean of total cost + weighted stockout penalty.
3. For every SKU × region type group \(g\), take the grid point minimizing that group's attributed cost (procurement, transport, fixed order, pharmacy holding, stockout penalty; `runLog.groupCosts`).
4. Use this per-line setting only if it lowers the full objective below the best uniform point. Otherwise use the best uniform point; this guards against interactions through shared warehouse and transport capacity.

## 11. Costs and audit

\[
\text{totalCost} = \text{procurement} + \text{transport} + \text{orderFixed} + \text{pharmacyHolding} + \text{warehouseHolding} + \text{upstreamSupply} + \text{lateralTransfer}
\]
The stockout penalty is reported separately (`penalties.weightedStockoutPenalty`); it is not part of totalCost.

**Mandatory end-of-run audit** (`inventoryAudit`, always on). Five residuals are computed per SKU:

- warehouses: initial + received upstream − issued to pharmacies − expired/lost (0) − ending stock
- pharmacies: initial + received from warehouses + transfers in − dispensed − transfers out − expired/lost (0) − ending stock
- network: initial + received upstream − dispensed − (warehouse + pharmacy stock + warehouse shipments in transit + transfers in transit)
- warehouse pipeline: issued − arrived − in transit
- transfer pipeline: transferred out − transferred in − in transit

Any residual \(> 10^{-6}\) in absolute value throws `ConservationError`, and the experiment is not stored. The optional daily check (`checkConservation: true`) adds three per-day identities: the stock identity, \(\sum O\) = in transit, and cumulative backordered = Σ backlog + served from backlog. It also rejects negative stock, backlog or on-order. The unmet identity (same-day unfilled = late-filled + horizon-end unmet) is asserted in `researchQuality.test.js`.
