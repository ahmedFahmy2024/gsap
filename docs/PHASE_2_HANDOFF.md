# Phase 2 Handoff — 3D Integration

**Date:** 2026-06-11 · **Status:** Code complete; lint/typecheck/build verified; visual sign-off pending (see "Outstanding")
**Package runner:** bun (`bun run dev` / `bun run lint` / `bun run typecheck` / `bun run build`)
**Architecture contract:** `docs/ENGINEERING_DESIGN.md` (§ references point there)
**Previous phase:** `docs/PHASE_1_HANDOFF.md` (all outstanding items closed: dead scaffold deleted, lint/typecheck pass, live validation done)

## What Phase 2 delivered

The persistent fixed canvas (§4) with the ORBE hero, premium static look —
no scroll choreography yet (that is Phase 3). One lazy-loaded R3F canvas at
`--z-stage` behind the DOM content, quality-tier gating, the named ref
registry (the Stage↔Director contract), idle float, and dev tooling.

**One deliberate deviation from §11 Phase 2:** there is no authored glTF
(no artist asset exists), so the hero is *procedural* — a sculpted sphere
enclosure, fabric grille cap, machined volume ring, emissive status LED,
and pedestal, lit by a Lightformer studio environment. The registry/anchor
contract is identical to what a glTF would expose; swapping in a real model
touches only `HeroModel.tsx` (+ manifest entry). Asset pipeline is in place
(`bun run assets:optimize`; KTX2 requires KTX-Software's `toktx` on PATH).

## File inventory (all new unless noted)

| Path | Role |
|---|---|
| `src/stage/StageCanvas.tsx` | **Lazy-chunk entry** (default export). Fixed full-viewport wrapper + `<Canvas>`: DPR clamp per tier, alpha, no shadow maps, R3F default sRGB+ACES (no `flat`). Hosts `StageReadySignal` (flips `stageReady` when Suspense commits → CSS fade-in) and `StageProgressBridge` (mirrors drei `useProgress` → app store so DOM chrome never imports drei) |
| `src/stage/StageScene.tsx` | Scene contents + responsive fit (scales hero composition to `viewport.width`, first cut of §5 normalized stage space) + render-once `ContactShadows` (frames=1) |
| `src/stage/CameraRig.tsx` | §3.4 rig: camera inside `cameraRig` group + separate `lookAtTarget`; per-frame `lookAt` with pre-allocated scratch Vector3. Registers both |
| `src/stage/Lighting.tsx` | Procedural studio env: `<Environment frames={1} resolution={tier}>` + 4 Lightformers (warm key, cool rim, accent kicker, bottom fill). No HDRI download, no real-time lights |
| `src/stage/HeroModel.tsx` | Procedural ORBE. Structure: `heroGroup` (registered; Director's scrub target) → `heroFloat` (registered; idle-float wrapper, §6 Layer 3) → meshes + anchors. Idle float: elapsed-based bob/roll, delta-based yaw (30 fps-safe, §12); fully parked under reduced motion. Anchors `anchor:ring`, `anchor:grille` registered (§7) |
| `src/stage/StageDevTools.tsx` | Dev-only lazy chunk: r3f-perf `<Perf>` + Leva panels (hero pose, camera rig) mutating **through the registry** with transient `onChange` — zero React renders while dragging |
| `src/stage/registry/registry.ts` | The only Stage↔Director contract (§3.3): `registerStageObject` (returns unregister → effect-cleanup symmetric), `getStageObject`, `listStageObjects`. Type-only `three` import, so the Director (main chunk) can import it without pulling Three.js |
| `src/app/StageMount.tsx` | The only import path into `stage/` — and it's `lazy()`. Returns null on `static` tier (§9: DOM story stands alone). Renders `StageLoadingBar` (real-progress 2px bar, CSS-delayed so fast loads never flash it) |
| `src/app/App.tsx` (modified) | `<StageMount />` at the Phase-1 marker comment |
| `src/systems/quality/quality.ts` | §3.8: `classifyQuality()` boot heuristic (WebGL probe; reduced-motion+saveData→static; deviceMemory/pointer/cores→medium/low) + `renderProfiles` (DPR clamp, env/shadow resolutions per tier). Pure module |
| `src/systems/assets/manifest.ts` | §3.7 manifest skeleton + budgets (4 MB total / 1.5 MB hero) + documented glTF pipeline for when the real model lands |
| `src/state/store.ts` (modified) | Added `qualityTier` (classified at boot), `stageReady`, `stageProgress` + setters to `useAppStore` |
| `src/styles/global.css` (modified) | `.stage` (fixed, `--z-stage`, pointer-events:none, fade-in on ready), `.stage-progress` bar |
| `package.json` (modified) | deps: three 0.184.0, @react-three/fiber 9.6.1, @react-three/drei 10.7.7; dev: @types/three, leva 0.10.1, r3f-perf 7.2.3, @gltf-transform/cli 4.4.0; script `assets:optimize` |
| `.claude/launch.json` | Preview launcher config (tooling only) |

## Verified facts (don't re-derive)

- `bun run lint`, `bun run typecheck`, `bun run build` all pass clean.
- Production build (vite 8.0.16): shell **113.85 KB gz** (budget ≤ 120 ✓);
  stage chunk **255.83 KB gz** (budget ≤ 250 — **5.8 KB over**, see
  Outstanding); CSS 1.78 KB gz; 3D file assets **0 bytes** (≤ 4 MB ✓).
  The rolldown ">500 kB chunk" warning refers to the *pre-gzip* lazy stage
  chunk — expected, it's the isolated 3D vendor chunk.
- `import.meta.env.DEV` gating confirmed working: leva/r3f-perf absent from
  the production output (no extra chunk emitted).
- Re-render discipline by construction: all per-frame work (`lookAt`, idle
  float) mutates refs in `useFrame`; the only stage-related store writes are
  one-shot (`stageReady`) or per-loader-file (`stageProgress`). `viewport`
  subscription re-renders only on debounced resize.
- R3F v9 defaults confirmed against docs: `dpr` default [1,2], ACESFilmic
  tone mapping unless `flat`, sRGB output unless `linear`, gl defaults
  antialias+alpha true.

## Outstanding (finish before starting Phase 3)

1. **Visual sign-off in the running dev server** (§11 Phase 2 gate):
   - Hero framing at 4 breakpoints (desktop, laptop, tablet portrait,
     phone portrait — plus landscape-phone per §12). The composition
     auto-scales below ~2.6 world-units of viewport width.
   - Idle float looks calm (bob 0.05, yaw drift 0.12 rad/s); LED reads as
     accent, clearcoat sweep visible; contact shadow grounds the object.
   - Canvas fades in once ready; loading bar never flashes on fast loads.
   - OS reduced-motion on → object renders *static* (no float), page fully
     usable; DevTools → WebGL off (or `qualityTier` forced 'static') →
     no canvas, complete DOM story.
   - React DevTools profiler during idle float → **zero renders**.
   - No console errors; no StrictMode/HMR double-canvas.
2. **Stage chunk is 5.8 KB gz over the 250 KB budget** — defer to Phase 5
   bundle pass unless it grows; first suspects are drei `Environment`'s
   unused HDR/EXR/gainmap loader paths.
3. Leva panel: drag hero/camera sliders → confirm mutation goes through the
   registry (object moves, no re-renders in profiler).

## Phase 3 starting point (§11 Phase 3 — Scroll Storytelling, *the heart*)

- Grow `src/story/sections.ts` into full scene descriptors (§5: object pose,
  camera pose, environment state, content bindings, annotations, responsive
  overrides — pure data) + descriptor validation.
- Director builds **Layer 1**: ONE master scrub timeline (`scrub: true`,
  never `scrub: 1` — Lenis already lerps, §6) from descriptors, tweening
  registry objects (`heroGroup`, `cameraRig`, `lookAtTarget`) — never
  `heroFloat`, which stays frame-loop-owned.
- Normalized stage-space resolution (replace StageScene's `fit` scalar),
  `gsap.matchMedia` responsive keyframes, function-based values +
  `invalidateOnRefresh` from the first tween.
- First annotation pass: drei `<Html>` on the registered `anchor:*` objects.
- `scrollToSection` nav already exists; extend to timeline labels.
- Gate: scrub any speed/direction → no pops; resize mid-scroll correct;
  ≥ 40 fps iPhone-12-class; new scene addable via descriptor alone.
