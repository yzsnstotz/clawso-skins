# Compatibility rules

A skin marketplace lives or dies on whether old skins keep working as the client evolves, and whether new skins degrade gracefully on old clients. These seven rules make both directions hold.

1. **The contract is semver'd; a skin declares its target.** `skin.json` carries `contract` (e.g. `"1.3"`) and optional `minClient`.

2. **Layered application, layered fallback.** A skin applies in independent layers (tokens → appearance → layout → assets → mode). Any layer that meets a key it does not understand **skips that key and keeps the default value** — it never throws. This single rule gives token-level compatibility in both directions for free.

3. **Anchors and token slots are append-only within a major version.** New regions, parts, and token slots may be *added* freely. They are **never renamed or removed** inside a major version; a rename ships as an alias. → old skins keep working on new clients (**backward compatible**). A CI gate in the monorepo diffs the exported `anchors.json` / `tokens.schema.json` against the last published version and fails the build on any removal or rename without a major bump.

4. **Capability negotiation.** The client publishes `supportedContract` and a capability set (regions, parts). A skin declares `requires`. If a required capability is missing on an older client, the client applies the layers it *does* understand (typically tokens + appearance), shows a non-blocking "some effects need a newer app" badge, and never breaks. → new skins degrade on old clients (**forward compatible**).

5. **The default skin is the reference implementation and the floor.** Every anchor, slot, and knob has a default value. A skin is a diff; missing keys inherit the default. A minimal skin is always safe.

6. **Breaking changes require a major bump plus a migration shim.** When a rename or restructure is unavoidable, bump the major version and ship an in-client load-time migration that maps `v(N-1)` skins to `vN`. Shims are retained for K major versions so marketplace skins do not mass-break.

7. **Publish gate enforces compatibility and security together.** Before listing, a skin must pass schema validation, the append-only anchor check, and the [security](security.md) rules. The same `clawso-skin validate` runs locally, in repo CI, and at marketplace publish time.
