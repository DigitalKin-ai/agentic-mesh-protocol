/**
 * Maps Protocol Buffer types to Zod schema types
 */

import type { DescField, DescEnum, DescMessage } from "@bufbuild/protobuf";
import { ScalarType } from "@bufbuild/protobuf";
import { getRelativeImportPath, toSchemaName } from "./utils.js";

export interface ZodTypeInfo {
  /** The Zod type expression, e.g., "z.string()", "z.number().int()" */
  zodType: string;
  /** Import needed from another file (for enums or nested messages) */
  needsImport?: {
    name: string;
    from: string;
    isType?: boolean;
  };
  /** Whether this is a nested message reference */
  isNestedMessage?: boolean;
}

export interface TypeMapperContext {
  /** The proto file path we're generating from */
  currentProtoPath: string;
}

/**
 * Maps a proto field to its Zod type representation
 */
export function mapFieldToZod(
  field: DescField,
  context: TypeMapperContext
): ZodTypeInfo {
  // Handle map fields first
  if (field.fieldKind === "map") {
    return mapMapFieldToZod(field, context);
  }

  // Handle list fields (repeated)
  if (field.fieldKind === "list") {
    const itemType = mapListItemToZod(field, context);
    return {
      zodType: `z.array(${itemType.zodType})`,
      needsImport: itemType.needsImport,
    };
  }

  return mapSingleFieldToZod(field, context);
}

/**
 * Maps a list (repeated) field item to Zod
 */
function mapListItemToZod(
  field: DescField & { fieldKind: "list" },
  context: TypeMapperContext
): ZodTypeInfo {
  if (field.listKind === "scalar") {
    return { zodType: mapScalarToZod(field.scalar) };
  } else if (field.listKind === "enum") {
    return mapEnumToZod(field.enum, context);
  } else if (field.listKind === "message") {
    return mapMessageToZod(field.message, context);
  }
  return { zodType: "z.unknown()" };
}

function mapMapFieldToZod(
  field: DescField & { fieldKind: "map" },
  context: TypeMapperContext
): ZodTypeInfo {
  const keyType = mapScalarToZod(field.mapKey);

  // Map value can be scalar, enum, or message
  let valueType: ZodTypeInfo;
  if (field.mapKind === "scalar") {
    valueType = { zodType: mapScalarToZod(field.scalar) };
  } else if (field.mapKind === "enum") {
    valueType = mapEnumToZod(field.enum, context);
  } else if (field.mapKind === "message") {
    valueType = mapMessageToZod(field.message, context);
  } else {
    valueType = { zodType: "z.unknown()" };
  }

  return {
    zodType: `z.record(${keyType}, ${valueType.zodType})`,
    needsImport: valueType.needsImport,
  };
}

function mapSingleFieldToZod(
  field: DescField,
  context: TypeMapperContext
): ZodTypeInfo {
  switch (field.fieldKind) {
    case "scalar":
      return { zodType: mapScalarToZod(field.scalar) };

    case "enum":
      return mapEnumToZod(field.enum, context);

    case "message":
      return mapMessageToZod(field.message, context);

    default:
      return { zodType: "z.unknown()" };
  }
}

/**
 * Maps a scalar proto type to Zod
 */
export function mapScalarToZod(scalar: ScalarType): string {
  switch (scalar) {
    case ScalarType.STRING:
      return "z.string()";

    case ScalarType.BOOL:
      return "z.boolean()";

    case ScalarType.INT32:
    case ScalarType.SINT32:
    case ScalarType.SFIXED32:
      return "z.number().int()";

    case ScalarType.UINT32:
    case ScalarType.FIXED32:
      return "z.number().int().nonnegative()";

    case ScalarType.INT64:
    case ScalarType.SINT64:
    case ScalarType.SFIXED64:
      // ts-proto with forceLong=string converts int64 to string
      return "z.string()";

    case ScalarType.UINT64:
    case ScalarType.FIXED64:
      // ts-proto with forceLong=string converts uint64 to string
      return "z.string()";

    case ScalarType.FLOAT:
    case ScalarType.DOUBLE:
      return "z.number()";

    case ScalarType.BYTES:
      return "z.instanceof(Uint8Array)";

    default:
      return "z.unknown()";
  }
}

/**
 * Maps an enum to Zod z.enum()
 */
function mapEnumToZod(
  enumDesc: DescEnum,
  context: TypeMapperContext
): ZodTypeInfo {
  const enumName = enumDesc.name;
  const enumProtoPath = enumDesc.file.name;

  // Import path to the ts-proto generated file (uses .js suffix for ES modules)
  const importPath = getRelativeImportPath(
    context.currentProtoPath,
    enumProtoPath,
    ".js"
  );

  return {
    zodType: `z.enum(${enumName})`,
    needsImport: {
      name: enumName,
      from: importPath,
    },
  };
}

/**
 * Maps a message to Zod schema reference
 */
function mapMessageToZod(
  msgDesc: DescMessage,
  context: TypeMapperContext
): ZodTypeInfo {
  const typeName = msgDesc.typeName;

  // Handle well-known types
  if (typeName === "google.protobuf.Timestamp") {
    // Convert to Date object - ts-proto with useDate=true converts Timestamps to Date
    return { zodType: "z.coerce.date()" };
  }

  if (typeName === "google.protobuf.Duration") {
    return { zodType: "z.string()" };
  }

  if (typeName === "google.protobuf.Any") {
    return { zodType: "z.unknown()" };
  }

  // Struct is a flexible JSON-like object
  if (typeName === "google.protobuf.Struct") {
    return { zodType: "z.record(z.string(), z.any())" };
  }

  // Value is a flexible JSON value
  if (typeName === "google.protobuf.Value") {
    return { zodType: "z.any()" };
  }

  // ListValue is an array of values
  if (typeName === "google.protobuf.ListValue") {
    return { zodType: "z.array(z.any())" };
  }

  // Empty message
  if (typeName === "google.protobuf.Empty") {
    return { zodType: "z.object({})" };
  }

  // For wrapper types
  if (typeName === "google.protobuf.StringValue") {
    return { zodType: "z.string()" };
  }
  if (typeName === "google.protobuf.Int32Value" || typeName === "google.protobuf.Int64Value") {
    return { zodType: "z.number().int()" };
  }
  if (typeName === "google.protobuf.UInt32Value" || typeName === "google.protobuf.UInt64Value") {
    return { zodType: "z.number().int().nonnegative()" };
  }
  if (typeName === "google.protobuf.FloatValue" || typeName === "google.protobuf.DoubleValue") {
    return { zodType: "z.number()" };
  }
  if (typeName === "google.protobuf.BoolValue") {
    return { zodType: "z.boolean()" };
  }
  if (typeName === "google.protobuf.BytesValue") {
    return { zodType: "z.instanceof(Uint8Array)" };
  }

  // For regular messages, reference the schema by name
  const schemaName = toSchemaName(msgDesc.name);
  const msgProtoPath = msgDesc.file.name;

  // Check if it's in the same file
  if (msgProtoPath === context.currentProtoPath) {
    return {
      zodType: schemaName,
      isNestedMessage: true,
    };
  }

  // Different file - need to import (uses .js suffix for ES modules)
  const importPath = getRelativeImportPath(
    context.currentProtoPath,
    msgProtoPath,
    "_zod.js"
  );

  return {
    zodType: schemaName,
    isNestedMessage: true,
    needsImport: {
      name: schemaName,
      from: importPath,
    },
  };
}

/**
 * Checks if a field should be marked as optional in Zod
 *
 * In Proto3, all fields are implicitly optional with default values:
 * - Scalars default to zero value ("", 0, false)
 * - Messages default to null/undefined
 * - Only fields with buf.validate.required = true should be required in Zod
 */
export function isFieldOptional(field: DescField): boolean {
  // In Proto3, all scalar and enum fields are optional (have default values)
  if (field.fieldKind === "scalar" || field.fieldKind === "enum") {
    return true;
  }

  // Proto3 explicit optional keyword
  if (field.proto.proto3Optional) {
    return true;
  }

  // Message fields are implicitly optional in proto3
  if (field.fieldKind === "message") {
    return true;
  }

  // List and map fields are also optional (default to empty)
  if (field.fieldKind === "list" || field.fieldKind === "map") {
    return true;
  }

  return false;
}
