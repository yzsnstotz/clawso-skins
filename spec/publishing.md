# Publishing a skin — end-to-end runbook

This is the path a skin takes from a directory on your disk to a one-click theme in a Clawso user's **Settings → Appearance** picker. It mirrors the tool publish flow: a publisher bearer token, a `multipart/form-data` submit, an admin-review gate, then install.

The mechanics of the bundle and the manifest live in [skin-contract-v1.md](skin-contract-v1.md) and [security.md](security.md); this document is the *process*.

```
author machine                     Clawso marketplace (BFF + R2 + DB)         user's client
──────────────                     ──────────────────────────────────        ─────────────
validate ─▶ build ─▶ publish ──▶  POST /api/marketplace/skins/submit
                                         │
                                         ├─ permissive license → published
                                         └─ else               → pending-review ─▶ admin approve ─▶ published
                                                                                                       │
                                              GET /api/skins/installed ◀────────── install ◀───────────┘
                                              ─▶ bundle download ─▶ Appearance picker
```

## 1. Become a publisher

Submitting requires a **publisher bearer token**. A publisher is a marketplace *dealer* — a `marketplace_publisher` record (`public.marketplace_publishers`) that owns an `org_slug` namespace and carries a hashed API token (`api_token_hash`). It is the same publisher identity used to publish tools, so if you already deal tools you already have one.

1. Get a publisher account: request the `marketplace_publisher` role and an `org_slug` (your namespace). Your skin's `skin.json` `author` must match this org — the submit endpoint enforces `enforceSlugNamespace`, so a skin `id` is namespaced under your org and another publisher can't take your slug.
2. Get a **dev token**. The token is sent as `Authorization: Bearer <token>`; the BFF sha256-hashes it and looks it up in `marketplace_publishers.api_token_hash`. Treat it like a password.
3. Make it available to the CLI:
   - `export CLAWSO_DEV_TOKEN=<your token>` (or pass `--token`), and
   - `export CLAWSO_API_BASE_URL=https://app.clawso.ai` (the default; override for a preview env or `--api`).

## 2. validate → build → publish

```bash
# 0. (first time) scaffold
clawso-skin init my-skin

# 1. validate — schema + security; must be all PASS before anything ships
clawso-skin validate my-skin

# 2. build — produce the local .skin (a sanity check; publish rebuilds in memory)
clawso-skin build my-skin

# 3. dry-run the publish — no network, just the multipart plan + bundle sha256
clawso-skin publish my-skin --dry-run

# 4. publish for real
clawso-skin publish my-skin --notes "First release"
```

`publish` does, in order:

1. **Validate.** Runs the same schema + security checks as `clawso-skin validate`. Aborts on any failure — nothing is built or sent.
2. **Build the bundle.** A gzipped USTAR tar with `skin.json` at the root plus every referenced file (the per-mode `tokens.json` and `skin.css`). Built in memory; capped at 5 MB. The publish-time markdown files below are **excluded** from the bundle — they travel as their own parts.
3. **Resolve the two review docs.** If `my-skin/admin_review_checklist.md` and `my-skin/deployment_verification.md` exist they are used verbatim; otherwise `publish` generates sensible defaults stating the skin is declarative (no JS, bundled assets only), its contract version, and its modes.
4. **POST** `multipart/form-data` to `${CLAWSO_API_BASE_URL}/api/marketplace/skins/submit` with `Authorization: Bearer ${CLAWSO_DEV_TOKEN}`:

   | part | type | contents |
   |------|------|----------|
   | `bundle` | file | the `.skin` tar.gz (≤ 5 MB) |
   | `admin_review_checklist` | file | markdown |
   | `deployment_verification` | file | markdown |
   | `release_notes` | text | optional (`--notes`) |

The server re-validates: it re-parses the tar.gz, recomputes the bundle sha256, validates `skin.json` against the single-source-of-truth schema (`@clawso/skin-contract`), confirms every declared mode's tokens file is present, re-runs the CSS security scan on `skin.css`, and enforces version monotonicity (you can't republish or downgrade a version). On success it returns:

```json
{
  "slug": "midnight-neon",
  "version": "1.0.0",
  "bundle_sha256": "25410ccd…",
  "state": "published-direct",
  "review_url": "/admin/marketplace/skins/midnight-neon@1.0.0",
  "estimated_review_time": "1-3 business days"
}
```

### Verifying offline with `--dry-run`

`--dry-run` runs steps 1–3 and prints the resolved `apiBase`, the multipart part names + sizes (bundle bytes + sha256, the two markdown filenames + sizes + whether each was author-provided or generated, the release-notes size), and the skin id/version — then exits without making a network call. It needs no token, so you can confirm a publish is wired correctly before you have one. The `bundle_sha256` it prints is exactly what the server will recompute and store.

## 3. Admin review states

A skin version moves through these states (`public.skin_versions.state`):

- **published-direct** (submit response) → **published** (DB): the skin's license is on the permit list (MIT / Apache-2.0 / BSD / ISC / MPL-2.0 / CC0-1.0 / CC-BY-4.0). The version is live the moment submit returns; the catalog's `current_version` advances to it. No human in the loop.
- **pending-review**: any other license, or no license. The version is stored but **not** discoverable or installable by normal users (only admins can fetch its manifest/bundle). An admin then:
  - **approve** → `published` (and `current_version` advances if this is the highest published version), or
  - **reject** → `rejected` (terminal; never served), or
  - **withdraw** a previously-published version → `withdrawn` (and `current_version` falls back to the next-highest published version).

Discovery (`GET /api/marketplace/skins`) only lists skins that have at least one `published` version, so a `pending-review`/`rejected` submission is invisible to users until it's approved.

## 4. From "published" to the user's Appearance picker

Once a version is `published`, here's how it reaches a user's in-app picker:

1. **Browse & install.** The user finds the skin via discovery, then `POST /api/marketplace/skins/:slug/installed`:
   - **free** skins install directly — the call just bumps the install counter and logs the event (anonymous installs allowed).
   - **one_time** skins charge **points**. The call requires auth and settles atomically through `settle_skin_install_v1`: it deducts `price_credits`, writes the ledger row, and records ownership (`skin_installs`) in one transaction, so a charge and a grant can never partially apply. Insufficient balance returns `402`. Re-installing something you already own re-grants without re-charging.
2. **List installed.** The client calls `GET /api/skins/installed` (auth required). It returns the user's installs joined to their `skin_versions`, each as `{ slug, version, bundle_url, bundle_sha256 }`. This is the set the Appearance picker renders.
3. **Download the bundle.** For each installed skin the client fetches `bundle_url` (`GET /api/marketplace/skins/:slug/bundle?version=…`), verifies the `bundle_sha256`, and unpacks the tar.gz locally.
4. **Apply.** The skin appears in **Settings → Appearance**. Selecting it injects the tokens under the active `[data-skin]`, applies `skin.css` and the bounded layout knobs, and exposes the skin's declared modes (the mode toggle cycles them; see [skin-contract-v1.md §4](skin-contract-v1.md)). Switching skins or modes is instant and reversible — the default skin is always available as the fallback.

That's the whole loop: a directory you `validate` → `build` → `publish` becomes, after the marketplace's automated (or admin) gate, a one-click theme in every user's Appearance picker.
