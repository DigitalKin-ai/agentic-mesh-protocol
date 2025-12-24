/**
 * Maps buf.validate annotations to Zod validation chains
 *
 * This module reads buf.validate field constraints and converts them
 * to equivalent Zod validation methods.
 */

import type { DescField, DescEnum } from "@bufbuild/protobuf";
import { getExtension, hasExtension } from "@bufbuild/protobuf";
import { field as fieldExtension } from "@buf/bufbuild_protovalidate.bufbuild_es/buf/validate/validate_pb.js";

export interface ValidationChain {
  /** Zod methods to chain, e.g., [".min(1)", ".max(100)", ".email()"] */
  methods: string[];
  /** Whether the field is required (not optional) */
  required: boolean;
  /** Whether enum should filter out UNSPECIFIED (value 0) */
  enumDefinedOnly: boolean;
}

/**
 * Extracts buf.validate constraints from a field and returns Zod validation chain
 */
export function getValidationChain(field: DescField): ValidationChain {
  const chain: ValidationChain = {
    methods: [],
    required: false,
    enumDefinedOnly: false,
  };

  try {
    // Get field options - this is where extensions are stored
    const options = field.proto.options;
    if (!options) {
      return chain;
    }

    // Check if field has buf.validate.field extension
    if (!hasExtension(options, fieldExtension)) {
      return chain;
    }

    const constraints = getExtension(options, fieldExtension) as {
      required?: boolean;
      type?: { case: string; value: unknown };
    };
    if (!constraints) {
      return chain;
    }

    // Check required constraint
    if (constraints.required) {
      chain.required = true;
    }

    // Process type-specific constraints
    const type = constraints.type;
    if (type) {
      switch (type.case) {
        case "string":
          processStringConstraints(type.value, chain);
          break;
        case "bytes":
          processBytesConstraints(type.value, chain);
          break;
        case "int32":
        case "int64":
        case "uint32":
        case "uint64":
        case "sint32":
        case "sint64":
        case "fixed32":
        case "fixed64":
        case "sfixed32":
        case "sfixed64":
          processNumericConstraints(type.value, chain);
          break;
        case "float":
        case "double":
          processFloatConstraints(type.value, chain);
          break;
        case "bool":
          processBoolConstraints(type.value, chain);
          break;
        case "enum":
          processEnumConstraints(type.value, chain);
          break;
        case "repeated":
          processRepeatedConstraints(type.value, chain);
          break;
        case "map":
          processMapConstraints(type.value, chain);
          break;
      }
    }
  } catch (error) {
    // If we can't read the extension, return empty chain
    // This can happen if protovalidate types aren't fully loaded
    console.error(`Warning: Could not read validation constraints for field ${field.name}:`, error);
  }

  return chain;
}

/**
 * Process string-specific constraints
 */
function processStringConstraints(constraints: any, chain: ValidationChain): void {
  // Length constraints - handle BigInt, skip default values (0)
  if (constraints.minLen !== undefined && constraints.minLen > 0n) {
    chain.methods.push(`.min(${Number(constraints.minLen)})`);
  }
  if (constraints.maxLen !== undefined && constraints.maxLen > 0n) {
    chain.methods.push(`.max(${Number(constraints.maxLen)})`);
  }
  if (constraints.len !== undefined && constraints.len > 0n) {
    chain.methods.push(`.length(${Number(constraints.len)})`);
  }

  // Pattern/regex constraint
  if (constraints.pattern) {
    const escapedPattern = constraints.pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    chain.methods.push(`.regex(new RegExp("${escapedPattern}"))`);
  }

  // Prefix/suffix constraints
  if (constraints.prefix) {
    chain.methods.push(`.startsWith("${constraints.prefix}")`);
  }
  if (constraints.suffix) {
    chain.methods.push(`.endsWith("${constraints.suffix}")`);
  }
  if (constraints.contains) {
    chain.methods.push(`.includes("${constraints.contains}")`);
  }

  // Well-known format constraints (check wellKnown oneof)
  const wellKnown = constraints.wellKnown;
  if (wellKnown) {
    switch (wellKnown.case) {
      case "email":
        if (wellKnown.value) chain.methods.push(".email()");
        break;
      case "hostname":
        if (wellKnown.value) chain.methods.push('.regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*$/)');
        break;
      case "ip":
        if (wellKnown.value) chain.methods.push(".ip()");
        break;
      case "ipv4":
        if (wellKnown.value) chain.methods.push('.ip({ version: "v4" })');
        break;
      case "ipv6":
        if (wellKnown.value) chain.methods.push('.ip({ version: "v6" })');
        break;
      case "uri":
        if (wellKnown.value) chain.methods.push(".url()");
        break;
      case "uuid":
        if (wellKnown.value) chain.methods.push(".uuid()");
        break;
    }
  }
}

/**
 * Process bytes-specific constraints
 */
function processBytesConstraints(constraints: any, chain: ValidationChain): void {
  if (constraints.minLen !== undefined && constraints.minLen > 0n) {
    chain.methods.push(`.refine((b) => b.length >= ${Number(constraints.minLen)}, { message: "Bytes must be at least ${constraints.minLen} bytes" })`);
  }
  if (constraints.maxLen !== undefined) {
    chain.methods.push(`.refine((b) => b.length <= ${Number(constraints.maxLen)}, { message: "Bytes must be at most ${constraints.maxLen} bytes" })`);
  }
}

/**
 * Process numeric (integer) constraints
 */
function processNumericConstraints(constraints: any, chain: ValidationChain): void {
  // Handle greaterThan oneof
  const greaterThan = constraints.greaterThan;
  if (greaterThan) {
    switch (greaterThan.case) {
      case "gt":
        chain.methods.push(`.gt(${Number(greaterThan.value)})`);
        break;
      case "gte":
        chain.methods.push(`.gte(${Number(greaterThan.value)})`);
        break;
    }
  }

  // Handle lessThan oneof
  const lessThan = constraints.lessThan;
  if (lessThan) {
    switch (lessThan.case) {
      case "lt":
        chain.methods.push(`.lt(${Number(lessThan.value)})`);
        break;
      case "lte":
        chain.methods.push(`.lte(${Number(lessThan.value)})`);
        break;
    }
  }

  if (constraints.const !== undefined) {
    chain.methods.push(`.refine((n) => n === ${Number(constraints.const)}, { message: "Must equal ${constraints.const}" })`);
  }
  if (constraints.in && constraints.in.length > 0) {
    const values = constraints.in.map((v: any) => Number(v)).join(", ");
    chain.methods.push(`.refine((n) => [${values}].includes(n), { message: "Must be one of: ${values}" })`);
  }
  if (constraints.notIn && constraints.notIn.length > 0) {
    const values = constraints.notIn.map((v: any) => Number(v)).join(", ");
    chain.methods.push(`.refine((n) => ![${values}].includes(n), { message: "Must not be one of: ${values}" })`);
  }
}

/**
 * Process float/double constraints
 */
function processFloatConstraints(constraints: any, chain: ValidationChain): void {
  // Handle greaterThan oneof
  const greaterThan = constraints.greaterThan;
  if (greaterThan) {
    switch (greaterThan.case) {
      case "gt":
        chain.methods.push(`.gt(${greaterThan.value})`);
        break;
      case "gte":
        chain.methods.push(`.gte(${greaterThan.value})`);
        break;
    }
  }

  // Handle lessThan oneof
  const lessThan = constraints.lessThan;
  if (lessThan) {
    switch (lessThan.case) {
      case "lt":
        chain.methods.push(`.lt(${lessThan.value})`);
        break;
      case "lte":
        chain.methods.push(`.lte(${lessThan.value})`);
        break;
    }
  }

  if (constraints.finite) {
    chain.methods.push(".finite()");
  }
}

/**
 * Process bool constraints
 */
function processBoolConstraints(constraints: any, chain: ValidationChain): void {
  if (constraints.const !== undefined) {
    chain.methods.push(`.refine((b) => b === ${constraints.const}, { message: "Must be ${constraints.const}" })`);
  }
}

/**
 * Process enum constraints
 */
function processEnumConstraints(constraints: any, chain: ValidationChain): void {
  if (constraints.definedOnly) {
    chain.enumDefinedOnly = true;
  }
  if (constraints.in && constraints.in.length > 0) {
    const values = constraints.in.join(", ");
    chain.methods.push(`.refine((e) => [${values}].includes(e), { message: "Must be one of: ${values}" })`);
  }
  if (constraints.notIn && constraints.notIn.length > 0) {
    const values = constraints.notIn.join(", ");
    chain.methods.push(`.refine((e) => ![${values}].includes(e), { message: "Must not be one of: ${values}" })`);
  }
}

/**
 * Process repeated (array) constraints
 */
function processRepeatedConstraints(constraints: any, chain: ValidationChain): void {
  if (constraints.minItems !== undefined && constraints.minItems > 0n) {
    chain.methods.push(`.min(${Number(constraints.minItems)})`);
  }
  if (constraints.maxItems !== undefined) {
    chain.methods.push(`.max(${Number(constraints.maxItems)})`);
  }
  if (constraints.unique) {
    chain.methods.push('.refine((arr) => new Set(arr).size === arr.length, { message: "Items must be unique" })');
  }
}

/**
 * Process map constraints
 */
function processMapConstraints(constraints: any, chain: ValidationChain): void {
  if (constraints.minPairs !== undefined && constraints.minPairs > 0n) {
    chain.methods.push(`.refine((m) => Object.keys(m).length >= ${Number(constraints.minPairs)}, { message: "Map must have at least ${constraints.minPairs} entries" })`);
  }
  if (constraints.maxPairs !== undefined) {
    chain.methods.push(`.refine((m) => Object.keys(m).length <= ${Number(constraints.maxPairs)}, { message: "Map must have at most ${constraints.maxPairs} entries" })`);
  }
}

/**
 * Check if a field is marked as required via buf.validate
 */
export function isFieldRequired(field: DescField): boolean {
  try {
    const options = field.proto.options;
    if (!options) {
      return false;
    }
    if (!hasExtension(options, fieldExtension)) {
      return false;
    }
    const constraints = getExtension(options, fieldExtension) as { required?: boolean };
    return constraints?.required ?? false;
  } catch {
    return false;
  }
}

/**
 * Get enum values excluding UNSPECIFIED (value 0) for defined_only constraint
 */
export function getDefinedEnumValues(enumType: DescEnum): number[] {
  return enumType.values.filter(v => v.number !== 0).map(v => v.number);
}
