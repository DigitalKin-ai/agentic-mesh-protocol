/**
 * Utility functions for protoc-gen-zod
 */

/**
 * Converts snake_case to camelCase (matching protobuf-es generated field names)
 */
export function toCamelCase(name: string): string {
  return name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Generates Zod schema export name from message name
 * e.g., "RegisterRequest" -> "RegisterRequestSchema"
 */
export function toSchemaName(messageName: string): string {
  return `${messageName}Schema`;
}

/**
 * Escapes a string for use in generated code
 */
export function escapeString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

/**
 * Generates the import path for a sibling generated file
 * e.g., for enum imports from *_pb.ts files
 *
 * Since we generate files with full paths (mirai/v1/auth_zod.ts),
 * imports should be relative within the same directory.
 *
 * Note: file.name from protobuf-es excludes .proto suffix
 */
export function getRelativeImportPath(
  fromProtoPath: string,
  toProtoPath: string,
  suffix: string
): string {
  // Both paths are like "mirai/v1/auth" (without .proto suffix)
  // Output files will be "mirai/v1/auth_zod.ts" and "mirai/v1/common_pb.ts"
  // We want relative imports like "./common_pb"
  const fromDir = fromProtoPath.split("/").slice(0, -1).join("/");
  const toDir = toProtoPath.split("/").slice(0, -1).join("/");
  const toBaseName = toProtoPath.split("/").pop() ?? "";

  if (fromDir === toDir) {
    // Same directory, use ./
    return `./${toBaseName}${suffix}`;
  }

  // Different directories - compute relative path
  const fromParts = fromDir.split("/").filter(Boolean);
  const toParts = toDir.split("/").filter(Boolean);

  // Find common prefix
  let commonLength = 0;
  for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
    if (fromParts[i] === toParts[i]) {
      commonLength++;
    } else {
      break;
    }
  }

  // Build relative path
  const upCount = fromParts.length - commonLength;
  const downPath = toParts.slice(commonLength);
  const relativeParts = [
    ...Array(upCount).fill(".."),
    ...downPath,
    `${toBaseName}${suffix}`,
  ];

  return relativeParts.join("/") || `./${toBaseName}${suffix}`;
}

/**
 * Gets the base name of a proto file (last path component)
 * Note: file.name from protobuf-es already excludes .proto suffix
 * e.g., "mirai/v1/auth" -> "auth"
 */
export function getProtoBaseName(protoPath: string): string {
  return protoPath.split("/").pop() ?? "";
}

/**
 * Checks if a message name ends with "Response" (typically not validated)
 */
export function isResponseMessage(messageName: string): boolean {
  return messageName.endsWith("Response");
}

/**
 * Checks if a message name ends with "Request" (typically needs validation)
 */
export function isRequestMessage(messageName: string): boolean {
  return messageName.endsWith("Request");
}

/**
 * Converts PascalCase or camelCase to SCREAMING_SNAKE_CASE
 * e.g., "CostType" -> "COST_TYPE"
 */
export function toScreamingSnakeCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toUpperCase();
}

/**
 * Strips the common prefix from an enum value name
 * e.g., "COST_TYPE_TOKEN_INPUT" with prefix "COST_TYPE" -> "TOKEN_INPUT"
 */
export function stripEnumPrefix(valueName: string, enumName: string): string {
  const prefix = toScreamingSnakeCase(enumName) + "_";
  if (valueName.startsWith(prefix)) {
    return valueName.slice(prefix.length);
  }
  return valueName;
}
