/**
 * Skin validation: JSON-Schema (manifest) + the security rules from
 * spec/security.md. Pure functions returning structured results so the CLI
 * can print per-rule pass/fail and decide the exit code.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import Ajv from "ajv";
import {
  loadManifestSchema,
  loadTokenVarMap,
  TokenVarMap,
} from "./artifacts";

export interface RuleResult {
  rule: string;
  pass: boolean;
  /** Human-readable detail lines (errors, matched offenders, etc.). */
  detail: string[];
}

export interface ValidateResult {
  ok: boolean;
  results: RuleResult[];
  /** Parsed manifest if it loaded, else null. */
  manifest: Record<string, any> | null;
}

/** Anchors whose hiding/covering is a security risk (irreversible actions). */
const PROTECTED_REGIONS = [
  "app-shell",
  "topbar",
  "topbar-lead",
  "topbar-actions",
];
const PROTECTED_PARTS = ["button", "modal"];

function loadSkinJson(dir: string): { manifest: any | null; error?: string } {
  const file = path.join(dir, "skin.json");
  if (!fs.existsSync(file)) {
    return { manifest: null, error: `skin.json not found in ${dir}` };
  }
  try {
    return { manifest: JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch (e) {
    return { manifest: null, error: `skin.json is not valid JSON: ${(e as Error).message}` };
  }
}

/** Strip CSS comments so they cannot smuggle banned tokens past the scanner. */
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, " ");
}

/**
 * Determine whether a url() target is a bundled relative asset (allowed) or
 * an off-bundle / remote reference (forbidden). data: URIs are treated as
 * off-bundle (they can encode arbitrary remote-ish payloads and bypass the
 * "must be a bundled file" rule).
 */
function isOffBundleUrl(raw: string): boolean {
  const ref = raw.trim().replace(/^['"]/, "").replace(/['"]$/, "").trim();
  if (ref === "") return false;
  // In-document fragment refs are not network.
  if (ref.startsWith("#")) return false;
  // Explicit schemes => off-bundle (http, https, ftp, file, data, etc.).
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) return true;
  // Protocol-relative.
  if (ref.startsWith("//")) return true;
  // Absolute filesystem / site-root path escapes the bundle.
  if (ref.startsWith("/")) return true;
  // Parent-traversal escapes the bundle directory.
  const normalized = path.posix.normalize(ref);
  if (normalized.startsWith("..")) return true;
  return false;
}

interface SecurityScan {
  offBundleUrls: string[];
  remoteImports: string[];
  scripts: string[];
  hidingSelectors: string[];
}

/**
 * Split CSS into rough (selectorBlock, declarations) pairs. This is a
 * lightweight tokenizer — good enough to associate a `display:none` with the
 * selector that introduced it, without pulling a full CSS parser dependency.
 */
function ruleBlocks(css: string): Array<{ selector: string; body: string }> {
  const blocks: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    blocks.push({ selector: m[1].trim(), body: m[2].trim() });
  }
  return blocks;
}

function selectorTargetsProtected(selector: string): boolean {
  const s = selector.toLowerCase();
  for (const r of PROTECTED_REGIONS) {
    if (
      s.includes(`data-region="${r}"`) ||
      s.includes(`data-region='${r}'`) ||
      s.includes(`data-region=${r}`)
    ) {
      return true;
    }
  }
  for (const p of PROTECTED_PARTS) {
    if (
      s.includes(`data-part="${p}"`) ||
      s.includes(`data-part='${p}'`) ||
      s.includes(`data-part=${p}`)
    ) {
      return true;
    }
  }
  return false;
}

function scanCss(css: string): SecurityScan {
  const clean = stripCssComments(css);
  const scan: SecurityScan = {
    offBundleUrls: [],
    remoteImports: [],
    scripts: [],
    hidingSelectors: [],
  };

  // url(...) — including inside @font-face src and image-set().
  const urlRe = /url\(\s*([^)]*)\)/gi;
  let u: RegExpExecArray | null;
  while ((u = urlRe.exec(clean)) !== null) {
    if (isOffBundleUrl(u[1])) scan.offBundleUrls.push(u[0].trim());
  }

  // @import — any @import is rejected: a skin's CSS must be self-contained,
  // and remote @import is a known exfiltration vector.
  const importRe = /@import\s+([^;]+);/gi;
  let im: RegExpExecArray | null;
  while ((im = importRe.exec(clean)) !== null) {
    scan.remoteImports.push(`@import ${im[1].trim()}`);
  }

  // <script>, javascript: URLs, and expression() (legacy IE CSS-JS bridge).
  if (/<script\b/i.test(clean)) scan.scripts.push("<script> tag in CSS");
  const jsUrlRe = /javascript\s*:/gi;
  if (jsUrlRe.test(clean)) scan.scripts.push("javascript: URL");
  const exprRe = /expression\s*\(/gi;
  if (exprRe.test(clean)) scan.scripts.push("expression(...) in CSS");

  // Hiding declarations that target protected anchors. Strip statement at-rules
  // (e.g. @import ...;) first so they aren't mis-tokenized as selectors.
  const blockSource = clean.replace(/@import\s+[^;]+;/gi, " ");
  for (const block of ruleBlocks(blockSource)) {
    if (!selectorTargetsProtected(block.selector)) continue;
    const body = block.body.toLowerCase();
    const hides =
      /display\s*:\s*none/.test(body) ||
      /opacity\s*:\s*0(\b|\.0+\b|;|\s|$)/.test(body) ||
      /visibility\s*:\s*hidden/.test(body);
    if (hides) {
      scan.hidingSelectors.push(block.selector);
    }
  }

  return scan;
}

export function validateSkin(dir: string): ValidateResult {
  const results: RuleResult[] = [];

  // ---- Rule: manifest loads ----
  const { manifest, error } = loadSkinJson(dir);
  if (!manifest) {
    results.push({
      rule: "manifest:loadable",
      pass: false,
      detail: [error ?? "skin.json could not be loaded"],
    });
    return { ok: false, results, manifest: null };
  }
  results.push({ rule: "manifest:loadable", pass: true, detail: [] });

  // ---- Rule: schema validation (ajv, strict:false, allErrors) ----
  const schema = loadManifestSchema();
  const ajv = new Ajv({ strict: false, allErrors: true });
  const validate = ajv.compile(schema as object);
  const valid = validate(manifest);
  results.push({
    rule: "manifest:schema",
    pass: !!valid,
    detail: valid
      ? []
      : (validate.errors ?? []).map(
          (e) => `${e.instancePath || "(root)"} ${e.message ?? ""}`.trim()
        ),
  });

  // ---- Rule: background media must be bundled (no external video/image) ----
  const bg = manifest.background;
  if (bg && (typeof bg.video === "string" || typeof bg.image === "string")) {
    const offenders: string[] = [];
    for (const key of ["video", "image"] as const) {
      const ref = bg[key];
      if (typeof ref === "string" && isOffBundleUrl(ref)) {
        offenders.push(`background.${key}: ${ref}`);
      }
    }
    results.push({
      rule: "security:bundled-background",
      pass: offenders.length === 0,
      detail: offenders.map(
        (o) => `off-bundle background media (must be bundled in the skin): ${o}`
      ),
    });
  } else {
    results.push({
      rule: "security:bundled-background",
      pass: true,
      detail: ["no background media"],
    });
  }

  // ---- Load skin.css if referenced or present ----
  const cssRel: string | undefined =
    typeof manifest.styles === "string" ? manifest.styles : undefined;
  let cssPath: string | null = null;
  if (cssRel) {
    cssPath = path.join(dir, cssRel);
  } else if (fs.existsSync(path.join(dir, "skin.css"))) {
    cssPath = path.join(dir, "skin.css");
  }

  let css: string | null = null;
  if (cssPath) {
    if (!fs.existsSync(cssPath)) {
      results.push({
        rule: "styles:present",
        pass: false,
        detail: [`manifest.styles points to ${cssRel} which does not exist`],
      });
    } else {
      css = fs.readFileSync(cssPath, "utf8");
    }
  }

  // ---- Security rules (only meaningful when there is CSS) ----
  if (css !== null) {
    const scan = scanCss(css);

    results.push({
      rule: "security:no-off-bundle-url",
      pass: scan.offBundleUrls.length === 0,
      detail: scan.offBundleUrls.map((s) => `off-bundle url(): ${s}`),
    });
    results.push({
      rule: "security:no-remote-import",
      pass: scan.remoteImports.length === 0,
      detail: scan.remoteImports.map((s) => `forbidden import: ${s}`),
    });
    results.push({
      rule: "security:no-script",
      pass: scan.scripts.length === 0,
      detail: scan.scripts.map((s) => `forbidden: ${s}`),
    });
    results.push({
      rule: "security:no-hiding-protected-anchors",
      pass: scan.hidingSelectors.length === 0,
      detail: scan.hidingSelectors.map(
        (s) => `hides/zeroes a protected anchor: ${s}`
      ),
    });
  } else {
    // No CSS => security CSS rules trivially pass (token-only skin is safe).
    results.push({
      rule: "security:no-off-bundle-url",
      pass: true,
      detail: ["no skin.css present"],
    });
    results.push({
      rule: "security:no-remote-import",
      pass: true,
      detail: ["no skin.css present"],
    });
    results.push({
      rule: "security:no-script",
      pass: true,
      detail: ["no skin.css present"],
    });
    results.push({
      rule: "security:no-hiding-protected-anchors",
      pass: true,
      detail: ["no skin.css present"],
    });
  }

  const ok = results.every((r) => r.pass);
  return { ok, results, manifest };
}

export { loadTokenVarMap };
export type { TokenVarMap };
