# Task completion checklist
1. `pnpm build` succeeds.
2. Run unit tests: `pnpm exec jest --config jest.config.cjs --runInBand --forceExit`.
3. Run module verification: `pnpm verify`.
4. Run protocol integration smoke: `node test_integration.mjs`.
5. Run live URL smoke: `node scripts/live-smoke.mjs` and inspect stderr warnings.
6. Confirm README reflects current scripts, env vars, and architecture.
7. Confirm no unexpected tool-name regressions (verify script enforces this).