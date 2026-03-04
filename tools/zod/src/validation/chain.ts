/**
 * Extracts buf.validate constraints from protobuf fields and builds ValidationChains
 */

import type { DescField, DescEnum } from "@bufbuild/protobuf";
import { getExtension, hasExtension } from "@bufbuild/protobuf";
import { field as fieldExtension } from "@buf/bufbuild_protovalidate.bufbuild_es/buf/validate/validate_pb.js";
import type { ValidationChain, CelRule } from "./types.js";
import { fieldTarget } from "./types.js";
import { processTypeConstraints, processRepeatedConstraints, processMapConstraints } from "./constraint-processors.js";
import { processCelRules } from "./cel-parser.js";

/**
 * Extracts buf.validate constraints from a field and returns Zod validation chain
 */
export function getValidationChain(field: DescField): ValidationChain {
  const chain: ValidationChain = {
    methods: [],
    required: false,
    enumDefinedOnly: false,
    itemMethods: [],
    itemEnumNotIn: [],
  };

  try {
    const options = field.proto.options;
    if (!options) {
      return chain;
    }

    if (!hasExtension(options, fieldExtension)) {
      return chain;
    }

    const constraints = getExtension(options, fieldExtension) as {
      required?: boolean;
      type?: { case: string; value: unknown };
      cel?: CelRule[];
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
        case "repeated":
          processRepeatedConstraints(type.value, chain);
          break;
        case "map":
          processMapConstraints(type.value, chain);
          break;
        default:
          processTypeConstraints(type, fieldTarget(chain));
          break;
      }
    }

    // Process CEL constraints
    if (constraints.cel && constraints.cel.length > 0) {
      processCelRules(constraints.cel, chain.methods);
    }
  } catch (error) {
    console.error(`Warning: Could not read validation constraints for field ${field.name}:`, error);
  }

  return chain;
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
