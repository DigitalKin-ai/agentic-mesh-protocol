/**
 * Differential test of the generated Zod schemas against protovalidate.
 *
 * For every message of a descriptor set (gen/descriptor.bin, and the fixtures of
 * tools/zod/test/fixtures), a valid value is synthesized, then mutated field by field so
 * that each rule breaks. Every variant is judged twice:
 *
 * - by @bufbuild/protovalidate, on the protobuf-es message;
 * - by the generated `<Message>Schema`, on the ts-proto shape of the same bytes
 *   (`<Message>.decode(toBinary(...))`), and again on that shape with its implicit zero
 *   values removed (a hand-built reply omits them).
 *
 * Any disagreement fails the test, and so does a declared rule that no variant manages
 * to break (the mutations no longer cover it). A few checks run on the ts-proto shape
 * only, for values the wire cannot carry (two oneof members set, malformed int64).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  create,
  createFileRegistry,
  fromBinary,
  getOption,
  hasOption,
  ScalarType,
  toBinary,
  type DescField,
  type DescMessage,
  type Registry,
} from "@bufbuild/protobuf";
import { reflect } from "@bufbuild/protobuf/reflect";
import { FileDescriptorSetSchema } from "@bufbuild/protobuf/wkt";
import { createValidator, type Validator, type Violation } from "@bufbuild/protovalidate";
import {
  field as fieldExt,
  file_buf_validate_validate,
  message as messageExt,
  oneof as oneofExt,
  Ignore,
  type FieldRules,
  type MessageRules,
  type OneofRules,
} from "@buf/bufbuild_protovalidate.bufbuild_es/buf/validate/validate_pb.js";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");

interface Suite {
  name: string;
  descriptor: string;
  gen: string;
  prefix: string;
}

const SUITES: Suite[] = [
  // ZOD_DIFF_GEN points the proto/ suite at another generated tree (e.g. an older generator's output)
  { name: "proto/", descriptor: "gen/descriptor.bin", gen: process.env.ZOD_DIFF_GEN ?? "gen/typescript", prefix: "agentic_mesh_protocol/" },
  { name: "fixtures", descriptor: "tools/zod/test/dist/fixtures.binpb", gen: "tools/zod/test/dist/gen", prefix: "zodtest/" },
];

// ─── Samples ──────────────────────────────────────────────────────────────────

/** A value matching each pattern used by the protos (the test fails on a pattern without one). */
const PATTERN_SAMPLES: Record<string, string> = {
  "^((missions|setups):.+)?$": "missions:m1",
  "^[^.]*([.][^.]+)*[.]?$": "folder/file.txt",
  "^[A-Za-z0-9._:\\[\\]-]+$": "module.local",
  "^(missions|setup_versions):.+$": "missions:m1",
  "^([A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8})*)?$": "fr-FR",
  "^[A-Za-z0-9_:.-]+$": "task:1",
  "^[A-Z][A-Z0-9_]*$": "NOT_FOUND",
  "^([a-z][a-z0-9_]*)?$": "name",
  "(?i)^abc$": "AbC",
};

const EMOJI = "\u{1F600}";

const PATTERN_BREAKERS = [
  " ", "a b", "..", "a..b", "a/../b", "-", "\n", "x\ry", "A", "a", "é", "1abc", "UPPER", "lower_case",
  "a:b", "[x]", "missions:", "missions:x", "setups:y", "setup_versions:z", "fr", "fr-FR", "english",
  "NOT_FOUND", "not_found", "task:1/2", "ABC", "abc", "abcd", "file.", ".hidden", "name.tar.gz",
];

const EMAIL_CASES = [
  "user@example.com", "a@b", "a@b.c", "not-an-email", "a@", "@b.com", "a b@c.com", "a@b..com", "a@-b.com",
  "user+tag@example.co.uk", "\"quoted\"@example.com", "a@b_c.com", "élodie@example.com", "a@b.c.",
];

const URI_CASES = [
  "https://example.com/a b", "http://example.com/a%20b", "mailto:user@example.com", "urn:isbn:0451450523",
  "//example.com/x", "/abs/path", "rel/path", "./x", "../x", "a b", "%zz", "http://[::1]:8080/",
  "http://[fe80::1%25en0]/", "http://[::1", "http://user@host:99999/", "http://exa mple.com",
  "https://example.com/?q=1#frag", "#frag", "?q", "http://%41.com", "http://%ff.com", "https://ex%C3%A9mple.com",
  "https://example.com/é", "HTTP://EXAMPLE.COM", "a:b", "1a:b", "http:", "file:///tmp/x",
];

const HOST_CASES = [
  "example.com", "localhost", "a-.com", "-a.com", "123", "1.2.3.4", "256.1.1.1", "1.2.3.04", "::1", "2001:db8::1",
  "[::1]", "example.com:80", "example.com:99999", "example.com:0", "[::1]:443", "1.2.3.4:80", "exa mple.com",
  `${"a".repeat(64)}.com`, "fe80::1%eth0", "example.com.", "example.123", "123e4567-e89b-12d3-a456-426614174000",
  "123E4567-E89B-12D3-A456-42661417400Z",
];

/** Strings every string field is also tried with. */
const GENERIC_STRINGS = ["xylophone", "x".repeat(70), "main", "bad", "abc", "1", "42", "p_ok", "user@example.com"];

const TIMESTAMP_BASE = 1_700_000_000;

/** Base values a rule spanning several fields needs, which the field-by-field synthesis cannot find. */
const BASE_OVERRIDES: Record<string, (init: Init) => void> = {
  "zodtest.v1.CelCases": (init) => {
    init.tags = ["main", "xy"];
    init.inner = { label: "abc" };
    init.code = "1";
    init.count = 1;
    init.contact = "a@b.co";
    init.prefixed = "p_x";
  },
  "zodtest.v1.MessageOneofCases": (init) => {
    delete init.b;
  },
};

/** Mutations of the rules no single-field mutation breaks. */
const RULE_MUTATIONS: Record<string, (init: Init) => void> = {
  "zodtest.v1.CelCases": (init) => {
    init.blob = new Uint8Array([1]);
    init.tags = [];
    delete init.inner;
  },
};

// ─── Rules reading (independent of the generator) ─────────────────────────────

function rulesSchema(typeName: string): DescMessage {
  const found = file_buf_validate_validate.messages.find((m) => m.typeName === typeName);
  if (!found) throw new Error(`unknown rules message ${typeName}`);
  return found;
}

/** Set fields of a rules message, by proto name. */
function setOf(rules: unknown): Map<string, any> {
  const msg = rules as Record<string, any> & { $typeName: string };
  const r = reflect(rulesSchema(msg.$typeName), msg as never);
  const out = new Map<string, any>();
  for (const f of r.fields) {
    if (r.isSet(f)) out.set(f.name, f.oneof ? msg[f.oneof.localName].value : msg[f.localName]);
  }
  return out;
}

function fieldRules(field: DescField): FieldRules | undefined {
  return hasOption(field, fieldExt) ? (getOption(field, fieldExt) as FieldRules) : undefined;
}

/** Type-specific rules of a field value (items rules for a list). */
function valueRules(field: DescField): Map<string, any> {
  const rules = fieldRules(field);
  if (!rules || rules.type.case === undefined) return new Map();
  if (field.fieldKind === "list") {
    const repeated = setOf(rules.type.value);
    const items = repeated.get("items") as FieldRules | undefined;
    return items && items.type.case !== undefined ? setOf(items.type.value) : new Map();
  }
  return setOf(rules.type.value);
}

function listRules(field: DescField): Map<string, any> {
  const rules = fieldRules(field);
  return rules?.type.case === "repeated" ? setOf(rules.type.value) : new Map();
}

function isRequired(field: DescField): boolean {
  const rules = fieldRules(field);
  return !!rules && rules.required && rules.ignore !== Ignore.ALWAYS;
}

function oneofRequired(desc: DescMessage, name: string): boolean {
  const oneof = desc.oneofs.find((o) => o.name === name)!;
  return hasOption(oneof, oneofExt) && (getOption(oneof, oneofExt) as OneofRules).required;
}

/** Every rule declared on a message, as the keys a violation of it produces. */
function declaredRules(desc: DescMessage): Map<string, { field?: DescField; rule: string }> {
  const out = new Map<string, { field?: DescField; rule: string }>();
  const standard = (field: DescField, prefix: string, caseName: string, set: Map<string, any>) => {
    const bounds = ["gt", "gte"].filter((b) => set.has(b));
    for (const [name, value] of set) {
      if (name === "example" || name === "strict") continue;
      if (value === false) continue;
      // With both bounds, protovalidate reports the range on the lower bound
      if ((name === "lt" || name === "lte") && bounds.length > 0) continue;
      const rule = `${prefix}${caseName}.${name}`;
      out.set(`${field.name}|${rule}`, { field, rule });
    }
  };
  for (const field of desc.fields) {
    const rules = fieldRules(field);
    if (!rules || rules.ignore === Ignore.ALWAYS) continue;
    if (rules.required) out.set(`${field.name}|required`, { field, rule: "required" });
    for (const cel of rules.cel) out.set(`${field.name}|cel:${cel.id}`, { field, rule: `cel:${cel.id}` });
    for (const expr of rules.celExpression) out.set(`${field.name}|cel:${expr}`, { field, rule: `cel:${expr}` });
    if (rules.type.case === "repeated") {
      const repeated = setOf(rules.type.value);
      for (const [name, value] of repeated) {
        if (name === "items") {
          const items = value as FieldRules;
          if (items.ignore === Ignore.ALWAYS) continue;
          for (const cel of items.cel) out.set(`${field.name}|cel:${cel.id}`, { field, rule: `cel:${cel.id}` });
          if (items.type.case !== undefined) standard(field, "repeated.items.", items.type.case, setOf(items.type.value));
        } else if (value !== false) {
          out.set(`${field.name}|repeated.${name}`, { field, rule: `repeated.${name}` });
        }
      }
    } else if (rules.type.case !== undefined) {
      standard(field, "", rules.type.case, setOf(rules.type.value));
    }
  }
  if (hasOption(desc, messageExt)) {
    const rules = getOption(desc, messageExt) as MessageRules;
    for (const cel of rules.cel) out.set(`|cel:${cel.id}`, { rule: `cel:${cel.id}` });
    for (const expr of rules.celExpression) out.set(`|cel:${expr}`, { rule: `cel:${expr}` });
    if (rules.oneof.length > 0) out.set("|message.oneof", { rule: "message.oneof" });
  }
  for (const oneof of desc.oneofs) {
    if (oneofRequired(desc, oneof.name)) out.set(`${oneof.name}|required`, { rule: "required" });
  }
  return out;
}

/** A rule no mutation can break alone: it only refuses the zero value, which `required` refuses first. */
function shadowedByRequired(field: DescField | undefined, rule: string): boolean {
  if (!field || !isRequired(field) || field.oneof || field.proto.proto3Optional) return false;
  const set = valueRules(field);
  if (rule === "string.min_len" || rule === "bytes.min_len") return Number(set.get("min_len")) <= 1;
  if (rule === "enum.not_in") return (set.get("not_in") as number[]).every((n) => n === 0);
  if (rule === "repeated.min_items") return Number(listRules(field).get("min_items")) <= 1;
  return false;
}

/** The key of the rule a violation reports, when it is declared on the root message itself. */
function violationKey(v: Violation): string | undefined {
  const head = v.field[0];
  const rulePath = v.rule.filter((p) => p.kind === "field").map((p) => (p as DescField).name);
  const isCel = rulePath.includes("cel") || rulePath.includes("cel_expression") || (v.field.length === 0 && v.ruleId !== "message.oneof");
  if (!head) {
    return isCel ? `|cel:${v.ruleId}` : `|${v.ruleId}`;
  }
  // A deeper path belongs to a nested message, covered when that message is the root
  const own = v.field.length === 1 || (v.field.length === 2 && v.field[1].kind === "list_sub");
  if (!own) return undefined;
  const name = head.kind === "oneof" || head.kind === "field" ? head.name : "?";
  if (head.kind === "oneof") return `${name}|${v.ruleId}`;
  return isCel ? `${name}|cel:${v.ruleId}` : `${name}|${rulePath.join(".")}`;
}

// ─── Value synthesis ──────────────────────────────────────────────────────────

type Init = Record<string, any>;

interface Variant {
  label: string;
  init: Init;
}

const cp = (s: string) => [...s].length;

function pad(s: string, n: number): string {
  return s + "x".repeat(Math.max(0, n - cp(s)));
}

function truncate(s: string, n: number): string {
  return [...s].slice(0, n).join("");
}

function utf8Len(s: string): number {
  return Buffer.byteLength(s, "utf8");
}

function stringSample(set: Map<string, any>): string {
  if (set.has("const")) return set.get("const");
  if (set.has("in")) return set.get("in")[0];
  let s: string;
  if (set.get("email")) s = "user@example.com";
  else if (set.get("uri")) s = "https://example.com/path";
  else if (set.get("uri_ref")) s = "docs/file.txt";
  else if (set.get("hostname") || set.get("address")) s = "example.com";
  else if (set.get("ip") || set.get("ipv4")) s = "192.168.0.1";
  else if (set.get("ipv6")) s = "2001:db8::1";
  else if (set.get("uuid")) s = "123e4567-e89b-12d3-a456-426614174000";
  else if (set.get("host_and_port")) s = "example.com:8080";
  else if (set.has("pattern")) {
    const sample = PATTERN_SAMPLES[set.get("pattern")];
    if (sample === undefined) throw new Error(`add a sample for the pattern ${JSON.stringify(set.get("pattern"))} to PATTERN_SAMPLES`);
    s = sample;
  } else s = `${set.get("prefix") ?? ""}v1`;
  if (set.has("contains") && !s.includes(set.get("contains"))) s += set.get("contains");
  if (set.has("suffix")) s += set.get("suffix");
  if (set.has("len")) s = truncate(pad(s, Number(set.get("len"))), Number(set.get("len")));
  if (set.has("min_len")) s = pad(s, Number(set.get("min_len")));
  if (set.has("max_len")) s = truncate(s, Number(set.get("max_len")));
  for (const key of ["len_bytes", "min_bytes"]) {
    if (set.has(key)) while (utf8Len(s) < Number(set.get(key))) s += "x";
  }
  if (set.has("len_bytes")) s = s.slice(0, Number(set.get("len_bytes")));
  return s;
}

function stringMutations(set: Map<string, any>, sample: string): string[] {
  const out = new Set<string>(["", sample, EMOJI, " ", ...GENERIC_STRINGS]);
  const prefix: string = set.get("prefix") ?? "";
  if (set.has("min_len")) {
    const min = Number(set.get("min_len"));
    out.add(cp(prefix) < min ? pad(prefix, min - 1) : truncate(prefix, min - 1));
    out.add(pad(prefix, min));
    // min - 1 code points, but more UTF-16 units: catches a length counted in UTF-16
    if (min - 1 - cp(prefix) > 0) out.add(prefix + EMOJI.repeat(min - 1 - cp(prefix)));
  }
  if (set.has("max_len")) {
    const max = Number(set.get("max_len"));
    out.add(pad(prefix, max));
    out.add(pad(prefix, max + 1));
    if (max - cp(prefix) > 0) out.add(prefix + EMOJI.repeat(max - cp(prefix)));
    out.add(prefix + EMOJI.repeat(max - cp(prefix) + 1));
  }
  if (set.has("len")) {
    const len = Number(set.get("len"));
    out.add("x".repeat(len - 1));
    out.add("x".repeat(len + 1));
    out.add(EMOJI.repeat(len));
  }
  for (const key of ["len_bytes", "min_bytes", "max_bytes"]) {
    if (set.has(key)) {
      const n = Number(set.get(key));
      out.add("x".repeat(Math.max(0, n - 1)));
      out.add("x".repeat(n));
      out.add("x".repeat(n + 1));
      out.add("é".repeat(Math.ceil(n / 2)));
    }
  }
  if (prefix) {
    out.add(`x${sample.slice(1)}`);
    out.add(prefix);
    out.add(`${prefix.toUpperCase()}v1`);
  }
  if (set.has("pattern")) PATTERN_BREAKERS.forEach((c) => out.add(c));
  if (set.get("email")) EMAIL_CASES.forEach((c) => out.add(c));
  if (set.get("uri") || set.get("uri_ref")) URI_CASES.forEach((c) => out.add(c));
  for (const key of ["hostname", "ip", "ipv4", "ipv6", "address", "uuid", "host_and_port"]) {
    if (set.get(key)) HOST_CASES.forEach((c) => out.add(c));
  }
  if (set.has("suffix")) out.add(`${sample}x`);
  if (set.has("contains")) out.add("nothing");
  if (set.has("not_contains")) out.add(`a${set.get("not_contains")}b`);
  if (set.has("in")) {
    out.add("zzz");
    for (const x of set.get("in")) out.add(x);
  }
  if (set.has("not_in")) for (const x of set.get("not_in")) out.add(x);
  if (set.has("const")) out.add(`${set.get("const")}x`);
  return [...out];
}

function isBig(scalar: ScalarType): boolean {
  return [ScalarType.INT64, ScalarType.UINT64, ScalarType.SINT64, ScalarType.FIXED64, ScalarType.SFIXED64].includes(scalar);
}

function scalarRange(scalar: ScalarType): [bigint, bigint] | undefined {
  switch (scalar) {
    case ScalarType.INT32:
    case ScalarType.SINT32:
    case ScalarType.SFIXED32:
      return [-(2n ** 31n), 2n ** 31n - 1n];
    case ScalarType.UINT32:
    case ScalarType.FIXED32:
      return [0n, 2n ** 32n - 1n];
    case ScalarType.INT64:
    case ScalarType.SINT64:
    case ScalarType.SFIXED64:
      return [-(2n ** 63n), 2n ** 63n - 1n];
    case ScalarType.UINT64:
    case ScalarType.FIXED64:
      return [0n, 2n ** 64n - 1n];
    default:
      return undefined;
  }
}

function numberValues(scalar: ScalarType, set: Map<string, any>): (number | bigint)[] {
  const range = scalarRange(scalar);
  if (!range) {
    // float / double
    const out = new Set<number>([1, 0, -0, -1, 0.5, 2.5, 42, NaN, Infinity, -Infinity, 1e300, 3.5e38, 0.1, 0.1000001]);
    for (const key of ["gt", "gte", "lt", "lte", "const"]) {
      if (set.has(key)) {
        const b = Number(set.get(key));
        [b - 0.5, b, b + 0.5, Math.fround(b), b + 1e-9].forEach((x) => out.add(x));
      }
    }
    for (const key of ["in", "not_in"]) for (const x of set.get(key) ?? []) out.add(Number(x));
    return [...out];
  }
  const out = new Set<bigint>([1n, 2n, 42n, 0n, -1n, 100n, range[0], range[1]]);
  for (const key of ["gt", "gte", "lt", "lte", "const"]) {
    if (set.has(key)) {
      const b = BigInt(set.get(key));
      [b - 1n, b, b + 1n].forEach((x) => out.add(x));
    }
  }
  for (const key of ["in", "not_in"]) for (const x of set.get(key) ?? []) out.add(BigInt(x));
  const inRange = [...out].filter((x) => x >= range[0] && x <= range[1]);
  return isBig(scalar) ? inRange : inRange.map((x) => Number(x));
}

class Harness {
  private readonly baseCache = new Map<string, Init[]>();

  constructor(
    readonly registry: Registry,
    readonly validator: Validator,
  ) {}

  /** The message as the receiving side reads it: encoded, then decoded (a float travels as a float32). */
  static wire(desc: DescMessage, init: Init): Uint8Array | undefined {
    try {
      return toBinary(desc, create(desc, init as never));
    } catch {
      return undefined; // a value the wire cannot carry (out of range)
    }
  }

  verdict(desc: DescMessage, init: Init, bytes = Harness.wire(desc, init)): { valid: boolean; violations: Violation[]; error?: string } {
    if (!bytes) return { valid: false, violations: [], error: "not encodable" };
    const result = this.validator.validate(desc, fromBinary(desc, bytes));
    if (result.kind === "valid") return { valid: true, violations: [] };
    if (result.kind === "invalid") return { valid: false, violations: result.violations };
    return { valid: false, violations: [], error: String(result.error) };
  }

  /** Violations reported on one field (or oneof) of the message. */
  fieldViolations(desc: DescMessage, init: Init, name: string): Violation[] {
    return this.verdict(desc, init).violations.filter((v) => {
      const head = v.field[0];
      return head && (head.kind === "field" || head.kind === "oneof") && head.name === name;
    });
  }

  /** Candidate values of a field, the likely valid ones first. */
  candidates(field: DescField, depth: number): unknown[] {
    const set = valueRules(field);
    const one = (): unknown[] => {
      if (field.fieldKind === "message" || (field.fieldKind === "list" && field.listKind === "message")) {
        const msg = field.message;
        switch (msg.typeName) {
          case "google.protobuf.Timestamp":
            return [{ seconds: BigInt(TIMESTAMP_BASE + field.number * 60), nanos: 0 }];
          case "google.protobuf.Struct":
            return [{ key: "value" }, {}];
          default:
            return depth > 3 ? [] : this.bases(msg, depth + 1);
        }
      }
      if (field.fieldKind === "enum" || (field.fieldKind === "list" && field.listKind === "enum")) {
        const values = field.enum.values.map((v) => v.number);
        return [...values.filter((n) => n !== 0), 0];
      }
      const scalar = (field as { scalar: ScalarType }).scalar;
      switch (scalar) {
        case ScalarType.STRING: {
          const sample = stringSample(set);
          return [sample, "s", "value", ""];
        }
        case ScalarType.BOOL:
          return [true, false];
        case ScalarType.BYTES: {
          const n = Number(set.get("len") ?? set.get("min_len") ?? 0);
          return [new Uint8Array(n).fill(97), new Uint8Array([97, 98]), new Uint8Array(0)];
        }
        default:
          return numberValues(scalar, set);
      }
    };
    if (field.fieldKind === "list") {
      const items = one();
      const lr = listRules(field);
      const min = Number(lr.get("min_items") ?? 0);
      const lists: unknown[][] = [];
      for (const item of items.slice(0, 8)) {
        const distinct = items.filter((x) => x !== item).slice(0, Math.max(0, min - 1));
        lists.push([item, ...distinct]);
      }
      lists.push([]);
      return lists;
    }
    if (field.fieldKind === "map") {
      return [{ k: "v" }, {}];
    }
    return one();
  }

  /** Valid values of a message, one per member of its first oneof when possible (the first is the base). */
  bases(desc: DescMessage, depth = 0): Init[] {
    const cached = this.baseCache.get(desc.typeName);
    if (cached) return cached;
    this.baseCache.set(desc.typeName, []); // recursion guard
    const init: Init = {};
    for (const field of desc.fields) {
      if (field.oneof) continue;
      this.pick(desc, init, field, depth);
    }
    BASE_OVERRIDES[desc.typeName]?.(init);
    const out: Init[] = [];
    const firstOneof = desc.oneofs[0];
    const fillOneofs = (start: Init, skip?: string): Init => {
      const value = structuredClone(start);
      for (const oneof of desc.oneofs) {
        if (oneof.name === skip) continue;
        for (const member of oneof.fields) {
          if (this.pickOneof(desc, value, member, depth)) break;
        }
      }
      return value;
    };
    if (firstOneof) {
      for (const member of firstOneof.fields) {
        const value = structuredClone(init);
        if (this.pickOneof(desc, value, member, depth)) out.push(fillOneofs(value, firstOneof.name));
      }
    }
    if (out.length === 0) out.push(fillOneofs(init));
    this.baseCache.set(desc.typeName, out);
    return out;
  }

  private pick(desc: DescMessage, init: Init, field: DescField, depth: number): void {
    const cands = this.candidates(field, depth);
    for (const cand of cands) {
      init[field.localName] = structuredClone(cand);
      if (this.fieldViolations(desc, init, field.name).length === 0) return;
    }
    // Nothing fits (a recursion cut, or a rule the candidates miss): leave the field unset
    delete init[field.localName];
  }

  private pickOneof(desc: DescMessage, init: Init, member: DescField, depth: number): boolean {
    const oneof = member.oneof!;
    for (const cand of this.candidates(member, depth)) {
      init[oneof.localName] = { case: member.localName, value: structuredClone(cand) };
      const bad = [...this.fieldViolations(desc, init, member.name), ...this.fieldViolations(desc, init, oneof.name)];
      if (bad.length === 0) return true;
    }
    delete init[oneof.localName];
    return false;
  }

  /** Variants of a message: its bases, then mutations of every field. */
  variants(desc: DescMessage, depth: number): Variant[] {
    const bases = this.bases(desc);
    const base = bases[0];
    const out: Variant[] = bases.map((init, i) => ({ label: i === 0 ? "base" : `oneof variant ${i}`, init }));
    const withField = (label: string, field: DescField, value: unknown): Variant => {
      const init = structuredClone(base);
      if (field.oneof) {
        if (value === undefined) {
          if (init[field.oneof.localName]?.case === field.localName) delete init[field.oneof.localName];
        } else {
          init[field.oneof.localName] = { case: field.localName, value };
        }
      } else if (value === undefined) {
        delete init[field.localName];
      } else {
        init[field.localName] = value;
      }
      return { label: `${field.name} = ${label}`, init };
    };

    // Only the fields that carry a rule, and the members of a required oneof
    const minimal = structuredClone(base);
    for (const field of desc.fields) {
      if (field.oneof) {
        if (!oneofRequired(desc, field.oneof.name)) delete minimal[field.oneof.localName];
      } else if (!isRequired(field)) {
        delete minimal[field.localName];
      }
    }
    out.push({ label: "only required fields", init: minimal });
    out.push({ label: "empty message", init: {} });
    const ruleMutation = RULE_MUTATIONS[desc.typeName];
    if (ruleMutation) {
      const init = structuredClone(base);
      ruleMutation(init);
      out.push({ label: "rule mutation", init });
    }
    for (const oneof of desc.oneofs) {
      const init = structuredClone(base);
      delete init[oneof.localName];
      out.push({ label: `${oneof.name} unset`, init });
    }

    const timestamps = desc.fields.filter((f) => f.fieldKind === "message" && f.message.typeName === "google.protobuf.Timestamp");
    for (const field of desc.fields) {
      out.push(withField("unset", field, undefined));
      for (const [label, value] of this.fieldMutations(field, depth, timestamps.map((t) => base[t.localName]).filter(Boolean))) {
        out.push(withField(label, field, value));
      }
      // Items appended to the base list: rules over the whole list (unique, CEL) see the base items too
      const baseList = base[field.localName];
      if (field.fieldKind === "list" && field.listKind !== "message" && Array.isArray(baseList) && baseList.length > 0) {
        const single = this.fieldMutations(field, depth, []).filter(([l, v]) => /^\[[^,]*\]$/.test(l) && (v as unknown[]).length === 1);
        for (const [label, value] of single) {
          const item = (value as unknown[])[0];
          out.push(withField(`base + ${label}`, field, [...structuredClone(baseList), item]));
          out.push(withField(`base + ${label} twice`, field, [...structuredClone(baseList), item, item]));
        }
      }
    }
    return out;
  }

  private fieldMutations(field: DescField, depth: number, timestamps: unknown[]): [string, unknown][] {
    const set = valueRules(field);
    const show = (x: unknown) => (typeof x === "string" ? JSON.stringify(x) : x instanceof Uint8Array ? `bytes(${x.length})` : typeof x === "bigint" ? `${x}n` : Object.is(x, -0) ? "-0" : String(x));
    const scalarValues = (): unknown[] => {
      if (field.fieldKind === "enum" || (field.fieldKind === "list" && field.listKind === "enum")) {
        return [...new Set([...field.enum.values.map((v) => v.number), 0, 99, -1])];
      }
      const scalar = (field as { scalar: ScalarType }).scalar;
      switch (scalar) {
        case ScalarType.STRING:
          return stringMutations(set, stringSample(set));
        case ScalarType.BOOL:
          return [true, false];
        case ScalarType.BYTES: {
          const sizes = new Set([0, 1, 2, 3, 4, 5]);
          for (const key of ["len", "min_len", "max_len"]) if (set.has(key)) [-1, 0, 1].forEach((d) => sizes.add(Number(set.get(key)) + d));
          return [...sizes].filter((n) => n >= 0).map((n) => new Uint8Array(n).fill(97));
        }
        default:
          return numberValues(scalar, set);
      }
    };

    if (field.fieldKind === "message") {
      return this.messageMutations(field.message, depth, timestamps).map(([l, v]) => [l, v]);
    }
    if (field.fieldKind === "map") {
      return [["{}", {}], ["one pair", { k: "v" }]];
    }
    if (field.fieldKind === "list") {
      const itemBase = this.candidates(field, depth).find((l) => (l as unknown[]).length > 0) as unknown[] | undefined;
      const item = itemBase?.[0];
      const lr = listRules(field);
      const out: [string, unknown][] = [["[]", []]];
      if (item !== undefined) {
        out.push(["[item]", [item]], ["[item, item]", [item, item]]);
        const max = lr.has("max_items") ? Number(lr.get("max_items")) : 3;
        out.push([`${max + 1} items`, Array.from({ length: max + 1 }, () => structuredClone(item))]);
        const min = Number(lr.get("min_items") ?? 0);
        if (min > 1) out.push([`${min - 1} items`, Array.from({ length: min - 1 }, () => structuredClone(item))]);
      }
      const items: [string, unknown][] =
        field.listKind === "message" ? this.messageMutations(field.message, depth, []) : scalarValues().map((x) => [show(x), x]);
      for (const [label, value] of items) {
        out.push([`[${label}]`, [value]]);
        if (item !== undefined) out.push([`[item, ${label}]`, [structuredClone(item), value]]);
      }
      return out;
    }
    return scalarValues().map((x) => [show(x), x]);
  }

  private messageMutations(msg: DescMessage, depth: number, timestamps: unknown[]): [string, unknown][] {
    switch (msg.typeName) {
      case "google.protobuf.Timestamp": {
        const out: [string, unknown][] = [
          ["epoch", { seconds: 0n, nanos: 0 }],
          ["early", { seconds: BigInt(TIMESTAMP_BASE - 100_000), nanos: 0 }],
          ["late", { seconds: BigInt(TIMESTAMP_BASE + 100_000), nanos: 0 }],
        ];
        for (const [i, t] of timestamps.entries()) {
          const ts = t as { seconds: bigint; nanos: number };
          out.push([`same as timestamp #${i}`, { ...ts }]);
          out.push([`timestamp #${i} + 1ms`, { seconds: ts.seconds, nanos: ts.nanos + 1_000_000 }]);
          out.push([`timestamp #${i} - 1ms`, { seconds: ts.seconds - 1n, nanos: 999_000_000 }]);
        }
        return out;
      }
      case "google.protobuf.Struct":
        return [["{}", {}], ["{a: 1}", { a: 1 }], ["nested", { a: { b: [1, "x", null, true] } }]];
    }
    const out: [string, unknown][] = this.bases(msg).map((init, i) => [`${msg.name} variant ${i}`, init]);
    if (depth === 0) {
      for (const v of this.variants(msg, depth + 1)) {
        out.push([`${msg.name} {${v.label}}`, v.init]);
      }
    }
    return out;
  }
}

// ─── ts-proto shape ───────────────────────────────────────────────────────────

/** Removes the implicit-presence properties that hold their zero value, as a hand-built object omits them. */
function stripZeros(desc: DescMessage, value: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = { ...value };
  const key = (f: DescField) => tsProtoName(f.name);
  for (const field of desc.fields) {
    const k = key(field);
    const v = out[k];
    if (v === undefined) continue;
    if (field.fieldKind === "message") {
      if (!isWkt(field.message)) out[k] = stripZeros(field.message, v);
      continue;
    }
    if (field.fieldKind === "list") {
      if (v.length === 0) delete out[k];
      else if (field.listKind === "message" && !isWkt(field.message)) out[k] = v.map((x: any) => stripZeros(field.message, x));
      continue;
    }
    if (field.fieldKind === "map") {
      if (Object.keys(v).length === 0) delete out[k];
      continue;
    }
    if (field.oneof || field.proto.proto3Optional) continue;
    const zero = v === "" || v === 0 || v === false || v === "0" || (v instanceof Uint8Array && v.length === 0);
    if (zero) delete out[k];
  }
  return out;
}

function isWkt(desc: DescMessage): boolean {
  return desc.typeName.startsWith("google.protobuf.");
}

function tsProtoName(name: string): string {
  if (!name.includes("_")) return name;
  const hasLower = /[a-z]/.test(name);
  return name
    .split("_")
    .map((w, i) => {
      const word = hasLower ? w : w.toLowerCase();
      return i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join("");
}

interface ZodLike {
  safeParse(value: unknown): { success: boolean; error?: { issues: { message: string; path: PropertyKey[] }[] } };
}

function zodVerdict(schema: ZodLike, value: unknown): { valid: boolean; issues: string } {
  const result = schema.safeParse(value); // an exception fails the test: a schema must never throw
  return {
    valid: result.success,
    issues: result.success ? "" : result.error!.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
  };
}

function describeValue(value: unknown): string {
  return JSON.stringify(value, (_k, x) => (typeof x === "bigint" ? `${x}n` : x instanceof Uint8Array ? `bytes(${x.length})` : x), 0).slice(0, 400);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

for (const suite of SUITES) {
  const descriptorPath = path.join(ROOT, suite.descriptor);
  const registry = createFileRegistry(fromBinary(FileDescriptorSetSchema, fs.readFileSync(descriptorPath)));
  const validator = createValidator({ registry });
  const harness = new Harness(registry, validator);
  const messages: DescMessage[] = [];
  for (const file of registry.files) {
    if (file.name.startsWith(suite.prefix)) messages.push(...file.messages);
  }

  describe(`protovalidate vs zod — ${suite.name}`, () => {
    it("finds messages to compare", () => {
      assert.ok(messages.length > 0, `no message under ${suite.prefix} in ${suite.descriptor}`);
    });

    for (const desc of messages) {
      it(desc.typeName, (t) => {
        const tsProto = require(path.join(ROOT, suite.gen, `${desc.file.name}.js`))[desc.name];
        const schema: ZodLike = require(path.join(ROOT, suite.gen, `${desc.file.name}_zod.js`))[`${desc.name}Schema`];
        assert.ok(tsProto?.decode, `ts-proto ${desc.name} not found`);
        assert.ok(schema?.safeParse, `${desc.name}Schema not found`);

        const base = harness.bases(desc)[0];
        const baseVerdict = harness.verdict(desc, base);
        assert.ok(
          baseVerdict.valid,
          `the synthesized base of ${desc.typeName} is invalid for protovalidate: ${baseVerdict.violations.map(String).join("; ")} — ${describeValue(base)}`,
        );

        const disagreements: string[] = [];
        const covered = new Set<string>();
        let compared = 0;
        let refused = 0;
        const decodedValid: Record<string, any>[] = [];

        for (const variant of harness.variants(desc, 0)) {
          const bytes = Harness.wire(desc, variant.init);
          if (!bytes) continue; // a value the wire cannot carry (out of range): not comparable
          const pv = harness.verdict(desc, variant.init, bytes);
          compared++;
          if (!pv.valid) refused++;
          const decoded = tsProto.decode(bytes);
          const z1 = zodVerdict(schema, decoded);
          const z2 = zodVerdict(schema, stripZeros(desc, decoded));
          if (z1.valid !== pv.valid || z2.valid !== pv.valid) {
            disagreements.push(
              [
                `${variant.label}: protovalidate ${pv.valid ? "accepts" : "refuses"} (${pv.error ?? pv.violations.map((v) => `${v.field.map((p) => ("name" in p ? p.name : "")).join(".")}: [${v.ruleId}] ${v.message}`).join("; ")})`,
                `  zod(decoded) ${z1.valid ? "accepts" : "refuses"} ${z1.issues}`,
                `  zod(no zeros) ${z2.valid ? "accepts" : "refuses"} ${z2.issues}`,
                `  value ${describeValue(variant.init)}`,
              ].join("\n"),
            );
            continue;
          }
          if (pv.valid) decodedValid.push(decoded);
          for (const v of pv.violations) {
            const key = violationKey(v);
            if (key) covered.add(key);
          }
        }

        const declared = declaredRules(desc);
        t.diagnostic(`${compared} variants compared, ${refused} refused by both, ${declared.size} declared rules`);
        assert.equal(disagreements.length, 0, `${disagreements.length} disagreement(s):\n${disagreements.slice(0, 15).join("\n")}`);

        const missing = [...declared]
          .filter(([key, { field, rule }]) => !covered.has(key) && !shadowedByRequired(field, rule))
          .map(([key]) => key);
        assert.deepEqual(missing, [], `rules no variant breaks (extend the mutations of the test): ${missing.join(", ")}`);

        // ts-proto shapes the wire cannot carry: the schema must refuse them, without throwing
        const sample = decodedValid[0];
        for (const oneof of desc.oneofs) {
          const members = oneof.fields.map((f) => tsProtoName(f.name));
          const withTwo = decodedValid.map((d) => ({ ...d })).find((d) => members.some((m) => d[m] !== undefined));
          const donor = decodedValid.find((d) => members.filter((m) => d[m] !== undefined).some((m) => withTwo && withTwo[m] === undefined));
          if (withTwo && donor) {
            const other = members.find((m) => donor[m] !== undefined && withTwo[m] === undefined)!;
            withTwo[other] = donor[other];
            assert.equal(zodVerdict(schema, withTwo).valid, false, `two members of oneof ${oneof.name} set must be refused`);
          }
        }
        for (const field of desc.fields) {
          const k = tsProtoName(field.name);
          const scalar = (field as { scalar?: ScalarType }).scalar;
          if (sample === undefined || scalar === undefined || !(field.fieldKind === "scalar" || field.fieldKind === "list")) continue;
          const bad: unknown[] = isBig(scalar)
            ? ["abc", "1.5", "0x10", " 1", "99999999999999999999999"]
            : scalarRange(scalar)
              ? [2 ** 32 + 1, -(2 ** 32), 1.5]
              : [];
          for (const b of bad) {
            const value: Record<string, unknown> = { ...sample, [k]: field.fieldKind === "list" ? [b] : b };
            assert.equal(zodVerdict(schema, value).valid, false, `${k} = ${describeValue(b)} must be refused`);
          }
        }
      });
    }
  });
}
