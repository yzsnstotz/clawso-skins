# @clawso/skin-kit

The CLI for authoring Clawso skins. Validates against the [generated schema](../../schema/), bundles publishable `.skin` packages, previews a skin against a static snapshot of the current Clawso shell — no app install or sign-in required — and publishes the bundle to the Clawso marketplace.

## Commands

| Command | Does |
|---------|------|
| `clawso-skin init <name>` | scaffold a new skin from the `default` example |
| `clawso-skin preview` | render the bundled shell snapshot with the skin applied (live reload) |
| `clawso-skin validate` | check the skin against schema + [security rules](../../spec/security.md) |
| `clawso-skin build` | produce a `.skin` zip bundle for local distribution |
| `clawso-skin publish` | validate + build a `.skin` tar.gz and submit it to the marketplace |
| `clawso-skin install <git-url>` | install a community skin into a local Clawso client |

## `publish`

```
clawso-skin publish <dir> [--token t] [--api url] [--dry-run] [--notes text]
```

`publish` runs `validate` (schema + security), builds the `.skin` bundle as a **gzipped tar** (`skin.json` at the root plus every referenced file — the per-mode `tokens.json` and `skin.css`), and `POST`s it as `multipart/form-data` to:

```
${apiBase}/api/marketplace/skins/submit
```

with `Authorization: Bearer ${token}`. The multipart body carries:

| part | contents |
|------|----------|
| `bundle` | the `.skin` tar.gz (≤ 5 MB) |
| `admin_review_checklist` | markdown — `<dir>/admin_review_checklist.md` if present, else a generated default |
| `deployment_verification` | markdown — `<dir>/deployment_verification.md` if present, else a generated default |
| `release_notes` | optional text from `--notes` |

If you don't supply the two markdown files, `publish` generates sensible defaults that state the skin is declarative (no JS, bundled assets only), its contract version, and its modes.

On success the endpoint returns `{ slug, version, bundle_sha256, state, review_url, estimated_review_time }`. A permissively-licensed skin (MIT/Apache/BSD/ISC/MPL/CC0/CC-BY) publishes directly (`state: published-direct`); anything else, or a missing license, lands in `pending-review`.

### Flags & env vars

| flag | env var | default | meaning |
|------|---------|---------|---------|
| `--api <url>` | `CLAWSO_API_BASE_URL` | `https://app.clawso.ai` | marketplace API base |
| `--token <t>` | `CLAWSO_DEV_TOKEN` | — | publisher bearer (dealer / `marketplace_publisher`) token |
| `--notes <text>` | — | — | optional release notes |
| `--dry-run` | — | — | do everything **except** the network POST |

### `--dry-run`

`--dry-run` validates, builds the bundle in memory, resolves the two markdown bodies, and prints the resolved `apiBase`, the multipart part names + sizes (bundle bytes + sha256, the two markdown filenames + sizes, release-notes size), and the skin id/version — then exits `0` **without making any network call**. Use it to verify a publish offline before you have a token:

```
$ clawso-skin publish examples/midnight-neon --dry-run --token test --api http://localhost:9999
Publish dry-run for Midnight Neon
  skin:      midnight-neon@1.0.0
  apiBase:   http://localhost:9999
  endpoint:  http://localhost:9999/api/marketplace/skins/submit
  POST multipart/form-data parts:
    bundle                  midnight-neon.skin  2236 bytes
                            sha256=25410ccd6c125a390cc6da7bdbff0db43fea93db44c02f4a41303aca18c6209a
    admin_review_checklist  admin_review_checklist.md  736 bytes (generated)
    deployment_verification deployment_verification.md  638 bytes (generated)
    release_notes           (none)
No network call made (--dry-run).
```

See [`spec/publishing.md`](../../spec/publishing.md) for the full end-to-end runbook: becoming a publisher, the validate → build → publish flow, admin-review states, and how an installed skin reaches the in-app Appearance picker.

## Static shell snapshot

`preview` works without a backend by loading a **shell snapshot** — a frozen DOM of Clawso's key screens, carrying every published anchor but no live data. The snapshot is exported from the monorepo on each client release and shipped with this package, so authors always preview against the current contract.
