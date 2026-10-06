/**
 * Reads the buf.validate rules of fields, messages and oneofs, exhaustively.
 *
 * Every rule field that is set is either translated into a JavaScript predicate that
 * reproduces the protovalidate check, or reported as unsupported: an UnsupportedRuleError
 * fails the generation, so no rule is ever silently dropped.
 *
 * Predicates are plain JavaScript over `v`, the value in ts-proto shape. The generator emits
 * them in `.refine()` calls, and evaluates them on the proto3 zero value at generation time
 * to know whether an absent property (ts-proto shape) may stand for that zero value.
 */

import {
  getOption,
  hasOption,
  ScalarType,
  type DescEnum,
  type DescField,
  type DescMessage,
  type DescOneof,
  type Message,
} from "@bufbuild/protobuf";
import { reflect, type ReflectMessage } from "@bufbuild/protobuf/reflect";
import {
  field as fieldRulesExt,
  file_buf_validate_validate,
  message as messageRulesExt,
  oneof as oneofRulesExt,
  Ignore,
  type FieldRules,
  type MessageRules,
  type OneofRules,
} from "@buf/bufbuild_protovalidate.bufbuild_es/buf/validate/validate_pb.js";
import * as runtime from "../runtime/zod_rules.js";

export { Ignore };

export class UnsupportedRuleError extends Error {
  constructor(where: string, what: string) {
    super(
      `${where}: ${what}. protoc-gen-zod has no faithful Zod translation for it; ` +
        `add one in tools/zod (with a differential test case) or change the rule.`,
    );
  }
}

/** A standard rule as a predicate over `v` (true = valid). */
export interface Check {
  id: string;
  message: string;
  /** Plain JavaScript expression over `v` and the `__r` runtime helpers */
  pred: string;
  /** Stop the checks that follow when this one fails (they could not evaluate the value) */
  abort?: boolean;
}

/** A CEL rule as declared (buf.validate.Rule or a cel_expression). */
export interface CelRuleSpec {
  id: string;
  message: string;
  expression: string;
}

/** Rules applying to one value: a field value, or each item of a list. */
export interface ValueRules {
  checks: Check[];
  cel: CelRuleSpec[];
  ignore: Ignore;
}

export interface FieldPlan extends ValueRules {
  required: boolean;
  /** Whether `ignore` was set explicitly (a message oneof rule defaults it to IF_ZERO_VALUE) */
  ignoreSet: boolean;
  /** Rules of each list item */
  items?: ValueRules;
}

export interface MessagePlan {
  cel: CelRuleSpec[];
  oneofRules: { fields: DescField[]; required: boolean }[];
}

// ─── Reflection helpers ──────────────────────────────────────────────────────

type Rules = Message & { $typeName: string };

/** Set fields of a rules message; refuses unknown fields (predefined rule extensions). */
function setFields(rules: Rules, where: string): { name: string; value: unknown }[] {
  const unknown = (rules as { $unknown?: { no: number }[] }).$unknown;
  if (unknown && unknown.length > 0) {
    throw new UnsupportedRuleError(
      where,
      `${rules.$typeName} carries unknown fields ${unknown.map((u) => u.no).join(", ")} (predefined rule extensions are not supported)`,
    );
  }
  const r: ReflectMessage = reflect(schemaOf(rules), rules);
  const plain = rules as unknown as Record<string, unknown>;
  const out: { name: string; value: unknown }[] = [];
  for (const f of r.fields) {
    if (!r.isSet(f)) continue;
    // Plain values (not reflected ones): lists of messages stay lists of messages
    const value = f.oneof ? (plain[f.oneof.localName] as { value: unknown }).value : plain[f.localName];
    out.push({ name: f.name, value });
  }
  return out;
}

const schemaCache = new Map<string, DescMessage>();

function schemaOf(rules: Rules): DescMessage {
  const cached = schemaCache.get(rules.$typeName);
  if (cached) return cached;
  const found = file_buf_validate_validate.messages.find((m) => m.typeName === rules.$typeName);
  if (!found) throw new Error(`unknown rules message ${rules.$typeName}`);
  schemaCache.set(rules.$typeName, found);
  return found;
}

function celRules(list: { name: string; value: unknown }[], where: string): CelRuleSpec[] {
  const out: CelRuleSpec[] = [];
  for (const { name, value } of list) {
    if (name === "cel") {
      for (const rule of value as { id: string; message: string; expression: string }[]) {
        if (!rule.expression) throw new UnsupportedRuleError(where, `CEL rule '${rule.id}' has no expression`);
        out.push({ id: rule.id, message: rule.message, expression: rule.expression });
      }
    } else if (name === "cel_expression") {
      for (const expression of value as string[]) {
        out.push({ id: expression, message: "", expression });
      }
    }
  }
  return out;
}

const lit = (s: string): string => JSON.stringify(s);

function numberLiteral(n: number): string {
  if (Number.isNaN(n)) return "NaN";
  if (n === Infinity) return "Infinity";
  if (n === -Infinity) return "-Infinity";
  return String(n);
}

// ─── Standard rules ──────────────────────────────────────────────────────────

/** Rule message case protovalidate expects for a scalar type. */
const RULE_CASE: Record<ScalarType, string> = {
  [ScalarType.DOUBLE]: "double",
  [ScalarType.FLOAT]: "float",
  [ScalarType.INT64]: "int64",
  [ScalarType.UINT64]: "uint64",
  [ScalarType.INT32]: "int32",
  [ScalarType.FIXED64]: "fixed64",
  [ScalarType.FIXED32]: "fixed32",
  [ScalarType.BOOL]: "bool",
  [ScalarType.STRING]: "string",
  [ScalarType.BYTES]: "bytes",
  [ScalarType.UINT32]: "uint32",
  [ScalarType.SFIXED32]: "sfixed32",
  [ScalarType.SFIXED64]: "sfixed64",
  [ScalarType.SINT32]: "sint32",
  [ScalarType.SINT64]: "sint64",
};

export function is64BitScalar(scalar: ScalarType): boolean {
  return (
    scalar === ScalarType.INT64 ||
    scalar === ScalarType.UINT64 ||
    scalar === ScalarType.SINT64 ||
    scalar === ScalarType.FIXED64 ||
    scalar === ScalarType.SFIXED64
  );
}

/** Kind of a value the standard rules apply to: a scalar, or an enum. */
export type ValueKind = { scalar: ScalarType; enumDesc?: undefined } | { scalar?: undefined; enumDesc: DescEnum };

function stringChecks(rules: Rules, where: string): Check[] {
  const checks: Check[] = [];
  const add = (id: string, message: string, pred: string) => checks.push({ id: `string.${id}`, message, pred });
  const format = (id: string, what: string, pred: string) => {
    add(`${id}_empty`, `value is empty, which is not a valid ${what}`, `v !== ""`);
    add(id, `must be a valid ${what}`, `v === "" || ${pred}`);
  };
  for (const { name, value } of setFields(rules, where)) {
    switch (name) {
      case "const":
        add("const", `must equal \`${value}\``, `v === ${lit(value as string)}`);
        break;
      case "len":
        add("len", `must be ${value} characters`, `__r.cpLen(v) === ${value}`);
        break;
      case "min_len":
        add("min_len", `must be at least ${value} characters`, `__r.cpLen(v) >= ${value}`);
        break;
      case "max_len":
        add("max_len", `must be at most ${value} characters`, `__r.cpLen(v) <= ${value}`);
        break;
      case "len_bytes":
        add("len_bytes", `must be ${value} bytes`, `__r.utf8Len(v) === ${value}`);
        break;
      case "min_bytes":
        add("min_bytes", `must be at least ${value} bytes`, `__r.utf8Len(v) >= ${value}`);
        break;
      case "max_bytes":
        add("max_bytes", `must be at most ${value} bytes`, `__r.utf8Len(v) <= ${value}`);
        break;
      case "pattern":
        try {
          runtime.regex(value as string);
        } catch (err) {
          throw new UnsupportedRuleError(where, `string.pattern ${lit(value as string)}: ${(err as Error).message}`);
        }
        add("pattern", `does not match regex pattern \`${value}\``, `__r.matches(v, ${lit(value as string)})`);
        break;
      case "prefix":
        add("prefix", `does not have prefix \`${value}\``, `v.startsWith(${lit(value as string)})`);
        break;
      case "suffix":
        add("suffix", `does not have suffix \`${value}\``, `v.endsWith(${lit(value as string)})`);
        break;
      case "contains":
        add("contains", `does not contain substring \`${value}\``, `v.includes(${lit(value as string)})`);
        break;
      case "not_contains":
        add("not_contains", `contains substring \`${value}\``, `!v.includes(${lit(value as string)})`);
        break;
      case "in":
        add("in", `must be in list [${(value as string[]).join(", ")}]`, `[${(value as string[]).map(lit).join(", ")}].includes(v)`);
        break;
      case "not_in":
        add("not_in", `must not be in list [${(value as string[]).join(", ")}]`, `![${(value as string[]).map(lit).join(", ")}].includes(v)`);
        break;
      case "email":
        if (value) format("email", "email address", "__r.isEmail(v)");
        break;
      case "hostname":
        if (value) format("hostname", "hostname", "__r.isHostname(v)");
        break;
      case "ip":
        if (value) format("ip", "IP address", "__r.isIp(v)");
        break;
      case "ipv4":
        if (value) format("ipv4", "IPv4 address", "__r.isIp(v, 4)");
        break;
      case "ipv6":
        if (value) format("ipv6", "IPv6 address", "__r.isIp(v, 6)");
        break;
      case "uri":
        if (value) format("uri", "URI", "__r.isUri(v)");
        break;
      case "uri_ref":
        if (value) add("uri_ref", "must be a valid URI Reference", "__r.isUriRef(v)");
        break;
      case "address":
        if (value) format("address", "hostname, or ip address", "__r.isAddress(v)");
        break;
      case "uuid":
        if (value) {
          format("uuid", "UUID", `__r.matches(v, ${lit("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")})`);
        }
        break;
      case "host_and_port":
        if (value) format("host_and_port", "host (hostname or IP address) and port pair", "__r.isHostAndPort(v, true)");
        break;
      case "strict":
        // Only read by well_known_regex, refused below
        break;
      case "example":
        break;
      default:
        throw new UnsupportedRuleError(where, `string.${name}`);
    }
  }
  return checks;
}

function bytesChecks(rules: Rules, where: string): Check[] {
  const checks: Check[] = [];
  for (const { name, value } of setFields(rules, where)) {
    switch (name) {
      case "len":
        checks.push({ id: "bytes.len", message: `must be ${value} bytes`, pred: `v.length === ${value}` });
        break;
      case "min_len":
        checks.push({ id: "bytes.min_len", message: `must be at least ${value} bytes`, pred: `v.length >= ${value}` });
        break;
      case "max_len":
        checks.push({ id: "bytes.max_len", message: `must be at most ${value} bytes`, pred: `v.length <= ${value}` });
        break;
      case "example":
        break;
      default:
        throw new UnsupportedRuleError(where, `bytes.${name}`);
    }
  }
  return checks;
}

/**
 * Numeric rules. 32-bit integers and doubles are numbers in the ts-proto shape; 64-bit
 * integers are decimal strings (forceLong=string), compared as BigInt; a float is compared
 * once rounded to float32, the value the wire carries.
 */
function numberChecks(ruleCase: string, rules: Rules, scalar: ScalarType, where: string): Check[] {
  const big = is64BitScalar(scalar);
  const floating = scalar === ScalarType.DOUBLE || scalar === ScalarType.FLOAT;
  const V = big ? "BigInt(v)" : scalar === ScalarType.FLOAT ? "Math.fround(v)" : "v";
  const num = (x: unknown): string => (big ? `BigInt(${lit(String(x))})` : numberLiteral(x as number));
  const show = (x: unknown): string => String(x);

  const checks: Check[] = [];
  const set = new Map(setFields(rules, where).map(({ name, value }) => [name, value]));
  const lower = set.has("gt") ? { op: ">", name: "gt", text: "greater than", value: set.get("gt") } : set.has("gte") ? { op: ">=", name: "gte", text: "greater than or equal to", value: set.get("gte") } : undefined;
  const upper = set.has("lt") ? { op: "<", name: "lt", text: "less than", value: set.get("lt") } : set.has("lte") ? { op: "<=", name: "lte", text: "less than or equal to", value: set.get("lte") } : undefined;

  if (lower && upper) {
    // protovalidate: an upper bound not below the lower one is a range (AND), otherwise an exclusion (OR)
    const inRange = (upper.value as number | bigint) >= (lower.value as number | bigint);
    const id = `${ruleCase}.${lower.name}_${upper.name}${inRange ? "" : "_exclusive"}`;
    const joiner = inRange ? "&&" : "||";
    checks.push({
      id,
      message: `must be ${lower.text} ${show(lower.value)} ${inRange ? "and" : "or"} ${upper.text} ${show(upper.value)}`,
      pred: `(${V} ${lower.op} ${num(lower.value)}) ${joiner} (${V} ${upper.op} ${num(upper.value)})`,
    });
  } else if (lower) {
    checks.push({ id: `${ruleCase}.${lower.name}`, message: `must be ${lower.text} ${show(lower.value)}`, pred: `${V} ${lower.op} ${num(lower.value)}` });
  } else if (upper) {
    checks.push({ id: `${ruleCase}.${upper.name}`, message: `must be ${upper.text} ${show(upper.value)}`, pred: `${V} ${upper.op} ${num(upper.value)}` });
  }

  for (const [name, value] of set) {
    switch (name) {
      case "gt":
      case "gte":
      case "lt":
      case "lte":
      case "example":
        break;
      case "const":
        checks.push({ id: `${ruleCase}.const`, message: `must equal ${show(value)}`, pred: `${V} === ${num(value)}` });
        break;
      case "in":
        checks.push({ id: `${ruleCase}.in`, message: `must be in list [${(value as unknown[]).map(show).join(", ")}]`, pred: `__r.inList(${V}, [${(value as unknown[]).map(num).join(", ")}])` });
        break;
      case "not_in":
        checks.push({ id: `${ruleCase}.not_in`, message: `must not be in list [${(value as unknown[]).map(show).join(", ")}]`, pred: `!__r.inList(${V}, [${(value as unknown[]).map(num).join(", ")}])` });
        break;
      case "finite":
        if (floating && value) checks.push({ id: `${ruleCase}.finite`, message: "must be finite", pred: `Number.isFinite(${V})` });
        break;
      default:
        throw new UnsupportedRuleError(where, `${ruleCase}.${name}`);
    }
  }
  return checks;
}

function boolChecks(rules: Rules, where: string): Check[] {
  const checks: Check[] = [];
  for (const { name, value } of setFields(rules, where)) {
    if (name === "const") {
      checks.push({ id: "bool.const", message: `must equal ${value}`, pred: `v === ${value}` });
    } else if (name !== "example") {
      throw new UnsupportedRuleError(where, `bool.${name}`);
    }
  }
  return checks;
}

function enumChecks(rules: Rules, enumDesc: DescEnum, where: string): Check[] {
  const checks: Check[] = [];
  for (const { name, value } of setFields(rules, where)) {
    switch (name) {
      case "defined_only":
        if (value) {
          const values = enumDesc.values.map((v) => v.number);
          checks.push({ id: "enum.defined_only", message: "value must be one of the defined enum values", pred: `[${values.join(", ")}].includes(v)` });
        }
        break;
      case "const":
        checks.push({ id: "enum.const", message: `must equal ${value}`, pred: `v === ${value}` });
        break;
      case "in":
        checks.push({ id: "enum.in", message: `must be in list [${(value as number[]).join(", ")}]`, pred: `[${(value as number[]).join(", ")}].includes(v)` });
        break;
      case "not_in":
        checks.push({ id: "enum.not_in", message: `must not be in list [${(value as number[]).join(", ")}]`, pred: `![${(value as number[]).join(", ")}].includes(v)` });
        break;
      case "example":
        break;
      default:
        throw new UnsupportedRuleError(where, `enum.${name}`);
    }
  }
  return checks;
}

/** Standard rules of one value (a singular field or a list item) of the given kind. */
function valueChecks(type: FieldRules["type"], kind: ValueKind | { message: DescMessage }, where: string): Check[] {
  if (type.case === undefined) return [];
  if ("message" in kind) {
    throw new UnsupportedRuleError(where, `${type.case} rules on the message type ${kind.message.typeName}`);
  }
  if (kind.enumDesc) {
    if (type.case !== "enum") throw new UnsupportedRuleError(where, `${type.case} rules on an enum field`);
    return enumChecks(type.value as Rules, kind.enumDesc, where);
  }
  const expected = RULE_CASE[kind.scalar];
  if (type.case !== expected) {
    throw new UnsupportedRuleError(where, `${type.case} rules on a ${expected} field`);
  }
  switch (type.case) {
    case "string":
      return stringChecks(type.value as Rules, where);
    case "bytes":
      return bytesChecks(type.value as Rules, where);
    case "bool":
      return boolChecks(type.value as Rules, where);
    default:
      return numberChecks(type.case, type.value as Rules, kind.scalar, where);
  }
}

/** The part of a FieldRules shared by every field kind: required, ignore and CEL rules. */
function commonRules(rules: FieldRules, where: string): { required: boolean; ignore: Ignore; ignoreSet: boolean; cel: CelRuleSpec[] } {
  // setFields refuses unknown fields; every declared field of FieldRules is handled here or by the caller
  const set = setFields(rules as unknown as Rules, where);
  const ignore = rules.ignore;
  if (ignore !== Ignore.UNSPECIFIED && ignore !== Ignore.IF_ZERO_VALUE && ignore !== Ignore.ALWAYS) {
    throw new UnsupportedRuleError(where, `ignore = ${ignore}`);
  }
  return {
    required: rules.required && ignore !== Ignore.ALWAYS,
    ignore,
    ignoreSet: set.some((s) => s.name === "ignore"),
    cel: ignore === Ignore.ALWAYS ? [] : celRules(set, where),
  };
}

function elementKind(field: DescField): ValueKind | { message: DescMessage } {
  switch (field.fieldKind) {
    case "scalar":
      return { scalar: field.scalar };
    case "enum":
      return { enumDesc: field.enum };
    case "message":
      return { message: field.message };
    case "list":
      return field.listKind === "scalar" ? { scalar: field.scalar } : field.listKind === "enum" ? { enumDesc: field.enum } : { message: field.message };
    case "map":
      throw new Error("maps have no element kind");
  }
}

/** Reads and translates every rule of a field. */
export function fieldPlan(field: DescField): FieldPlan {
  const where = `${field.parent.typeName}.${field.name}`;
  if (!hasOption(field, fieldRulesExt)) {
    return { checks: [], cel: [], ignore: Ignore.UNSPECIFIED, required: false, ignoreSet: false };
  }
  const rules = getOption(field, fieldRulesExt) as FieldRules;
  const common = commonRules(rules, where);
  const skip = common.ignore === Ignore.ALWAYS;

  if (field.fieldKind === "map") {
    if (rules.type.case !== undefined) throw new UnsupportedRuleError(where, `${rules.type.case} rules on a map field`);
    if (common.cel.length > 0) throw new UnsupportedRuleError(where, "CEL rules on a map field");
    return { ...common, checks: [] };
  }

  if (field.fieldKind !== "list") {
    if (skip && field.fieldKind === "message") {
      throw new UnsupportedRuleError(where, "ignore = IGNORE_ALWAYS on a message field (the nested message rules would still apply)");
    }
    return { ...common, checks: skip ? [] : valueChecks(rules.type, elementKind(field), where) };
  }

  if (rules.type.case !== undefined && rules.type.case !== "repeated") {
    throw new UnsupportedRuleError(where, `${rules.type.case} rules on a repeated field`);
  }
  const plan: FieldPlan = { ...common, checks: [] };
  if (skip) {
    if (field.listKind === "message") {
      throw new UnsupportedRuleError(where, "ignore = IGNORE_ALWAYS on a message list (the nested message rules would still apply)");
    }
    return plan;
  }
  if (rules.type.case !== "repeated") {
    return plan;
  }
  for (const { name, value } of setFields(rules.type.value as unknown as Rules, where)) {
    switch (name) {
      case "min_items":
        plan.checks.push({ id: "repeated.min_items", message: `must contain at least ${value} item(s)`, pred: `v.length >= ${value}` });
        break;
      case "max_items":
        plan.checks.push({ id: "repeated.max_items", message: `must contain no more than ${value} item(s)`, pred: `v.length <= ${value}` });
        break;
      case "unique":
        if (value) {
          if (field.listKind === "message") throw new UnsupportedRuleError(where, "repeated.unique on messages");
          const items =
            field.listKind === "scalar" && is64BitScalar(field.scalar)
              ? "v.map((x) => BigInt(x))"
              : field.listKind === "scalar" && field.scalar === ScalarType.FLOAT
                ? "v.map((x) => Math.fround(x))"
                : "v";
          plan.checks.push({ id: "repeated.unique", message: "repeated value must contain unique items", pred: `__r.unique(${items})` });
        }
        break;
      case "items": {
        const itemRules = value as FieldRules;
        const itemWhere = `${where}[]`;
        const items = commonRules(itemRules, itemWhere);
        if (itemRules.required) {
          throw new UnsupportedRuleError(itemWhere, "required on list items (protovalidate ignores it)");
        }
        if (items.ignore === Ignore.ALWAYS) {
          if (field.listKind === "message") {
            throw new UnsupportedRuleError(itemWhere, "ignore = IGNORE_ALWAYS on message items (the nested message rules would still apply)");
          }
          plan.items = { checks: [], cel: [], ignore: items.ignore };
        } else {
          plan.items = { checks: valueChecks(itemRules.type, elementKind(field), itemWhere), cel: items.cel, ignore: items.ignore };
        }
        break;
      }
      default:
        throw new UnsupportedRuleError(where, `repeated.${name}`);
    }
  }
  return plan;
}

/** Reads the message-level rules: CEL rules and (buf.validate.message).oneof rules. */
export function messagePlan(message: DescMessage): MessagePlan {
  const where = message.typeName;
  if (!hasOption(message, messageRulesExt)) {
    return { cel: [], oneofRules: [] };
  }
  const rules = getOption(message, messageRulesExt) as MessageRules;
  const set = setFields(rules as unknown as Rules, where);
  const plan: MessagePlan = { cel: celRules(set, where), oneofRules: [] };
  for (const { name, value } of set) {
    if (name === "cel" || name === "cel_expression") continue;
    if (name !== "oneof") throw new UnsupportedRuleError(where, `message rule ${name}`);
    for (const rule of value as { fields: string[]; required: boolean }[]) {
      if (rule.fields.length === 0) throw new UnsupportedRuleError(where, "an empty (buf.validate.message).oneof rule");
      const fields = rule.fields.map((name) => {
        const f = message.fields.find((x) => x.name === name);
        if (!f) throw new UnsupportedRuleError(where, `(buf.validate.message).oneof names the unknown field ${name}`);
        return f;
      });
      if (new Set(rule.fields).size !== rule.fields.length) {
        throw new UnsupportedRuleError(where, "(buf.validate.message).oneof lists a field twice");
      }
      plan.oneofRules.push({ fields, required: rule.required });
    }
  }
  return plan;
}

/** Whether a oneof must hold a member ((buf.validate.oneof).required). */
export function oneofRequired(oneof: DescOneof): boolean {
  if (!hasOption(oneof, oneofRulesExt)) return false;
  const rules = getOption(oneof, oneofRulesExt) as OneofRules;
  for (const { name } of setFields(rules as unknown as Rules, `${oneof.parent.typeName}.${oneof.name}`)) {
    if (name !== "required") {
      throw new UnsupportedRuleError(`${oneof.parent.typeName}.${oneof.name}`, `oneof rule ${name}`);
    }
  }
  return rules.required;
}

// ─── Zero values ─────────────────────────────────────────────────────────────

/** The proto3 zero value of a value kind, as ts-proto holds it. */
export function zeroValue(kind: ValueKind): unknown {
  if (kind.enumDesc) return 0;
  switch (kind.scalar) {
    case ScalarType.STRING:
      return "";
    case ScalarType.BOOL:
      return false;
    case ScalarType.BYTES:
      return new Uint8Array(0);
    default:
      return is64BitScalar(kind.scalar) ? "0" : 0;
  }
}

/** JavaScript literal of the proto3 zero value (bytes excepted: they have none). */
export function zeroLiteral(kind: ValueKind): string | undefined {
  const zero = zeroValue(kind);
  return zero instanceof Uint8Array ? undefined : JSON.stringify(zero);
}

/** JavaScript predicate over `v`: the value is the proto3 zero value. */
export function zeroTest(kind: ValueKind): string {
  if (kind.enumDesc) return "v === 0";
  switch (kind.scalar) {
    case ScalarType.STRING:
      return `v === ""`;
    case ScalarType.BOOL:
      return "v === false";
    case ScalarType.BYTES:
      return "v.length === 0";
    default:
      return is64BitScalar(kind.scalar) ? "/^-?0+$/.test(v)" : "v === 0";
  }
}

/** Evaluates a check on a value at generation time, with the same runtime helpers. */
export function checkAccepts(check: Check, value: unknown): boolean {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function("__r", "v", `return (${check.pred});`) as (r: typeof runtime, v: unknown) => boolean;
  return fn(runtime, value) === true;
}
