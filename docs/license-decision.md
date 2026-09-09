# License Decision

Date: 2026-09-09  
Scope: `braindrive-resume-builder`

## Decision

No public or open-source license is granted for the Stage 1 Resume Builder package repository in AL-001 or AL-002.

The repository is a BrainDrive-controlled local development asset for extracting the standalone Resume Builder app package. It remains private/internal unless Dave J and BrainDrive make a later explicit repository licensing decision.

The root npm package metadata uses `UNLICENSED`. Third-party dependency license metadata in `package-lock.json` remains dependency provenance and does not license BrainDrive-owned source.

## Rationale

Stage 1 package extraction is restricted to BrainDrive-built and BrainDrive-reviewed packages. This decision avoids implying third-party reuse, public publishing, or marketplace distribution rights before the package lifecycle is implemented and reviewed.
