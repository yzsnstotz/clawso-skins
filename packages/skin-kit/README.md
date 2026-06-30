# @clawso/skin-kit

The CLI for authoring Clawso skins and validating Clawso pet-pack manifests. It validates against the [generated schema](../../schema/), bundles `.skin` packages, previews skins against a static snapshot of the current Clawso shell, and can submit skin artifacts through the current Creator Studio BFF flow.

## Commands

| Command | Does |
|---------|------|
| `clawso-skin init <name>` | scaffold a new skin from the `default` example |
| `clawso-skin preview` | render the bundled shell snapshot with the skin applied (live reload) |
| `clawso-skin validate` | check a skin or pet-pack against schema + [security rules](../../spec/security.md) |
| `clawso-skin build` | produce a `.skin` zip bundle for local distribution |
| `clawso-skin publish` | validate + build a `.skin` tar.gz, run BFF preflight, and create a Creator Studio review submission |

Pet-pack support is validation-only in this CLI. Import `pet.json` into Creator Studio for runtime preview, BFF preflight, and marketplace submission.

## `publish`

```
clawso-skin publish <dir> [--token t] [--api url] [--dry-run] [--notes text]
```

`publish` runs `validate` (schema + security), builds the `.skin` bundle as a **gzipped tar** (`skin.json` at the root plus every referenced file — the per-mode `tokens.json` and `skin.css`), and follows the same two-step Creator Studio BFF flow as the client:

```
POST ${apiBase}/api/creator/skin/preflight
POST ${apiBase}/api/creator/skin/submissions
```

with `Authorization: Bearer ${token}`. The token must belong to a signed-in certified creator. Preflight does not spend creator submission quota; accepted submission does.

The preflight multipart body carries `manifest` and size metadata. The submission multipart body carries `manifest`, `bundle`, `preflightReportId`, `artifactHash`, `title`, `slug`, and `version`.

On success the endpoint returns a Creator Studio submission row with `id`, `status`, `slug`, `targetVersion`, and `artifactHash`. It does not bypass admin review.

### Flags & env vars

| flag | env var | default | meaning |
|------|---------|---------|---------|
| `--api <url>` | `CLAWSO_API_BASE_URL` | `https://app.clawso.ai` | Creator Studio BFF base |
| `--token <t>` | `CLAWSO_DEV_TOKEN` | — | signed-in certified creator bearer token |
| `--notes <text>` | — | — | optional release notes |
| `--dry-run` | — | — | do everything **except** the network POSTs |

### `--dry-run`

`--dry-run` validates, builds the bundle in memory, prints the resolved BFF endpoints, bundle bytes + sha256, preflight size metadata, release-notes size, and the skin id/version — then exits `0` **without making any network call**. Use it to verify a publish offline before you have a token:

```
$ clawso-skin publish examples/midnight-neon --dry-run --token test --api http://127.0.0.1:18808
Publish dry-run for Midnight Neon
  skin:      midnight-neon@1.0.0
  apiBase:   http://127.0.0.1:18808
  preflight: http://127.0.0.1:18808/api/creator/skin/preflight
  submit:    http://127.0.0.1:18808/api/creator/skin/submissions
  POST multipart/form-data fields:
    bundle                  midnight-neon.skin  2236 bytes
                            sha256=25410ccd6c125a390cc6da7bdbff0db43fea93db44c02f4a41303aca18c6209a
    manifest                skin.json
    bundleSizeBytes         2236
    decompressedBytes       6190
    fileCount               3
    release_notes           (none)
No network call made (--dry-run). Import the artifact into Creator Studio or run without --dry-run with a certified creator token.
```

See [`spec/publishing.md`](../../spec/publishing.md) for the full end-to-end runbook: becoming a publisher, the validate → build → publish flow, admin-review states, and how an installed skin reaches the in-app Appearance picker.

## Static shell snapshot

`preview` works without a backend by loading a **shell snapshot** — a frozen DOM of Clawso's key screens, carrying every published anchor but no live data. The snapshot is exported from the monorepo on each client release and shipped with this package, so authors always preview against the current contract.
