/**
 * Constraint processors for buf.validate type-specific rules.
 *
 * Each processor is unified via MethodTarget to handle both field-level
 * and item-level constraints without duplication.
 */

import type { ValidationChain, MethodTarget } from "./types.js";
import { itemTarget } from "./types.js";
import { processCelRules } from "./cel-parser.js";

/**
 * Dispatches to the correct processor based on constraint type case.
 * Used by both getValidationChain (field-level) and processRepeatedConstraints (item-level).
 */
export function processTypeConstraints(
  type: { case: string; value: unknown },
  target: MethodTarget,
): void {
  switch (type.case) {
    case "string":
      processStringConstraints(type.value, target);
      break;
    case "bytes":
      processBytesConstraints(type.value, target);
      break;
    case "int32":
    case "uint32":
    case "sint32":
    case "fixed32":
    case "sfixed32":
      processNumericConstraints(type.value, target);
      break;
    case "int64":
    case "uint64":
    case "sint64":
    case "fixed64":
    case "sfixed64":
      // int64/uint64 are strings in TypeScript (forceLong=string)
      processInt64Constraints(type.value, target);
      break;
    case "float":
    case "double":
      processFloatConstraints(type.value, target);
      break;
    case "bool":
      processBoolConstraints(type.value, target);
      break;
    case "enum":
      processEnumConstraints(type.value, target);
      break;
  }
}

/** Process string-specific constraints */
function processStringConstraints(constraints: any, target: MethodTarget): void {
  // Length constraints - handle BigInt, skip default values (0)
  if (constraints.minLen !== undefined && constraints.minLen > 0n) {
    target.methods.push(`.min(${Number(constraints.minLen)})`);
  }
  if (constraints.maxLen !== undefined && constraints.maxLen > 0n) {
    target.methods.push(`.max(${Number(constraints.maxLen)})`);
  }
  if (constraints.len !== undefined && constraints.len > 0n) {
    target.methods.push(`.length(${Number(constraints.len)})`);
  }

  // Pattern/regex constraint - stored separately to handle optional fields
  if (constraints.pattern) {
    target.setStringPattern(constraints.pattern);
  }

  // Prefix/suffix constraints
  if (constraints.prefix) {
    target.methods.push(`.startsWith("${constraints.prefix}")`);
  }
  if (constraints.suffix) {
    target.methods.push(`.endsWith("${constraints.suffix}")`);
  }
  if (constraints.contains) {
    target.methods.push(`.includes("${constraints.contains}")`);
  }

  // Well-known format constraints (check wellKnown oneof)
  const wellKnown = constraints.wellKnown;
  if (wellKnown) {
    switch (wellKnown.case) {
      case "email":
        if (wellKnown.value) target.methods.push(".email()");
        break;
      case "hostname":
        if (wellKnown.value) target.methods.push('.regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*$/)');
        break;
      case "ip":
        if (wellKnown.value) target.methods.push(".ip()");
        break;
      case "ipv4":
        if (wellKnown.value) target.methods.push('.ip({ version: "v4" })');
        break;
      case "ipv6":
        if (wellKnown.value) target.methods.push('.ip({ version: "v6" })');
        break;
      case "uri":
        if (wellKnown.value) target.methods.push(".url()");
        break;
      case "uuid":
        if (wellKnown.value) target.methods.push(".uuid()");
        break;
    }
  }
}

/** Process bytes-specific constraints */
function processBytesConstraints(constraints: any, target: MethodTarget): void {
  if (constraints.minLen !== undefined && constraints.minLen > 0n) {
    target.methods.push(`.refine((b) => b.length >= ${Number(constraints.minLen)}, { message: "Bytes must be at least ${constraints.minLen} bytes" })`);
  }
  if (constraints.maxLen !== undefined && constraints.maxLen > 0n) {
    target.methods.push(`.refine((b) => b.length <= ${Number(constraints.maxLen)}, { message: "Bytes must be at most ${constraints.maxLen} bytes" })`);
  }
}

/** Process numeric (integer) constraints */
function processNumericConstraints(constraints: any, target: MethodTarget): void {
  const greaterThan = constraints.greaterThan;
  if (greaterThan) {
    switch (greaterThan.case) {
      case "gt":
        target.methods.push(`.gt(${Number(greaterThan.value)})`);
        break;
      case "gte":
        target.methods.push(`.gte(${Number(greaterThan.value)})`);
        break;
    }
  }

  const lessThan = constraints.lessThan;
  if (lessThan) {
    switch (lessThan.case) {
      case "lt":
        target.methods.push(`.lt(${Number(lessThan.value)})`);
        break;
      case "lte":
        target.methods.push(`.lte(${Number(lessThan.value)})`);
        break;
    }
  }

  if (constraints.const !== undefined && Number(constraints.const) !== 0) {
    target.methods.push(`.refine((n) => n === ${Number(constraints.const)}, { message: "Must equal ${constraints.const}" })`);
  }
  if (constraints.in && constraints.in.length > 0) {
    const values = constraints.in.map((v: any) => Number(v)).join(", ");
    target.methods.push(`.refine((n) => [${values}].includes(n), { message: "Must be one of: ${values}" })`);
  }
  if (constraints.notIn && constraints.notIn.length > 0) {
    const values = constraints.notIn.map((v: any) => Number(v)).join(", ");
    target.methods.push(`.refine((n) => ![${values}].includes(n), { message: "Must not be one of: ${values}" })`);
  }
}

/** Process int64/uint64 constraints (these are strings in TypeScript with forceLong=string) */
function processInt64Constraints(constraints: any, target: MethodTarget): void {
  const greaterThan = constraints.greaterThan;
  if (greaterThan) {
    switch (greaterThan.case) {
      case "gt":
        target.methods.push(`.refine((s) => BigInt(s) > ${greaterThan.value}n, { message: "Must be > ${greaterThan.value}" })`);
        break;
      case "gte":
        target.methods.push(`.refine((s) => BigInt(s) >= ${greaterThan.value}n, { message: "Must be >= ${greaterThan.value}" })`);
        break;
    }
  }

  const lessThan = constraints.lessThan;
  if (lessThan) {
    switch (lessThan.case) {
      case "lt":
        target.methods.push(`.refine((s) => BigInt(s) < ${lessThan.value}n, { message: "Must be < ${lessThan.value}" })`);
        break;
      case "lte":
        target.methods.push(`.refine((s) => BigInt(s) <= ${lessThan.value}n, { message: "Must be <= ${lessThan.value}" })`);
        break;
    }
  }

  if (constraints.const !== undefined && Number(constraints.const) !== 0) {
    target.methods.push(`.refine((s) => BigInt(s) === ${constraints.const}n, { message: "Must equal ${constraints.const}" })`);
  }
  if (constraints.in && constraints.in.length > 0) {
    const values = constraints.in.map((v: any) => `${v}n`).join(", ");
    target.methods.push(`.refine((s) => [${values}].includes(BigInt(s)), { message: "Must be one of: ${constraints.in.join(", ")}" })`);
  }
  if (constraints.notIn && constraints.notIn.length > 0) {
    const values = constraints.notIn.map((v: any) => `${v}n`).join(", ");
    target.methods.push(`.refine((s) => ![${values}].includes(BigInt(s)), { message: "Must not be one of: ${constraints.notIn.join(", ")}" })`);
  }
}

/** Process float/double constraints */
function processFloatConstraints(constraints: any, target: MethodTarget): void {
  const greaterThan = constraints.greaterThan;
  if (greaterThan) {
    switch (greaterThan.case) {
      case "gt":
        target.methods.push(`.gt(${greaterThan.value})`);
        break;
      case "gte":
        target.methods.push(`.gte(${greaterThan.value})`);
        break;
    }
  }

  const lessThan = constraints.lessThan;
  if (lessThan) {
    switch (lessThan.case) {
      case "lt":
        target.methods.push(`.lt(${lessThan.value})`);
        break;
      case "lte":
        target.methods.push(`.lte(${lessThan.value})`);
        break;
    }
  }

  if (constraints.finite) {
    target.methods.push(".finite()");
  }
}

/** Process bool constraints */
function processBoolConstraints(constraints: any, target: MethodTarget): void {
  if (constraints.const !== undefined) {
    target.methods.push(`.refine((b) => b === ${constraints.const}, { message: "Must be ${constraints.const}" })`);
  }
}

/** Process enum constraints */
function processEnumConstraints(constraints: any, target: MethodTarget): void {
  if (constraints.definedOnly) {
    target.setEnumDefinedOnly(true);
  }
  if (constraints.in && constraints.in.length > 0) {
    const values = constraints.in.join(", ");
    target.methods.push(`.refine((e) => [${values}].includes(e), { message: "Must be one of: ${values}" })`);
  }
  if (constraints.notIn && constraints.notIn.length > 0) {
    target.setEnumNotIn(constraints.notIn.map((v: any) => Number(v)));
  }
}

/** Process repeated (array) constraints */
export function processRepeatedConstraints(constraints: any, chain: ValidationChain): void {
  if (constraints.minItems !== undefined && constraints.minItems > 0n) {
    chain.methods.push(`.min(${Number(constraints.minItems)})`);
  }
  if (constraints.maxItems !== undefined && constraints.maxItems > 0n) {
    chain.methods.push(`.max(${Number(constraints.maxItems)})`);
  }
  if (constraints.unique) {
    chain.methods.push('.refine((arr) => new Set(arr).size === arr.length, { message: "Items must be unique" })');
  }

  // Process item-level constraints via the unified processTypeConstraints
  const items = constraints.items;
  if (items) {
    if (items.type) {
      processTypeConstraints(items.type, itemTarget(chain));
    }

    // Process item-level CEL constraints
    if (items.cel && items.cel.length > 0) {
      processCelRules(items.cel, chain.itemMethods);
    }
  }
}

/** Process map constraints */
export function processMapConstraints(constraints: any, chain: ValidationChain): void {
  if (constraints.minPairs !== undefined && constraints.minPairs > 0n) {
    chain.methods.push(`.refine((m) => Object.keys(m).length >= ${Number(constraints.minPairs)}, { message: "Map must have at least ${constraints.minPairs} entries" })`);
  }
  if (constraints.maxPairs !== undefined && constraints.maxPairs > 0n) {
    chain.methods.push(`.refine((m) => Object.keys(m).length <= ${Number(constraints.maxPairs)}, { message: "Map must have at most ${constraints.maxPairs} entries" })`);
  }
}
