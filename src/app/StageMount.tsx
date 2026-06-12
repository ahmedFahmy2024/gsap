import { Suspense, lazy, useEffect, useState } from 'react';
import { useAppStore } from '../state/store';
import { StageErrorBoundary } from './StageErrorBoundary';

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
  const stageGeneration = useAppStore((s) => s.stageGeneration);

  if (qualityTier === 'static') {
    return null;
  }

  return (
    <>
      <StageLoadingBar />
      {/* Phase 6 resilience: the boundary demotes to 'static' on any render
          error inside the stage; the generation key remounts the canvas
          after a restored WebGL context (render-once bakes don't survive a
          context swap — see StageContextGuard). */}
      <StageErrorBoundary>
        <Suspense fallback={null}>
          <StageCanvas key={stageGeneration} />
        </Suspense>
      </StageErrorBoundary>
    </>
  );
}

/** Covers the exit animation (0.2 s fill + 0.5 s fade, see global.css). */
const EXIT_MS = 750;

/**
 * Thin real-progress bar while the stage chunk + assets stream in. CSS
 * delays its fade-in, so a fast load never flashes it (this delayed
 * appearance supersedes the §9 "minimum display time" idea — better than
 * showing a loading state nobody needed). Decorative only — never blocks
 * the content.
 *
 * Exit (Phase 5 polish): when the stage commits, the bar fills to 100% and
 * fades out before unmounting, instead of vanishing mid-sliver. The exit
 * is a CSS *animation* rather than a transition so it picks up from the
 * entrance's current opacity — a bar that never appeared exits invisibly.
 * Reduced motion unmounts immediately (transitions are stripped in CSS,
 * so there is nothing to wait for).
 */
function StageLoadingBar() {
  const stageReady = useAppStore((s) => s.stageReady);
  const stageProgress = useAppStore((s) => s.stageProgress);
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const [exitDone, setExitDone] = useState(false);

  useEffect(() => {
    if (!stageReady || reducedMotion) {
      return;
    }
    const id = window.setTimeout(() => setExitDone(true), EXIT_MS);
    return () => window.clearTimeout(id);
  }, [stageReady, reducedMotion]);

  // Reduced motion exits instantly — derived, not stored. exitDone is only
  // consulted once ready, so a fresh load cycle always shows the bar.
  if (stageReady && (exitDone || reducedMotion)) {
    return null;
  }

  return (
    <div
      className={
        stageReady ? 'stage-progress stage-progress--done' : 'stage-progress'
      }
      role="presentation"
    >
      <div
        className="stage-progress__bar"
        style={{ width: stageReady ? '100%' : `${Math.max(stageProgress, 5)}%` }}
      />
    </div>
  );
}
