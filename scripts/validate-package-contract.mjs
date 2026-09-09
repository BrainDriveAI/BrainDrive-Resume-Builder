#!/usr/bin/env node
import { readFileSync } from "node:fs";
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
assert(contract.version === "0.1.0", "unexpected version");
assert(contract.artifact_name === "braindrive-resume-builder-0.1.0-local.dev.bdapp", "unexpected artifact_name");
assert(contract.manifest_semantics.manifest_version === 2, "manifest_version must be 2");
assert(contract.manifest_semantics.package_profile === "braindrive-package-v2", "unexpected package profile");
for (const authority of requiredAuthority) assert(contract.host_owned_authority.includes(authority), `missing host authority ${authority}`);
for (const exclusion of excludedCatalogFields) assert(contract.excluded_from_catalog.includes(exclusion), `missing catalog exclusion ${exclusion}`);
assert(contract.relationship_projection.launchable_app === true, "Resume Builder must be launchable");
assert(contract.relationship_projection.provides_operations.length === 0, "Resume Builder should not provide operations in AL-001");
assert(contract.relationship_projection.requires_operations.length === 0, "Resume Builder should not require operations in AL-001");

console.log("PASS package contract: ai.braindrive.resume-builder");
