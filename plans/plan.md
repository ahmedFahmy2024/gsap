# Engineering Design Document — Premium 3D Scroll-Storytelling Landing Page

**Status:** Pre-implementation design · **Audience:** Senior engineering team
**Stack:** React 19 · Vite 8 (rolldown) · TypeScript · GSAP 3.13+ · ScrollTrigger · React Three Fiber v9 · Three.js

---

## Context

The repo (`gsap-scroll`) is a fresh Vite 8 + React 19.2 scaffold with the React Compiler babel plugin enabled and `@gsap/react` (the `useGSAP` hook) already installed. Nothing else exists yet — no `gsap` core, no `three`, no R3F. The goal is an Awwwards-caliber landing page: a single hero 3D object that lives on a fixed canvas and moves, rotates, scales, and re-frames itself as the user scrolls through narrative DOM sections, in the style of Apple product pages, Nike ISPA, Stripe, and Linear.

This document is the implementation contract: architecture, system boundaries, rendering strategy, risks, phased roadmap, and measurable success criteria. No code is specified here — only design.

**Dependencies to add when implementation begins:**

| Package | Why |
|---|---|
| `gsap` (3.13+) | Core tween engine. All plugins (ScrollTrigger, ScrollSmoother, SplitText) are free since the Webflow acquisition. |
| `three`, `@react-three/fiber@^9` | R3F v9 is the React 19–compatible line. |
| `@react-three/drei` | Loaders, `Environment`, `ContactShadows`, `Html`, `PerformanceMonitor`, `Preload`. |
| `lenis` | Smooth scroll (recommended over ScrollSmoother — see §6). |
| `zustand` | Cross-tree shared state with transient (non-rendering) reads. |
| `leva`, `r3f-perf`, `stats-gl` (dev) | Tuning panels and frame profiling during development. |
| `@react-three/postprocessing` (Phase 4) | Bloom/DoF, gated by quality tier. |
| `@gltf-transform/cli` (build tooling) | Asset pipeline: Draco/Meshopt + KTX2 compression. |

---

## 1. Product Vision

### The experience

The page is not a sequence of sections the user reads — it is a **single continuous camera move through a story**, where scroll position is the playhead. One hero object (the product) is always on stage. As the user scrolls:

1. **Hero** — the object floats center-stage, slowly idling (rotation drift, subtle bob). Headline type reveals around it.
2. **Feature chapters** — the object glides to one side, rotates to present a specific face, scales to show detail; copy enters on the opposite side. Floating annotations pin to physical points on the model.
3. **Detail / exploded moment** — camera pushes in close; lighting shifts; material or color story plays.
4. **Closing / CTA** — the object returns to a heroic framing; the page resolves to a conversion moment.

### What the user should feel

- **Weight and physicality.** The object never teleports or cuts. Every transition is a continuous, eased motion — scroll inertia carries the object like it has mass.
- **Authorship.** Scrolling feels like operating a camera dolly someone choreographed, not like flipping pages. Scrubbing backwards replays the story in reverse perfectly.
- **Calm confidence.** Apple/Linear restraint: few elements, generous negative space, type that arrives precisely when the 3D motion settles. No motion competes with another.
- **Responsiveness.** Input latency under ~50 ms between scroll gesture and visual response; nothing ever stutters during a transition.

### Why this is different from a traditional landing page

A traditional page is a vertical document with decorations. Here, the DOM document becomes a **scroll-length track**, and the real subject — the 3D object and camera — lives outside that document on a fixed stage. DOM and WebGL are two synchronized projections of one underlying timeline. That inversion (timeline first, sections second) is the core architectural idea, and everything below follows from it.

---

## 2. Technical Architecture

### Responsibility matrix

| Technology | Owns | Explicitly does NOT own |
|---|---|---|
| **React 19** | Component tree, DOM structure, routing, mounting/unmounting systems, accessibility tree, low-frequency UI state (modals, loaded flags, quality tier) | Any per-frame value. React must never re-render because the user scrolled. |
| **GSAP** | All animated values over time: object transforms, camera pose, material uniforms, DOM reveals. Easing, sequencing, the master timeline. The single source of truth for "where is everything at progress *p*". | Layout, rendering, scroll measurement of 3D viewport sizing. |
| **ScrollTrigger** | Mapping scroll position → timeline progress; section enter/leave detection; pinning; refresh on resize. The bridge between user input and GSAP. | The animations themselves (it scrubs timelines, it doesn't define them). |
| **React Three Fiber** | Declarative scene graph construction, resource lifecycle (Suspense loading, disposal on unmount), the render loop (`useFrame`), canvas/viewport management, React 19 integration. | Animation timing. R3F renders; GSAP decides values. |
| **Three.js** | The actual rendering: meshes, materials, lights, shaders, cameras, render targets, post-processing. Imperative escape hatch for per-frame mutation via refs. | — |

### Why each technology

- **React 19 + Vite**: instant HMR for iteration-heavy creative work; React 19 because R3F v9 targets it and Suspense-driven asset loading is first-class. The React Compiler (already configured) removes manual memoization concerns in the DOM layer — but mutation-heavy 3D code stays in refs/`useFrame`, where the compiler is irrelevant by design.
- **GSAP over alternatives** (Framer Motion, springs, raw rAF): GSAP timelines are *scrub-able* — deterministic functions of progress. Spring systems are stateful and can't be reversed/scrubbed deterministically, which breaks scroll-driven storytelling. GSAP's label system, nesting, and `matchMedia` are built for exactly this. Since 3.13 the entire plugin ecosystem is free for commercial use.
- **ScrollTrigger over IntersectionObserver/raw scroll listeners**: handles pinning, resize refresh, scrub smoothing, ordering, and bidirectional toggling — re-implementing this reliably is multi-week work.
- **R3F over raw Three.js**: scene-as-components means scenes can be code-split, suspense-loaded, and composed; the ecosystem (drei) covers 80% of boilerplate. Raw Three.js would force us to hand-build resource lifecycle management that R3F gives for free.

### The one rule that makes the stack coherent

> **GSAP animates values. Three.js objects are mutated through refs. React never sees per-frame data.**
>
> ScrollTrigger scrubs a timeline → the timeline writes to Three.js object properties (or proxy objects) directly → R3F's frame loop renders the result. React's render cycle is bypassed entirely for anything that changes at 60 fps.

---

## 3. System Decomposition

Eight independent systems, each with a single owner module and a narrow public interface:

### 3.1 Scroll Engine
Owns scroll normalization: instantiates Lenis (smooth scroll), drives it from GSAP's ticker (single rAF for the whole app), forwards scroll updates to ScrollTrigger, exposes programmatic `scrollTo(label)` for nav. Handles reduced-motion users (disables smoothing) and touch behavior. **Nothing else in the app touches `window.scrollY`.**

### 3.2 Scene Director (Scene Manager)
The brain. Consumes the declarative **story definition** (§5), builds the master GSAP timeline at startup, creates per-section ScrollTriggers, and publishes the current chapter + progress to the state store. Rebuilds timelines on breakpoint changes via `gsap.matchMedia`. This is the only system that knows the whole story.

### 3.3 3D Renderer (Stage)
The single persistent R3F `<Canvas>`: renderer configuration (tone mapping, color space, DPR), lighting rig, environment, the hero object, and Suspense boundaries. Exposes a **registry of named refs** (hero group, camera rig, annotation anchors) that the Scene Director animates. Knows nothing about scroll.

### 3.4 Camera Controller
A camera rig abstraction: a group the camera sits in, plus a look-at target object. GSAP tweens rig position and target position (never camera quaternions directly — look-at interpolation avoids gimbal/flip artifacts). Per-frame, applies `lookAt` and optional damped mouse-parallax offset on top of the choreographed pose. Handles responsive FOV/distance fitting so the object occupies consistent screen fraction across aspect ratios.

### 3.5 Animation Controller
Authoring conventions and shared vocabulary: easing tokens (e.g., a house ease for object moves, another for type), duration scales, reusable timeline fragments (text reveal, annotation pop, material crossfade). Also owns **non-scroll animations** — idle float loop (additive, runs in `useFrame` on top of GSAP-set base values), hover effects, and future event-driven animations (add-to-cart flight). Keeping additive idle motion separate from scrubbed motion prevents the two from fighting.

### 3.6 DOM Synchronization Layer
Two-way bridge between WebGL and HTML (§7): projects 3D anchor points to screen coordinates for floating annotations, and lets the Scene Director toggle DOM section reveals at the right timeline labels. Owns occlusion/visibility logic for labels.

### 3.7 Asset Management Layer
Build-time pipeline (gltf-transform: Draco/Meshopt geometry, KTX2 textures, pruning) and runtime loading: preload manifests, Suspense integration, a loading screen with minimum display time and real progress, disposal on teardown. Enforces asset budgets (§9).

### 3.8 Performance / Quality Layer
Device classification at boot (GPU tier, memory, reduced-motion, pointer type) → a **quality tier** (`high | medium | low | static`). Runtime adaptation via drei `PerformanceMonitor`: degrade DPR → disable post-processing → swap to baked shadows → ultimately a static-image fallback. Every expensive feature in the app must read its enablement from this layer, never decide locally.

---

## 4. Rendering Strategy

### Single persistent canvas — recommended, non-negotiable

| | Single fixed canvas | Multiple per-section canvases |
|---|---|---|
| WebGL contexts | 1 | N (browsers cap ~8–16, mobile fewer) |
| Object continuity between sections | Native — same object instance | Impossible without visual cuts |
| GPU memory | Shared geometry/textures | Duplicated per context |
| Complexity | One render loop | N loops, N resize handlers |

The entire premise (one object traveling through the story) requires a **single `<Canvas>` rendered once at app root, position-fixed, full viewport**, never unmounted. Multiple canvases are only appropriate for galleries of independent objects, which this is not.

### Fixed canvas architecture

- Canvas sits in a fixed, full-viewport layer. DOM content scrolls in normal flow above it (canvas `z-index` below content; content sections use transparent backgrounds where the object should show through).
- The **DOM defines scroll length**: N full-height sections (some 200–300vh for longer beats) create the scroll track. ScrollTrigger maps that track to timeline progress. This keeps native scrollbar behavior, accessibility, and SEO-visible content — the document is real.
- Pointer events: canvas layer is `pointer-events: none` by default, selectively re-enabled on interactive 3D elements later. DOM stays fully interactive.
- **Prefer fixed canvas + scroll-mapped timeline over ScrollTrigger pinning** for the main stage. Pinning (pin-spacers) interacts badly with smooth scrolling and resize on iOS; a fixed canvas needs no pinning at all. Pinning remains available for isolated DOM moments (e.g., a horizontal-scroll text beat) but is not the backbone.

### Section-driven scene transitions

"Scenes" are **regions of one master timeline**, not separate Three.js scenes. A transition is just the timeline segment between two labels — which guarantees that scrubbing through a boundary is continuous. Discrete swaps (lighting rig changes, environment intensity, fog color, even swapping a secondary object) are choreographed as crossfades *inside* the timeline, so even "scene changes" scrub smoothly in reverse.

### Camera management

- One `PerspectiveCamera` inside the camera-rig group (§3.4). No `OrbitControls` in production (dev-only, behind a flag, mutually exclusive with the scroll rig).
- Choreography is authored as **camera keyframes per scene**: rig position, look-at target, FOV. The Director tweens between them.
- Mouse/gyro parallax is applied as a small additive offset in `useFrame` with damping — layered on top of, never replacing, the scrubbed pose.
- Responsive framing: per-breakpoint keyframe overrides via `gsap.matchMedia` (e.g., on mobile the object stays centered and the text overlays it, rather than side-by-side framing).

---

## 5. Scene Architecture

### Scenes as data, not components

Each scene (chapter) is a **plain, serializable descriptor object** — pure data, no functions, no Three.js references. Conceptually:

- **identity**: `id`, `order`, human-readable name
- **scroll mapping**: which DOM section element anchors it; relative duration weight (how much scroll track it consumes)
- **object pose**: target position / rotation / scale for the hero object (in normalized stage coordinates, not pixels — see below)
- **camera pose**: rig position, look-at target, FOV
- **environment state**: light intensities, environment rotation, fog/background color, post-processing intensity
- **content bindings**: which DOM content block reveals here, and at what local progress (0–1 within the scene) reveals trigger
- **annotations**: list of `{ anchorName, label, visibleRange }` referencing named empties baked into the glTF
- **transition spec**: ease token and overlap for the inbound transition
- **responsive overrides**: partial descriptor per breakpoint (`mobile`, `tablet`), deep-merged over the base

The full story is an **ordered array of these descriptors** — the story definition. It lives in its own module with zero imports from React or Three.

### Why data-first

1. **The Director becomes an interpreter.** One generic system reads descriptors and emits timelines. Adding scene #7 means appending a descriptor and a DOM section — no new animation code.
2. **Serializable = CMS-ready** (§14). The same JSON shape can later come from a headless CMS or be generated per-product.
3. **Testable.** Descriptor validation (anchors exist, ranges don't overlap, weights sum correctly) is a pure unit test.

### Coordinate convention

Object and camera positions are authored in a **normalized stage space** (e.g., x in viewport-width fractions, y in viewport-height fractions, z in absolute world units) and resolved to world coordinates at timeline build time using R3F's computed viewport size. This is what makes one descriptor set survive resizes and aspect-ratio changes; raw world coordinates would need re-authoring per device.

### Transitions

A transition is the tween from scene A's poses to scene B's poses, occupying the scroll gap between A's section and B's section. Defaults: single house ease, ~20% overlap with content fade-out/in. Descriptors can override per-boundary. Because all transitions live on the master timeline, reversal symmetry is automatic.

### Adding future scenes

Checklist (this is the API contract for content growth): add DOM section markup → add descriptor → add any new glTF anchors → run descriptor validation → tune in dev tools (Leva panel exposes live pose editing; "copy pose as descriptor" workflow). Target: a new scene in under an hour of engineering time.

---

## 6. Scroll Animation Strategy

### Layered timeline model (the key decision)

**Layer 1 — The master scrub timeline (3D continuum).**
One GSAP timeline, built by the Director from descriptors, containing *all* hero-object and camera motion for the whole page. One ScrollTrigger scrubs it from page top to bottom. Labels mark scene boundaries.

*Why one timeline instead of per-section triggers for the 3D:* the object's pose must be a pure function of scroll position. With per-section triggers, fast scrolling can interleave callbacks and leave the object in a state composed of two half-finished tweens; a single scrubbed timeline makes that impossible by construction. It also gives free features: progress-based nav, `scrollTo(label)`, and perfect reverse playback.

**Layer 2 — Per-section DOM triggers.**
Each content section gets its own small ScrollTrigger for text/UI reveals — *toggle-based* (play/reverse on enter/leave), not scrubbed. Typography that scrubs with scroll feels mechanical; typography that plays a designed 0.6–0.9 s reveal when its moment arrives feels intentional. These triggers are independent of Layer 1 and cheap to add/remove.

**Layer 3 — Additive/idle animations.**
Idle float, breathing light, hover responses — run on the frame loop, applied as offsets on top of GSAP-set base values (e.g., a child "float" group inside the hero group so transforms compose without conflict). Never written into scrubbed properties directly, or scrub and idle will fight for the same value.

### Smooth scrolling: Lenis (recommended) vs ScrollSmoother

| | **Lenis** (recommended) | ScrollSmoother |
|---|---|---|
| Mechanism | Virtualizes wheel input, keeps native scroll position | Transforms a wrapper element |
| `position: fixed` elements | Work natively — critical for our fixed canvas | Must live outside the smooth wrapper; fragile |
| Accessibility/native feel | Native scrollbar, keyboard, find-in-page intact | Wrapper transform can confuse AT |
| GSAP integration | 3 lines: drive from GSAP ticker, forward updates to ScrollTrigger | Zero-config |
| Cost | Free | Free (since 3.13) |

Lenis wins because the fixed-canvas architecture depends on `position: fixed` behaving normally. **Important interaction:** Lenis already interpolates scroll (lerp ≈ 0.1); therefore the master ScrollTrigger should use `scrub: true` (exact), not `scrub: 1+` — double smoothing produces a laggy, "drunk" feel. On touch devices Lenis smoothing is typically reduced or disabled (native momentum is already good); `scrub: ~0.5` can be re-introduced there for polish. This asymmetry must be encoded in the Scroll Engine, not sprinkled around.

### Timeline ownership rules

- The **Director owns** the master timeline and all section triggers: creates them in one place, in one order (ScrollTrigger refresh order matters), kills them in one cleanup.
- All GSAP creation goes through `useGSAP` (already installed) for automatic context cleanup — this is what makes GSAP safe under React 19 StrictMode double-invocation.
- **No component creates its own ScrollTrigger ad hoc.** Components request animations via the Director/Animation Controller. This single rule prevents the classic GSAP-in-React failure mode: orphaned triggers after hot reload, wrong refresh order, double-registered pins.

### Synchronization between sections

Scene boundaries are timeline labels; DOM reveal triggers are positioned relative to the same section elements that define those labels. Both layers therefore re-derive from identical DOM geometry on `ScrollTrigger.refresh()` (resize, font load, image load), keeping them aligned without explicit coupling. All positional tween values are authored as function-based values with `invalidateOnRefresh`, so a resize rebuilds correct targets instead of replaying stale pixel values.

---

## 7. DOM ↔ 3D Synchronization

### Communication architecture

Three channels, each unidirectional and narrow:

1. **Scroll → both worlds (primary).** DOM and 3D don't talk to each other per-frame; both are driven by the same scroll-derived timelines. Most "synchronization" is achieved by sharing the playhead, not by message passing.
2. **3D → DOM (annotations).** The Sync Layer projects named 3D anchor points to screen space each frame and positions floating labels.
3. **DOM → 3D (events).** Discrete user events (CTA click, color swatch, future add-to-cart) dispatch actions to the store; the Animation Controller reacts with event-driven (non-scroll) timelines. Never the reverse — 3D code never reaches into DOM structure.

### Label / annotation system

- **Anchors** are named empty nodes placed in the glTF by the 3D artist (e.g., `anchor_lens`, `anchor_port`). The Stage registers them in the ref registry at load. This puts annotation placement in the artist's hands, not in code coordinates.
- **Two implementation tiers:**
  - *Tier 1 (Phases 2–3):* drei `<Html>` with `occlude` — fastest to ship, handles projection and basic occlusion. Caveat: each instance does per-frame matrix work and DOM mutation; fine for ≤ ~6 simultaneous labels.
  - *Tier 2 (Phase 5, if needed):* a custom projection pass — one `useFrame` block projects all visible anchors (`Vector3.project(camera)` → NDC → pixels) and writes `transform: translate3d(...)` to a flat pool of absolutely-positioned label elements. One system, one loop, cheap occlusion via a few raycasts or screen-depth comparison. The label *content* stays React-rendered (low frequency); only *position* is imperative (high frequency) — consistent with the §2 rule.
- Label visibility windows come from scene descriptors (`visibleRange` in local progress), animated as part of Layer 2 reveals, with fade + slight y-drift rather than popping.

### Responsive positioning

- Annotations clamp to safe-area insets and flip their leader-line side near viewport edges.
- On mobile, annotation density drops (descriptor responsive overrides) — small screens with 5 floating labels read as clutter; prefer 1–2 or fold annotation content into the section copy.
- Because object framing is authored in normalized stage space (§5), annotations track the object automatically across breakpoints; no separate mobile coordinate set is needed for anchors.

---

## 8. State Management

### Placement table

| State | Lives in | Examples | Why |
|---|---|---|---|
| Low-frequency app/UI state | **React state / Zustand (subscribed)** | asset-loaded flag, active modal, quality tier, reduced-motion, current chapter *for UI* (nav highlight) | Changes rarely; should trigger renders |
| High-frequency animated values | **GSAP timelines** | object/camera pose, material uniform values, reveal progress | GSAP is the single writer; scrub-deterministic |
| Mutable handles & scratch | **Refs** | Three object refs, timeline/Lenis/trigger instances, pre-allocated scratch `Vector3`s, ref registry | Mutation without re-render; identity stable across renders |
| Per-frame derived values | **Three.js objects via `useFrame`** | applied `lookAt`, parallax offsets, projected label positions | Computed and consumed inside the frame, never stored in React |
| Cross-system per-frame reads | **Zustand transient** (`getState()` / `subscribe`, no hook subscription) | scroll velocity, normalized global progress, pointer position | Shared without rendering; the documented R3F pattern |

### Best practices (enforced as review rules)

1. **Never `setState` from `useFrame`, GSAP `onUpdate`, or scroll callbacks.** If a per-frame value must reach React (e.g., chapter indicator), throttle/snap it to discrete changes (chapter index changes ~6 times per page, not 60 times per second).
2. **One writer per property.** Scrubbed GSAP owns base transforms; idle/parallax owns separate wrapper groups; they compose structurally, never write to the same field.
3. **No allocation in the frame loop.** Scratch vectors/quaternions pre-allocated in refs. (Three.js GC pressure is a top-3 cause of scroll jank.)
4. **React Compiler note:** the compiler (already enabled) auto-memoizes the DOM tree — good. It must never be "worked around" by moving mutable 3D values into reactive state for convenience; the ref discipline above keeps compiler-land and mutation-land cleanly separated.
5. **Store actions, not imperatives, across boundaries.** DOM dispatches `addToCart(productId)`; the Animation Controller decides what that looks like. Keeps future features (audio feedback, analytics) attachable to the same action.

---

## 9. Performance Strategy

### Frame budget (16.6 ms @ 60 fps target)

| Slice | Budget |
|---|---|
| Lenis + ScrollTrigger update + GSAP tick | ≤ 2 ms |
| `useFrame` work (lookAt, parallax, projections) | ≤ 1.5 ms |
| Three.js CPU (matrices, draw call submission) | ≤ 3 ms |
| GPU frame (measured separately) | ≤ 8 ms mid-tier |
| Headroom | ~2 ms |

Frameloop strategy: `always` for v1 (idle float means the scene is never truly static), with DPR clamped to `[1, 2]` desktop / `[1, 1.5]` mobile. Re-evaluate `demand` + invalidate-on-activity in Phase 5 for battery on idle dwell.

### Asset & texture strategy

- **Geometry:** glTF, Draco or Meshopt compressed (gltf-transform in the build pipeline). Hero budget ≤ 150 k triangles desktop; a decimated ≤ 60 k LOD for the low tier.
- **Textures:** KTX2/Basis universal (GPU-resident compression — the single biggest mobile memory lever vs PNG/JPG, which decompress to full RGBA in VRAM). 2048² max desktop, 1024² mobile. PBR maps channel-packed (AO/rough/metal in one texture).
- **Lighting:** small compressed HDRI for environment (or drei preset); **no real-time shadow maps** — baked AO + drei `ContactShadows` (rendered once, not per frame) achieve the premium grounded look at near-zero cost.
- **Budget:** total 3D payload ≤ 4 MB compressed; hero glTF ≤ 1.5 MB.

### Loading, lazy loading & code splitting

- Three/R3F/drei isolated in a lazy chunk: initial route shell (React + GSAP + Lenis + critical CSS) renders headline content immediately; canvas chunk + assets stream behind a designed loading state. Target: shell ≤ 120 KB gz, 3D vendor chunk ≤ 250 KB gz.
- glTF/KTX2 preloaded via manifest during the loading screen (real progress, minimum display ~0.8 s to avoid flash).
- Below-the-fold non-3D imagery: native `loading="lazy"`.
- Post-processing chunk loaded only when quality tier permits.

### Quality tiers & mobile

| Tier | Trigger | Configuration |
|---|---|---|
| high | desktop, capable GPU | DPR 2, post-processing, full-res textures |
| medium | mid mobile / weak laptop | DPR 1.5, no post, 1024 textures |
| low | old device, `PerformanceMonitor` decline | DPR 1, LOD mesh, simplified materials, fewer annotations |
| static | WebGL unavailable / reduced-motion+save-data | pre-rendered imagery per section; page remains a complete story |

Detection: GPU tier heuristic at boot + drei `PerformanceMonitor` for live degradation (never live *upgrade* mid-session except DPR). The static tier is a product requirement, not a 404 — content must stand alone.

### Memory management

- Single hero model instance, reused across the whole story (never re-loaded per scene).
- Explicit disposal path if the canvas ever unmounts (R3F handles most; render targets and cloned materials need manual care).
- Watch iOS Safari: aggressive tab memory limits — KTX2 textures and capped DPR are the mitigation; test on a real 3-year-old iPhone, not the simulator.

### Identified risks

GC pauses from frame-loop allocation · texture decode jank on scroll-in (preload everything up front) · post-processing doubling GPU cost on fillrate-limited mobiles (tier-gated) · drei `Html` annotation count scaling (Tier-2 projection fallback ready).

---

## 10. Project Structure

```
src/
├─ app/                  # Shell: App, providers, ErrorBoundary, loading screen
├─ story/                # ⭐ Scene descriptors (pure data) + validation + easing/duration tokens
├─ systems/
│  ├─ scroll/            # Scroll Engine: Lenis + ScrollTrigger wiring (sole owner of scroll)
│  ├─ director/          # Scene Director: timeline builder, matchMedia, trigger lifecycle
│  ├─ quality/           # Device tiering, PerformanceMonitor policy
│  └─ assets/            # Manifests, preload, disposal
├─ stage/                # Everything inside <Canvas>: renderer config, lighting rig,
│  │                     #   camera rig, hero model, anchors, effects (Phase 4)
│  └─ registry/          # Named ref registry (the only Stage↔Director contract)
├─ sections/             # DOM content sections (semantic HTML, transparent stage windows)
├─ sync/                 # DOM↔3D layer: annotations, projection, occlusion
├─ ui/                   # Shared DOM components: nav, progress, buttons, type primitives
├─ state/                # Zustand store(s): app slice (reactive) + transient slice
├─ hooks/                # Cross-cutting hooks (reduced-motion, breakpoint, registry access)
└─ styles/               # Tokens, global CSS, section layout primitives
```

### Module boundaries (the rules that keep it scalable)

- **`story/` imports nothing** from React/Three/GSAP — pure data + types. This is the seam for CMS/multi-product futures (§14).
- **`stage/` never imports ScrollTrigger or reads scroll.** It builds the scene and registers refs. The Director animates through the registry.
- **`sections/` never imports Three.** DOM is DOM.
- **`systems/scroll` is the only module importing Lenis**; **`systems/director` is the only module creating ScrollTriggers.**
- Dependency direction: `story → (read by) director → (mutates via) registry → stage`, and `sections ← director` for reveals. No cycles; each system is replaceable in isolation (e.g., swap Lenis for ScrollSmoother by touching one folder).

Ownership: one engineer can own `stage/` (3D craft) while another owns `director/ + story/` (choreography) with the ref registry as their only contract — this decomposition is also a team-parallelization strategy.

---

## 11. Development Phases

### Phase 1 — Foundation (week 1)
- **Goals:** Scroll backbone + page skeleton + budgets locked. No 3D yet.
- **Deliverables:** deps installed; Lenis + ScrollTrigger wired through Scroll Engine; `useGSAP` conventions; 4–6 semantic DOM sections with type system & layout tokens; Zustand store skeleton; reduced-motion handling; CI with type/lint; performance budgets documented.
- **Risks:** smooth-scroll feel disagreements (timebox tuning); ScrollTrigger + Lenis mis-wiring (single rAF rule from day one).
- **Validation:** DOM-only text reveals scrub/toggle correctly; 60 fps scrolling; no orphaned triggers after HMR (StrictMode on); keyboard/native scroll intact.

### Phase 2 — 3D Integration (weeks 2–3)
- **Goals:** Persistent fixed canvas with the hero asset, loading correctly and looking premium *statically*.
- **Deliverables:** Stage with renderer config (color space, tone mapping, DPR clamp); asset pipeline (gltf-transform → Draco/Meshopt + KTX2); hero model + lighting rig + environment + contact shadows; ref registry; Suspense loading screen with real progress; Leva dev panel; r3f-perf in dev.
- **Risks:** asset quality discovered late (get the *real* model in this phase, not a cube); iOS memory ceiling (test on real hardware now).
- **Validation:** visual sign-off on hero framing across 4 breakpoints; load ≤ 4 MB / interactive ≤ 3 s on fast-3G-class throttling; zero React re-renders during idle float (React DevTools profiler).

### Phase 3 — Scroll Storytelling (weeks 3–5) — *the heart*
- **Goals:** Full scroll choreography: master timeline from descriptors, camera rig, object journey across all sections, DOM reveals synchronized.
- **Deliverables:** Scene descriptor schema + validation; Director building Layer-1 master scrub + Layer-2 section reveals; camera rig with lookAt tweening + responsive framing via `matchMedia`; normalized stage-space resolution; first annotation pass (drei `Html`); `scrollTo(label)` nav.
- **Risks:** *choreography iteration time dominates* — mitigate with Leva live-pose editing and descriptor hot-reload; double-smoothing lag (lock `scrub: true` with Lenis); resize correctness (function-based values + `invalidateOnRefresh` from the first tween, not retrofitted).
- **Validation:** scrub up/down at any speed → no pops, no desync; resize mid-scroll → correct poses after refresh; rotation has no flips at any scroll position; 60 fps desktop / ≥ 40 fps iPhone 12-class through the full story; a new test scene can be added via descriptor alone.

### Phase 4 — Advanced Effects (weeks 5–7)
- **Goals:** The layer that separates "good" from "award": material transitions, particles, post-processing, micro-interactions, optional audio.
- **Deliverables:** material/uniform choreography on the master timeline (e.g., color story, fresnel accent); GPU particle moment (instanced/points, capped count, tier-gated); post chunk (bloom/vignette/grain) behind quality tier; mouse-parallax camera offset; magnetic CTA + hover micro-interactions; optional audio feedback behind explicit user opt-in (autoplay policies).
- **Risks:** effect creep destroying mobile perf (every effect lands with its tier gate in the same PR); shader maintenance (prefer drei/material extensions over bespoke shaders where possible).
- **Validation:** high tier holds 60 fps with post enabled; medium tier visually acceptable with post off; A/B perception review against Phase 3 build ("does each effect earn its cost?").

### Phase 5 — Optimization (week 7–8)
- **Goals:** Hit every number in §13 on real devices.
- **Deliverables:** bundle analysis + final chunk strategy; annotation Tier-2 projection if `Html` shows up in profiles; `PerformanceMonitor` degradation policy tuned; texture/LOD finalization; loading-screen polish; memory soak test (10 min scroll loop, no growth); frameloop `demand` evaluation.
- **Risks:** optimization regressing visuals (visual regression screenshots per tier); chasing synthetic scores over feel (real-device metrics are the gate, Lighthouse is advisory for the WebGL path).
- **Validation:** §13 table green on the device matrix; bundle budgets met; no GC saw-tooth in performance traces during scroll.

### Phase 6 — Production Hardening (week 8–9)
- **Goals:** Ship-ready: resilience, accessibility, cross-browser, observability.
- **Deliverables:** WebGL context-loss recovery + error boundaries → static-tier fallback; full reduced-motion experience audit; semantic/heading audit, focus management, label `aria` handling; SEO/meta/OG + social share imagery; analytics (chapter-reached, scroll-depth, CTA); browser matrix pass (Chrome/Safari/Firefox/Edge, iOS Safari, Android Chrome, Samsung Internet); RUM (web-vitals + custom fps beacon); deploy pipeline with immutable asset caching.
- **Risks:** Safari-specific WebGL/scroll bugs surfacing late (matrix testing starts in Phase 3, this phase only closes the tail); content/legal review timing.
- **Validation:** zero console errors across matrix; context-loss simulated → graceful recovery; static tier reviewed as a complete experience; accessibility audit pass; RUM dashboards live.

---

## 12. Technical Risks & Mitigations

### GSAP / ScrollTrigger pitfalls

| Risk | Mitigation |
|---|---|
| StrictMode double-mount creating duplicate triggers/tweens | All GSAP via `useGSAP` (context-scoped auto-cleanup); Director owns creation/teardown centrally |
| Stale pixel values after resize | Function-based tween values + `invalidateOnRefresh: true` everywhere from day one |
| Trigger refresh order corruption (mixed creation sites) | Single creation site (Director), ordered top-to-bottom; `ScrollTrigger.sort()` after build |
| Pin-spacer + smooth-scroll conflicts | Architecture avoids pinning for the main stage entirely (fixed canvas) |
| Double smoothing (Lenis lerp + scrub lag) | `scrub: true` when Lenis smoothing active; codified in Scroll Engine |
| Late layout shift (fonts/images) breaking trigger positions | `font-display` strategy + dimension-reserved media + explicit `refresh()` after load events |

### React Three Fiber pitfalls

| Risk | Mitigation |
|---|---|
| Re-render storms (reactive state in the 3D tree) | §8 placement table enforced in review; React DevTools profiler check is a phase gate |
| Frame-loop allocations → GC jank | Pre-allocated scratch objects; lint convention for `new` inside `useFrame` |
| Suspense fallback flashes mid-experience | All assets preloaded up front via manifest; no lazy 3D loads mid-scroll |
| WebGL context loss (mobile tab switching) | Context-loss listener → recovery or static tier (Phase 6 deliverable) |
| React Compiler memoizing around mutable Three objects unexpectedly | Mutations confined to refs/`useFrame` (compiler-invisible); `"use no memo"` escape hatch if a specific component misbehaves |

### Responsiveness / mobile / browser

| Risk | Mitigation |
|---|---|
| iOS URL-bar height changes firing resize → refresh storms + viewport jumps | `svh/dvh` units; `ScrollTrigger.config({ ignoreMobileResize: true })`; width-only refresh policy |
| Mobile GPU fillrate (the #1 mobile killer) | DPR ≤ 1.5, no post-processing on medium/low, KTX2 textures |
| Landscape-phone framing breaking composition | Explicit landscape-mobile `matchMedia` variant in descriptors (treated as its own breakpoint, not "small desktop") |
| iOS Low Power Mode capping rAF at 30 fps | Animations are scroll-scrubbed (position-correct at any frame rate); idle loops are delta-time based |
| Safari color/tone-mapping differences, Firefox perf deltas | Browser matrix testing from Phase 3; renderer output settings standardized early |
| Find-in-page / anchor links / keyboard scroll with virtual smoothing | Lenis keeps native scroll position (core reason it was chosen); explicit keyboard-nav test case |

---

## 13. Success Criteria

| Category | Metric | Target |
|---|---|---|
| Frame rate | p95 during continuous scroll, desktop (M1/RTX-class) | ≥ 58 fps |
| | p95 during scroll, iPhone 12 / Pixel 6 class | ≥ 40 fps |
| | Long frames (> 50 ms) per full story scroll | 0 |
| Loading | Initial shell (HTML+CSS+JS, gz, pre-3D) | ≤ 120 KB |
| | 3D vendor chunk (gz) | ≤ 250 KB |
| | Total 3D assets (compressed) | ≤ 4 MB |
| | LCP (hero text, pre-canvas) | ≤ 2.5 s (4G) |
| | CLS | < 0.1 |
| Interaction | Scroll input → visual response | ≤ 50 ms |
| | Scrub reversal correctness | Pixel-identical poses at equal progress, any direction/speed |
| | Resize/orientation mid-scroll | Correct framing within one refresh, no visual corruption |
| Memory | 10-minute scroll soak | No monotonic JS-heap/VRAM growth; no iOS Safari tab reload |
| Quality | Visual sign-off per tier (high/medium/low/static) at 4 breakpoints | Design approval recorded |
| | Reduced-motion experience | Complete content parity, no scroll-driven motion |
| Robustness | Console errors across browser matrix | 0 |
| | WebGL-unavailable path | Fully usable static page |
| Process | New scene added via descriptor only (no system changes) | ≤ 1 hour engineering |

A release is shippable only when every row is green on the agreed device matrix; fps and memory rows are measured on real hardware, not emulators.

---

## 14. Future Expansion

The data-first story layer and the registry seam are the two deliberate extension points:

- **Product configurators.** Material/color variants become a `variants` field on descriptors + a Zustand product slice; the Animation Controller already owns event-driven material transitions (Phase 4 built the mechanism). Camera "focus modes" reuse the camera-rig keyframe system outside the scroll context (scroll scrub pauses, an event timeline takes over, then hands back — both are just GSAP timelines writing through the same registry).
- **E-commerce flows / add-to-cart flight.** The cart icon is DOM; its screen position unprojects to a world-space ray, giving a 3D flight target for a cloned, shrinking hero — the inverse of the annotation projection already in the Sync Layer. Cart state is ordinary React/Zustand commerce code, fully decoupled from the stage.
- **Multiple products.** The story definition becomes parameterized: per-product descriptor sets + asset manifests, loaded by route. Director, Stage, and Sync are already product-agnostic interpreters; this is data multiplication, not architecture change. Shared scene "templates" keep choreography consistent across a catalog.
- **AR/VR.** Same optimized glTF/USDZ exports feed AR Quick Look / Scene Viewer (zero new runtime) or a WebXR mode via R3F's XR ecosystem — the Stage already isolates camera control behind the rig abstraction, which is the hard prerequisite for XR (where the headset owns the camera).
- **AI-generated assets.** The asset pipeline (gltf-transform validation, budgets, anchor-naming contract) becomes the quality gate for generated models: any glTF passing validation slots into the existing manifest. Descriptors being plain data means AI can also *author choreography drafts* against the schema.
- **CMS-driven storytelling.** Descriptors are serializable by design (§5): move `story/` content to a headless CMS collection, validate at build/ISR time, and editors compose scenes (copy, order, poses chosen from preset vocabularies, annotation text) without engineering involvement. The descriptor validation suite becomes the publish gate.

---

## Verification (for this document)

Acceptance for this deliverable: the document covers all 14 requested sections with concrete recommendations (single fixed canvas, Lenis over ScrollSmoother, layered timeline ownership, data-first scene descriptors, quality tiers), each major decision includes tradeoffs, and the phase plan contains goals/deliverables/risks/validation per phase. Implementation has deliberately **not** begun — no code or files beyond this document.