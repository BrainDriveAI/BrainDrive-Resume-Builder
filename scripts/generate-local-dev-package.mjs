#!/usr/bin/env node
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const PACKAGE_ID = "ai.braindrive.resume-builder";
const PUBLISHER_ID = "ai.braindrive";
const ROUTE_KEY = "resume-builder";
const VERSION = "4.2.21";
const HOST_MIN_VERSION = "26.7.23";
const RELEASE_CHANNEL = "local-dev";
const ARTIFACT_NAME = `braindrive-resume-builder-${VERSION}-local.dev.bdapp`;
const RELEASE_ROOT = path.resolve("dist/local-dev/release", VERSION);

const REQUESTED_CAPABILITIES = [
  "career.context.read",
  "career.facts.read",
  "career.facts.propose",
  "career.facts.confirm",
  "resume.definitions.read",
  "resume.definitions.write",
  "resume.jobs.read",
  "resume.jobs.write",
  "resume.artifacts.register",
  "resume.export.request",
  "resume.operations.read",
  "app.inference.request",
];

const REQUESTED_INFERENCE_PURPOSES = [
  ["resume.interview-assist", 1],
  ["resume.general-draft", 1],
  ["resume.job-description-analyze", 1],
  ["resume.requirement-evidence-match", 1],
  ["resume.tailoring-plan", 1],
  ["resume.targeted-draft", 1],
  ["resume.revision-classify", 1],
  ["resume.revision-draft", 1],
  ["resume.guidance", 1],
  ["resume.strategy", 2],
  ["resume.craft-evaluate", 1],
  ["resume.craft-repair", 1],
];

const TEXT_RESOURCES = [
  ["payload/resources/agent-instructions.md", "agent-instructions.md"],
  ["payload/resources/interview-guide.md", "interview-guide.md"],
  ["payload/resources/recovery-guidance.md", "recovery-guidance.md"],
  ["payload/resources/resume-profile-template.md", "resume-profile-template.md"],
  ["payload/resources/resume-quality-standard.md", "resume-quality-standard.md"],
  ["payload/resources/resume-template-standard.md", "resume-template-standard.md"],
  ["payload/resources/resume-template.md", "resume-template.md"],
];

const FONT_RESOURCES = [
  ["payload/docker/fonts/LiberationSans-Bold.ttf", "fonts/LiberationSans-Bold.ttf"],
  ["payload/docker/fonts/LiberationSans-OFL.txt", "fonts/LiberationSans-OFL.txt"],
  ["payload/docker/fonts/LiberationSans-Regular.ttf", "fonts/LiberationSans-Regular.ttf"],
];

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function canonicalJson(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON does not support non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    if (entries.some(([, item]) => item === undefined)) throw new TypeError("Canonical JSON does not support undefined values");
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  throw new TypeError("Canonical JSON supports only JSON-compatible values");
}

function digest(bytes) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function canonicalInputDigest(value) {
  return digest(Buffer.from(canonicalJson(value), "utf8"));
}

function canonicalDocumentDigest(value) {
  return digest(Buffer.from(`${canonicalJson(value)}\n`, "utf8"));
}

function canonicalSignedBytes(domain, payload) {
  return `${domain}\n${canonicalJson(payload)}\n`;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function createStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x0021, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(entry.bytes.length, 18);
    local.writeUInt32LE(entry.bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, entry.bytes);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x031e, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x0021, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(entry.bytes.length, 20);
    central.writeUInt32LE(entry.bytes.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(((entry.executable ? 0o100755 : 0o100444) << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + entry.bytes.length;
  }
  const centralBytes = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, centralBytes, end]);
}

function rawPublicKey(publicKey) {
  const der = publicKey.export({ format: "der", type: "spki" });
  return Buffer.from(der).subarray(-32).toString("base64");
}

function signEnvelope(privateKey, domain, payload) {
  return sign(null, Buffer.from(canonicalSignedBytes(domain, payload), "utf8"), privateKey).toString("base64");
}

async function readResource(relativePath, binary = false) {
  const bytes = await readFile(path.resolve("resources", relativePath));
  return binary ? bytes : Buffer.from(bytes.toString("utf8"), "utf8");
}

function emptyObjectSchema() {
  return { type: "object", additionalProperties: false, properties: {}, required: [] };
}

function schemaResource(schemaId, schema) {
  return {
    schema_id: schemaId,
    schema_version: 1,
    content_digest: canonicalInputDigest(schema),
    schema,
  };
}

function action(actionId, kind, title, capabilityName, purposeId = null) {
  return {
    action_version: 1,
    action_id: actionId,
    kind,
    title,
    description: `${title} through the app-owned Resume Builder package contract.`,
    input_schema: schemaResource(`${actionId}.input.v1`, emptyObjectSchema()),
    result_schema: schemaResource(`${actionId}.result.v1`, {
      type: "object",
      additionalProperties: false,
      properties: {},
      required: [],
    }),
    confirmation: kind === "read" || kind === "inspect" ? "none" : kind === "export" ? "trusted_owner_confirmation" : "owner_confirmation",
    idempotency_policy: kind === "read" || kind === "inspect" ? "not_applicable" : "required",
    model_exposure: "available",
    required_capabilities: capabilityName ? [{ name: capabilityName, version: 1 }] : [],
    required_inference_purposes: purposeId ? [{ purpose_id: purposeId, version: purposeId === "resume.strategy" ? 2 : 1 }] : [],
  };
}

function buildPresentations(files) {
  const fileDigest = (filePath) => digest(files.get(filePath));
  const resource = (resourceId, role, title, packagePath, promptInclusion) => ({
    resource_version: 1,
    resource_id: resourceId,
    role,
    title,
    description: `${title} package resource.`,
    package_path: packagePath,
    media_type: "text/markdown",
    content_digest: fileDigest(packagePath),
    owner_editable: true,
    prompt_inclusion: promptInclusion,
  });
  return {
    presentation_set_version: 1,
    default_presentation_id: "just.chat",
    profiles: [
      {
        profile_version: 1,
        presentation_id: "just.chat",
        type: "chat_workspace",
        label: "Launch",
        description: "Build a Resume Profile and Resume in a chat workspace.",
        workspace_id: "resume.chat",
        owner_visibility: "primary",
      },
      {
        profile_version: 1,
        presentation_id: "structured.surface",
        type: "surface",
        label: "Structured Resume Builder",
        description: "Structured Resume Builder surface packaged with the app.",
        resource_uri: "ui://resume-builder/main",
        owner_visibility: "internal",
      },
    ],
    workspaces: [{
      workspace_version: 1,
      workspace_id: "resume.chat",
      title: "Resume Builder",
      description: "Chat-first Resume Builder workspace with Profile, Resume, and app-owned resources.",
      default_document_id: "conversation",
      empty_state: {
        empty_state_version: 1,
        heading: "Build your resume",
        description: "Start from career facts, an existing resume, or a target role.",
        cta_label: "Start",
        cta_message: "I want to build my resume.",
      },
      documents: [
        {
          document_version: 1,
          document_id: "conversation",
          role: "conversation",
          title: "Conversation",
          description: "Resume Builder chat.",
          editable: true,
          default_visibility: "primary",
          model_access: "read_write_draft",
          resource_id: null,
          data_binding_id: null,
          presentation: null,
        },
        {
          document_version: 1,
          document_id: "resume.profile",
          role: "source_document",
          title: "Your Resume Profile",
          description: "Reviewed resume source profile.",
          editable: true,
          default_visibility: "primary",
          model_access: "read_write_draft",
          resource_id: null,
          data_binding_id: "resume.profile.current",
          initial_content: {
            initial_content_version: 1,
            source: "package_file",
            package_path: "payload/resources/resume-profile-template.md",
            media_type: "text/markdown",
            content_digest: fileDigest("payload/resources/resume-profile-template.md"),
            seed_policy: "when_missing",
          },
          presentation: {
            presentation_version: 1,
            renderer: "markdown_document",
            chrome: "document",
            title: "resume-profile.md",
            subtitle: "Resume Profile",
            header_actions: [
              { type: "back_to_chat", label: "Back to chat" },
              { type: "app_action", action_id: "resume.create", label: "Create resume", delivery: "direct_action" },
              { type: "edit_document", label: "Edit" },
            ],
          },
        },
        {
          document_version: 1,
          document_id: "resume.document",
          role: "derived_document",
          title: "Your Resume",
          description: "Formatted resume derived from the current definition.",
          editable: false,
          default_visibility: "primary",
          model_access: "action_result",
          resource_id: null,
          data_binding_id: "resume.definition.current.general",
          initial_content: {
            initial_content_version: 1,
            source: "package_file",
            package_path: "payload/resources/resume-template.md",
            media_type: "text/markdown",
            content_digest: fileDigest("payload/resources/resume-template.md"),
            seed_policy: "when_missing",
          },
          presentation: {
            presentation_version: 1,
            renderer: "paper_document",
            chrome: "document",
            title: "resume.md",
            subtitle: "Resume",
            header_actions: [
              { type: "back_to_chat", label: "Back to chat" },
              { type: "app_action", action_id: "resume.export.pdf.request", label: "Export PDF", delivery: "direct_action", action_input: { format: "pdf", destination_intent: "new_download" } },
            ],
          },
        },
        ...[
          ["agent.instructions", "Agent Instructions", "payload/resources/agent-instructions.md"],
          ["interview.guide", "Interview Guide", "payload/resources/interview-guide.md"],
          ["quality.standard", "Resume Quality Standard", "payload/resources/resume-quality-standard.md"],
          ["template.standard", "Resume Template Standard", "payload/resources/resume-template-standard.md"],
          ["recovery.guidance", "Recovery Guidance", "payload/resources/recovery-guidance.md"],
        ].map(([resourceId, title, packagePath]) => ({
          document_version: 1,
          document_id: resourceId,
          role: "advanced_resource",
          title,
          description: "Owner-editable package resource override.",
          editable: true,
          default_visibility: "advanced",
          model_access: "read_reference",
          resource_id: resourceId,
          data_binding_id: `${resourceId}.owner`,
          initial_content: {
            initial_content_version: 1,
            source: "package_file",
            package_path: packagePath,
            media_type: "text/markdown",
            content_digest: fileDigest(packagePath),
            seed_policy: "when_missing",
          },
          presentation: {
            presentation_version: 1,
            renderer: "markdown_document",
            chrome: "document",
            title: `${title}.md`,
            subtitle: "Owner editable app instructions",
            header_actions: [
              { type: "back_to_chat", label: "Back to chat" },
              { type: "edit_document", label: "Edit" },
            ],
          },
        })),
      ],
      resources: [
        resource("agent.instructions", "agent_instructions", "Agent Instructions", "payload/resources/agent-instructions.md", "workspace_start"),
        resource("interview.guide", "interview_guide", "Interview Guide", "payload/resources/interview-guide.md", "workspace_start"),
        resource("quality.standard", "quality_standard", "Resume Quality Standard", "payload/resources/resume-quality-standard.md", "action_request"),
        resource("template.standard", "template_standard", "Resume Template Standard", "payload/resources/resume-template-standard.md", "action_request"),
        resource("recovery.guidance", "recovery_guidance", "Recovery Guidance", "payload/resources/recovery-guidance.md", "document_open"),
      ],
      context_requests: [
        {
          context_version: 1,
          context_id: "career.resume_context",
          kind: "career_context",
          title: "Career Context",
          description: "Owner career context available to Resume Builder.",
          required: false,
          max_bytes: 65536,
          freshness_policy: "session_snapshot",
          required_capabilities: [{ name: "career.context.read", version: 1 }],
        },
      ],
      actions: [
        action("resume.profile.read", "read", "Read Resume Profile", null),
        action("career.fact.propose", "write", "Propose Career Fact", "career.facts.propose"),
        action("career.fact.confirm", "write", "Confirm Career Facts", "career.facts.confirm"),
        action("resume.profile.update", "write", "Update Resume Profile", "resume.definitions.write"),
        action("resume.create", "render", "Create Resume", "resume.definitions.write", "resume.general-draft"),
        action("resume.export.pdf.request", "export", "Export PDF", "resume.export.request"),
        action("resume.state.read", "inspect", "Read Resume State", "resume.operations.read"),
      ],
    }],
  };
}

function runtimeServer(appHtml) {
  return `import http from "node:http";
import { randomUUID } from "node:crypto";
import { adjudicateResumeInference, planResumeAction, prepareResumeInference } from "./inference-program.js";

const token = process.env.BRAINDRIVE_APP_CONNECTION_TOKEN;
const host = "127.0.0.1";
const port = Number((process.env.BRAINDRIVE_ENDPOINT_BIND || "127.0.0.1:0").split(":").at(-1));
const appHtml = ${JSON.stringify(appHtml)};
const runtimeExports = new Map();
const runtimeExportTtlMs = 120000;

function send(response, id, result) {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ jsonrpc: "2.0", id, result }));
}

function pruneRuntimeExports() {
  const cutoff = Date.now() - runtimeExportTtlMs;
  for (const [id, entry] of runtimeExports.entries()) if (entry.created_at < cutoff) runtimeExports.delete(id);
  while (runtimeExports.size > 16) runtimeExports.delete(runtimeExports.keys().next().value);
}

function createExportBytesReference(input) {
  pruneRuntimeExports();
  const exportId = randomUUID();
  runtimeExports.set(exportId, { ...input, created_at: Date.now() });
  return exportId;
}

const server = http.createServer((request, response) => {
  if (request.headers.authorization !== "Bearer " + token) { response.writeHead(401).end(); return; }
  if (request.url === "/healthz") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", service: "resume-builder", app_id: process.env.BRAINDRIVE_APP_ID }));
    return;
  }
  if (request.method === "GET" && request.url?.startsWith("/runtime-exports/")) {
    pruneRuntimeExports();
    const url = new URL(request.url, "http://runtime.local");
    const exportId = decodeURIComponent(url.pathname.slice("/runtime-exports/".length));
    if (!/^[a-zA-Z0-9_.:@-]+$/.test(exportId)) { response.writeHead(400).end(); return; }
    const entry = runtimeExports.get(exportId);
    if (!entry) { response.writeHead(404).end(); return; }
    response.writeHead(200, { "content-type": entry.mediaType, "content-length": String(entry.bytes.length), "cache-control": "no-store", "x-braindrive-content-digest": entry.contentDigest });
    response.end(entry.bytes);
    return;
  }
  if (request.url !== "/mcp" || request.method !== "POST") { response.writeHead(404).end(); return; }
  let body = "";
  request.on("data", (chunk) => { body += chunk; if (body.length > 262144) request.destroy(); });
  request.on("end", () => {
    let message;
    try { message = JSON.parse(body); } catch { response.writeHead(400).end(); return; }
    if (message.method === "server/discover") {
      send(response, message.id, { supportedVersions: ["2026-07-28"], capabilities: { tools: { listChanged: false }, resources: { listChanged: false }, extensions: { "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } } }, _meta: { "io.modelcontextprotocol/ui": { version: "2026-01-26" }, "io.modelcontextprotocol/serverInfo": { name: "resume-builder", version: ${JSON.stringify(VERSION)} } } });
      return;
    }
    if (message.method === "resources/list") {
      send(response, message.id, { resultType: "complete", ttlMs: 0, cacheScope: "private", resources: [{ uri: "ui://resume-builder/main", name: "Resume Builder", title: "Resume Builder", description: "Sandboxed owner resume workflow", mimeType: "text/html;profile=mcp-app", size: Buffer.byteLength(appHtml), _meta: { "io.modelcontextprotocol/ui": { version: "2026-01-26" }, cachePolicy: "immutable_package_digest" } }] });
      return;
    }
    if (message.method === "resources/templates/list") { send(response, message.id, { resultType: "complete", ttlMs: 0, cacheScope: "private", resourceTemplates: [] }); return; }
    if (message.method === "resources/read" && message.params?.uri === "ui://resume-builder/main") {
      send(response, message.id, { resultType: "complete", ttlMs: 0, cacheScope: "private", contents: [{ uri: "ui://resume-builder/main", mimeType: "text/html;profile=mcp-app", text: appHtml, _meta: { "io.modelcontextprotocol/ui": { version: "2026-01-26" }, cachePolicy: "immutable_package_digest" } }] });
      return;
    }
    if (message.method === "tools/list") {
      send(response, message.id, { resultType: "complete", ttlMs: 0, cacheScope: "private", tools: [
        { name: "fixture.status", description: "Return Resume Builder runtime status", inputSchema: { type: "object", properties: {}, additionalProperties: false }, _meta: { ui: { visibility: ["app"] } } },
        { name: "app.actions.plan", description: "Plan an app-owned Resume Builder action", inputSchema: { type: "object", additionalProperties: true }, _meta: { ui: { visibility: ["model"] } } },
        { name: "app.inference.prepare", description: "Prepare an app-owned Resume Builder inference request", inputSchema: { type: "object", additionalProperties: true }, _meta: { ui: { visibility: ["model"] } } },
        { name: "app.inference.adjudicate", description: "Adjudicate an app-owned Resume Builder inference result", inputSchema: { type: "object", additionalProperties: true }, _meta: { ui: { visibility: ["model"] } } },
      ] });
      return;
    }
    if (message.method === "tools/call" && message.params?.name === "fixture.status") {
      send(response, message.id, { resultType: "complete", content: [{ type: "text", text: "Resume Builder ready", annotations: { audience: ["user"], priority: 1 } }], structuredContent: { ready: true, version: ${JSON.stringify(VERSION)} }, _meta: { "io.modelcontextprotocol/ui": { resourceUri: "ui://resume-builder/main", visibility: ["app"] } }, isError: false });
      return;
    }
    if (message.method === "tools/call" && message.params?.name === "app.actions.plan") {
      try { send(response, message.id, { resultType: "complete", content: [], structuredContent: planResumeAction(message.params.arguments, { exportByteDelivery: "runtime_reference", createExportBytesReference }), _meta: { ui: { visibility: ["model"] } }, isError: false }); }
      catch { response.writeHead(409, { "content-type": "application/json" }); response.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32602, message: "Installed app action planning failed" } })); }
      return;
    }
    if (message.method === "tools/call" && message.params?.name === "app.inference.prepare") {
      try { send(response, message.id, { resultType: "complete", content: [], structuredContent: prepareResumeInference(message.params.arguments), _meta: { ui: { visibility: ["model"] } }, isError: false }); }
      catch { response.writeHead(409, { "content-type": "application/json" }); response.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32602, message: "Installed app inference preparation failed" } })); }
      return;
    }
    if (message.method === "tools/call" && message.params?.name === "app.inference.adjudicate") {
      try { send(response, message.id, { resultType: "complete", content: [], structuredContent: adjudicateResumeInference(message.params.arguments), _meta: { ui: { visibility: ["model"] } }, isError: false }); }
      catch { response.writeHead(409, { "content-type": "application/json" }); response.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32602, message: "Installed app inference adjudication failed" } })); }
      return;
    }
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Method not found" } }));
  });
});

server.listen(port, host, () => process.stdout.write(JSON.stringify({ event: "resume_builder.ready" }) + "\\n"));
const stop = () => server.close(() => process.exit(0));
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
`;
}

function retentionPolicy() {
  return {
    retention_policy_version: 1,
    classes: [
      { retention_class: "runtime_authority", label: "runtime authority", description: "Runtime sessions, bridge authority, grants, and tokens.", uninstall_behavior: "remove", owner_controls: [], reinstall_access: "not_restored" },
      { retention_class: "verified_package", label: "app code", description: "Verified package references and unshared package bytes.", uninstall_behavior: "remove", owner_controls: [], reinstall_access: "not_restored" },
      { retention_class: "disposable_cache", label: "disposable cache", description: "Runtime cache and temporary app instance state.", uninstall_behavior: "remove", owner_controls: [], reinstall_access: "not_restored" },
      { retention_class: "app_storage", label: "app storage", description: "App-owned durable documents, state, and operation records.", uninstall_behavior: "retain", owner_controls: ["delete_after_uninstall", "export_after_uninstall", "archive_after_uninstall"], reinstall_access: "fresh_grant_required" },
      { retention_class: "artifact_records", label: "artifact metadata", description: "App artifact records retained for recovery and audit.", uninstall_behavior: "retain", owner_controls: ["delete_after_uninstall", "export_after_uninstall", "archive_after_uninstall"], reinstall_access: "fresh_grant_required" },
      { retention_class: "export_receipts", label: "export receipts", description: "Owner-visible receipts for mediated exports.", uninstall_behavior: "retain", owner_controls: ["delete_after_uninstall", "export_after_uninstall", "archive_after_uninstall"], reinstall_access: "fresh_grant_required" },
      { retention_class: "owner_exports", label: "owner exports", description: "Files the owner exported outside the app lifecycle.", uninstall_behavior: "outside_app_lifecycle", owner_controls: [], reinstall_access: "outside_app_lifecycle" },
      { retention_class: "lifecycle_tombstone", label: "lifecycle evidence", description: "Minimal install, uninstall, deletion, export, and archive evidence.", uninstall_behavior: "retain_minimal_tombstone", owner_controls: [], reinstall_access: "fresh_grant_required" },
    ],
  };
}

async function buildFiles() {
  const appHtml = await readResource("main.html");
  const files = new Map([
    ["payload/docker/index.js", Buffer.from(runtimeServer(appHtml.toString("utf8")), "utf8")],
    ["payload/docker/inference-program.js", await readResource("inference-program.js")],
    ["payload/ui/main.html", appHtml],
    ["provenance/build.jsonl", Buffer.from(`${canonicalJson({ builder: "braindrive-resume-builder-local-dev", package_id: PACKAGE_ID, version: VERSION, channel: RELEASE_CHANNEL })}\n`, "utf8")],
    ["sbom/cyclonedx.json", Buffer.from(`${canonicalJson({ bomFormat: "CycloneDX", specVersion: "1.6", version: 1, components: [] })}\n`, "utf8")],
  ]);
  for (const [packagePath, resourcePath] of TEXT_RESOURCES) files.set(packagePath, await readResource(resourcePath));
  for (const [packagePath, resourcePath] of FONT_RESOURCES) files.set(packagePath, await readResource(resourcePath, true));
  return files;
}

function buildManifest(files) {
  const fileRecords = [...files].map(([filePath, bytes]) => ({
    path: filePath,
    kind: "file",
    mode: filePath === "payload/docker/index.js" ? "executable" : "read_only",
    size_bytes: bytes.length,
    digest: digest(bytes),
  })).sort((a, b) => a.path.localeCompare(b.path));

  return {
    manifest_version: 2,
    app_id: PACKAGE_ID,
    publisher_id: PUBLISHER_ID,
    package_version: VERSION,
    catalog: {
      display_name: "Resume Builder",
      summary: "Build an owner-reviewed Resume Profile and Resume in a chat-first workspace.",
      icon: null,
      retention_summary: "Resume Builder retains career data, resume history, artifacts, exports, and lifecycle evidence after uninstall.",
    },
    archive: { format: "zip", profile: "braindrive-zip-v1", compression: "store", layout_version: 1, manifest_path: "manifest.json", undeclared_entries: "reject", links_and_device_nodes: "reject", max_file_count: 256, max_compressed_bytes: 67108864, max_uncompressed_bytes: 268435456 },
    files: fileRecords,
    platform_artifacts: [
      { target: "docker_linux_x64", os: "linux", architecture: "x64", runtime_kind: "packaged_node", entrypoint: "payload/docker/index.js" },
      { target: "desktop_windows_x64", os: "windows", architecture: "x64", runtime_kind: "packaged_node", entrypoint: "payload/docker/index.js" },
      { target: "desktop_macos_universal", os: "macos", architecture: "universal", runtime_kind: "packaged_node", entrypoint: "payload/docker/index.js" },
    ],
    compatibility: { app_contract: 1, host_min_version: HOST_MIN_VERSION, mcp_protocol: "2026-07-28", mcp_apps: { extension_id: "io.modelcontextprotocol/ui", version: "2026-01-26" }, data_contract_version: 4 },
    primary_resource: { resource_version: 1, uri: "ui://resume-builder/main", package_path: "payload/ui/main.html", mime_type: "text/html;profile=mcp-app", content_digest: digest(files.get("payload/ui/main.html")) },
    presentations: buildPresentations(files),
    requested_capabilities: REQUESTED_CAPABILITIES.map((name) => ({ name, version: 1 })),
    requested_inference_purposes: REQUESTED_INFERENCE_PURPOSES.map(([purpose_id, version]) => ({ purpose_id, version })),
    provenance_path: "provenance/build.jsonl",
    sbom_path: "sbom/cyclonedx.json",
    retention_policy: retentionPolicy(),
  };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${canonicalJson(value)}\n`, { encoding: "utf8", mode: 0o644 });
}

async function main() {
  const rootPair = generateKeyPairSync("ed25519");
  const releasePair = generateKeyPairSync("ed25519");
  const rootKeyId = "braindrive-app-root-resume-builder-local-dev-2026";
  const releaseKeyId = "braindrive-app-release-resume-builder-local-dev-2026";
  const publishedAt = new Date().toISOString();
  const nextUpdateAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await rm(RELEASE_ROOT, { recursive: true, force: true });
  await mkdir(RELEASE_ROOT, { recursive: true });

  const releaseKey = {
    key_version: 1,
    key_id: releaseKeyId,
    algorithm: "ed25519",
    public_key: rawPublicKey(releasePair.publicKey),
    not_before: "2026-01-01T00:00:00.000Z",
    not_after: "2036-01-01T00:00:00.000Z",
    status: "active",
    authorization: {
      signature_version: 1,
      domain_separator: "BrainDrive-App-Release-Key-v1",
      canonicalization: "braindrive-canonical-json-v1",
      signature_algorithm: "ed25519",
      signing_key_id: rootKeyId,
      signature: "",
    },
  };
  const releaseKeyAuthorizationPayload = { ...releaseKey };
  delete releaseKeyAuthorizationPayload.authorization;
  releaseKey.authorization.signature = signEnvelope(rootPair.privateKey, "BrainDrive-App-Release-Key-v1", releaseKeyAuthorizationPayload);

  const trustRoot = {
    trust_root_version: 1,
    trust_domain: "braindrive-app-release",
    root_key: { key_id: rootKeyId, algorithm: "ed25519", public_key: rawPublicKey(rootPair.publicKey), status: "active" },
    threshold: 1,
    release_keys: [releaseKey],
  };

  const files = await buildFiles();
  const manifest = buildManifest(files);
  const archive = createStoredZip([
    { name: "manifest.json", bytes: Buffer.from(`${canonicalJson(manifest)}\n`, "utf8"), executable: false },
    ...[...files].map(([name, bytes]) => ({ name, bytes, executable: name === "payload/docker/index.js" })),
  ]);
  const archiveDigest = digest(archive);
  const manifestDigest = canonicalDocumentDigest(manifest);
  const descriptorPayload = {
    descriptor_version: 2,
    manifest,
    manifest_digest: manifestDigest,
    archive: { media_type: "application/vnd.braindrive.app+zip", byte_length: archive.length, digest: archiveDigest },
    published_at: publishedAt,
  };
  const descriptor = {
    payload: descriptorPayload,
    signature: {
      signature_version: 1,
      domain_separator: "BrainDrive-App-Package-v1",
      canonicalization: "braindrive-canonical-json-v1",
      signature_algorithm: "ed25519",
      signing_key_id: releaseKeyId,
      signature: signEnvelope(releasePair.privateKey, "BrainDrive-App-Package-v1", descriptorPayload),
    },
  };
  const descriptorDigest = canonicalDocumentDigest(descriptor);
  const sourcePayload = {
    index_version: 2,
    sequence: 1,
    prior_index_digest: null,
    published_at: publishedAt,
    entries: [{
      app_id: PACKAGE_ID,
      publisher_id: PUBLISHER_ID,
      package_version: VERSION,
      descriptor_digest: descriptorDigest,
      archive_digest: archiveDigest,
      targets: ["docker_linux_x64", "desktop_windows_x64", "desktop_macos_universal"],
      sources: [
        { environment: "docker_dev", kind: "repository_fixture", descriptor_fixture_id: `${ROUTE_KEY}-${VERSION}-descriptor`, archive_fixture_id: `${ROUTE_KEY}-${VERSION}-archive` },
        { environment: "desktop_windows", kind: "release_https", descriptor_url: `https://releases.braindrive.ai/apps/${ROUTE_KEY}/${VERSION}.descriptor.json`, archive_url: `https://releases.braindrive.ai/apps/${ROUTE_KEY}/${VERSION}.bdapp` },
        { environment: "desktop_macos", kind: "release_https", descriptor_url: `https://releases.braindrive.ai/apps/${ROUTE_KEY}/${VERSION}.descriptor.json`, archive_url: `https://releases.braindrive.ai/apps/${ROUTE_KEY}/${VERSION}.bdapp` },
      ],
    }],
  };
  const sourceIndex = {
    payload: sourcePayload,
    signature: {
      signature_version: 1,
      domain_separator: "BrainDrive-App-Source-Index-v1",
      canonicalization: "braindrive-canonical-json-v1",
      signature_algorithm: "ed25519",
      signing_key_id: releaseKeyId,
      signature: signEnvelope(releasePair.privateKey, "BrainDrive-App-Source-Index-v1", sourcePayload),
    },
  };
  const revocationPayload = { revocation_version: 2, sequence: 1, prior_list_digest: null, issued_at: publishedAt, next_update_at: nextUpdateAt, entries: [] };
  const revocations = {
    payload: revocationPayload,
    signature: {
      signature_version: 1,
      domain_separator: "BrainDrive-App-Revocations-v1",
      canonicalization: "braindrive-canonical-json-v1",
      signature_algorithm: "ed25519",
      signing_key_id: releaseKeyId,
      signature: signEnvelope(releasePair.privateKey, "BrainDrive-App-Revocations-v1", revocationPayload),
    },
  };

  await writeFile(path.join(RELEASE_ROOT, ARTIFACT_NAME), archive, { mode: 0o644 });
  await writeJson(path.join(RELEASE_ROOT, "manifest.json"), manifest);
  await writeJson(path.join(RELEASE_ROOT, "descriptor.json"), descriptor);
  await writeJson(path.join(RELEASE_ROOT, "source-index.json"), sourceIndex);
  await writeJson(path.join(RELEASE_ROOT, "revocations.json"), revocations);
  await writeJson(path.join(RELEASE_ROOT, "trust-root.json"), trustRoot);
  await writeJson(path.resolve("dist/local-dev/package-metadata.json"), {
    package_id: PACKAGE_ID,
    publisher_id: PUBLISHER_ID,
    package_version: VERSION,
    release_channel: RELEASE_CHANNEL,
    artifact_name: ARTIFACT_NAME,
    release_root: `dist/local-dev/release/${VERSION}`,
    descriptor_digest: descriptorDigest,
    manifest_digest: manifestDigest,
    archive_digest: archiveDigest,
    source_index_digest: canonicalDocumentDigest(sourceIndex),
    revocation_digest: canonicalDocumentDigest(revocations),
    trust_root_digest: canonicalDocumentDigest(trustRoot),
    targets: ["docker_linux_x64", "desktop_windows_x64", "desktop_macos_universal"],
  });

  console.log(`PASS package ${PACKAGE_ID}@${VERSION}`);
  console.log(`archive ${ARTIFACT_NAME} ${archiveDigest}`);
  console.log(`descriptor ${descriptorDigest}`);
}

main().catch((error) => {
  console.error(`FAIL package ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
