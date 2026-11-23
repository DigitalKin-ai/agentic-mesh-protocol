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

### Added — custom_app: `CustomAppService` (DEV-1012)

New package `custom_app/v1` (`custom_app_enums`, `custom_app_messages`, `custom_app_dto`,
`custom_app_service`). Purely additive: `buf breaking` passes against `main`. The SDK uses it for
the kin's custom app tools (DEV-1013) and the services-provider implements it (DEV-1014).

- Rules: user, organization and mission come from the task metadata, never from the payload. An
  app belongs to the user and the organization of the task that creates it, never to a mission: the
  mission only holds the "current app" pointer of the conversation, and `CustomApp.origin_mission_id`
  is a trace. No message points to a file of the files service, which belongs to a mission or a
  setup: a version carries no reference to its artefacts — an agent reads the sources file by file
  (`ReadCustomAppFile`), and the build is served to the browser by the HTTP API, never to an agent —
  and the theme has no logo. An app the caller cannot read answers
  `NOT_FOUND`, like an app that does not exist. Rights, visibility and deletion of an app are
  deliberately absent: they go through the HTTP API, so no gRPC path lets a kin share or delete an app.
- Enums: `CustomAppRight` (`READ`, `DATA_WRITE`, `FULL_EDIT`), `CustomAppOwnerKind` (`USER`,
  `ORGANIZATION`), `CustomAppFieldType` (`STRING`, `TEXT`, `NUMBER`, `BOOLEAN`, `DATE`, `COLOR`, `URL`,
  `SELECT`). Visibility reuses `common.v1.Visibility` (`PRIVATE` = granted rights only, `INTERNAL` =
  read access for the whole organization).
- Model: an app is a small project of code files (TSX) compiled by the build against a precompiled,
  versioned runtime, plus typed tables (they become the app database schema, PostgreSQL tables and
  `jsonb` keys) and a theme (design variables). The code is free text checked by the build (allowed
  imports, compilation, types): the protocol names no library nor component, so the runtime evolves
  without a protocol release.
- Enums: `CustomAppRight` (`READ`, `DATA_WRITE`, `FULL_EDIT`), `CustomAppOwnerKind` (`USER`,
  `ORGANIZATION`), `CustomAppFieldType` (`STRING`, `TEXT`, `NUMBER`, `BOOLEAN`, `DATE`, `COLOR`, `URL`,
  `SELECT`), `CustomAppScaffoldKind` (`LIST`, `FORM`, `DETAIL`). Visibility reuses
  `common.v1.Visibility` (`PRIVATE` = granted rights only, `INTERNAL` = read access for the whole organization).
- Messages: `CustomApp` (registry entry, with `caller_right` and `published_version`),
  `CustomAppField`, `CustomAppTable`, `CustomAppFileInfo` (`path`, `size`, `sha256`), `CustomAppTheme`
  (`variables`), `CustomAppStructure` (`tables`, `files`, `theme`,
  `runtime_version`, `draft_revision`), `CustomAppRoute` (`id`, `path`, `title`, `tables`, `shareable`,
  read from `src/routes.ts` by the build), `CustomAppVersion` (`version`, `runtime_version`, `routes`,
  `built_by`, `created_at`), `CustomAppRecord`,
  `CustomAppBuildError` (`path`, `line`, `column`, `message`), `CustomAppRuntime` (from the runtime
  manifest: `runtime_version`, `rules`, `imports`, `theme_variables`, `fonts`, `topics`, and `topic` +
  `detail` when a topic is asked for), and the outcomes `CustomAppResult`, `CustomAppRecordResult`.
  Added beyond the ticket's list, because the shape needs them: `CustomAppThemeVariable` (`name`,
  `value`; see below), `CustomAppBuildErrors` (a `oneof` cannot hold a repeated field),
  `CustomAppBuildResult` (`identifier` + `oneof` version / build errors / `OperationError`),
  `CustomAppRecordData` (a record to write: `id` empty = create), `CustomAppTags` (presence of the
  tags in a partial update), `CustomAppRuntimeImport`, `CustomAppRuntimeThemeVariable` and
  `CustomAppRuntimeResult`.
- `CustomAppTheme.variables` is `repeated CustomAppThemeVariable` (`name` = 1, `value` = 2) rather
  than the `map<string, string>` of the ticket: the Zod generator translates no rule on a map field
  (`UnsupportedRuleError`), and a list can be bounded and validated. The wire encoding is identical to
  a `map<string, string>`; the JSON form is a list of `{name, value}` instead of an object.
- RPCs — registry and current app: `CreateCustomApp` (optional `template`, absent = the starter of
  the runtime; the app becomes the current app), `GetCustomApp` (published structure, and the draft
  when asked for and `FULL_EDIT`), `ListCustomApps` (`results` + `bulk`), `SearchCustomApps` (ranked
  `repeated CustomApp results`, `limit` ≤ 50, no total nor offset, like
  `ContextService.SearchDocuments`), `UpdateCustomAppInfo` (partial update of `name`, `purpose`,
  `audience`, `tags`), `OpenCustomApp`, `GetCurrentCustomApp` (`result` absent = no current app).
- RPCs — draft structure, one operation (a file, a table or the theme) per call: `WriteCustomAppFile`,
  `EditCustomAppFile` (replaces a passage occurring exactly once), `DeleteCustomAppFile`,
  `SetCustomAppTable`, `RemoveCustomAppTable`, `SetCustomAppTheme`, `ScaffoldCustomAppFile` (a standard
  `LIST` / `FORM` / `DETAIL` screen generated server-side from a table; returns the path written), all
  `FULL_EDIT`; each returns the new `draft_revision` and takes an optional `expected_draft_revision`
  (a stale one fails with `ABORTED`; absent, the last write wins). `ReadCustomAppFile` and
  `ListCustomAppFiles` read the published version (`READ`) or, with `draft`, the draft (`FULL_EDIT`).
  `BuildCustomApp` (`FULL_EDIT`) returns the new `CustomAppVersion`, published at once, or the
  `CustomAppBuildError` list; a draft over 1 MB in total is one of these build errors, with an empty
  `path`. A build that cannot run returns an `OperationError` (documented on
  `CustomAppBuildResult.error`): `UNAVAILABLE` (builder busy, request not taken within 15 s; retry),
  `RESOURCE_EXHAUSTED` (a build already running on the app, or too many concurrent builds in the
  organization), `DEADLINE_EXCEEDED` (build stopped after 10 s), `NOT_FOUND`, `PERMISSION_DENIED`.
- RPCs — content: `ListCustomAppRecords` (`READ`), `UpsertCustomAppRecords` and `DeleteCustomAppRecords`
  (`DATA_WRITE`, at most 100 records, one `CustomAppRecordResult` per record + `bulk`).
- RPCs — runtime: `GetCustomAppRuntime` (optional `runtime_version`, absent = current; optional
  `topic`), open to every member of the organization, no app needed; returns a `CustomAppRuntimeResult`.
- Validation: `custom_apps:` ids (min 13, max 256); table, field and route names
  `^[a-z][a-z0-9_]{0,39}$`; file paths `^src/[a-zA-Z0-9_\-/]+\.(tsx|ts|css)$` (max 256), file content
  and edit passages ≤ 200 KB (`max_bytes: 204800`), at most 200 files per structure (the 1 MB total is
  checked server-side); `sha256` `^[0-9a-f]{64}$`; theme variable names `^[a-z][a-z0-9-]{0,63}$`,
  values ≤ 256 characters without `;`, `{`, `}`, `<`, `>` (`^[^;{}<>]*$`), at most 100 variables;
  `owner_id` `^(users|organizations):.+$`; `purpose` ≤ 1000; at most 20 tags of 64 characters;
  at most 50 routes per version; batches ≤ 100; search ≤ 50.
  CEL rules: `custom_app.chronology`, `custom_app_record.chronology`, `custom_app_field.select_options`,
  `custom_app_field.options_only_for_select`, `custom_app_table.unique_fields`,
  `custom_app_theme.unique_variables`, `custom_app_structure.unique_tables`,
  `custom_app_structure.unique_files`, `custom_app_version.unique_route_ids`,
  `custom_app_version.unique_route_paths`, `update_custom_app_info_request.not_empty`,
  `upsert_custom_app_records_request.unique_ids`.
- user_profile: `CheckResourceAccessRequest.resource` gains `custom_app_id = 6` (`custom_apps:`),
  allowed when the task may read the app. New `oneof` member: wire-compatible.

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
- `tools/zod/test` (custom_app): `PATTERN_SAMPLES` covers `^(users|organizations):.+$`,
  `^[a-z][a-z0-9_]{0,39}$`, `^src/[a-zA-Z0-9_\-/]+\.(tsx|ts|css)$`, `^[0-9a-f]{64}$`,
  `^[a-z][a-z0-9-]{0,63}$` and `^[^;{}<>]*$`; `PATTERN_BREAKERS` adds `a;b` and `</style>` (no
  variant broke `^[^;{}<>]*$`); `BASE_OVERRIDES` gives `CustomAppField` a valid base (no option on a
  non-SELECT field) for `custom_app_field.options_only_for_select`.
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
