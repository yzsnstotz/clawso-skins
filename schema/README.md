# schema/ — generated, do not hand-edit

These files are the **machine-readable** form of the [skin contract](../spec/skin-contract-v1.md) and pet-pack contract:

- `manifest.schema.json` — JSON Schema for a skin's `skin.json`
- `pet-pack.schema.json` — JSON Schema for a pet-pack's `pet.json`
- `tokens.schema.json` — the semantic token slot list (names + value types)
- `anchors.json` — the versioned, append-only `data-region` / `data-part` registry
- `token-var-map.json` — each semantic token slot → the backing CSS custom-property name(s) it writes (the inverse of the client's legacy var→slot table, plus a forward-derived `--var` for gap slots). Lets the SDK/preview project a skin's slot values into CSS var overrides without importing monorepo source.

They are **generated** from the Clawso monorepo (`packages/skin-contract`) and published here on every contract release. The client runtime, the marketplace publish gate, and `@clawso/skin-kit` all derive validation from this same source, so they cannot drift.

From the Clawso monorepo:

```bash
npm --prefix packages/skin-contract run build
SKIN_SCHEMA_OUT_DIR=/Users/yzliu/work/projects/clawso-skins/schema node packages/skin-contract/scripts/export-skin-contract.ts
```

Editing these by hand will be overwritten on the next export — and would silently desync the published contract from the real client. Propose contract changes in the monorepo instead.
