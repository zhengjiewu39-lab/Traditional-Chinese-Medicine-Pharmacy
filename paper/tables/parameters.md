# Model parameters (synthetic scenario assumptions, 合成场景假设)

Network: 2 warehouses, 12 pharmacies, 8 SKUs, 120 days. None of these values is estimated from real data.

## Regions

| Region | Pharmacies | Population | Base demand /1000 | Volatility (CV) | Distance km | Road accessibility | Base transit days | Vulnerability v_r |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| urban | 4 | 50000 | 1 | 0.15 | 8 | 1 | 0.5 | 1 |
| suburban | 4 | 20000 | 0.85 | 0.2 | 25 | 0.85 | 1 | 1.2 |
| rural | 4 | 8000 | 0.7 | 0.25 | 60 | 0.6 | 2.5 | 1.6 |

## SKUs (priority demand scale: essential 1.2, chronic-care 1.0, routine 0.75)

| SKU | Priority | Procurement c | Holding h /unit·day | Stockout penalty p | Lead time days |
| --- | --- | --- | --- | --- | --- |
| D1 | essential | 4 | 0.03 | 50 | 2 |
| D2 | essential | 4.2 | 0.03 | 50 | 2 |
| D3 | chronic-care | 3 | 0.025 | 35 | 3 |
| D4 | chronic-care | 3.1 | 0.025 | 35 | 3 |
| D5 | routine | 2 | 0.02 | 15 | 4 |
| D6 | routine | 2 | 0.02 | 15 | 4 |
| D7 | routine | 1.8 | 0.02 | 15 | 4 |
| D8 | routine | 1.8 | 0.02 | 15 | 4 |

## Logistics, supply network and lateral transfers (default scenario)

| Parameter | Value |
| --- | --- |
| logistics.orderCost | 25 |
| logistics.transportCostPerUnit | 0.15 |
| logistics.maxCycleDays | 30 |
| logistics.pharmacyInitialStockDays | 10 |
| logistics.warehouseInitialStockDays | 10 |
| logistics.warehouseTargetStockDays | 10 |
| logistics.warehouseCapacityDays | 45 |
| logistics.dispatchCapacityCoverage | 1.5 |
| logistics.truckCapacityCoverage | 1.5 |
| logistics.capacityMultiplier | 1 |
| logistics.initialStockMultiplier | 1 |
| logistics.lateralTransfers.enabled | true |
| logistics.lateralTransfers.essentialOnly | true |
| logistics.lateralTransfers.transitDays | 1 |
| logistics.lateralTransfers.costPerUnit | 0.4 |
| logistics.lateralTransfers.fixedCost | 10 |
| logistics.lateralTransfers.capacityCoverage | 0.25 |
| logistics.lateralTransfers.cooldownDays | 7 |
| logistics.lateralTransfers.donorSafetyZ | 1.65 |
| supplyNetwork.redundancyEnabled | true |
| supplyNetwork.primary.replenishmentLeadTime | 2 |
| supplyNetwork.primary.capacityCoverage | 1.2 |
| supplyNetwork.primary.reliability | 0.98 |
| supplyNetwork.primary.unitCost | 0.5 |
| supplyNetwork.backup.replenishmentLeadTime | 5 |
| supplyNetwork.backup.capacityCoverage | 0.4 |
| supplyNetwork.backup.reliability | 0.9 |
| supplyNetwork.backup.unitCost | 1.2 |

## Metric weights

| Parameter | Value |
| --- | --- |
| metricsWeights.stockoutPenaltyByPriority.essential | 50 |
| metricsWeights.stockoutPenaltyByPriority.chronic-care | 35 |
| metricsWeights.stockoutPenaltyByPriority.routine | 15 |
| metricsWeights.waitingTimePenaltyPerDay | 8 |
| metricsWeights.inequityPenaltyPerGap | 120 |
| metricsWeights.maxRelevantWaitDays | 30 |
| metricsWeights.serviceInequalityWeights.stockout | 0.3333333333333333 |
| metricsWeights.serviceInequalityWeights.wait | 0.3333333333333333 |
| metricsWeights.serviceInequalityWeights.gini | 0.3333333333333333 |
| policyWeights.equityAware.stockout | 1 |
| policyWeights.equityAware.wait | 0.5 |
| policyWeights.equityAware.inequity | 2 |
| policyWeights.equityAware.cost | 0.01 |

## Policies (defaults; the (s,Q) z and qScale are replaced by per-scenario calibration)

| Name | Id | Version | Parameters | Shortage rationing |
| --- | --- | --- | --- | --- |
| fixed-allocation | fixed-allocation | 4.0.0 | `{"reviewPeriodDays":3,"safetyDays":3}` | proportional |
| tuned-sQ | reorder-point | 4.0.0 | `{"z":1.65,"qScale":1,"perLine":null}` | proportional |
| cost-only | cost-first | 4.0.0 | `{}` | rank |
| weighted-equity | equity-aware | 4.0.0 | `{"z":1.65}` | rank |
| ERRRA | equity-constrained-rolling-horizon | 2.0.0 | `{"serviceFloor":0.95,"maxRegionalGap":0.1,"vulnerabilityBeta":0.05,"projectionZ":1,"batchFraction":0.1,"disruptionBufferDays":2,"surgeDetectionRatio":1.15,"useServiceFloor":true,"useVulnerability":true,"useRollingHorizon":true,"useEssentialPriority":true,"useCompoundAwareness":true,"useLateralTransfers":true,"useSupplierRedundancy":true}` | rank |
