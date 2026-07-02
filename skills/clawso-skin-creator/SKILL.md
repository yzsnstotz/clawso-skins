---
name: clawso-skin-creator
description: Use when creating, repairing, validating, or packaging Clawso skin artifacts for Creator Studio, including tokens, scoped CSS, bundled assets, and image or video backgrounds.
version: 1.1.0
---

# Clawso Skin Creator

Create Creator Studio-compatible Clawso skin artifacts. This skill may install or clone the public authoring kit for schemas and CLI validation, but generated skins must remain self-contained and must not reference GitHub or other remote asset URLs.

Do not produce pet-pack artifacts in this skill. Use `clawso-pet-creator` for pets.

## Standalone Tooling Bootstrap

The skill must work even when the user only has this `SKILL.md`.

1. Resolve an authoring kit directory:

   ```bash
   if [ -n "${CLAWSO_SKINS_REPO:-}" ] && [ -f "$CLAWSO_SKINS_REPO/packages/skin-kit/package.json" ]; then
     KIT="$CLAWSO_SKINS_REPO"
   elif [ -f "packages/skin-kit/package.json" ] && [ -d "schema" ]; then
     KIT="$PWD"
   else
     KIT="${XDG_CACHE_HOME:-$HOME/.cache}/clawso/clawso-skins"
     if [ ! -d "$KIT/.git" ]; then
       mkdir -p "$(dirname "$KIT")"
       git clone https://github.com/yzsnstotz/clawso-skins.git "$KIT"
     fi
   fi
   export KIT
   ```

2. Build the CLI when needed:

   ```bash
   npm --prefix "$KIT/packages/skin-kit" install
   npm --prefix "$KIT/packages/skin-kit" run build
   ```

3. Validate and optionally build artifacts with:

   ```bash
   node "$KIT/packages/skin-kit/dist/cli.js" validate <skin-dir>
   node "$KIT/packages/skin-kit/dist/cli.js" build <skin-dir>
   ```

The GitHub URL above is only for fetching the authoring kit. It must never appear inside `skin.json`, token files, `skin.css`, `background.video`, `background.image`, `assets`, `url(...)`, `@font-face`, or `@import`.

## Output

Produce a skin artifact directory containing:

- `skin.json`
- per-mode token JSON files
- optional scoped `skin.css`
- optional bundled assets referenced by the manifest or CSS
- optional bundled background media
- a concise author note describing visual intent, asset choices, validation result, and any warnings

## Background Media

Skins may use bundled image or video backgrounds through `skin.json`:

```json
{
  "background": {
    "video": "assets/bg.mp4",
    "dim": 0.42,
    "blur": 0
  }
}
```

Supported authoring patterns:

- `background.video`: bundled looping muted video such as `assets/bg.mp4`, `assets/bg.webm`, or `assets/bg.mov`.
- `background.image`: bundled image or animated image such as `assets/bg.png`, `assets/bg.jpg`, `assets/bg.webp`, `assets/bg.gif`, or `assets/bg.apng`.
- `dim`: readability overlay from `0` to `1`; use it by default for busy media.
- `blur`: optional blur radius for softening the background.

Prefer readability over spectacle. Video backgrounds should be short, optimized, subtle, and darkened enough that shell text, panels, buttons, and market cards remain legible.

## Workflow

1. Clarify the intended visual direction only when needed.
2. Create or update the skin artifact using the v1 skin contract.
3. Use tokens first, scoped CSS second, and bundled media/assets only when tokens cannot express the design.
4. If using background media, copy it into the artifact directory, reference it with a bundled relative path, and set `dim`/`blur` for readability.
5. Validate locally with the bootstrapped CLI.
6. If local validation passes, optionally build a `.skin` bundle.
7. Before submission, run dry-run publish planning when useful:

   ```bash
   node "$KIT/packages/skin-kit/dist/cli.js" publish <skin-dir> --dry-run --api <bff-url> --token test
   ```

8. Tell the author how to import the artifact into Clawso Creator Studio for client preview, BFF preflight, pricing, and submission.

## Rules

- The CLI is helpful but optional; designers may use Creator Studio upload/import instead.
- BFF preflight requires a signed-in certified creator. Do not imply local validation is marketplace approval.
- Real publishing goes through `/api/creator/skin/preflight` and `/api/creator/skin/submissions`; do not use legacy marketplace direct-submit endpoints.
- Keep the skin declarative. Skin v1 covers tokens, scoped appearance CSS, bundled assets/backgrounds, and bounded layout only.
- Do not add JavaScript, remote imports, secret-bearing URLs, off-bundle assets, external fonts, external videos, GitHub raw links, or absolute local filesystem paths.
- Every `background.video`, `background.image`, `assets[]`, CSS `url(...)`, and `@font-face src` must resolve to a file inside the skin artifact.
- Do not claim L4/plugin/MOD behavior support in v1.
- Generated schema files under `schema/` are read-only outputs from Clawso `packages/skin-contract`; do not hand-edit them.
- Do not hide local or BFF preflight failures. Report failures plainly with the file/path/rule that triggered them.

## Handoff

Return:

- artifact directory path
- validation commands run and pass/fail state
- dry-run publish plan when relevant
- bundled asset list, especially background videos/images
- known warnings or unsupported requests
- next Creator Studio action: import, client preview, BFF preflight, price setup, or submit
