# Digital-twin integration

The existing simulation engine (`simulation-engine-v4.0.0`), scenario matrix v2.0.0, and ERRRA heuristic v2.0.0 are unchanged. They are reached through `server/ai/digitalTwinBridge.js`.

Operations proposals (`purchase|transfer|expedite|hold`) must include a `digitalTwinEvaluation` with `scenarioHash`, baseline metrics, proposal metrics, and differences. Predictions are **synthetic or model estimates**, not real-world forecasts.

The twin **never** writes live inventory. After pharmacist or admin approval, the system may create a **draft** purchase/transfer document (`draft_pending_execution`) only.

ERRRA remains a named allocation heuristic, not an optimizer and not “AI”. Frozen paper tables under `paper/` must not change because of this UI/workflow layer (`server/__tests__/paperRegression.test.js`).
