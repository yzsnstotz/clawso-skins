# Clawso Skin Creator

Use this skill when the user wants to design, generate, repair, validate, or package a Clawso skin artifact for Creator Studio or the Clawso market.

## Output

Produce Creator Studio-compatible skin artifacts:

- `skin.json`
- per-mode token JSON files
- optional scoped `skin.css`
- optional bundled assets referenced by the manifest
- a concise author note describing what changed and any validation warnings

Do not produce pet-pack artifacts in this skill. Use `clawso-pet-creator` for pets.

## Workflow

1. Clarify the intended visual direction only when needed.
2. Create or update the skin artifact using the v1 skin contract.
3. Validate locally with the repo CLI when available:
   - If `packages/skin-kit/dist/cli.js` exists, run it directly.
   - Otherwise run `npm --prefix packages/skin-kit install` if dependencies are missing, then `npm --prefix packages/skin-kit run build`.
   - Then run `node packages/skin-kit/dist/cli.js validate <skin-dir>`.
4. If local validation passes, optionally build with `node packages/skin-kit/dist/cli.js build <skin-dir>`.
5. Tell the author how to import the artifact into Clawso Creator Studio for client preview, BFF preflight, and submission.

## Rules

- The CLI is helpful but optional; designers may use Creator Studio upload/import instead.
- BFF preflight requires a signed-in certified creator. Do not imply local validation is marketplace approval.
- Do not hide local or BFF preflight failures. Report failures plainly with the file/path/rule that triggered them.
- Do not claim L4/plugin/MOD support in v1. Skin v1 covers tokens, appearance CSS, and bounded layout only.
- Keep the skin declarative. Do not add JavaScript, remote imports, secret-bearing URLs, or off-bundle assets.
- Generated schema files under `schema/` are read-only outputs from Clawso `packages/skin-contract`; do not hand-edit them.

## Handoff

Return:

- artifact directory path
- validation commands run and pass/fail state
- known warnings or unsupported requests
- next Creator Studio action: import, preview, preflight, or submit
