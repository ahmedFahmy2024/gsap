import { useEffect } from 'react';
import { transientStore } from '../state/store';

/**
 * Mirrors mouse position into the transient store as viewport-normalized
 * -1…1 coordinates (+y up, matching world space) — the §8 "pointer position"
 * slot. High-frequency by nature, so it writes ONLY the transient store;
 * consumers (CameraRig's parallax) read it with getState() inside the frame
 * loop, never via subscription.
 *
 * Mouse-only on purpose: touch pointermoves are scroll gestures, and a
 * parallax that tracked them would fight the scrub.
 */
export function usePointerSync(): void {
  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') {
        return;
      }
      transientStore.setState({
        pointerX: (event.clientX / window.innerWidth) * 2 - 1,
        pointerY: -((event.clientY / window.innerHeight) * 2 - 1),
      });
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      transientStore.setState({ pointerX: 0, pointerY: 0 });
    };
  }, []);
}
