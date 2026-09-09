# BrainDrive Resume Builder Package

Local Stage 1 package repository for `ai.braindrive.resume-builder`.

This repo is ready to receive the Resume Builder source in AL-002. AL-001 only
establishes the package contract, validation command, and repository boundary.
No app source has been moved yet.

## Package Contract

- Package ID: `ai.braindrive.resume-builder`
- Publisher: `ai.braindrive`
- Package kind: `app`
- Release channel: `local-dev`
- Initial version: `0.1.0`
- Initial artifact name: `braindrive-resume-builder-0.1.0-local.dev.bdapp`

The package will use ws5 manifest-version 2 semantics. The package manifest owns
app deliverables, files, components, target metadata, configuration, permissions,
retention, diagnostics, and evidence declarations. The BrainDrive host owns
verification, trust, compatibility filtering, revocation, registration joins,
install/update decisions, lifecycle state, runtime supervision, and owner data
preservation.

## Commands

```bash
npm run validate
npm run test
```

These commands are real today and will remain the initial gate after source is
moved into the repo.
