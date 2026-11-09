# Development dependency review — 9 November 2026

The original baseline had 20 affected packages, including critical development
tool advisories. The fresh audit was repeated rather than relying on those
counts. Updates retain Vite 6 with its patched 6.4.6 release, migrate Vitest to
4.1.12 (removing the vulnerable Tinypool dependency), update CRXJS to 3.0.0
(patched Rollup 2.80.0), Sharp to 0.35.5 and TypeScript ESLint to 8.72.1.
Compatible transitive fixes were applied with `npm audit fix`, without `--force`.

## One temporary exception

[GHSA-g3hv-75wg-m249](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249)
affects Minimatch 10.2.6 under `@typescript-eslint/typescript-estree`; npm also
reports its six parent packages. The upstream ESLint parser still depends on
Minimatch 10. The advisory's amplification path requires attacker-controlled
glob patterns at optimization level 2 or higher. This repository uses fixed,
reviewed configuration globs, not imported practice data or network input.
This package is development-only and is absent from the shipped runtime.

Reviewing an untrusted PR still means reviewing its executable configuration
and scripts before running them. This exception is scoped to that advisory,
development-only Minimatch/TypeScript ESLint packages and moderate severity;
it expires on **9 February 2027**. The audit command rejects other findings and
an expired exception. It does not report the raw audit as clean.

Remove the exception when the parser adopts a fixed supported Minimatch.
Do not apply npm's suggested downgrade to TypeScript ESLint 8.36.0 or force a
different Minimatch major underneath the parser without compatibility evidence.

Run `npm run audit:dependencies` for the checked policy and `npm audit` to see
the complete raw findings. `npm audit --omit=dev` checks the runtime dependency
graph separately. Build, test, package and installed-browser checks accompany
these updates.

Migration reference: [Vitest 4 migration guide](https://v4.vitest.dev/guide/migration.html).
