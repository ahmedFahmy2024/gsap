import { useProgress } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, lazy, useEffect } from 'react';
import { useAppStore } from '../state/store';
import { renderProfiles } from '../systems/quality/quality';
import { StageContextGuard } from './StageContextGuard';
import { StagePerformance } from './StagePerformance';
import { StageScene } from './StageScene';

// Dev-only chunk: in production builds `import.meta.env.DEV` is statically
// false, so leva/r3f-perf never enter the bundle.
const StageDevTools = import.meta.env.DEV
  ? lazy(() => import('./StageDevTools'))
  : null;

// Post chunk (§11 Phase 4): bloom/grain/vignette. Lazy so `postprocessing`
// is a separate download that only the high tier ever requests.
const StageEffects = lazy(() => import('./StageEffects'));

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
        // 'always' — evaluated against 'demand' in Phase 5 and kept (§9):
        // the idle float is the product's living presence, so the scene
        // renders every visible frame by design ('demand' saves nothing);
        // hidden tabs already cost zero (the browser parks rAF, which
        // stops gsap.ticker and this loop together). The one truly static
        // case — reduced motion — would need the Director to call R3F's
        // invalidate() across the chunk boundary after every pose write,
        // a §10 violation, to save power for a cohort §13 doesn't measure.
        frameloop="always"
      >
        <Suspense fallback={null}>
          <StageScene />
          <StageReadySignal />
        </Suspense>
        {/* Context-loss resilience (Phase 6) — outside the scene Suspense:
            a context can be lost while assets are still streaming. */}
        <StageContextGuard />
        {/* Live tier degradation (Phase 5). Mounted only once the scene has
            committed, so load-time jank (shader compiles, asset decode)
            can never trigger a premature decline. */}
        {stageReady ? <StagePerformance /> : null}
        {/* Tier gate (§3.8): post-processing is high-tier only, and the
            chunk request itself is behind the same gate. Outside the scene
            Suspense so a slow post download never delays stageReady. */}
        {qualityTier === 'high' ? (
          <Suspense fallback={null}>
            <StageEffects />
          </Suspense>
        ) : null}
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
