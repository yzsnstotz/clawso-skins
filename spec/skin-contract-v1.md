# Skin Contract v1

This is the human-readable contract. The machine-readable form (`schema/manifest.schema.json`, `schema/tokens.schema.json`, `schema/anchors.json`) is **generated** from the Clawso monorepo and is authoritative for validation. This document explains the model.

## 1. A skin is a diff over the default

Clawso ships a **default skin**. Every token, anchor, and layout knob has a default value. A skin overrides only the keys it cares about; anything it omits inherits the default. There is no "complete" skin requirement — overriding three colours is a valid skin.

This is also the compatibility floor: an unknown or missing key never breaks rendering, it falls back to default (see [compatibility.md](compatibility.md)).

## 2. Bundle format

A skin is a directory (publishable as a `.skin` zip) containing a manifest plus its referenced files:

```
my-skin/
├── skin.json            manifest (see §3)
├── tokens.json          base token values
├── tokens.dark.json     optional per-mode token overrides
├── skin.css             optional scoped appearance CSS (§5)
├── assets/              optional bundled fonts, images, etc.
└── preview.png          optional marketplace thumbnail
```

## 3. Manifest (`skin.json`)

```jsonc
{
  "contract": "1.0",            // contract version this skin targets
  "id": "midnight-neon",        // unique slug
  "name": "Midnight Neon",
  "version": "1.0.0",           // skin semver
  "author": "you",
  "minClient": "1.2.0",         // optional: lowest Clawso client that satisfies `requires`
  "requires": {                 // capability negotiation (§ compatibility rule 4)
    "regions": ["sidebar", "topbar"],
    "parts": ["nav-item", "card"]
  },
  "modes": {                    // §4
    "default": "dark",
    "dark":  { "tokens": "tokens.json" },
    "light": { "tokens": "tokens.light.json" }
  },
  "styles": "skin.css",         // §5
  "layout": {                   // §6 — bounded layout knobs only
    "sidebar": "left",
    "nav": { "order": ["discover", "my-stuff", "agents", "settings"], "hide": [] },
    "topbarWidgets": { "order": ["balance", "locale", "theme"], "hide": ["region"] }
  },
  "assets": ["assets/fonts/", "assets/bg.webp"],
  "preview": "preview.png"
}
```

The authoritative field list and types live in `schema/manifest.schema.json`.

## 4. Modes

The skin is the top-level unit; **light/dark is a per-skin concept**, not a global app setting. A skin declares one or more `modes` and a `default`. Some skins ship a single mode; others ship `dark` + `light` (or any named modes). The client's mode toggle cycles a skin's declared modes, and hides itself when a skin has only one. A mode supplies a full set of token values (or a diff over the skin's base token file).

## 5. Tokens (T1) and appearance CSS (T2)

**Tokens** are semantic, brightness-agnostic CSS custom properties — names encode *role*, not *darkness*. Categories: `surface`, `content`, `border`, `accent`, semantic (`success`/`danger`/`warning`/`info`), `font`, `radius`, `shadow`, `motion`. The exact slot list is in `schema/tokens.schema.json`. Skins set values; the client injects them under the active `[data-skin]`.

**Appearance CSS** (`skin.css`) is optional scoped CSS for effects tokens can't express (gradients, glass, glow, animation, bundled fonts/backgrounds). It is applied scoped to `[data-skin="<id>"]` and may only target the **stable anchors** below. It must obey [security.md](security.md) (no JS, no off-bundle URLs).

## 6. Anchors — the stable hook surface

Skins hook onto **anchors**, never onto internal class names. Anchors are append-only within a major version (compatibility rule 3).

- **Regions** (`data-region`): layout containers — `app-shell`, `sidebar`, `topbar`, `topbar-lead`, `topbar-actions`, `sidebar-nav`, `sidebar-brand`, `main`.
- **Parts** (`data-part`): reusable components — `nav-item`, `nav-group`, `button`, `card`, `panel`, `input`, `modal`, `tab`, `table`, `pill`, `badge`.

The authoritative, versioned list is `schema/anchors.json`.

### Bounded layout knobs (T3)

The `layout` block exposes only enumerated knobs, never free-form repositioning:

- `sidebar`: `"left" | "right"` — implemented by overriding the shell CSS grid template (DOM order is unchanged).
- `nav.order` / `nav.hide` — reorder/hide top-level nav items (the client renders nav from a config array).
- `topbarWidgets.order` / `.hide` — reorder/hide top-bar widgets via the widget registry.

Arbitrary element repositioning and new regions are **not** in v1.

## 7. Application order

The client applies a skin in independent layers, each falling back to default on any unknown key: **tokens → appearance CSS → layout → assets → mode**. No layer can throw; a malformed or unsupported key is skipped, not fatal.
