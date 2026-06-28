# Clawso Pet Creator

Use this skill when the user wants to design, generate, repair, validate, or package a Clawso pet-pack artifact for Creator Studio or the Clawso market.

## Output

Produce Creator Studio-compatible pet artifacts:

- `pet.json` / pet-pack manifest
- declarative vector pet data when using the v1 agent-friendly path
- optional notes for designer-authored Rive work that must be imported and packaged separately
- a concise author note describing states, trigger slots, persona/reaction data, and validation warnings

Do not produce skin artifacts in this skill. Use `clawso-skin-creator` for skins.

## Workflow

1. Clarify character, motion, and state needs only when needed.
2. Create or update a `kind: "pet-pack"` manifest.
3. Prefer the v1 declarative vector pet format for agent-generated work.
4. Validate against repo schema/contract when the local CLI or schema tooling is available.
5. If the repo-local CLI is needed and not built, bootstrap it:
   - run `npm --prefix packages/skin-kit install` when dependencies are missing
   - run `npm --prefix packages/skin-kit run build`
6. Import the artifact into Clawso Creator Studio for runtime preview, BFF preflight, and submission.

## Rules

- Pet packs stay one asset class: `pet-pack`. Vector, Rive, image/atlas, and future formats are renderer/data differences, not separate marketplace classes.
- BFF preflight requires a signed-in certified creator. Do not imply local validation is marketplace approval.
- Do not hide local or BFF preflight failures. Report failures plainly with the file/path/rule that triggered them.
- Do not claim L4/plugin/MOD support in v1. Pet v1 is declarative pack authoring and runtime preview, not arbitrary behavior plugins.
- Do not embed executable JavaScript, remote media fetches, secrets, or provider-specific prompts in pet-pack data.
- Rive is a designer-authored asset path. If `.riv` packaging/preflight is not available in the current Creator Studio build, say that explicitly and keep the artifact as preview/import-only.

## Handoff

Return:

- artifact directory path or `pet.json` path
- validation commands run and pass/fail state
- supported states and trigger-slot mapping
- known warnings or unsupported requests
- next Creator Studio action: import, preview, preflight, or submit
