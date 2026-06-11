import { useGSAP } from '@gsap/react';
import type { RefObject } from 'react';
import { useAppStore } from '../../state/store';
import { buildStory } from './director';

/**
 * Mounts the Director inside a gsap context scoped to the page root.
 * useGSAP reverts every tween/ScrollTrigger created by buildStory on
 * unmount (StrictMode-safe) and on reduced-motion changes
 * (revertOnUpdate), so triggers are never orphaned across HMR or
 * preference flips.
 */
export function useDirector(scopeRef: RefObject<HTMLElement | null>): void {
  const reducedMotion = useAppStore((s) => s.reducedMotion);

  useGSAP(
    () => {
      if (scopeRef.current) {
        buildStory(scopeRef.current, { reducedMotion });
      }
    },
    { scope: scopeRef, dependencies: [reducedMotion], revertOnUpdate: true },
  );
}
