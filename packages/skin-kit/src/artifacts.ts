/**
 * Locates the generated contract artifacts (schema/) and preview fixtures
 * (fixtures/) WITHOUT importing any monorepo source. We only ever read the
 * published JSON / HTML files.
 *
 * Resolution strategy: walk up from this module's directory looking for a
 * `schema/` directory that contains `manifest.schema.json`. In the public
 * clawso-skins repo that is two levels above the package root
 * (packages/skin-kit/dist -> packages/skin-kit -> packages -> repo root).
 * If the package is ever vendored elsewhere, an explicit override via the
 * CLAWSO_SKIN_SCHEMA_DIR env var wins.
 */
import * as fs from "node:fs";
import * as path from "node:path";

export interface ManifestSchema {
  $ref?: string;
  definitions?: Record<string, unknown>;
  [k: string]: unknown;
}

export interface TokenVarMap {
  contract?: string;
  slotCount?: number;
  vars: Record<string, string[]>;
}

export interface TokensSchema {
  slots: Array<{
    slot: string;
    category: string;
    valueType: string;
    modeSensitive: boolean;
    description?: string;
  }>;
  categories?: string[];
  slotCount?: number;
}

function findUp(start: string, rel: string): string | null {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    const candidate = path.join(dir, rel);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function schemaDir(): string {
  const override = process.env.CLAWSO_SKIN_SCHEMA_DIR;
  if (override) {
    if (!fs.existsSync(path.join(override, "manifest.schema.json"))) {
      throw new Error(
        `CLAWSO_SKIN_SCHEMA_DIR=${override} does not contain manifest.schema.json`
      );
    }
    return override;
  }
  const found = findUp(__dirname, path.join("schema", "manifest.schema.json"));
  if (!found) {
    throw new Error(
      "Could not locate schema/manifest.schema.json. " +
        "Run inside the clawso-skins repo, or set CLAWSO_SKIN_SCHEMA_DIR."
    );
  }
  return path.dirname(found);
}

export function fixturesDir(): string {
  const override = process.env.CLAWSO_SKIN_FIXTURES_DIR;
  if (override) return override;
  const found = findUp(
    __dirname,
    path.join("fixtures", "shell-snapshot.html")
  );
  if (!found) {
    throw new Error(
      "Could not locate fixtures/shell-snapshot.html. " +
        "Set CLAWSO_SKIN_FIXTURES_DIR."
    );
  }
  return path.dirname(found);
}

export function examplesDir(): string | null {
  const found = findUp(__dirname, path.join("examples", "README.md"));
  if (found) return path.dirname(found);
  // Fall back to a bare examples/ directory at the repo root.
  const bare = findUp(__dirname, "examples");
  return bare;
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export function loadManifestSchema(): ManifestSchema {
  return readJson<ManifestSchema>(
    path.join(schemaDir(), "manifest.schema.json")
  );
}

export function loadPetPackSchema(): ManifestSchema {
  return readJson<ManifestSchema>(path.join(schemaDir(), "pet-pack.schema.json"));
}

export function loadTokenVarMap(): TokenVarMap {
  return readJson<TokenVarMap>(path.join(schemaDir(), "token-var-map.json"));
}

export function loadTokensSchema(): TokensSchema {
  return readJson<TokensSchema>(path.join(schemaDir(), "tokens.schema.json"));
}

export function loadShellSnapshot(): string {
  return fs.readFileSync(
    path.join(fixturesDir(), "shell-snapshot.html"),
    "utf8"
  );
}
