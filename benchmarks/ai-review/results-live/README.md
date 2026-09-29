# Live-model evaluation outputs

This directory is the write target of `npm run ai:evaluate:live`.

**No live-model result file has been committed.** `latest.json` is gitignored so a local run cannot be mistaken for a published performance claim.

The checked-in 64-case report under `../results/` was produced by the **deterministic mock** (`mock-deterministic-v1`). Millisecond latencies are expected for that mock. Those numbers measure implementation fidelity on cases written from the same rule table. They are not a real-LLM evaluation and must not be cited as calibrated AI accuracy or as 100% clinical sensitivity.

To produce a live report locally (still synthetic cases, still not a clinical validation):

```
AI_PROVIDER=openai-compatible AI_BASE_URL=... AI_MODEL=... AI_API_KEY=... npm run ai:evaluate:live
```

Hard-risk recall on this set still does not prove sensitivity to unseen prescriptions.
