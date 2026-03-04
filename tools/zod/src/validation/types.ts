/**
 * Types and abstractions for buf.validate → Zod validation mapping
 */

export interface ValidationChain {
  /** Zod methods to chain, e.g., [".min(1)", ".max(100)", ".email()"] */
  methods: string[];
  /** Whether the field is required (not optional) */
  required: boolean;
  /** Whether enum should filter out UNSPECIFIED (value 0) */
  enumDefinedOnly: boolean;
  /** Zod methods to apply to array items (for repeated fields with items constraints) */
  itemMethods: string[];
  /** Whether enum items should filter out UNSPECIFIED (value 0) */
  itemEnumNotIn: number[];
  /** String pattern constraint (stored separately to handle optional fields) */
  stringPattern?: string;
  /** String pattern for array items */
  itemStringPattern?: string;
}

/** Represents a single CEL constraint rule from buf.validate */
export interface CelRule {
  id: string;
  message: string;
  expression: string;
}

/**
 * Abstraction over field-level vs item-level targets.
 * Allows constraint processors to be written once and used for both.
 */
export interface MethodTarget {
  methods: string[];
  setStringPattern: (pattern: string) => void;
  setEnumDefinedOnly: (value: boolean) => void;
  setEnumNotIn: (values: number[]) => void;
}

/** Creates a MethodTarget that writes to field-level properties of a ValidationChain */
export function fieldTarget(chain: ValidationChain): MethodTarget {
  return {
    methods: chain.methods,
    setStringPattern: (pattern: string) => {
      chain.stringPattern = pattern;
    },
    setEnumDefinedOnly: (value: boolean) => {
      chain.enumDefinedOnly = value;
    },
    setEnumNotIn: (values: number[]) => {
      const valuesStr = values.join(", ");
      chain.methods.push(
        `.refine((e) => ![${valuesStr}].includes(e), { message: "Must not be one of: ${valuesStr}" })`,
      );
    },
  };
}

/** Creates a MethodTarget that writes to item-level properties of a ValidationChain */
export function itemTarget(chain: ValidationChain): MethodTarget {
  return {
    methods: chain.itemMethods,
    setStringPattern: (pattern: string) => {
      chain.itemStringPattern = pattern;
    },
    setEnumDefinedOnly: (value: boolean) => {
      chain.enumDefinedOnly = value;
    },
    setEnumNotIn: (values: number[]) => {
      chain.itemEnumNotIn = values;
    },
  };
}
