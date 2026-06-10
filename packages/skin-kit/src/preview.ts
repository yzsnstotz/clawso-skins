/**
 * Preview: take the static shell snapshot and apply a skin to it WITHOUT a
 * backend. We inject a <style> that:
 *   1. projects the skin's semantic slot values onto the backing CSS vars
 *      (via schema/token-var-map.json), scoped under [data-skin="<id>"];
 *   2. appends the skin's skin.css, also scoped under [data-skin="<id>"];
 * and we set data-skin + data-theme (= active mode) on <html>.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { loadShellSnapshot, loadTokenVarMap, TokenVarMap } from "./artifacts";

export interface AppliedSkin {
  id: string;
  mode: string;
  modes: string[];
  html: string;
}

interface ManifestModes {
  default: string;
  [mode: string]: string | { tokens: string };
}

function readTokenFile(
  dir: string,
  rel: string
): Record<string, string> {
  const file = path.join(dir, rel);
  if (!fs.existsSync(file)) {
    throw new Error(`tokens file not found: ${rel}`);
  }
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  // Tokens may be a flat slot->value map, or nested under "tokens".
  const tokens = parsed && typeof parsed === "object" && parsed.tokens && typeof parsed.tokens === "object"
    ? parsed.tokens
    : parsed;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tokens as Record<string, unknown>)) {
    if (typeof v === "string" || typeof v === "number") {
      out[k] = String(v);
    }
  }
  return out;
}

function cssVarDecls(
  slotValues: Record<string, string>,
  varMap: TokenVarMap
): string {
  const lines: string[] = [];
  for (const [slot, value] of Object.entries(slotValues)) {
    const vars = varMap.vars[slot];
    if (!vars || vars.length === 0) continue; // unknown slot -> skip (fallback)
    for (const v of vars) {
      lines.push(`  ${v}: ${value};`);
    }
  }
  return lines.join("\n");
}

/** Rewrite top-level selectors of skin.css to be scoped under [data-skin]. */
function scopeCss(css: string, scope: string): string {
  // Naive but safe block-level scoping: prefix each top-level selector group.
  // @-rules (@media, @font-face, @keyframes, @supports) are passed through;
  // for @media we recurse into the inner block.
  let out = "";
  let i = 0;
  const n = css.length;
  while (i < n) {
    // Skip whitespace.
    while (i < n && /\s/.test(css[i])) {
      out += css[i++];
    }
    if (i >= n) break;

    if (css[i] === "@") {
      // Read the at-rule prelude up to '{' or ';'.
      let j = i;
      while (j < n && css[j] !== "{" && css[j] !== ";") j++;
      const prelude = css.slice(i, j);
      if (j < n && css[j] === ";") {
        // Statement at-rule (e.g. @import) — pass through verbatim.
        out += css.slice(i, j + 1);
        i = j + 1;
        continue;
      }
      // Block at-rule. Find matching closing brace.
      const block = readBlock(css, j);
      if (block === null) {
        out += css.slice(i);
        break;
      }
      const inner = css.slice(j + 1, block.end);
      const isConditional = /@(media|supports|container)/i.test(prelude);
      if (isConditional) {
        out += `${prelude}{${scopeCss(inner, scope)}}`;
      } else {
        // @font-face / @keyframes etc. — leave inner untouched.
        out += `${prelude}{${inner}}`;
      }
      i = block.end + 1;
      continue;
    }

    // Ordinary rule: read selector up to '{'.
    let j = i;
    while (j < n && css[j] !== "{") j++;
    if (j >= n) {
      out += css.slice(i);
      break;
    }
    const selector = css.slice(i, j).trim();
    const block = readBlock(css, j);
    if (block === null) {
      out += css.slice(i);
      break;
    }
    const body = css.slice(j + 1, block.end);
    const scoped = selector
      .split(",")
      .map((s) => {
        const sel = s.trim();
        if (sel === "") return sel;
        // :root and html in a skin map to the scope root itself.
        if (sel === ":root" || sel === "html" || sel === "body") return scope;
        return `${scope} ${sel}`;
      })
      .join(", ");
    out += `${scoped}{${body}}`;
    i = block.end + 1;
  }
  return out;
}

function readBlock(css: string, open: number): { end: number } | null {
  // css[open] === '{'. Returns index of the matching '}'.
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return { end: i };
    }
  }
  return null;
}

/**
 * Build the applied HTML for a skin directory and a chosen mode.
 */
export function applySkin(dir: string, requestedMode?: string): AppliedSkin {
  const manifestPath = path.join(dir, "skin.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const id: string = manifest.id;
  if (!id) throw new Error("skin.json has no id");

  const modesObj: ManifestModes = manifest.modes;
  if (!modesObj || !modesObj.default) {
    throw new Error("skin.json has no modes.default");
  }
  const modeNames = Object.keys(modesObj).filter((k) => k !== "default");
  const activeMode = requestedMode ?? modesObj.default;
  if (!modeNames.includes(activeMode)) {
    throw new Error(
      `mode "${activeMode}" is not declared in skin.json modes (have: ${modeNames.join(", ")})`
    );
  }

  const varMap = loadTokenVarMap();

  // Build per-mode CSS var blocks for every declared mode so the snapshot's
  // data-theme toggle previews the right token set.
  const perMode: string[] = [];
  for (const mode of modeNames) {
    const entry = modesObj[mode];
    const tokensRel =
      typeof entry === "object" && entry !== null ? (entry as any).tokens : undefined;
    if (!tokensRel) continue;
    const slotValues = readTokenFile(dir, tokensRel);
    const decls = cssVarDecls(slotValues, varMap);
    if (decls.trim() === "") continue;
    // Scope to the skin AND the mode so each mode gets its own var set. We key
    // mode off [data-theme] on <html> to match the snapshot's toggle.
    perMode.push(
      `html[data-theme="${mode}"] [data-skin="${id}"],\n` +
        `html[data-theme="${mode}"][data-skin="${id}"],\n` +
        `[data-skin="${id}"][data-theme="${mode}"] {\n${decls}\n}`
    );
  }

  // Appearance CSS (scoped).
  let scopedCss = "";
  const stylesRel: string | undefined =
    typeof manifest.styles === "string" ? manifest.styles : undefined;
  let cssFile: string | null = null;
  if (stylesRel) cssFile = path.join(dir, stylesRel);
  else if (fs.existsSync(path.join(dir, "skin.css")))
    cssFile = path.join(dir, "skin.css");
  if (cssFile && fs.existsSync(cssFile)) {
    const raw = fs.readFileSync(cssFile, "utf8");
    scopedCss = scopeCss(raw, `[data-skin="${id}"]`);
  }

  const injected =
    `<style data-clawso-skin="${id}">\n` +
    `/* ---- token slot -> CSS var projection (per declared mode) ---- */\n` +
    perMode.join("\n\n") +
    (scopedCss
      ? `\n\n/* ---- scoped appearance CSS (skin.css) ---- */\n${scopedCss}\n`
      : "\n") +
    `</style>`;

  let html = loadShellSnapshot();

  // Set data-skin + data-theme on <html>.
  html = html.replace(
    /<html\b([^>]*)>/i,
    (_m, attrs: string) => {
      let a = attrs;
      a = a.replace(/\sdata-theme="[^"]*"/i, "");
      a = a.replace(/\sdata-skin="[^"]*"/i, "");
      return `<html${a} data-theme="${activeMode}" data-skin="${id}">`;
    }
  );

  // Inject the skin style just before </head>.
  if (/<\/head>/i.test(html)) {
    html = html.replace(/<\/head>/i, `${injected}\n</head>`);
  } else {
    html = `${injected}\n${html}`;
  }

  return { id, mode: activeMode, modes: modeNames, html };
}
