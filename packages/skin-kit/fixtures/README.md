# fixtures/ — generated preview fixtures

These files are **generated preview fixtures**, not hand-authored sources.

- `shell-snapshot.html` — a self-contained, static reproduction of the Clawso shell. It opens standalone in any browser (all CSS is inlined; no backend, no build step, no network) so skin authors can preview a skin against the real shell layout without installing or signing in to the client.

## Contract vs content

The **contract** is the set of anchors and class names the snapshot carries:

- layout regions on `[data-region]` — `app-shell`, `sidebar`, `topbar`, `topbar-lead`, `topbar-actions`, `sidebar-nav`, `sidebar-brand`, `main`
- component parts on `[data-part]` — `nav-item`, `nav-group`, `button`, `card`, `panel`, `input`, `modal`, `tab`, `table`, `pill`, `badge`
- the `.client-*` class names and the `:root` design tokens the shell renders with

Skins target those anchors and override the design tokens. **Anchors and class names are the contract; everything else is illustrative.** The labels, icons, copy, and the reserved-part styling (`card` / `panel` / `input` / `tab` / `table` / `modal` are reserved anchors not yet authored in the shell CSS) are placeholder only — there is no live data.

## Regeneration and drift

The snapshot is **regenerated on each client release** from the monorepo sources:

- `apps/client/src/components/AppShell.tsx` — DOM structure + anchors
- `apps/client/src/styles/client-shell.css` — the `.client-*` rules
- `packages/design-system/src/tokens.css` — the `:root` design tokens

Because it is a frozen copy of a moving target, **it may drift** from the live client between releases. Treat the published anchors (`schema/anchors.json`) and the slot→CSS-var map (`schema/token-var-map.json`) as the authoritative contract; this fixture is a convenience preview, not the source of truth.

## Dark mode

Toggle `data-theme="dark"` on the `<html>` element to preview the dark token set.
