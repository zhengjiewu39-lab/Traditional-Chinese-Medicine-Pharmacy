# Model and algorithms (engine `simulation-engine-v3.0.0`)

Synthetic discrete-time model. Nothing here is calibrated to real pharmacies, patients or epidemics.

## 1. System dynamics (one day \(t\))

Pharmacy \(i\) (region \(r(i)\), warehouse \(w(i)\)), SKU \(k\):

| Symbol | Meaning |
|---|---|
| \(I_{ik}\) | on hand |
| \(O_{ik}\) | on order (shipped, in transit) |
| \(B_{ik}\) | backlog (backordered demand) |
| \(IP_{ik} = I_{ik} + O_{ik} - B_{ik}\) | **inventory position** — the only stock quantity any policy uses |
| \(W_{wk}\) | warehouse on hand |

Order of operations per day:

1. **Upstream inbound**: \(W_{wk} \mathrel{+}= \mathrm{round}(\text{inboundBase}_{wk}\cdot s_w(t))\), \(\text{inboundBase}_{wk} = \text{coverage}\cdot\sum_{i\in w}\bar d_{ik}\), \(s_w(t)\) = supply factor.
2. **Arrivals**: shipments with arrival day \(\le t\): \(I \mathrel{+}= q\), \(O \mathrel{-}= q\); then backlog is served FIFO from \(I\).
3. **Demand** (common random numbers; independent of policy): \(D_{ikt} = \max(0, \mathrm{round}(\bar d_{ik}(1+\varepsilon)\,m_{r}(t)))\), \(\varepsilon \sim N(0, \mathrm{CV}_r^2)\), \(\bar d_{ik} = \frac{\text{pop}_i}{1000}\,\text{baseDemand}_r\cdot\text{scale}(\text{priority}_k)\). Fill \(\min(I, D)\); the rest joins \(B\).
4. **Forecast update** (history only): EWMA \(\hat\mu \leftarrow 0.3 D + 0.7\hat\mu\), variance likewise; prior \(\hat\mu_0 = \bar d_{ik}\).
5. **Holding cost** on pharmacy and warehouse stock.
6. **Regional signals** from the last 7 days (fill, backlog rate, access delay).
7. **Policy decision** → orders with `policyScore`, `policyRank`, `allocationReason`.
8. **Warehouse dispatch cap** \(\lfloor \text{cap}_w\cdot s_w(t)\rfloor\) and **truck cap**. Scored policies are served in `policyRank` order. Unscored baselines (fixed-allocation, reorder-point) are rationed **proportionally**. Only units that the warehouse can actually issue consume capacity.
9. **Ship**: \(W \mathrel{-}= q\), \(O \mathrel{+}= q\); arrival after \(\lceil \tau^{tr}_{ik}\rceil \ge 1\) days, with \(\tau^{tr} = (\text{transit}_r\cdot f^{road}_r + 0.25\,L_k f^{lead}_r)(1+\text{dist}_r/100)/\text{road}_r\).

Conservation identities are checked every day when `checkConservation` is on:
- Stock identity: \(\sum W + \sum I + \text{in transit} = \text{initial} + \text{inbound} - \text{dispensed}\).
- Pipeline identity: \(\sum O = \text{in transit}\).
- Backlog identity: cumulative backordered \(= \sum B\) + served from backlog.

Unshipped requests are dropped, not queued. Because the next decision re-reads \(IP\), which already includes \(O\), nothing is ordered twice while goods are in transit.

## 2. Shared line quantities

For each line \((i,k)\), all quantities use only information available at \(t\):

| Quantity | Definition |
|---|---|
| lead \(L\) | \(\lceil\tau^{tr}\rceil\), using current or neutral event factors depending on the policy |
| \(\tau\) | \(L + 1 + b\) (\(b\) = disruption buffer, ERRRA only) |
| demand over \(\tau\) | \(\mu_\tau = \hat\mu\tau\), \(\sigma_\tau = \hat\sigma\sqrt\tau\) |
| Cycle quantity \(Q = \min(\sqrt{2\hat\mu K/h},\ 30\hat\mu)\) | EOQ capped at 30 days of demand |
| cycle horizon | \(\tau_c = \tau + Q/\hat\mu\), with demand \(N(\hat\mu\tau_c, \hat\sigma^2\tau_c)\) |
| Expected shortfall | \(ES(x) = E[(D-x)^+] = \sigma\,\phi(z) - (x-\mu)(1-\Phi(z))\), \(z = (x-\mu)/\sigma\) |

**Line economics** for shipping \(q\) units, with \(\Delta ES = ES(IP) - ES(IP+q)\) over \(\tau_c\):

\[
\text{benefit} = (p + w\,\tau/2)\,\Delta ES,\qquad
\text{cost} = (c + c^{tr}_r)\,q + K + h\,q\cdot\frac{q}{2\hat\mu},\qquad
\text{net} = \text{benefit} - \text{cost}
\]

Here \(p\) is the stockout penalty and \(w\) the synthetic delay penalty per day. Stockout loss appears **only** in the benefit.

Newsvendor factor: \(z^\* = \Phi^{-1}\!\big((p - c - c^{tr})/(p + h\tau)\big)\), clipped to \([-1, 3]\).

## 3. Policies

| Policy | Rule | Shortage rationing |
|---|---|---|
| `fixed-allocation` | Review every \(R = 3\) days, staggered by pharmacy index. Order-up-to \(S = \hat\mu_0 (L^{nom} + R + 3)\): \(q = \max(0, \lceil S - IP\rceil)\). Ignores observed demand and events. | proportional |
| `reorder-point` (tuned \(s,Q\)) | \(s = \hat\mu(L^{nom}+1) + z\hat\sigma\sqrt{L^{nom}+1}\), \(Q = \max(1, \mathrm{round}(q_{scale}\cdot\text{EOQ}))\). If \(IP \le s\), order \(nQ\), \(n = \lceil(s-IP)/Q\rceil\). \((z, q_{scale})\) tuned per scenario on calibration seeds. | proportional |
| `cost-first` | \(s = \mu_\tau + z^\*\sigma_\tau\). If \(IP \le s\), \(q = \lceil s + Q - IP\rceil\). Selected only if net \(> 0\), otherwise logged `negative_net_benefit`. Ranked by net per unit. | rank |
| `equity-aware` (weighted heuristic) | Same \((s,S)\) with \(z = 1.65\), no cost gate. Score \(= \text{pw}\cdot\Delta ES + 0.5\,v_r B + \mathbb 1[\delta_r>0]\cdot 100\,v_r\delta_r - 0.01\,\text{cost}\). Regional deficit \(\delta_r = (\max EF - EF_r) + (BR_r - \min BR) + (AD_r - \min AD)/30 \ge 0\), and \(\delta_r = 0\) when regions are equal. | rank |
| `equity-constrained-rolling-horizon` (**ERRRA heuristic**) | See §4. | plans within capacity |

## 4. ERRRA — Equity-constrained Resilient Rolling-horizon Allocation (heuristic)

Solved every day with information up to \(t\) only (no future demand). Parameters:

| Parameter | Value |
|---|---|
| floor \(\varphi\) | 0.95 |
| gap \(\delta\) | 0.10 |
| vulnerability tilt \(\beta\) | 0.05 |
| projection \(z_p\) | 1.0 |
| batch fraction | 0.1 |
| buffer \(b\) | 2 days |
| surge detection ratio | 1.15 |

They were set a priori and **not tuned on test seeds**.

**Projected essential service.** For essential line \(l\) in region \(r\):
- Availability \(a_l = I_l + O_l\).
- Need \(n_l = \mu_\tau + z_p\sigma_\tau + B_l\).
- Regional service \(SR_r(x) = \sum_{l\in E_r}\min(a_l + x_l, n_l) / \sum_{l\in E_r} n_l\).

**Stage 1 (guarantee):**

\[
\max_x \min_r \big[\min(SR_r(x),\varphi) - \beta(v_r - 1)\big]
\quad\text{s.t.}\quad \sum_{l\in w} x_l \le \text{cap}_w,\ \ \sum_{l\in w,k} x_l \le W_{wk},\ \ x \in \mathbb Z_{\ge 0}
\]

This is solved by water-filling: repeatedly give a chunk to the lowest region.

**Stage 2 (efficiency):** keep \(x^{(1)}\) fixed and add units only where net \(> 0\) (§2). Lines are processed in tier order (essential, then chronic-care, then routine), and within a tier by net per unit. Two constraints apply:
- **Gap constraint (no leveling down):** an addition to a non-worst region may not raise its \(SR\) above \(SR_{\text{worst}} + \delta\) while the worst region can still be improved; otherwise the constraint is recorded as relaxed.
- **Stage-2 target:** the same \((s, S)\) as cost-first.

```text
ERRRA(t):
  lines ← build_lines(state_t, forecasts_t, factors_t if compound_aware else neutral)
  cap_w ← min(dispatchCap_w · supplyFactor_w(t), truckCap_w);  stock_wk ← W_wk
  # Stage 1: max–min water-filling on essential lines
  while ∃ region r with SR_r < φ and a feasible essential line:
      r* ← argmin_r [SR_r − β(v_r − 1)]            (ties → higher v_r)
      l* ← argmin_{l∈E_r*, room>0} min(a_l+x_l, n_l)/n_l   (ties → lower pharmacy index)
      Δ  ← min(room(l*), ⌈φ·N_r* − Cov_r*⌉, ⌈batch·n_l*⌉)
      x_l* += Δ; cap, stock −= Δ
  # Stage 2: cost-aware additions, tier order, gap constraint
  for c in sort(lines, by tier then net-per-unit desc):
      if net(c) ≤ 0: log(c, 'negative_net_benefit'); continue
      q ← min(target(c) − x_c, cap_w, stock_wk)
      if c is essential and region(c) ≠ worst and worst still improvable:
          q ← min(q, ⌊(SR_worst + δ)·N_r − Cov_r⌋)       # defer clipped part to a second pass
      x_c += q
  emit orders ranked by allocation order, with reasons and diagnostics
  diagnostics: solver='ERRRA heuristic', stage1Value, floorSatisfied, projectedGap,
               gapSatisfied, gapConstraintRelaxed, regional SR before/after, units
```

**Ablation flags** (each removes exactly one component):

| Flag | Effect when false |
|---|---|
| `useServiceFloor` | \(\varphi = 0\): stage 1 is skipped |
| `useVulnerability` | \(\beta = 0\) |
| `useRollingHorizon` | static prior forecast instead of EWMA |
| `useEssentialPriority` | stage 1 runs on all SKUs and there is a single tier |
| `useCompoundAwareness` | neutral lead and supply factors, no buffer, no surge detection. Awareness uses observed supply-side factors and a history-based surge detector (EWMA/prior ≥ 1.15); it never reads the true demand multiplier. |

**Exactness.** Stage 1 is exact for a single shared capacity with unit steps (verified against exhaustive enumeration on 500 random instances). With several warehouse capacities it is a heuristic: in 500 instances with two capacities it was exactly optimal in 86–91%, with mean gap < 0.01 and maximum gap 0.15–0.20 in \(SR\). Stage 2 is greedy and has no optimality guarantee.

## 5. Why ERRRA is not called AI

ERRRA is a deterministic, rule-based, two-stage allocation heuristic. It contains no learned model and no training data.
