import { scrollToSection } from '../systems/scroll/scroll-engine';

/**
 * Section navigation for chrome (header, chapter dots): scroll via the
 * scroll engine, then move focus to the target section (Phase 6 focus
 * management — without this, keyboard/AT users activate a nav control and
 * are left focused on chrome at the top of the page while the view travels
 * elsewhere). Sections carry tabIndex={-1} and an accessible name, so the
 * focus move announces the destination. preventScroll keeps the browser's
 * own focus-scrolling from fighting the engine's travel.
 *
 * Lives next to the components (not in systems/scroll): focus is a DOM
 * concern — the scroll engine's monopoly is scrolling, nothing else (§10).
 */
export function navigateToSection(id: string): void {
  scrollToSection(id);
  document.getElementById(id)?.focus({ preventScroll: true });
}
