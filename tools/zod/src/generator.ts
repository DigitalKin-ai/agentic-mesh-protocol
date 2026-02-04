/**
 * Main generator that produces Zod schema files from proto files
 */

import type { Schema, GeneratedFile } from "@bufbuild/protoplugin";
import type { DescFile, DescMessage, DescEnum, DescField } from "@bufbuild/protobuf";
import {
  mapFieldToZod,
  isFieldOptional,
  type TypeMapperContext,
} from "./type-mapper.js";
import { getValidationChain, isFieldRequired } from "./validation-mapper.js";
import { toCamelCase, toSchemaName, getRelativeImportPath, toScreamingSnakeCase, stripEnumPrefix } from "./utils.js";

export interface PluginOptions {
  /** Whether to include Response messages (usually not needed for form validation) */
  includeResponses: boolean;
}

/**
 * Main entry point for generating Zod schemas
 */
export function generateZodSchemas(
  schema: Schema<PluginOptions>
): void {
  for (const file of schema.files) {
    // Skip third-party dependencies - only generate for local proto files
    if (file.name.startsWith("buf/") || file.name.startsWith("google/")) {
      continue;
    }
    generateFileSchemas(schema, file);
  }
}

/**
 * Generates Zod schemas for a single proto file
 */
function generateFileSchemas(
  schema: Schema<PluginOptions>,
  file: DescFile
): void {
  // Filter messages first to check if we have anything to generate
  const messages = file.messages.filter((msg) => {
    // Skip Response messages unless option is set
    if (!schema.options.includeResponses && msg.name.endsWith("Response")) {
      return false;
    }
    return true;
  });

  const localEnums = file.enums;

  // Skip generating file if there are no messages or enums to export
  if (messages.length === 0 && localEnums.length === 0) {
    return;
  }

  // Preserve directory structure: mirai/v1/auth -> mirai/v1/auth_zod.ts
  // Note: file.name excludes the .proto suffix
  const outputFileName = `${file.name}_zod.ts`;

  const f = schema.generateFile(outputFileName);

  // Add file header
  f.print(`// @generated from file ${file.name}.proto`);
  f.print("/* eslint-disable */");
  f.print();

  // Collect all imports needed
  const imports = new Map<string, Set<string>>();
  const context: TypeMapperContext = {
    currentProtoPath: file.name,
  };

  // Collect imports from all messages
  for (const message of messages) {
    collectMessageImports(message, context, imports);
  }

  // Collect enum imports - local enums need to be imported for z.enum to work
  // ts-proto generates files with .js suffix for ES modules
  const pbImportPath = getRelativeImportPath(file.name, file.name, ".js");
  for (const enumDesc of localEnums) {
    const existing = imports.get(pbImportPath) ?? new Set();
    existing.add(enumDesc.name);
    imports.set(pbImportPath, existing);
  }

  // Write zod import
  f.print('import { z } from "zod";');

  // Write imports from *_pb.ts files (for enums)
  for (const [importPath, names] of imports) {
    const sortedNames = Array.from(names).sort();
    f.print(`import { ${sortedNames.join(", ")} } from "${importPath}";`);
  }

  f.print();

  // Generate enum schemas for enums defined in this file
  for (const enumDesc of localEnums) {
    generateEnumSchema(f, enumDesc);
  }

  // Generate message schemas
  // Sort by dependency order and identify recursive types
  const { sortedMessages, recursiveTypes } = analyzeMessageDependencies(messages, file.name);

  for (const message of sortedMessages) {
    generateMessageSchema(f, message, context, recursiveTypes);
    f.print();
  }
}

/**
 * Collects all imports needed for a message's fields
 */
function collectMessageImports(
  message: DescMessage,
  context: TypeMapperContext,
  imports: Map<string, Set<string>>
): void {
  for (const field of message.fields) {
    const typeInfo = mapFieldToZod(field, context);
    if (typeInfo.needsImport) {
      const existing = imports.get(typeInfo.needsImport.from) ?? new Set();
      existing.add(typeInfo.needsImport.name);
      imports.set(typeInfo.needsImport.from, existing);
    }
  }

  // Recurse into nested messages
  for (const nested of message.nestedMessages) {
    collectMessageImports(nested, context, imports);
  }
}

/**
 * Generates a Zod schema for an enum
 */
function generateEnumSchema(
  f: GeneratedFile,
  enumDesc: DescEnum
): void {
  const enumName = enumDesc.name;
  const schemaName = toSchemaName(enumName);
  const screaming = toScreamingSnakeCase(enumName);

  // Add JSDoc
  f.print("/**");
  f.print(` * Zod schema for ${enumName} enum`);
  if (enumDesc.deprecated) {
    f.print(" * @deprecated");
  }
  f.print(` * @generated from enum ${enumDesc.typeName}`);
  f.print(" */");

  // Enum is already imported at the top of the file
  f.print(`export const ${schemaName} = z.enum(${enumName});`);
  f.print(`export type ${enumName}Type = z.infer<typeof ${schemaName}>;`);
  f.print();

  // Generate number to string map
  f.print("/**");
  f.print(` * Map of ${enumName} enum values to string representations`);
  f.print(` * @generated from enum ${enumDesc.typeName}`);
  f.print(" */");
  f.print(`export const ${screaming}_MAP: Record<number, string> = {`);
  for (const value of enumDesc.values) {
    const strippedName = stripEnumPrefix(value.name, enumName);
    f.print(`  ${value.number}: "${strippedName}",`);
  }
  f.print("};");
  f.print();

  // Generate string to enum map (excluding UNSPECIFIED)
  f.print("/**");
  f.print(` * Map of string representations to ${enumName} enum values`);
  f.print(` * @generated from enum ${enumDesc.typeName}`);
  f.print(" */");
  f.print(`export const STRING_TO_${screaming}: Record<string, ${enumName}> = {`);
  for (const value of enumDesc.values) {
    // Skip UNSPECIFIED (value 0) for the reverse map
    if (value.number === 0) continue;
    const strippedName = stripEnumPrefix(value.name, enumName);
    f.print(`  ${strippedName}: ${enumName}.${value.name},`);
  }
  f.print("};");
  f.print();
}

/**
 * Generates a Zod schema for a message
 */
function generateMessageSchema(
  f: GeneratedFile,
  message: DescMessage,
  context: TypeMapperContext,
  recursiveTypes: Set<string>
): void {
  const schemaName = toSchemaName(message.name);
  const isRecursive = recursiveTypes.has(message.name);

  // Add JSDoc
  f.print("/**");
  f.print(` * Zod schema for ${message.name}`);
  if (message.deprecated) {
    f.print(" * @deprecated");
  }
  f.print(` * @generated from message ${message.typeName}`);
  f.print(" */");

  if (isRecursive) {
    // For recursive types, we need to use z.lazy() with explicit type annotation
    f.print(`export type ${message.name} = {`);
    for (const field of message.fields) {
      const fieldName = toCamelCase(field.name);
      const fieldIsOptional = isFieldOptional(field);
      const validation = getValidationChain(field);
      const fieldIsRequired = isFieldRequired(field) || validation.required;
      const optional = fieldIsOptional && !fieldIsRequired ? "?" : "";

      // Generate TypeScript type based on field kind
      const tsType = inferTsType(field);
      f.print(`  ${fieldName}${optional}: ${tsType};`);
    }
    f.print("};");
    f.print();

    // Generate the schema using z.lazy for the base
    f.print(`export const ${schemaName}: z.ZodType<${message.name}> = z.lazy(() => z.object({`);
    for (const field of message.fields) {
      generateFieldSchema(f, field, context, recursiveTypes);
    }
    f.print("}));");
  } else {
    // Start schema definition
    f.print(`export const ${schemaName} = z.object({`);

    for (const field of message.fields) {
      generateFieldSchema(f, field, context, recursiveTypes);
    }

    f.print("});");

    // Export inferred type
    f.print();
    f.print(`export type ${message.name} = z.infer<typeof ${schemaName}>;`);
  }
}

/**
 * Infers the TypeScript type for a field (used for recursive type declarations)
 */
function inferTsType(field: DescField): string {
  const wrapArray = (inner: string) => field.fieldKind === "list" ? `${inner}[]` : inner;

  if (field.fieldKind === "scalar" || (field.fieldKind === "list" && field.listKind === "scalar")) {
    const scalarKind = field.fieldKind === "scalar" ? field.scalar : field.scalar;
    switch (scalarKind) {
      case 9: return wrapArray("string"); // STRING
      case 8: return wrapArray("boolean"); // BOOL
      case 12: return wrapArray("Uint8Array"); // BYTES
      default: return wrapArray("number"); // All numeric types
    }
  }

  if (field.fieldKind === "enum" || (field.fieldKind === "list" && field.listKind === "enum")) {
    const enumName = field.enum.name;
    return wrapArray(enumName);
  }

  if (field.fieldKind === "message" || (field.fieldKind === "list" && field.listKind === "message")) {
    const msgName = field.message.name;
    const msgTypeName = field.message.typeName;

    // Handle well-known types
    if (msgTypeName === "google.protobuf.Timestamp") {
      return wrapArray("string"); // Timestamps are serialized as ISO strings
    }

    return wrapArray(msgName);
  }

  if (field.fieldKind === "map") {
    return "Record<string, unknown>";
  }

  return "unknown";
}

/**
 * Escapes a regex pattern for use in generated code
 */
function escapePattern(pattern: string): string {
  return pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Generates a Zod schema for a single field
 */
function generateFieldSchema(
  f: GeneratedFile,
  field: DescField,
  context: TypeMapperContext,
  recursiveTypes: Set<string>
): void {
  const fieldName = toCamelCase(field.name);
  const typeInfo = mapFieldToZod(field, context);
  const validation = getValidationChain(field);

  // Determine if field is required early (needed for pattern handling)
  const fieldIsOptional = isFieldOptional(field);
  const fieldIsRequired = isFieldRequired(field) || validation.required;

  // Build the Zod type with validation chain
  let zodExpression = typeInfo.zodType;

  // Check if this field references a recursive type (including self-reference)
  if (field.fieldKind === "message" || (field.fieldKind === "list" && field.listKind === "message")) {
    const refMsgName = field.message.name;
    if (recursiveTypes.has(refMsgName)) {
      // Use z.lazy() for references to recursive types
      const schemaRef = toSchemaName(refMsgName);
      if (field.fieldKind === "list") {
        zodExpression = `z.array(z.lazy(() => ${schemaRef}))`;
      } else {
        zodExpression = `z.lazy(() => ${schemaRef})`;
      }
    }
  }

  // For list fields, apply item-level constraints from buf.validate
  if (field.fieldKind === "list" && (validation.itemMethods.length > 0 || validation.itemEnumNotIn.length > 0 || validation.itemStringPattern)) {
    // Extract the item type from z.array(itemType)
    const match = zodExpression.match(/^z\.array\((.+)\)$/);
    if (match) {
      let itemType = match[1];

      // Apply item methods (e.g., .uuid(), .min(), .max())
      for (const method of validation.itemMethods) {
        itemType += method;
      }

      // Apply item string pattern - items in arrays should validate if non-empty
      // (empty strings in arrays are typically not valid items)
      if (validation.itemStringPattern) {
        const escapedPattern = escapePattern(validation.itemStringPattern);
        itemType += `.refine((v) => v === "" || new RegExp("${escapedPattern}").test(v), { message: "Must match pattern: ${escapedPattern}" })`;
      }

      // Apply enum notIn constraint for items
      if (validation.itemEnumNotIn.length > 0) {
        const values = validation.itemEnumNotIn.join(", ");
        itemType += `.refine((e) => ![${values}].includes(e), { message: "Must not be one of: ${values}" })`;
      }

      zodExpression = `z.array(${itemType})`;
    }
  }

  // Add validation methods from buf.validate annotations
  for (const method of validation.methods) {
    zodExpression += method;
  }

  // Handle string pattern constraint
  // If required: use strict .regex()
  // If optional: use .refine() that allows empty strings (Proto3 default value)
  if (validation.stringPattern) {
    const escapedPattern = escapePattern(validation.stringPattern);
    if (fieldIsRequired) {
      zodExpression += `.regex(new RegExp("${escapedPattern}"))`;
    } else {
      zodExpression += `.refine((v) => v === "" || new RegExp("${escapedPattern}").test(v), { message: "Must match pattern: ${escapedPattern}" })`;
    }
  }

  // Handle enum defined_only constraint
  if (validation.enumDefinedOnly && field.fieldKind === "enum") {
    zodExpression += `.refine((v) => v !== 0, "Value is required")`;
  }

  // Handle optional fields
  if (fieldIsOptional && !fieldIsRequired) {
    zodExpression += ".optional()";
  }

  // Add field comment if deprecated
  if (field.deprecated) {
    f.print(`  /** @deprecated */`);
  }

  f.print(`  ${fieldName}: ${zodExpression},`);
}

/**
 * Analyzes message dependencies and returns sorted list plus recursive types
 */
interface DependencyAnalysis {
  sortedMessages: DescMessage[];
  recursiveTypes: Set<string>;
}

function analyzeMessageDependencies(
  messages: readonly DescMessage[],
  currentProtoPath: string
): DependencyAnalysis {
  const messageNames = new Set(messages.map((m) => m.name));
  // Map: message name -> messages it depends on (references)
  const dependencies = new Map<string, Set<string>>();
  const recursiveTypes = new Set<string>();

  // Initialize dependencies
  for (const msg of messages) {
    dependencies.set(msg.name, new Set());
  }

  // Build dependency graph (for messages in the same file)
  for (const msg of messages) {
    for (const field of msg.fields) {
      if (field.fieldKind === "message") {
        const refMsgName = field.message.name;
        if (messageNames.has(refMsgName) && field.message.file.name === currentProtoPath) {
          // msg depends on refMsgName (msg references refMsgName)
          dependencies.get(msg.name)!.add(refMsgName);

          // Check for self-reference (recursive type)
          if (refMsgName === msg.name) {
            recursiveTypes.add(msg.name);
          }
        }
      } else if (field.fieldKind === "list" && field.listKind === "message") {
        const refMsgName = field.message.name;
        if (messageNames.has(refMsgName) && field.message.file.name === currentProtoPath) {
          dependencies.get(msg.name)!.add(refMsgName);

          if (refMsgName === msg.name) {
            recursiveTypes.add(msg.name);
          }
        }
      }
    }
  }

  // Detect cycles (multi-step recursion)
  for (const msgName of messageNames) {
    if (hasCycle(msgName, dependencies, new Set())) {
      recursiveTypes.add(msgName);
    }
  }

  // Kahn's algorithm - remove self-loops for sorting purposes
  const inDegree = new Map<string, number>();
  for (const msg of messages) {
    inDegree.set(msg.name, 0);
  }

  for (const [msgName, deps] of dependencies) {
    for (const dep of deps) {
      if (dep !== msgName && !recursiveTypes.has(dep)) {
        // Don't count self-references or references to recursive types
        inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
      }
    }
  }

  // Start with messages that are not referenced by others (leaves)
  // Actually we need the opposite - start with messages that don't depend on others
  const result: DescMessage[] = [];
  const visited = new Set<string>();
  const queue: string[] = [];

  // Find messages with no dependencies (except self-refs and recursive)
  for (const msg of messages) {
    const deps = dependencies.get(msg.name)!;
    const nonSelfDeps = Array.from(deps).filter(d => d !== msg.name && !recursiveTypes.has(d));
    if (nonSelfDeps.length === 0) {
      queue.push(msg.name);
    }
  }

  while (queue.length > 0) {
    const name = queue.shift()!;
    if (visited.has(name)) continue;
    visited.add(name);

    const msg = messages.find((m) => m.name === name)!;
    result.push(msg);

    // Find messages that depend on this one and now have all deps satisfied
    for (const [otherName, deps] of dependencies) {
      if (visited.has(otherName)) continue;
      if (deps.has(name)) {
        // Check if all non-recursive deps are now satisfied
        const nonSelfDeps = Array.from(deps).filter(d => d !== otherName && !recursiveTypes.has(d));
        if (nonSelfDeps.every(d => visited.has(d))) {
          queue.push(otherName);
        }
      }
    }
  }

  // Append any remaining (circular dependencies handled by z.lazy)
  for (const msg of messages) {
    if (!result.includes(msg)) {
      result.push(msg);
    }
  }

  return { sortedMessages: result, recursiveTypes };
}

/**
 * Checks if there's a cycle starting from the given node
 */
function hasCycle(
  node: string,
  dependencies: Map<string, Set<string>>,
  visiting: Set<string>
): boolean {
  if (visiting.has(node)) return true;
  visiting.add(node);

  for (const dep of dependencies.get(node) ?? []) {
    if (hasCycle(dep, dependencies, visiting)) {
      return true;
    }
  }

  visiting.delete(node);
  return false;
}
