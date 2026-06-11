# AI Agent Instructions

## Project

Premium scroll-driven 3D product landing page ("ORBE", a fictional sculpted
speaker). React 19 + Vite 8 (rolldown) + TypeScript + GSAP/ScrollTrigger +
Lenis + Zustand, with React Three Fiber arriving in Phase 2.

- **Architecture contract:** `docs/ENGINEERING_DESIGN.md` — read it before
  structural changes. Section numbers (§) referenced in code comments point
  there.
- **Phase progress:** `docs/` contains one handoff file per completed phase
  (e.g. `PHASE_1_HANDOFF.md`). Read the latest one to know current state.

## Commands

```bash
bun run dev        # Vite dev server
bun run lint       # eslint
bun run typecheck  # tsc -b
bun run build      # tsc -b && vite build
```

## Architecture rules (load-bearing — do not violate)

1. **GSAP animates values. Three objects are mutated through refs. React
   never sees per-frame data.** Never `setState` from `useFrame`, GSAP
   `onUpdate`, or scroll callbacks.
2. **`src/systems/scroll/` is the only module that touches window scroll or
   imports Lenis.** Use `scrollToSection()` from `scroll-engine.ts`; never
   read `window.scrollY` elsewhere.
3. **`src/systems/director/` is the only place ScrollTriggers are created.**
   Components mark content with `data-section` / `data-reveal` attributes;
   the Director finds and animates them. No ad-hoc triggers in components.
4. **`src/story/` is pure data** — no imports from React/GSAP/Three. It is
   the future CMS seam. Easing/duration tokens live in `story/motion.ts`
   (GSAP side) and `styles/tokens.css` (CSS side); keep them in sync.
5. **State placement** (design doc §8): low-frequency UI state →
   `useAppStore` (reactive); per-frame values → `transientStore` (vanilla
   zustand, read with `getState()` only, never subscribed from components).
6. All GSAP work in React goes through `useGSAP` from `@gsap/react`
   (StrictMode-safe cleanup). StrictMode is ON — keep create/destroy
   symmetric in effects.
7. Lenis smoothing + ScrollTrigger: use `scrub: true` on scrubbed triggers
   (Lenis already lerps; `scrub: 1` would double-smooth). Single rAF: Lenis
   is driven from `gsap.ticker` — never give Lenis its own rAF loop.

## TypeScript / tooling gotchas

- `verbatimModuleSyntax` is on → use `import type { ... }` for type-only
  imports.
- `erasableSyntaxOnly` is on → no enums, no class parameter properties.
- React Compiler is enabled (babel plugin in `vite.config.ts`) → don't
  hand-memoize DOM components; keep 3D/imperative mutation in refs where
  the compiler can't see it.
- `react-refresh` lint rule: component files export components only; hooks
  live in their own files.

## Source Code Reference

Source code for dependencies is cached at `~/.opensrc/`.

Use `opensrc path <package>` to find the cached source path or read the dependency source code:

```bash
# Example usage:
# GSAP Core
cat $(opensrc path gsap)/src/gsap-core.js

# ScrollTrigger and other plugins are part of the main gsap package:
cat $(opensrc path gsap)/src/ScrollTrigger.js
rg "ScrollTrigger" $(opensrc path gsap)/src/

# GSAP React wrapper
cat $(opensrc path @gsap/react)/src/index.js

# Lenis Smooth Scroll
cat $(opensrc path lenis)/packages/core/src/lenis.ts

# Zustand State Management
cat $(opensrc path zustand)/src/vanilla.ts
cat $(opensrc path zustand)/src/react.ts

# Three.js (Core 3D Engine)
cat $(opensrc path three)/src/Three.js
# R3F (React Three Fiber)
cat $(opensrc path @react-three/fiber)/packages/fiber/src/core/renderer.tsx
# Drei (React Three helpers/components)
cat $(opensrc path @react-three/drei)/src/web/Html.tsx

# Leva (Tuning panel GUI)
cat $(opensrc path leva)/packages/leva/src/index.ts

# R3F Perf (Performance monitor)
cat $(opensrc path r3f-perf)/src/index.ts

# glTF-Transform (3D asset processing CLI & Core)
# (Cloned from GitHub directly due to scoped CLI package name)
cat $(opensrc path donmccurdy/glTF-Transform)/packages/cli/src/cli.ts
```

