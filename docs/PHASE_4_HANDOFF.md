# Phase 4 Handoff — Advanced Effects

**Date:** 2026-06-12 · **Status:** Code complete; lint/typecheck/build verified; live sign-off pending (see "Outstanding" — note it still includes the Phase 3 gate)
**Package runner:** bun (`bun run dev` / `bun run lint` / `bun run typecheck` / `bun run build`)
**Architecture contract:** `docs/ENGINEERING_DESIGN.md` (§ references point there)
**Previous phases:** `docs/PHASE_1_HANDOFF.md` … `PHASE_3_HANDOFF.md` (Phase 3's live-choreography sign-off was still outstanding when Phase 4 began; it is folded into this phase's gate below)

## What Phase 4 delivered

The §11 Phase 4 layer: material/uniform choreography on the master timeline
(per-chapter color story + sheen "fresnel" rim accent), the tier-gated GPU
particle moment (the acoustics soundfield), a lazy post-processing chunk
(bloom/grain/vignette, high tier only), damped mouse-parallax on the camera
rig, and the magnetic CTA with hover micro-interactions.

**Deliberate omission:** optional audio (listed as "optional … behind
explicit user opt-in" in §11) was skipped — no audio asset exists for the
fictional product and it adds payload against an already-over stage budget.
Revisit post-Phase-5 if desired; the opt-in/autoplay-policy design in §11
still applies.

## File inventory

| Path | Role |
|---|---|
| `src/story/scenes.ts` (modified) | `EnvironmentState` grew from `{backdrop}` to the full color story: `led` (LED emissive, >1 = bloom fuel), `sheen`+`sheenColor` (physical-sheen rim accent — **must stay > 0 in every scene**, the shader compiles the sheen path only when sheen > 0 and crossing zero would recompile mid-scrub), `bodyEnv`/`ringEnv` (env-map intensities), `particles` (soundfield opacity 0–1, only non-zero in acoustics). Per-scene values authored for all 5 scenes |
| `src/story/validate.ts` (modified) | Validates the new environment fields (hex colors, ranges, the sheen-floor constraint) on base descriptors and responsive patches |
| `src/story/motion.ts` (modified) | New tokens: `ease.follow` (pointer-tracking), `ease.magnetic` (elastic spring-back), `duration.spring` |
| `src/stage/registry/registry.ts` (modified) | Second contract surface: **material handles** (`registerStageHandle`/`getStageHandle`, names `material:body\|ring\|led\|particles`, typed `Material` — still type-only three imports). Shares the object-registry notify channel |
| `src/stage/HeroModel.tsx` (modified) | Registers the three choreographed materials; initial material props now read `scenes[0].environment` (same trick as CameraRig's resting pose — pre-scroll frame ≡ scrubbed t=0 frame). Body gained `sheen`/`sheenColor`/`sheenRoughness`. Mounts `<SoundField/>` inside heroGroup (travels with the pose) but outside heroFloat (no per-bob matrix updates on 900 points) |
| `src/stage/SoundField.tsx` **(new)** | The particle moment: one `<points>` draw call, ellipsoid shell around the hero (lower hemisphere flattened to stay above the contact-shadow plane), additive blending. Tier-capped: high 900 / medium 450 / low+static 0 (component returns null). Positions from a seeded PRNG (mulberry32) — render-pure for the React Compiler and HMR-stable. Ownership split: Director scrubs `opacity` via `material:particles`; the frame loop owns rotation drift (delta-based, parked under reduced motion) and `visible` (derived from opacity, so the faded field costs no draw call for ~80 % of the page). **`raycast` is a no-op** — Points raycast with a 1-world-unit threshold by default and would falsely occlude the drei `<Html>` annotations |
| `src/stage/StageEffects.tsx` **(new)** | Post chunk (default export, own lazy file): `EffectComposer multisampling={4}` + `Bloom` (mipmapBlur, luminanceThreshold 1 — only HDR emitters glow, i.e. the LED) + `Noise premultiply` (grain lives in lit pixels, vanishes into the dark backdrop) + `Vignette`. On the alpha canvas the vignette grades rendered pixels only — the DOM backdrop is untouched (verify it reads strongly enough in sign-off) |
| `src/stage/StageCanvas.tsx` (modified) | Mounts the post chunk behind `qualityTier === 'high'` — the *chunk request itself* is tier-gated. Own `<Suspense>` outside the scene's, so a slow post download never delays `stageReady` |
| `src/stage/CameraRig.tsx` (modified) | §6 Layer-3 slot filled: damped mouse parallax on a dedicated `parallax` group INSIDE the rig — Director owns `rig.position`, frame loop owns `parallax.position`, transforms compose structurally (§8 one-writer). `MathUtils.damp` (frame-rate-independent), extents ±0.1/±0.06 world units; lookAt runs after the offset so the result is a subtle orbit around the focal point. Parked (snapped to 0) under reduced motion |
| `src/state/store.ts` (modified) | `transientStore` gained `pointerX/pointerY` (viewport-normalized −1…1, +y up to match world space) — the §8 "pointer position" slot |
| `src/hooks/usePointerSync.ts` **(new)** | Window pointermove → transient store. Mouse pointer-type only (touch pointermoves are scroll gestures; a parallax tracking them would fight the scrub). Resets to 0 on cleanup |
| `src/systems/director/director.ts` (modified) | `StageTargets` grew the four material handles (resolved via `getStageHandle`, all optional — a tier with no particles registers no handle and the tween is simply skipped). `addPoseTweens` and `applyRestingPose` now drive the environment story: sheen/bodyEnv, sheenColor, ringEnv, led, particle opacity, all on the same scrub with the same ease/position as the pose. **`linearRgb()`**: sRGB-hex → linear-space r/g/b in pure math (three stores material colors in linear working space; the Director can't value-import three, §3.3) |
| `src/ui/MagneticButton.tsx` **(new)** | Magnetic CTA: three persistent `gsap.quickTo` tweens (x, y with `ease.magnetic`; scale with `ease.follow`), created inside `useGSAP` (`dependencies: [reducedMotion]`, `revertOnUpdate`) so inline transforms revert on unmount/flip. Follow AND release retarget the same tweens — no property ever has two writers. Pointer math reads the untransformed wrapper span for a stable attraction origin. Mouse-only; plain button under reduced motion |
| `src/sections/CtaSection.tsx` (modified) | Both CTA buttons are now `MagneticButton`s |
| `src/app/App.tsx` (modified) | Mounts `usePointerSync` |
| `src/styles/global.css` (modified) | Buttons gained a hover shadow-lift; `.button--magnetic:hover { transform: none }` (GSAP owns transform — prevents the 2 px CSS-lift snap on first pointermove); `.magnetic` wrapper; reduced-motion strips button transitions |
| `src/stage/StageDevTools.tsx` (modified) | New Leva `materials` folder (led/sheen/sheenColor/bodyEnv/ringEnv) mutating through `getStageHandle` — same tune-while-stationary → copy-into-descriptor workflow as poses |
| `package.json` (modified) | dep: `@react-three/postprocessing` 3.0.4 (pulls `postprocessing` 6.39.1) |

## Verified facts (don't re-derive)

- `bun run lint`, `bun run typecheck`, `bun run build` all pass clean.
- Bundle (vite 8.0.16, gz): shell **117.89 KB** (≤ 120 ✓, +1.6 over Phase 3
  for pointer/magnetic/director additions); stage **260.71 KB**
  (StageCanvas 26.55 + shared three/R3F vendor 234.16; budget 250, was
  258.70 — overage still deferred to the Phase 5 bundle pass, suspects
  unchanged); **post chunk 17.88 KB as its own file**, requested only on
  the high tier (it shares the stage's vendor chunk); CSS 2.06 KB.
  Dev tools (leva/r3f-perf) still absent from production output.
- `@react-three/postprocessing` 3.x is the R3F-v9-compatible line
  (3.0.4 installed); `EffectComposer/Bloom/Noise/Vignette` imports and the
  props used were checked against current docs.
- React Compiler lint constraints honored: no `Math.random` in render
  (seeded PRNG), no `contextSafe()` calls during render closing over refs
  (quickTo refs are populated inside the `useGSAP` callback instead).
- Color-space note: a hex assigned to a three material color is converted
  sRGB→linear on assignment; GSAP tweens raw `r/g/b` channels, so the
  Director converts tween *targets* with the same transfer function
  (`linearRgb`). Tweening toward raw sRGB fractions would overshoot bright.
- Three only compiles the physical-material sheen path while `sheen > 0`
  — that is why the validator enforces the floor and `restingEnv.sheen`
  seeds the material non-zero (program compiles once, at first render).
- `THREE.Points` default raycast uses a ~1-unit threshold; without the
  no-op `raycast` override the soundfield intersects the annotation
  occlusion rays and the labels flicker off.

## Outstanding — the live gate (needs `bun run dev`)

The Phase 3 gate (its handoff §"Outstanding", items 1–8: scrub integrity,
choreography at 5 breakpoints, resize mid-scroll, annotations, nav,
reduced motion, performance, throwaway-scene process check) **was never
run and still applies**. Phase 4 adds:

1. **Color story:** scrub the full page — backdrop, sheen tint, LED
   intensity, ring/body env all crossfade with the pose; slam the scrollbar
   to random positions → mood is always correct for the location; the
   pre-scroll frame is identical to the scrubbed top-of-page frame.
2. **Soundfield:** materializes through acoustics, gone by detail; rides
   the hero's travel; gentle drift; no label-occlusion flicker while it is
   visible (the raycast opt-out at work); r3f-perf draw-call count drops
   by one when the field fades out (`visible` gating).
3. **Post (high tier only):** LED blooms; grain visible in lit body pixels
   but not over the DOM backdrop; vignette grades the object acceptably
   (it cannot darken the transparent corners — if the page needs corner
   vignetting, that's a CSS gradient on `.backdrop`, decide at sign-off);
   forcing `medium` tier in quality.ts → no StageEffects network request.
4. **Parallax:** mouse drift gently orbits the framing on top of the scrub
   at every scroll position; zero on touch; zero under reduced motion;
   no fighting with nav scrollTo landings.
5. **Magnetic CTA:** buttons lean toward the cursor, spring back
   elastically on leave, scale on hover; no transform snap on hover-enter
   (the CSS-lift override); keyboard focus ring intact; plain buttons
   under reduced motion; no stuck offsets after rapid enter/leave.
6. **Tier sweep:** `static` → no canvas, full DOM story (unchanged);
   `low` → no particles, no post, choreography + color story intact.
7. **Profiler:** still zero React renders during scrub/idle/parallax/
   magnetic hover (all of Phase 4 writes through refs/quickTo/transient
   store); annotation toggles and chapter crossings remain the only blips.

## Phase 5 starting point (§11 Phase 5 — Optimization)

- **Bundle pass (now 10.7 KB gz over on the stage chunk):** first suspects
  remain drei `Environment`'s unused HDR/EXR/gainmap loader paths; also
  audit what `maath` pulls in via @react-three/postprocessing and whether
  the post chunk can share less/more with the vendor chunk.
- drei `PerformanceMonitor` → live tier degradation through
  `setQualityTier` (the store and gates are already wired; degradation
  must also unmount StageEffects — it already will, it reads the tier).
- Annotation Tier-2 projection pool if `Html` shows in profiles (§7).
- `frameloop="demand"` evaluation; memory soak (10-min scroll loop);
  texture/LOD finalization if a real glTF lands; loading-screen polish.
- §13 success-criteria table measured on real hardware.
