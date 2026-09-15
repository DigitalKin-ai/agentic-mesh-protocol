/**
 * CEL → JavaScript compiler for the ts-proto shape.
 *
 * A rule expression is parsed, type-checked against the message descriptors, and compiled
 * into a JavaScript expression over `v` (the value `this` denotes, in ts-proto shape).
 * The compiled code reproduces protovalidate's evaluation:
 *
 * - proto field reads yield the proto3 default when a property is absent (`?? ""`, `?? 0`...),
 *   and an unset message reads as its default instance;
 * - CEL `int` / `uint` values are BigInt (int32, enums and forceLong=string int64 alike),
 *   `double` values are numbers, timestamps are milliseconds;
 * - `size()` of a string counts code points, `has()` follows the field presence.
 *
 * Anything outside the supported subset throws CelUnsupportedError: the generation fails
 * instead of emitting a check that would accept values protovalidate refuses.
 */

import { ScalarType, type DescField, type DescMessage } from "@bufbuild/protobuf";
import { parseCel, CelSyntaxError, type Expr } from "./parser.js";
import { regex } from "../../runtime/zod_rules.js";
import { tsProtoFieldName } from "../../utils.js";

export type CelType =
  | { k: "bool" }
  | { k: "int" }
  | { k: "uint" }
  | { k: "double" }
  | { k: "string" }
  | { k: "bytes" }
  | { k: "timestamp" }
  | { k: "list"; elem: CelType }
  | { k: "map" }
  | { k: "message"; desc: DescMessage }
  | { k: "opaque"; name: string };

export class CelUnsupportedError extends Error {}

const BOOL: CelType = { k: "bool" };
const INT: CelType = { k: "int" };
const UINT: CelType = { k: "uint" };
const DOUBLE: CelType = { k: "double" };
const STRING: CelType = { k: "string" };
const BYTES: CelType = { k: "bytes" };
const TIMESTAMP: CelType = { k: "timestamp" };

const INT64_MIN = -(BigInt(2) ** BigInt(63));
const INT64_MAX = BigInt(2) ** BigInt(63) - BigInt(1);
const UINT64_MAX = BigInt(2) ** BigInt(64) - BigInt(1);

/** A compiled CEL value: a JavaScript expression and its CEL type */
export interface Compiled {
  js: string;
  type: CelType;
  /** Literal value of a string literal, for the patterns checked at generation time */
  literal?: string;
}

interface Env {
  vars: Map<string, Compiled>;
  depth: number;
}

export interface CompiledRule {
  /** JavaScript expression over `v`, returning a boolean (true = valid) or a string ("" = valid) */
  js: string;
  resultType: "bool" | "string";
}

function typeName(t: CelType): string {
  switch (t.k) {
    case "list":
      return `list(${typeName(t.elem)})`;
    case "message":
      return t.desc.typeName;
    case "opaque":
      return t.name;
    default:
      return t.k;
  }
}

function same(a: CelType, b: CelType): boolean {
  if (a.k !== b.k) return false;
  if (a.k === "list" && b.k === "list") return same(a.elem, b.elem);
  if (a.k === "message" && b.k === "message") return a.desc.typeName === b.desc.typeName;
  if (a.k === "opaque" && b.k === "opaque") return a.name === b.name;
  return true;
}

function isIntegral(t: CelType): boolean {
  return t.k === "int" || t.k === "uint";
}

function is64Bit(scalar: ScalarType): boolean {
  return (
    scalar === ScalarType.INT64 ||
    scalar === ScalarType.UINT64 ||
    scalar === ScalarType.SINT64 ||
    scalar === ScalarType.FIXED64 ||
    scalar === ScalarType.SFIXED64
  );
}

/** CEL type of a proto scalar. */
export function scalarCelType(scalar: ScalarType): CelType {
  switch (scalar) {
    case ScalarType.STRING:
      return STRING;
    case ScalarType.BOOL:
      return BOOL;
    case ScalarType.BYTES:
      return BYTES;
    case ScalarType.DOUBLE:
    case ScalarType.FLOAT:
      return DOUBLE;
    case ScalarType.UINT32:
    case ScalarType.UINT64:
    case ScalarType.FIXED32:
    case ScalarType.FIXED64:
      return UINT;
    default:
      return INT;
  }
}

/** CEL type of a message used as a value. */
export function messageCelType(desc: DescMessage): CelType {
  switch (desc.typeName) {
    case "google.protobuf.Timestamp":
      return TIMESTAMP;
    case "google.protobuf.Duration":
    case "google.protobuf.Any":
    case "google.protobuf.Struct":
    case "google.protobuf.Value":
    case "google.protobuf.ListValue":
    case "google.protobuf.FieldMask":
    case "google.protobuf.DoubleValue":
    case "google.protobuf.FloatValue":
    case "google.protobuf.Int64Value":
    case "google.protobuf.UInt64Value":
    case "google.protobuf.Int32Value":
    case "google.protobuf.UInt32Value":
    case "google.protobuf.BoolValue":
    case "google.protobuf.StringValue":
    case "google.protobuf.BytesValue":
      return { k: "opaque", name: desc.typeName };
    default:
      return { k: "message", desc };
  }
}

/** CEL type of a field read. */
export function fieldCelType(field: DescField): CelType {
  switch (field.fieldKind) {
    case "scalar":
      return scalarCelType(field.scalar);
    case "enum":
      return INT;
    case "message":
      return messageCelType(field.message);
    case "list":
      return {
        k: "list",
        elem: field.listKind === "scalar" ? scalarCelType(field.scalar) : field.listKind === "enum" ? INT : messageCelType(field.message),
      };
    case "map":
      return { k: "map" };
  }
}

/**
 * Converts a raw ts-proto value (a JS expression) of a field, list item or map value into
 * its CEL representation.
 */
export function rawToCel(raw: string, kind: { scalar?: ScalarType; isEnum?: boolean; message?: DescMessage; list?: boolean }): Compiled {
  const one = (x: string): Compiled => {
    if (kind.isEnum) return { js: `BigInt(${x})`, type: INT };
    if (kind.message) {
      const t = messageCelType(kind.message);
      return { js: t.k === "timestamp" ? `__r.tsMillis(${x})` : x, type: t };
    }
    const t = scalarCelType(kind.scalar!);
    if (isIntegral(t)) return { js: `BigInt(${x})`, type: t };
    return { js: x, type: t };
  };
  if (kind.list) {
    const elem = one("x");
    return { js: elem.js === "x" ? raw : `${raw}.map((x: any) => ${elem.js})`, type: { k: "list", elem: elem.type } };
  }
  return one(raw);
}

/** Reads a field of a message value (a JS expression) as CEL, applying the proto3 defaults. */
function readField(owner: string, field: DescField): Compiled {
  const acc = `${owner}.${tsProtoFieldName(field.name)}`;
  const type = fieldCelType(field);
  switch (field.fieldKind) {
    case "scalar":
      switch (type.k) {
        case "string":
          return { js: `(${acc} ?? "")`, type };
        case "bool":
          return { js: `(${acc} ?? false)`, type };
        case "double":
          return { js: `(${acc} ?? 0)`, type };
        case "bytes":
          return { js: `(${acc} ?? __r.EMPTY_BYTES)`, type };
        default:
          return { js: is64Bit(field.scalar) ? `BigInt(${acc} ?? "0")` : `BigInt(${acc} ?? 0)`, type };
      }
    case "enum":
      return { js: `BigInt(${acc} ?? 0)`, type };
    case "message":
      if (type.k === "timestamp") return { js: `__r.tsMillis(${acc})`, type };
      return { js: `(${acc} ?? {})`, type };
    case "list": {
      const elem = rawToCel("x", {
        scalar: field.listKind === "scalar" ? field.scalar : undefined,
        isEnum: field.listKind === "enum",
        message: field.listKind === "message" ? field.message : undefined,
      });
      return { js: elem.js === "x" ? `(${acc} ?? [])` : `(${acc} ?? []).map((x: any) => ${elem.js})`, type };
    }
    case "map":
      return { js: `(${acc} ?? {})`, type };
  }
}

/** `has(owner.field)`: set for a present message / explicit field, non-default for an implicit one. */
export function presenceOf(owner: string, field: DescField): string {
  const acc = `${owner}.${tsProtoFieldName(field.name)}`;
  switch (field.fieldKind) {
    case "list":
      return `((${acc} ?? []).length > 0)`;
    case "map":
      return `(Object.keys(${acc} ?? {}).length > 0)`;
    case "message":
      return `(${acc} !== undefined)`;
  }
  if (field.oneof !== undefined || field.proto.proto3Optional) {
    return `(${acc} !== undefined)`;
  }
  if (field.fieldKind === "enum") {
    return `((${acc} ?? 0) !== 0)`;
  }
  switch (field.scalar) {
    case ScalarType.STRING:
      return `((${acc} ?? "") !== "")`;
    case ScalarType.BOOL:
      return `((${acc} ?? false) !== false)`;
    case ScalarType.BYTES:
      return `((${acc} ?? __r.EMPTY_BYTES).length > 0)`;
    default:
      return is64Bit(field.scalar) ? `(BigInt(${acc} ?? "0") !== BigInt(0))` : `((${acc} ?? 0) !== 0)`;
  }
}

function intLiteral(value: bigint, unsigned: boolean): string {
  if (unsigned ? value < BigInt(0) || value > UINT64_MAX : value < INT64_MIN || value > INT64_MAX) {
    throw new CelUnsupportedError(`integer literal ${value} out of range`);
  }
  return value < BigInt(0) ? `(-BigInt("${-value}"))` : `BigInt("${value}")`;
}

function doubleLiteral(value: number): string {
  if (Number.isNaN(value)) return "NaN";
  if (value === Infinity) return "Infinity";
  if (value === -Infinity) return "(-Infinity)";
  return value < 0 ? `(${value})` : String(value);
}

/**
 * Compiles a CEL rule. `self` is `this` in CEL representation (a JS expression over `v`).
 */
export function compileCelRule(expression: string, self: Compiled): CompiledRule {
  let ast: Expr;
  try {
    ast = parseCel(expression);
  } catch (err) {
    if (err instanceof CelSyntaxError) throw new CelUnsupportedError(err.message);
    throw err;
  }
  const env: Env = { vars: new Map([["this", self]]), depth: 0 };
  const out = compile(ast, env);
  if (out.type.k !== "bool" && out.type.k !== "string") {
    throw new CelUnsupportedError(`the expression yields ${typeName(out.type)}, wanted bool or string`);
  }
  return { js: out.js, resultType: out.type.k };
}

function unsupported(what: string): never {
  throw new CelUnsupportedError(what);
}

function compile(e: Expr, env: Env): Compiled {
  switch (e.kind) {
    case "literal":
      switch (e.type) {
        case "int":
          return { js: intLiteral(e.value as bigint, false), type: INT };
        case "uint":
          return { js: intLiteral(e.value as bigint, true), type: UINT };
        case "double":
          return { js: doubleLiteral(e.value as number), type: DOUBLE };
        case "string":
          return { js: JSON.stringify(e.value), type: STRING, literal: e.value as string };
        case "bool":
          return { js: String(e.value), type: BOOL };
        default:
          return unsupported(`${e.type} literals`);
      }

    case "ident": {
      const bound = env.vars.get(e.name);
      if (!bound) {
        return unsupported(`identifier '${e.name}' (only 'this' and comprehension variables are supported)`);
      }
      return bound;
    }

    case "select": {
      const owner = compile(e.operand, env);
      if (owner.type.k !== "message") {
        return unsupported(`field selection '.${e.field}' on ${typeName(owner.type)}`);
      }
      const field = owner.type.desc.fields.find((f) => f.name === e.field);
      if (!field) {
        return unsupported(`${owner.type.desc.typeName} has no field '${e.field}'`);
      }
      if (field.fieldKind === "map") {
        return unsupported(`map field '${e.field}'`);
      }
      const read = readField(owner.js, field);
      if (read.type.k === "opaque") {
        return unsupported(`reading ${read.type.name} field '${e.field}' (only has() is supported)`);
      }
      return read;
    }

    case "index": {
      const list = compile(e.operand, env);
      const index = compile(e.index, env);
      if (list.type.k !== "list" || !isIntegral(index.type)) {
        return unsupported(`index of ${typeName(list.type)} by ${typeName(index.type)}`);
      }
      return { js: `__r.at(${list.js}, ${index.js})`, type: list.type.elem };
    }

    case "list": {
      if (e.elements.length === 0) {
        return unsupported("empty list literals");
      }
      const items = e.elements.map((x) => compile(x, env));
      for (const item of items) {
        if (!same(item.type, items[0].type)) {
          return unsupported("list literals mixing types");
        }
      }
      return { js: `[${items.map((i) => i.js).join(", ")}]`, type: { k: "list", elem: items[0].type } };
    }

    case "map":
      return unsupported("map literals");

    case "unary": {
      const x = compile(e.operand, env);
      if (e.op === "!") {
        if (x.type.k !== "bool") return unsupported(`! on ${typeName(x.type)}`);
        return { js: `(!${x.js})`, type: BOOL };
      }
      if (x.type.k === "int") return { js: `__r.i64(-${x.js})`, type: INT };
      if (x.type.k === "double") return { js: `(-${x.js})`, type: DOUBLE };
      return unsupported(`unary - on ${typeName(x.type)}`);
    }

    case "conditional": {
      const test = compile(e.test, env);
      const then = compile(e.then, env);
      const otherwise = compile(e.otherwise, env);
      if (test.type.k !== "bool" || !same(then.type, otherwise.type)) {
        return unsupported("conditional with a non-bool test or branches of different types");
      }
      return { js: `(${test.js} ? ${then.js} : ${otherwise.js})`, type: then.type };
    }

    case "binary":
      return compileBinary(e.op, compile(e.left, env), compile(e.right, env));

    case "call":
      return compileCall(e, env);
  }
}

function compileBinary(op: string, l: Compiled, r: Compiled): Compiled {
  const bin = (jsOp: string) => `(${l.js} ${jsOp} ${r.js})`;
  switch (op) {
    case "&&":
    case "||":
      if (l.type.k !== "bool" || r.type.k !== "bool") return unsupported(`${op} on ${typeName(l.type)}, ${typeName(r.type)}`);
      return { js: bin(op), type: BOOL };

    case "==":
    case "!=": {
      const neg = op === "!=" ? "!" : "";
      if (l.type.k === "bytes" && r.type.k === "bytes") {
        return { js: `(${neg}__r.bytesEq(${l.js}, ${r.js}))`, type: BOOL };
      }
      const scalarKinds = ["bool", "int", "uint", "double", "string", "timestamp"];
      const comparable =
        scalarKinds.includes(l.type.k) && (same(l.type, r.type) || (isIntegral(l.type) && isIntegral(r.type)));
      if (!comparable) return unsupported(`${op} between ${typeName(l.type)} and ${typeName(r.type)}`);
      return { js: bin(op === "==" ? "===" : "!=="), type: BOOL };
    }

    case "<":
    case "<=":
    case ">":
    case ">=": {
      if (same(l.type, r.type) && ["bool", "int", "uint", "double", "string", "timestamp"].includes(l.type.k)) {
        return { js: bin(op), type: BOOL };
      }
      if (isIntegral(l.type) && isIntegral(r.type)) {
        return { js: bin(op), type: BOOL };
      }
      // Mixed numeric comparisons, as @bufbuild/cel evaluates them
      if (isIntegral(l.type) && r.type.k === "double") return { js: `(Number(${l.js}) ${op} ${r.js})`, type: BOOL };
      if (l.type.k === "double" && isIntegral(r.type)) return { js: `(${l.js} ${op} Number(${r.js}))`, type: BOOL };
      return unsupported(`${op} between ${typeName(l.type)} and ${typeName(r.type)}`);
    }

    case "in": {
      if (r.type.k !== "list") return unsupported(`in on ${typeName(r.type)}`);
      const elem = r.type.elem;
      if (!(same(l.type, elem) || (isIntegral(l.type) && isIntegral(elem)))) {
        return unsupported(`${typeName(l.type)} in ${typeName(r.type)}`);
      }
      if (!["bool", "int", "uint", "double", "string", "bytes", "timestamp"].includes(l.type.k)) {
        return unsupported(`in on a list of ${typeName(elem)}`);
      }
      return { js: `__r.inList(${l.js}, ${r.js})`, type: BOOL };
    }

    case "+":
      if (l.type.k === "string" && r.type.k === "string") return { js: bin("+"), type: STRING };
      if (l.type.k === "list" && same(l.type, r.type)) return { js: `[...${l.js}, ...${r.js}]`, type: l.type };
      return arithmetic("+", l, r);
    case "-":
    case "*":
    case "/":
      return arithmetic(op, l, r);
    case "%":
      if (!isIntegral(l.type)) return unsupported(`% on ${typeName(l.type)}`);
      if (!same(l.type, r.type)) return unsupported(`% between ${typeName(l.type)} and ${typeName(r.type)}`);
      return { js: bin("%"), type: l.type };
  }
  return unsupported(`operator ${op}`);
}

function arithmetic(op: string, l: Compiled, r: Compiled): Compiled {
  if (!same(l.type, r.type)) return unsupported(`${op} between ${typeName(l.type)} and ${typeName(r.type)}`);
  const js = `(${l.js} ${op} ${r.js})`;
  switch (l.type.k) {
    case "int":
      return { js: `__r.i64${js}`, type: INT };
    case "uint":
      return { js: `__r.u64${js}`, type: UINT };
    case "double":
      return { js, type: DOUBLE };
  }
  return unsupported(`${op} on ${typeName(l.type)}`);
}

const MACROS = new Set(["all", "exists", "exists_one", "map", "filter"]);

function compileCall(e: Extract<Expr, { kind: "call" }>, env: Env): Compiled {
  const { fn, args } = e;

  // Macros take unevaluated arguments
  if (!e.target && fn === "has") {
    const arg = args[0];
    if (args.length !== 1 || arg.kind !== "select") return unsupported("has() takes a single field selection");
    const owner = compile(arg.operand, env);
    if (owner.type.k !== "message") return unsupported(`has() on ${typeName(owner.type)}`);
    const field = owner.type.desc.fields.find((f) => f.name === arg.field);
    if (!field) return unsupported(`${owner.type.desc.typeName} has no field '${arg.field}'`);
    return { js: presenceOf(owner.js, field), type: BOOL };
  }
  if (e.target && MACROS.has(fn)) {
    return compileMacro(fn, compile(e.target, env), args, env);
  }

  const target = e.target ? compile(e.target, env) : undefined;
  const values = args.map((a) => compile(a, env));
  const sig = `${target ? typeName(target.type) + "." : ""}${fn}(${values.map((v) => typeName(v.type)).join(", ")})`;

  // Global functions (and their method forms)
  const subject = target ?? values[0];
  const rest = target ? values : values.slice(1);
  switch (fn) {
    case "size":
      if (rest.length === 0 && subject) {
        switch (subject.type.k) {
          case "string":
            return { js: `BigInt(__r.cpLen(${subject.js}))`, type: INT };
          case "bytes":
          case "list":
            return { js: `BigInt(${subject.js}.length)`, type: INT };
        }
      }
      break;
    case "int":
      if (!target && values.length === 1) {
        if (subject.type.k === "int") return subject;
        if (subject.type.k === "uint") return { js: `__r.i64(${subject.js})`, type: INT };
      }
      break;
    case "uint":
      if (!target && values.length === 1) {
        if (subject.type.k === "uint") return subject;
        if (subject.type.k === "int") return { js: `__r.u64(${subject.js})`, type: UINT };
      }
      break;
    case "double":
      if (!target && values.length === 1) {
        if (subject.type.k === "double") return subject;
        if (isIntegral(subject.type)) return { js: `Number(${subject.js})`, type: DOUBLE };
      }
      break;
    case "string":
      if (!target && values.length === 1) {
        if (subject.type.k === "string") return subject;
        if (isIntegral(subject.type) || subject.type.k === "bool") return { js: `String(${subject.js})`, type: STRING };
      }
      break;
    case "bytes":
      if (!target && values.length === 1) {
        if (subject.type.k === "bytes") return subject;
        if (subject.type.k === "string") return { js: `__r.utf8(${subject.js})`, type: BYTES };
      }
      break;
  }

  // Methods
  if (target) {
    const [a] = values;
    switch (target.type.k) {
      case "string":
        if (values.length === 1 && a.type.k === "string") {
          switch (fn) {
            case "startsWith":
              return { js: `${target.js}.startsWith(${a.js})`, type: BOOL };
            case "endsWith":
              return { js: `${target.js}.endsWith(${a.js})`, type: BOOL };
            case "contains":
              return { js: `${target.js}.includes(${a.js})`, type: BOOL };
            case "matches":
              return compileMatches(target, a);
          }
        }
        if (values.length === 0) {
          switch (fn) {
            case "isEmail":
            case "isHostname":
            case "isUri":
            case "isUriRef":
            case "isIp":
              return { js: `__r.${fn}(${target.js})`, type: BOOL };
          }
        }
        if (fn === "isIp" && values.length === 1 && a.type.k === "int") {
          return { js: `__r.isIp(${target.js}, ${a.js})`, type: BOOL };
        }
        if (fn === "isHostAndPort" && values.length === 1 && a.type.k === "bool") {
          return { js: `__r.isHostAndPort(${target.js}, ${a.js})`, type: BOOL };
        }
        break;
      case "double":
        if (fn === "isNan" && values.length === 0) return { js: `Number.isNaN(${target.js})`, type: BOOL };
        if (fn === "isInf" && values.length === 0) return { js: `__r.isInf(${target.js})`, type: BOOL };
        if (fn === "isInf" && values.length === 1 && a.type.k === "int") return { js: `__r.isInf(${target.js}, ${a.js})`, type: BOOL };
        break;
      case "list":
        if (fn === "unique" && values.length === 0) {
          if (!["int", "uint", "string", "bool", "double", "bytes"].includes(target.type.elem.k)) {
            return unsupported(`unique() on ${typeName(target.type)}`);
          }
          return { js: `__r.unique(${target.js})`, type: BOOL };
        }
        break;
    }
  } else if (fn === "matches" && values.length === 2 && values[0].type.k === "string" && values[1].type.k === "string") {
    return compileMatches(values[0], values[1]);
  }

  return unsupported(`function ${sig}`);
}

function compileMatches(target: Compiled, pattern: Compiled): Compiled {
  if (pattern.literal !== undefined) {
    try {
      regex(pattern.literal);
    } catch (err) {
      unsupported(`pattern ${JSON.stringify(pattern.literal)}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { js: `__r.matches(${target.js}, ${pattern.js})`, type: BOOL };
}

function compileMacro(fn: string, target: Compiled, args: Expr[], env: Env): Compiled {
  if (target.type.k !== "list") return unsupported(`${fn}() on ${typeName(target.type)}`);
  const variable = args[0];
  if (variable?.kind !== "ident") return unsupported(`${fn}() needs a variable name`);
  const name = `__x${env.depth}`;
  const inner: Env = {
    vars: new Map(env.vars).set(variable.name, { js: name, type: target.type.elem }),
    depth: env.depth + 1,
  };
  const lambda = (body: Compiled) => `((${name}: any) => ${body.js})`;
  const predicate = (x: Expr) => {
    const p = compile(x, inner);
    if (p.type.k !== "bool") unsupported(`${fn}() predicate yields ${typeName(p.type)}`);
    return p;
  };

  switch (fn) {
    case "all":
      if (args.length === 2) return { js: `${target.js}.every${lambda(predicate(args[1]))}`, type: BOOL };
      break;
    case "exists":
      if (args.length === 2) return { js: `${target.js}.some${lambda(predicate(args[1]))}`, type: BOOL };
      break;
    case "exists_one":
      if (args.length === 2) return { js: `(${target.js}.filter${lambda(predicate(args[1]))}.length === 1)`, type: BOOL };
      break;
    case "filter":
      if (args.length === 2) return { js: `${target.js}.filter${lambda(predicate(args[1]))}`, type: target.type };
      break;
    case "map":
      if (args.length === 2) {
        const body = compile(args[1], inner);
        return { js: `${target.js}.map${lambda(body)}`, type: { k: "list", elem: body.type } };
      }
      if (args.length === 3) {
        const keep = predicate(args[1]);
        const body = compile(args[2], inner);
        return { js: `${target.js}.filter${lambda(keep)}.map${lambda(body)}`, type: { k: "list", elem: body.type } };
      }
      break;
  }
  return unsupported(`${fn}() with ${args.length} arguments`);
}
