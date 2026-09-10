# BrainDrive Resume Builder

Stage 1 standalone app package for BrainDrive Resume Builder.

This repository is the planned source for the `BrainDrive-Resume-Builder`
GitHub repo. It owns the app package source, workflow code, UI resource,
inference program, supporting owner-editable resources, tests, and local-dev
release artifacts for `ai.braindrive.resume-builder`.

Resume Builder is the first standalone package proof for BrainDrive's Stage 1
app lifecycle work. It does not require an external capability provider to
activate, which makes it the baseline proof for package extraction, catalog
metadata, host verification, install, launch, update, uninstall, and retained
owner data behavior.

## Package Contract

- Package ID: `ai.braindrive.resume-builder`
- Publisher: `ai.braindrive`
- Package kind: `app`
- Release channel: `local-dev`
- Current version: `4.2.21`
- Artifact name: `braindrive-resume-builder-4.2.21-local.dev.bdapp`
- npm package: `@braindrive/resume-builder`

The package uses ws5 manifest-version 2 semantics. The package manifest owns app
deliverables, files, components, target metadata, configuration, permissions,
retention, diagnostics, and evidence declarations. BrainDrive host code owns
verification, trust, compatibility filtering, revocation, registration joins,
install and update decisions, lifecycle state, runtime supervision, and owner
data preservation.

Supported target metadata currently covers `docker_linux_x64`,
`desktop_windows_x64`, and `desktop_macos_universal`. Windows desktop has been
proved through ws5; macOS remains a required native proof before release claims.

## Commands

```bash
npm run validate
npm run build
npm run test
npm run package
npm run verify:ws5
```

## License

MIT. See `LICENSE`.
