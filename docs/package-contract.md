# Package Contract Notes

`ai.braindrive.resume-builder` is the standalone app package proof for AL-002.
It starts from manifest-version 2 package semantics found in ws5 and remains
catalog-discoverable through the Stage 1 `local-dev` channel.

The package repo will own source, package manifest generation, file inventory,
descriptor output, source index output, local-dev archive generation, tests, and
package evidence. The host repo will continue to own owner data migration,
retained data policy enforcement, trust roots, revocation evaluation, lifecycle
state, runtime supervision, and install/update decisions.

The Stage 1 catalog may project that this is a launchable app with no required
external capability provider. It must not project commands, host paths, endpoint
URLs, ports, credentials, owner trust roots, automatic installation decisions,
or runtime authority.
