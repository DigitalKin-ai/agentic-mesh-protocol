/**
 * A rule protoc-gen-zod cannot translate faithfully must fail the generation: each fixture of
 * tools/zod/test/fixtures/unsupported is generated alone, and buf must report the rule.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const BUF = path.join(ROOT, "node_modules", "@bufbuild", "buf", "bin", "buf");
const FIXTURES = "tools/zod/test/fixtures";

const CASES: { file: string; expect: RegExp }[] = [
  { file: "string_format.proto", expect: /StringFormat\.id: string\.tuuid/ },
  { file: "cel_function.proto", expect: /CEL rule 'cel_function\.lower'.*function string\.lowerAscii\(\)/ },
  { file: "cel_now.proto", expect: /CEL rule 'cel_now\.past'.*identifier 'now'/ },
  { file: "timestamp_rules.proto", expect: /TimestampRules\.at: timestamp rules on the message type google\.protobuf\.Timestamp/ },
  { file: "map_rules.proto", expect: /MapRules\.labels: map rules on a map field/ },
  { file: "ignore_always_message.proto", expect: /IgnoreAlwaysMessage\.nested: ignore = IGNORE_ALWAYS on a message field/ },
];

describe("protoc-gen-zod refuses the rules it cannot translate", () => {
  it("covers every fixture of the unsupported directory", () => {
    const files = fs.readdirSync(path.join(ROOT, FIXTURES, "unsupported", "v1")).sort();
    assert.deepEqual(files, CASES.map((c) => c.file).sort());
  });

  for (const { file, expect } of CASES) {
    it(file, () => {
      const out = spawnSync(
        process.execPath,
        [
          BUF,
          "generate",
          FIXTURES,
          "--template",
          "tools/zod/test/buf.gen.unsupported.yaml",
          "--path",
          `${FIXTURES}/unsupported/v1/${file}`,
        ],
        { cwd: ROOT, encoding: "utf8" },
      );
      assert.notEqual(out.status, 0, `the generation of ${file} succeeded:\n${out.stdout}`);
      assert.match(out.stderr, expect);
    });
  }
});
