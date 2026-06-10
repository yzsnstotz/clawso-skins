# schema/ — generated, do not hand-edit

These files are the **machine-readable** form of the [skin contract](../spec/skin-contract-v1.md):

- `manifest.schema.json` — JSON Schema for a skin's `skin.json`
- `tokens.schema.json` — the semantic token slot list (names + value types)
- `anchors.json` — the versioned, append-only `data-region` / `data-part` registry

They are **generated** from the Clawso monorepo (`packages/skin-contract`) by `pnpm export-skin-contract` and published here on every contract release. The client runtime, the marketplace publish gate, and `@clawso/skin-kit` all derive validation from this same source, so they cannot drift.

Editing these by hand will be overwritten on the next export — and would silently desync the published contract from the real client. Propose contract changes in the monorepo instead.
