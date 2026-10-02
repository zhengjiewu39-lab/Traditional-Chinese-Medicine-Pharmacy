# Recoverable archive

Moved out of the main digital-pharmacy application on branch `refactor/digital-pharmacy-service`. Git history is intact. Do not treat this folder as an active runtime.

## Verified freeze tags (checked with `git tag -l`, not assumed from README)

| Tag | Purpose |
|---|---|
| `v1.0.0-research` | Supply-simulation / digital-twin freeze |
| `legacy-cdss-v1` | Legacy prescription CDSS evaluation |

Restore a tree: `git checkout <tag> -- <path>` or copy from this directory.

| Directory | Contents |
|---|---|
| `simulation-research/` | Simulation engine, routes, UI, paper scripts, reproduce scripts |
| `operations-agent/` | `operationsAgent`, `digitalTwinBridge`, Operations UI |
| `legacy-demos/` | Membership, org/HR, mock quality/compliance, old research hub, customers UI, herb-kb mock |
| `legacy-cdss/` | `/api/research`, `/api/analytics`, ablation script |
| `docs/` | Digital-twin integration note |

Shared identity, inventory, audit, and the prescription state machine were **not** moved.
