/**
 * CEL parser: turns an expression into an AST, following the grammar of the CEL
 * specification (https://github.com/google/cel-spec/blob/master/doc/langdef.md).
 *
 * Every construct the grammar allows is parsed; the compiler decides which ones it
 * can translate and refuses the others, so an unsupported rule fails the generation.
 */

export type Expr =
  | { kind: "literal"; type: "int" | "uint" | "double" | "string" | "bytes" | "bool" | "null"; value: bigint | number | string | boolean | null }
  | { kind: "ident"; name: string }
  | { kind: "select"; operand: Expr; field: string }
  | { kind: "call"; target?: Expr; fn: string; args: Expr[] }
  | { kind: "index"; operand: Expr; index: Expr }
  | { kind: "list"; elements: Expr[] }
  | { kind: "map"; entries: [Expr, Expr][] }
  | { kind: "unary"; op: "!" | "-"; operand: Expr }
  | { kind: "binary"; op: BinaryOp; left: Expr; right: Expr }
  | { kind: "conditional"; test: Expr; then: Expr; otherwise: Expr };

export type BinaryOp = "||" | "&&" | "==" | "!=" | "<" | "<=" | ">" | ">=" | "in" | "+" | "-" | "*" | "/" | "%";

type Token =
  | { kind: "ident"; value: string; pos: number }
  | { kind: "int" | "uint"; value: bigint; pos: number }
  | { kind: "double"; value: number; pos: number }
  | { kind: "string"; value: string; pos: number }
  | { kind: "bytes"; value: string; pos: number }
  | { kind: "punct"; value: string; pos: number }
  | { kind: "eof"; pos: number };

export class CelSyntaxError extends Error {}

const PUNCTUATION = ["==", "!=", "<=", ">=", "&&", "||", "<", ">", "!", "+", "-", "*", "/", "%", "?", ":", ".", ",", "(", ")", "[", "]", "{", "}"];

const RESERVED = new Set([
  "as", "break", "const", "continue", "else", "for", "function", "if", "import",
  "let", "loop", "package", "namespace", "return", "var", "void", "while",
]);

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const fail = (msg: string): never => {
    throw new CelSyntaxError(`${msg} at position ${i} in: ${src}`);
  };

  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (src.startsWith("//", i)) {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }

    const start = i;

    // String and bytes literals, with optional r / b prefixes (in either order)
    const prefix = src.slice(i).match(/^([rRbB]{0,2})(['"])/);
    if (prefix && /^(|[rR]|[bB]|[rR][bB]|[bB][rR])$/.test(prefix[1])) {
      const flags = prefix[1].toLowerCase();
      i += prefix[1].length;
      const quote = src[i];
      const triple = src.startsWith(quote.repeat(3), i);
      const delimiter = triple ? quote.repeat(3) : quote;
      i += delimiter.length;
      let value = "";
      for (;;) {
        if (i >= src.length) fail("unterminated string literal");
        if (src.startsWith(delimiter, i)) {
          i += delimiter.length;
          break;
        }
        const c = src[i];
        if (!triple && (c === "\n" || c === "\r")) fail("newline in string literal");
        if (c === "\\" && !flags.includes("r")) {
          value += readEscape();
          continue;
        }
        value += c;
        i++;
      }
      tokens.push({ kind: flags.includes("b") ? "bytes" : "string", value, pos: start });
      continue;
    }

    // Numbers: hex / decimal ints, uints (u suffix), doubles
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      const hex = src.slice(i).match(/^0[xX][0-9a-fA-F]+/);
      if (hex) {
        i += hex[0].length;
        const isUint = /[uU]/.test(src[i] ?? "");
        if (isUint) i++;
        tokens.push({ kind: isUint ? "uint" : "int", value: BigInt(hex[0]), pos: start });
        continue;
      }
      const dbl = src.slice(i).match(/^([0-9]*\.[0-9]+([eE][+-]?[0-9]+)?|[0-9]+[eE][+-]?[0-9]+)/);
      if (dbl) {
        i += dbl[0].length;
        tokens.push({ kind: "double", value: Number(dbl[0]), pos: start });
        continue;
      }
      const dec = src.slice(i).match(/^[0-9]+/)!;
      i += dec[0].length;
      const isUint = /[uU]/.test(src[i] ?? "");
      if (isUint) i++;
      tokens.push({ kind: isUint ? "uint" : "int", value: BigInt(dec[0]), pos: start });
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      const id = src.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/)!;
      i += id[0].length;
      tokens.push({ kind: "ident", value: id[0], pos: start });
      continue;
    }

    const punct = PUNCTUATION.find((p) => src.startsWith(p, i));
    if (punct) {
      i += punct.length;
      tokens.push({ kind: "punct", value: punct, pos: start });
      continue;
    }
    fail(`unexpected character '${ch}'`);
  }
  tokens.push({ kind: "eof", pos: src.length });
  return tokens;

  function readEscape(): string {
    const next = src[i + 1];
    const simple: Record<string, string> = {
      a: "\x07", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v",
      "\\": "\\", "?": "?", '"': '"', "'": "'", "`": "`",
    };
    if (next in simple) {
      i += 2;
      return simple[next];
    }
    const hex = src.slice(i).match(/^\\[xX]([0-9a-fA-F]{2})|^\\u([0-9a-fA-F]{4})|^\\U([0-9a-fA-F]{8})/);
    if (hex) {
      i += hex[0].length;
      return String.fromCodePoint(parseInt(hex[1] ?? hex[2] ?? hex[3], 16));
    }
    const oct = src.slice(i).match(/^\\([0-3][0-7]{2})/);
    if (oct) {
      i += oct[0].length;
      return String.fromCodePoint(parseInt(oct[1], 8));
    }
    return fail("invalid escape sequence");
  }
}

/** Parses a CEL expression into its AST. Throws CelSyntaxError on invalid syntax. */
export function parseCel(src: string): Expr {
  const tokens = tokenize(src);
  let p = 0;

  const peek = (): Token => tokens[p];
  const isPunct = (value: string): boolean => {
    const t = tokens[p];
    return t.kind === "punct" && t.value === value;
  };
  const isKeyword = (value: string): boolean => {
    const t = tokens[p];
    return t.kind === "ident" && t.value === value;
  };
  const fail = (msg: string): never => {
    throw new CelSyntaxError(`${msg} at position ${peek().pos} in: ${src}`);
  };
  const expect = (value: string): void => {
    if (!isPunct(value)) fail(`expected '${value}'`);
    p++;
  };

  const expr = parseExpr();
  if (peek().kind !== "eof") fail("unexpected token");
  return expr;

  // Expr = ConditionalOr ["?" ConditionalOr ":" Expr]
  function parseExpr(): Expr {
    const test = parseOr();
    if (isPunct("?")) {
      p++;
      const then = parseOr();
      expect(":");
      const otherwise = parseExpr();
      return { kind: "conditional", test, then, otherwise };
    }
    return test;
  }

  function parseOr(): Expr {
    let left = parseAnd();
    while (isPunct("||")) {
      p++;
      left = { kind: "binary", op: "||", left, right: parseAnd() };
    }
    return left;
  }

  function parseAnd(): Expr {
    let left = parseRelation();
    while (isPunct("&&")) {
      p++;
      left = { kind: "binary", op: "&&", left, right: parseRelation() };
    }
    return left;
  }

  function parseRelation(): Expr {
    let left = parseAddition();
    for (;;) {
      const t = peek();
      const op = t.kind === "punct" && ["<", "<=", ">", ">=", "==", "!="].includes(t.value)
        ? t.value
        : isKeyword("in") ? "in" : undefined;
      if (!op) return left;
      p++;
      left = { kind: "binary", op: op as BinaryOp, left, right: parseAddition() };
    }
  }

  function parseAddition(): Expr {
    let left = parseMultiplication();
    while (isPunct("+") || isPunct("-")) {
      const op = (peek() as { value: string }).value as BinaryOp;
      p++;
      left = { kind: "binary", op, left, right: parseMultiplication() };
    }
    return left;
  }

  function parseMultiplication(): Expr {
    let left = parseUnary();
    while (isPunct("*") || isPunct("/") || isPunct("%")) {
      const op = (peek() as { value: string }).value as BinaryOp;
      p++;
      left = { kind: "binary", op, left, right: parseUnary() };
    }
    return left;
  }

  function parseUnary(): Expr {
    if (isPunct("!")) {
      p++;
      return { kind: "unary", op: "!", operand: parseUnary() };
    }
    if (isPunct("-")) {
      p++;
      // A negative literal is a literal, so that -9223372036854775808 stays in range
      const t = peek();
      if ((t.kind === "int" || t.kind === "double") && !isPostfixAfterLiteral()) {
        p++;
        return t.kind === "int"
          ? { kind: "literal", type: "int", value: -t.value }
          : { kind: "literal", type: "double", value: -t.value };
      }
      return { kind: "unary", op: "-", operand: parseUnary() };
    }
    return parseMember();
  }

  function isPostfixAfterLiteral(): boolean {
    const next = tokens[p + 1];
    return next.kind === "punct" && (next.value === "." || next.value === "[");
  }

  // Member = Primary { "." IDENT ["(" args ")"] | "[" Expr "]" }
  function parseMember(): Expr {
    let operand = parsePrimary();
    for (;;) {
      if (isPunct(".")) {
        p++;
        const name = peek();
        if (name.kind !== "ident") fail("expected a field or method name");
        p++;
        const field = (name as { value: string }).value;
        if (isPunct("(")) {
          p++;
          operand = { kind: "call", target: operand, fn: field, args: parseArgs(")") };
        } else {
          operand = { kind: "select", operand, field };
        }
        continue;
      }
      if (isPunct("[")) {
        p++;
        const index = parseExpr();
        expect("]");
        operand = { kind: "index", operand, index };
        continue;
      }
      return operand;
    }
  }

  function parseArgs(close: string): Expr[] {
    const args: Expr[] = [];
    if (isPunct(close)) {
      p++;
      return args;
    }
    for (;;) {
      args.push(parseExpr());
      if (isPunct(",")) {
        p++;
        if (isPunct(close)) {
          p++;
          return args;
        }
        continue;
      }
      expect(close);
      return args;
    }
  }

  function parsePrimary(): Expr {
    const t = peek();
    switch (t.kind) {
      case "int":
      case "uint":
        p++;
        return { kind: "literal", type: t.kind, value: t.value };
      case "double":
        p++;
        return { kind: "literal", type: "double", value: t.value };
      case "string":
        p++;
        return { kind: "literal", type: "string", value: t.value };
      case "bytes":
        p++;
        return { kind: "literal", type: "bytes", value: t.value };
      case "ident": {
        p++;
        if (t.value === "true" || t.value === "false") {
          return { kind: "literal", type: "bool", value: t.value === "true" };
        }
        if (t.value === "null") {
          return { kind: "literal", type: "null", value: null };
        }
        if (t.value === "in" || RESERVED.has(t.value)) {
          fail(`reserved word '${t.value}'`);
        }
        if (isPunct("(")) {
          p++;
          return { kind: "call", fn: t.value, args: parseArgs(")") };
        }
        if (isPunct("{")) {
          fail("message construction is not supported");
        }
        return { kind: "ident", name: t.value };
      }
      case "punct":
        if (t.value === "(") {
          p++;
          const inner = parseExpr();
          expect(")");
          return inner;
        }
        if (t.value === "[") {
          p++;
          return { kind: "list", elements: parseArgs("]") };
        }
        if (t.value === "{") {
          p++;
          const entries: [Expr, Expr][] = [];
          if (isPunct("}")) {
            p++;
            return { kind: "map", entries };
          }
          for (;;) {
            const key = parseExpr();
            expect(":");
            entries.push([key, parseExpr()]);
            if (isPunct(",")) {
              p++;
              if (isPunct("}")) break;
              continue;
            }
            break;
          }
          expect("}");
          return { kind: "map", entries };
        }
        if (t.value === ".") {
          fail("leading-dot identifiers are not supported");
        }
        break;
    }
    return fail("unexpected token");
  }
}
