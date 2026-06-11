/**
 * build: validate the skin, then zip the directory into <id>.skin (a zip).
 *
 * Two bundle formats live here:
 *   - buildSkin(): the legacy `.skin` zip (adm-zip) used by `clawso-skin build`.
 *   - buildSkinTarball(): a gzipped USTAR tarball — the format the marketplace
 *     submit endpoint (`POST /api/marketplace/skins/submit`) accepts. Both reuse
 *     the same directory walk + skip rules so the two formats always carry the
 *     same files.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import AdmZip from "adm-zip";

const SKIP_NAMES = new Set([".DS_Store", "node_modules", ".git"]);

/** Files that are publish-time inputs, never part of the shipped bundle. */
const PUBLISH_META_NAMES = new Set([
  "admin_review_checklist.md",
  "deployment_verification.md",
]);

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

export interface BundleEntry {
  /** POSIX path inside the tarball, relative to the bundle root. */
  name: string;
  data: Buffer;
}

/**
 * Walk `dir` and collect every bundle file as `{ name, data }`, using the same
 * skip rules as the zip builder. Paths are POSIX-relative to `dir` (so
 * `skin.json` sits at the bundle root). The publish-time review markdown files
 * (admin_review_checklist.md / deployment_verification.md) are excluded — they
 * travel as their own multipart parts, not inside the .skin bundle.
 */
export function collectBundleEntries(dir: string): BundleEntry[] {
  const entries: BundleEntry[] = [];
  const walk = (absDir: string, base: string): void => {
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      if (SKIP_NAMES.has(entry.name)) continue;
      if (entry.name.endsWith(".skin")) continue;
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (base === "" && PUBLISH_META_NAMES.has(entry.name)) continue;
      const abs = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        walk(abs, rel);
      } else if (entry.isFile()) {
        entries.push({ name: rel, data: fs.readFileSync(abs) });
      }
    }
  };
  walk(dir, "");
  // Deterministic order so the bundle bytes (and thus the sha256) are stable.
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return entries;
}

/**
 * Write a single USTAR tar header (512 bytes) for a regular file. Mirrors the
 * canonical writer the BFF's parseAndShaBundle() tests use, so the marketplace
 * submit endpoint parses these bundles identically.
 */
function tarHeader(name: string, size: number): Buffer {
  const header = Buffer.alloc(512, 0);
  header.write(name, 0, 100, "utf8");
  header.write("0000644\0", 100, 8, "ascii"); // mode
  header.write("0000000\0", 108, 8, "ascii"); // uid
  header.write("0000000\0", 116, 8, "ascii"); // gid
  writeOctal(header, size, 124, 12); // size
  writeOctal(header, 0, 136, 12); // mtime
  header.fill(0x20, 148, 156); // checksum field = spaces while summing
  header.write("0", 156, 1, "ascii"); // typeflag '0' = regular file
  header.write("ustar\0", 257, 6, "ascii"); // magic
  header.write("00", 263, 2, "ascii"); // version
  let sum = 0;
  for (const byte of header) sum += byte;
  writeOctal(header, sum, 148, 8); // checksum
  return header;
}

function writeOctal(buffer: Buffer, value: number, offset: number, length: number): void {
  const text = value
    .toString(8)
    .padStart(length - 1, "0")
    .slice(0, length - 1);
  buffer.write(`${text}\0`, offset, length, "ascii");
}

/** Build the raw (uncompressed) USTAR tar bytes for the given entries. */
export function writeTar(entries: BundleEntry[]): Buffer {
  const chunks: Buffer[] = [];
  for (const { name, data } of entries) {
    chunks.push(tarHeader(name, data.length));
    chunks.push(data);
    const pad = (512 - (data.length % 512)) % 512;
    if (pad > 0) chunks.push(Buffer.alloc(pad, 0));
  }
  // Two 512-byte zero blocks terminate the archive.
  chunks.push(Buffer.alloc(1024, 0));
  return Buffer.concat(chunks);
}

/**
 * Build the gzipped tarball the marketplace submit endpoint accepts: a gzip of
 * a USTAR tar carrying skin.json at the root plus every referenced file. Returns
 * the gzip bytes and the collected entries (for reporting). The bundle is built
 * in memory — nothing is written to disk.
 */
export function buildSkinTarball(dir: string): { bytes: Buffer; entries: BundleEntry[] } {
  const entries = collectBundleEntries(dir);
  const tar = writeTar(entries);
  const bytes = zlib.gzipSync(tar);
  return { bytes, entries };
}
