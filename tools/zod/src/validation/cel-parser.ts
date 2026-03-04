/**
 * CEL expression → Zod translation
 *
 * Covers standard CEL string, numeric, size, and logical patterns as
 * documented at https://celbyexample.com.  Compound expressions joined
 * with && are split and each part is translated independently.  Anything
 * that cannot be mapped to a native Zod method is emitted as a .refine()
 * with the original CEL embedded in the error message.
 */

import type { CelRule } from "./types.js";

/** Escape a string for safe embedding inside a JS double-quoted string literal */
function escapeString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Generate a fallback .refine() that always passes but carries the CEL as documentation */
function celToRefine(expression: string, message: string): string {
  const m = escapeString(message || "Validation failed");
  const e = escapeString(expression);
  return `.refine((_v) => true, { message: "${m} (CEL: ${e})" })`;
}

/**
 * Split an expression on a top-level logical operator (&&  or  ||)
 * without breaking inside parentheses, brackets, or string literals.
 */
function splitTopLevel(expr: string, operator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let current = "";

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];

    if (ch === "'" && !inDoubleQuote && expr[i - 1] !== "\\") {
      inSingleQuote = !inSingleQuote;
    } else if (ch === '"' && !inSingleQuote && expr[i - 1] !== "\\") {
      inDoubleQuote = !inDoubleQuote;
    } else if (!inSingleQuote && !inDoubleQuote) {
      if (ch === "(" || ch === "[") depth++;
      else if (ch === ")" || ch === "]") depth--;
    }

    if (
      depth === 0 &&
      !inSingleQuote &&
      !inDoubleQuote &&
      expr.substring(i, i + operator.length) === operator
    ) {
      parts.push(current);
      current = "";
      i += operator.length - 1; // skip rest of operator
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

/**
 * Top-level CEL → Zod translator.
 *
 * Returns an **array** of Zod method strings because a single CEL rule
 * joined with && can map to multiple independent Zod chain methods.
 */
function parseCelExpression(expression: string, message: string): string[] {
  const trimmed = expression.trim();

  // Compound && → split and translate each part independently
  const andParts = splitTopLevel(trimmed, "&&");
  if (andParts.length > 1) {
    const results: string[] = [];
    for (const part of andParts) {
      results.push(...parseSingleCelExpression(part.trim(), message));
    }
    return results;
  }

  // Compound || → single refine (cannot be decomposed)
  const orParts = splitTopLevel(trimmed, "||");
  if (orParts.length > 1) {
    return [celToRefine(trimmed, message)];
  }

  return parseSingleCelExpression(trimmed, message);
}

/**
 * Translates a single (non-compound) CEL expression to Zod method(s).
 */
function parseSingleCelExpression(expr: string, message: string): string[] {
  // ─── String methods on this ────────────────────────────────────

  // this.startsWith('…') / this.startsWith("…")
  const startsWithMatch = expr.match(/^this\.startsWith\(\s*['"](.+?)['"]\s*\)$/);
  if (startsWithMatch) return [`.startsWith("${startsWithMatch[1]}")`];

  // this.endsWith('…')
  const endsWithMatch = expr.match(/^this\.endsWith\(\s*['"](.+?)['"]\s*\)$/);
  if (endsWithMatch) return [`.endsWith("${endsWithMatch[1]}")`];

  // this.contains('…')
  const containsMatch = expr.match(/^this\.contains\(\s*['"](.+?)['"]\s*\)$/);
  if (containsMatch) return [`.includes("${containsMatch[1]}")`];

  // this.matches('…')  (RE2 regex)
  const matchesMatch = expr.match(/^this\.matches\(\s*['"](.+?)['"]\s*\)$/);
  if (matchesMatch) {
    const p = escapeString(matchesMatch[1]);
    return [`.regex(new RegExp("${p}"))`];
  }

  // ─── String transformation equality ────────────────────────────
  // this == this.lowerAscii()  or  this.lowerAscii() == this
  if (/^this\s*==\s*this\.lowerAscii\(\)$/.test(expr) || /^this\.lowerAscii\(\)\s*==\s*this$/.test(expr)) {
    return [`.refine((v) => v === v.toLowerCase(), { message: "${escapeString(message || "Must be lowercase")}" })`];
  }
  // this == this.upperAscii()  or  this.upperAscii() == this
  if (/^this\s*==\s*this\.upperAscii\(\)$/.test(expr) || /^this\.upperAscii\(\)\s*==\s*this$/.test(expr)) {
    return [`.refine((v) => v === v.toUpperCase(), { message: "${escapeString(message || "Must be uppercase")}" })`];
  }
  // this == this.trim()  or  this.trim() == this  (no leading/trailing whitespace)
  if (/^this\s*==\s*this\.trim\(\)$/.test(expr) || /^this\.trim\(\)\s*==\s*this$/.test(expr)) {
    return [`.refine((v) => v === v.trim(), { message: "${escapeString(message || "Must not have leading/trailing whitespace")}" })`];
  }

  // ─── size() comparisons  (this.size() or size(this)) ──────────
  const SIZE = String.raw`(?:this\.size\(\)|size\(this\))`;

  const sizeGte = expr.match(new RegExp(`^${SIZE}\\s*>=\\s*(\\d+)$`));
  if (sizeGte) return [`.min(${sizeGte[1]})`];

  const sizeGt = expr.match(new RegExp(`^${SIZE}\\s*>\\s*(\\d+)$`));
  if (sizeGt) return [`.min(${Number(sizeGt[1]) + 1})`];

  const sizeLte = expr.match(new RegExp(`^${SIZE}\\s*<=\\s*(\\d+)$`));
  if (sizeLte) return [`.max(${sizeLte[1]})`];

  const sizeLt = expr.match(new RegExp(`^${SIZE}\\s*<\\s*(\\d+)$`));
  if (sizeLt) return [`.max(${Number(sizeLt[1]) - 1})`];

  const sizeEq = expr.match(new RegExp(`^${SIZE}\\s*==\\s*(\\d+)$`));
  if (sizeEq) return [`.length(${sizeEq[1]})`];

  const sizeNeq = expr.match(new RegExp(`^${SIZE}\\s*!=\\s*(\\d+)$`));
  if (sizeNeq) {
    const n = sizeNeq[1];
    return [`.refine((v) => v.length !== ${n}, { message: "${escapeString(message || `Length must not be ${n}`)}" })`];
  }

  // ─── Direct numeric comparisons on this ────────────────────────
  const NUM = String.raw`(-?\d+(?:\.\d+)?)`;

  const numGte = expr.match(new RegExp(`^this\\s*>=\\s*${NUM}$`));
  if (numGte) return [`.gte(${numGte[1]})`];

  const numGt = expr.match(new RegExp(`^this\\s*>\\s*${NUM}$`));
  if (numGt) return [`.gt(${numGt[1]})`];

  const numLte = expr.match(new RegExp(`^this\\s*<=\\s*${NUM}$`));
  if (numLte) return [`.lte(${numLte[1]})`];

  const numLt = expr.match(new RegExp(`^this\\s*<\\s*${NUM}$`));
  if (numLt) return [`.lt(${numLt[1]})`];

  // ─── Equality with literal ─────────────────────────────────────
  // this == 'value' / this == "value"
  const strEq = expr.match(/^this\s*==\s*['"](.+?)['"]$/);
  if (strEq) {
    return [`.refine((v) => v === "${escapeString(strEq[1])}", { message: "${escapeString(message || `Must equal '${strEq[1]}'`)}" })`];
  }
  // this != 'value'
  const strNeq = expr.match(/^this\s*!=\s*['"](.+?)['"]$/);
  if (strNeq) {
    return [`.refine((v) => v !== "${escapeString(strNeq[1])}", { message: "${escapeString(message || `Must not equal '${strNeq[1]}'`)}" })`];
  }

  // this == N (numeric)
  const numEq = expr.match(new RegExp(`^this\\s*==\\s*${NUM}$`));
  if (numEq) {
    return [`.refine((v) => v === ${numEq[1]}, { message: "${escapeString(message || `Must equal ${numEq[1]}`)}" })`];
  }
  // this != N
  const numNeq = expr.match(new RegExp(`^this\\s*!=\\s*${NUM}$`));
  if (numNeq) {
    return [`.refine((v) => v !== ${numNeq[1]}, { message: "${escapeString(message || `Must not equal ${numNeq[1]}`)}" })`];
  }

  // ─── in operator ───────────────────────────────────────────────
  // this in ['a', 'b'] or this in [1, 2]
  const inMatch = expr.match(/^this\s+in\s+\[(.+)]$/);
  if (inMatch) {
    // Convert CEL single-quoted strings to JS double-quoted
    const jsElements = inMatch[1].replace(/'/g, '"');
    return [`.refine((v) => [${jsElements}].includes(v), { message: "${escapeString(message || "Must be one of the allowed values")}" })`];
  }

  // ─── Negated expressions ───────────────────────────────────────
  // !this.contains('…')
  const negContains = expr.match(/^!\s*this\.contains\(\s*['"](.+?)['"]\s*\)$/);
  if (negContains) {
    return [`.refine((v) => !v.includes("${negContains[1]}"), { message: "${escapeString(message || `Must not contain '${negContains[1]}'`)}" })`];
  }
  // !this.startsWith('…')
  const negStartsWith = expr.match(/^!\s*this\.startsWith\(\s*['"](.+?)['"]\s*\)$/);
  if (negStartsWith) {
    return [`.refine((v) => !v.startsWith("${negStartsWith[1]}"), { message: "${escapeString(message || `Must not start with '${negStartsWith[1]}'`)}" })`];
  }
  // !this.endsWith('…')
  const negEndsWith = expr.match(/^!\s*this\.endsWith\(\s*['"](.+?)['"]\s*\)$/);
  if (negEndsWith) {
    return [`.refine((v) => !v.endsWith("${negEndsWith[1]}"), { message: "${escapeString(message || `Must not end with '${negEndsWith[1]}'`)}" })`];
  }
  // !this.matches('…')
  const negMatches = expr.match(/^!\s*this\.matches\(\s*['"](.+?)['"]\s*\)$/);
  if (negMatches) {
    const p = escapeString(negMatches[1]);
    return [`.refine((v) => !new RegExp("${p}").test(v), { message: "${escapeString(message || "Must not match pattern")}" })`];
  }

  // ─── Fallback: unrecognized CEL → no-op refine with message ───
  return [celToRefine(expr, message)];
}

/**
 * Process CEL constraints and push results to the given methods array
 */
export function processCelRules(celRules: CelRule[], target: string[]): void {
  for (const rule of celRules) {
    if (!rule.expression) continue;
    const methods = parseCelExpression(rule.expression, rule.message || rule.id || "");
    for (const method of methods) {
      target.push(method);
    }
  }
}
