#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const contract = JSON.parse(readFileSync(resolve("package-contract.json"), "utf8"));
const requiredAuthority = [
  "package_verification",
  "trust_evaluation",
  "compatibility_filtering",
  "revocation_checking",
  "reviewed_registration_joins",
  "install_update_decisions",
  "lifecycle_state",
  "runtime_supervision",
  "owner_data_preservation"
];
const excludedCatalogFields = [
  "executable_command_lines",
  "host_paths",
  "private_endpoint_urls",
  "ports",
  "credentials",
  "owner_trust_roots",
  "install_decisions",
  "runtime_authority"
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(contract.package_id === "ai.braindrive.resume-builder", "unexpected package_id");
assert(contract.publisher_id === "ai.braindrive", "unexpected publisher_id");
assert(contract.package_kind.length === 1 && contract.package_kind[0] === "app", "unexpected package_kind");
assert(contract.release_channel === "local-dev", "unexpected release_channel");
assert(contract.version === "4.3.1", "unexpected version");
assert(contract.artifact_name === "braindrive-resume-builder-4.3.1-local.dev.bdapp", "unexpected artifact_name");
assert(contract.manifest_semantics.manifest_version === 2, "manifest_version must be 2");
assert(contract.manifest_semantics.package_profile === "braindrive-package-v2", "unexpected package profile");
assert(contract.planned_artifacts.length === 3, "expected three target artifacts");
for (const target of ["docker_linux_x64", "desktop_windows_x64", "desktop_macos_universal"]) {
  assert(contract.planned_artifacts.some((artifact) => artifact.target === target), `missing target ${target}`);
}
for (const authority of requiredAuthority) assert(contract.host_owned_authority.includes(authority), `missing host authority ${authority}`);
for (const exclusion of excludedCatalogFields) assert(contract.excluded_from_catalog.includes(exclusion), `missing catalog exclusion ${exclusion}`);
assert(contract.relationship_projection.launchable_app === true, "Resume Builder must be launchable");
assert(contract.relationship_projection.provides_operations.length === 0, "Resume Builder should not provide operations in AL-001");
assert(contract.relationship_projection.requires_operations.length === 0, "Resume Builder should not require external capability providers in AL-002");

for (const file of [
  "src/index.ts",
  "src/workflow.ts",
  "src/chat-workspace.ts",
  "src/recovery-save.ts",
  "resources/main.html",
  "resources/inference-program.js",
  "resources/resume-template.md",
  "resources/resume-template-standard.md",
  "resources/fonts/LiberationSans-Regular.ttf",
  "test/workflow.test.ts",
  "test/inference-program.test.ts",
  "test/ui-resource.test.ts"
]) {
  assert(existsSync(resolve(file)), `missing extracted Resume Builder file: ${file}`);
}

const metadataPath = resolve("dist/local-dev/package-metadata.json");
if (existsSync(metadataPath)) {
  const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
  assert(metadata.package_id === contract.package_id, "metadata package_id mismatch");
  assert(metadata.publisher_id === contract.publisher_id, "metadata publisher_id mismatch");
  assert(metadata.package_version === contract.version, "metadata version mismatch");
  assert(metadata.release_channel === contract.release_channel, "metadata channel mismatch");
  assert(metadata.artifact_name === contract.artifact_name, "metadata artifact name mismatch");
  for (const target of ["docker_linux_x64", "desktop_windows_x64", "desktop_macos_universal"]) {
    assert(metadata.targets.includes(target), `metadata missing target ${target}`);
  }
}

console.log("PASS package contract: ai.braindrive.resume-builder@4.3.1");
