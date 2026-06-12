import { useGSAP } from '@gsap/react';
import type { RefObject } from 'react';
import { useAppStore } from '../../state/store';
import { buildStory } from './director';

/**
 * Mounts the Director inside a gsap context scoped to the page root.
 * useGSAP reverts every tween/ScrollTrigger/matchMedia created by
 * buildStory on unmount (StrictMode-safe) and on dependency changes
 * (revertOnUpdate), so triggers are never orphaned across HMR or
 * preference flips. buildStory's returned cleanup (non-GSAP side effects)
 * runs as part of that same revert.
 *
 * stageReady is a dependency because Layer 1 tweens registry objects that
 * only exist once the lazy stage chunk commits — the whole story rebuilds
 * at that moment, before the canvas fade-in finishes.
 */
export function useDirector(scopeRef: RefObject<HTMLElement | null>): void {
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const stageReady = useAppStore((s) => s.stageReady);

  useGSAP(
    () => {
      if (scopeRef.current) {
        return buildStory(scopeRef.current, { reducedMotion, stageReady });
      }
    },
    {
      scope: scopeRef,
      dependencies: [reducedMotion, stageReady],
      revertOnUpdate: true,
    },
  );
}
