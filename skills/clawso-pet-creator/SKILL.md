---
name: clawso-pet-creator
description: Use when creating, repairing, validating, or packaging Clawso pet-pack artifacts for Creator Studio, including vector pets, Rive pets, trigger-slot mappings, persona phrases, and reactive effects.
version: 1.2.0
---

# Clawso Pet Creator

Create Creator Studio-compatible Clawso `pet-pack` artifacts. This skill may install or clone the public authoring kit for schemas and CLI validation, but generated artifacts must remain self-contained and must not reference GitHub or other remote asset URLs.

Do not produce skin artifacts in this skill. Use `clawso-skin-creator` for skins.

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

3. Validate artifacts with:

   ```bash
   node "$KIT/packages/skin-kit/dist/cli.js" validate <pet-dir>
   ```

The GitHub URL above is only for fetching the authoring kit. It must never appear inside `pet.json`, `assets`, `preview`, Rive `src`, persona data, or reactive FX data.

## Output

Produce a pet artifact directory containing:

- `pet.json` / pet-pack manifest with `kind: "pet-pack"`.
- One of:
  - `pet.format: "vectorPet"` for agent-generated declarative vector pets.
  - `pet.format: "rivePet"` for designer-authored Rive pets.
- Bundled assets referenced by the manifest, such as `assets/*.riv`, `preview.svg`, `preview.png`, or `contact-sheet.svg`.
- Persona phrases and reactive FX bindings when useful.
- A concise author note with format, trigger coverage, validation result, and any Creator Studio-only preview/submission steps.

## Supported Pet Formats

### Vector Pet

Use `vectorPet` for agent-generated work. It should include layered vector data, actions, `states`, optional `triggerSlots`, optional persona phrases, optional reactive FX, and bundled previews.

### Rive Pet

Use `rivePet` when the user supplies or explicitly wants a `.riv` file.

Required shape:

- `pet.format: "rivePet"`
- `pet.src`: a bundled relative `.riv` path, for example `assets/orbit.riv`
- `assets`: includes the same `.riv` path
- `pet.stateMachine`: the Rive state machine name
- `pet.triggerInputs`: maps Clawso trigger slots to Rive inputs

Optional Rive fields include `artboard`, `fit`, `alignment`, `persona`, `reactiveFx`, and `preview`.

Do not invent a binary `.riv` file. If no `.riv` is available, create a vector pet or produce a Rive manifest scaffold that clearly says the designer must add the bundled `.riv` before validation, preview, preflight, or submission can pass.

## System Limits And Budgets

Treat these as Creator Studio/BFF compatibility limits, not visual taste. If the user asks for something bigger, explain the limit and optimize the artifact instead of producing a package that cannot pass preflight.

Shared pet-pack limits:

- Bundle upload hard limit: 8 MiB. Keep authors under 5 MiB when possible.
- Decompressed bundle hard limit: 24 MiB.
- File count hard limit: 64 files.
- Manifest JSON hard limit: 256 KiB.
- Marketplace preview image hard limit: 1 MiB.
- All manifest and asset paths must be bundled relative paths. Path strings are capped at 240 characters.

Rive pet limits and recommendations:

- `.riv` file hard limit: 6 MiB. Keep it under 3 MiB when possible.
- `pet.src` must point to a bundled `.riv` file and the same path must appear in `assets[]`.
- `pet.stateMachine` is required and capped at 120 characters. `pet.artboard`, when present, is capped at 120 characters.
- `pet.triggerInputs` must contain at least one Clawso trigger slot. Each Rive input name is capped at 120 characters.
- A trigger input either sets `value` or uses `fire: true`; it cannot do both. Numeric values must stay between `-10000` and `10000`.
- There is no hard pixel resolution, canvas size, FPS, or duration gate for `.riv` today. For runtime health, prefer a 512-1024 logical-pixel artboard, a single primary state machine, stable input names, and optimized embedded raster textures.

Vector pet schema limits:

- `layers`: 1-16 layers.
- Each layer has 1-96 SVG nodes. Recursive child nodes are capped at 64 per node.
- `states` must cover all five core states: `idle`, `thinking`, `talking`, `celebrate`, and `wince`.
- Pose-level extra `nodes` are capped at 64.
- `actions`: up to 64 actions. Action duration is 80-20000 ms; trigger `frames` are 1-60; action `intensity` is `-4` to `4`.
- Layer transforms are bounded: translate `-64` to `64`, scale `0.2` to `3`, rotate `-360` to `360`, opacity `0` to `1`.
- Anchors use the 64x64 logical coordinate space and each coordinate is `0` to `64`.
- Persona phrases are capped at 48 phrases, 180 characters per phrase, with up to 8 personality traits of 48 characters each. `maxBubbleChars` is 24-180.
- Reactive FX bindings are capped at 64; particle count is 0-24.
- SVG attributes must not use event handlers or external/executable `href`, `xlinkHref`, `http`, `https`, `javascript`, or `data` references.

Recommended vector pet output:

- Use the default `viewBox: "0 0 64 64"` unless the user has a strong reason.
- Keep generated SVG simple enough to inspect and animate; prefer clear layers and named actions over dense path dumps.
- Use SVG previews when possible. If a PNG preview is included, keep its longest edge at or below 1024 px and under the 1 MiB preview limit.
- Cover all 49 trigger slots either with unique behavior or explicit fallback mappings. Do not expose only the five core states as if they were the full interaction surface.

## Trigger Slots

The current client contract recognizes these 49 trigger slots. A pet may implement unique behavior for each slot, or intentionally map less-specific slots to core fallback behavior, but the handoff must state which slots are covered and which fall back.

Core and interaction slots:

```text
idle, working, success, failure, waiting_user, hover, greet, move_left, move_right, responding
```

General lifecycle slots:

```text
attention, summon, dismiss, sleep, impatient, approval_needed, cancelled, retrying, offline, drag_start, drag_end, idle_variant, instruction_received
```

Agent slots:

```text
agent_planning, agent_coding, agent_testing, agent_fixing, agent_reviewing, agent_blocked, agent_done
```

Automation slots:

```text
automation_queued, automation_running, automation_waiting, automation_success, automation_failure
```

Tool/auth/panel slots:

```text
tool_running, tool_success, tool_failure, tool_pending, tool_streaming, tool_retrying, tool_waiting_input, tool_done, tool_error, auth_required, handoff_ready, panel_unread, panel_processing, panel_jump
```

For vector pets, map these through `pet.triggerSlots`, persona `phrases[].slot`, and reactive FX `bindings[].slot`. For Rive pets, map them through `pet.triggerInputs`. Use bundled previews to make the intended behavior inspectable.

## Workflow

1. Clarify character, motion, and state needs only when needed.
2. Pick `vectorPet` for generated art or `rivePet` for supplied `.riv` work.
3. Check the system limits above before writing assets so oversized work is corrected early.
4. Create or update a self-contained `pet-pack` directory.
5. Use the public kit example `examples/pet-packs/pawsnap-puppy` as a quality reference when the kit is available.
6. Validate locally with the bootstrapped CLI.
7. Import the artifact into Clawso Creator Studio for runtime preview, BFF preflight, pricing, and submission.

## Rules

- Pet packs stay one asset class: `pet-pack`. Vector, Rive, image/atlas, and future formats are renderer/data differences, not separate marketplace classes.
- All asset references inside `pet.json` must be bundled relative paths. No `http:`, `https:`, `github.com`, `raw.githubusercontent.com`, absolute paths, `..`, hidden path segments, remote media fetches, or secrets.
- BFF preflight requires a signed-in certified creator. Do not imply local validation is marketplace approval.
- Local CLI validation is not runtime approval. Pet runtime preview and final submission stay in Creator Studio in v1.
- Do not hide local or BFF preflight failures. Report failures plainly with the file/path/rule that triggered them.
- Do not claim L4/plugin/MOD support in v1. Pet v1 is declarative pack authoring and runtime preview, not arbitrary behavior plugins.
- Do not embed executable JavaScript, provider-specific prompts, tokens, or external service configuration in pet-pack data.

## Handoff

Return:

- artifact directory path or `pet.json` path
- pet format: `vectorPet` or `rivePet`
- validation commands run and pass/fail state
- trigger-slot coverage and fallback notes
- bundled asset list, especially `.riv` files for Rive pets
- size/complexity notes against the system limits above
- known warnings or unsupported requests
- next Creator Studio action: import, runtime preview, BFF preflight, price setup, or submit
