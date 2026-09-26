# Evaluation: migrating the frontend from Create React App to Vite

**Decision: defer.** Stay on CRA (`react-scripts` 5.0.1) for this release. Revisit once the paper results are frozen.

## Current state (after this release)

- Strict build `CI=true npm run build` passes with ESLint enabled (no `DISABLE_ESLINT_PLUGIN`).
- Legacy demo routes are code-split with `React.lazy`; the research platform no longer loads them.
- `npm audit`: 0 critical, 0 high (9 low, 7 moderate), after `npm audit fix` and targeted `overrides` for transitive build-tool packages (`nth-check`, `postcss`, `serialize-javascript`, `svgo`, `d3-color`, `underscore`, `bfj`). The remaining moderate and low findings are inside the CRA toolchain (dev and build time only; they are not shipped in the bundle).

## Benefits of Vite

- Maintained toolchain; removes the `react-scripts` dependency tree, which is the source of every remaining audit finding.
- Faster dev server and builds.
- Native ESM and simpler configuration.

## Costs and risks

| Item | Effort |
|---|---|
| `REACT_APP_*` env vars → `import.meta.env.VITE_*` (API base URL used in several pages) | small, but touches legacy pages |
| `index.html` moves to project root; `public/` handling differs | small |
| JSX in `.js` files (all pages) needs `esbuild` loader config or renaming to `.jsx` | medium (≈ 60 files) |
| Jest-based `react-scripts test` (unused by CI; server tests use `node --test`) | none / drop |
| ESLint config `react-app` → flat config with `eslint-plugin-react-hooks` | small |
| Proxy / `.env.development` behaviour | small |
| Risk of breaking unmaintained legacy pages during a research release | main reason to defer |

## Plan when revisited

1. Create a branch, add `vite` and `@vitejs/plugin-react`, and move `index.html`.
2. Configure `esbuild.loader: { '.js': 'jsx' }` to avoid renaming files.
3. Replace `process.env.REACT_APP_API_BASE_URL` with a single `src/config/env.js` reading `import.meta.env.VITE_API_BASE_URL`.
4. Keep `React.lazy` legacy chunks; verify the bundle split with `vite build --report`.
5. Update CI to `npm run build` (Vite) plus `npm run lint`; drop `react-scripts`; re-run `npm audit`.
