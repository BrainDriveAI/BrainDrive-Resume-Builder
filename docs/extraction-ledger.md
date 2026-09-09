# Resume Builder Extraction Ledger

Date: 2026-09-09  
Roadmap ID: AL-002

## Extracted Source

Authoritative package source now lives in this repository:

- `src/`
- `resources/`
- `test/`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vitest.config.ts`
- `scripts/generate-local-dev-package.mjs`
- `scripts/verify-with-ws5.mjs`

The extracted package preserves the app-owned workflow, UI resource, inference program, resume templates, font resources, and package test suite from ws5 `builds/resume_builder`.

## Host Boundary

BrainDrive host-owned owner data migration, lifecycle state, trust verification, retained-data policy, capability mediation, and runtime supervision remain in ws5. AL-002 adds only a transitional ws5 verifier hook so the external package can be verified by the existing host package verifier.

## Package Evidence

Generated local-dev release:

- Archive: `dist/local-dev/release/4.2.21/braindrive-resume-builder-4.2.21-local.dev.bdapp`
- Descriptor: `dist/local-dev/release/4.2.21/descriptor.json`
- Manifest: `dist/local-dev/release/4.2.21/manifest.json`
- Source index: `dist/local-dev/release/4.2.21/source-index.json`
- Revocation list: `dist/local-dev/release/4.2.21/revocations.json`
- Trust root: `dist/local-dev/release/4.2.21/trust-root.json`

Package metadata:

- Archive digest: `sha256:b70d9cf39b4d573db49b165afe57ea0f0e92486ebe4566ecc3c6a5ebc4606da1`
- Descriptor digest: `sha256:ae7dd9fbd7a88f31daa895b35962df0562d21a72a9adb0df8ce34c3dd9753083`
- Manifest digest: `sha256:ef0395b3a1d85e3efefb7b97a7bdb828af605892d74affebd0809b16b47e4c17`

Target semantics:

- `docker_linux_x64`
- `desktop_windows_x64`
- `desktop_macos_universal`
