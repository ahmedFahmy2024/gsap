import { useEffect } from 'react';
import { useAppStore } from '../state/store';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Mirrors the OS reduced-motion preference into the app store, live.
 * Mount once near the root; everything else reads from the store so the
 * whole app reacts if the user flips the setting mid-session.
 */
export function useReducedMotionSync(): void {
  const setReducedMotion = useAppStore((s) => s.setReducedMotion);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    setReducedMotion(mql.matches);
    const onChange = (event: MediaQueryListEvent) =>
      setReducedMotion(event.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [setReducedMotion]);
}
