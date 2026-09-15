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

### Added — ported from `feat/structure`

- setup: `visibility`, `documentation`, `structure`, `structure_key`, `ChangeVisibility`,
  `SetCurrentSetupVersion`; owner and organization resolved from the request context.
- storage / filesystem: server-side context kinds, `visibility`, `storage_id`, `files:` ids,
  listing filters (visibilities, record_id, prefix...).
- registry: `SearchSetups`, `GetSetup`, search-safe `SetupSummary` / `ModuleSummary`, `tags`, `documentation`.
- user_profile: `GetSetupSecret`, `GetSetupUserInfo`, `CheckResourceAccess`, `mission_cost`.
- module: `GetModuleUserInfo`.
- gateway: `AssociateTask`, `StartStream`, `Stream`, `SendSignal`.

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
  - 35 field-level `<response>.outcome` rules: each response holds the expected item kind or an
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
