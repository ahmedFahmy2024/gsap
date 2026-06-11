# Phase 1 Handoff — Foundation

**Date:** 2026-06-11 · **Status:** Code complete & API-verified; deps installed; lint/typecheck/live validation pending (see "Outstanding" below)
**Package runner:** bun (`bun run dev` / `bun run lint` / `bun run typecheck`)
**Architecture contract:** `docs/ENGINEERING_DESIGN.md` (section § references below point there)
**Agent rules:** `AGENTS.md`

## What Phase 1 delivered

Phase 1 = the scroll backbone and DOM skeleton, **no 3D yet** (per §11 Phase 1).
The page is a 5-chapter product story for "ORBE" (fictional sculpted speaker):
hero → craft → acoustics → detail → CTA. Lenis smooth scroll, toggle-based
GSAP text reveals per section, chapter tracking, reduced-motion fallback.

## File inventory (all new unless noted)

| Path | Role |
|---|---|
| `src/main.tsx` (modified) | Entry; imports `styles/global.css`, mounts `app/App` under StrictMode |
| `src/app/App.tsx` | Shell: mounts the three root hooks + header, indicator, sections, footer. Comment marks where the Phase 2 canvas mounts |
| `src/story/sections.ts` | Pure-data chapter content + `chapters` list (nav/indicator source). Grows into full scene descriptors in Phase 3 (§5) |
| `src/story/motion.ts` | Motion vocabulary: `ease.travel/reveal/exit`, `duration`, `stagger`, `revealDistance`. All GSAP code must use these |
| `src/state/store.ts` | `useAppStore` (reactive: `reducedMotion`, `currentChapter`) + `transientStore` (vanilla: `scrollProgress`, `scrollVelocity`; getState-only, §8) |
| `src/hooks/useReducedMotionSync.ts` | Mirrors `prefers-reduced-motion` into the store, live |
| `src/systems/scroll/scroll-engine.ts` | **Sole owner of scroll.** Lenis (autoRaf:false, lerp 0.1, syncTouch:false) driven from `gsap.ticker` (×1000 → ms), forwards to `ScrollTrigger.update()` + transient store. Native-scroll fallback engine when reduced motion. `scrollToSection(id)` for nav. Imports `lenis/dist/lenis.css`. Sets `ScrollTrigger.config({ ignoreMobileResize: true })` and `lagSmoothing(0)` (restored on destroy) |
| `src/systems/scroll/useScrollEngine.ts` | Engine lifecycle; recreates on reduced-motion flip; StrictMode-symmetric |
| `src/systems/director/director.ts` | **Sole creation site for ScrollTriggers.** Per `[data-section]`: chapter-tracking trigger (top/bottom center, `onToggle` → `setCurrentChapter`) + toggle reveal timeline (`[data-reveal]` children, `fromTo` autoAlpha/y, start `top 70%`, `toggleActions: 'play none none reverse'`). Skips reveal tweens entirely under reduced motion (content stays visible — nothing is pre-hidden in CSS) |
| `src/systems/director/useDirector.ts` | Wraps `buildStory` in `useGSAP({ scope, dependencies: [reducedMotion], revertOnUpdate: true })` |
| `src/sections/HeroSection.tsx` | `#hero`, display type + tagline + scroll hint |
| `src/sections/StorySection.tsx` | Generic chapter; `stageSide` ('left'/'right') reserves the opposite half-viewport as a transparent window for the Phase 2 fixed canvas |
| `src/sections/CtaSection.tsx` | `#cta`, reserve/find-a-room buttons (no handlers yet) |
| `src/ui/SiteHeader.tsx` | Fixed header, nav via `scrollToSection`; `pointer-events:none` shell so it never blocks scroll |
| `src/ui/ChapterIndicator.tsx` | Fixed dots; subscribes to `currentChapter` (deliberate low-frequency reactive read) |
| `src/styles/tokens.css` | Design tokens: dark stage palette, fluid type scale (`--text-display` etc.), spacing, z-layers (`--z-stage` 0 / `--z-content` 10 / `--z-chrome` 100) |
| `src/styles/global.css` | Reset + layout primitives (`.section` = 100svh flex, `.section--stage-left/right`), type roles (`.eyebrow/.display/.headline/.lede`), header/dots/buttons/footer |
| `index.html` (modified) | Title/description/theme-color for ORBE |
| `package.json` (modified) | Added deps `gsap ^3.15.0`, `lenis ^1.3.23`, `zustand ^5.0.14`; added `typecheck` script |

## Verified facts (don't re-derive)

- Installed versions checked against actual `node_modules` type definitions:
  **gsap 3.15.0**, **lenis 1.3.23**. All Lenis API usage (constructor options,
  `on('scroll')`, `progress`, `velocity`, `raf(ms)`, `scrollTo`, `destroy`)
  matches `node_modules/lenis/dist/lenis.d.ts` exactly.
- `useGSAP` config `{ scope, dependencies, revertOnUpdate }` matches
  `node_modules/@gsap/react/types/index.d.ts`.
- tsconfig has `verbatimModuleSyntax` + `erasableSyntaxOnly` (no enums,
  type-only imports required). StrictMode is on. React Compiler enabled.

## Outstanding (finish before starting Phase 2)

A platform outage blocked all shell commands during the build session, so
these were never run (dependencies are now installed: gsap 3.15.0,
lenis 1.3.23, zustand 5.0.14):

1. Delete dead scaffold files: `src/App.tsx`, `src/App.css`, `src/index.css`
   (replaced by `src/app/App.tsx` + `src/styles/`; they're unreferenced but
   will confuse readers). Optionally also `src/assets/hero.png`,
   `src/assets/react.svg`, `src/assets/vite.svg` if unused.
2. `bun run lint` and `bun run typecheck` — code was written to pass but
   never executed.
3. Live validation (Phase 1 gate, §11): reveals play on enter / reverse on
   scroll-back; hero reveal plays on load; chapter dots + header nav scroll
   correctly; no console errors; no duplicate triggers under StrictMode
   (scroll after an HMR edit); keyboard scrolling works; with OS
   reduced-motion on, everything is visible with zero animation.

## Phase 2 starting point (§11 Phase 2 — 3D Integration)

Goal: persistent fixed canvas with the hero asset, premium *static* look.

- Install: `three`, `@react-three/fiber@^9`, `@react-three/drei`; dev:
  `leva`, `r3f-perf`. Asset tooling: `@gltf-transform/cli`.
- New `src/stage/` (everything inside `<Canvas>`) + `src/stage/registry/`
  (named ref registry — the only Stage↔Director contract, §3.3) and
  `src/systems/assets/`, `src/systems/quality/`.
- Canvas mounts in `App.tsx` at the marked comment, position-fixed at
  `--z-stage`, `pointer-events:none`, lazy-chunked behind Suspense with a
  real-progress loading screen.
- Renderer config: tone mapping + color space + DPR clamp [1,2]/[1,1.5];
  lighting = environment + drei ContactShadows; **no real-time shadow maps**.
- The Stage must not import ScrollTrigger or read scroll (§10 boundaries).
- Validation gate: §11 Phase 2 (framing sign-off at 4 breakpoints, ≤4 MB
  assets, zero React re-renders during idle float).
