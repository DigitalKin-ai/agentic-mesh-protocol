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

/** How the rules of a value shape its base type */
export interface BaseTypeOptions {
  /** A float/double carries `finite`: NaN and ±Infinity are refused by the base type itself */
  finite?: boolean;
  /** An enum carries `defined_only`: the base type may be the declared enum */
  definedOnly?: boolean;
}

/**
 * Maps a proto field to its Zod type representation
 */
export function mapFieldToZod(
  field: DescField,
  context: TypeMapperContext,
  options: BaseTypeOptions = {}
): ZodTypeInfo {
  // Handle map fields first
  if (field.fieldKind === "map") {
    return mapMapFieldToZod(field, context);
  }

  // Handle list fields (repeated)
  if (field.fieldKind === "list") {
    const itemType = mapListItemToZod(field, context, options);
    return {
      zodType: `z.array(${itemType.zodType})`,
      needsImport: itemType.needsImport,
    };
  }

  return mapSingleFieldToZod(field, context, options);
}

/**
 * Maps a list (repeated) field item to Zod
 */
export function mapListItemToZod(
  field: DescField & { fieldKind: "list" },
  context: TypeMapperContext,
  options: BaseTypeOptions = {}
): ZodTypeInfo {
  if (field.listKind === "scalar") {
    return { zodType: mapScalarToZod(field.scalar, options) };
  } else if (field.listKind === "enum") {
    return mapEnumToZod(field.enum, context, options);
  } else if (field.listKind === "message") {
    return mapMessageToZod(field.message, context);
  }
  return { zodType: "z.unknown()" };
}

function mapMapFieldToZod(
  field: DescField & { fieldKind: "map" },
  context: TypeMapperContext
): ZodTypeInfo {
  // ts-proto holds a map as a plain object, whose keys are strings whatever the proto key type
  if (field.mapKey !== ScalarType.STRING) {
    throw new Error(
      `${field.parent.typeName}.${field.name}: map keys of type ${ScalarType[field.mapKey]} are not supported by protoc-gen-zod`
    );
  }
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
  context: TypeMapperContext,
  options: BaseTypeOptions
): ZodTypeInfo {
  switch (field.fieldKind) {
    case "scalar":
      return { zodType: mapScalarToZod(field.scalar, options) };

    case "enum":
      return mapEnumToZod(field.enum, context, options);

    case "message":
      return mapMessageToZod(field.message, context);

    default:
      return { zodType: "z.unknown()" };
  }
}

/**
 * Maps a scalar proto type to Zod, restricted to the values the wire can carry
 */
export function mapScalarToZod(scalar: ScalarType, options: BaseTypeOptions = {}): string {
  switch (scalar) {
    case ScalarType.STRING:
      return "z.string()";

    case ScalarType.BOOL:
      return "z.boolean()";

    case ScalarType.INT32:
    case ScalarType.SINT32:
    case ScalarType.SFIXED32:
      return "z.number().int().min(-2147483648).max(2147483647)";

    case ScalarType.UINT32:
    case ScalarType.FIXED32:
      return "z.number().int().min(0).max(4294967295)";

    case ScalarType.INT64:
    case ScalarType.SINT64:
    case ScalarType.SFIXED64:
      // ts-proto with forceLong=string converts int64 to a decimal string
      return 'z.string().refine((v) => __r.isInt64(v), { message: "must be a decimal integer within int64", abort: true })';

    case ScalarType.UINT64:
    case ScalarType.FIXED64:
      // ts-proto with forceLong=string converts uint64 to a decimal string
      return 'z.string().refine((v) => __r.isUint64(v), { message: "must be a decimal integer within uint64", abort: true })';

    case ScalarType.FLOAT:
    case ScalarType.DOUBLE:
      // z.number() refuses NaN and ±Infinity: only right when the field is `finite`
      return options.finite
        ? "z.number()"
        : 'z.custom<number>((v) => typeof v === "number", { message: "Invalid input: expected number" })';

    case ScalarType.BYTES:
      return "z.instanceof(Uint8Array)";

    default:
      return "z.unknown()";
  }
}

/**
 * Maps an enum to Zod z.enum(), or to any int32 for an open enum without `defined_only`
 */
function mapEnumToZod(
  enumDesc: DescEnum,
  context: TypeMapperContext,
  options: BaseTypeOptions = {}
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
    // z.enum() accepts the declared values and ts-proto's UNRECOGNIZED (-1); an open enum takes any int32
    zodType: options.definedOnly
      ? `z.enum(${enumName})`
      : `z.custom<${enumName}>((v) => Number.isInteger(v) && (v as number) >= -2147483648 && (v as number) <= 2147483647, { message: "Invalid input: expected an int32 enum value" })`,
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
