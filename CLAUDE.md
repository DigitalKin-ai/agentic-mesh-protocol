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
├── gen/                      # Generated TypeScript code (committed for git dependencies)
│   ├── python/              # Python protobuf + gRPC (not committed)
│   └── typescript/          # TypeScript (ts-proto generated, committed to git)
├── index.ts                  # Main barrel export entry point
├── buf.gen.yaml             # Code generation configuration
├── Taskfile.yml             # Task runner commands
├── package.json             # npm package configuration
└── CLAUDE.md                # This file
```

**Key Files & Directories:**
- `proto/` - Source of truth: Protocol Buffer definitions
- `gen/typescript/` - Generated TypeScript code (via ts-proto, **committed to git** for git dependency support)
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

**IMPORTANT**: All commands in this section must be run from the **repository root directory** (where `Taskfile.yml`, `buf.gen.yaml`, and `package.json` are located), NOT from the `proto/` subdirectory. The proto files are in `proto/`, but build configuration files are at the root.

### Using Taskfile (Recommended)

This project uses [Task](https://taskfile.dev/) for running common commands:

```bash
# Show all available tasks
task

# Install dependencies
task check                # Check if required tools are installed (Node.js, npm, buf, Go)
task install              # Install npm dependencies and update buf dependencies

# Linting
task lint              # Lint proto files with buf
task lint:buf          # Lint proto files with buf
task lint:ci           # Run all linting checks (CI mode)

# Formatting
task format            # Format proto files with buf
task format:check      # Check if proto files are formatted (no write)

# Breaking changes
task breaking          # Check for breaking changes against main branch
task breaking:verbose  # Check with verbose JSON output

# Code generation
task generate          # Generate code for all languages (Python, TypeScript)
task generate:check    # Verify generated code is up to date

# Build workflows
task build             # Full build - format, lint, and generate
task build:ci          # CI build - format check, lint, breaking, and generate check
task ci                # Run all CI checks locally (recommended before pushing)

# Buf Schema Registry
task push              # Push schema to BSR (requires DKIN_CLOUD_TOKEN or BUF_TOKEN)
task push:tag TAG=v1.0.0  # Push schema with a specific tag

# Cleanup
task clean             # Remove generated files (gen/)
task clean:all         # Remove all generated and dependency files

# Development helpers
task validate          # Validate proto files are syntactically correct
task deps              # Show buf dependencies
task deps:update       # Update buf dependencies
task watch             # Watch for changes and auto-generate code
task stats             # Show statistics about proto files
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

### Service Domains

The protocol defines seven core service domains:

1. **Module Registry Service** (`agentic_mesh_protocol.module_registry.v1`)
   - Central discovery hub for all modules in the mesh
   - Handles registration, deregistration, and discovery of modules
   - Tracks module health status across the network
   - Key for enabling dynamic service mesh topology
   - RPCs: RegisterModule, DeregisterModule, DiscoverInfoModule, DiscoverSearchModule, GetModuleStatus, ListModuleStatus, GetAllModuleStatus (streaming), UpdateModuleStatus

2. **Module Service** (`agentic_mesh_protocol.module.v1`)
   - Execution engine for individual modules
   - Manages module lifecycle (start/stop/monitor)
   - Provides streaming execution via `StartModule` RPC
   - Returns input/output schemas and setup requirements
   - Module types: KIN (agent brain/LLM), TOOL (utilities), TRIGGER (entry points)
   - RPCs: StartModule (streaming), StopModule, GetModuleStatus, GetModuleJobs, GetModuleInput, GetModuleOutput, GetModuleSetup, GetModuleSecret

3. **Setup Service** (`agentic_mesh_protocol.setup.v1`)
   - Configuration management with versioning
   - Each Setup can have multiple SetupVersions
   - Stores structured configuration as `google.protobuf.Struct`
   - Enables parameterized module execution
   - RPCs: CreateSetup, GetSetup, UpdateSetup, DeleteSetup, CreateSetupVersion, GetSetupVersion, SearchSetupVersions, UpdateSetupVersion, DeleteSetupVersion

4. **Storage Service** (`agentic_mesh_protocol.storage.v1`)
   - Mission-scoped key-value storage for structured data
   - Records categorized as OUTPUT, VIEW, LOGS, or OTHER
   - Supports CRUD operations on JSON-like data
   - RPCs: StoreRecord, ReadRecord, ModifyRecord, RemoveRecord

5. **FileSystem Service** (`agentic_mesh_protocol.filesystem.v1`)
   - Binary file storage for large artifacts
   - Mission-scoped file operations
   - Handles files that exceed structured storage limits
   - RPCs: UploadFile, GetFile, GetFilesByMission, GetFilesByName, DeleteFile

6. **Cost Service** (`agentic_mesh_protocol.cost.v1`)
   - Tracks operational costs (e.g., LLM API calls, compute)
   - Mission-scoped cost attribution
   - Enables financial accountability in multi-agent systems
   - RPCs: AddCost, GetCostsByMission, GetCostsByName, GetCostsByType

7. **UserProfile Service** (`agentic_mesh_protocol.userprofile.v1`)
   - User profile management for the multi-agent system
   - Stores user information and metadata
   - Organisation-scoped user profiles
   - RPCs: CreateUserProfile, GetUserProfile, UpdateUserProfile, DeleteUserProfile, ListUserProfilesByOrganisation

### Key Architectural Patterns

- **Mission Scoping**: All operations include `mission_id` for multi-tenant isolation and traceability
- **Module Types**: TRIGGER (entry points), KIN (core intelligence), TOOL (utilities), VIEW (UI components)
- **Validation**: All messages use `buf.validate` annotations for request validation
- **Flexible Schemas**: Extensive use of `google.protobuf.Struct` for forward-compatible data definitions
- **Streaming**: `StartModule` returns a stream for long-running operations
- **Status Tracking**: Job lifecycle states: STARTING → PROCESSING → (SUCCESS|FAILED|CANCELED|EXPIRED|STOPPED)

### Data Flow Pattern

```
1. Discover module via Module Registry
2. Retrieve setup configuration from Setup Service
3. Start execution via Module Service (streaming)
4. Store results in Storage/FileSystem Services
5. Track costs via Cost Service
```

## Linting and Style

### Buf Lint Rules (proto/buf.yaml)

- Uses DEFAULT, STANDARD, COMMENTS, UNARY_RPC rules
- Requires FILE_LOWER_SNAKE_CASE naming
- Services must end with "Service" suffix
- Enum zero values must end with "_UNSPECIFIED"
- Allows `google.protobuf.Empty` for requests/responses
- 4-space indentation via `buf format`
- Lower snake_case for fields and file names
- Upper CamelCase for messages
- All messages, services, RPCs, fields, and enums require comments

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

## Important Notes

### Protocol and Structure
- This repository contains Protocol Buffer definitions and generates code for consumption
- All proto files must maintain backward compatibility (checked by CI)
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
ID prefixes are enforced via buf.validate:
- Module IDs must be prefixed with "modules:"
- Job IDs must be prefixed with "jobs:"
- Setup IDs must be prefixed with "setups:"
- Mission IDs must be prefixed with "missions:"
- User IDs must be prefixed with "users:"
- Organisation IDs must be prefixed with "organisations:"

### Build Process
1. **Generate**: `buf generate` creates TypeScript from proto files in `gen/typescript/`
2. **Commit**: Generated TypeScript code in `gen/typescript/` is committed to git (required for git dependencies)
3. **Publish**: TypeScript files (`index.ts` + `gen/typescript/`) are published to npm
4. **Compile**: Users' build systems compile the TypeScript (not pre-compiled)
5. **Prepare script**: `npm run generate` runs automatically on `npm install` from git
