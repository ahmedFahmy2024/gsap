/**
 * Motion vocabulary — the shared easing/duration tokens every GSAP
 * animation in the app must use. Pure data: no imports from React,
 * GSAP, or Three (see docs/ENGINEERING_DESIGN.md §10 module boundaries).
 *
 * CSS-side counterparts live in src/styles/tokens.css.
 */

/** House eases, by role. Values are GSAP ease strings. */
export const ease = {
  /** Object/camera travel and large spatial moves (Phase 3+). */
  travel: 'power2.inOut',
  /** Content entering: decisive start, soft landing. */
  reveal: 'power3.out',
  /** Content leaving: quick, unceremonious. */
  exit: 'power2.in',
} as const;

/** Durations in seconds, by scale. */
export const duration = {
  fast: 0.4,
  reveal: 0.9,
  slow: 1.4,
} as const;

/** Stagger between sibling reveal elements, seconds. */
export const stagger = {
  text: 0.09,
} as const;

/** Vertical travel for text reveals, px. Small on purpose — premium
 *  reveals read as "settling", not "flying in". */
export const revealDistance = 28;
