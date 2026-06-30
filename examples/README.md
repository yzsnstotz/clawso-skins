# Examples

Fork any skin as a starting point (`clawso-skin init` copies `default`). Pet-pack examples live under `pet-packs/` and are intended for Creator Studio import/runtime preview.

## Skins

| Skin | Shows |
|------|-------|
| `default/` | the reference skin — every token/anchor at its default value. The compatibility floor. |
| `midnight-neon/` | a "cool" dark skin — cyan accent, glass/glow appearance CSS, animated accents. Demonstrates T2. |
| `paper-light/` | a warm light skin with both `light` and `dark` modes + `sidebar: right`. Demonstrates the per-skin mode model and the layout knob. |
| `terminal/` | **showcase** — pure-black surfaces, **monospace everywhere** (full typeface swap), zero-radius corners, CRT scanlines + phosphor glow. Shows how far token + T2 can go. |
| `synthwave/` | **showcase** — purple gradient backdrop, serif/Futura fonts, big rounded corners, glassmorphism, hot-pink glow, **sidebar on the right + reordered nav**. Exercises tokens, T2, and all the layout knobs. |

The two **showcase** skins exist to demonstrate the full customization range — background, typeface, corner shape, shadows, glow/glass effects, and layout (sidebar side, nav order) — not just accent colours. Each example is MIT — copy freely. (Fonts here use system stacks; a real published skin would bundle its fonts for cross-machine consistency.)

## Pet Packs

| Pet pack | Shows |
|----------|-------|
| `pet-packs/pawsnap-puppy/` | A vector pet-pack with layered SVG-style nodes, five runtime states, broad trigger-slot mappings, persona phrases, reactive FX bindings, and preview assets. Use this as the minimum quality bar for agent-generated pet artifacts. |

Validate the pet-pack contract from the repo root:

```bash
npm --prefix packages/skin-kit run build
node packages/skin-kit/dist/cli.js validate examples/pet-packs/pawsnap-puppy
```

Pet packs are imported into Clawso Creator Studio for runtime preview and marketplace submission. The CLI currently validates pet-pack shape and bundled asset references; skin bundling and static shell preview remain skin-only.
