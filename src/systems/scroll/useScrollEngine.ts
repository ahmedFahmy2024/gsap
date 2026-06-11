import { useEffect } from 'react';
import { useAppStore } from '../../state/store';
import { createScrollEngine, setActiveEngine } from './scroll-engine';

/**
 * Owns the scroll engine lifecycle from React. Recreates the engine when
 * the reduced-motion preference flips; create/destroy is symmetric, so
 * StrictMode's double-invoke is harmless.
 */
export function useScrollEngine(): void {
  const reducedMotion = useAppStore((s) => s.reducedMotion);

  useEffect(() => {
    const engine = createScrollEngine({ reducedMotion });
    setActiveEngine(engine);
    return () => {
      setActiveEngine(null);
      engine.destroy();
    };
  }, [reducedMotion]);
}
