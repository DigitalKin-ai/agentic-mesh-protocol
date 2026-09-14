# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

The **Agentic Mesh Protocol** is a gRPC-based protocol specification for multi-agent systems. It provides standardized APIs for agent modules to discover, communicate, and collaborate in a distributed mesh architecture. This repository contains only Protocol Buffer definitions - no implementation code.

### Repository Structure

```
agentic-mesh-protocol/
├── proto/                    # Protocol Buffer definitions
│   ├── buf.yaml             # Buf linting configuration
│   └── agentic_mesh_protocol/
├── gen/                      # Generated TypeScript code (build output, not committed)
│   ├── python/              # Python protobuf + gRPC
│   └── typescript/          # TypeScript (ts-proto generated)
├── index.ts                  # Main barrel export entry point
├── buf.gen.yaml             # Code generation configuration
├── taskfile.yml             # Task runner commands
├── package.json             # npm package configuration
├── CHANGELOG.md             # Every protocol change, kept up to date with each change
└── CLAUDE.md                # This file
```

**Key Files & Directories:**
- `proto/` - Source of truth: Protocol Buffer definitions
- `gen/typescript/` - Generated TypeScript code (via ts-proto, excluded from git)
- `index.ts` - Handwritten barrel export at root (re-exports all services/types)
- **TypeScript-only package** - Users' build systems compile the .ts files

## Prerequisites

Before using this project, you need to install the following tools:

### Required

- **Node.js** (v18+) and **npm**
  - Install from: https://nodejs.org/
  - Or use nvm: https://github.com/nvm-sh/nvm
  - Includes buf CLI via npm package

### Optional (Recommended)

- **Go** (v1.20+) - For installing buf via Go
  - Install from: https://go.dev/dl/
  - Package managers: `brew install go` (macOS), `apt install golang` (Ubuntu)
  - Then install buf: `go install github.com/bufbuild/buf/cmd/buf@latest`

- **Task** - Task runner (optional, but commands in this doc use it)
  - Install from: https://taskfile.dev/installation/
  - Or: `brew install go-task` (macOS), `snap install task` (Linux)

After installing prerequisites:
1. Run `task check` to verify your setup, or
2. Run `task install` to install all dependencies (npm + buf dependencies), or
3. Manually run `npm install && npx buf dep update proto`

## Development Commands

**IMPORTANT**: All commands in this section must be run from the **repository root directory** (where `taskfile.yml`, `buf.gen.yaml`, and `package.json` are located), NOT from the `proto/` subdirectory. The proto files are in `proto/`, but build configuration files are at the root.

### Using Taskfile (Recommended)

This project uses [Task](https://taskfile.dev/) for running common commands:

```bash
task                        # Show all available tasks
task install                # Install npm dependencies (for buf)
task gen                    # Generate Python code from proto files (buf.gen.yaml)
task lint                   # Format check + buf lint
task lint:check             # Lint proto files with buf
task lint:format            # Format proto files with buf
task lint:format:check      # Check proto formatting (no write)
task version:breaking       # Check for breaking changes against main
task version:breaking:verbose  # Same, verbose JSON output
task clean                  # Remove generated files
task clean:all              # Remove generated files and node_modules
```

### Direct Commands

You can also run the underlying commands directly (from the repository root):

```bash
# Install dependencies (first time setup)
npm install
npx buf dep update proto  # Download buf dependencies (protovalidate, etc.)

# Format proto files
npx buf format -w

# Lint with buf
npx buf lint

# Check for breaking changes against main branch
npx buf breaking --against '.git#branch=main'

# Generate code from proto files (Python + TypeScript)
npx buf generate

# Or use npm script
npm run build  # Runs: npx buf generate

# Push schema to Buf Schema Registry (requires DKIN_CLOUD_TOKEN)
npx buf push proto
```

**Note**: The `buf` CLI is installed as an npm dependency. Use `npx buf` to run it, which will use the locally installed version from `node_modules/.bin/`. You must run `npx buf dep update proto` after `npm install` to download Protocol Buffer dependencies (like `buf.build/bufbuild/protovalidate`).

### Code Generation

This is a **TypeScript-only package** - users' build systems compile the `.ts` files.

#### Generate TypeScript from Proto Files
```bash
npx buf generate     # or: task generate or: npm run build
```
- Uses **ts-proto** plugin to generate TypeScript
- Output: `gen/typescript/` directory
- Generates **@grpc/grpc-js** compatible code (Node.js servers)
- Creates service definitions, message types, and client/server interfaces

### Output Locations

After running `npm run build`:
- `gen/python/` - Python protobuf + gRPC stubs
- `gen/typescript/` - Generated TypeScript from proto files (ts-proto)
- `index.ts` - Main entry point with barrel exports for all services

## Architecture

### File Layout

Every package `agentic_mesh_protocol/<domain>/v1/` is split the same way:

- `<domain>_enums.proto` — the enums of the domain
- `<domain>_messages.proto` — the domain objects and the `<Domain>Result` outcome message
- `<domain>_dto.proto` — the `<Rpc>Request` / `<Rpc>Response` messages
- `<domain>_service.proto` — the service definition

Shared packages:

- `pagination/v1` — `PaginationRequest` (order, descending, limit 1–100, offset), `PaginationResponse`,
  `BulkResponse` (totals + page of a listing or batch) and `OperationError` (code + message)
- `common/v1` — `Visibility` (PUBLIC / PRIVATE / INTERNAL), shared by setups, modules, records and files

### Response Pattern

- A single-item RPC returns `<Domain>Result result`: an `identifier` plus a required
  `oneof outcome` holding either the item or an `OperationError`.
- A listing or batch RPC returns `repeated <Domain>Result results` plus a `BulkResponse bulk`
  (total processed, total failed, pagination for listings).
- Listing requests take an optional `PaginationRequest pagination` (absent = server default page).

### Service Domains

1. **RegistryService** (`registry.v1`) — module registration and discovery.
   RPCs: RegisterModule, Heartbeat, SearchSetups, SearchModules, GetSetup, GetModule, GetModuleStatus.
   Searches return search-safe summaries (`SetupSummary` / `ModuleSummary`: no config, no endpoint);
   resolve them with GetSetup / GetModule.
2. **ModuleService** (`module.v1`) — served by every module (ARCHETYPE, TOOL_MODULE, SERVICE).
   RPCs: StartModule (server streaming), StopModule, GetModuleInput, GetModuleSelectInput, GetModuleOutput,
   GetModuleSetup, GetModuleSecret, GetModuleUserInfo, GetConfigSetupModule, ConfigSetupModule, GetModuleCost.
3. **SetupService** / **SetupVersionService** (`setup.v1`) — setups and their versions.
   SetupService: CreateSetup, GetSetup, ListSetups, UpdateSetup, ChangeVisibility, DeleteSetup.
   SetupVersionService: CreateSetupVersion, GetSetupVersion, ListSetupVersions, UpdateSetupVersion,
   SetCurrentSetupVersion, DeleteSetupVersion.
4. **StorageService** (`storage.v1`) — context-scoped JSON records grouped in collections.
   RPCs: CreateRecord, GetRecord, UpdateRecord, DeleteRecord, ListRecords, DeleteCollection.
5. **FilesystemService** (`filesystem.v1`) — context-scoped binary files.
   RPCs: UploadFiles, GetFile, ListFiles, UpdateFile, DeleteFiles.
6. **CostService** (`cost.v1`) — mission-scoped cost tracking.
   RPCs: CreateCost, ListCosts, ListCostConfigs, SetCostConfig.
7. **UserProfileService** (`user_profile.v1`) — the user a mission runs for.
   RPCs: GetUserProfile, GetSetupSecret, GetSetupUserInfo, CheckResourceAccess.
8. **GatewayService** (`gateway.v1`) — external surface of a producer module.
   RPCs: AssociateTask, StartStream, Stream (BiDi, in-band `stream.*` sentinels), SendSignal.

### Key Architectural Patterns

- **Context scoping**: storage and filesystem requests carry a context *kind* (`StorageContext`,
  `FileContext`); the matching identifier is resolved server-side from the task metadata.
- **Caller scoping**: owner and organization are resolved from the request context, never trusted from the payload.
- **Flexible schemas**: `google.protobuf.Struct` for configuration, data and module schemas.
- **Streaming**: `StartModule` streams job outputs; `Stream` is the Gateway BiDi channel.
- **Job lifecycle**: STARTING → PROCESSING → (SUCCESS | FAILED | CANCELED | EXPIRED | STOPPED).

## Linting and Style

### Buf Lint Rules (proto/buf.yaml)

- STANDARD, COMMENTS, FILE_LOWER_SNAKE_CASE and PROTOVALIDATE (every `buf.validate` rule must compile)
- Only exception: ENUM_VALUE_PREFIX — enum values are not prefixed, except the zero value
  which must be `<ENUM_NAME>_UNSPECIFIED` (enum value names must stay unique within a package)
- Requests and responses are named `<Rpc>Request` / `<Rpc>Response`, unique per RPC
- All messages, services, RPCs, fields and enum values require comments; format with `buf format`

## Dependencies

The protocol depends on:
- `buf.build/googleapis/googleapis` - Standard Google APIs
- `buf.build/bufbuild/protovalidate` - Request validation annotations

### Runtime Dependencies

The npm package requires:
- `@grpc/grpc-js` (^1.13.3) - gRPC implementation for Node.js
- `google-protobuf` (^3.21.4) - Protocol Buffers runtime
- **TypeScript** - Required to compile the .ts files in consuming projects

## Using as an NPM Package

This repository is packaged as `@digitalkin/agentic-mesh-protocol` for consumption in Node.js projects like `node-services-provider`.

### Publishing

#### Option 1: npm link (Local Development)
```bash
# In agentic-mesh-protocol repository
npm install
npm run build
npm link

# In consuming project (e.g., node-services-provider)
npm link @digitalkin/agentic-mesh-protocol
```

#### Option 2: GitHub Packages (Private Registry)
```bash
# Build and publish
npm run build
npm publish

# In consuming project
npm install @digitalkin/agentic-mesh-protocol
```

#### Option 3: Git Dependency
```json
{
  "dependencies": {
    "@digitalkin/agentic-mesh-protocol": "github:DigitalKin-ai/agentic-mesh-protocol#main"
  }
}
```

### Consuming in node-services-provider

Once published/linked, import services like this:

```typescript
// Import specific services
import {
  ModuleServiceService,
  ModuleServiceClient,
  StartModuleRequest,
  StartModuleResponse,
} from '@digitalkin/agentic-mesh-protocol';

// Import from specific service
import {
  StorageServiceService,
  StoreRecordRequest,
  StorageRecord,
} from '@digitalkin/agentic-mesh-protocol';

// Use with @grpc/grpc-js
import * as grpc from '@grpc/grpc-js';

const client = new ModuleServiceClient(
  'localhost:50051',
  grpc.credentials.createInsecure()
);
```

### Migration from service-apis-node

To migrate from `service-apis-node` to this package:

1. **Update package.json**:
```json
{
  "dependencies": {
    "@digitalkin/agentic-mesh-protocol": "^1.0.0"
  }
}
```

2. **Update imports**:
```typescript
// Old
import { ModuleServiceService } from 'service-apis-node/digitalkin_proto/...';

// New
import { ModuleServiceService } from '@digitalkin/agentic-mesh-protocol';
```

3. **Verify compatibility**: Both use `@grpc/grpc-js`, so server implementations remain the same

## CI/CD

Three GitHub Actions workflows provide comprehensive validation and automation:

### 1. **CI Workflow** (`.github/workflows/CI.yml`)
Main CI pipeline that runs on all PRs and pushes to main:
- **Buf Lint**: Validates buf style rules and format check
- **Buf Breaking**: Detects breaking changes (PR only)
- **Buf Generate**: Validates generated code is up to date
- **All Checks**: Aggregates all results

Triggers on changes to:
- `proto/**`
- `buf.yaml`
- `buf.gen.yaml`
- Workflow files

### 2. **Buf Lint (Quick Check)** (`.github/workflows/buf-lint.yml`)
Lightweight lint check that runs on every push to proto files:
- Provides fast feedback on basic linting errors
- Complements the main CI workflow

### 3. **Push to BSR** (`.github/workflows/buf-push.yml`)
Automatically pushes schema to Buf Schema Registry:
- Runs on pushes to main branch
- Supports manual dispatch with custom tags
- Requires `DKIN_CLOUD_TOKEN` secret

**Note**: All CI workflows use concurrency groups to cancel in-progress runs when new commits are pushed.

## Changelog

**Every change must be recorded in `CHANGELOG.md`, in the same change that introduces it.**
This covers proto files (messages, fields, enums, RPCs, validation rules), the generators
(`tools/zod`), the build and lint configuration, and the documentation of the protocol.

- Add the entry under `## [Unreleased]`, in the matching section: `Added`, `Changed`, `Removed`,
  `Fixed`, `Changed — tooling`, `Migration notes`, `Open decisions`.
- Flag every wire, JSON or generated-code breaking change with **BREAKING** and give the
  before → after mapping (RPC, message, field, enum value, file) consumers need to migrate.
- Name the domain the entry belongs to (setup, registry, module, storage, filesystem, cost,
  user_profile, gateway, pagination, common).
- On release, move the `[Unreleased]` entries under a `## [x.y.z] - YYYY-MM-DD` heading.

## Git Conventions

### Commit Messages
- **Never add a `Co-Authored-By:` trailer to commits.** This includes AI/assistant co-author trailers (e.g. `Co-Authored-By: Claude ... <noreply@anthropic.com>`) and any other co-author attribution. Commits must carry only their author.

## Important Notes

### Protocol and Structure
- This repository contains Protocol Buffer definitions and generates code for consumption
- Breaking changes are checked by CI (`buf breaking`); a wire-breaking change needs a new package version
- All packages use v1 versioning (e.g., `agentic_mesh_protocol.module.v1`, `agentic_mesh_protocol.storage.v1`)
- Licensed under GPL-3.0

### TypeScript/Node.js Package
- **Package name**: `@digitalkin/agentic-mesh-protocol`
- **Generator**: ts-proto (generates @grpc/grpc-js compatible code for Node.js servers)
- **Output**: TypeScript-only package (`index.ts` + `gen/typescript/`)
- **Entry point**: `index.ts` (barrel export re-exporting all services and types)
- **Compatibility**: Works with existing Node.js gRPC servers using @grpc/grpc-js
- **Build**: Users' TypeScript compilers handle compilation (no pre-compilation)

### Validation Rules

Every field carries `buf.validate` rules, checked by protovalidate (Python) and by the
generated Zod schemas (TypeScript, `tools/zod`). Conventions:

- **IDs**: standard string rules `prefix` + `min_len` (prefix length + 1) + `max_len: 256`:
  `modules:`, `jobs:`, `setups:`, `setup_versions:`, `missions:`, `users:`, `organizations:`,
  `files:`, `storage:`, `cards:`. Task IDs (Gateway) match `^[A-Za-z0-9_:.-]+$`, at most 256 characters.
- **`required`** is used only in its protovalidate meaning: a non-empty string, a non-zero number or
  enum, a present message, a non-empty list. Never on a `bool` (it would force `true`) nor on a filter.
- **Optional scalars** of a request are declared `optional` (explicit presence): their rules apply
  only when the field is set. Partial updates rely on it ("absent = unchanged").
- **Enums**: `defined_only: true` everywhere; `not_in: [0]` when UNSPECIFIED is not a valid value.
- **Bounds**: every string has a `max_len` (names 255, documentation 300, versions 128, tags 64...),
  every repeated field a `max_items`, every double is `finite`.
- **Single-field constraints use standard rules only** (string, number, enum, repeated, `oneof`):
  they carry built-in error messages and are fully translated to Zod. A dependency between fields
  is modeled by the message shape when possible: a `oneof` with `(buf.validate.oneof).required`
  (e.g. `SendSignalRequest.signal`, `CheckResourceAccessRequest.resource`) or a nested message
  with its own required fields (e.g. `SetupRevision`: no structure without content).
- **CEL only where no standard rule exists**, always with a custom `id` and `message`
  (a custom message is only possible through CEL):
  - message-level `(buf.validate.message).cel` for rules across fields — `<message>.<rule>` ids,
    e.g. `update_setup_request.not_empty`, `file_filter.created_range`, `storage_record.chronology`,
    `bulk_response.failed_within_processed`, `upload_files_request.unique_names`;
  - field-level `cel` on `result` / `repeated.items.cel` on `results` for the outcome kind an RPC
    returns (`<response>.outcome`, e.g. a GetSetupResponse holds a Setup or an OperationError).
    Keep `has()` off list comprehension variables: protovalidate-python ignores field presence
    there, so a per-item rule goes on `repeated.items.cel` where `this` is the item.
- The Zod generator translates `has(this.a) || has(this.b)` field rules; it does not read
  message-level CEL, which TypeScript servers must enforce themselves.

### Build Process
1. **Generate**: `buf generate` creates TypeScript from proto files in `gen/typescript/`
2. **Publish**: TypeScript files (`index.ts` + `gen/typescript/`) are published to npm
3. **Compile**: Users' build systems compile the TypeScript (not pre-compiled)
