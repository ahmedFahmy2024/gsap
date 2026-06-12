# Phase 5 Handoff — Optimization

**Date:** 2026-06-12 · **Status:** Code complete; lint/typecheck/build verified; live sign-off pending (see "Outstanding" — it still carries the Phase 3+4 gates, which have never been run)
**Package runner:** bun (`bun run dev` / `bun run lint` / `bun run typecheck` / `bun run build` / `bun run analyze`)
**Architecture contract:** `docs/ENGINEERING_DESIGN.md` (§ references point there)
**Previous phases:** `docs/PHASE_1_HANDOFF.md` … `PHASE_4_HANDOFF.md`

## What Phase 5 delivered

The §11 Phase 5 layer: the bundle pass (every §13 loading budget is now
green — the stage chunk was 10.7 KB gz over), live quality-tier degradation
via drei `PerformanceMonitor`, the `frameloop="demand"` evaluation (decision:
keep `always`, reasoning recorded in code), loading-bar exit polish, the
annotation Tier-2 decision (stay on Tier 1), and a permanent
bundle-composition analyzer (`bun run analyze`).

**Deliberate omissions:** texture/LOD finalization (no authored glTF exists —
the hero is still procedural, so there is nothing to compress or LOD); the
memory soak and the §13 device-matrix measurements need a running browser and
real hardware, so they are folded into the live gate below, not skipped.

## File inventory

| Path | Role |
|---|---|
| `src/stage/Lighting.tsx` (rewritten) | **The bundle fix.** drei `<Environment frames={1}>` statically imports its file-loading paths — EXRLoader + fflate, RGBELoader, gainmap-js, GroundProjectedEnv, ~196 KB pre-min / **17.1 KB gz of dead code** for a procedural rig. Replaced with a module-level `createStudioEnvironment()` replicating drei's exact render path (verified against drei's `EnvironmentPortal`/`Lightformer` sources): the same four lightformer specs as data → meshes (`MeshBasicMaterial`, `toneMapped:false`, DoubleSide, color×intensity, `lookAt` origin; plane / `RingGeometry(0.25, 0.5, 64)`) rendered once into a HalfFloat `WebGLCubeRenderTarget` via `CubeCamera(0.1, 1000)` with the same autoClear dance, assigned to `scene.environment`, previous environment restored + fbo disposed on cleanup (StrictMode-symmetric). Imperative work lives in the module function because the React Compiler's immutability rule (correctly) refuses `gl`/`scene` mutation inside the component |
| `src/stage/StagePerformance.tsx` **(new)** | Live tier degradation (§3.8): drei `PerformanceMonitor` (self-contained, React+useFrame only), `onDecline` steps the tier down through `setQualityTier` — high→medium→low, **floored at low** (mid-session demotion to 'static' would yank the canvas, a UX cliff; 'static' stays a boot classification and the Phase 6 context-loss fallback). Degrade-only per §9 — no `onIncline`, and the design's DPR-upgrade exception is deliberately not taken (the Canvas dpr prop derives from the tier; no second writer). A decline = ~2.5 s sustained below bounds (40 fps native / 60 on >100 Hz displays — aligned with §13). Callback reads the store via `getState()` (frame-loop context, max one write per sampling window) |
| `src/stage/StageCanvas.tsx` (modified) | Mounts `<StagePerformance/>` only once `stageReady` — load-time jank (shader compiles) can never trigger a premature decline. The frameloop comment now records the Phase 5 **decision: keep `always`** — the idle float renders every visible frame by design so `demand` saves nothing; hidden tabs already cost zero (parked rAF stops gsap.ticker and the R3F loop together); the one truly-static case (reduced motion) would need Director→`invalidate()` coupling across the chunk boundary (§10 violation) for a cohort §13 doesn't measure |
| `src/app/StageMount.tsx` (modified) | Loading-bar exit polish: on `stageReady` the bar fills to 100 % and fades out before unmounting (750 ms) instead of vanishing mid-sliver. Reduced motion exits instantly — derived at render, not stored; the only setState is in the timer callback (compiler `set-state-in-effect` rule) |
| `src/styles/global.css` (modified) | `.stage-progress--done` exit: a CSS **animation**, not a transition, so it starts from the entrance animation's current opacity — a bar still inside its 0.4 s appear-delay exits invisibly (no flash). The entrance stays in the animation list (same name = timeline preserved; dropping it would lose its `forwards` fill and snap a visible bar to 0). Reduced motion: appear-delay kept, fades stripped |
| `src/sync/StageAnnotations.tsx` (comment) | Tier-2 decision recorded: Tier 1 stays (2 labels vs the ~6-label ceiling); the §7 projection pool gets built only if `Html` shows in real-hardware profiles during the live gate |
| `src/systems/quality/quality.ts` (comment) | Header updated: runtime degradation now exists (StagePerformance), degrade-only, floored at 'low' |
| `scripts/analyze-bundle.mjs` **(new)** | Bundle-composition report: groups each chunk's sourcemap bytes by package so budget regressions name their culprit. Pre-minification sizes — inclusion/ranking signal, not gz truth |
| `package.json` (modified) | `analyze` script (`vite build --sourcemap` + the report). No dependency changes |

## Verified facts (don't re-derive)

- `bun run lint`, `bun run typecheck`, `bun run build` all pass clean.
- **Bundle (vite 8.0.16, gz) — every §13 loading budget green:**
  shell **118.08 KB** (≤ 120 ✓); stage **243.57 KB** = StageCanvas 9.46
  (was 26.55) + shared three/R3F vendor 234.11 (budget 250 ✓, was 260.71 —
  the −17.1 KB is exactly the dead Environment loader code); post chunk
  **17.89 KB** own file, requested only on high tier; CSS 2.11 KB; 3D asset
  files 0 bytes (≤ 4 MB ✓). Dev tools still absent from production output.
- Post-fix `bun run analyze` shows the StageCanvas chunk contains only live
  code: drei `Html` 14.4 KB pre-min (annotations), `ContactShadows` 4.5,
  app files. The **maath audit** from the Phase 4 handoff closes as
  no-action: maath lands only in the StageEffects chunk (via
  @react-three/postprocessing), never in the shared vendor chunk — folding
  post into vendor would make every tier pay for it, so the current chunk
  boundary is correct.
- Lighting parity is by construction: the replacement was written against
  drei's `EnvironmentPortal` (frames=1 branch) and `Lightformer` sources —
  same target type, camera args, autoClear handling, material semantics,
  geometry args, and lookAt order. The env map should be pixel-identical;
  eyeball it at sign-off anyway (first item below).
- Tier-flip self-healing downstream of `setQualityTier` (checked against
  drei sources): `ContactShadows` re-creates its render targets and re-bakes
  once when `resolution` changes (512→256 at high→medium; no re-render
  medium→low since both are 256); the env map rebuilds one-shot via
  `Lighting`'s effect deps (256→128 only at medium→low); R3F applies `dpr`
  prop changes reactively; StageEffects unmounts via its existing tier gate
  (composer disposed). SoundField count change rebuilds geometry; at low it
  unmounts and unregisters `material:particles` — the master timeline's
  particle tween then writes to a detached material (harmless), and the
  next story rebuild (resize/breakpoint) re-resolves handles and simply
  skips the missing one (all handles optional by design).
- drei `PerformanceMonitor` decline semantics: 10 × 250 ms fps averages;
  decline fires when > 75 % of a window is below the lower bound; averages
  reset per window, so consecutive declines (high→medium→low) are ≥ ~2.5 s
  apart. It mutates a plain api object per frame — zero React renders;
  the only store write is the decline itself.

## Outstanding — the live gate (needs `bun run dev`)

**The Phase 3 gate (its handoff, items 1–8) and the Phase 4 gate (its
handoff, items 1–7) have still never been run and all apply.** Phase 5 adds:

1. **Lighting parity:** the studio reflections (warm key clearcoat sweep,
   cool rim, accent kicker, bottom fill) look unchanged from the Phase 4
   build — the Environment replacement should be invisible.
2. **Loading bar:** DevTools → slow 4G: bar fades in after ~0.4 s, tracks,
   then fills to 100 % and fades out when the canvas commits (no mid-sliver
   cut). No throttle: bar never appears. Reduced motion: appears without
   fade after the same delay, exits instantly.
3. **Tier degradation:** force sustained low fps (DevTools CPU throttle
   ×6+, or temporarily raise the bounds in StagePerformance) →
   high→medium after ~2.5 s: StageEffects unmounts (LED stops blooming),
   soundfield halves, DPR visibly drops; sustained → medium→low:
   soundfield gone, env re-bakes at 128; **never** drops below low, never
   climbs back. Profiler: each decline is one discrete render blip, none
   per-frame. Starting forced at `medium`: no StageEffects network request
   ever fires (chunk gate intact after the StagePerformance addition).
4. **Memory soak (§13):** 10-minute scroll loop — no monotonic JS-heap or
   VRAM growth (Performance monitor + `gl.info`), no iOS Safari tab reload.
5. **§13 device matrix on real hardware:** desktop p95 ≥ 58 fps; iPhone
   12 / Pixel 6-class p95 ≥ 40 fps; zero >50 ms frames per full scroll;
   input latency ≤ 50 ms; LCP ≤ 2.5 s on 4G; CLS < 0.1. The loading rows
   are green by construction (build output above); record the rest with
   numbers in this file when measured.
6. **Annotation profiling:** while doing item 5, check whether drei `Html`
   shows in profiles — that (or label growth past ~6) is the only trigger
   for building the §7 Tier-2 projection pool.

## Phase 6 starting point (§11 Phase 6 — Production Hardening)

- WebGL context-loss listener → recovery or graceful demotion to the
  static tier; React error boundaries around the stage with the same
  fallback (the DOM story already stands alone).
- Full reduced-motion experience audit; semantic/heading audit, focus
  management, `aria` for annotations (currently `aria-hidden` decorative).
- SEO/meta/OG + share imagery; analytics (chapter-reached via
  `currentChapter`, scroll depth, CTA clicks); RUM (web-vitals + fps
  beacon — the §13 table wants field data, not just lab).
- Browser matrix pass (Chrome/Safari/Firefox/Edge, iOS Safari, Android
  Chrome, Samsung Internet); deploy pipeline with immutable asset caching.
- Still parked: optional audio (Phase 4 omission — no asset, opt-in design
  in §11 applies if revived); real glTF swap-in (HeroModel + manifest are
  the only touch points; rerun texture/LOD + budget checks when it lands).
