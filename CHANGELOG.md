# Changelog

All notable changes to the Agentic Mesh Protocol are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Every change to the
protocol (proto files, validation rules, generators, tooling) is recorded under `[Unreleased]` in
the same change that introduces it, and moved under a version heading on release.
Breaking changes are flagged **BREAKING**.

## [Unreleased]

Branch `feat/validation-proto`, rebased on `feat/structure` (`6560d1f`).
Commits: `60b3eda` (January restructure, rebased), `d0282bd` (port + validation), `121d549` (validation policy).

### Summary

The protocol moves to a standardized API: one file layout per package, CRUD-named RPCs,
a uniform result/bulk response pattern, shared pagination, and `buf.validate` rules on every
field. The features added by `feat/structure` (gateway, visibility, documentation/structure,
search summaries, secrets, access checks...) are ported into this layout.

**BREAKING**: this is a wire, JSON and generated-code breaking change for every service except
`ModuleService` RPC names. Packages stay in `v1` for now; see [Open decisions](#open-decisions).

### Changed — file layout (**BREAKING** for generated imports)

Every package `agentic_mesh_protocol/<domain>/v1/` is split into:

| File | Content |
| --- | --- |
| `<domain>_enums.proto` | enums of the domain |
| `<domain>_messages.proto` | domain objects and the `<Domain>Result` outcome message |
| `<domain>_dto.proto` | `<Rpc>Request` / `<Rpc>Response` messages |
| `<domain>_service.proto` | service definition |

| Before (`feat/structure`) | After |
| --- | --- |
| `cost/v1/cost.proto` | `cost_enums`, `cost_messages`, `cost_dto` |
| `filesystem/v1/filesystem.proto` | `filesystem_enums`, `filesystem_messages`, `filesystem_dto` |
| `gateway/v1/gateway.proto` | `gateway_enums`, `gateway_messages`, `gateway_dto` |
| `module/v1/information.proto`, `lifecycle.proto`, `monitoring.proto` | `module_enums`, `module_messages`, `module_dto` |
| `registry/v1/registry_enums.proto`, `registry_models.proto`, `registry_requests.proto` | `registry_messages`, `registry_dto` (enums moved to `module`, `setup`, `common`) |
| `setup/v1/setup.proto` | `setup_enums`, `setup_messages`, `setup_dto`, `setup_version_dto` |
| `storage/v1/data.proto` | `storage_enums`, `storage_messages`, `storage_dto` |
| `user_profile/v1/user_profile.proto` | `user_profile_messages`, `user_profile_dto` |

New shared packages:

- `pagination/v1` — `PaginationRequest` (order, descending, limit 1–100, offset), `PaginationResponse`,
  `BulkResponse` (total_processed, total_failed, pagination) and `OperationError` (code, message).
- `common/v1` — `Visibility` (`VISIBILITY_UNSPECIFIED`, `PUBLIC`, `PRIVATE`, `INTERNAL`), replacing the
  per-package copies of setup, storage, filesystem and registry.

### Changed — response pattern (**BREAKING**)

- A single-item RPC returns `<Domain>Result result`: an `identifier` and a required
  `oneof outcome` holding the item or an `OperationError`. The `success` flags are removed.
- A listing or batch RPC returns `repeated <Domain>Result results` and a `BulkResponse bulk`.
- Listing requests take an optional `PaginationRequest pagination` instead of `limit` / `offset` /
  `list_size` / `sort_by` fields.

### Changed — RPCs (**BREAKING**)

| Service | Before | After |
| --- | --- | --- |
| CostService | `AddCost` | `CreateCost` |
| CostService | `GetCost`, `GetCosts` | `ListCosts` (filter by names / types / setup versions) |
| CostService | `GetCostConfig` | `ListCostConfigs` |
| FilesystemService | `GetFiles` | `ListFiles` |
| StorageService | `StoreRecord`, `ReadRecord`, `RemoveRecord`, `RemoveCollection` | `CreateRecord`, `GetRecord`, `DeleteRecord`, `DeleteCollection` |
| SetupService | `ListSetupVersions`, `SetCurrentSetupVersion` | moved to the new `SetupVersionService` |
| RegistryService | `GetSetup` → `SetupDescriptor`, `GetModule` → `ModuleDescriptor` | return `GetSetupResponse` / `GetModuleResponse` |
| GatewayService | `Stream(stream StreamServer) returns (stream StreamClient)` | `Stream(stream StreamRequest) returns (stream StreamResponse)` |
| GatewayService | `SendSignal(ClientSignalRequest)` | `SendSignal(SendSignalRequest)` |

Added RPCs: `SetupService.ListSetups`; `SetupVersionService.CreateSetupVersion`, `GetSetupVersion`,
`UpdateSetupVersion`, `DeleteSetupVersion`; `RegistryService.GetModuleStatus`.
`ModuleService` keeps its RPC names.

### Changed — messages and enums per domain (**BREAKING**)

**setup**
- `SetupStatus` renumbered and shared with the registry: `SETUP_STATUS_UNSPECIFIED = 0`, `DRAFT = 1`,
  `WAITING_FOR_APPROVAL = 2`, `READY = 3`, `PAUSED = 4`, `FAILED = 5`, `ARCHIVED = 6`,
  `NEEDS_CONFIGURATION = 7`, `CONFIGURATION_FAILED = 8`, `CONFIGURATION_SUCCEEDED = 9`, `VALIDATING = 10`
  (DRAFT used to be 0).
- `Setup`: `organisation_id` → `organization_id` (`organizations:`), `visibility` uses `common.v1.Visibility`.
- `SetupVersion`: `creation_date` → `created_at`, carries `structure`.
- New `SetupRevision` (`content` required, `structure`, `documentation`): what a version is cut from.
- `CreateSetupRequest`: `name`, `revision`, optional `module_id`, `visibility`.
- `UpdateSetupRequest`: partial update — optional `name`, optional `status`, optional `revision`
  (cuts a new version), `set_as_current`.
- `GetSetupRequest`: `version` and `structure_key` are `optional`.

**registry**
- `registry_enums.proto` removed: `ModuleStatus` / `ModuleType` → `module.v1`, `SetupStatus` → `setup.v1`,
  `Visibility` → `common.v1`, `SortBy` → `PaginationRequest.order` + `descending`.
- `ModuleType`: `MODULE_TYPE_UNSPECIFIED`, `ARCHETYPE`, `TOOL_MODULE`, `SERVICE`.
- `ModuleDescriptor.module_type` and `RegisterModuleRequest.module_type` → `type`.
- `SetupDescriptor.card_id` is `optional`.
- Search requests take `pagination`; search responses return `results` (`SetupSummary` / `ModuleSummary`)
  and `bulk` (the total is `bulk.pagination.total_count`).

**module**
- Responses wrap their schema / output in `ModuleResult result`.
- `StartModuleResponse`: `job_id` + `result` (output or error); `success` and `output` removed.
- `StopModuleResponse`: `result` holds the stopped `Job` (`job_id`, `JobStatus`).
- `ConfigSetupModuleRequest` fields renumbered (`mission_id = 1`, `setup_version = 2`, `content = 3`).
- `monitoring.proto` (`JobInfo`, job `ModuleStatus`) removed, replaced by `Job` / `JobStatus`.

**storage**
- `ContextStorage` → `StorageContext` (`STORAGE_CONTEXT_UNSPECIFIED`, `MISSIONS`, `SETUP_VERSIONS`, `USERS`, `ORGANIZATIONS`).
- `DataType` zero value → `DATA_TYPE_UNSPECIFIED`.
- `StorageRecord`: `creation_date` / `update_date` → `created_at` / `updated_at`, fields renumbered.
- `GetRecordRequest.storage_id` is `optional`; `ListRecordsRequest.record_id` is `optional`.
- `DeleteCollectionRequest.record_id` removed (use `DeleteRecord`); the response reports a `bulk`.

**filesystem**
- `ContextFile` → `FileContext` (`FILE_CONTEXT_UNSPECIFIED` = attached to no mission nor setup).
- `FileType` / `FileStatus` values lose their prefix (`DOCUMENT`, `IMAGE`..., `UPLOADING`, `ACTIVE`...).
- `File`: `file_id` → `id`, `file_type` → `type`, `file_url` → `url`, adds `created_at` / `updated_at`.
- `FileFilter`: `file_ids` → `ids`, `file_types` → `types`, nested `context` removed.
- `UploadFileData.file_type` → `type`.
- `UpdateFileRequest`: partial update, every field `optional` (absent = unchanged).
- `ListFilesRequest` / `DeleteFilesRequest`: `filters` → `filter`; `list_size` / `offset` / `order` → `pagination`.

**cost**
- `CostType` zero value → `COST_TYPE_UNSPECIFIED`.
- `Cost.cost_type` and `CostConfig.cost_type` → `type`; `Cost` / `CreateCostRequest` fields renumbered.
- `ListCostsResponse.total_cost`: sum of every matching cost, ignoring pagination.

**user_profile**
- `UserProfile`: `organisation_id` → `organization_id` (`organizations:`),
  `creation_date` / `update_date` → `created_at` / `updated_at`.
- `Metadata` message removed (unused).
- `CheckResourceAccessRequest`: `resource_type` + `resource_id` replaced by a required
  `oneof resource` of typed ids (`setup_id`, `module_id`, `mission_id`, `storage_id`, `file_id`);
  `ResourceType` removed.

**gateway**
- Stream frames renamed after their real direction: `StreamServer` → `StreamRequest`
  (`seq` → `from_seq`), `StreamClient` → `StreamResponse` (`from_seq` → `seq`).
  Field numbers and types are unchanged, so the frames stay wire-compatible.
- `ClientSignalRequest` / `ClientSignalResponse` → `SendSignalRequest` / `SendSignalResponse`.
- `SignalAction` replaced by a required `oneof signal`: `CancelSignal` (`task_id` required) or
  `InvalidateSignal` (`CacheScope`: `ALL`, `CHANNELS`, `MODELS`, `SETUP`, `TOOLS`, `SHARED`).

**context** — the `ContextService` (`37d34aa`, merged into `main` alongside this branch) aligned
on the conventions above:
- Files: `context_models.proto` → `context_messages.proto`, `context_requests.proto` → `context_dto.proto`.
- RPC `Search(SearchRequest) returns (SearchResponse)` →
  `SearchDocuments(SearchDocumentsRequest) returns (SearchDocumentsResponse)`.
- `Modality` values lose their prefix: `MODALITY_TEXT` → `TEXT`, `MODALITY_IMAGE` → `IMAGE`,
  `MODALITY_PAGE` → `PAGE`, `MODALITY_SLIDE` → `SLIDE`, `MODALITY_TABLE` → `TABLE`,
  `MODALITY_AUDIO` → `AUDIO`, `MODALITY_VIDEO` → `VIDEO` (numbers unchanged).
- `SearchDocumentsRequest.limit` unchanged: `int32`, 0 to 50, 0 = server default (10).
- Deliberate exception to the response pattern: `SearchDocumentsResponse` keeps `repeated Citation
  results` (at most 50), with no `ContextResult` and no `BulkResponse`, and the request takes no
  `PaginationRequest`. A search is a read over a ranked index, not a batch: an unreadable document
  is not returned (no per-item error), the total number of matches cannot be computed without
  scanning the index, and an offset over results fused by rank (RRF) is not stable between calls
  (the Context Platform `POST /v1/context/search` takes `query`, `limit`, `sources` only).
- Validation: `Citation.document_id` required (max 256), `title` max 1024, `snippet` max 65536,
  `score` finite, `source` required and snake_case (`^[a-z][a-z0-9_]*$`, max 64), `source_url` max 2048,
  `modality` required (`defined_only`, not UNSPECIFIED); `SearchDocumentsRequest.sources` items snake_case (max 64).

### Added — ported from `feat/structure`

- setup: `visibility`, `documentation`, `structure`, `structure_key`, `ChangeVisibility`,
  `SetCurrentSetupVersion`; owner and organization resolved from the request context.
- storage / filesystem: server-side context kinds, `visibility`, `storage_id`, `files:` ids,
  listing filters (visibilities, record_id, prefix...).
- registry: `SearchSetups`, `GetSetup`, search-safe `SetupSummary` / `ModuleSummary`, `tags`, `documentation`.
- user_profile: `GetSetupSecret`, `GetSetupUserInfo`, `CheckResourceAccess`, `mission_cost`.
- module: `GetModuleUserInfo`.
- gateway: `AssociateTask`, `StartStream`, `Stream`, `SendSignal`.

### Added — registry schemas at registration

- registry: `RegisterModuleRequest` carries the module schemas served by `ModuleService`, except
  the user-info schema: `input_schema` (7), `select_input_schema` (8), `output_schema` (9),
  `setup_schema` (10), `secret_schema` (11), `config_setup_schema` (12), `cost_schema` (13), all
  `google.protobuf.Struct`, each `required`: a module that declares no such schema sends an empty
  object, matching the schemas `ModuleDescriptor` already requires. New tags, so the wire stays
  compatible, but a registry enforcing protovalidate refuses a registration that omits any of them.

### Added — setup ownership

- setup: `SetupService.ChangeOwnership` transfers a setup to another user —
  `ChangeOwnershipRequest` (`setup_id`, `email` of the new owner: required, a valid email of at
  most 254 characters) returns `ChangeOwnershipResponse` (`SetupResult result` holding the Setup
  with its new owner, or an `OperationError`).

### Added — graph service (`graph/v1`)

New package `agentic_mesh_protocol.graph.v1` (DEV-986): named RDF graphs with server-side ACL,
compare-and-set versions, SPARQL gates and bounded SPARQL. Files: `graph_enums`, `graph_messages`,
`graph_dto`, `graph_service`, `graph_admin_dto`, `graph_admin_service`.

- `GraphService` (26 RPCs): `CreateGraph`, `GetGraph`, `ListGraphs`, `DropGraph`; `ApplyPatch`,
  `ApplyBatch`, `Validate`; `Query` (server stream), `RegisterQueries`, `RunNamedQuery` (server
  stream), `GetQuerySet`, `DiffVersions` (server stream); `Import` (client stream), `Export`
  (server stream); `Snapshot`, `ListVersions`, `RestoreVersion`; `PinOntology`, `GetOntology`,
  `RegisterGates`, `ListGates`, `SetGraphRules`; `GetGraphAcl`, `SetGraphAcl`,
  `SetGraphResponsible`, `ListAclHistory`.
- `GraphAdminService` (internal, never registered in the services provider, gRPC-status errors):
  `PurgeContext`, `PurgeOrganization`, `ReleaseUserGraphs` (departure rule), `RebuildIndex`,
  `GetShardHealth`, `AdoptStorageGraph`.
- Responses: every `GraphService` response is `oneof outcome { <result>; GraphError error }`, the
  response pattern of the other packages with `GraphError` in place of `OperationError`. Refusals
  come back in-band with an OK status; gRPC statuses stay for transport and infrastructure
  failures (including `SHARD_UNAVAILABLE` and `GRAPH_SUSPECT`, sent as `UNAVAILABLE` so the SDK
  retries them and counts them in its circuit breaker) and for invalid requests. Streams end with a
  trailer or a `GraphError` frame. The SDK maps `GraphError.reason` to its client exceptions
  (`GraphError` and `OperationProblem` carry no tool-specific field). Result messages: `CreateGraphResult`,
  `GraphDetails`, `GraphPage`, `DropResult`, `BatchResult`, `ValidationResult`, `QuerySet`,
  `SnapshotResult`, `VersionPage`, `PinOntologyResult`, `OntologyDocument`, `GateSet`,
  `AclHistoryPage`.
- Scopes: `USERS` (the user-organization pair), `ORGANIZATIONS`, `SETUP_VERSIONS`. No `MISSIONS`
  scope (tag 1 reserved): a graph is never tied to a mission, what a kin writes for a mission goes
  into the user's personal graph. A graph is named by (context, organization, `graph_id`).
  `SETUP_VERSIONS` graphs are written by the setup owner into the current version (`setup_id`);
  past versions are read-only (`setup_version_id`).
- Rights are checked **per action** (`GraphAction`: `VIEW`, `VIEW_CURRENT`, `EDIT`,
  `SET_CURRENT_VERSION`, `ARCHIVE`, `GRANT`, `SET_RULES`; `USE` removed, tag 2 reserved), never per
  level; holding one action implies no other. The matrix per scope is in the `GraphScope` comments:
  `VIEW_CURRENT` (current state only) is what another organization holds on a PUBLIC or shared
  setup; ACL entries never grant `GRANT`, `ARCHIVE`, `SET_CURRENT_VERSION` or `SET_RULES`; a
  `role` subject matches exactly; `org_id` is always the graph's organization.
  `GraphInfo.caller_actions` lists the caller's actions. Visibility can only be chosen for a
  `USERS` graph (CEL `*.visibility_users_only`), never `PUBLIC` (CEL `*.users_not_public`).
- ACL: single `responsible_user_id`; `AclEntry` with `subject` as `oneof { user_id, org_id, role }`,
  server-stamped `granted_by` / `granted_at` / `state` (`ENTRY_ACTIVE` / `ENTRY_REVOKED`, never
  deleted) / `origin` (`MANUAL`, `DEPARTURE_RULE`, `DELEGATION`) / `origin_id`. `GraphAcl` carries
  the active entries plus the most recent history; `ListAclHistory` pages through all of it.
  `SetGraphAcl` and `SetGraphResponsible` take an `idempotency_key`.
- Departure rule (`ReleaseUserGraphs`): leaving an organization pseudonymizes nothing; PRIVATE
  personal graphs are purged; INTERNAL ones become organization graphs named
  `<graph_id truncated to 241>.from.<8 random [a-z0-9]>` (random, never a hash of the user id, a new
  draw on collision); graphs the user was responsible for go to the oldest admin, or the oldest
  remaining member; entries naming the user are revoked (`DEPARTURE_RULE`). Account deletion
  applies the same rule, then pseudonymizes every trace (D9).
- Reads: `ListGraphs` returns the **graph map** (every readable graph of every responsible user,
  metadata and optional `GraphStats` with the top classes and predicates, never the triples).
  `Query` / `RunNamedQuery` read a closed dataset: named graphs (`DatasetGraphs`, at most 16,
  optional per-graph `at_version`) or a `GraphFilter` over the readable graphs (at least one scope,
  narrowed by `graph_uids` from the map, current versions, capped by
  `GraphLimits.max_dataset_graphs` (at most 100) / `max_dataset_triples`, else `DATASET_TOO_LARGE`,
  never a partial result). `GRAPH ?g`
  binds the `graph_iri` listed in `QueryHeader.graphs_read`. `page_token` freezes the versions
  read across pages. `DiffVersions` streams the net difference between two versions.
- Writes: `ApplyBatch` writes 2 to 16 distinct, unrelated graphs all or nothing (CEL
  `apply_batch.distinct_graphs`), with a shared `commit_id` and at most 1 000 operations for the
  whole batch. Every write carries an optional `WriteProvenance`. An idempotency key is recorded
  once a commit is attempted; a write refused before that can be sent again with the same key.
  `GraphStatus.SUSPECT`: commit outcome unknown, writes refused until reconciled.
- Gates: `severity`, `scope_class` (`LOCAL` / `PATH` / `GLOBAL`), `budget_ms`, `sparql_sha256`; the
  receipt (`evaluated_at`, ontology and gate-set shas, stored `call_gates`) makes a verdict
  replayable; `ListGates` is paged, lists the gates in effect on a graph and fetches gates by
  `sparql_sha256`. `SetGraphRules` binds another ontology and/or gate set (or `clear_gate_set`)
  after a whole-graph audit and mints a `RULES` version; the schema mode never changes in place.
- Sizes, so that every response fits an LLM's context: listings paginated (`ListGates`,
  `GetQuerySet` and `ListGraphs` with stats at most 50 a page, `ListVersions` with receipts at most
  10); SPARQL texts at most 16 KiB; a literal at most 64 KiB; a patch at most 1 000 operations or
  256 KiB of SPARQL Update (bulk through `Import`); gate reports under 256 KiB
  (`GateReport.truncated`). The SDK refuses a request over `GraphLimits.max_request_bytes` (at most
  3.5 MiB) with `PATCH_TOO_LARGE` before sending it.
- No `map` fields; no RDF 1.2 triple term (`Term` tag 4 reserved, so `Term` is not recursive); an
  empty `Term{}` never acts as a bound term (CEL `triple.*`, `triple_pattern.*`, `replace_values.*`,
  `binding.value_bound`).
- Validation follows the conventions of every package: prefixed ids with `min_len`, bounds on every
  output field, `optional` for every absent-able scalar.

### Added — organization role

- common: `OrgRole` (`ORG_ROLE_UNSPECIFIED`, `ORG_ADMIN`, `ORG_MEMBER`).
- user_profile: `UserProfile.org_role` (12), server-derived.

### Added — validation

Every field carries `buf.validate` rules, checked by protovalidate (Python) and by the generated
Zod schemas (TypeScript). The conventions are documented in `CLAUDE.md` (Validation Rules).

- IDs: standard `prefix` + `min_len` + `max_len: 256` rules (`modules:`, `jobs:`, `setups:`,
  `setup_versions:`, `missions:`, `users:`, `organizations:`, `files:`, `storage:`, `cards:`);
  gateway task ids match `^[A-Za-z0-9_:.-]+$`.
- Bounds on every string (names 255, documentation 300, versions 128, tags 64, ...) and every
  repeated field; every double is `finite`; enums are `defined_only`.
- Dependencies between fields modeled by the message shape: `SetupRevision`,
  `SendSignalRequest.signal`, `CheckResourceAccessRequest.resource`.
- CEL only where no standard rule exists, always with a custom `id` and `message`:
  - 20 message-level rules: chronology (`created_at <= updated_at`), filter ranges, subscription
    period, empty partial updates, `set_as_current` without revision, file size vs content,
    unique names in upload and cost-config batches, `total_failed <= total_processed`,
    `remaining <= total`, registry sort keys, targeted file deletion;
  - 36 field-level `<response>.outcome` rules: each response holds the expected item kind or an
    `OperationError` (e.g. a `GetSetupResponse` cannot hold a `SetupVersion`).

### Fixed

- Rules that rejected valid values in the January draft: `required` on booleans (forced `true`),
  every filter field mandatory, `cost > 0` (free usage refused), `Subscription.start` in the future,
  `created_at < updated_at` (an unmodified record failed), `address` validated as a URI instead of a host.
- Rules from `feat/structure` that rejected proto3 defaults: `limit >= 1` on an absent limit,
  `prefix` on optional empty ids, `min_len` on optional renames, `required` on scalars whose zero
  value is legitimate, file context `UNSPECIFIED` (accepted by the backend).
- `OperationError.code` must be an upper snake case code; `outcom` oneof typo → `outcome`.

### Changed — tooling

- `tools/zod/test` (differential test): samples for the graph patterns, base overrides for the
  graph messages whose rules span several fields (`GraphRef`, `ListGraphsRequest`, `Triple`,
  `TriplePattern`, `ReplaceValues`, `Binding`, `PatchBody`, `DiffVersionsRequest`,
  `ApplyBatchRequest`, `SetGraphRulesRequest`, and `visibility = 0` for the five messages with a
  visibility), mutations for `literal.direction_needs_language` and `list_graphs_request.stats_page_size`,
  and mutations for `*.users_not_public` (`CreateGraphRequest`, `ApplyPatchRequest`,
  `ImportHeader`, `SetGraphAclRequest`, `AdoptStorageGraphRequest`).
- `tools/zod` (Zod generator): supports `ignore` (`IGNORE_IF_ZERO_VALUE`, `IGNORE_ALWAYS`),
  applies `defined_only` canonically (every declared value, UNSPECIFIED included, on fields and
  repeated items), and translates `has(this.a) || has(this.b)` CEL field rules into a real refine
  carrying the custom message.
- `tools/zod` (Zod generator), **BREAKING** for the generated schemas (stricter; five inferred types
  change): a schema now accepts exactly what protovalidate accepts, on the ts-proto shape it validates
  (a `*Schema.parse` is as strict as the Python client's protovalidate).
  - CEL: a CEL parser and type checker replace the regex matcher (whose unknown expressions became a
    refine accepting everything). The 20 message-level rules of `proto/` (`file.chronology`,
    `bulk_response.failed_within_processed`, `update_setup_request.not_empty`...) run in a
    `.superRefine()` on the object; field and `repeated.items` rules run on their value.
  - oneof: `(buf.validate.oneof).required` is enforced (`FileResult`, `StorageResult`,
    `SendSignalRequest` accepted an empty outcome / signal); two members set, which the ts-proto shape
    allows and the wire does not, are refused.
  - `required` follows protovalidate: a non-empty string / bytes / list / map, a non-zero number or
    enum, a present message (`File.name: ""` was accepted).
  - An absent property stands for its proto3 zero value: it is optional only when that value passes the
    field rules. **BREAKING** (inferred types): `CostConfig.rate`, `UploadFilesRequest.files`,
    `PaginationRequest.limit`, `RegisterModuleRequest.port` and `ModuleDescriptor.port` become required.
  - Formats and bounds: string lengths count code points, as CEL `size()` does (they counted UTF-16
    units); `uri`, `uri_ref` and `email` use protovalidate's RFC 3986 / HTML algorithms (`uri` used
    zod's WHATWG `.url()`, `uri_ref` was dropped); `pattern` also applies to an empty string; numeric
    ranges follow protovalidate (exclusive ranges, NaN); a double without `finite` accepts NaN and ±Inf.
  - ts-proto shape: an int64 string must be a decimal within int64 (a malformed one made a refine
    throw instead of failing), an int32 / uint32 must fit its type.
  - A rule the generator cannot translate faithfully fails the generation (`UnsupportedRuleError`):
    unsupported formats (`tuuid`, `ip_prefix`...), timestamp / duration / map rules, CEL outside the
    compiled subset (`now`, strings extension...).
  - Error messages read `<rule_id>: <message>`, the protovalidate id and text.
  - The runtime helpers are emitted once as `gen/typescript/zod_rules.ts`; the zod plugin runs with
    `strategy: all` in `buf.gen.ts.yaml`.
- `tools/zod/test`: differential test of the generated schemas against `@bufbuild/protovalidate`
  (`npm test`, workflow `.github/workflows/zod.yml`). Every message of `gen/descriptor.bin` and of the
  test fixtures is validated by both on thousands of variants (a valid value, then each field mutated
  to break its rules), on the decoded ts-proto shape and on that shape without its zero values; a
  disagreement, or a declared rule no variant breaks, fails the test. The fixtures also cover the
  rule kinds `proto/` does not use yet, and the rules the generator must refuse.
- `tools/zod` (Zod generator): `repeated.unique` / CEL `unique()` treat a NaN as distinct from every
  item, itself included, as protovalidate 1.3.0 does (`[NaN]` and `[NaN, NaN]` were refused).
  `@bufbuild/protovalidate` dev dependency `^1.2.0` → `^1.3.0`: the lockfile is not committed, so CI
  resolved 1.3.0 and the differential test failed on `zodtest.v1.PresenceCases.unique_doubles`.
- `tools/zod/test`: `PATTERN_SAMPLES` covers `^[a-z][a-z0-9_]*$` (context sources).
- `package.json`: `test`, `test:zod` and `test:zod:fixtures` scripts; `@bufbuild/protovalidate`
  dev dependency.
- `proto/buf.yaml`: adds the `PROTOVALIDATE` lint rule; drops the lint exceptions no longer needed
  (only `ENUM_VALUE_PREFIX` remains).
- `taskfile.yml`: replaces `Taskfile.yml`; `version:breaking` now runs on `proto/` (it used to pick
  up the `.proto` files of `node_modules`).
- `CLAUDE.md`: file layout, response pattern, services, validation conventions, changelog rule.

### Migration notes

- **SDK (Python)**: imports move to the new files (`setup_pb2` → `setup_dto_pb2` / `setup_messages_pb2`...),
  every service client and the module / gateway servicers must follow the renamed RPCs, the result /
  bulk responses and the partial-update requests. Planned as the next step.
- **Backend (TypeScript)**: same renames; the Zod schemas enforce every rule (field, outcome,
  oneof and message-level CEL rules), so hand-written checks of the message rules become redundant.
  Replies that break a rule (an empty required string, a result without outcome, a reversed
  chronology...) now fail `*ResponseSchema`, as they fail the Python client.
- **Service APIs (Python package)**: regenerate from this branch and publish a new version.

### Open decisions

- The API is wire-breaking against `main` while packages stay in `v1`: the CI `buf breaking` check
  fails until the packages move to `v2` (or the check is waived for this release).
