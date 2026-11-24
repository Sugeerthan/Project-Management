#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join, isAbsolute, resolve } from "node:path";
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "shared", "database", "database.types.ts");
const validRef = (value) => /^[a-z0-9]{20}$/.test(value ?? "");

export function parseArgs(args) {
  const allowed = new Set(["--project-ref", "--verified-dev-ref", "--production-ref", "--cli"]);
  const parsed = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    if (
      !allowed.has(key) ||
      parsed[key] !== undefined ||
      !args[i + 1] ||
      args[i + 1].startsWith("--")
    )
      throw new Error("Expected each required flag exactly once with a value.");
    parsed[key] = args[i + 1];
  }
  const project = parsed["--project-ref"];
  const dev = parsed["--verified-dev-ref"];
  const prod = parsed["--production-ref"];
  const cli = parsed["--cli"];
  if (
    !validRef(project) ||
    !validRef(dev) ||
    !validRef(prod) ||
    project !== dev ||
    project === prod
  )
    throw new Error(
      "An explicit project ref must match the independently verified development ref and differ from the production ref; each ref must be 20 lowercase alphanumeric characters.",
    );
  if (!cli || !isAbsolute(cli) || !/\.exe$/i.test(cli))
    throw new Error("Specify an absolute path to the verified Supabase CLI executable with --cli.");
  return { project, cli };
}

export function generate(args, deps = {}) {
  const { project, cli } = parseArgs(args);
  const run = deps.run ?? spawnSync;
  const version = run(cli, ["--version"], { encoding: "utf8", shell: false });
  if (version.error || version.status !== 0 || version.stdout.trim() !== "3.1.0")
    throw new Error("Supabase CLI 3.1.0 is required.");
  const result = run(
    cli,
    ["gen", "types", "typescript", `--remote=${project}`, "--schema", "public"],
    { encoding: "utf8", shell: false, maxBuffer: 32 * 1024 * 1024 },
  );
  if (result.error || result.status !== 0)
    throw new Error("Type generation failed; existing file was not modified.");
  const content = result.stdout;
  if (
    typeof content !== "string" ||
    !/^export\s+type\s+Database\s*=/m.test(content) ||
    !/\bpublic\s*:/.test(content)
  )
    throw new Error(
      "Generated output is empty or missing expected declarations; existing file was not modified.",
    );
  const validate =
    deps.validate ??
    ((source) => {
      const ts = createRequire(import.meta.url)("typescript");
      const result = ts.transpileModule(source, {
        reportDiagnostics: true,
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      });
      return !(result.diagnostics ?? []).some(
        (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
      );
    });
  if (!validate(content))
    throw new Error(
      "Generated output is not syntactically valid TypeScript; existing file was not modified.",
    );
  const target = deps.output ?? output;
  mkdirSync(dirname(target), { recursive: true });
  const temp = join(dirname(target), `.database.types.${randomUUID()}.tmp`);
  try {
    writeFileSync(temp, content, { encoding: "utf8", flag: "wx" });
    // Verify the temporary file is complete before the same-directory replacement.
    if (readFileSync(temp, "utf8") !== content)
      throw new Error("Temporary output verification failed.");
    renameSync(temp, target);
  } finally {
    try {
      unlinkSync(temp);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return target;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(`Generated ${generate(process.argv.slice(2))}. Review the diff before committing.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
