/**
 * Agentic Mesh Protocol - Node.js gRPC Interfaces
 *
 * This package provides TypeScript interfaces and gRPC service definitions
 * for the Agentic Mesh Protocol, a multi-agent system communication protocol.
 *
 * @packageDocumentation
 */

// ==========================================
// COST SERVICE
// ==========================================

export { CostServiceService, CostServiceClient } from './gen/typescript/agentic_mesh_protocol/cost/v1/cost_service';
export {
  CostType,
  costTypeFromJSON,
  costTypeToJSON,
  Cost,
  AddCostRequest,
  AddCostResponse,
  GetCostRequest,
  GetCostResponse,
  GetCostsRequest,
  GetCostsResponse,
} from './gen/typescript/agentic_mesh_protocol/cost/v1/cost';

// ==========================================
// STORAGE SERVICE
// ==========================================

export { StorageServiceService, StorageServiceClient } from './gen/typescript/agentic_mesh_protocol/storage/v1/storage_service';
export {
  DataType,
  dataTypeFromJSON,
  dataTypeToJSON,
  ListRecordsRequest,
  ListRecordsResponse,
  StorageRecord,
  StoreRecordRequest,
  StoreRecordResponse,
  ReadRecordRequest,
  ReadRecordResponse,
  UpdateRecordRequest,
  UpdateRecordResponse,
  RemoveCollectionRequest,
  RemoveCollectionResponse,
  RemoveRecordRequest,
  RemoveRecordResponse,
} from './gen/typescript/agentic_mesh_protocol/storage/v1/data';

// ==========================================
// MODULE SERVICE
// ==========================================

export { ModuleServiceService, ModuleServiceClient } from './gen/typescript/agentic_mesh_protocol/module/v1/module_service';

// Lifecycle
export {
  StartModuleRequest,
  StartModuleResponse,
  StopModuleRequest,
  StopModuleResponse,
} from './gen/typescript/agentic_mesh_protocol/module/v1/lifecycle';

// Information
export {
  GetModuleInputRequest,
  GetModuleInputResponse,
  GetModuleOutputRequest,
  GetModuleOutputResponse,
  GetModuleSetupRequest,
  GetModuleSetupResponse,
  GetModuleSecretRequest,
  GetModuleSecretResponse,
} from './gen/typescript/agentic_mesh_protocol/module/v1/information';

// Monitoring
export {
  ModuleStatus,
  moduleStatusFromJSON,
  moduleStatusToJSON,
  JobInfo,
  GetModuleStatusRequest,
  GetModuleStatusResponse,
  GetModuleJobsRequest,
  GetModuleJobsResponse,
} from './gen/typescript/agentic_mesh_protocol/module/v1/monitoring';

// ==========================================
// FILESYSTEM SERVICE
// ==========================================

export { FilesystemServiceService, FilesystemServiceClient } from './gen/typescript/agentic_mesh_protocol/filesystem/v1/filesystem_service';
export {
  FileType,
  fileTypeFromJSON,
  fileTypeToJSON,
  FileStatus,
  fileStatusFromJSON,
  fileStatusToJSON,
  File,
  FileFilter,
  FileResult,
  UploadFileData,
  UploadFilesRequest,
  UploadFilesResponse,
  GetFileRequest,
  GetFileResponse,
  UpdateFileRequest,
  UpdateFileResponse,
  GetFilesRequest,
  GetFilesResponse,
  DeleteFilesRequest,
  DeleteFilesResponse,
} from './gen/typescript/agentic_mesh_protocol/filesystem/v1/filesystem';

// ==========================================
// SETUP SERVICE
// ==========================================

export { SetupServiceService, SetupServiceClient } from './gen/typescript/agentic_mesh_protocol/setup/v1/setup_service';
export {
  SetupVersion,
  Setup,
  SetupStatus,
  setupStatusFromJSON,
  setupStatusToJSON,
  CreateSetupRequest,
  CreateSetupResponse,
  GetSetupRequest,
  GetSetupResponse,
  ListSetupsRequest,
  ListSetupsResponse,
  UpdateSetupRequest,
  UpdateSetupResponse,
  DeleteSetupRequest,
  DeleteSetupResponse,
  CreateSetupVersionRequest,
  CreateSetupVersionResponse,
  GetSetupVersionRequest,
  GetSetupVersionResponse,
  SearchSetupVersionsRequest,
  SearchSetupVersionsResponse,
  UpdateSetupVersionRequest,
  UpdateSetupVersionResponse,
  DeleteSetupVersionRequest,
  DeleteSetupVersionResponse,
} from './gen/typescript/agentic_mesh_protocol/setup/v1/setup';

// ==========================================
// MODULE REGISTRY SERVICE
// ==========================================

export { ModuleRegistryServiceService, ModuleRegistryServiceClient } from './gen/typescript/agentic_mesh_protocol/module_registry/v1/module_registry_service';

// Registration
export {
  RegisterRequest,
  RegisterResponse,
  DeregisterRequest,
  DeregisterResponse,
} from './gen/typescript/agentic_mesh_protocol/module_registry/v1/registration';

// Discovery
export {
  DiscoverSearchRequest,
  DiscoverSearchResponse,
  DiscoverInfoRequest,
  DiscoverInfoResponse,
} from './gen/typescript/agentic_mesh_protocol/module_registry/v1/discover';

// Metadata
export {
  Tag,
  Metadata,
} from './gen/typescript/agentic_mesh_protocol/module_registry/v1/metadata';

// Status (Note: ModuleStatus from status.proto - aliased to avoid conflict with module/v1/monitoring)
export {
  ModuleStatusRequest,
  ModuleStatusResponse,
  GetAllModulesStatusRequest,
  ListModulesStatusRequest,
  ListModulesStatusResponse,
  UpdateStatusRequest,
  UpdateStatusResponse,
} from './gen/typescript/agentic_mesh_protocol/module_registry/v1/status';

// ==========================================
// USER PROFILE SERVICE
// ==========================================

export { UserProfileServiceService, UserProfileServiceClient } from './gen/typescript/agentic_mesh_protocol/user_profile/v1/user_profile_service';
export {
  Subscription,
  Credits,
  UserProfile,
  GetUserProfileRequest,
  GetUserProfileResponse,
} from './gen/typescript/agentic_mesh_protocol/user_profile/v1/user_profile';

// ==========================================
// GOOGLE PROTOBUF
// ==========================================
export {Struct} from './gen/typescript/google/protobuf/struct';