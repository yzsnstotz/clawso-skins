/**
 * publish: validate a skin directory, build the `.skin` tar.gz bundle, run
 * Creator Studio BFF preflight, and create a creator submission.
 *
 * Mirrors the current client flow:
 *   POST ${apiBase}/api/creator/skin/preflight
 *   POST ${apiBase}/api/creator/skin/submissions
 *
 * The bearer token must belong to a signed-in certified creator. A successful
 * submission lands in the Creator Studio review queue; it does not bypass BFF
 * preflight or admin review.
 *
 * Uses Node 18+ globals (fetch, FormData, Blob) — no network dependency is
 * added. The bundle is built in memory and only hits the network on a real run;
 * `--dry-run` does everything except the BFF POSTs.
 */
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { validateSkin } from "./validate";
import { buildSkinTarball, BundleEntry } from "./build";

const DEFAULT_API_BASE = "https://app.clawso.ai";
const MAX_BUNDLE_BYTES = 8 * 1024 * 1024;

export interface PublishOptions {
  /** Creator Studio BFF API base; default https://app.clawso.ai. */
  apiBase: string;
  /** Signed-in certified creator bearer token. */
  token?: string;
  /** Skip network POSTs; resolve and print the plan instead. */
  dryRun: boolean;
}

export interface MultipartPlan {
  apiBase: string;
  preflightEndpoint: string;
  submitEndpoint: string;
  skin: { id: string; version: string; name?: string };
  bundle: { filename: string; bytes: number; sha256: string };
  sizes: {
    bundleSizeBytes: number;
    decompressedBytes: number;
    fileCount: number;
    skinBackgroundSizeBytes?: number;
  };
  releaseNotes: { present: boolean; bytes: number };
}

function sha256Hex(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

export interface PublishResult {
  /** The resolved multipart plan (always produced, dry-run or not). */
  plan: MultipartPlan;
  /** The parsed creator submission response, present only on a real run. */
  response?: Record<string, any>;
  /** Resolved bundle bytes so the CLI can report/post. */
  bundleBytes: Buffer;
  releaseNotes?: string;
}

function jsonString(value: unknown): string {
  return JSON.stringify(value);
}

function backgroundSizeBytes(dir: string, manifest: Record<string, any>): number | undefined {
  const bg = manifest.background && typeof manifest.background === "object" ? manifest.background : {};
  const refs = [bg.image, bg.video].filter((ref): ref is string => typeof ref === "string" && ref.length > 0);
  let total = 0;
  for (const ref of refs) {
    const file = path.join(dir, ref);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      total += fs.statSync(file).size;
    }
  }
  return total > 0 ? total : undefined;
}

function unwrapBffBody(body: Record<string, any>): Record<string, any> {
  if (body && typeof body.data === "object" && body.data) return body.data;
  return body;
}

async function readJsonResponse(res: Response, label: string): Promise<Record<string, any>> {
  const text = await res.text();
  let body: Record<string, any>;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} returned ${res.status} with non-JSON body: ${text.slice(0, 500)}`);
  }
  if (!res.ok || body.ok === false) {
    const data = unwrapBffBody(body);
    const msg = body?.message || body?.error || data?.message || data?.error || body?.code || `HTTP ${res.status}`;
    const extra = data?.errors
      ? `\n  errors: ${JSON.stringify(data.errors)}`
      : data?.warnings
        ? `\n  warnings: ${JSON.stringify(data.warnings)}`
        : "";
    throw new Error(`${label} failed (${res.status}): ${msg}${extra}`);
  }
  return unwrapBffBody(body);
}

/**
 * Validate, build the tarball, and (unless dry-run) POST to Creator Studio BFF.
 * Throws on validation failure, missing token, oversized bundle, preflight
 * failure, or a non-2xx response.
 */
export async function publishSkin(
  dir: string,
  opts: PublishOptions,
  releaseNotes?: string
): Promise<PublishResult> {
  // 1. Validate (schema + security). Abort before building anything.
  const validation = validateSkin(dir);
  if (!validation.ok || !validation.manifest) {
    const failed = validation.results.filter((r) => !r.pass).map((r) => r.rule);
    throw new Error(
      `validation failed (${failed.join(", ") || "manifest unreadable"}); run \`clawso-skin validate ${dir}\``
    );
  }
  const manifest = validation.manifest;
  const id = String(manifest.id ?? "");
  const version = String(manifest.version ?? "");
  if (!id) throw new Error("skin.json has no id; cannot publish");
  if (!version) throw new Error("skin.json has no version; cannot publish");

  // 2. Build the .skin tar.gz in memory.
  const { bytes: bundleBytes, entries } = buildSkinTarball(dir);
  if (bundleBytes.length > MAX_BUNDLE_BYTES) {
    throw new Error(
      `bundle is ${bundleBytes.length} bytes, exceeding the ${MAX_BUNDLE_BYTES}-byte (8MB) submit limit`
    );
  }
  const bundleSha = sha256Hex(bundleBytes);
  const decompressedBytes = entries.reduce((sum, entry) => sum + entry.data.length, 0);
  const notes = typeof releaseNotes === "string" && releaseNotes.length > 0 ? releaseNotes : undefined;

  const base = opts.apiBase.replace(/\/+$/, "");
  const preflightEndpoint = `${base}/api/creator/skin/preflight`;
  const submitEndpoint = `${base}/api/creator/skin/submissions`;
  const skinBackgroundSizeBytes = backgroundSizeBytes(dir, manifest);
  const plan: MultipartPlan = {
    apiBase: opts.apiBase,
    preflightEndpoint,
    submitEndpoint,
    skin: { id, version, name: manifest.name ? String(manifest.name) : undefined },
    bundle: { filename: `${id}.skin`, bytes: bundleBytes.length, sha256: bundleSha },
    sizes: {
      bundleSizeBytes: bundleBytes.length,
      decompressedBytes,
      fileCount: entries.length,
      ...(skinBackgroundSizeBytes ? { skinBackgroundSizeBytes } : {}),
    },
    releaseNotes: { present: Boolean(notes), bytes: notes ? Buffer.byteLength(notes, "utf8") : 0 },
  };

  const result: PublishResult = {
    plan,
    bundleBytes,
    releaseNotes: notes,
  };

  // 4. Dry-run: stop before touching the network.
  if (opts.dryRun) return result;

  // 5. Real run: token is mandatory, then POST multipart.
  if (!opts.token) {
    throw new Error(
      "no creator token: pass --token <t> or set CLAWSO_DEV_TOKEN (signed-in certified creator bearer token)"
    );
  }

  const preflightForm = new FormData();
  preflightForm.append("manifest", jsonString(manifest));
  for (const [key, value] of Object.entries(plan.sizes)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      preflightForm.append(key, String(value));
    }
  }

  let preflightRes: Response;
  try {
    preflightRes = await fetch(preflightEndpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.token}` },
      body: preflightForm,
    });
  } catch (e) {
    throw new Error(`request to ${preflightEndpoint} failed: ${(e as Error).message}`);
  }
  const preflight = await readJsonResponse(preflightRes, "preflight");
  if (preflight.submitEligible !== true) {
    throw new Error(
      `preflight did not pass: ${JSON.stringify({
        status: preflight.status,
        errors: preflight.errors ?? [],
        warnings: preflight.warnings ?? [],
      })}`
    );
  }
  const preflightReportId = String(preflight.reportId ?? "");
  const artifactHash = String(preflight.artifactHash ?? "");
  if (!preflightReportId || !/^[a-f0-9]{64}$/.test(artifactHash)) {
    throw new Error(`preflight returned an invalid report/hash: ${JSON.stringify(preflight)}`);
  }

  const submitForm = new FormData();
  submitForm.append("manifest", jsonString(manifest));
  submitForm.append("preflightReportId", preflightReportId);
  submitForm.append("artifactHash", artifactHash);
  submitForm.append("title", String(manifest.name ?? id));
  submitForm.append("slug", id);
  submitForm.append("version", version);
  submitForm.append(
    "bundle",
    new Blob([bundleBytes], { type: "application/gzip" }),
    `${id}.skin`
  );
  if (notes) submitForm.append("releaseNotes", notes);

  let submitRes: Response;
  try {
    submitRes = await fetch(submitEndpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.token}` },
      body: submitForm,
    });
  } catch (e) {
    throw new Error(`request to ${submitEndpoint} failed: ${(e as Error).message}`);
  }

  result.response = await readJsonResponse(submitRes, "submit");
  return result;
}

/** A flat, printable summary of the entries in the built bundle. */
export function describeEntries(entries: BundleEntry[]): string[] {
  return entries.map((e) => `${e.name} (${e.data.length} bytes)`);
}
