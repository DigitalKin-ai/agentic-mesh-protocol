/**
 * Runtime helpers of the generated *_zod.ts schemas.
 *
 * protoc-gen-zod emits this file verbatim as `zod_rules.ts` at the root of its output, and
 * imports it as `__r` from every schema file. Each helper reproduces the protovalidate-es
 * evaluation of the rule it serves, so a schema accepts exactly what protovalidate accepts.
 *
 * isEmail, isHostname, isIp, isHostAndPort, isUri, isUriRef and unique are ported from
 * protovalidate-es (src/lib.ts), and matches from @bufbuild/cel (std/logic.ts),
 * Copyright 2024-2026 Buf Technologies, Inc., licensed under the Apache License, Version 2.0.
 */

/* eslint-disable */

/** The part of a Zod refinement context the helpers write to. */
export interface IssueSink {
  addIssue(issue: { code: "custom"; message: string; path?: (string | number)[] }): void;
}

function report(ctx: IssueSink, id: string, message: string, path?: (string | number)[]): void {
  ctx.addIssue(path ? { code: "custom", message: `${id}: ${message}`, path } : { code: "custom", message: `${id}: ${message}` });
}

/**
 * Evaluates a CEL rule compiled to a predicate: `true` or `""` passes, `false` or a non-empty
 * string fails. A predicate that throws fails too — protovalidate reports a runtime error
 * (division by zero, overflow, a value the field schema already refused) as a failure.
 */
export function cel(
  ctx: IssueSink,
  value: unknown,
  predicate: (v: any) => boolean | string,
  id: string,
  message: string,
  path?: (string | number)[],
): void {
  let result: boolean | string;
  try {
    result = predicate(value);
  } catch (err) {
    report(ctx, id, `${message || "rule"} (could not be evaluated: ${err instanceof Error ? err.message : String(err)})`, path);
    return;
  }
  if (result === true || result === "") {
    return;
  }
  report(ctx, id, message || (typeof result === "string" ? result : "rule failed"), path);
}

/**
 * Enforces a oneof on the ts-proto shape, where every member is a separate optional property:
 * at most one member may be set (the wire holds only one), and exactly one when it is required.
 */
export function oneof(ctx: IssueSink, value: Record<string, unknown>, name: string, members: string[], required: boolean): void {
  const set = members.filter((m) => value[m] !== undefined);
  if (set.length > 1) {
    report(ctx, "oneof", `only one of ${members.join(", ")} can be set (oneof ${name})`);
  } else if (required && set.length === 0) {
    report(ctx, "required", `exactly one field is required in oneof ${name}`);
  }
}

/** Enforces a (buf.validate.message).oneof rule from the presence of each listed field. */
export function messageOneof(ctx: IssueSink, names: string, required: boolean, set: boolean[]): void {
  const count = set.filter(Boolean).length;
  if (count > 1) {
    report(ctx, "message.oneof", `only one of ${names} can be set`);
  } else if (required && count === 0) {
    report(ctx, "message.oneof", `one of ${names} must be set`);
  }
}

// ─── Scalars ────────────────────────────────────────────────────────────────

/** Number of Unicode code points: what CEL `size()` counts for a string (UTF-16 length overcounts). */
export function cpLen(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        i++;
      }
    }
    n++;
  }
  return n;
}

/** UTF-8 encoding of a string, a lone surrogate becoming U+FFFD as in the protobuf encoders. */
export function utf8(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c >= 0xd800 && c <= 0xdfff) {
      c = 0xfffd;
    }
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c < 0x10000) {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    } else {
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  return Uint8Array.from(out);
}

/** UTF-8 byte length of a string (`bytes(this).size()`). */
export function utf8Len(s: string): number {
  return utf8(s).length;
}

const INT64_MIN = -(BigInt(2) ** BigInt(63));
const INT64_MAX = BigInt(2) ** BigInt(63) - BigInt(1);
const UINT64_MAX = BigInt(2) ** BigInt(64) - BigInt(1);

/** Whether a ts-proto 64-bit integer (forceLong=string) is a decimal the wire can carry. */
export function isInt64(s: string): boolean {
  if (!/^-?[0-9]+$/.test(s)) {
    return false;
  }
  const n = BigInt(s);
  return n >= INT64_MIN && n <= INT64_MAX;
}

/** Whether a ts-proto unsigned 64-bit integer (forceLong=string) is a decimal the wire can carry. */
export function isUint64(s: string): boolean {
  return /^[0-9]+$/.test(s) && BigInt(s) <= UINT64_MAX;
}

/** A CEL int result, which must stay within int64 (CEL reports an overflow error). */
export function i64(n: bigint): bigint {
  if (n < INT64_MIN || n > INT64_MAX) {
    throw new Error("int64 overflow");
  }
  return n;
}

/** A CEL uint result, which must stay within uint64 (CEL reports an overflow error). */
export function u64(n: bigint): bigint {
  if (n < BigInt(0) || n > UINT64_MAX) {
    throw new Error("uint64 overflow");
  }
  return n;
}

/** Milliseconds of a ts-proto Timestamp (a Date, useDate=true); an unset Timestamp reads as the epoch. */
export function tsMillis(v: unknown): number {
  if (v === undefined) {
    return 0;
  }
  const t = v instanceof Date ? v.getTime() : new Date(v as string).getTime();
  if (Number.isNaN(t)) {
    throw new Error("invalid timestamp");
  }
  return t;
}

/** The empty bytes value, read for an unset bytes field. */
export const EMPTY_BYTES = new Uint8Array(0);

/** Byte-wise equality of two bytes values. */
export function bytesEq(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

/** CEL equality used by `in`: strict equality, bytes compared by content. */
export function inList(value: unknown, list: readonly unknown[]): boolean {
  for (const item of list) {
    if (item instanceof Uint8Array && value instanceof Uint8Array ? bytesEq(item, value) : item === value) {
      return true;
    }
  }
  return false;
}

/** List index with CEL bounds checking. */
export function at<T>(list: readonly T[], index: bigint): T {
  if (index < BigInt(0) || index >= BigInt(list.length)) {
    throw new Error("index out of range");
  }
  return list[Number(index)] as T;
}

/** `double.isInf(sign)`: infinite, optionally only positive (sign > 0) or negative (sign < 0). */
export function isInf(v: number, sign: bigint = BigInt(0)): boolean {
  return (sign >= BigInt(0) && v === Number.POSITIVE_INFINITY) || (sign <= BigInt(0) && v === Number.NEGATIVE_INFINITY);
}

/** Whether every item of a list differs from the others (protovalidate `unique`). */
export function unique(list: readonly unknown[]): boolean {
  return list.every((a, index, arr) => {
    if (a instanceof Uint8Array) {
      for (let i = 0; i < arr.length; i++) {
        const b = arr[i];
        if (i !== index && b instanceof Uint8Array && bytesEq(a, b)) {
          return false;
        }
      }
      return true;
    }
    return arr.indexOf(a) === index;
  });
}

// ─── Regular expressions (@bufbuild/cel `matches`) ──────────────────────────

/** ECMAScript patterns RE2 does not support: protovalidate refuses them. */
const invalidPatterns = [
  /\\[1-9]/,
  /\\k<.>/,
  /\(\?\=/,
  /\(\?\!/,
  /\(\?\<\=/,
  /\(\?\<\!/,
  /\\c[A-Z]/,
  /\\u[0-9a-fA-F]{4}/,
  /\\0(?!\d)/,
  /\[\\b.*\]/,
];
const flagPattern = /^\(\?([ims\-]+)\)/;
const regexCache = new Map<string, RegExp>();

/** Compiles a CEL (RE2) pattern the way protovalidate-es does: leading `(?flags)` group, ECMAScript engine. */
export function regex(pattern: string): RegExp {
  let re = regexCache.get(pattern);
  if (re) {
    return re;
  }
  for (const invalid of invalidPatterns) {
    if (invalid.test(pattern)) {
      throw new Error(`Error evaluating pattern ${pattern}, invalid RE2 syntax`);
    }
  }
  let flags = "";
  let source = pattern;
  const flagMatch = source.match(flagPattern);
  if (flagMatch) {
    for (const flag of flagMatch[1] ?? "") {
      if (flag === "-") {
        break;
      }
      flags += flag;
    }
    source = source.substring(flagMatch[0].length);
  }
  re = new RegExp(source, flags);
  regexCache.set(pattern, re);
  return re;
}

/** CEL `string.matches(pattern)`. */
export function matches(s: string, pattern: string): boolean {
  return regex(pattern).test(s);
}

// ─── Well-known string formats (protovalidate-es lib.ts) ────────────────────

/** An email address as defined by the HTML standard (protovalidate `string.email`). */
export function isEmail(s: string): boolean {
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(s);
}

/** A host name (protovalidate `string.hostname`). */
export function isHostname(str: string): boolean {
  if (str.length > 253) {
    return false;
  }
  const s = str.endsWith(".") ? str.substring(0, str.length - 1) : str;
  let allDigits = false;
  for (const part of s.split(".")) {
    allDigits = true;
    const l = part.length;
    if (l == 0 || l > 63 || part.startsWith("-") || part.endsWith("-")) {
      return false;
    }
    for (const ch of part.split("")) {
      if ((ch < "a" || ch > "z") && (ch < "A" || ch > "Z") && (ch < "0" || ch > "9") && ch != "-") {
        return false;
      }
      allDigits = allDigits && ch >= "0" && ch <= "9";
    }
  }
  return !allDigits;
}

/** An IPv4 or IPv6 address, optionally of one version (protovalidate `string.ip`, `ipv4`, `ipv6`). */
export function isIp(str: string, version?: number | bigint): boolean {
  if (version == 6) {
    return new Ipv6(str).address();
  }
  if (version == 4) {
    return new Ipv4(str).address();
  }
  if (version === undefined || version == 0) {
    return new Ipv4(str).address() || new Ipv6(str).address();
  }
  return false;
}

/** A host name or an IP address (protovalidate `string.address`). */
export function isAddress(str: string): boolean {
  return isHostname(str) || isIp(str);
}

/** A host/port pair (protovalidate `string.host_and_port`). */
export function isHostAndPort(str: string, portRequired: boolean): boolean {
  if (str.length == 0) {
    return false;
  }
  const splitIdx = str.lastIndexOf(":");
  if (str.charAt(0) == "[") {
    const end = str.lastIndexOf("]");
    switch (end + 1) {
      case str.length:
        return !portRequired && isIp(str.substring(1, end), 6);
      case splitIdx:
        return isIp(str.substring(1, end), 6) && isPort(str.substring(splitIdx + 1));
      default:
        return false;
    }
  }
  if (splitIdx < 0) {
    return !portRequired && (isHostname(str) || isIp(str, 4));
  }
  const host = str.substring(0, splitIdx);
  const port = str.substring(splitIdx + 1);
  return (isHostname(host) || isIp(host, 4)) && isPort(port);
}

function isPort(str: string): boolean {
  if (str.length == 0) {
    return false;
  }
  for (let i = 0; i < str.length; i++) {
    const c = str.charAt(i);
    if ("0" <= c && c <= "9") {
      continue;
    }
    return false;
  }
  if (str.length > 1 && str.charAt(0) === "0") {
    return false;
  }
  return parseInt(str) <= 65535;
}

/** A URI as defined by RFC 3986 (protovalidate `string.uri`). */
export function isUri(str: string): boolean {
  return new Uri(str).uri();
}

/** A URI or a relative reference as defined by RFC 3986 (protovalidate `string.uri_ref`). */
export function isUriRef(str: string): boolean {
  return new Uri(str).uriReference();
}

class Ipv4 {
  private i = 0;
  private readonly l: number;
  readonly octets: number[] = [];

  constructor(private readonly str: string) {
    this.l = str.length;
  }

  address(): boolean {
    return this.addressPart() && this.i == this.l;
  }

  private addressPart(): boolean {
    const start = this.i;
    if (this.decOctet() && this.take(".") && this.decOctet() && this.take(".") && this.decOctet() && this.take(".") && this.decOctet()) {
      return true;
    }
    this.i = start;
    return false;
  }

  private decOctet(): boolean {
    const start = this.i;
    while (this.digit()) {
      if (this.i - start > 3) {
        return false;
      }
    }
    const str = this.str.substring(start, this.i);
    if (str.length == 0) {
      return false;
    }
    if (str.length > 1 && str.charAt(0) == "0") {
      return false;
    }
    const value = parseInt(str, 10);
    if (value > 255) {
      return false;
    }
    this.octets.push(value);
    return true;
  }

  private digit(): boolean {
    const c = this.str.charAt(this.i);
    if ("0" <= c && c <= "9") {
      this.i++;
      return true;
    }
    return false;
  }

  private take(char: string): boolean {
    if (this.str.charAt(this.i) == char) {
      this.i++;
      return true;
    }
    return false;
  }
}

class Ipv6 {
  private i = 0;
  private readonly l: number;
  private readonly pieces: number[] = [];
  private doubleColonSeen = false;
  private dottedRaw = "";

  constructor(private readonly str: string) {
    this.l = str.length;
  }

  address(): boolean {
    return this.addressPart() && this.i == this.l;
  }

  private addressPart(): boolean {
    while (this.i < this.l) {
      if ((this.doubleColonSeen || this.pieces.length == 6) && this.dotted()) {
        return new Ipv4(this.dottedRaw).address();
      }
      const result = this.h16();
      if (result === "error") {
        return false;
      }
      if (result) {
        continue;
      }
      if (this.take(":")) {
        if (this.take(":")) {
          if (this.doubleColonSeen) {
            return false;
          }
          this.doubleColonSeen = true;
          if (this.take(":")) {
            return false;
          }
        } else if (this.i === 1 || this.i === this.str.length) {
          return false;
        }
        continue;
      }
      if (this.str.charAt(this.i) == "%" && !this.zoneId()) {
        return false;
      }
      break;
    }
    if (this.doubleColonSeen) {
      return this.pieces.length < 8;
    }
    return this.pieces.length == 8;
  }

  private zoneId(): boolean {
    const start = this.i;
    if (this.take("%")) {
      if (this.l - this.i > 0) {
        this.i = this.l;
        return true;
      }
    }
    this.i = start;
    return false;
  }

  private dotted(): boolean {
    const start = this.i;
    this.dottedRaw = "";
    for (;;) {
      if (this.digit() || this.take(".")) {
        continue;
      }
      break;
    }
    if (this.i - start >= 7) {
      this.dottedRaw = this.str.substring(start, this.i);
      return true;
    }
    this.i = start;
    return false;
  }

  private h16(): boolean | "error" {
    const start = this.i;
    while (this.hexdig()) {
      // continue
    }
    const str = this.str.substring(start, this.i);
    if (str.length == 0) {
      return false;
    }
    if (str.length > 4) {
      return "error";
    }
    this.pieces.push(parseInt(str, 16));
    return true;
  }

  private hexdig(): boolean {
    const c = this.str.charAt(this.i);
    if (("0" <= c && c <= "9") || ("a" <= c && c <= "f") || ("A" <= c && c <= "F")) {
      this.i++;
      return true;
    }
    return false;
  }

  private digit(): boolean {
    const c = this.str.charAt(this.i);
    if ("0" <= c && c <= "9") {
      this.i++;
      return true;
    }
    return false;
  }

  private take(char: string): boolean {
    if (this.str.charAt(this.i) == char) {
      this.i++;
      return true;
    }
    return false;
  }
}

class Uri {
  private i = 0;
  private readonly l: number;
  private pctEncodedFound = false;

  constructor(private readonly str: string) {
    this.l = str.length;
  }

  // URI = scheme ":" hier-part [ "?" query ] [ "#" fragment ]
  uri(): boolean {
    const start = this.i;
    if (!(this.scheme() && this.take(":") && this.hierPart())) {
      this.i = start;
      return false;
    }
    if (this.take("?") && !this.query()) {
      return false;
    }
    if (this.take("#") && !this.fragment()) {
      return false;
    }
    if (this.i != this.l) {
      this.i = start;
      return false;
    }
    return true;
  }

  // hier-part = "//" authority path-abempty / path-absolute / path-rootless / path-empty
  private hierPart(): boolean {
    const start = this.i;
    if (this.take("/") && this.take("/") && this.authority() && this.pathAbempty()) {
      return true;
    }
    this.i = start;
    return this.pathAbsolute() || this.pathRootless() || this.pathEmpty();
  }

  // URI-reference = URI / relative-ref
  uriReference(): boolean {
    return this.uri() || this.relativeRef();
  }

  // relative-ref = relative-part [ "?" query ] [ "#" fragment ]
  private relativeRef(): boolean {
    const start = this.i;
    if (!this.relativePart()) {
      return false;
    }
    if (this.take("?") && !this.query()) {
      this.i = start;
      return false;
    }
    if (this.take("#") && !this.fragment()) {
      this.i = start;
      return false;
    }
    if (this.i != this.l) {
      this.i = start;
      return false;
    }
    return true;
  }

  // relative-part = "//" authority path-abempty / path-absolute / path-noscheme / path-empty
  private relativePart(): boolean {
    const start = this.i;
    if (this.take("/") && this.take("/") && this.authority() && this.pathAbempty()) {
      return true;
    }
    this.i = start;
    return this.pathAbsolute() || this.pathNoscheme() || this.pathEmpty();
  }

  // scheme = ALPHA *( ALPHA / DIGIT / "+" / "-" / "." ), terminated by ":"
  private scheme(): boolean {
    const start = this.i;
    if (this.alpha()) {
      while (this.alpha() || this.digit() || this.take("+") || this.take("-") || this.take(".")) {
        // continue
      }
      if (this.str.charAt(this.i) == ":") {
        return true;
      }
    }
    this.i = start;
    return false;
  }

  // authority = [ userinfo "@" ] host [ ":" port ]
  private authority(): boolean {
    const start = this.i;
    if (this.userinfo()) {
      if (!this.take("@")) {
        this.i = start;
        return false;
      }
    }
    if (!this.host()) {
      this.i = start;
      return false;
    }
    if (this.take(":")) {
      if (!this.port()) {
        this.i = start;
        return false;
      }
    }
    if (!this.isAuthorityEnd()) {
      this.i = start;
      return false;
    }
    return true;
  }

  private isAuthorityEnd(): boolean {
    return this.str.charAt(this.i) == "?" || this.str.charAt(this.i) == "#" || this.str.charAt(this.i) == "/" || this.i >= this.l;
  }

  // userinfo = *( unreserved / pct-encoded / sub-delims / ":" ), terminated by "@"
  private userinfo(): boolean {
    const start = this.i;
    for (;;) {
      if (this.unreserved() || this.pctEncoded() || this.subDelims() || this.take(":")) {
        continue;
      }
      if (this.str.charAt(this.i) == "@") {
        return true;
      }
      this.i = start;
      return false;
    }
  }

  // host = IP-literal / IPv4address / reg-name
  private host(): boolean {
    const start = this.i;
    this.pctEncodedFound = false;
    if ((this.str.charAt(this.i) == "[" && this.ipLiteral()) || this.regName()) {
      if (this.pctEncodedFound) {
        const rawHost = this.str.substring(start, this.i);
        try {
          decodeURIComponent(rawHost);
        } catch (_) {
          return false;
        }
      }
      return true;
    }
    return false;
  }

  // port = *DIGIT, terminated by the end of authority
  private port(): boolean {
    const start = this.i;
    for (;;) {
      if (this.digit()) {
        continue;
      }
      if (this.isAuthorityEnd()) {
        return true;
      }
      this.i = start;
      return false;
    }
  }

  // IP-literal = "[" ( IPv6address / IPv6addrz / IPvFuture  ) "]"
  private ipLiteral(): boolean {
    const start = this.i;
    if (this.take("[")) {
      const j = this.i;
      if (this.ipv6Address() && this.take("]")) {
        return true;
      }
      this.i = j;
      if (this.ipv6addrz() && this.take("]")) {
        return true;
      }
      this.i = j;
      if (this.ipvFuture() && this.take("]")) {
        return true;
      }
    }
    this.i = start;
    return false;
  }

  private ipv6Address(): boolean {
    const start = this.i;
    while (this.hexdig() || this.take(":")) {
      // continue
    }
    if (isIp(this.str.substring(start, this.i), 6)) {
      return true;
    }
    this.i = start;
    return false;
  }

  // IPv6addrz = IPv6address "%25" ZoneID
  private ipv6addrz(): boolean {
    const start = this.i;
    if (this.ipv6Address() && this.take("%") && this.take("2") && this.take("5") && this.zoneId()) {
      return true;
    }
    this.i = start;
    return false;
  }

  // ZoneID = 1*( unreserved / pct-encoded )
  private zoneId(): boolean {
    const start = this.i;
    while (this.unreserved() || this.pctEncoded()) {
      // continue
    }
    if (this.i - start > 0) {
      return true;
    }
    this.i = start;
    return false;
  }

  // IPvFuture = "v" 1*HEXDIG "." 1*( unreserved / sub-delims / ":" )
  private ipvFuture(): boolean {
    const start = this.i;
    if (this.take("v") && this.hexdig()) {
      while (this.hexdig()) {
        // continue
      }
      if (this.take(".")) {
        let j = 0;
        while (this.unreserved() || this.subDelims() || this.take(":")) {
          j++;
        }
        if (j >= 1) {
          return true;
        }
      }
    }
    this.i = start;
    return false;
  }

  // reg-name = *( unreserved / pct-encoded / sub-delims ), terminated by ":" or the end of authority
  private regName(): boolean {
    const start = this.i;
    for (;;) {
      if (this.unreserved() || this.pctEncoded() || this.subDelims()) {
        continue;
      }
      if (this.str.charAt(this.i) == ":") {
        return true;
      }
      if (this.isAuthorityEnd()) {
        return true;
      }
      this.i = start;
      return false;
    }
  }

  private isPathEnd(): boolean {
    return this.str.charAt(this.i) == "?" || this.str.charAt(this.i) == "#" || this.i >= this.l;
  }

  // path-abempty = *( "/" segment )
  private pathAbempty(): boolean {
    const start = this.i;
    while (this.take("/") && this.segment()) {
      // continue
    }
    if (this.isPathEnd()) {
      return true;
    }
    this.i = start;
    return false;
  }

  // path-absolute = "/" [ segment-nz *( "/" segment ) ]
  private pathAbsolute(): boolean {
    const start = this.i;
    if (this.take("/")) {
      if (this.segmentNz()) {
        while (this.take("/") && this.segment()) {
          // continue
        }
      }
      if (this.isPathEnd()) {
        return true;
      }
    }
    this.i = start;
    return false;
  }

  // path-noscheme = segment-nz-nc *( "/" segment )
  private pathNoscheme(): boolean {
    const start = this.i;
    if (this.segmentNzNc()) {
      while (this.take("/") && this.segment()) {
        // continue
      }
      if (this.isPathEnd()) {
        return true;
      }
    }
    this.i = start;
    return false;
  }

  // path-rootless = segment-nz *( "/" segment )
  private pathRootless(): boolean {
    const start = this.i;
    if (this.segmentNz()) {
      while (this.take("/") && this.segment()) {
        // continue
      }
      if (this.isPathEnd()) {
        return true;
      }
    }
    this.i = start;
    return false;
  }

  // path-empty = 0<pchar>
  private pathEmpty(): boolean {
    return this.isPathEnd();
  }

  // segment = *pchar
  private segment(): boolean {
    while (this.pchar()) {
      // continue
    }
    return true;
  }

  // segment-nz = 1*pchar
  private segmentNz(): boolean {
    const start = this.i;
    if (this.pchar()) {
      while (this.pchar()) {
        // continue
      }
      return true;
    }
    this.i = start;
    return false;
  }

  // segment-nz-nc = 1*( unreserved / pct-encoded / sub-delims / "@" )
  private segmentNzNc(): boolean {
    const start = this.i;
    while (this.unreserved() || this.pctEncoded() || this.subDelims() || this.take("@")) {
      // continue
    }
    if (this.i - start > 0) {
      return true;
    }
    this.i = start;
    return false;
  }

  // pchar = unreserved / pct-encoded / sub-delims / ":" / "@"
  private pchar(): boolean {
    return this.unreserved() || this.pctEncoded() || this.subDelims() || this.take(":") || this.take("@");
  }

  // query = *( pchar / "/" / "?" ), terminated by "#" or the end of URI
  private query(): boolean {
    const start = this.i;
    for (;;) {
      if (this.pchar() || this.take("/") || this.take("?")) {
        continue;
      }
      if (this.str.charAt(this.i) == "#" || this.i == this.l) {
        return true;
      }
      this.i = start;
      return false;
    }
  }

  // fragment = *( pchar / "/" / "?" ), terminated by the end of URI
  private fragment(): boolean {
    const start = this.i;
    for (;;) {
      if (this.pchar() || this.take("/") || this.take("?")) {
        continue;
      }
      if (this.i == this.l) {
        return true;
      }
      this.i = start;
      return false;
    }
  }

  // pct-encoded = "%" HEXDIG HEXDIG
  private pctEncoded(): boolean {
    const start = this.i;
    if (this.take("%") && this.hexdig() && this.hexdig()) {
      this.pctEncodedFound = true;
      return true;
    }
    this.i = start;
    return false;
  }

  // unreserved = ALPHA / DIGIT / "-" / "." / "_" / "~"
  private unreserved(): boolean {
    return this.alpha() || this.digit() || this.take("-") || this.take("_") || this.take(".") || this.take("~");
  }

  // sub-delims = "!" / "$" / "&" / "'" / "(" / ")" / "*" / "+" / "," / ";" / "="
  private subDelims(): boolean {
    return (
      this.take("!") ||
      this.take("$") ||
      this.take("&") ||
      this.take("'") ||
      this.take("(") ||
      this.take(")") ||
      this.take("*") ||
      this.take("+") ||
      this.take(",") ||
      this.take(";") ||
      this.take("=")
    );
  }

  private alpha(): boolean {
    const c = this.str.charAt(this.i);
    if (("A" <= c && c <= "Z") || ("a" <= c && c <= "z")) {
      this.i++;
      return true;
    }
    return false;
  }

  private digit(): boolean {
    const c = this.str.charAt(this.i);
    if ("0" <= c && c <= "9") {
      this.i++;
      return true;
    }
    return false;
  }

  private hexdig(): boolean {
    const c = this.str.charAt(this.i);
    if (("0" <= c && c <= "9") || ("a" <= c && c <= "f") || ("A" <= c && c <= "F")) {
      this.i++;
      return true;
    }
    return false;
  }

  private take(char: string): boolean {
    if (this.str.charAt(this.i) == char) {
      this.i++;
      return true;
    }
    return false;
  }
}
