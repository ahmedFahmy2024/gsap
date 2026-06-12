import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { useAppStore } from '../state/store';
import { track } from '../systems/analytics/analytics';

/**
 * How long a lost context may stay lost — while the page is VISIBLE —
 * before we stop waiting for the browser and demote to the static tier.
 * The clock never runs while hidden: mobile browsers routinely reclaim the
 * context of a backgrounded tab and restore it on return, and demoting a
 * page nobody is looking at would punish the normal case.
 */
const RESTORE_GRACE_MS = 3000;

/**
 * WebGL context-loss resilience (design §11 Phase 6, §12).
 *
 * - On `webglcontextlost`: preventDefault opts into the browser's
 *   restoration path; a grace timer arms whenever the page is visible.
 * - On `webglcontextrestored`: recovery — but NOT in place. The stage's
 *   render-once work (the baked studio env map, the frames={1} contact
 *   shadows) lives in render targets that come back blank after a context
 *   swap, so the guard bumps `stageGeneration` and StageMount remounts the
 *   whole canvas: fresh renderer, fresh bakes, Director rebuilds on the
 *   stageReady round-trip. From the user's view the object fades back in.
 * - Grace expired: graceful demotion — `setQualityTier('static')` unmounts
 *   the canvas through StageMount's existing tier gate and the DOM story
 *   stands alone (§9: the static tier is a complete page, not a 404).
 *
 * Store writes here are once-per-fault, far below the §8 frequency bar.
 */
export function StageContextGuard() {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const canvas = gl.domElement;
    let timer = 0;
    let lost = false;

    function demote() {
      track('stage_fault', { reason: 'context-lost' });
      useAppStore.getState().setQualityTier('static');
    }

    function arm() {
      if (document.visibilityState === 'visible') {
        timer = window.setTimeout(demote, RESTORE_GRACE_MS);
      }
    }

    function onLost(event: Event) {
      event.preventDefault();
      lost = true;
      arm();
    }

    function onRestored() {
      lost = false;
      window.clearTimeout(timer);
      track('stage_recovered', { reason: 'context-restored' });
      useAppStore.getState().bumpStageGeneration();
    }

    function onVisibilityChange() {
      window.clearTimeout(timer);
      if (lost) {
        arm();
      }
    }

    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearTimeout(timer);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [gl]);

  return null;
}
