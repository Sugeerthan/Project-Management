import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { generate, parseArgs } from "./generate-database-types.mjs";

const dev = "abcdefghijklmnopqrst";
const prod = "zyxwvutsrqponmlkjihg";
const cli = resolve("supabase.exe");
const args = [
  "--project-ref",
  dev,
  "--verified-dev-ref",
  dev,
  "--production-ref",
  prod,
  "--cli",
  cli,
];
const fakeOutput = "export type Database = { public: {} };\n";
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "db-types-test-"));
  const output = join(dir, "types.ts");
  writeFileSync(output, "previous valid content");
  return { dir, output };
}

test("requires explicit verified development target and distinct production ref", () => {
  assert.throws(() => parseArgs([]));
  assert.throws(() => parseArgs(args.slice(0, -2)));
  assert.throws(() => parseArgs([...args, "--project-ref", dev]));
  assert.throws(() =>
    parseArgs([
      "--project-ref",
      prod,
      "--verified-dev-ref",
      dev,
      "--production-ref",
      prod,
      "--cli",
      cli,
    ]),
  );
  assert.throws(() =>
    parseArgs([
      "--project-ref",
      prod,
      "--verified-dev-ref",
      prod,
      "--production-ref",
      prod,
      "--cli",
      cli,
    ]),
  );
  assert.throws(() =>
    parseArgs([
      "--project-ref",
      "--remote",
      "--verified-dev-ref",
      dev,
      "--production-ref",
      prod,
      "--cli",
      cli,
    ]),
  );
  assert.throws(() =>
    parseArgs([
      "--project-ref",
      dev,
      "--verified-dev-ref",
      dev,
      "--production-ref",
      prod,
      "--cli",
      "relative.exe",
    ]),
  );
});

test("always passes the explicit remote ref and public schema", () => {
  const { dir, output } = fixture();
  const calls = [];
  try {
    const run = (_cli, command) => {
      calls.push(command);
      return { status: 0, stdout: calls.length === 1 ? "3.1.0\n" : fakeOutput };
    };
    generate(args, { run, validate: () => true, output });
    assert.deepEqual(calls[1], [
      "gen",
      "types",
      "typescript",
      `--remote=${dev}`,
      "--schema",
      "public",
    ]);
    assert.equal(readFileSync(output, "utf8"), fakeOutput);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("failed or invalid generation never replaces the previous file", () => {
  const { dir, output } = fixture();
  try {
    for (const generated of [
      { status: 1, stdout: fakeOutput },
      { status: 0, stdout: "" },
      { status: 0, stdout: "export type Database =" },
      { status: 0, stdout: fakeOutput },
    ]) {
      let calls = 0;
      const run = () => (++calls === 1 ? { status: 0, stdout: "3.1.0" } : generated);
      assert.throws(() => generate(args, { run, validate: () => false, output }));
      assert.equal(readFileSync(output, "utf8"), "previous valid content");
    }
    assert.throws(() => generate(args, { run: () => ({ status: 0, stdout: "3.0.0" }), output }));
    assert.equal(readFileSync(output, "utf8"), "previous valid content");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("real TypeScript syntax validation rejects truncated output", () => {
  const { dir, output } = fixture();
  try {
    let calls = 0;
    const run = () =>
      ++calls === 1
        ? { status: 0, stdout: "3.1.0" }
        : { status: 0, stdout: "export type Database = { public: {" };
    assert.throws(() => generate(args, { run, output }), /syntactically valid/);
    assert.equal(readFileSync(output, "utf8"), "previous valid content");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
