# Contributing

Thank you for your interest in contributing to the TCM Chain Pharmacy Management System.

## Getting started

1. Fork the repository and clone your fork
2. Install dependencies: `npm install`
3. Copy environment template: `cp .env.example .env`
4. Run development: `npm run dev`

## Development workflow

1. Create a feature branch from `main`
2. Make focused changes with clear commit messages
3. Run checks locally before opening a PR:

```bash
npm run test:server
npm run evaluate
npm audit --audit-level=high
```

4. Open a pull request against `main` with:
   - Summary of changes
   - Test plan / commands run
   - Screenshots for UI changes (if applicable)

## Code guidelines

- Match existing style in the file you edit
- Keep changes minimal and scoped to the task
- Do not commit secrets (`.env`, credentials, real patient data)
- Prescription benchmark data must remain synthetic

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting. Do not include exploit details in public issues.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
