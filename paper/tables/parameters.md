# Model parameters (synthetic, illustrative)

Network: 2 warehouses, 12 pharmacies, 8 SKUs, 120 days.

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

## Logistics (base network)

| Parameter | Value |
| --- | --- |
| orderCost | 25 |
| transportCostPerUnit | 0.15 |
| truckCapacityUnits | 2000 |
| dailyDispatchCapacityPerWarehouse | 2500 |
| pharmacyInitialStockDays | 10 |
| warehouseInitialStockDays | 20 |
| upstreamInboundCoverage | 1.2 |
| dispatchCapacityCoverage | 1.5 |
| truckCapacityCoverage | 1.5 |
| capacityMultiplier | 1 |
| initialStockMultiplier | 1 |

## Policies (defaults; reorder-point z and qScale are replaced by per-scenario calibration)

| Policy | Version | Parameters | Shortage rationing |
| --- | --- | --- | --- |
| fixed-allocation | 3.0.0 | `{"reviewPeriodDays":3,"safetyDays":3}` | proportional |
| reorder-point | 3.0.0 | `{"z":1.65,"qScale":1}` | proportional |
| cost-first | 3.0.0 | `{}` | rank |
| equity-aware | 3.0.0 | `{"z":1.65}` | rank |
| equity-constrained-rolling-horizon | 1.0.0 | `{"serviceFloor":0.95,"maxRegionalGap":0.1,"vulnerabilityBeta":0.05,"projectionZ":1,"batchFraction":0.1,"disruptionBufferDays":2,"surgeDetectionRatio":1.15,"useServiceFloor":true,"useVulnerability":true,"useRollingHorizon":true,"useEssentialPriority":true,"useCompoundAwareness":true}` | rank |
