# Phase 6 Handoff — Production Hardening

**Date:** 2026-06-12 · **Status:** Code complete; lint/typecheck/build verified; live sign-off pending (see "Outstanding" — it consolidates the Phase 3/4/5 gates, which have never been run, plus this phase's checks)
**Package runner:** bun (`bun run dev` / `bun run lint` / `bun run typecheck` / `bun run build` / `bun run analyze` / `bun run assets:og`)
**Architecture contract:** `docs/ENGINEERING_DESIGN.md` (§ references point there)
**Previous phases:** `docs/PHASE_1_HANDOFF.md` … `PHASE_5_HANDOFF.md`

## What Phase 6 delivered

The §11 Phase 6 layer — ship-readiness: WebGL context-loss recovery with a
static-tier fallback, a React error boundary around the stage with the same
fallback, the accessibility pass (skip link, nav focus management, aria
audit, remaining reduced-motion CSS gaps), SEO/OG/social meta with generated
share imagery and a branded favicon, product analytics + RUM (web-vitals +
an fps beacon, both §13 field-data feeds), and immutable-cache deploy
config for the common static hosts.

**Deliberate decisions/omissions:**
- **Annotations stay `aria-hidden`** (the §11 "label aria handling" item):
  their text duplicates information already present in each section's copy
  (waveguide → acoustics body, volume ring → detail body), so exposing them
  would be repetition, not information. Revisit only if a future annotation
  carries content the DOM copy doesn't.
- **No sitemap.xml** — single-URL site; canonical + robots.txt suffice.
- **No SSR/prerender** — the DOM story is client-rendered; meta/description/
  JSON-LD/noscript carry non-JS crawlers, and Google executes JS. Recorded
  as a future option, not a gap.
- **Still parked from earlier phases:** optional audio (Phase 4), real glTF
  swap-in (HeroModel + manifest are the only touch points).

## File inventory

| Path | Role |
|---|---|
| `src/stage/StageContextGuard.tsx` **(new)** | Context-loss listener on the canvas (inside the stage chunk, mounted outside the scene Suspense — a context can die during load). `webglcontextlost` → preventDefault (opts into browser restoration) + grace timer (3 s, **only while the page is visible** — backgrounded tabs lose contexts routinely and get them back on return). Restored → `bumpStageGeneration()`: the canvas **remounts** rather than resuming, because the render-once work (baked env map, frames=1 ContactShadows) comes back blank after a context swap; the stageReady round-trip rebuilds the Director's Layer 1 automatically. Grace expired → `setQualityTier('static')`: canvas unmounts through StageMount's existing gate, DOM story stands alone (§9). Both paths emit analytics (`stage_recovered` / `stage_fault`) |
| `src/app/StageErrorBoundary.tsx` **(new)** | Class boundary around the stage subtree: any render error (driver quirk, shader compile, bad future glTF) demotes to 'static' instead of unwinding to the root. Render errors are treated as deterministic — no retry, unlike context loss |
| `src/app/StageMount.tsx` (modified) | Wraps the lazy canvas in the boundary; `<StageCanvas key={stageGeneration}/>` is the remount mechanism |
| `src/state/store.ts` (modified) | `stageGeneration` + `bumpStageGeneration` (remount key, written once per recovered fault) |
| `src/systems/analytics/analytics.ts` **(new)** | Dependency-free event funnel: DEV console + `window.dataLayer` (GTM-style, zero-config) + optional `VITE_ANALYTICS_ENDPOINT` batched sendBeacon (flush on hide/pressure; events tracked while already hidden beacon immediately — web-vitals finalizes exactly then). Module-level once-latches survive StrictMode remounts. Pure module, importable from the stage chunk |
| `src/systems/analytics/useAnalytics.ts` **(new)** | Mounted in App: `chapter_reached` (once per chapter, from `currentChapter` — the §8-sanctioned boundary-frequency read), `scroll_depth` 25/50/75/100 (transient-store subscription; hot path is latched integer compares, zero allocation per §8), `quality_tier_changed` (every PerformanceMonitor decline / fault demotion becomes field data), idle-loads the RUM chunk, wires flush on hide/pagehide |
| `src/systems/analytics/rum.ts` **(new)** | Lazy chunk (idle-loaded): web-vitals LCP/CLS/INP/FCP/TTFB → `web_vital` events (CLS ×1000, GA convention; late registration is safe — buffered entries replay). fps beacon: frame durations from gsap.ticker (the app's single rAF) into a pre-allocated histogram → `fps_summary` (p95 fps, long-frame count, samples, tier) per hidden/pagehide, counters reset per report. Tier injected as a getter — importing the react store here would split a shared react chunk out of the shell (verified, see below) |
| `src/sections/CtaSection.tsx` (modified) | `cta_click` tracking on both buttons (+ focus `tabIndex={-1}`) |
| `src/ui/navigation.ts` **(new)** | `navigateToSection`: scroll via the engine, then focus the target section (`preventScroll` — the engine owns the travel). Focus is a DOM concern, so it lives beside the components, not in systems/scroll (§10) |
| `src/ui/SiteHeader.tsx`, `src/ui/ChapterIndicator.tsx` (modified) | Use `navigateToSection`; dots emit `aria-current="true"` only on the active dot (was a literal `"false"` on every other dot) |
| `src/app/App.tsx` (modified) | Skip link (first focusable, native anchor jump — instant, Lenis keeps native scroll); `<main id="main-content" tabIndex={-1}>`; mounts `useAnalytics` |
| `src/sections/HeroSection.tsx`, `StorySection.tsx` (modified) | `tabIndex={-1}` (focus targets for nav; accessible names already present) |
| `src/styles/global.css` (modified) | `.skip-link` (hidden until focused); `[tabindex='-1']:focus` outline suppression (programmatic targets — a viewport-sized ring is noise, the name is announced); reduced-motion audit gaps closed: `.stage` fade-in, `.chapters__dot`, `.skip-link` transitions stripped |
| `index.html` (rewritten head) | OG + Twitter cards, canonical, `Product` JSON-LD, apple-touch-icon link, noscript message. **`https://orbe.example.com` is a placeholder origin** — replace in 6 places at deploy (canonical, og:url, og:image, og:image stays in twitter:image + JSON-LD image) |
| `scripts/generate-og-image.mjs` **(new)** | Zero-dep share-imagery generator (`bun run assets:og`): per-pixel render of the ORBE (same light story as the stage — warm key, cool rim, machined ring, accent LED) + SDF-stroked wordmark, hand-encoded PNG (node:zlib, Up filter). Procedural because the hero is (PHASE_2); replace outputs + delete script when a real render exists |
| `public/og.png` (1200×630, 120 KB), `public/apple-touch-icon.png` (180×180, 14 KB) **(new, generated, committed)** | The share card and iOS icon |
| `public/favicon.svg` (replaced) | Was the untouched scaffold icon (purple bolt); now the ORBE mark (sphere + ring + LED on the token palette). `public/icons.svg` (unreferenced scaffold) deleted |
| `public/robots.txt` **(new)** | Allow all |
| `public/_headers`, `vercel.json` **(new)** | Immutable caching: `/assets/*` (fingerprinted by Vite) → `max-age=31536000, immutable`; HTML → `must-revalidate`; share imagery → 1 day. `_headers` covers Netlify/Cloudflare Pages; vercel.json covers Vercel. nginx equivalent: `location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }` + `location = /index.html { add_header Cache-Control "public, max-age=0, must-revalidate"; }` |
| `src/vite-env.d.ts` **(new)** | Types `VITE_ANALYTICS_ENDPOINT` (the project had no env augmentation file) |
| `package.json` (modified) | dep `web-vitals` 5.3.0; script `assets:og` |

## Verified facts (don't re-derive)

- `bun run lint`, `bun run typecheck`, `bun run build` all pass clean.
- **Bundle (vite 8.0.16, gz) — all §13 loading budgets still green:**
  shell **118.94 KB** (≤ 120 ✓, +0.86 over Phase 5 for analytics core +
  resilience + a11y; **only ~1 KB headroom remains** — next addition needs
  the bundle pass mindset); stage **243.94 KB** = StageCanvas 9.83 (+0.37,
  the context guard) + vendor 234.11 (≤ 250 ✓); StageEffects 17.89 KB own
  file (high tier only); **rum 2.66 KB own idle-loaded chunk**; CSS 2.21;
  HTML 0.99; 3D assets 0 bytes.
- **The rum chunk must not import the react store.** First build proved it:
  `useAppStore` in rum.ts made rolldown extract a shared `vanilla` chunk
  (react core, 3.31 KB gz) loaded at startup. The tier is injected as a
  getter instead; the shell is a single chunk again. Same trap applies to
  any future lazy module: check `bun run analyze` for surprise shared
  chunks.
- web-vitals 5.3.0 API verified against installed d.ts: `onCLS/onFCP/onINP/
  onLCP/onTTFB(cb)`, metric `{name, value, rating, delta, id,
  navigationType}`. No onFID in v5.
- zustand v5: `useAppStore.subscribe(listener)` receives `(state, prev)` —
  no selector middleware needed for the analytics diffing.
- Context-restore semantics: `webglcontextlost` must be preventDefault-ed or
  the browser never attempts restoration. Three.js survives a restore, but
  the app's render-once bakes (env map, contact shadows) do not — hence
  remount-by-key, not resume. The grace timer deliberately doesn't run while
  `document.visibilityState === 'hidden'`.
- `'requestIdleCallback' in window` narrows `window` to `never` in the else
  branch (lib.dom types it unconditionally) — probe with `typeof` instead.
  Safari still doesn't ship it; the setTimeout fallback is real.
- The OG/touch-icon PNGs are committed artifacts; `bun run assets:og`
  regenerates them deterministically (no randomness in the renderer).

## Outstanding — the consolidated live gate (needs `bun run dev` + real hardware)

**The Phase 3 gate (items 1–8), Phase 4 gate (items 1–7), and Phase 5 gate
(items 1–6) have never been run and all still apply.** Phase 6 adds:

1. **Context loss:** in the console, grab the canvas and run
   `const ext = document.querySelector('.stage canvas').getContext('webgl2').getExtension('WEBGL_lose_context'); ext.loseContext()`.
   Within 3 s (page visible) the page should demote to static — canvas gone,
   DOM story intact, backdrop at base color, nav falls back to DOM jumps,
   `stage_fault` in the DEV console. Repeat with `ext.restoreContext()`
   called within ~2 s of losing: the canvas should remount and fade back in
   with correct scrubbed pose and lighting (env map re-baked), with
   `stage_recovered` logged and **no** demotion. Verify no duplicate
   canvases/triggers after several loss/restore cycles.
2. **Error boundary:** temporarily `throw` inside StageScene → page shows
   the complete DOM story (no white screen), console shows the demotion,
   tier is static. Remove the throw.
3. **Accessibility sweep:** Tab from page load — skip link appears first and
   jumps to content; header nav / chapter dots move focus to the target
   section (verify with a screen reader: section name announced after nav);
   no focus ring on the sections themselves; focus visible everywhere else;
   `aria-current` only on the active dot. Reduced motion: canvas appears
   without fade; dots/skip-link don't transition. Heading order h1 → h2s.
4. **Analytics (DEV console):** chapter_reached fires once per chapter
   (re-scrolling doesn't re-fire); scroll_depth 25/50/75/100 latch; CTA
   clicks log; force a PerformanceMonitor decline → quality_tier_changed.
   RUM: web_vital events appear (LCP/FCP/TTFB soon after load; CLS/INP on
   tab hide); hide the tab → fps_summary with plausible p95. Optionally set
   `VITE_ANALYTICS_ENDPOINT` to a request bin and confirm batched beacons
   on hide.
5. **Social cards:** after the real origin replaces `orbe.example.com` in
   index.html, run the page through a card validator (opengraph.xyz /
   the X card validator) — image, title, description render.
6. **Browser matrix (§11):** Chrome, Safari, Firefox, Edge, iOS Safari,
   Android Chrome, Samsung Internet — zero console errors, scroll feel,
   color/tone-mapping parity, the §13 device rows. This was supposed to
   start in Phase 3; it is now the long pole of the gate.
7. **Deploy:** pick the host, confirm the matching config applies
   (`curl -I` the hashed asset → `immutable`; index.html → `must-revalidate`),
   then re-validate LCP/CLS rows from the field via the RUM events.

## State of the project

All six design phases (§11) are code-complete. What stands between this
build and "shippable" per §13 is exclusively *live verification*: the
consolidated gate above on the real device matrix, plus replacing the
placeholder origin. There is no known code debt beyond the parked items
(audio, real glTF) and the ~1 KB shell-budget headroom.
