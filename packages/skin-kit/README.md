# @clawso/skin-kit

The CLI for authoring Clawso skins. Validates against the [generated schema](../../schema/), bundles publishable `.skin` packages, and previews a skin against a static snapshot of the current Clawso shell — no app install or sign-in required.

## Commands

| Command | Does |
|---------|------|
| `clawso-skin init <name>` | scaffold a new skin from the `default` example |
| `clawso-skin preview` | render the bundled shell snapshot with the skin applied (live reload) |
| `clawso-skin validate` | check the skin against schema + [security rules](../../spec/security.md) |
| `clawso-skin build` | produce a `.skin` bundle for distribution |
| `clawso-skin install <git-url>` | install a community skin into a local Clawso client |

## Static shell snapshot

`preview` works without a backend by loading a **shell snapshot** — a frozen DOM of Clawso's key screens, carrying every published anchor but no live data. The snapshot is exported from the monorepo on each client release and shipped with this package, so authors always preview against the current contract.

> Implementation lands in Phase 3 of the skin-system build. This README documents the intended surface.
