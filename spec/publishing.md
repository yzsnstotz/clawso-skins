# Publishing skins and pet packs

This is the public creator process for moving a local artifact into the Clawso market. Skin and pet authoring are separate lanes, but they share the same review shape: local draft, local preview, BFF preflight, immutable submission snapshot, admin decision, published listing/version.

## 1. Choose an authoring lane

### Creator Studio lane

Use Clawso **Developer / Creator Studio** when the author is primarily a designer or wants a guided flow.

1. Sign in to Clawso.
2. Become a certified creator. The BFF rejects preflight and submission without creator auth/certification.
3. Open **Create Skin** or **Create Pet**. These lanes are intentionally separate.
4. Import a generated artifact or edit the manifest in the client.
5. Preview locally:
   - Skin preview applies the artifact to the local client preview path.
   - Pet preview uses the shared companion runtime where supported.
6. Run preflight.
7. Submit the passing artifact.

Local drafts are not cloud-synced in v1. Only submitted snapshots are stored remotely.

### CLI / agent lane

Use the CLI or a skill when the author wants automation or a developer workflow.

1. Generate or edit the skin/pet artifact.
2. Run local schema/security validation when the CLI is available.
3. Optionally build the local bundle.
4. Import the artifact into Creator Studio, or submit through a future authenticated automation path once available.

The CLI is optional for designers. Agents may install or bootstrap it, but must still produce Creator Studio-compatible artifacts and must surface BFF preflight failures honestly.

## 2. Preflight

Preflight is a server-side policy check. It requires an authenticated certified creator and is rate-limited by creator, IP, and device. The BFF caches reports by artifact hash and contract version, so repeating the exact same preflight does not rerun deep validation.

Preflight checks include:

- manifest schema and contract version
- supported asset class (`skin` or `pet-pack`)
- bundle size and decompressed size
- file count and file type limits
- skin background/preview size limits
- pet pack asset references
- deterministic artifact hash

Preflight does not spend creator quota. Submission does.

## 3. Submission snapshot

Submitting a passing artifact creates an immutable snapshot:

- manifest JSON
- bundle bytes in marketplace storage
- artifact hash
- bundle sha256
- preflight report link
- target version and optional target listing

If the author changes anything after submission, they must create a new attempt. A rejected submission is terminal for that attempt; Clawso v1 uses approve/reject/spam-reject rather than a heavy request-changes loop.

## 4. Admin review

Admin review reads the submitted snapshot, not the author's current local files.

Admin decisions:

- **Approve** publishes the submitted snapshot as a listing/version.
- **Reject** closes the attempt without publication.
- **Spam reject** closes the attempt and may affect creator trust/rate limits.

For early creator growth, Clawso can use incentives or manual quota grants, but the baseline system still requires certified creator identity and submission quota/payment/subscription policy before accepting marketplace submissions.

## 5. Published versions and upgrades

Approved submissions become market listings or new listing versions.

Installed users are not silently forced onto new versions in v1:

- the client tracks the installed version
- the market can show an available update
- the user chooses when to update

This matters for both skins and pet packs because local appearance/runtime state must remain stable until the user accepts an update.

## 6. Current CLI commands

The current `skin-kit` CLI is skin-first:

```bash
npm --prefix packages/skin-kit run build
node packages/skin-kit/dist/cli.js validate examples/default
node packages/skin-kit/dist/cli.js build examples/default
node packages/skin-kit/dist/cli.js preview examples/default --out /tmp/clawso-skin-preview.html
```

Pet-pack CLI coverage is still contract/schema oriented in v1. Use Creator Studio for pet runtime preview and final submission until the automation submit path is explicitly documented.

## 7. Public release gate

Before making this repo public, confirm:

- schema files were regenerated from `packages/skin-contract`
- README and specs do not claim L4/plugin/MOD support for skin/pet v1
- skin and pet skill entrypoints are present
- example artifacts validate
- `packages/skin-kit` builds and its smoke tests pass
- no private Clawso client source, tokens, endpoints, or internal secrets are included
