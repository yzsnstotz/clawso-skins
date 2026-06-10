/**
 * build: validate the skin, then zip the directory into <id>.skin (a zip).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import AdmZip from "adm-zip";

const SKIP_NAMES = new Set([".DS_Store", "node_modules", ".git"]);

function addDir(zip: AdmZip, absDir: string, zipBase: string): void {
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (SKIP_NAMES.has(entry.name)) continue;
    if (entry.name.endsWith(".skin")) continue; // never nest prior builds
    const abs = path.join(absDir, entry.name);
    const zipPath = zipBase ? `${zipBase}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      addDir(zip, abs, zipPath);
    } else if (entry.isFile()) {
      zip.addLocalFile(abs, path.dirname(zipPath) || undefined, entry.name);
    }
  }
}

/**
 * Zip `dir` into `<id>.skin`, placed at `outDir` (defaults to the parent of
 * `dir`). Returns the absolute path of the produced bundle.
 */
export function buildSkin(dir: string, id: string, outDir?: string): string {
  const zip = new AdmZip();
  addDir(zip, dir, "");
  const target = path.join(outDir ?? path.dirname(path.resolve(dir)), `${id}.skin`);
  zip.writeZip(target);
  return target;
}
