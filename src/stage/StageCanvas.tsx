import { useProgress } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, lazy, useEffect } from 'react';
import { useAppStore } from '../state/store';
import { renderProfiles } from '../systems/quality/quality';
import { StageScene } from './StageScene';

// Dev-only chunk: in production builds `import.meta.env.DEV` is statically
// false, so leva/r3f-perf never enter the bundle.
const StageDevTools = import.meta.env.DEV
  ? lazy(() => import('./StageDevTools'))
  : null;

/**
 * The single persistent canvas (design §4): position-fixed at --z-stage,
 * full viewport, pointer-events:none, never unmounted. Lazy-loaded as its
 * own chunk (this file is the entry — nothing outside `stage/` may import
 * it statically). Knows nothing about scroll (§10): the Director animates
 * the scene through the ref registry only.
 *
 * Renderer config (§9): R3F v9 defaults already give sRGB output +
 * ACESFilmic tone mapping (we deliberately do not pass `flat`/`linear`);
 * DPR is clamped per quality tier; alpha lets the page background show
 * through; no shadow maps (grounding comes from ContactShadows).
 */
export default function StageCanvas() {
  const qualityTier = useAppStore((s) => s.qualityTier);
  const stageReady = useAppStore((s) => s.stageReady);
  const profile =
    qualityTier === 'static' ? renderProfiles.low : renderProfiles[qualityTier];

  return (
    <div
      className={stageReady ? 'stage stage--ready' : 'stage'}
      aria-hidden="true"
    >
      <Canvas
        dpr={profile.dpr}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          stencil: false,
        }}
        // 'always' for v1 — the idle float means the scene is never truly
        // static (§9). Re-evaluate frameloop='demand' in Phase 5.
        frameloop="always"
      >
        <Suspense fallback={null}>
          <StageScene />
          <StageReadySignal />
        </Suspense>
        {StageDevTools ? (
          <Suspense fallback={null}>
            <StageDevTools />
          </Suspense>
        ) : null}
      </Canvas>
      <StageProgressBridge />
    </div>
  );
}

/**
 * Flips stageReady once the scene's Suspense tree has actually committed
 * (drives the canvas fade-in + hides the loading bar). Cleanup resets it,
 * keeping StrictMode/HMR symmetric.
 */
function StageReadySignal() {
  const setStageReady = useAppStore((s) => s.setStageReady);
  useEffect(() => {
    setStageReady(true);
    return () => setStageReady(false);
  }, [setStageReady]);
  return null;
}

/**
 * Mirrors drei's loader store into the app store so DOM chrome (the
 * loading bar in StageMount) can show real progress without importing
 * drei — which would drag Three.js into the main chunk. Loader events are
 * discrete per-file, not per-frame, so writing reactive state here is
 * within the §8 rules.
 */
function StageProgressBridge() {
  const progress = useProgress((s) => s.progress);
  const setStageProgress = useAppStore((s) => s.setStageProgress);
  useEffect(() => {
    setStageProgress(progress);
  }, [progress, setStageProgress]);
  return null;
}
