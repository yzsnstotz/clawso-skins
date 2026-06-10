# Security rules for skin authors

A marketplace skin is **untrusted code from a stranger running inside a wallet-bearing desktop app**. CSS alone is enough to exfiltrate data, hijack clicks, or hide the very UI a user relies on to confirm spending points. These rules are enforced by `clawso-skin validate` and at marketplace publish time. A skin that violates any of them is rejected.

## Hard prohibitions

- **No JavaScript.** Skins are declarative: tokens, scoped CSS, and bundled assets only. Behaviour belongs to the separate plugin track, not skins.
- **No off-bundle network access.** Every `url(...)`, `@font-face src`, and `image-set()` must resolve to a file bundled inside the skin. No `http(s):` origins, no `@import` of remote stylesheets, no `url()` to external hosts. (External `url()` + attribute selectors is a known CSS data-exfiltration channel.)
- **No covering or hiding critical chrome.** Skins may not `display:none`, zero-size, fully transparentize, or overlay the regions/parts that carry irreversible actions (e.g. the spend/confirm controls). The validator flags `position`, `opacity:0`, `display:none`, and high `z-index` on protected anchors.
- **No `position: fixed`/`sticky` escapes** outside the regions that already use them in the default skin.

## Scoping & limits

- All skin CSS is applied **scoped to `[data-skin="<id>"]`** and may only target the published anchors (`data-region` / `data-part`). Selectors reaching internal class names are stripped.
- **Asset budget:** bundle size and per-asset size caps (enforced at build/publish). Fonts and images must be bundled, optimised, and within the cap.
- **CSP:** the client renders skins under a Content-Security-Policy that blocks remote fetches, inline scripts, and disallowed schemes, as a defence-in-depth backstop to the validator.

## Why no JS, ever

Allowing skin JavaScript would turn every skin into a full plugin with access to the renderer, the wallet, and the user's session. That is a categorically different trust model and a different review burden. Keeping skins purely declarative is what lets the marketplace accept community submissions at scale with an automated gate.
