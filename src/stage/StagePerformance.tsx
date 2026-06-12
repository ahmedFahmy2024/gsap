import { PerformanceMonitor } from '@react-three/drei';
import { useAppStore } from '../state/store';
import type { QualityTier } from '../systems/quality/quality';

/**
 * Live tier degradation (design §3.8, Phase 5): drei's PerformanceMonitor
 * samples fps on the frame loop (10 × 250 ms windows); a "decline" means
 * ~2.5 s sustained below the lower bound (40 fps native, 60 on
 * high-refresh displays — aligned with the §13 targets). Each decline
 * steps the quality tier down one notch through the same store gate every
 * expensive feature already reads:
 *
 *   high → medium  unmounts StageEffects (the post chunk's tier gate),
 *                  halves SoundField, drops the DPR clamp to 1.5, re-bakes
 *                  the contact shadow at 256
 *   medium → low   removes SoundField, DPR 1, env map re-bakes at 128
 *   low            floor — degradation never demotes to 'static':
 *                  unmounting the canvas mid-session is a UX cliff, so
 *                  'static' stays a boot-time classification (and the
 *                  Phase 6 context-loss fallback)
 *
 * Degrade-only, per §9: no onIncline, so a tier never climbs back
 * mid-session (the design allows a DPR-only upgrade exception; not taken —
 * the Canvas dpr prop derives from the tier, and giving DPR a second
 * writer isn't worth the battery refund).
 *
 * Store discipline (§8): the callback fires at most once per ~2.5 s
 * sampling window — a discrete, sanctioned write, same frequency class as
 * chapter crossings. State is read via getState() because the callback
 * runs from the frame loop and a subscribed value would be a stale
 * closure.
 */
const nextTierDown: Partial<Record<QualityTier, QualityTier>> = {
  high: 'medium',
  medium: 'low',
};

export function StagePerformance() {
  return (
    <PerformanceMonitor
      onDecline={() => {
        const { qualityTier, setQualityTier } = useAppStore.getState();
        const lower = nextTierDown[qualityTier];
        if (lower) {
          setQualityTier(lower);
        }
      }}
    />
  );
}
