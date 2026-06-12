# Phase 3 Handoff — Scroll Storytelling

**Date:** 2026-06-12 · **Status:** Code complete; lint/typecheck/build verified; live choreography sign-off pending (see "Outstanding")
**Package runner:** bun (`bun run dev` / `bun run lint` / `bun run typecheck` / `bun run build`)
**Architecture contract:** `docs/ENGINEERING_DESIGN.md` (§ references point there)
**Previous phases:** `docs/PHASE_1_HANDOFF.md`, `docs/PHASE_2_HANDOFF.md` (Phase 2 outstanding item #1 — visual sign-off — was absorbed into this phase's gate; #2 bundle overage remains deferred to Phase 5)

## What Phase 3 delivered

The heart (§11 Phase 3): scroll choreography end-to-end. Scenes are now full
**data descriptors** (§5) interpreted by the Director into **Layer 1** — one
master scrub timeline driving heroGroup / cameraRig / lookAtTarget / camera
fov / page backdrop through the registry — plus the existing Layer-2 reveals,
annotation visibility windows, `gsap.matchMedia` responsive rebuilds,
normalized stage-space resolution, the first drei `<Html>` annotation pass,
and label-aware nav. The page now plays as one continuous camera move:
hero → object glides left (seamless back) → right (grille forward) → close-up
on the volume ring → heroic return at the CTA.

## File inventory

| Path | Role |
|---|---|
| `src/story/scenes.ts` **(new)** | §5 scene descriptors: types + 5 scenes (hero pose, camera pose, environment, transition hold/ease, contentRevealAt, annotations, responsive patches for tablet/mobile/landscapePhone) + `stageSpace` reference constants + `breakpointQueries`/merge order + `allAnnotations` union. Pure data |
| `src/story/validate.ts` **(new)** | Pure structural validation (id uniqueness, chapter alignment, ranges, ease tokens). Director runs it in DEV and `console.warn`s |
| `src/systems/director/director.ts` (rewritten) | Builds everything inside ONE `gsap.matchMedia` handler: chapter tracking, Layer-2 reveals (start from `contentRevealAt`), annotation windows (numeric function-based start/end over section traversal → `setAnnotationVisible`), and — once `stageReady` — **Layer 1**: master timeline padded to duration 1 so time == scroll progress, scene labels at section-centered anchors, pose tweens with function-based normalized-stage-space values + `invalidateOnRefresh`, scrub value from the scroll engine, backdrop color tweens, fov tween with `updateProjectionMatrix`. Registers the label resolver; reduced-motion gets a static hero-scene pose instead. `ScrollTrigger.sort()` after each build. Returns a cleanup (label resolver, annotation flags) that the gsap context invokes on revert |
| `src/systems/director/useDirector.ts` (modified) | Deps now `[reducedMotion, stageReady]` — the story rebuilds the moment the lazy stage chunk commits |
| `src/systems/scroll/scroll-engine.ts` (modified) | `getMasterScrub()` — the §6 asymmetry encoded here: `true` (exact) with fine pointer because Lenis already lerps; `0.5` on coarse pointer where touch momentum is native. `setLabelResolver` + label-first `scrollToSection` (falls back to DOM section); engines accept numeric scroll targets |
| `src/state/store.ts` (modified) | `visibleAnnotations: string[]` + `setAnnotationVisible` (no-op-safe) / `clearAnnotations`. Boundary-cross frequency, per §8 |
| `src/stage/registry/registry.ts` (modified) | Added `'camera'` name (fov tweens only — pose always goes through rig+target, §3.4) and a change subscription (`subscribeStageObjects` / `getStageRegistryVersion`) so React consumers resolve objects via `useSyncExternalStore` |
| `src/sync/StageAnnotations.tsx` **(new)** | §7 Tier-1 annotation layer: portals a drei `<Html occlude>` label into each registered anchor. Visibility = Director's store flag ∧ not occluded; `onOcclude` feeds component state so CSS fades instead of drei's hard display toggle. Rendered by StageScene (inside the Canvas — lives in `sync/` as the DOM↔3D bridge) |
| `src/stage/StageScene.tsx` (rewritten) | Now static composition only. The Phase-2 `fit` scalar is gone — the Director resolves responsive scale/placement from descriptors |
| `src/stage/CameraRig.tsx` (modified) | Registers the camera; resting pose/fov come from `stageSpace` so the rig and the stage-space basis can never drift apart |
| `src/stage/HeroModel.tsx` (modified) | Owns the ContactShadows now, **inside heroGroup** (outside heroFloat): the baked shadow travels and scales with the choreographed pose — this is also why descriptor rotation is yaw-only (pitch/roll would tilt the ground plane). Float yaw changed from unbounded drift to bounded sway (±0.06 rad): Phase 3 authors specific yaw framings and pins annotations to physical points; unbounded drift would walk both away. Bob/yaw/roll all elapsed-based (30 fps-safe, §12) |
| `src/app/App.tsx` (modified) | `[data-backdrop]` fixed div before `<StageMount/>` — the §5 environment state, first cut: the Director tweens its background color per scene (works in static tier as a no-op, stays base color) |
| `src/styles/global.css` (modified) | `.backdrop`, `.annotation` (pill label, fade + y-drift, `visibility` gating, reduced-motion kills transitions) |

## Verified facts (don't re-derive)

- `bun run lint`, `bun run typecheck`, `bun run build` all pass clean.
- Bundle (vite 8.0.16): shell **116.34 KB gz** (≤ 120 ✓, +2.5 KB for
  director+descriptors); stage chunk **258.70 KB gz** (budget 250 — was 255.83
  in Phase 2; the +2.9 KB is drei `Html`. Still deferred to the Phase 5 bundle
  pass; first suspects unchanged: drei Environment's unused loader paths).
- Verified against cached sources (`opensrc path gsap` / `@gsap/react` /
  `@react-three/drei`):
  - `ScrollTrigger.prototype.labelToScroll(label)` exists (returns 0 for
    unknown labels — the resolver checks `id in timeline.labels` first).
  - `end: 'max'` is a supported keyword with post-refresh correction.
  - A `gsap.matchMedia()` created inside `gsap.context()` is pushed into the
    context's data and reverted with it; functions returned from a context
    callback are collected (`_r`) and invoked on revert — this is what makes
    `buildStory`'s cleanup-return work under `useGSAP`.
  - drei `Html`: when `onOcclude` is provided it is called *instead of* the
    built-in `display` toggle; plain `occlude` raycasts against the whole
    scene.
- Timeline geometry: master trigger spans `start: 0 → end: 'max'`; the
  timeline is padded to exactly 1s (`tl.to({}, {duration: 0}, 1)`) so tween
  positions/labels are document scroll-progress fractions. Scene anchors
  (section centered in viewport) are measured per build from layout offsets
  (`offsetTop` chain — no scroll reads). Pose *values* re-resolve on every
  refresh (function-based + `invalidateOnRefresh`); anchor *positions* are
  stable because all sections are viewport-proportional (min-100svh). If a
  section ever gets content-driven height, rebuild-on-refresh needs revisiting.
- Normalized stage space needs no Three.js at resolve time: world rect at
  z=0 is derived from `stageSpace.referenceDistance/Fov` + window aspect.
  The basis deliberately ignores the scrubbed camera so fractions stay
  deterministic mid-travel.
- Yaw choreography is plain numeric `rotation.y` (0 → π → 2π → 2π+0.85 → 2π):
  no quaternions, no flips, scrub-reversible by construction.

## Outstanding (the §11 Phase 3 gate — needs the dev server)

Run `bun run dev` and check:

1. **Scrub integrity:** scroll fast/slow/reverse through the whole story —
   object pose is always a pure function of scroll position; no pops at any
   boundary; backdrop tint crossfades smoothly; flick-scroll then slam the
   scrollbar to a random position → correct pose.
2. **Choreography reads well** at desktop/laptop/tablet-portrait/phone +
   landscape phone (descriptor `responsive` patches: object centers on
   mobile, copy overlays). Tune poses via Leva, copy values back into
   `story/scenes.ts` (note: while the master scrub is active, any scroll
   re-asserts the scrubbed pose over Leva edits — tune while stationary).
3. **Resize mid-scroll** (incl. DevTools device-mode rotate): correct framing
   after refresh; crossing a breakpoint rebuilds via matchMedia; no duplicate
   triggers after HMR edits (StrictMode on).
4. **Annotations:** waveguide label during acoustics, ring label during
   detail; fade+drift in/out at their visibleRange edges; occlusion hides
   them when the anchor rotates behind the body; labels never cover DOM copy;
   none on landscape phones.
5. **Nav:** header links + chapter dots land each scene at its settled pose
   (timeline labels); reduced-motion/static falls back to DOM jumps.
6. **Reduced motion (OS toggle):** zero scroll-driven motion; object renders
   in static hero framing; annotations still appear/disappear without
   transitions; full content readable. Static tier (WebGL off): complete DOM
   story, backdrop stays base.
7. **Performance:** React DevTools profiler — zero renders during scrub
   (annotation toggles/chapter crossings are the only sanctioned blips);
   r3f-perf ≥ 60 fps desktop through the full story; ≥ 40 fps on an
   iPhone-12-class device (real hardware).
8. **Process check:** add a throwaway scene 6 (descriptor + DOM section) —
   it should choreograph with zero system changes, in under an hour.

## Phase 4 starting point (§11 Phase 4 — Advanced Effects)

- Material/uniform choreography on the master timeline (color story, fresnel
  accent) — extend `EnvironmentState`/descriptors, tween through the registry
  (register material handles or a uniforms proxy).
- GPU particle moment (instanced/points, capped, tier-gated).
- Post-processing chunk (`@react-three/postprocessing`: bloom/vignette/grain)
  lazy-loaded only when `qualityTier` permits — every effect lands with its
  tier gate in the same PR.
- Mouse-parallax camera offset: damped additive offset in CameraRig's
  `useFrame` on top of the scrubbed rig pose (the §6 Layer-3 slot is ready).
- Magnetic CTA + hover micro-interactions; optional audio behind opt-in.
- Keep watching the stage-chunk budget; Phase 5 owns the bundle pass.
