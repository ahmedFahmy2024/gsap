import { Suspense, lazy } from 'react';
import { useAppStore } from '../state/store';

// The ONLY entry into stage/ from the app shell, and it is dynamic: Three,
// R3F, and drei live in this lazy chunk; the shell (React + GSAP + Lenis)
// renders headline content immediately (§9 code splitting).
const StageCanvas = lazy(() => import('../stage/StageCanvas'));

/**
 * Mounts the 3D stage unless the device classified as 'static' (§3.8) —
 * WebGL unavailable or reduced-motion + save-data. In that tier nothing
 * 3D ever loads and the DOM story stands alone as a complete page (§9).
 */
export function StageMount() {
  const qualityTier = useAppStore((s) => s.qualityTier);

  if (qualityTier === 'static') {
    return null;
  }

  return (
    <>
      <StageLoadingBar />
      <Suspense fallback={null}>
        <StageCanvas />
      </Suspense>
    </>
  );
}

/**
 * Thin real-progress bar while the stage chunk + assets stream in. CSS
 * delays its fade-in, so a fast load never flashes it; it unmounts the
 * moment the stage commits. Decorative only — never blocks the content.
 */
function StageLoadingBar() {
  const stageReady = useAppStore((s) => s.stageReady);
  const stageProgress = useAppStore((s) => s.stageProgress);

  if (stageReady) {
    return null;
  }

  return (
    <div className="stage-progress" role="presentation">
      <div
        className="stage-progress__bar"
        style={{ width: `${Math.max(stageProgress, 5)}%` }}
      />
    </div>
  );
}
