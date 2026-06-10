# clawso-skins

Build and share **skins** for the [Clawso](https://clawso.ai) desktop client — like mods for a game. A skin can re-theme Clawso (colours, fonts, effects), reshape parts of its layout (sidebar side, nav order, top-bar widgets), and ship as a self-contained, tradeable package.

This repo is the **authoring surface**: the contract spec, the machine-readable schema, the `skin-kit` CLI, and example skins to fork. The Clawso client and its marketplace are the *distribution* surface.

> **Single source of truth.** The files under [`schema/`](schema/) are **generated** from the Clawso monorepo (`packages/skin-contract`) and published here on every contract release. Do not hand-edit them — they would drift from the real client. The human-readable contract lives in [`spec/`](spec/).

## What a skin can change (v1)

Skins sit on a capability ladder. v1 exposes the first three rungs; arbitrary element repositioning and any code execution are **out of scope** (the latter is the separate plugin track).

| Tier | You can change | Cost |
|------|----------------|------|
| **T1 Tokens** | colours, fonts, spacing, radius, shadow, motion | trivial |
| **T2 Appearance** | scoped CSS, bundled fonts/backgrounds/assets, glow/glass/animation | low |
| **T3 Layout (bounded)** | sidebar left/right, nav item order & visibility, top-bar widget order | low–moderate |
| ~~T3-full~~ | ~~arbitrary element repositioning / new regions~~ | **out of v1** |
| ~~T4 Behaviour~~ | ~~custom JS / new components~~ | **plugins, not skins** |

A skin is a **diff over the default skin**: override only what you want, everything else inherits. A five-line skin and a five-thousand-line skin are both valid.

## Quickstart

```bash
npm i -g @clawso/skin-kit
clawso-skin init my-skin        # scaffold from the default example
cd my-skin
clawso-skin preview             # render the current Clawso shell with your skin, locally
clawso-skin validate            # schema + security gate
clawso-skin build               # produce a publishable .skin bundle
```

`preview` loads a **static shell snapshot** shipped with the SDK, so you can iterate without running the full Clawso app or signing in.

## Repo layout

```
spec/        human-readable contract, compatibility & security rules   (hand-written)
schema/      JSON Schema for the manifest, token slots, anchor registry (generated)
packages/    @clawso/skin-kit — the validate / build / preview CLI
examples/    default · midnight-neon · paper-light (fork these)
```

## Distribution

- **Community (free):** share a skin via git — `clawso-skin install <git-url>`. Zero gatekeeping, zero fees.
- **Marketplace (paid / verified):** publish through the Clawso client. Reuses Clawso's developer certification, `verified` tier, points economy, and publish gate.

Both paths run the **same** `validate` contract and security checks.

## License

MIT (see [LICENSE](LICENSE)). Examples are MIT too — fork freely. Open-sourcing the contract does not open-source the Clawso client itself.
