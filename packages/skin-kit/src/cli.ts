#!/usr/bin/env node
/**
 * @clawso/skin-kit — CLI for authoring Clawso skins.
 *
 * Commands:
 *   validate <dir>           schema + security validation; exit 0 only if all pass
 *   build    <dir>           validate, then zip into <id>.skin
 *   publish  <dir>           validate + build .skin tar.gz + submit to marketplace
 *                            [--token t] [--api url] [--dry-run] [--notes text]
 *   preview  <dir> [--mode m] [--emit file.html] [--port n]
 *                            serve (or emit) the shell snapshot with the skin applied
 *   init     <name>          scaffold a new skin from examples/default
 *
 * Consumes ONLY the generated artifacts in schema/ and the fixture in
 * fixtures/. No monorepo source dependency.
 */
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import { validateSkin } from "./validate";
import { buildSkin } from "./build";
import { publishSkin } from "./publish";
import { applySkin } from "./preview";
import { examplesDir } from "./artifacts";

const DEFAULT_API_BASE = "https://app.clawso.ai";

function fail(msg: string): never {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(2);
}

function parseFlags(args: string[]): {
  positional: string[];
  flags: Record<string, string | boolean>;
} {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

function printValidation(dir: string): boolean {
  const result = validateSkin(dir);
  process.stdout.write(`Validating ${path.resolve(dir)}\n`);
  for (const r of result.results) {
    const mark = r.pass ? "PASS" : "FAIL";
    process.stdout.write(`  [${mark}] ${r.rule}\n`);
    if (!r.pass) {
      for (const d of r.detail) process.stdout.write(`         - ${d}\n`);
    }
  }
  process.stdout.write(result.ok ? "All rules passed.\n" : "Validation FAILED.\n");
  return result.ok;
}

function cmdValidate(args: string[]): void {
  const { positional } = parseFlags(args);
  const dir = positional[0];
  if (!dir) fail("usage: clawso-skin validate <dir>");
  if (!fs.existsSync(dir)) fail(`directory not found: ${dir}`);
  const ok = printValidation(dir);
  process.exit(ok ? 0 : 1);
}

function cmdBuild(args: string[]): void {
  const { positional, flags } = parseFlags(args);
  const dir = positional[0];
  if (!dir) fail("usage: clawso-skin build <dir>");
  if (!fs.existsSync(dir)) fail(`directory not found: ${dir}`);
  const ok = printValidation(dir);
  if (!ok) {
    process.stderr.write("build aborted: validation failed.\n");
    process.exit(1);
  }
  const manifest = JSON.parse(
    fs.readFileSync(path.join(dir, "skin.json"), "utf8")
  );
  const id: string = manifest.id;
  if (!id) fail("skin.json has no id; cannot name the bundle");
  const outDir = typeof flags.out === "string" ? flags.out : undefined;
  const bundle = buildSkin(dir, id, outDir);
  process.stdout.write(`Built ${bundle}\n`);
  process.exit(0);
}

async function cmdPublish(args: string[]): Promise<void> {
  const { positional, flags } = parseFlags(args);
  const dir = positional[0];
  if (!dir)
    fail(
      "usage: clawso-skin publish <dir> [--token t] [--api url] [--dry-run] [--notes text]"
    );
  if (!fs.existsSync(dir)) fail(`directory not found: ${dir}`);

  const apiBase =
    (typeof flags.api === "string" && flags.api) ||
    process.env.CLAWSO_API_BASE_URL ||
    DEFAULT_API_BASE;
  const token =
    (typeof flags.token === "string" && flags.token) ||
    process.env.CLAWSO_DEV_TOKEN ||
    undefined;
  const dryRun = flags["dry-run"] === true || flags.dryRun === true;
  const notes = typeof flags.notes === "string" ? flags.notes : undefined;

  // A real run needs a token up front — fail clearly before building anything.
  if (!dryRun && !token) {
    fail(
      "no publisher token: pass --token <t> or set CLAWSO_DEV_TOKEN (a dealer/publisher dev token).\n" +
        "       (use --dry-run to verify the bundle + multipart plan offline without a token)"
    );
  }

  let result;
  try {
    result = await publishSkin(dir, { apiBase, token, dryRun }, notes);
  } catch (e) {
    fail((e as Error).message);
  }

  const { plan } = result;
  if (dryRun) {
    process.stdout.write(`Publish dry-run for ${plan.skin.name ?? plan.skin.id}\n`);
    process.stdout.write(`  skin:      ${plan.skin.id}@${plan.skin.version}\n`);
    process.stdout.write(`  apiBase:   ${plan.apiBase}\n`);
    process.stdout.write(`  endpoint:  ${plan.endpoint}\n`);
    process.stdout.write(`  POST multipart/form-data parts:\n`);
    process.stdout.write(
      `    bundle                  ${plan.bundle.filename}  ${plan.bundle.bytes} bytes\n`
    );
    process.stdout.write(`                            sha256=${plan.bundle.sha256}\n`);
    process.stdout.write(
      `    admin_review_checklist  ${plan.adminReviewChecklist.filename}  ` +
        `${plan.adminReviewChecklist.bytes} bytes (${plan.adminReviewChecklist.source})\n`
    );
    process.stdout.write(
      `    deployment_verification ${plan.deploymentVerification.filename}  ` +
        `${plan.deploymentVerification.bytes} bytes (${plan.deploymentVerification.source})\n`
    );
    process.stdout.write(
      `    release_notes           ${
        plan.releaseNotes.present ? `${plan.releaseNotes.bytes} bytes` : "(none)"
      }\n`
    );
    process.stdout.write("No network call made (--dry-run).\n");
    process.exit(0);
  }

  const r = result.response ?? {};
  process.stdout.write(`Submitted ${plan.skin.id}@${plan.skin.version} to ${plan.apiBase}\n`);
  process.stdout.write(`  slug:      ${r.slug ?? plan.skin.id}\n`);
  process.stdout.write(`  version:   ${r.version ?? plan.skin.version}\n`);
  process.stdout.write(`  state:     ${r.state ?? "(unknown)"}\n`);
  if (r.review_url) process.stdout.write(`  review:    ${r.review_url}\n`);
  if (r.estimated_review_time)
    process.stdout.write(`  est. time: ${r.estimated_review_time}\n`);
  if (r.bundle_sha256) process.stdout.write(`  sha256:    ${r.bundle_sha256}\n`);
  if (Array.isArray(r.warnings) && r.warnings.length) {
    process.stdout.write(`  warnings:\n`);
    for (const w of r.warnings) process.stdout.write(`    - ${w}\n`);
  }
  process.stdout.write(`\nFull response:\n${JSON.stringify(r, null, 2)}\n`);
  process.exit(0);
}

function cmdPreview(args: string[]): void {
  const { positional, flags } = parseFlags(args);
  const dir = positional[0];
  if (!dir) fail("usage: clawso-skin preview <dir> [--mode m] [--emit file] [--port n]");
  if (!fs.existsSync(dir)) fail(`directory not found: ${dir}`);

  const mode = typeof flags.mode === "string" ? flags.mode : undefined;

  let applied;
  try {
    applied = applySkin(dir, mode);
  } catch (e) {
    fail((e as Error).message);
  }

  // --emit: write self-contained applied HTML and exit (no server).
  if (flags.emit) {
    if (typeof flags.emit !== "string") fail("--emit requires a file path");
    const out = path.resolve(flags.emit);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, applied.html, "utf8");
    process.stdout.write(
      `Wrote applied preview (skin=${applied.id}, mode=${applied.mode}) to ${out}\n`
    );
    process.exit(0);
  }

  // Otherwise serve a tiny static server.
  const port = typeof flags.port === "string" ? parseInt(flags.port, 10) : 4178;
  const html = applied.html;
  const server = http.createServer((req, res) => {
    // Single-page preview; any path returns the applied snapshot.
    if (req.url === "/favicon.ico") {
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(html);
  });
  server.listen(port, () => {
    const url = `http://localhost:${port}/`;
    process.stdout.write(
      `Previewing skin "${applied.id}" (mode=${applied.mode}; modes: ${applied.modes.join(", ")})\n`
    );
    process.stdout.write(`Serving at ${url}\n`);
    process.stdout.write(`Press Ctrl+C to stop.\n`);
  });
}

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

function cmdInit(args: string[]): void {
  const { positional } = parseFlags(args);
  const name = positional[0];
  if (!name) fail("usage: clawso-skin init <name>");
  const dest = path.resolve(name);
  if (fs.existsSync(dest)) fail(`target already exists: ${dest}`);

  const exDir = examplesDir();
  const defaultEx = exDir ? path.join(exDir, "default") : null;
  const hasContent =
    defaultEx &&
    fs.existsSync(defaultEx) &&
    fs.readdirSync(defaultEx).length > 0;

  if (hasContent) {
    copyDir(defaultEx as string, dest);
    process.stdout.write(`Initialized skin from examples/default at ${dest}\n`);
    process.exit(0);
  }

  // Graceful fallback: examples/default is not present yet (Phase 3). Scaffold
  // a minimal valid skin so `init` is usable today.
  fs.mkdirSync(dest, { recursive: true });
  const id = name.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const manifest = {
    contract: "1.0",
    id,
    name,
    version: "0.1.0",
    author: "you",
    modes: {
      default: "light",
      light: { tokens: "tokens.json" },
    },
    styles: "skin.css",
  };
  fs.writeFileSync(
    path.join(dest, "skin.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(dest, "tokens.json"),
    JSON.stringify(
      {
        "accent.base": "#eb7b2d",
        "surface.base": "#fafaf7",
        "content.primary": "#15161d",
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(dest, "skin.css"),
    `/* ${name} — scoped appearance CSS. Targets published anchors only. */\n` +
      `[data-region="sidebar"] {\n  /* customise the sidebar here */\n}\n`,
    "utf8"
  );
  process.stdout.write(
    `examples/default not present; scaffolded a minimal skin at ${dest}\n`
  );
  process.exit(0);
}

function usage(): void {
  process.stdout.write(
    [
      "clawso-skin — author Clawso skins",
      "",
      "Commands:",
      "  validate <dir>                         schema + security checks",
      "  build    <dir> [--out dir]             validate, then zip <id>.skin",
      "  publish  <dir> [--token t] [--api u]   validate + build .skin tar.gz +",
      "                 [--dry-run] [--notes t]  submit to the marketplace",
      "  preview  <dir> [--mode m] [--emit f]   serve/emit shell snapshot + skin",
      "                 [--port n]",
      "  init     <name>                        scaffold a new skin",
      "",
      "Env: CLAWSO_API_BASE_URL (publish target; default https://app.clawso.ai)",
      "     CLAWSO_DEV_TOKEN     (publisher bearer token for publish)",
      "",
    ].join("\n")
  );
}

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;
  switch (cmd) {
    case "validate":
      return cmdValidate(rest);
    case "build":
      return cmdBuild(rest);
    case "publish":
      return cmdPublish(rest);
    case "preview":
      return cmdPreview(rest);
    case "init":
      return cmdInit(rest);
    case "-h":
    case "--help":
    case undefined:
      usage();
      process.exit(cmd === undefined ? 1 : 0);
    default:
      process.stderr.write(`unknown command: ${cmd}\n`);
      usage();
      process.exit(2);
  }
}

main().catch((e) => {
  process.stderr.write(`error: ${(e as Error).message}\n`);
  process.exit(2);
});
